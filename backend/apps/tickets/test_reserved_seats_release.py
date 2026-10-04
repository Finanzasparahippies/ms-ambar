import uuid
from datetime import timedelta
from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from django.utils import timezone
from django.core.cache import cache
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.tickets.models import Event, Theater, Seat, Ticket
from apps.tickets.services.reservation_engine import get_reserved_sessions, release_reservations

User = get_user_model()


class ReservedSeatsReleaseEngineTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

        self.admin_user = User.objects.create_superuser(
            username='admin_test',
            email='admin@nectarlabs.test',
            password='adminpassword123'
        )
        self.client.force_authenticate(user=self.admin_user)

        self.theater = Theater.objects.create(
            name="London Pub Test Recinto",
            location="Hermosillo, Sonora",
            layout={"seats": [], "map_elements": []}
        )
        self.event = Event.objects.create(
            title="Concierto Prueba Real",
            artist="Artista Test",
            date=timezone.now() + timedelta(days=5),
            event_type="concert",
            theater=self.theater,
            is_active=True,
            mg_price=1500.00,
            mg_limit=20,
            price_multiplier=1.0,
            allow_numbered_tickets=True
        )

        self.seat_1 = Seat.objects.create(
            theater=self.theater,
            section="Preferente",
            row="A",
            number=1,
            base_price=1000.00,
            status="available"
        )
        self.seat_2 = Seat.objects.create(
            theater=self.theater,
            section="Preferente",
            row="A",
            number=2,
            base_price=1000.00,
            status="available"
        )

    def test_get_reserved_sessions(self):
        """Valida que get_reserved_sessions liste los boletos con status='reserved' y calcule elapsed_minutes."""
        t1 = Ticket.objects.create(
            event=self.event,
            seat=self.seat_1,
            user_email="buyer1@test.com",
            status="reserved",
            stripe_session_id="cs_test_mock_123"
        )
        # Forzar created_at hace 20 minutos
        old_time = timezone.now() - timedelta(minutes=20)
        Ticket.objects.filter(id=t1.id).update(created_at=old_time)

        sessions = get_reserved_sessions(event_id=self.event.id)
        self.assertEqual(len(sessions), 1)
        self.assertEqual(sessions[0]['id'], t1.id)
        self.assertEqual(sessions[0]['user_email'], "buyer1@test.com")
        self.assertTrue(sessions[0]['is_expired'])
        self.assertGreaterEqual(sessions[0]['elapsed_minutes'], 20.0)

    @patch('stripe.checkout.Session.retrieve')
    @patch('stripe.checkout.Session.expire')
    def test_release_single_ticket_and_cache_purge(self, mock_expire, mock_retrieve):
        """Valida liberación atómica por ticket_id, reseteo de puntero seat y purga de caché."""
        mock_retrieve.return_value = MagicMock(status='open', payment_status='unpaid')
        cache.set(f'event_seats_{self.event.id}', 'cached_data', timeout=300)

        t1 = Ticket.objects.create(
            event=self.event,
            seat=self.seat_1,
            user_email="abandoned@test.com",
            status="reserved",
            stripe_session_id="cs_test_abandoned_001"
        )

        res = release_reservations(ticket_ids=[t1.id], admin_user=self.admin_user)
        self.assertEqual(res['status'], 'success')
        self.assertEqual(res['released_count'], 1)

        t1.refresh_from_db()
        self.assertEqual(t1.status, 'cancelled')
        self.assertIsNone(t1.seat)  # Puntero liberado para prevenir IntegrityError en unique_together

        # Verificar purga de caché
        self.assertIsNone(cache.get(f'event_seats_{self.event.id}'))

    @patch('stripe.checkout.Session.retrieve')
    def test_safety_check_paid_ticket_not_cancelled(self, mock_retrieve):
        """Si la sesión de Stripe ya fue pagada en el momento de liberación, el boleto se marca paid en vez de cancelled."""
        mock_retrieve.return_value = MagicMock(status='complete', payment_status='paid')

        t1 = Ticket.objects.create(
            event=self.event,
            seat=self.seat_1,
            user_email="paid_concurrently@test.com",
            status="reserved",
            stripe_session_id="cs_test_paid_concurrently"
        )

        res = release_reservations(stripe_session_id="cs_test_paid_concurrently", admin_user=self.admin_user)
        self.assertEqual(res['released_count'], 0)

        t1.refresh_from_db()
        self.assertEqual(t1.status, 'paid')
        self.assertIsNotNone(t1.seat)

    def test_drf_admin_endpoints(self):
        """Valida los endpoints DRF /api/tickets/admin/reserved-sessions/ y /api/tickets/admin/release-seats/."""
        t1 = Ticket.objects.create(
            event=self.event,
            seat=self.seat_2,
            user_email="api_test@test.com",
            status="reserved",
            stripe_session_id="cs_test_api_999"
        )

        # 1. GET lista de reservaciones
        get_res = self.client.get('/api/tickets/admin/reserved-sessions/')
        self.assertEqual(get_res.status_code, 200)
        self.assertIn('sessions', get_res.data)
        found = any(s['id'] == t1.id for s in get_res.data['sessions'])
        self.assertTrue(found)

        # 2. POST liberación atómica
        post_res = self.client.post('/api/tickets/admin/release-seats/', {
            'ticket_ids': [t1.id]
        }, format='json')
        self.assertEqual(post_res.status_code, 200)
        self.assertEqual(post_res.data['released_count'], 1)

        t1.refresh_from_db()
        self.assertEqual(t1.status, 'cancelled')
        self.assertIsNone(t1.seat)

    @override_settings(TESTING=False, STRIPE_SECRET_KEY='sk_test_validkey123', STRIPE_WEBHOOK_SECRET='whsec_validkey123')
    @patch('apps.shop.utils.create_ticket_checkout_session')
    def test_checkout_repurchase_cancelled_seat(self, mock_stripe_session):
        """
        Valida que una butaca previamente vinculada a un boleto cancelado
        pueda ser comprada de nuevo mediante checkout() sin lanzar IntegrityError ni HTTP 500.
        """
        mock_session = MagicMock()
        mock_session.id = "cs_test_repurchase_123"
        mock_session.url = "https://checkout.stripe.com/pay/cs_test_repurchase_123"
        mock_session.client_secret = "cs_test_repurchase_123_secret"
        mock_stripe_session.return_value = mock_session

        # 1. Simular un boleto previamente cancelado en la base de datos para seat_1
        cancelled_ticket = Ticket.objects.create(
            event=self.event,
            seat=self.seat_1,
            user_email="previous_buyer@test.com",
            status="cancelled",
            stripe_session_id="cs_old_cancelled_session"
        )
        self.assertEqual(cancelled_ticket.status, 'cancelled')

        # 2. Un nuevo comprador intenta comprar seat_1 a través del endpoint de checkout
        buyer_client = APIClient()
        checkout_payload = {
            'email': 'new_buyer@test.com',
            'event_id': self.event.id,
            'seat_ids': [self.seat_1.id],
            'quantity': 1,
            'phone': '5551234567'
        }
        res = buyer_client.post('/api/tickets/tickets/checkout/', checkout_payload, format='json')

        # 3. La compra debe ser exitosa (HTTP 200) sin lanzar IntegrityError
        self.assertEqual(res.status_code, 200, f"Checkout falló con código {res.status_code}: {res.data}")
        self.assertEqual(res.data['status'], 'success')
        self.assertEqual(res.data['session_id'], "cs_test_repurchase_123")

        # 4. Verificar en base de datos que el nuevo boleto fue creado y el cancelado se desvinculó
        cancelled_ticket.refresh_from_db()
        self.assertIsNone(cancelled_ticket.seat, "El boleto cancelado debe haber desvinculado el asiento.")

        new_ticket = Ticket.objects.get(event=self.event, seat=self.seat_1, status='reserved')
        self.assertEqual(new_ticket.user_email, 'new_buyer@test.com')
        self.assertEqual(new_ticket.stripe_session_id, "cs_test_repurchase_123")

