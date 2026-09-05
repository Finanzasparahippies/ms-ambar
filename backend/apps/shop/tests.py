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
        """Verify SkydropxClient resolves production and staging/sandbox URLs with Bearer headers cleanly."""
        from apps.shop.shipping import SkydropxClient

        prod_client = SkydropxClient(api_key="prod_key_123", environment="production")
        self.assertEqual(prod_client.environment, "production")
        self.assertEqual(prod_client.base_url, "https://app.skydropx.com/api/v1")
        self.assertTrue(prod_client._headers()["Authorization"].startswith("Bearer "))

        sandbox_client = SkydropxClient(api_key="sandbox_key_456", environment="staging")
        self.assertEqual(sandbox_client.environment, "staging")
        self.assertEqual(sandbox_client.base_url, "https://sb-pro.skydropx.com/api/v1")
        self.assertTrue(sandbox_client._headers()["Authorization"].startswith("Bearer "))

    def test_shipping_config_api_and_admin(self):
        """Verify ShopShippingConfigView GET and PUT for changing operating method."""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('shipping-config')

        # GET
        get_res = self.client.get(url)
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertIn('config', get_res.data)
        self.assertEqual(get_res.data['config']['method_mode'], 'quotation')

        # PUT: Cambiar a Opción B (direct_rate)
        put_res = self.client.put(url, {
            'method_mode': 'direct_rate',
            'default_carrier': 'dhl',
            'default_service': 'express',
            'min_balance_alert': 750.0
        }, format='json')
        self.assertEqual(put_res.status_code, status.HTTP_200_OK)
        self.assertEqual(put_res.data['method_mode'], 'direct_rate')
        self.assertEqual(put_res.data['default_carrier'], 'dhl')

    def test_shipping_reconcile_endpoint(self):
        """Verify ShippingReconcileView handles order reconciliation."""
        self.client.force_authenticate(user=self.admin_user)
        order = Order.objects.create(
            user_email='reconcile_test@msambar.com',
            status='paid',
            total_amount=500.0,
            full_name='Carlos Ruiz',
            shipping_status='reconciliation_required'
        )
        url = reverse('shipping-reconcile')
        res = self.client.post(url, {'order_id': order.id}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('reconciled', res.data)

    def test_skydropx_webhook_deduplication(self):
        """Verify webhook deduplication via SkydropxWebhookEvent prevents reprocessing identical event_id."""
        url = reverse('skydropx-webhook')
        payload = {
            "id": "evt_skydropx_unique_999",
            "event": "shipment.in_transit",
            "data": {
                "id": "ship_123",
                "attributes": {
                    "tracking_number": "TRACK-TEST-DEDUP",
                    "status": "in_transit"
                }
            }
        }
        # First delivery: 200 OK
        res1 = self.client.post(url, payload, format='json')
        self.assertEqual(res1.status_code, 200)

        # Second delivery with same event id: recognized as already processed
        res2 = self.client.post(url, payload, format='json')
        self.assertEqual(res2.status_code, 200)
        self.assertIn(b"ya procesado previamente", res2.content)

    def test_shipment_payload_contract_validation(self):
        """Pillar 1: Contract test validating root encapsulation, required keys, and package dimensions."""
        from apps.shop.shipping.common import validate_shipment_payload_contract

        # 1. Payload without root 'shipment' key must fail
        invalid_payload_1 = {"rate_id": "rate_123"}
        valid, errors = validate_shipment_payload_contract(invalid_payload_1)
        self.assertFalse(valid)
        self.assertTrue(any("clave raíz canónica 'shipment'" in e for e in errors))

        # 2. Payload with missing required address fields must fail
        invalid_payload_2 = {
            "shipment": {
                "rate_id": "rate_123",
                "address_from": {"name": "Remitente"},  # missing phone, street1, etc.
                "address_to": {"name": "Destinatario"},
                "packages": [{"weight": 1.0, "consignment_note": "53102400", "package_type": "4G"}]
            }
        }
        valid, errors = validate_shipment_payload_contract(invalid_payload_2)
        self.assertFalse(valid)
        self.assertTrue(any("address_from.street1 es requerido" in e for e in errors))

        # 3. Payload with missing consignment_note or package_type must fail
        invalid_payload_3 = {
            "shipment": {
                "rate_id": "rate_123",
                "address_from": {
                    "name": "Remitente", "phone": "6622140000", "street1": "Kino 456",
                    "postal_code": "83150", "area_level1": "SO", "area_level2": "Hermosillo", "country_code": "MX"
                },
                "address_to": {
                    "name": "Destinatario", "phone": "6622140000", "street1": "Juarez 123",
                    "postal_code": "83000", "area_level1": "SO", "area_level2": "Hermosillo", "country_code": "MX"
                },
                "packages": [{"weight": 1.0, "length": 10, "width": 10, "height": 10}]  # Missing consignment_note and package_type
            }
        }
        valid, errors = validate_shipment_payload_contract(invalid_payload_3)
        self.assertFalse(valid)
        self.assertTrue(any("consignment_note es requerido" in e for e in errors))
        self.assertTrue(any("package_type es requerido" in e for e in errors))

        # 4. Valid canonical payload must pass
        valid_payload = {
            "shipment": {
                "rate_id": "rate_123",
                "address_from": {
                    "name": "Remitente", "phone": "6622140000", "street1": "Kino 456",
                    "postal_code": "83150", "area_level1": "SO", "area_level2": "Hermosillo", "country_code": "MX"
                },
                "address_to": {
                    "name": "Destinatario", "phone": "6622140000", "street1": "Juarez 123",
                    "postal_code": "83000", "area_level1": "SO", "area_level2": "Hermosillo", "country_code": "MX"
                },
                "packages": [
                    {
                        "package_number": 1,
                        "declared_value": 150.0,
                        "weight": 1.5,
                        "length": 30.0,
                        "width": 20.0,
                        "height": 10.0,
                        "consignment_note": "53102400",
                        "package_type": "4G"
                    }
                ]
            }
        }
        valid, errors = validate_shipment_payload_contract(valid_payload)
        self.assertTrue(valid)
        self.assertEqual(len(errors), 0)

    def test_dynamic_package_calculation_from_order(self):
        """Pillar 1: Packaging calculation derives weights from product catalog without blind hardcodes."""
        from apps.shop.shipping.common import calculate_order_package

        order = Order.objects.create(
            user_email='package_test@msambar.com',
            status='paid',
            total_amount=1200.0,
            full_name='Ana Gomez',
            street_and_number='Reforma 100',
            postal_code='83000',
            state='SO'
        )
        prod1 = Product.objects.create(name='Vinilo 1', price=600, stock=5, category=self.category, weight='500g')
        prod2 = Product.objects.create(name='Libro', price=600, stock=5, category=self.category, weight='1.2kg')
        OrderItem.objects.create(order=order, product=prod1, quantity=2, price=600)  # 2 * 0.5kg = 1.0kg
        OrderItem.objects.create(order=order, product=prod2, quantity=1, price=600)  # 1 * 1.2kg = 1.2kg

        packages = calculate_order_package(order=order)
        self.assertEqual(len(packages), 1)
        pkg = packages[0]
        self.assertAlmostEqual(pkg['weight'], 2.2, places=2)
        self.assertEqual(pkg['consignment_note'], '53102400')
        self.assertEqual(pkg['package_type'], '4G')
        self.assertEqual(pkg['declared_value'], 1200.0)

    def test_concurrency_lock_and_idempotency_prevents_duplicate_dispatch(self):
        """Pillar 2: select_for_update and 'creating'/'completed' state guards block concurrent emissions."""
        from apps.shop.shipping.shipments import generate_shipping_label
        from apps.shop.shipping.common import ShippingStatus

        order = Order.objects.create(
            user_email='concurrency@msambar.com',
            status='paid',
            total_amount=800.0,
            full_name='Mariana Rios',
            street_and_number='Colosio 789',
            postal_code='83200',
            state='Sonora',
            shipping_status=ShippingStatus.CREATING.value
        )

        # Calling generate_shipping_label when order is currently in 'creating' must abort immediately
        with patch('apps.shop.shipping.shipments.SkydropxClient') as mock_client:
            result = generate_shipping_label(order)
            self.assertFalse(result)
            mock_client.assert_not_called()

        # Calling when order is already 'completed' with tracking must return True idempotently
        order.shipping_status = ShippingStatus.COMPLETED.value
        order.tracking_number = 'SKY-TRACK-9999'
        order.save()

        with patch('apps.shop.shipping.shipments.SkydropxClient') as mock_client:
            result = generate_shipping_label(order)
            self.assertTrue(result)
            mock_client.assert_not_called()

    def test_network_timeout_transitions_to_reconciliation_required_without_blind_fallback(self):
        """Pillar 2: Network timeout (HTTP 504) transitions strictly to 'reconciliation_required' with zero secondary fallbacks."""
        from apps.shop.shipping.shipments import generate_shipping_label
        from apps.shop.shipping.common import ShippingStatus

        order = Order.objects.create(
            user_email='timeout@msambar.com',
            status='paid',
            total_amount=950.0,
            full_name='David Perez',
            street_and_number='Serdan 55',
            postal_code='83000',
            state='SO',
            selected_rate_id='rate_test_timeout',
            shipping_status=ShippingStatus.PENDING.value
        )

        mock_instance = MagicMock()
        mock_instance.is_configured = True
        mock_instance.environment = "staging"
        mock_instance.correlation_id = "test-corr-timeout"
        mock_instance.get_credits.return_value = {"success": True, "credits": {"balance": 500.0}}

        # Simulate network timeout (504) from Skydropx
        with patch('apps.shop.shipping.shipments.SkydropxClient', return_value=mock_instance), \
             patch('apps.shop.shipping.shipments.create_shipment_from_rate', return_value={"success": False, "status_code": 504, "error": "Gateway Timeout"}), \
             patch('apps.shop.shipping.quotations.quote_shipping_rates') as mock_quote_rates:

            res = generate_shipping_label(order)
            self.assertFalse(res)
            # Secondary live quotes must NEVER be called on timeout
            mock_quote_rates.assert_not_called()

        order.refresh_from_db()
        self.assertEqual(order.shipping_status, ShippingStatus.RECONCILIATION_REQUIRED.value)
        self.assertIn("reconciliación", order.shipping_error.lower())

    def test_reconciliation_recognizes_order_status_paid(self):
        """Pillar 2 & 3: Reconciliation properly recognizes Order.status == 'paid' (not 'payment_status')."""
        from apps.shop.shipping.reconciliation import reconcile_order_shipping
        from apps.shop.shipping.common import ShippingStatus

        order = Order.objects.create(
            user_email='paid_reconcile@msambar.com',
            status='paid',
            total_amount=600.0,
            full_name='Lucia Soto',
            street_and_number='Obregon 12',
            postal_code='83000',
            state='SO',
            shipping_status=ShippingStatus.RECONCILIATION_REQUIRED.value
        )

        with patch('apps.shop.shipping.shipments.generate_shipping_label', return_value=True) as mock_gen:
            res = reconcile_order_shipping(order, dry_run=False)
            self.assertTrue(res['reconciled'])
            mock_gen.assert_called_once()

    def test_reconciliation_dry_run_mode_produces_no_mutations(self):
        """Pillar 6: Dry-run reconciliation plans actions without mutating database or dispatching external orders."""
        from apps.shop.shipping.reconciliation import reconcile_order_shipping, reconcile_pending_shipments
        from apps.shop.shipping.common import ShippingStatus

        order = Order.objects.create(
            user_email='dryrun@msambar.com',
            status='paid',
            total_amount=700.0,
            full_name='Esteban Vega',
            street_and_number='Juarez 45',
            postal_code='83000',
            state='SO',
            shipping_status=ShippingStatus.RECONCILIATION_REQUIRED.value
        )

        # Single order dry-run
        res = reconcile_order_shipping(order, dry_run=True)
        self.assertTrue(res['dry_run'])
        self.assertIn("DRY-RUN", res['message'])

        order.refresh_from_db()
        self.assertEqual(order.shipping_status, ShippingStatus.RECONCILIATION_REQUIRED.value)
        self.assertIsNone(order.tracking_number)

        # Batch dry-run
        batch_res = reconcile_pending_shipments(dry_run=True, limit=5)
        self.assertTrue(len(batch_res) >= 1)
        self.assertTrue(any(r.get('dry_run') for r in batch_res))

    def test_auto_advance_strictly_blocked_in_production(self):
        """Pillar 6: Auto-advance is strictly rejected in production environments."""
        from apps.shop.shipping.client import SkydropxClient
        from apps.shop.shipping.polling import poll_shipment_resolution

        client_prod = SkydropxClient(environment="production")
        advance_res = client_prod.auto_advance_shipment("ship_prod_123")
        self.assertFalse(advance_res["success"])
        self.assertIn("strictly disabled in production", advance_res["error"])

        with override_settings(ENVIRONMENT="production", SKYDROPX_AUTO_ADVANCE=True):
            client = SkydropxClient(environment="sandbox")
            mock_advance = MagicMock()
            client.auto_advance_shipment = mock_advance
            client.get_shipment = MagicMock(return_value={
                "success": True,
                "data": {"attributes": {"status": "completed", "tracking_number": "TRACK-PROD-1", "label_url": "http://label.pdf"}}
            })
            poll_shipment_resolution(client, "ship_123", max_timeout=2.0, intervals=[0.1], auto_advance_sandbox=True)
            mock_advance.assert_not_called()

    def test_shipping_status_mapping_and_unknown_detection(self):
        """Pillar 4: External response codes and statuses map to internal ShippingStatus, alerting on unknown."""
        from apps.shop.shipping.common import map_skydropx_status, ShippingStatus

        # Known statuses
        s_comp, ok1 = map_skydropx_status("completed")
        self.assertTrue(ok1)
        self.assertEqual(s_comp, ShippingStatus.COMPLETED.value)

        s_deliv, ok2 = map_skydropx_status("DELIVERED")
        self.assertTrue(ok2)
        self.assertEqual(s_deliv, ShippingStatus.COMPLETED.value)

        s_fail, ok3 = map_skydropx_status("failed")
        self.assertTrue(ok3)
        self.assertEqual(s_fail, ShippingStatus.FAILED.value)

        # Unknown / Unrecognized status
        s_unk, ok_unk = map_skydropx_status("custom_carrier_mystery_code")
        self.assertFalse(ok_unk)
        self.assertEqual(s_unk, ShippingStatus.UNKNOWN.value)

    def test_shipping_event_metrics_calculation(self):
        """Pillar 5: ShippingEvent.get_metrics calculates success rates, 422 errors, and age."""
        from apps.shop.models import ShippingEvent

        ShippingEvent.objects.create(event_type="SHIPMENT_CREATED_SYNC", http_status=201)
        ShippingEvent.objects.create(event_type="SHIPMENT_ACCEPTED_202", http_status=202)
        ShippingEvent.objects.create(event_type="SHIPMENT_FAILED", http_status=422)
        ShippingEvent.objects.create(event_type="SHIPMENT_FAILED", http_status=504)

        metrics = ShippingEvent.get_metrics(hours=24)
        self.assertGreaterEqual(metrics["total_shipping_events"], 4)
        self.assertGreaterEqual(metrics["http_422_count"], 1)
        self.assertGreaterEqual(metrics["http_5xx_count"], 1)
        self.assertIn("success_rate_percent", metrics)
        self.assertIn("pending_reconciliation_orders", metrics)
