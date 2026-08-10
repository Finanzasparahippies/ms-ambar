from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from apps.shop.models import Category, Product, Order, OrderItem, Expense
from apps.tickets.models import Theater, Event, Seat, Ticket
from apps.performance.models import PerformanceMetric

User = get_user_model()

class DashboardAppTests(APITestCase):
    def setUp(self):
        # Create users
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
        self.staff_only_user = User.objects.create_user(
            email='staff@example.com',
            username='staff',
            password='staffpassword',
            is_staff=True
        )

        # Create category, product, order
        self.category = Category.objects.create(name='Vinilos')
        self.product = Product.objects.create(
            name='Ámbar LP',
            price=600.00,
            stock=10,
            category=self.category,
            is_active=True
        )
        self.order = Order.objects.create(
            user_email='buyer@example.com',
            status='paid',
            total_amount=1200.00,
            full_name='Carlos Santana',
            street_and_number='Av. Juárez 123',
            suburb='Centro',
            city='Guadalajara',
            state='Jalisco',
            postal_code='44100',
            country='México',
            phone='3331234567'
        )
        self.order_item = OrderItem.objects.create(
            order=self.order,
            product=self.product,
            quantity=2,
            price=600.00
        )

        # Create theater, seat, event, ticket
        self.theater = Theater.objects.create(name="Teatro Test", location="Test City")
        self.seat = Seat.objects.create(
            theater=self.theater,
            section="VIP",
            row="A",
            number=1,
            base_price=500.00
        )
        self.event = Event.objects.create(
            title="Concierto Webhook",
            artist="Artist Test",
            date=timezone.now() + timezone.timedelta(days=2),
            theater=self.theater,
            price_multiplier=1.20,
            mg_price=100.00
        )
        self.ticket = Ticket.objects.create(
            event=self.event,
            seat=self.seat,
            user_email='ticketbuyer@example.com',
            status='paid',
            has_mg=True,
            amount_paid=700.00
        )

        # Create expense
        self.expense = Expense.objects.create(
            title="Alquiler de Luces",
            amount=5000.00,
            category="Producción",
            description="Luces robóticas para el show principal"
        )

        # Create performance metric
        PerformanceMetric.objects.create(
            name='LCP',
            value=2000.0,
            path='/tour/'
        )

    def test_analytics_overview_unauthorized(self):
        """Verify that only admin users can access analytics overview."""
        url = reverse('analytics_overview')
        # 1. Anonymous request -> 401
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Regular user -> 403
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_analytics_overview_success(self):
        """Verify dashboard statistics return correct values and format."""
        url = reverse('analytics_overview')
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check response structure
        self.assertIn('financials', response.data)
        self.assertIn('tickets', response.data)
        self.assertIn('shop', response.data)
        self.assertIn('vitals', response.data)
        self.assertIn('charts', response.data)

        # Financial verification
        financials = response.data['financials']
        # ticket_sales = 500 (seat price) * 1.20 (multiplier) + 100 (has_mg) = 700.00
        self.assertEqual(financials['ticket_sales'], 700.00)
        # shop_sales = 1200.00
        self.assertEqual(financials['shop_sales'], 1200.00)
        # gross_sales = 700 + 1200 = 1900.00
        self.assertEqual(financials['gross_sales'], 1900.00)
        # expenses = 5000.00
        self.assertEqual(financials['total_expenses'], 5000.00)
        # net_profit = 1900 - 5000 = -3100.00
        self.assertEqual(financials['net_profit'], -3100.00)

        # Tickets verification
        tickets = response.data['tickets']
        self.assertEqual(tickets['total_sold'], 1)
        self.assertEqual(tickets['mg_upgrades'], 1)

        # Shop verification
        shop = response.data['shop']
        self.assertEqual(shop['total_orders'], 1)
        self.assertEqual(shop['total_products'], 1)
        self.assertEqual(len(shop['top_products']), 1)
        self.assertEqual(shop['top_products'][0]['name'], 'Ámbar LP')

        # Vitals verification
        self.assertEqual(len(response.data['vitals']), 1)
        self.assertEqual(response.data['vitals'][0]['name'], 'LCP')
        self.assertEqual(response.data['vitals'][0]['value'], 2000.0)

        # Ads metrics safety verification
        self.assertIn('ads', response.data)
        self.assertIn('is_connected', response.data['ads'])
        self.assertIn('summary', response.data['ads'])

    def test_analytics_overview_without_ads_credentials(self):
        """Verify dashboard overview handles unconfigured/failing ads gracefully."""
        url = reverse('analytics_overview')
        self.client.force_authenticate(user=self.admin_user)
        
        from unittest.mock import patch
        with patch('apps.dashboard.services.ads_service.AdsIntegrationService.is_google_ads_configured', return_value=False), \
             patch('apps.dashboard.services.ads_service.AdsIntegrationService.is_meta_ads_configured', return_value=False):
            response = self.client.get(url + '?period=7d')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertIn('ads', response.data)
            self.assertFalse(response.data['ads']['is_connected'])
            self.assertEqual(response.data['ads']['summary']['total_spend'], 0.0)

    def test_system_metrics_unauthorized(self):
        """Verify that only admin users can access system metrics."""
        url = reverse('system_metrics')
        # 1. Anonymous request -> 401
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Regular user -> 403
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_system_metrics_success(self):
        """Verify system metrics view executes and returns valid metrics."""
        url = reverse('system_metrics')
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.assertIn('cpu', response.data)
        self.assertIn('memory', response.data)
        self.assertIn('disk', response.data)
        self.assertIn('database', response.data)
        self.assertEqual(response.data['database']['status'], 'Conectado')

    def test_dashboard_orders_unauthorized(self):
        """Verify only admin users can list or patch orders."""
        url = reverse('dashboard_orders')
        # 1. Anonymous -> 401
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Regular -> 403
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_dashboard_orders_list_success(self):
        """Verify admin can list orders with accurate details."""
        url = reverse('dashboard_orders')
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['full_name'], 'Carlos Santana')
        self.assertEqual(len(response.data[0]['items']), 1)
        self.assertEqual(response.data[0]['items'][0]['product_name'], 'Ámbar LP')

    def test_dashboard_order_status_update_success(self):
        """Verify admin can update order status."""
        url = reverse('dashboard_orders')
        self.client.force_authenticate(user=self.admin_user)
        data = {
            'order_id': self.order.id,
            'status': 'shipped'
        }
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'shipped')

    def test_dashboard_order_status_update_invalid(self):
        """Verify error handling for invalid statuses or non-existent order IDs."""
        url = reverse('dashboard_orders')
        self.client.force_authenticate(user=self.admin_user)

        # 1. Invalid status
        data_invalid_status = {'order_id': self.order.id, 'status': 'completed'}
        response = self.client.patch(url, data_invalid_status, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Non-existent order
        data_invalid_id = {'order_id': 99999, 'status': 'shipped'}
        response = self.client.patch(url, data_invalid_id, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_dashboard_expenses_unauthorized(self):
        """Verify only admin users can access or create expenses."""
        url = reverse('dashboard_expenses')
        # 1. Anonymous -> 401
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Regular -> 403
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_dashboard_expenses_list_success(self):
        """Verify admin can list expenses."""
        url = reverse('dashboard_expenses')
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'Alquiler de Luces')

    def test_dashboard_expense_create_success(self):
        """Verify admin can register a new expense."""
        url = reverse('dashboard_expenses')
        self.client.force_authenticate(user=self.admin_user)
        data = {
            'title': 'Catering Banda',
            'amount': 1500.00,
            'category': 'Catering',
            'description': 'Comida y bebidas para el equipo técnico'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Expense.objects.count(), 2)
        self.assertEqual(Expense.objects.get(title='Catering Banda').amount, 1500.00)

    def test_dashboard_expense_create_missing_fields(self):
        """Verify registration fails if required fields are missing."""
        url = reverse('dashboard_expenses')
        self.client.force_authenticate(user=self.admin_user)
        data = {
            'title': '', # Empty required field
            'amount': 1500.00
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_superuser_staff_restricted_access(self):
        """Verify that staff members can view analytics metrics but POST expenses require superuser rights."""
        # Authenticate as staff-only user
        self.client.force_authenticate(user=self.staff_only_user)

        # 1. Analytics Overview check (Staff users receive real metrics)
        url_analytics = reverse('analytics_overview')
        response_analytics = self.client.get(url_analytics)
        self.assertEqual(response_analytics.status_code, status.HTTP_200_OK)
        self.assertEqual(response_analytics.data['financials']['gross_sales'], 1900.0)

        # 2. Expenses check
        url_expenses = reverse('dashboard_expenses')
        response_expenses_get = self.client.get(url_expenses)
        self.assertEqual(response_expenses_get.status_code, status.HTTP_200_OK)

        response_expenses_post = self.client.post(url_expenses, {'title': 'New Rent', 'amount': 100})
        self.assertEqual(response_expenses_post.status_code, status.HTTP_403_FORBIDDEN)

    def test_ads_performance_endpoint(self):
        """Verify admin can retrieve ads performance metrics."""
        url = reverse('dashboard_ads_performance')
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('summary', response.data)
        self.assertIn('platforms', response.data)
        self.assertIn('campaigns', response.data)

    def test_analytics_overview_includes_ads_users_funnel(self):
        """Verify AnalyticsOverview response contains users, funnel and ads analytics."""
        url = reverse('analytics_overview')
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('users', response.data)
        self.assertIn('funnel', response.data)
        self.assertIn('ads', response.data)
