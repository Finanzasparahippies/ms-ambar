from unittest.mock import patch
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.test import override_settings
from config.anti_spam import is_disposable_email, get_client_ip, validate_turnstile_token

class AntiSpamTests(APITestCase):

    def test_disposable_email_detection(self):
        """Verify that high-risk TLDs and disposable domains are correctly flagged."""
        self.assertTrue(is_disposable_email("spammer@bot.ru"))
        self.assertTrue(is_disposable_email("spammer@fake.xyz"))
        self.assertTrue(is_disposable_email("user@tempmail.com"))
        self.assertTrue(is_disposable_email("user@mailinator.com"))
        self.assertTrue(is_disposable_email("user@yopmail.net"))
        self.assertFalse(is_disposable_email("realuser@gmail.com"))
        self.assertFalse(is_disposable_email("fan@msambar.com"))

    def test_client_ip_extraction(self):
        """Verify IP extraction handles Nginx X-Forwarded-For headers."""
        class MockRequest:
            META = {'HTTP_X_FORWARDED_FOR': '203.0.113.195, 70.41.3.18, 150.172.238.178'}
        self.assertEqual(get_client_ip(MockRequest()), '203.0.113.195')

    def test_user_registration_disposable_email_rejected(self):
        """Verify registration endpoint rejects disposable emails with HTTP 400."""
        url = reverse('register')
        data = {
            'email': 'bot@tempmail.com',
            'username': 'botuser',
            'password': 'Password123!',
            'password_confirm': 'Password123!'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
        self.assertIn('no está permitido', response.data['email'][0])

    def test_newsletter_subscription_disposable_email_rejected(self):
        """Verify subscriber creation endpoint rejects disposable emails with HTTP 400."""
        url = reverse('subscriber-list')
        data = {
            'email': 'spammer@mailinator.com',
            'name': 'Spam Bot'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    @override_settings(CLOUDFLARE_TURNSTILE_SECRET_KEY='dummy_secret_key')
    @patch('config.anti_spam.requests.post')
    def test_turnstile_failure_returns_400(self, mock_post):
        """Verify Turnstile verification failure returns HTTP 400 Bad Request."""
        mock_post.return_value.json.return_value = {'success': False, 'error-codes': ['invalid-input-response']}
        
        url = reverse('register')
        data = {
            'email': 'realuser@gmail.com',
            'username': 'realuser1',
            'password': 'Password123!',
            'password_confirm': 'Password123!',
            'turnstile_token': 'invalid_token'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Turnstile', response.data['email'][0])

    @override_settings(CLOUDFLARE_TURNSTILE_SECRET_KEY='dummy_secret_key')
    @patch('config.anti_spam.requests.post')
    def test_turnstile_timeout_fail_open_resilience(self, mock_post):
        """Verify circuit breaker fail-open resilience when Cloudflare times out."""
        import requests
        mock_post.side_effect = requests.Timeout("Cloudflare connection timeout")
        
        is_valid, err = validate_turnstile_token('some_token', '127.0.0.1')
        self.assertTrue(is_valid)
        self.assertIsNone(err)
