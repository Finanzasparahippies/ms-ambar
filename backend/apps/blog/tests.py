from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from apps.blog.models import Category, Post, NewsletterSubscriber
from unittest.mock import patch

User = get_user_model()

class BlogAppTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            email='admin@example.com',
            username='admin',
            password='adminpassword'
        )
        self.regular_user = User.objects.create_user(
            email='regular@example.com',
            username='regular',
            password='regularpassword'
        )

        self.category = Category.objects.create(name='Acústica')
        self.published_post = Post.objects.create(
            title='Resonancia en Teatros',
            content='Contenido sobre acústica en teatros modulares...',
            category=self.category,
            is_published=True
        )
        self.draft_post = Post.objects.create(
            title='Borrador Secreto',
            content='Contenido confidencial...',
            category=self.category,
            is_published=False
        )

    def test_category_list_public(self):
        """Verify anyone can fetch blog categories."""
        url = reverse('category-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_category_create_permission_denied_for_regular_user(self):
        """Verify non-admin users cannot create categories."""
        url = reverse('category-list')
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.post(url, {'name': 'Visuales'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_category_create_success_for_admin(self):
        """Verify admins can create categories."""
        url = reverse('category-list')
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(url, {'name': 'Visuales'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Category.objects.count(), 2)

    def test_post_list_filters_unpublished_for_anonymous(self):
        """Verify that anonymous users only see published posts."""
        url = reverse('post-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see the published post
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'Resonancia en Teatros')

    def test_post_list_shows_all_for_admin(self):
        """Verify that admin/staff see all posts including drafts."""
        url = reverse('post-list')
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    @patch('apps.blog.views.send_newsletter_email')
    def test_create_published_post_triggers_newsletter(self, mock_send_newsletter):
        """Verify that creating a published post triggers the newsletter dispatch."""
        url = reverse('post-list')
        self.client.force_authenticate(user=self.admin_user)
        data = {
            'title': 'Gira 2026 Confirmada',
            'content': 'Detalles de la gira oficial de MS AMBAR...',
            'category': self.category.id,
            'is_published': True
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        post = Post.objects.get(title='Gira 2026 Confirmada')
        self.assertTrue(post.is_notified)
        mock_send_newsletter.assert_called_once_with(post)

    @patch('apps.blog.views.send_welcome_email')
    def test_newsletter_subscription_flow(self, mock_welcome):
        """Verify public newsletter registration triggers a welcome email."""
        url = reverse('subscriber-list')
        data = {'email': 'fan@example.com'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        sub = NewsletterSubscriber.objects.get(email='fan@example.com')
        self.assertTrue(sub.is_active)
        mock_welcome.assert_called_once_with(sub)

    def test_newsletter_unsubscribe(self):
        """Verify users can unsubscribe from newsletters."""
        sub = NewsletterSubscriber.objects.create(email='unsub@example.com', is_active=True)
        url = reverse('subscriber-unsubscribe')
        response = self.client.post(url, {'email': 'unsub@example.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        sub.refresh_from_db()
        self.assertFalse(sub.is_active)

    @patch('apps.blog.utils.get_connection')
    def test_email_failover_flow(self, mock_get_connection):
        """Verify the email failover sequence: Brevo -> SES -> Default."""
        from django.test import override_settings
        from apps.blog.utils import send_failover_email

        # Mock SMTP connection backend instances
        mock_brevo_conn = mock_get_connection.return_value
        mock_ses_conn = mock_get_connection.return_value

        # Mock connection behavior: Brevo fails, SES succeeds
        class FakeConnection:
            def __init__(self, should_fail=False):
                self.should_fail = should_fail
            def send_messages(self, messages):
                if self.should_fail:
                    raise Exception("SMTP Connection Timeout")
                return len(messages)

        # Set up a side_effect where the first connection (Brevo) fails, and the second (SES) succeeds
        mock_get_connection.side_effect = [
            FakeConnection(should_fail=True),
            FakeConnection(should_fail=False)
        ]

        with override_settings(
            BREVO_EMAIL_HOST_USER='brevo_user',
            BREVO_EMAIL_HOST_PASSWORD='brevo_password',
            SES_EMAIL_HOST_USER='ses_user',
            SES_EMAIL_HOST_PASSWORD='ses_password'
        ):
            # Attempt to send email
            result = send_failover_email(
                subject="Test Failover",
                html_content="<p>Test</p>",
                text_content="Test",
                recipient_list=["recipient@example.com"]
            )
            # Result should be 'Amazon SES' because Brevo failed and SES succeeded
            self.assertEqual(result, "Amazon SES")
            # Verify get_connection was called twice
            self.assertEqual(mock_get_connection.call_count, 2)

    @patch('apps.blog.utils.EmailMultiAlternatives.send')
    @patch('apps.blog.utils.get_connection')
    def test_email_failover_all_failed(self, mock_get_connection, mock_send):
        """Verify that if all providers fail, an exception is raised."""
        from django.test import override_settings
        from apps.blog.utils import send_failover_email

        # Mock connections to succeed during instantiation
        mock_get_connection.return_value = "dummy_conn"
        
        # Mock send to always raise SMTP exception
        mock_send.side_effect = Exception("SMTP Auth Refused")

        with override_settings(
            BREVO_EMAIL_HOST_USER='brevo_user',
            BREVO_EMAIL_HOST_PASSWORD='brevo_password',
            SES_EMAIL_HOST_USER='ses_user',
            SES_EMAIL_HOST_PASSWORD='ses_password'
        ):
            with self.assertRaises(Exception) as context:
                send_failover_email(
                    subject="Test Failover Fail",
                    html_content="<p>Test</p>",
                    text_content="Test",
                    recipient_list=["recipient@example.com"]
                )
            self.assertIn("SMTP Auth Refused", str(context.exception))

    @patch('apps.blog.views.requests.get')
    def test_ses_webhook_subscription_confirmation(self, mock_get):
        """Verify that receiving a SubscriptionConfirmation requests the subscription URL."""
        url = reverse('ses-verification-webhook')
        payload = {
            "Type": "SubscriptionConfirmation",
            "SubscribeURL": "https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription"
        }
        response = self.client.post(
            url,
            payload,
            format='json',
            HTTP_X_AMZ_SNS_MESSAGE_TYPE='SubscriptionConfirmation'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, "Subscribed")
        mock_get.assert_called_once_with("https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription")

    def test_ses_webhook_bounce_and_complaint(self):
        """Verify that receiving Bounce/Complaint notifications deactivates subscribers."""
        import json
        # Create subscribers to bounce/complain
        sub_bounce = NewsletterSubscriber.objects.create(email="bounced@example.com", is_active=True)
        sub_complaint = NewsletterSubscriber.objects.create(email="complained@example.com", is_active=True)
        
        url = reverse('ses-verification-webhook')
        
        # 1. Simulate Bounce notification
        bounce_payload = {
            "Type": "Notification",
            "Message": json.dumps({
                "notificationType": "Bounce",
                "bounce": {
                    "bounceType": "Permanent",
                    "bouncedRecipients": [{"emailAddress": "bounced@example.com"}]
                }
            })
        }
        response = self.client.post(
            url,
            bounce_payload,
            format='json',
            HTTP_X_AMZ_SNS_MESSAGE_TYPE='Notification'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        sub_bounce.refresh_from_db()
        self.assertFalse(sub_bounce.is_active)

        # 2. Simulate Complaint notification
        complaint_payload = {
            "Type": "Notification",
            "Message": json.dumps({
                "notificationType": "Complaint",
                "complaint": {
                    "complainedRecipients": [{"emailAddress": "complained@example.com"}]
                }
            })
        }
        response = self.client.post(
            url,
            complaint_payload,
            format='json',
            HTTP_X_AMZ_SNS_MESSAGE_TYPE='Notification'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        sub_complaint.refresh_from_db()
        self.assertFalse(sub_complaint.is_active)

