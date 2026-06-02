from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from apps.bookings.models import BookingInquiry, BookingContract
from unittest.mock import patch

User = get_user_model()

class BookingsAppTests(APITestCase):
    def setUp(self):
        # Create an admin user for manager signing/viewing inquiries
        self.admin_user = User.objects.create_superuser(
            email='admin@example.com',
            username='admin',
            password='adminpassword'
        )

        # Sample booking inquiry payload
        self.inquiry_data = {
            'name': 'Juan Pérez',
            'email': 'juan@example.com',
            'phone': '1234567890',
            'company': 'Festival del Sol',
            'date': '2026-10-15',
            'venue_type': 'festival',
            'message': 'Queremos contratar a MS AMBAR para el festival principal.'
        }

    @patch('apps.bookings.views.generate_booking_contract_pdf')
    @patch('apps.bookings.views.send_booking_contract_emails')
    def test_create_booking_inquiry_and_auto_contract(self, mock_emails, mock_pdf):
        """Verify that any user can submit an inquiry, which auto-generates a contract."""
        mock_pdf.return_value = True
        mock_emails.return_value = None

        url = reverse('inquiry-list')
        response = self.client.post(url, self.inquiry_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify inquiry registered
        inquiry = BookingInquiry.objects.get(email='juan@example.com')
        self.assertEqual(inquiry.company, 'Festival del Sol')
        
        # Verify contract auto-generated
        contract = BookingContract.objects.get(inquiry=inquiry)
        self.assertEqual(contract.fee, 25000.00)
        self.assertFalse(contract.is_fully_signed)

        # Verify mock calls
        mock_pdf.assert_called_once_with(contract)
        mock_emails.assert_called_once_with(contract)

    def test_list_inquiries_permission_denied(self):
        """Verify that anonymous and regular users cannot retrieve inquiries list."""
        url = reverse('inquiry-list')
        # Anonymous request -> 401
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Regular authenticated user -> 403
        regular_user = User.objects.create_user(
            email='regular@example.com',
            username='regular',
            password='password123'
        )
        self.client.force_authenticate(user=regular_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_inquiries_success_for_admin(self):
        """Verify that admin users can retrieve inquiries list."""
        # Create inquiry directly
        inquiry = BookingInquiry.objects.create(
            name='Test',
            email='test@test.com',
            phone='1234',
            venue_type='other',
            message='test message'
        )
        url = reverse('inquiry-list')
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    @patch('apps.bookings.views.generate_booking_contract_pdf')
    @patch('apps.bookings.views.send_booking_contract_emails')
    def test_full_contract_signing_flow(self, mock_emails, mock_pdf):
        """Verify the client signing and manager signing flows."""
        mock_pdf.return_value = True
        mock_emails.return_value = None

        # Create inquiry and contract
        inquiry = BookingInquiry.objects.create(
            name='Paco',
            email='paco@example.com',
            phone='5551234',
            venue_type='private',
            message='Boda privada'
        )
        contract = BookingContract.objects.create(
            inquiry=inquiry,
            fee=30000.00
        )

        # 1. Client attempts to sign the contract (without authenticating)
        sign_url = reverse('contract-sign', kwargs={'pk': contract.pk})
        client_sig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAA"
        response = self.client.post(sign_url, {'signature': client_sig}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        contract.refresh_from_db()
        self.assertEqual(contract.signature_base64, client_sig)
        self.assertIsNotNone(contract.signed_at)
        self.assertFalse(contract.is_fully_signed)

        # 2. Manager attempts to sign (without auth - should fail with 401)
        manager_sign_url = reverse('contract-manager-sign', kwargs={'pk': contract.pk})
        manager_sig = "data:image/png;base64,manager_signature_data_here"
        response_unauth = self.client.post(manager_sign_url, {'signature': manager_sig}, format='json')
        self.assertEqual(response_unauth.status_code, status.HTTP_401_UNAUTHORIZED)

        # Manager attempts to sign with regular user auth - should fail with 403
        regular_user = User.objects.create_user(
            email='regular2@example.com',
            username='regular2',
            password='password123'
        )
        self.client.force_authenticate(user=regular_user)
        response_regular = self.client.post(manager_sign_url, {'signature': manager_sig}, format='json')
        self.assertEqual(response_regular.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Manager signs with admin auth
        self.client.force_authenticate(user=self.admin_user)
        response_auth = self.client.post(manager_sign_url, {'signature': manager_sig}, format='json')
        self.assertEqual(response_auth.status_code, status.HTTP_200_OK)
        
        contract.refresh_from_db()
        self.assertEqual(contract.manager_signature, manager_sig)
        self.assertIsNotNone(contract.manager_signed_at)
        self.assertTrue(contract.is_fully_signed)

    def test_manager_cannot_sign_before_client(self):
        """Verify that manager signature fails if client hasn't signed first."""
        inquiry = BookingInquiry.objects.create(
            name='Ana',
            email='ana@example.com',
            phone='999999',
            venue_type='club',
            message='Concierto club'
        )
        contract = BookingContract.objects.create(
            inquiry=inquiry,
            fee=25000.00
        )

        manager_sign_url = reverse('contract-manager-sign', kwargs={'pk': contract.pk})
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(manager_sign_url, {'signature': 'sig'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('El organizador debe firmar antes', response.data['error'])
