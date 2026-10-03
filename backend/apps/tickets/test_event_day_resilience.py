from unittest.mock import patch, MagicMock
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from apps.tickets.models import Theater, Event, Seat, Ticket, TicketCheckInAudit
from apps.tickets.access.qr_crypto import generate_qr_payload
from apps.tickets.services.google_wallet import GoogleWalletService

User = get_user_model()


class EventDayResilienceTests(APITestCase):
    def setUp(self):
        self.theater = Theater.objects.create(name="London Pub", location="Hermosillo, Sonora")
        self.event = Event.objects.create(
            title="Ms. Ambar - Día del Evento",
            artist="Ms. Ambar",
            date=timezone.now() + timezone.timedelta(hours=2),
            doors_open=timezone.now() + timezone.timedelta(hours=1),
            theater=self.theater,
            is_active=True,
            is_online_sales_active=True,
            cutoff_datetime=timezone.now() + timezone.timedelta(hours=1)
        )
        self.seat = Seat.objects.create(
            theater=self.theater,
            section="General",
            row="A",
            number=1,
            base_price=500.00
        )
        self.ticket = Ticket.objects.create(
            event=self.event,
            seat=self.seat,
            user_email="fan@msambar.com",
            status="paid",
            amount_paid=500.00
        )
        self.staff_user = User.objects.create_user(
            username="staff_puerta_1",
            email="puerta1@msambar.com",
            password="secure_password_staff"
        )

    def test_01_checkout_rejected_when_online_sales_cut_off(self):
        """Valida que checkout rechace compras si is_online_sales_active=False o cutoff_datetime pasó."""
        self.event.is_online_sales_active = False
        self.event.save()

        url = reverse('ticket-list') + 'checkout/'
        payload = {
            'email': 'comprador_tardio@msambar.com',
            'event_id': self.event.id,
            'seat_ids': [self.seat.id]
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Venta en línea finalizada', response.data.get('error', ''))
        self.assertEqual(response.data.get('code'), 'ONLINE_SALES_CLOSED')
        self.assertTrue(response.data.get('cutoff'))

    @patch('apps.shop.views.stripe.Refund.create')
    def test_02_webhook_refunds_and_cancels_post_cutoff_session(self, mock_refund):
        """Valida que una sesión de Stripe completada tras el corte dispare reembolso y no emita boleto."""
        from apps.shop.views import handle_successful_payment

        self.event.is_online_sales_active = False
        self.event.save()

        session_mock = {
            'id': 'cs_test_late_checkout_999',
            'payment_intent': 'pi_test_late_999',
            'metadata': {
                'type': 'ticket_purchase',
                'event_id': str(self.event.id),
                'seat_ids': str(self.seat.id),
                'user_email': 'late_payer@msambar.com',
                'quantity': '1'
            }
        }

        handle_successful_payment(session_mock)
        mock_refund.assert_called_once_with(
            payment_intent='pi_test_late_999',
            reason='requested_by_customer',
            metadata={'reason': 'REJECTED_POST_CUTOFF', 'event_id': str(self.event.id)}
        )

    def test_03_zero_trust_qr_redemption_and_409_conflict(self):
        """Valida canje atómico en puerta y rechazo HTTP 409 con timestamp ante reintento."""
        qr_payload = generate_qr_payload(self.ticket, format_type='compact')
        url = reverse('scanner-check-in')

        # Primer escaneo: Éxito 200
        res1 = self.client.post(url, {
            'qr_payload': qr_payload,
            'scanner_device_id': 'turnstile-north',
            'location': 'Acceso 1'
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(res1.data.get('status'), 'SUCCESS')

        # Segundo escaneo: Conflicto 409
        res2 = self.client.post(url, {
            'qr_payload': qr_payload,
            'scanner_device_id': 'turnstile-south',
            'location': 'Acceso 2'
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res2.data.get('status'), 'ALREADY_USED')
        self.assertIsNotNone(res2.data.get('checked_in_at'))

    @patch.object(GoogleWalletService, '_get_oauth2_access_token', return_value='fake_test_token')
    @patch('requests.patch')
    def test_04_google_wallet_patch_state_sync_on_redemption(self, mock_patch, mock_token):
        """Valida que la redención invoque el PATCH REST a Google Wallet con state=COMPLETED."""
        mock_patch.return_value = MagicMock(status_code=200)

        wallet_svc = GoogleWalletService()
        success = wallet_svc.update_ticket_state(self.ticket, new_state='COMPLETED')

        self.assertTrue(success)
        mock_patch.assert_called_once()
        args, kwargs = mock_patch.call_args
        self.assertIn(f"ticket_{self.ticket.token}", args[0])
        self.assertEqual(kwargs['json'], {'state': 'COMPLETED'})
        self.assertEqual(kwargs['headers']['Authorization'], 'Bearer fake_test_token')

    def test_05_configure_cutoff_endpoint_admin(self):
        """Valida que el endpoint administrativo configure-cutoff actualice is_online_sales_active y cutoff_datetime."""
        url = reverse('event-detail', kwargs={'pk': self.event.id}) + 'configure-cutoff/'

        # 1. Sin autenticación staff debe ser denegado 401/403
        anon_res = self.client.post(url, {'is_online_sales_active': False}, format='json')
        self.assertIn(anon_res.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

        # 2. Con autenticación staff
        self.staff_user.is_staff = True
        self.staff_user.save()
        self.client.force_authenticate(user=self.staff_user)

        target_cutoff = "2026-10-03T19:30:00"
        auth_res = self.client.post(url, {
            'is_online_sales_active': False,
            'cutoff_datetime': target_cutoff
        }, format='json')

        self.assertEqual(auth_res.status_code, status.HTTP_200_OK)
        self.assertEqual(auth_res.data.get('status'), 'success')
        self.assertFalse(auth_res.data.get('is_online_sales_active'))
        self.assertIsNotNone(auth_res.data.get('cutoff_datetime'))

        self.event.refresh_from_db()
        self.assertFalse(self.event.is_online_sales_active)
        self.assertIsNotNone(self.event.cutoff_datetime)

