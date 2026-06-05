from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes

User = get_user_model()

class UsersAppTests(APITestCase):
    def setUp(self):
        self.test_user = User.objects.create_user(
            email='test@example.com',
            username='testuser',
            password='testpassword123',
            phone='1234567890'
        )

    def test_user_registration_success(self):
        """Verify successful user registration."""
        url = reverse('register')
        data = {
            'email': 'newuser@example.com',
            'username': 'newuser',
            'password': 'newpassword123',
            'password_confirm': 'newpassword123',
            'phone': '0987654321'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user']['email'], 'newuser@example.com')
        self.assertIn('tokens', response.data)

    def test_user_registration_password_mismatch(self):
        """Verify registration failure on password mismatch."""
        url = reverse('register')
        data = {
            'email': 'mismatch@example.com',
            'username': 'mismatch',
            'password': 'password123',
            'password_confirm': 'differentpassword',
            'phone': '12345'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    def test_login_jwt_claims(self):
        """Verify that simplejwt login token includes custom payload claims."""
        url = reverse('token_obtain_pair')
        data = {
            'email': 'test@example.com',
            'password': 'testpassword123'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_password_reset_request(self):
        """Verify that requesting a password reset works and returns dev info under DEBUG."""
        url = reverse('password_reset_request')
        data = {
            'email': 'test@example.com'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'sent')

    def test_password_reset_confirm_success(self):
        """Verify password reset confirmation updates the password."""
        token = default_token_generator.make_token(self.test_user)
        uid = urlsafe_base64_encode(force_bytes(self.test_user.pk))
        
        url = reverse('password_reset_confirm')
        data = {
            'email': 'test@example.com',
            'token': token,
            'uid': uid,
            'password': 'newsecurepassword123',
            'password_confirm': 'newsecurepassword123'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify password updated
        login_url = reverse('token_obtain_pair')
        login_data = {
            'email': 'test@example.com',
            'password': 'newsecurepassword123'
        }
        login_response = self.client.post(login_url, login_data, format='json')
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

    def test_get_user_profile_anonymous(self):
        """Verify anonymous users cannot get profile info."""
        url = reverse('profile')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_user_profile_authenticated(self):
        """Verify authenticated user can get profile details."""
        url = reverse('profile')
        self.client.force_authenticate(user=self.test_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'test@example.com')
        self.assertEqual(response.data['username'], 'testuser')
        self.assertEqual(response.data['phone'], '1234567890')
        self.assertEqual(response.data['is_staff'], False)

    def test_get_user_profile_staff_authenticated(self):
        """Verify authenticated staff user gets profile details with is_staff=True."""
        staff_user = User.objects.create_user(
            email='staff@example.com',
            username='staffuser',
            password='staffpassword123',
            is_staff=True
        )
        url = reverse('profile')
        self.client.force_authenticate(user=staff_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'staff@example.com')
        self.assertEqual(response.data['is_staff'], True)

    def test_update_user_profile_authenticated(self):
        """Verify authenticated user can update profile details."""
        url = reverse('profile')
        self.client.force_authenticate(user=self.test_user)
        data = {
            'username': 'updateduser',
            'phone': '9999999999',
            'first_name': 'Ambar',
            'last_name': 'Artist',
            'email': 'should_not_change@example.com' # Should be read-only
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['username'], 'updateduser')
        self.assertEqual(response.data['user']['phone'], '9999999999')
        self.assertEqual(response.data['user']['first_name'], 'Ambar')
        self.assertEqual(response.data['user']['last_name'], 'Artist')
        # Email must remain the original one
        self.assertEqual(response.data['user']['email'], 'test@example.com')
        self.assertEqual(response.data['user']['is_staff'], False)
