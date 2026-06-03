from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from apps.shop.models import Category, Product, Order, OrderItem
from apps.tickets.models import Event, Theater, Seat, Ticket
from unittest.mock import patch

User = get_user_model()

class ShopAppTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            email='admin@example.com',
            username='admin',
            password='adminpassword'
        )

        self.category = Category.objects.create(name='Vinilos')
        self.product_active = Product.objects.create(
            name='Ámbar LP',
            description='Vinilo edición especial translúcido',
            price=600.00,
            stock=10,
            category=self.category,
            is_active=True
        )
        self.product_inactive = Product.objects.create(
            name='Playera Prototipo',
            description='Playera descontinuada',
            price=250.00,
            stock=5,
            category=self.category,
            is_active=False
        )

        # Setup elements for webhook testing
        self.theater = Theater.objects.create(name="Teatro Test", location="Test City")
        self.seat = Seat.objects.create(
            theater=self.theater,
            section="Preferente",
            row="A",
            number=1,
            base_price=500.00
        )
        self.event = Event.objects.create(
            title="Concierto Webhook",
            artist="Artist Test",
            date=timezone.now() + timezone.timedelta(days=2),
            theater=self.theater
        )

    def test_product_list_active_only(self):
        """Verify anonymous users only see active shop products."""
        url = reverse('product-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Ámbar LP')

    @patch('apps.shop.views.send_order_confirmation_email')
    def test_checkout_success(self, mock_email):
        """Verify checkout creates order, updates stock, and sends confirmation."""
        url = reverse('shop-checkout')
        data = {
            'email': 'buyer@example.com',
            'full_name': 'Carlos Santana',
            'address': 'Av. Juárez 123',
            'city': 'Guadalajara',
            'country': 'México',
            'items': [
                {'product_id': self.product_active.id, 'quantity': 2}
            ]
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'paid')
        
        # Verify order exists
        order = Order.objects.get(user_email='buyer@example.com')
        self.assertEqual(order.total_amount, 1200.00)
        self.assertEqual(order.items.count(), 1)
        
        # Verify stock updated
        self.product_active.refresh_from_db()
        self.assertEqual(self.product_active.stock, 8)

    def test_checkout_insufficient_stock(self):
        """Verify checkout fails if stock is insufficient."""
        url = reverse('shop-checkout')
        data = {
            'email': 'buyer@example.com',
            'full_name': 'Carlos Santana',
            'address': 'Av. Juárez 123',
            'city': 'Guadalajara',
            'country': 'México',
            'items': [
                {'product_id': self.product_active.id, 'quantity': 15}
            ]
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Stock insuficiente', response.data['error'])

    @patch('apps.shop.views.send_ticket_email')
    @patch('stripe.Webhook.construct_event')
    def test_stripe_webhook_ticket_fulfillment(self, mock_construct, mock_send_ticket):
        """Verify that a successful Stripe webhook fulfills the purchased ticket."""
        mock_construct.return_value = {
            'type': 'checkout.session.completed',
            'data': {
                'object': {
                    'metadata': {
                        'type': 'ticket_purchase',
                        'event_id': str(self.event.id),
                        'seat_ids': str(self.seat.id),
                        'user_email': 'ticketbuyer@example.com'
                    }
                }
            }
        }

        url = reverse('stripe-webhook')
        response = self.client.post(url, {}, HTTP_STRIPE_SIGNATURE='valid_sig')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify ticket was created and marked paid
        ticket = Ticket.objects.get(event=self.event, seat=self.seat)
        self.assertEqual(ticket.user_email, 'ticketbuyer@example.com')
        self.assertEqual(ticket.status, 'paid')
        
        # Verify email was triggered
        mock_send_ticket.assert_called_once_with(ticket)

    @patch('apps.shop.views.send_ticket_email')
    @patch('stripe.Webhook.construct_event')
    def test_stripe_webhook_duplicate_prevented(self, mock_construct, mock_send_ticket):
        """Verify that duplicate webhook events with the same event ID are not processed twice."""
        mock_construct.return_value = {
            'id': 'evt_test_123456',
            'type': 'checkout.session.completed',
            'data': {
                'object': {
                    'metadata': {
                        'type': 'ticket_purchase',
                        'event_id': str(self.event.id),
                        'seat_ids': str(self.seat.id),
                        'user_email': 'ticketbuyer@example.com'
                    }
                }
            }
        }

        url = reverse('stripe-webhook')
        
        # 1. First event call should process successfully
        response1 = self.client.post(url, {}, HTTP_STRIPE_SIGNATURE='valid_sig')
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        self.assertEqual(Ticket.objects.filter(event=self.event, seat=self.seat).count(), 1)
        self.assertEqual(mock_send_ticket.call_count, 1)

        # 2. Second event call with same event ID should be ignored
        response2 = self.client.post(url, {}, HTTP_STRIPE_SIGNATURE='valid_sig')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        # Should NOT trigger send_ticket_email again
        self.assertEqual(mock_send_ticket.call_count, 1)
