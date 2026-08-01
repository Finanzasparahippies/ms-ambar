from django.urls import reverse
from django.test import override_settings
from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from apps.tickets.models import Theater, Event, Seat, Ticket, GADeclaration
from unittest.mock import patch

class TicketsAppTests(APITestCase):
    def setUp(self):
        # Create a Theater
        self.theater = Theater.objects.create(
            name="Teatro Degollado",
            location="Guadalajara, Jalisco",
            layout={
                "sections": [
                    {
                        "name": "Platea",
                        "layout_type": "grid",
                        "x": 100,
                        "y": 100,
                        "rows": [
                            {"label": "A", "count": 5, "category": "vip", "base_price": 1500},
                            {"label": "B", "count": 5, "category": "standard", "base_price": 1000}
                        ]
                    }
                ]
            }
        )
        
        # Generate seats for the theater
        self.theater.generate_seats()
        
        # Create an Event
        self.event = Event.objects.create(
            title="Sinfonía Ámbar 2026",
            artist="MS AMBAR Ensemble",
            date=timezone.now() + timezone.timedelta(days=10),
            theater=self.theater,
            mg_price=500.00,
            mg_limit=10,
            price_multiplier=1.20
        )
        
        self.seat_vip = Seat.objects.filter(theater=self.theater, category='vip').first()
        self.seat_std = Seat.objects.filter(theater=self.theater, category='standard').first()

        # Create test users
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.user = User.objects.create_user(
            username="buyer",
            email="buyer@example.com",
            password="password123"
        )
        self.admin_user = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="password123"
        )

    def test_seat_generation(self):
        """Verify seats are correctly generated from theater layout structure."""
        seats = Seat.objects.filter(theater=self.theater)
        self.assertEqual(seats.count(), 10) # 2 rows of 5 seats
        vip_seats = seats.filter(category='vip')
        self.assertEqual(vip_seats.count(), 5)
        self.assertEqual(vip_seats.first().base_price, 1500)

    def test_get_layout_bounds(self):
        """Verify calculation of layout bounds metadata for theater."""
        bounds = self.theater.get_layout_bounds()
        self.assertIn("width", bounds)
        self.assertIn("height", bounds)
        self.assertIn("center_x", bounds)
        self.assertIn("center_y", bounds)

    def test_event_seats_bounds(self):
        """Verify event seats endpoint returns bounds metadata."""
        url = reverse('event-seats', kwargs={'pk': self.event.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('bounds', response.data)
        self.assertIn('width', response.data['bounds'])

    def test_event_list(self):
        """Verify retrieval of active events."""
        url = reverse('event-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], "Sinfonía Ámbar 2026")

    def test_event_list_staff_sees_all(self):
        """Verify staff/admin can list all events including inactive ones."""
        # Create an inactive event
        inactive_event = Event.objects.create(
            title="Concierto Cancelado",
            artist="MS AMBAR Ensemble",
            date=timezone.now() + timezone.timedelta(days=15),
            theater=self.theater,
            is_active=False
        )
        url = reverse('event-list')
        
        # Non-staff user / Anonymous
        response_anon = self.client.get(url)
        self.assertEqual(response_anon.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_anon.data), 1)
        
        # Staff/Admin user
        self.client.force_authenticate(user=self.admin_user)
        response_admin = self.client.get(url)
        self.assertEqual(response_admin.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_admin.data), 2)
        titles = [e['title'] for e in response_admin.data]
        self.assertIn("Concierto Cancelado", titles)
        self.assertIn("Sinfonía Ámbar 2026", titles)

    def test_dynamic_pricing_calculation(self):
        """Verify dynamic price adjusts by month and increment."""
        from datetime import datetime, timezone as tz
        # Create event in October 2026 with base numbered = 500, general = 400, increment = 50
        oct_date = datetime(2026, 10, 15, 20, 0, tzinfo=tz.utc)
        evt = Event.objects.create(
            title="Evento Octubre 2026",
            artist="Ms Ambar",
            date=oct_date,
            enable_dynamic_pricing=True,
            monthly_price_increment=50.00,
            seatless_ticket_price=400.00
        )
        
        may_date = datetime(2026, 5, 10, 12, 0, tzinfo=tz.utc)
        jul_date = datetime(2026, 7, 10, 12, 0, tzinfo=tz.utc)
        aug_date = datetime(2026, 8, 10, 12, 0, tzinfo=tz.utc)
        sep_date = datetime(2026, 9, 10, 12, 0, tzinfo=tz.utc)
        oct_purchase_date = datetime(2026, 10, 5, 12, 0, tzinfo=tz.utc)
        
        # May (5 months prior): Tarifa base sin aumentos (General $400, Numerado $500)
        self.assertEqual(evt.get_dynamic_price(400.00, purchase_date=may_date), 400.00)
        self.assertEqual(evt.get_dynamic_price(500.00, purchase_date=may_date), 500.00)

        # July (3 months prior): Tarifa base sin aumentos (0 incrementos)
        self.assertEqual(evt.get_dynamic_price(400.00, purchase_date=jul_date), 400.00)
        self.assertEqual(evt.get_dynamic_price(500.00, purchase_date=jul_date), 500.00)
        
        # August (2 months prior): Tarifa base sin aumentos (0 incrementos)
        self.assertEqual(evt.get_dynamic_price(400.00, purchase_date=aug_date), 400.00)
        self.assertEqual(evt.get_dynamic_price(500.00, purchase_date=aug_date), 500.00)
        
        # September (1 month prior - Transición Ago->Sep): 1er incremento (+$50) -> General $450, Numerado $550
        self.assertEqual(evt.get_dynamic_price(400.00, purchase_date=sep_date), 450.00)
        self.assertEqual(evt.get_dynamic_price(500.00, purchase_date=sep_date), 550.00)
        
        # October (Event month - Transición Sep->Oct): 2do incremento (+$100) -> General $500, Numerado $600
        self.assertEqual(evt.get_dynamic_price(400.00, purchase_date=oct_purchase_date), 500.00)
        self.assertEqual(evt.get_dynamic_price(500.00, purchase_date=oct_purchase_date), 600.00)

    def test_42_tables_generate_168_seats(self):
        """Verify 42 tables of 4 seats produce exactly 168 seats."""
        from seed_db import build_42_tables_layout
        t_42 = Theater.objects.create(name="Teatro 42 Mesas", location="Guadalajara", layout=build_42_tables_layout())
        count = t_42.generate_seats()
        self.assertEqual(count, 168)
        self.assertEqual(Seat.objects.filter(theater=t_42).count(), 168)

    def test_prevent_duplicate_seat_purchase(self):
        """Verify that a seat with paid/reserved ticket cannot be re-purchased."""
        # Create paid ticket for VIP seat
        Ticket.objects.create(
            event=self.event,
            seat=self.seat_vip,
            user_email="taken@example.com",
            status="paid"
        )
        
        url = reverse('ticket-checkout')
        payload = {
            'email': 'attacker@example.com',
            'event_id': self.event.id,
            'seat_ids': [self.seat_vip.id]
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ya están reservados o pagados", res.data['error'])

    def test_checkout_past_event_fails(self):
        """Verify attempting to purchase tickets for a past event returns a 400 Bad Request."""
        past_event = Event.objects.create(
            title="Concierto Pasado Venta",
            artist="MS AMBAR",
            date=timezone.now() - timezone.timedelta(days=2),
            theater=self.theater,
            event_type='concert',
            is_active=True
        )
        url = reverse('ticket-list') + 'checkout/'
        data = {
            'email': 'buyer@example.com',
            'event_id': past_event.id,
            'seat_ids': [self.seat_std.id]
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertIn('finalizado', response.data['error'].lower())

    def test_event_creation_restricted(self):
        """Verify normal users cannot create events."""
        url = reverse('event-list')
        data = {
            'title': 'Intento Fallido',
            'artist': 'Hacker',
            'date': (timezone.now() + timezone.timedelta(days=5)).isoformat(),
            'event_type': 'concert'
        }
        self.client.force_authenticate(user=self.user)
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_event_creation_admin_success(self):
        """Verify admin users can create events successfully."""
        url = reverse('event-list')
        data = {
            'title': 'Nuevo Evento Admin',
            'artist': 'MS AMBAR',
            'venue_name': 'Teatro Degollado',
            'venue_address': 'Guadalajara, Jalisco',
            'theater': self.theater.id,  
            'duration_minutes': 120,
            'date': (timezone.now() + timezone.timedelta(days=5)).isoformat(),
            'event_type': 'concert',
            'price_multiplier': '1.50'
        }
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Event.objects.filter(title='Nuevo Evento Admin').count(), 1)

    def test_event_seats_availability(self):
        """Verify the event/seats endpoint lists seats and marks occupied seats correctly."""
        # Occupy one seat
        Ticket.objects.create(
            event=self.event,
            seat=self.seat_vip,
            user_email="buyer@example.com",
            status="paid"
        )
        
        url = reverse('event-seats', kwargs={'pk': self.event.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('seats', response.data)
        
        # Check occupied vs available status in response
        seats_data = response.data['seats']
        occupied_seats = [s for s in seats_data if s['status'] == 'occupied']
        available_seats = [s for s in seats_data if s['status'] == 'available']
        
        self.assertEqual(len(occupied_seats), 1)
        self.assertEqual(occupied_seats[0]['id'], self.seat_vip.id)
        self.assertEqual(len(available_seats), 9)

    def test_ticket_validation_and_scanning(self):
        """Verify validation and scanner check-in for QR codes."""
        # Create a paid ticket
        ticket = Ticket.objects.create(
            event=self.event,
            seat=self.seat_std,
            user_email="visitor@example.com",
            status="paid"
        )
        
        url = reverse('ticket-validate')
        
        # Validate ticket (success check-in)
        data = {'token': str(ticket.token)}
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['seat'], f"{self.seat_std.row}{self.seat_std.number}")
        
        # Validate ticket again (already used check-in)
        response_used = self.client.post(url, data, format='json')
        self.assertEqual(response_used.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response_used.data['status'], 'already_used')

    def test_ticket_validation_unpaid(self):
        """Verify validation fails for reserved but unpaid tickets."""
        ticket = Ticket.objects.create(
            event=self.event,
            seat=self.seat_std,
            user_email="visitor@example.com",
            status="reserved"
        )
        url = reverse('ticket-validate')
        data = {'token': str(ticket.token)}
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')

    @override_settings(TESTING=False, STRIPE_SECRET_KEY='sk_test_valid_key', STRIPE_WEBHOOK_SECRET='whsec_valid_key')
    @patch('stripe.checkout.Session.create')
    def test_checkout_concert_success(self, mock_stripe_create):
        """Test checking out seats for a concert event successfully creates a Stripe checkout session."""
        class MockSession:
            id = 'cs_test_123'
            url = 'https://checkout.stripe.com/pay/cs_test_123'
        mock_stripe_create.return_value = MockSession()

        url = reverse('ticket-list') + 'checkout/'
        data = {
            'email': 'concert_buyer@example.com',
            'event_id': self.event.id,
            'seat_ids': [self.seat_std.id],
            'phone': '+525511223344',
            'has_mg': False
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['session_id'], 'cs_test_123')
        self.assertEqual(response.data['session_url'], 'https://checkout.stripe.com/pay/cs_test_123')

        # Verify reserved tickets are pre-created
        tickets = Ticket.objects.filter(event=self.event, user_email='concert_buyer@example.com')
        self.assertEqual(tickets.count(), 1)
        ticket = tickets.first()
        self.assertEqual(ticket.status, 'reserved')
        self.assertEqual(ticket.seat, self.seat_std)
        self.assertEqual(ticket.stripe_session_id, 'cs_test_123')

    def test_checkout_concert_occupied_fail(self):
        """Test checking out an already occupied seat fails."""
        Ticket.objects.create(
            event=self.event,
            seat=self.seat_std,
            user_email="occupant@example.com",
            status="paid"
        )
        url = reverse('ticket-list') + 'checkout/'
        data = {
            'email': 'buyer@example.com',
            'event_id': self.event.id,
            'seat_ids': [self.seat_std.id]
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    @override_settings(TESTING=False, STRIPE_SECRET_KEY='sk_test_valid_key', STRIPE_WEBHOOK_SECRET='whsec_valid_key')
    @patch('stripe.checkout.Session.create')
    def test_checkout_meet_greet_success(self, mock_stripe_create):
        """Test checking out Meet & Greet tickets with quantity."""
        class MockSession:
            id = 'cs_test_456'
            url = 'https://checkout.stripe.com/pay/cs_test_456'
        mock_stripe_create.return_value = MockSession()

        mg_event = Event.objects.create(
            title="Convivencia Hermosillo",
            artist="MS AMBAR",
            date=timezone.now() + timezone.timedelta(days=5),
            theater=None,
            event_type='meet_greet',
            mg_price=800.00,
            mg_limit=10,
            is_active=True
        )
        url = reverse('ticket-list') + 'checkout/'
        data = {
            'email': 'mg_buyer@example.com',
            'event_id': mg_event.id,
            'quantity': 3,
            'phone': '+525511223344',
            'has_mg': True
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['session_id'], 'cs_test_456')
        self.assertEqual(response.data['session_url'], 'https://checkout.stripe.com/pay/cs_test_456')

    def test_by_session_success(self):
        """Test retrieving tickets by their Stripe session ID."""
        ticket = Ticket.objects.create(
            event=self.event,
            seat=self.seat_std,
            user_email="buyer@example.com",
            status="paid",
            stripe_session_id="cs_session_unique_789"
        )
        url = reverse('ticket-list') + 'by_session/'
        response = self.client.get(url, {'session_id': 'cs_session_unique_789'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['token'], str(ticket.token))
        self.assertEqual(response.data[0]['stripe_session_id'], 'cs_session_unique_789')

    def test_retrieve_ticket_by_uuid(self):
        """Test that we can retrieve a ticket by its UUID token using the retrieve detail endpoint."""
        ticket = Ticket.objects.create(
            event=self.event,
            seat=self.seat_std,
            user_email="buyer@example.com",
            status="paid"
        )
        url = reverse('ticket-detail', kwargs={'pk': str(ticket.token)})
        self.client.force_authenticate(user=self.user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['token'], str(ticket.token))
        self.assertEqual(response.data['user_email'], 'buyer@example.com')

    def test_retrieve_ticket_by_numeric_id(self):
        """Test that we can still retrieve a ticket by its numeric primary key."""
        ticket = Ticket.objects.create(
            event=self.event,
            seat=self.seat_std,
            user_email="buyer@example.com",
            status="paid"
        )
        url = reverse('ticket-detail', kwargs={'pk': ticket.id})
        self.client.force_authenticate(user=self.user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['token'], str(ticket.token))

    def test_meet_greet_seats_view(self):
        """Test that seats action on event endpoint for meet_greet events returns empty lists gracefully."""
        mg_event = Event.objects.create(
            title="Convivencia VIP",
            artist="MS AMBAR",
            date=timezone.now() + timezone.timedelta(days=5),
            theater=None,
            event_type='meet_greet',
            mg_price=800.00,
            mg_limit=10,
            is_active=True
        )
        url = reverse('event-seats', kwargs={'pk': mg_event.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['seats'], [])
        self.assertEqual(response.data['elements'], [])

    def test_anonymous_user_cannot_list_tickets(self):
        """Verify anonymous users cannot list tickets."""
        url = reverse('ticket-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_customer_can_only_see_own_tickets(self):
        """Verify customer can only see their own tickets in list."""
        Ticket.objects.create(event=self.event, seat=self.seat_vip, user_email="buyer@example.com", status="paid")
        # Ticket belonging to another user email
        Ticket.objects.create(event=self.event, seat=self.seat_std, user_email="other@example.com", status="paid")

        self.client.force_authenticate(user=self.user)
        url = reverse('ticket-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see 1 ticket (buyer@example.com)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['user_email'], 'buyer@example.com')

    def test_customer_cannot_retrieve_others_ticket(self):
        """Verify customer cannot retrieve another user's ticket."""
        ticket = Ticket.objects.create(event=self.event, seat=self.seat_vip, user_email="other@example.com", status="paid")

        self.client.force_authenticate(user=self.user)
        url = reverse('ticket-detail', kwargs={'pk': ticket.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_can_see_all_tickets(self):
        """Verify admin can list all tickets."""
        Ticket.objects.create(event=self.event, seat=self.seat_vip, user_email="buyer@example.com", status="paid")
        Ticket.objects.create(event=self.event, seat=self.seat_std, user_email="other@example.com", status="paid")

        self.client.force_authenticate(user=self.admin_user)
        url = reverse('ticket-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_generate_seats_restricted_to_staff(self):
        """Verify non-staff users cannot generate seats."""
        self.client.force_authenticate(user=self.user)
        url = reverse('theater-generate-seats', kwargs={'pk': self.theater.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_coupon_validation(self):
        """Verify validation endpoint for VIP free entry coupons."""
        from apps.tickets.models import Coupon
        coupon = Coupon.objects.create(
            code="VIP-TEST-2026",
            discount_type="free_vip",
            discount_value=100,
            max_uses=5,
            is_active=True
        )
        url = reverse('coupon-validate-code')
        
        # Valid request
        res = self.client.post(url, {'code': 'VIP-TEST-2026', 'event_id': self.event.id}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('valid'))
        self.assertEqual(res.data.get('discount_type'), 'free_vip')

        # Invalid code
        res_invalid = self.client.post(url, {'code': 'INVALID-CODE', 'event_id': self.event.id}, format='json')
        self.assertEqual(res_invalid.status_code, status.HTTP_404_NOT_FOUND)

    def test_assigned_email_coupon_security(self):
        """Verify that a coupon assigned to an email denies access to other emails."""
        from apps.tickets.models import Coupon
        coupon = Coupon.objects.create(
            code="EXCLUSIVO-VIP",
            discount_type="free_vip",
            assigned_email="invitado@example.com",
            max_uses=1,
            is_active=True
        )
        url = reverse('coupon-validate-code')
        
        # 1. Validation with unauthorized email fails
        res_fail = self.client.post(url, {'code': 'EXCLUSIVO-VIP', 'email': 'hacker@example.com'}, format='json')
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)
        
        # 2. Validation with correct email succeeds
        res_ok = self.client.post(url, {'code': 'EXCLUSIVO-VIP', 'email': 'invitado@example.com'}, format='json')
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertTrue(res_ok.data.get('valid'))

    def test_free_vip_coupon_checkout_with_seat(self):
        """Verify redeeming a 100% free VIP coupon creates paid tickets directly with chosen seat."""
        from apps.tickets.models import Coupon
        coupon = Coupon.objects.create(
            code="FREE-VIP-PASS",
            discount_type="free_vip",
            max_uses=2,
            is_active=True
        )
        url = reverse('ticket-list') + 'checkout/'
        data = {
            'email': 'vipguest@example.com',
            'event_id': self.event.id,
            'seat_ids': [self.seat_vip.id],
            'coupon_code': 'FREE-VIP-PASS'
        }
        res = self.client.post(url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data.get('status'), 'success')

        # Verify ticket was created as paid directly with seat and used_coupon
        ticket = Ticket.objects.get(user_email='vipguest@example.com', event=self.event)
        self.assertEqual(ticket.status, 'paid')
        self.assertEqual(ticket.seat, self.seat_vip)
        self.assertEqual(ticket.used_coupon, coupon)

        # Check times_used updated
        coupon.refresh_from_db()
        self.assertEqual(coupon.times_used, 1)

    def test_seatless_ticket_checkout(self):
        """Verify purchasing seatless general tickets creates tickets without seat assignment."""
        url = reverse('ticket-list') + 'checkout/'
        data = {
            'email': 'general@example.com',
            'event_id': self.event.id,
            'quantity': 3,
            'is_seatless': True
        }
        res = self.client.post(url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        tickets = Ticket.objects.filter(user_email='general@example.com', event=self.event)
        self.assertEqual(tickets.count(), 3)
        for t in tickets:
            self.assertIsNone(t.seat)
            self.assertEqual(t.status, 'paid')

    def test_active_theme_endpoint_default(self):
        """Verify GET /api/tickets/theme/active/ returns default theme configuration from SiteSettings."""
        from apps.tickets.models import SiteSettings
        url = reverse('active-theme')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data.get('primary_color'), '#E5A93B')
        self.assertEqual(res.data.get('particle_shape'), 'moon')
        self.assertEqual(res.data.get('card_style'), 'rounded-full')

    def test_site_settings_allow_canvas_zoom(self):
        """Verify SiteSettings supports allow_canvas_zoom toggle."""
        from apps.tickets.models import SiteSettings
        s = SiteSettings.get()
        self.assertTrue(s.allow_canvas_zoom)
        
        url = reverse('site-settings')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('allow_canvas_zoom', res.data)
        self.assertTrue(res.data['allow_canvas_zoom'])

    def test_active_theme_endpoint_event_override(self):
        """Verify GET /api/tickets/theme/active/ returns event-specific custom theme when set."""
        # Set custom theme for event
        self.event.primary_color = '#FF4500'
        self.event.particle_shape = 'cactus'
        self.event.card_style = 'rounded-2xl'
        self.event.save()

        url = reverse('active-theme') + f'?event_id={self.event.id}'
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data.get('primary_color'), '#FF4500')
        self.assertEqual(res.data.get('particle_shape'), 'cactus')
        self.assertEqual(res.data.get('card_style'), 'rounded-2xl')
        self.assertEqual(res.data.get('event_id'), self.event.id)

    def test_site_settings_theme_update_admin(self):
        """Verify staff/admin can update global theme settings via POST /api/tickets/settings/."""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('site-settings')
        data = {
            'primary_color': '#00FF00',
            'particle_shape': 'star',
            'custom_css': 'body { font-weight: bold; }'
        }
        res = self.client.post(url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data.get('theme_config', {}).get('primary_color'), '#00FF00')
        self.assertEqual(res.data.get('theme_config', {}).get('particle_shape'), 'star')
        self.assertEqual(res.data.get('theme_config', {}).get('custom_css'), 'body { font-weight: bold; }')
    def test_calculate_total_with_fee_gross_up(self):
        """Verify Gross-Up fee calculation guarantees 100% net base payout after Stripe 3.6% + $3.00 deduction."""
        from apps.tickets.fees import calculate_total_with_fee
        
        # Case A: Base price $1,000.00 MXN
        res = calculate_total_with_fee(1000.00)
        self.assertEqual(res['base_price'], 1000.00)
        self.assertEqual(res['total'], 1040.46)
        self.assertEqual(res['service_fee'], 40.46)
        
        # Verify Stripe deduction formula: total - (total * 0.036 + 3.00) == net base_price
        stripe_deduction = round(1040.46 * 0.036 + 3.00, 2)
        self.assertEqual(stripe_deduction, 40.46)
        self.assertEqual(round(1040.46 - stripe_deduction, 2), 1000.00)

        # Case B: Base price $500.00 MXN
        res_500 = calculate_total_with_fee(500.00)
        self.assertEqual(res_500['base_price'], 500.00)
        self.assertEqual(res_500['total'], 521.78)
        self.assertEqual(res_500['service_fee'], 21.78)

    @patch('stripe.checkout.Session.create')
    def test_create_ticket_checkout_session_fee_line_item(self, mock_session_create):
        """Verify create_ticket_checkout_session appends the Gross-Up platform service fee line item."""
        from apps.shop.utils import create_ticket_checkout_session
        mock_session_create.return_value = type('MockSession', (), {'id': 'cs_test_123', 'url': 'https://checkout.stripe.com/test'})()

        session = create_ticket_checkout_session(
            event=self.event,
            seats=[self.seat_std],
            user_email="test@example.com",
            success_url="https://example.com/success",
            cancel_url="https://example.com/cancel",
            quantity=1
        )
        
        self.assertTrue(mock_session_create.called)
        kwargs = mock_session_create.call_args[1]
        line_items = kwargs.get('line_items', [])
        
        # Check that there is a line item for the service fee
        fee_item = next((item for item in line_items if 'Cargo de servicio' in item.get('price_data', {}).get('product_data', {}).get('name', '')), None)
        self.assertIsNotNone(fee_item)
        self.assertGreater(fee_item['price_data']['unit_amount'], 0)

    def test_event_pricing_and_admin_persistence(self):
        """Verify staff/admin can update and persist ticket base prices and dynamic pricing strategy."""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('event-detail', args=[self.event.id])
        data = {
            'title': self.event.title,
            'artist': self.event.artist,
            'date': self.event.date.isoformat(),
            'seatless_ticket_price': '650.00',
            'numbered_ticket_price': '1250.00',
            'enable_dynamic_pricing': 'true',
            'monthly_price_increment': '75.00',
            'allow_seatless_tickets': 'true',
            'price_multiplier': '1.00'
        }
        res = self.client.patch(url, data, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        # Verify DB persistence
        self.event.refresh_from_db()
        self.assertEqual(float(self.event.seatless_ticket_price), 650.00)
        self.assertEqual(float(self.event.numbered_ticket_price), 1250.00)
        self.assertTrue(self.event.enable_dynamic_pricing)
        self.assertEqual(float(self.event.monthly_price_increment), 75.00)

    @patch('stripe.checkout.Session.create')
    def test_create_ticket_checkout_session_meet_greet_with_fee(self, mock_session_create):
        """Verify Meet & Greet ticket purchases and M&G upgrades correctly sum the Gross-Up service fee."""
        from apps.shop.utils import create_ticket_checkout_session
        mock_session_create.return_value = type('MockSession', (), {'id': 'cs_test_mg_123', 'url': 'https://checkout.stripe.com/test_mg'})()

        # Standalone M&G Event
        mg_event = Event.objects.create(
            title="Convivencia Exclusiva M&G",
            artist="Ms Ambar",
            date=self.event.date,
            event_type="meet_greet",
            mg_price=500.00,
            mg_limit=20
        )

        session = create_ticket_checkout_session(
            event=mg_event,
            seats=[],
            user_email="mg_buyer@example.com",
            success_url="https://example.com/success",
            cancel_url="https://example.com/cancel",
            quantity=2
        )

        self.assertTrue(mock_session_create.called)
        kwargs = mock_session_create.call_args[1]
        line_items = kwargs.get('line_items', [])

        # Total base = 2 * 500 = 1000 MXN. Gross-Up fee = 40.46 MXN
        fee_item = next((item for item in line_items if 'Cargo de servicio' in item.get('price_data', {}).get('product_data', {}).get('name', '')), None)
        self.assertIsNotNone(fee_item)
        self.assertEqual(fee_item['price_data']['unit_amount'], 4046) # $40.46 MXN
