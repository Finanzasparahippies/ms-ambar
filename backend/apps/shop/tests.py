from django.urls import reverse
from django.test import override_settings
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

    def test_admin_create_product_with_image_url(self):
        """Verify admin can create product providing an optimized image URL and auto slug."""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('product-list')
        data = {
            'name': 'Playera Punk Tour',
            'description': 'Edición especial concierto',
            'price': 450.00,
            'stock': 20,
            'image': 'https://res.cloudinary.com/ms-ambar/image/upload/v123/product_opt.webp',
            'category': self.category.id,
            'is_active': True
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['slug'], 'playera-punk-tour')
        self.assertEqual(response.data['image'], 'https://res.cloudinary.com/ms-ambar/image/upload/v123/product_opt.webp')

    def test_product_slug_collision_resolution(self):
        """Verify creating two products with identical names generates unique slugs."""
        p1 = Product.objects.create(name='Poster Lunar', price=200, stock=5, category=self.category)
        p2 = Product.objects.create(name='Poster Lunar', price=200, stock=5, category=self.category)
        self.assertEqual(p1.slug, 'poster-lunar')
        self.assertEqual(p2.slug, 'poster-lunar-1')

    def test_admin_delete_product(self):
        """Verify admin can delete product."""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('product-detail', kwargs={'pk': self.product_active.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Product.objects.filter(id=self.product_active.id).exists())

    def test_anonymous_cannot_create_or_delete_product(self):
        """Verify anonymous user cannot create or delete products."""
        url = reverse('product-list')
        data = {'name': 'Unauthorized Item', 'price': 100, 'stock': 1}
        response = self.client.post(url, data, format='json')
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

        del_url = reverse('product-detail', kwargs={'pk': self.product_active.id})
        del_response = self.client.delete(del_url)
        self.assertIn(del_response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    @override_settings(TESTING=False, STRIPE_SECRET_KEY='sk_test_valid_key')
    @patch('stripe.checkout.Session.create')
    @patch('apps.shop.views.send_order_confirmation_email')
    def test_checkout_success(self, mock_email, mock_session_create):
        """Verify checkout creates order, updates stock, and sends confirmation."""
        class MockSession:
            id = 'cs_test_123'
            url = 'https://checkout.stripe.com/pay/cs_test_123'
        mock_session_create.return_value = MockSession()

        url = reverse('shop-checkout')
        data = {
            'email': 'buyer@example.com',
            'full_name': 'Carlos Santana',
            'phone': '3331234567',
            'street_and_number': 'Av. Juárez 123',
            'suburb': 'Centro',
            'city': 'Guadalajara',
            'state': 'Jalisco',
            'postal_code': '44100',
            'country': 'México',
            'shipping_amount': 150.00,
            'items': [
                {'product_id': self.product_active.id, 'quantity': 2}
            ]
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('checkout_url', response.data)
        
        # Verify order exists
        order = Order.objects.get(user_email='buyer@example.com')
        self.assertEqual(order.status, 'pending')
        self.assertEqual(order.total_amount, 1350.00)
        self.assertEqual(order.items.count(), 1)
        
        # Verify stock not updated yet (still 10)
        self.product_active.refresh_from_db()
        self.assertEqual(self.product_active.stock, 10)

        # Verify stripe.checkout.Session.create arguments (shipping_options and metadata)
        self.assertTrue(mock_session_create.called)
        call_kwargs = mock_session_create.call_args[1]
        self.assertIn('shipping_options', call_kwargs)
        self.assertEqual(len(call_kwargs['shipping_options']), 1)
        self.assertEqual(call_kwargs['shipping_options'][0]['shipping_rate_data']['fixed_amount']['amount'], 15000)
        self.assertEqual(call_kwargs['metadata']['type'], 'shop_purchase')
        self.assertEqual(call_kwargs['metadata']['order_id'], str(order.id))
        self.assertEqual(call_kwargs['metadata']['shipping_amount'], '150.0')
        self.assertEqual(call_kwargs['metadata']['rate_id'], 'rate_std_fallback')

    def test_shipping_quote_endpoint(self):
        """Verify shipping quote endpoint returns rates with fallback."""
        url = reverse('shipping-quote')
        data = {
            'postal_code': '06000',
            'weight_kg': 1.0
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('rates', response.data)
        self.assertTrue(len(response.data['rates']) > 0)
        self.assertEqual(response.data['dest_postal_code'], '06000')

    def test_postal_code_lookup_endpoint(self):
        """Verify 5-digit postal code lookup and validation."""
        url = reverse('postal-code-lookup', kwargs={'postal_code': '83000'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['valid'])
        self.assertEqual(response.data['postal_code'], '83000')

    def test_postal_code_lookup_invalid(self):
        """Verify invalid postal code returns 400."""
        url = reverse('postal-code-lookup', kwargs={'postal_code': '123'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['valid'])

    def test_skydropx_webhook_delivered(self):
        """Verify Skydropx webhook updates order status to delivered."""
        order = Order.objects.create(
            user_email='buyer@example.com',
            status='shipped',
            total_amount=1350.00,
            full_name='Test Buyer',
            tracking_number='TRACK-TEST-123'
        )
        url = reverse('skydropx-webhook')
        payload = {
            'event': 'shipment.delivered',
            'data': {
                'tracking_number': 'TRACK-TEST-123',
                'attributes': {
                    'tracking_number': 'TRACK-TEST-123'
                }
            }
        }
        response = self.client.post(url, payload, format='json', HTTP_X_SKYDROPX_TOKEN='kPxZv17KoHJYNGZgsIxRFHWFw50knp0YdGlD6hmpgGQ')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, 'delivered')

    def test_skydropx_webhook_monotonic_ordering(self):
        """Verify out-of-order events (e.g. in_transit arriving after delivered) do not downgrade status."""
        order = Order.objects.create(
            user_email='buyer@example.com',
            status='paid',
            total_amount=1350.00,
            full_name='Test Buyer',
            tracking_number='TRACK-MONOTONIC-123'
        )
        url = reverse('skydropx-webhook')

        # 1. Evento entregado llega primero
        payload_delivered = {
            'event': 'shipment.delivered',
            'data': {
                'tracking_number': 'TRACK-MONOTONIC-123',
                'attributes': {'status': 'delivered', 'tracking_number': 'TRACK-MONOTONIC-123'}
            }
        }
        res1 = self.client.post(url, payload_delivered, format='json', HTTP_X_SKYDROPX_TOKEN='kPxZv17KoHJYNGZgsIxRFHWFw50knp0YdGlD6hmpgGQ')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, 'delivered')

        # 2. Evento tardío 'in_transit' llega después: Debe ser ignorado por orden monótono
        payload_delayed = {
            'event': 'tracking.updated',
            'data': {
                'tracking_number': 'TRACK-MONOTONIC-123',
                'attributes': {'status': 'in_transit', 'tracking_number': 'TRACK-MONOTONIC-123'}
            }
        }
        res2 = self.client.post(url, payload_delayed, format='json', HTTP_X_SKYDROPX_TOKEN='kPxZv17KoHJYNGZgsIxRFHWFw50knp0YdGlD6hmpgGQ')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        # El estado PERMANECE en 'delivered'
        self.assertEqual(order.status, 'delivered')

    def test_skydropx_webhook_lookup_by_shipping_id(self):
        """Verify Skydropx webhook matches order via shipping_id when tracking_number is updated."""
        order = Order.objects.create(
            user_email='buyer@example.com',
            status='paid',
            total_amount=950.00,
            full_name='Buyer ShippingID',
            shipping_id='SHIP-UUID-777'
        )
        url = reverse('skydropx-webhook')
        payload = {
            'event': 'shipment.in_transit',
            'data': {
                'id': 'SHIP-UUID-777',
                'attributes': {
                    'status': 'in_transit',
                    'tracking_number': 'TRACK-REAL-888'
                }
            }
        }
        response = self.client.post(url, payload, format='json', HTTP_X_SKYDROPX_TOKEN='kPxZv17KoHJYNGZgsIxRFHWFw50knp0YdGlD6hmpgGQ')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, 'shipped')
        self.assertEqual(order.tracking_number, 'TRACK-REAL-888')

    def test_skydropx_wallet_balance_critical_alert(self):
        """Verify check_wallet_balance_alert triggers an ERROR log when balance is below threshold."""
        from apps.shop.shipping import check_wallet_balance_alert
        with self.assertLogs('apps', level='ERROR') as cm:
            check_wallet_balance_alert(150.0, currency='MXN')
        self.assertTrue(any('[SKYDROPX_WALLET_CRITICAL]' in record.getMessage() for record in cm.records))

    @override_settings(TESTING=False, SKYDROPX_WEBHOOK_SECRET='kPxZv17KoHJYNGZgsIxRFHWFw50knp0YdGlD6hmpgGQ')
    def test_skydropx_webhook_invalid_token(self):
        """Verify Skydropx webhook rejects requests with invalid token."""
        url = reverse('skydropx-webhook')
        payload = {'event': 'shipment.delivered'}
        response = self.client.post(url, payload, format='json', HTTP_X_SKYDROPX_TOKEN='token_invalido')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_checkout_insufficient_stock(self):
        """Verify checkout fails if stock is insufficient."""
        url = reverse('shop-checkout')
        data = {
            'email': 'buyer@example.com',
            'full_name': 'Carlos Santana',
            'phone': '3331234567',
            'street_and_number': 'Av. Juárez 123',
            'suburb': 'Centro',
            'city': 'Guadalajara',
            'state': 'Jalisco',
            'postal_code': '44100',
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

    @override_settings(TESTING=False, STRIPE_SECRET_KEY='sk_test_mock')
    @patch('stripe.Price.create')
    @patch('stripe.Price.list')
    @patch('stripe.Product.create')
    @patch('stripe.Product.list')
    def test_product_stripe_sync_on_create(self, mock_prod_list, mock_prod_create, mock_price_list, mock_price_create):
        """Verify saving a new product correctly creates a product and price in Stripe."""
        # 1. Mock listing: no existing products
        class MockIterator:
            def auto_paging_iter(self):
                return []
        mock_prod_list.return_value = MockIterator()
        
        # 2. Mock creation of product
        class MockProduct:
            id = 'prod_mock_new_123'
            active = True
            name = '[Ms Ambar] Nuevo Item'
            description = 'Description text'
            metadata = {}
        mock_prod_create.return_value = MockProduct()

        # 3. Mock price list: empty
        class MockPriceList:
            data = []
        mock_price_list.return_value = MockPriceList()

        # 4. Mock price creation
        class MockPrice:
            id = 'price_mock_new_123'
        mock_price_create.return_value = MockPrice()

        # Create the product (tests the save hook)
        new_prod = Product.objects.create(
            name='Nuevo Item',
            description='Description text',
            price=150.00,
            stock=5,
            category=self.category,
            is_active=True
        )

        # Assert product.save() correctly synced with mocked Stripe API
        mock_prod_create.assert_called_once()
        mock_price_create.assert_called_once()
        self.assertEqual(new_prod.stripe_product_id, 'prod_mock_new_123')
        self.assertEqual(new_prod.stripe_price_id, 'price_mock_new_123')

    @override_settings(TESTING=False, STRIPE_SECRET_KEY='sk_test_mock')
    @patch('stripe.Price.create')
    @patch('stripe.Price.list')
    @patch('stripe.Product.modify')
    @patch('stripe.Product.list')
    def test_product_stripe_sync_reuses_existing(self, mock_prod_list, mock_prod_modify, mock_price_list, mock_price_create):
        """Verify saving a product reuses Stripe product and price if they exist with matching metadata."""
        # 1. Mock listing: returns an existing product with same metadata
        class MockProduct:
            id = 'prod_existing_123'
            active = True
            name = '[Ms Ambar] Reusable Item'
            description = 'Same description'
            metadata = {'product_slug': 'reusable-item', 'product_id': '999'}
        
        class MockIterator:
            def auto_paging_iter(self):
                return [MockProduct()]
        mock_prod_list.return_value = MockIterator()

        # 2. Mock price list: returns matching price (amount 15000 cents, MXN, non-recurring)
        class MockPrice:
            id = 'price_existing_123'
            unit_amount = 15000
            currency = 'mxn'
            recurring = None
        
        class MockPriceList:
            data = [MockPrice()]
        mock_price_list.return_value = MockPriceList()

        # Create/Save the product
        prod = Product.objects.create(
            id=999,
            name='Reusable Item',
            description='Same description',
            price=150.00,
            stock=10,
            category=self.category,
            is_active=True
        )

        # Assertions
        mock_price_create.assert_not_called()
        self.assertEqual(prod.stripe_product_id, 'prod_existing_123')
        self.assertEqual(prod.stripe_price_id, 'price_existing_123')

    @override_settings(TESTING=False, STRIPE_SECRET_KEY='sk_test_mock')
    @patch('stripe.Price.create')
    @patch('stripe.Price.list')
    @patch('stripe.Product.create')
    @patch('stripe.Product.list')
    def test_event_stripe_sync_meet_greet(self, mock_prod_list, mock_prod_create, mock_price_list, mock_price_create):
        """Verify saving a Meet & Greet Event syncs the product and price to Stripe."""
        # 1. Mock listing: no existing products
        class MockIterator:
            def auto_paging_iter(self):
                return []
        mock_prod_list.return_value = MockIterator()

        # 2. Mock creation of product
        class MockProduct:
            id = 'prod_event_mg_123'
            active = True
            name = '[Boletos] M&G Test'
            metadata = {}
        mock_prod_create.return_value = MockProduct()

        # 3. Mock price list: empty
        class MockPriceList:
            data = []
        mock_price_list.return_value = MockPriceList()

        # 4. Mock price creation
        class MockPrice:
            id = 'price_event_mg_123'
        mock_price_create.return_value = MockPrice()

        # Create Event
        event = Event.objects.create(
            title="M&G Test",
            artist="Artist Test",
            date=timezone.now() + timezone.timedelta(days=10),
            event_type="meet_greet",
            mg_price=1200.00,
            mg_limit=10,
            is_active=True
        )

        # Assertions
        self.assertEqual(mock_prod_create.call_count, 2)
        self.assertEqual(mock_price_create.call_count, 2)
        self.assertEqual(event.stripe_product_id, 'prod_event_mg_123')
        self.assertEqual(event.stripe_price_id, 'price_event_mg_123')

    def test_order_by_session_mock_idempotency(self):
        """Verify OrderBySessionView retrieves and confirms mock session idempotently."""
        order = Order.objects.create(
            user_email='fan@msambar.com',
            status='pending',
            total_amount=750.00,
            full_name='Ana Martinez',
            phone='6621234567',
            street_and_number='Calle Rosales 45',
            suburb='Centenario',
            city='Hermosillo',
            state='Sonora',
            postal_code='83000',
            country='México',
            shipping_cost=150.00
        )
        OrderItem.objects.create(order=order, product=self.product_active, quantity=1, price=600.00)
        initial_stock = self.product_active.stock

        mock_session_id = f"mock_session_{order.id}"
        url = reverse('order-by-session') + f"?session_id={mock_session_id}"

        # Primera llamada (debe confirmar orden y descontar stock)
        response1 = self.client.get(url)
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        self.assertEqual(response1.data['id'], order.id)
        self.assertEqual(response1.data['status'], 'paid')
        self.assertIsNotNone(response1.data['tracking_number'])

        self.product_active.refresh_from_db()
        self.assertEqual(self.product_active.stock, initial_stock - 1)

        # Segunda llamada (idempotente: no descuenta stock de nuevo)
        response2 = self.client.get(url)
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.product_active.refresh_from_db()
        self.assertEqual(self.product_active.stock, initial_stock - 1)

    def test_order_download_label_generates_pdf(self):
        """Verify OrderDownloadLabelView generates and returns sample PDF."""
        order = Order.objects.create(
            user_email='pdf_fan@msambar.com',
            status='paid',
            total_amount=750.00,
            full_name='Rodrigo Morales',
            phone='6629876543',
            street_and_number='Blvd. Hidalgo 100',
            suburb='Centro',
            city='Hermosillo',
            state='Sonora',
            postal_code='83000',
            country='México',
            shipping_cost=150.00
        )
        url = reverse('order-download-label', kwargs={'pk': order.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')

    @patch('apps.shop.shipping.SkydropxClient.test_connectivity')
    def test_shipping_health_check_endpoint(self, mock_test_conn):
        """Verify ShippingHealthCheckView returns structured diagnostic response."""
        mock_test_conn.return_value = {
            "base_url": "https://api-demo.skydropx.com/v1",
            "environment": "staging",
            "origin_zip": "83150",
            "dest_zip": "83100",
            "is_configured": True,
            "status_code": 200,
            "latency_ms": 120,
            "success": True,
            "carriers_found": [
                {"provider": "FedEx", "service": "Nacional", "total_price": 145.0, "currency": "MXN"}
            ],
            "error": None
        }
        url = reverse('shipping-health-check') + "?dest_cp=83100"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(len(response.data['carriers_found']), 1)

    def test_skydropx_client_dual_environments(self):
        """Verify SkydropxClient resolves production and staging/sandbox URLs and keys cleanly."""
        from apps.shop.shipping import SkydropxClient

        prod_client = SkydropxClient(api_key="prod_key_123", environment="production")
        self.assertEqual(prod_client.environment, "production")
        self.assertEqual(prod_client.base_url, "https://api.skydropx.com/v1")
        self.assertEqual(prod_client._headers()["Authorization"], "Token token=prod_key_123")

        sandbox_client = SkydropxClient(api_key="sandbox_key_456", environment="staging")
        self.assertEqual(sandbox_client.environment, "staging")
        self.assertEqual(sandbox_client.base_url, "https://sb-pro.skydropx.com/api/v1")
        self.assertEqual(sandbox_client._headers()["Authorization"], "Token token=sandbox_key_456")

        pro_client = SkydropxClient(api_key="Bearer jwt_token_abc", environment="pro_production")
        self.assertEqual(pro_client.base_url, "https://pro.skydropx.com/api/v1")
        self.assertEqual(pro_client._headers()["Authorization"], "Bearer jwt_token_abc")





