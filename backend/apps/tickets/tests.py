from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from apps.tickets.models import Theater, Event, Seat, Ticket, GADeclaration

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
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')

    def test_checkout_concert_success(self):
        """Test checking out seats for a concert event successfully."""
        url = reverse('ticket-list') + 'checkout/'
        data = {
            'email': 'concert_buyer@example.com',
            'event_id': self.event.id,
            'seat_ids': [self.seat_std.id],
            'phone': '+525511223344',
            'has_mg': False
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(len(response.data['tickets']), 1)
        self.assertEqual(response.data['tickets'][0]['seat_display'], f"{self.seat_std.row}{self.seat_std.number}")

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

    def test_checkout_meet_greet_success(self):
        """Test checking out Meet & Greet tickets with quantity."""
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
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data['tickets']), 3)
        for ticket in response.data['tickets']:
            self.assertEqual(ticket['seat_display'], 'Meet & Greet')
            self.assertEqual(ticket['theater_name'], 'Convivencia')

    def test_retrieve_ticket_by_uuid(self):
        """Test that we can retrieve a ticket by its UUID token using the retrieve detail endpoint."""
        ticket = Ticket.objects.create(
            event=self.event,
            seat=self.seat_std,
            user_email="buyer@example.com",
            status="paid"
        )
        url = reverse('ticket-detail', kwargs={'pk': str(ticket.token)})
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
