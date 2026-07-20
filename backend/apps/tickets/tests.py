from django.urls import reverse
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

    def test_event_list_includes_past_events_for_timeline(self):
        """Verify public users receive active past events so they can be rendered in the tour timeline."""
        past_event = Event.objects.create(
            title="Concierto Pasado",
            artist="MS AMBAR Ensemble",
            date=timezone.now() - timezone.timedelta(days=2),
            theater=self.theater,
            is_active=True
        )
        url = reverse('event-list')

        response_anon = self.client.get(url)
        self.assertEqual(response_anon.status_code, status.HTTP_200_OK)
        anon_titles = [e['title'] for e in response_anon.data]
        self.assertIn("Concierto Pasado", anon_titles)
        self.assertIn("Sinfonía Ámbar 2026", anon_titles)

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
