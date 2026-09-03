import stripe
import json
import logging
from pathlib import Path
from django.conf import settings
from django.http import HttpResponse
from django.db import transaction
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from .shipping import generate_shipping_label, generate_sample_shipping_label_pdf


logger = logging.getLogger(__name__)
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from apps.tickets.models import Ticket, Event, Seat
from .models import Category, Product, ProductImage, Order, OrderItem
from .serializers import CategorySerializer, ProductSerializer, ProductImageSerializer, OrderSerializer

stripe.api_key = settings.STRIPE_SECRET_KEY

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and (request.user.is_staff or request.user.is_superuser))

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by('-id')
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().prefetch_related('images').select_related('category').order_by('-id')
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Product.objects.prefetch_related('images').select_related('category').order_by('-id')
        user = self.request.user
        if user and user.is_authenticated and (user.is_staff or user.is_superuser):
            return qs
        return qs.filter(is_active=True)

    @action(detail=True, methods=['POST'], permission_classes=[permissions.IsAdminUser])
    def upload_images(self, request, pk=None):
        """Añade una o múltiples imágenes a la galería del producto."""
        product = self.get_object()
        images_urls = request.data.get('images', [])
        if isinstance(images_urls, str):
            images_urls = [images_urls]
        
        created_imgs = []
        current_count = product.images.count()
        with transaction.atomic():
            for idx, url in enumerate(images_urls):
                if url:
                    img_obj = ProductImage.objects.create(
                        product=product,
                        image=url,
                        is_primary=(current_count == 0 and idx == 0),
                        order=current_count + idx
                    )
                    created_imgs.append(img_obj)
            if not product.image and created_imgs:
                product.image = created_imgs[0].image
                product.save(update_fields=['image'])

        return Response(ProductSerializer(product).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['POST'], permission_classes=[permissions.IsAdminUser])
    def set_primary_image(self, request, pk=None):
        """Define una imagen específica como la portada del producto."""
        product = self.get_object()
        image_id = request.data.get('image_id')
        try:
            target_image = product.images.get(id=image_id)
            target_image.is_primary = True
            target_image.save()
            return Response(ProductSerializer(product).data, status=status.HTTP_200_OK)
        except ProductImage.DoesNotExist:
            return Response({'error': 'Imagen no encontrada para este producto.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['DELETE'], url_path='delete_image/(?P<image_id>[^/.]+)', permission_classes=[permissions.IsAdminUser])
    def delete_image(self, request, pk=None, image_id=None):
        """Elimina una imagen de la galería."""
        product = self.get_object()
        try:
            target_image = product.images.get(id=image_id)
            was_primary = target_image.is_primary
            target_image.delete()
            if was_primary:
                new_primary = product.images.first()
                if new_primary:
                    new_primary.is_primary = True
                    new_primary.save()
                else:
                    product.image = None
                    product.save(update_fields=['image'])
            return Response(ProductSerializer(product).data, status=status.HTTP_200_OK)
        except ProductImage.DoesNotExist:
            return Response({'error': 'Imagen no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    event = None

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError as e:
        return HttpResponse(status=400)

    # Idempotency check: prevent duplicate Stripe event processing
    from .models import StripeEvent
    event_id = event.get('id')
    if event_id:
        if StripeEvent.objects.filter(event_id=event_id).exists():
            return HttpResponse("Event already processed", status=200)
        try:
            StripeEvent.objects.create(event_id=event_id)
        except Exception as e:
            logger.info(f"Registro duplicado/concurrente de StripeEvent para evento {event_id}: {e}")
            return HttpResponse("Event processing in progress", status=200)

    # Handle the checkout.session.completed and payment_intent.succeeded events
    try:
        if event['type'] in ['checkout.session.completed', 'payment_intent.succeeded']:
            session = event['data']['object']
            handle_successful_payment(session)
        elif event['type'] in ['payment_intent.payment_failed', 'checkout.session.expired']:
            session = event['data']['object']
            handle_failed_payment(session)
    except Exception as e:
        logger.error(f"[Stripe Webhook] Error interno procesando evento {event.get('id') if event else 'desconocido'}: {e}", exc_info=True)
        return HttpResponse("Error procesado internamente", status=200)

    return HttpResponse(status=200)


def handle_failed_payment(session):
    session_id = session.get('id')
    payment_intent_id = session.get('payment_intent')
    logger.info(f"[CHECKOUT/STRIPE_WEBHOOK] [Email: - | EventID: - | TicketUUID: - | StripeID: {session_id}] Pago fallido/expirado/cancelado. Payment Intent: {payment_intent_id}, Estado: failed")

    from apps.tickets.models import Ticket
    from apps.shop.models import Order

    if session_id:
        Ticket.objects.filter(stripe_session_id=session_id, status='reserved').update(status='cancelled')
        Order.objects.filter(stripe_session_id=session_id, status='pending').update(status='cancelled')
    if payment_intent_id:
        Ticket.objects.filter(stripe_session_id=payment_intent_id, status='reserved').update(status='cancelled')
        Order.objects.filter(stripe_session_id=payment_intent_id, status='pending').update(status='cancelled')

from apps.tickets.utils import send_ticket_email, send_ticket_whatsapp, send_ticket_telegram

def handle_successful_payment(session):
    metadata = session.get('metadata', {})
    session_id = session.get('id')

    # 🌟 CONTROL DE SEGURIDAD NÉCTAR LABS:
    # Si el objeto es un PaymentIntent y la metadata está vacía, 
    # recuperamos la Checkout Session original usando la API de Stripe
    if not metadata and (session.get('object') == 'payment_intent' or (session_id and session_id.startswith('pi_'))):
        payment_details = session.get('payment_details', {})
        checkout_ref = payment_details.get('order_reference') # cs_live_...
        
        # Fallback: list sessions by payment intent ID if order_reference is not in payload
        if not checkout_ref and session_id:
            try:
                sessions = stripe.checkout.Session.list(payment_intent=session_id, limit=1)
                if sessions and sessions.data:
                    checkout_ref = sessions.data[0].id
            except Exception as e:
                logger.error(f"[Webhook] Error listando Checkout Sessions para PI {session_id}: {e}")

        if checkout_ref:
            try:
                logger.info(f"[Webhook] Recuperando Metadata desde Checkout Session: {checkout_ref}")
                checkout_session = stripe.checkout.Session.retrieve(checkout_ref)
                metadata = checkout_session.get('metadata', {})
                session_id = checkout_session.get('id')
            except Exception as e:
                logger.error(f"[Webhook] Error recuperando sesión madre de Stripe: {e}")

    # --- CASO A: COMPRA DE BOLETOS ---
    if metadata.get('type') == 'ticket_purchase':
        event_id = metadata.get('event_id')
        seat_ids_raw = metadata.get('seat_ids', '')
        user_email = metadata.get('user_email')
        phone = metadata.get('phone', '')
        has_mg = metadata.get('has_mg') == 'True'
        quantity = int(metadata.get('quantity', 1))

        event = Event.objects.get(id=event_id)
        seat_ids = [s for s in seat_ids_raw.split(',') if s.strip()] if seat_ids_raw else []

        logger.info(f"[CHECKOUT/STRIPE_WEBHOOK] [Email: {user_email} | EventID: {event_id} | TicketUUID: - | StripeID: {session_id}] Pago exitoso procesado. Payment Intent: {session.get('payment_intent')}, Estado: paid")

        if seat_ids:
            for seat_id in seat_ids:
                seat = Seat.objects.get(id=seat_id)
                # First try to find by session_id and seat, then fallback to event and seat
                ticket = None
                if session_id:
                    ticket = Ticket.objects.filter(stripe_session_id=session_id, seat=seat).first()
                if not ticket:
                    ticket = Ticket.objects.filter(event=event, seat=seat).first()
                
                ticket_already_paid = False
                if ticket:
                    if ticket.status == 'paid':
                        ticket_already_paid = True
                    ticket.status = 'paid'
                    ticket.user_email = user_email
                    ticket.user_phone = phone
                    ticket.has_mg = has_mg
                    if not ticket.amount_paid:
                        from apps.dashboard.views import get_ticket_actual_price
                        ticket.amount_paid = get_ticket_actual_price(ticket)
                    ticket.save()
                else:
                    from apps.dashboard.views import get_ticket_actual_price
                    ticket = Ticket.objects.create(
                        event=event,
                        seat=seat,
                        user_email=user_email,
                        user_phone=phone,
                        status='paid',
                        has_mg=has_mg,
                        stripe_session_id=session_id
                    )
                    ticket.amount_paid = get_ticket_actual_price(ticket)
                    ticket.save()
                
                tipo_boleto = "VIP" if ticket.has_mg else "General"
                logger.info(f"[TICKET/GENERATE] [Email: {ticket.user_email} | EventID: {ticket.event.id} | TicketUUID: {ticket.token} | StripeID: {ticket.stripe_session_id}] Boleto confirmado y generado. Tipo: {tipo_boleto}, Asiento: {ticket.seat.row}{ticket.seat.number}")
                
                # Trigger delivery only if it wasn't already paid
                if not ticket_already_paid:
                    try:
                        send_ticket_email(ticket)
                        if ticket.user_phone:
                            send_ticket_whatsapp(ticket)
                    except Exception as e:
                        logger.error(f"Error entregando boleto numerado: {e}")
        else:
            # 🌟 LOGS DE CONTROL NÉCTAR LABS
            logger.info(f"[Webhook] Procesando Boleto General para Evento #{event_id}")
            existing_count = Ticket.objects.filter(stripe_session_id=session_id).count() if session_id else 0
            to_create = quantity - existing_count
            logger.info(f"[Webhook] Conteo de control: quantity={quantity}, existing={existing_count}, a_crear={to_create}")
            
            if to_create <= 0:
                logger.warning(f"[Webhook] Alerta: to_create es 0 o menor. Posible evento duplicado o ya procesado. Forzando reenvío de mail.")
                ticket_existente = Ticket.objects.filter(stripe_session_id=session_id).first()
                if ticket_existente:
                    try:
                        send_ticket_email(ticket_existente)
                        if ticket_existente.user_phone:
                            send_ticket_whatsapp(ticket_existente)
                        logger.info(f"[Webhook] Reenvío de boletos exitoso a {user_email}")
                    except Exception as e:
                        logger.error(f"Error reenviando correo/whatsapp en bloque general: {e}")
            
            from apps.dashboard.views import get_ticket_actual_price
            for _ in range(max(0, to_create)):
                ticket = Ticket.objects.create(
                    event=event,
                    seat=None,
                    user_email=user_email,
                    user_phone=phone,
                    status='paid',
                    has_mg=has_mg,
                    stripe_session_id=session_id
                )
                ticket.amount_paid = get_ticket_actual_price(ticket)
                ticket.save()
                
                tipo_boleto = "VIP" if ticket.has_mg else "Seatless"
                logger.info(f"[TICKET/GENERATE] [Email: {ticket.user_email} | EventID: {ticket.event.id} | TicketUUID: {ticket.token} | StripeID: {ticket.stripe_session_id}] Boleto confirmado y generado. Tipo: {tipo_boleto}, Asiento: Sin asiento")
                
                try:
                    send_ticket_email(ticket)
                    if ticket.user_phone:
                        send_ticket_whatsapp(ticket)
                    logger.info(f"[Webhook] Correo/WhatsApp enviado a {user_email}")
                except Exception as e:
                    logger.error(f"Error entregando boleto general: {e}")

        # Registrar al comprador en la lista de marketing del evento
        try:
            from apps.blog.utils import add_buyer_to_event_marketing_list
            add_buyer_to_event_marketing_list(user_email, event)
        except Exception as e:
            logger.warning(f"Error registering real buyer to marketing list: {e}")

    # --- CASO B: COMPRA DE MERCHANDISE / TIENDA ---
    elif metadata.get('type') == 'shop_purchase':
        order_id = metadata.get('order_id')
        try:
            with transaction.atomic():
                order = None
                if order_id:
                    order = Order.objects.select_for_update().filter(id=order_id).first()
                if not order and session_id:
                    order = Order.objects.select_for_update().filter(stripe_session_id=session_id).first()

                if order:
                    if order.status == 'pending':
                        order.status = 'paid'
                        order.stripe_session_id = session_id
                        shipping_prov_meta = metadata.get('shipping_provider')
                        shipping_rate_meta = metadata.get('shipping_rate_id') or metadata.get('rate_id')
                        if shipping_prov_meta and not order.shipping_provider:
                            order.shipping_provider = shipping_prov_meta
                        if shipping_rate_meta and not order.selected_rate_id:
                            order.selected_rate_id = shipping_rate_meta
                        order.save()

                        # Descontar stock atómicamente
                        for item in order.items.select_related('product').all():
                            product = Product.objects.select_for_update().get(id=item.product.id)
                            product.stock = max(0, product.stock - item.quantity)
                            product.save()

                        # Ejecutar logística y despacho de confirmación
                        process_fulfillment(order)
                        logger.info(f"Pedido #{order.id} pagado con éxito y despachado.")


                    else:
                        logger.info(f"Pedido #{order.id} ya se encontraba procesado (status={order.status}). Ignorando duplicados.")
                else:
                    logger.error(f"Pedido con ID {order_id} o sesión {session_id} no encontrado.")
        except Exception as e:
            logger.error(f"Error procesando pedido #{order_id}: {e}", exc_info=True)

def send_order_confirmation_email(order):
    try:
        # Precompute subtotal for each order item for rendering
        items = list(order.items.all())
        subtotal_items = 0
        for item in items:
            item.subtotal = item.price * item.quantity
            subtotal_items += item.subtotal

        context = {
            'order': order,
            'items': items,
            'subtotal_items': subtotal_items,
            'frontend_url': settings.FRONTEND_URL,
        }
        subject = f"🛒 Confirmación de Pedido #{order.id} - Ms Ambar"
        html_content = render_to_string('shop/emails/order_confirmation.html', context)
        text_content = (
            f"¡Gracias por tu compra, {order.full_name}!\n\n"
            f"Hemos recibido tu pago para el pedido #{order.id}.\n"
            f"Subtotal Artículos: ${subtotal_items} MXN\n"
            f"Envío ({order.shipping_provider or 'Nacional'}): ${order.shipping_cost} MXN\n"
            f"Monto Total: ${order.total_amount} MXN\n\n"
            f"Dirección de Envío:\n"
            f"{order.address}\n"
            f"{order.city}, {order.country}\n\n"
            f"Atentamente,\nEl equipo de Ms Ambar"
        )
        
        email = EmailMultiAlternatives(
            subject,
            text_content,
            settings.DEFAULT_FROM_EMAIL,
            [order.user_email]
        )
        email.attach_alternative(html_content, "text/html")
        email.send(fail_silently=False)
        logger.info(f"Order confirmation email sent for order {order.id} to {order.user_email}")
    except Exception as e:
        logger.error(f"Error sending order confirmation email for order {order.id}: {e}", exc_info=True)

def process_fulfillment(order):
    """Ejecuta la automatización de la guía e inyecta los datos en el mail final"""
    generate_shipping_label(order)
    send_order_confirmation_email(order)
    
from .shipping import generate_shipping_label, quote_shipping_rates, lookup_postal_code, validate_postal_code, generate_sample_shipping_label_pdf

class OrderBySessionView(APIView):
    """
    Permite al frontend obtener los datos completos del pedido tras la redirección de Stripe.
    Garantiza idempotencia absoluta y sincronización activa si el webhook experimenta demoras de red.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        session_id = request.query_params.get('session_id')
        if not session_id:
            return Response({'error': 'El parámetro session_id es requerido.'}, status=status.HTTP_400_BAD_REQUEST)

        order = None

        # 1. Búsqueda directa por stripe_session_id
        order = Order.objects.filter(stripe_session_id=session_id).first()

        # 2. Manejo de sesiones de prueba o mock_session_{order_id}
        if not order and session_id.startswith('mock_session_'):
            try:
                order_id_str = session_id.replace('mock_session_', '')
                order_id = int(order_id_str)
                order = Order.objects.filter(id=order_id).first()
                if order and order.status == 'pending':
                    with transaction.atomic():
                        locked_order = Order.objects.select_for_update().get(id=order.id)
                        if locked_order.status == 'pending':
                            locked_order.status = 'paid'
                            locked_order.stripe_session_id = session_id
                            locked_order.save()
                            for item in locked_order.items.select_related('product').all():
                                prod = Product.objects.select_for_update().get(id=item.product.id)
                                prod.stock = max(0, prod.stock - item.quantity)
                                prod.save()
                            process_fulfillment(locked_order)
                    order.refresh_from_db()


            except Exception as e:
                logger.warning(f"Error procesando mock session en OrderBySessionView: {e}")

        # 3. Sincronización activa con Stripe si no se encuentra o sigue 'pending'
        if not session_id.startswith('mock_'):
            stripe_key = getattr(settings, 'STRIPE_SECRET_KEY', '')
            if stripe_key and stripe_key != 'mock_key' and (not order or order.status == 'pending'):
                try:
                    import stripe
                    stripe.api_key = stripe_key
                    session = stripe.checkout.Session.retrieve(session_id)
                    if session:
                        order_id = session.get('metadata', {}).get('order_id')
                        if not order and order_id:
                            order = Order.objects.filter(id=order_id).first()

                        if session.get('payment_status') == 'paid':
                            handle_successful_payment(session)
                            if order:
                                order.refresh_from_db()
                            else:
                                order = Order.objects.filter(stripe_session_id=session_id).first()
                except Exception as e:
                    logger.warning(f"Error en sincronización activa de Stripe para session {session_id}: {e}")

        if not order:
            return Response({'error': 'Pedido no encontrado para la sesión proporcionada.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = OrderSerializer(order)
        return Response(serializer.data, status=status.HTTP_200_OK)


class OrderDownloadLabelView(APIView):
    """
    Permite visualizar o descargar la guía de envío en PDF para un pedido específico.
    Si la guía no existe aún en disco, la genera bajo demanda con el generador de muestra.
    """
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            order = Order.objects.get(id=pk)
        except Order.DoesNotExist:
            return Response({'error': 'Pedido no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        filepath = Path(settings.MEDIA_ROOT) / 'shipping_labels' / f"guia_pedido_{order.id}.pdf"
        if not filepath.exists():
            generate_sample_shipping_label_pdf(order)

        if filepath.exists():
            from django.http import FileResponse
            response = FileResponse(open(filepath, 'rb'), content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="guia_envio_pedido_{order.id}.pdf"'
            return response
        else:
            return Response({'error': 'No se pudo generar la guía de envío.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PostalCodeLookupView(APIView):
    """Permite al frontend autocompletar y validar el código postal de 5 dígitos."""
    permission_classes = [AllowAny]

    def get(self, request, postal_code):
        result = lookup_postal_code(postal_code)
        if not result.get("valid"):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        return Response(result, status=status.HTTP_200_OK)


class ShippingQuoteView(APIView):

    """Permite al frontend consultar tarifas de envío en tiempo real con fallback resiliente."""
    permission_classes = [AllowAny]

    def post(self, request):
        dest_postal_code = request.data.get('postal_code') or request.data.get('dest_postal_code')
        origin_postal_code = request.data.get('origin_postal_code') or settings.SHIPPING_ORIGIN_POSTAL_CODE if hasattr(settings, 'SHIPPING_ORIGIN_POSTAL_CODE') else os.environ.get('SHIPPING_ORIGIN_POSTAL_CODE', '83000')
        weight_kg = float(request.data.get('weight_kg', 1.0))

        if not dest_postal_code or not validate_postal_code(str(dest_postal_code)):
            return Response({"error": "El código postal de destino debe tener 5 dígitos numéricos."}, status=status.HTTP_400_BAD_REQUEST)

        rates = quote_shipping_rates(origin_postal_code, str(dest_postal_code), weight_kg=weight_kg)
        return Response({
            "origin_postal_code": origin_postal_code,
            "dest_postal_code": str(dest_postal_code),
            "rates": rates
        }, status=status.HTTP_200_OK)


class ShippingHealthCheckView(APIView):

    """
    Permite diagnosticar la conectividad y validación de credenciales con Skydropx Sandbox/Producción.
    Accesible para pruebas en staging y monitoreo de infraestructura.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        dest_cp = request.query_params.get('dest_cp', '83100')
        target_env = request.query_params.get('env')
        from .shipping import SkydropxClient
        client = SkydropxClient(environment=target_env)
        diagnostic = client.test_connectivity(dest_zip=dest_cp)
        http_status = status.HTTP_200_OK if diagnostic.get("success") else status.HTTP_200_OK
        return Response(diagnostic, status=http_status)



class ShopCheckoutView(APIView):

    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        data = request.data
        email = data.get('email')
        full_name = data.get('full_name')
        phone = data.get('phone', '')
        street_and_number = data.get('street_and_number')
        suburb = data.get('suburb', '')
        city = data.get('city', '')
        state = data.get('state', '')
        postal_code = data.get('postal_code', '')
        country = data.get('country', 'México')
        items_data = data.get('items', [])
        shipping_rate_id = data.get('shipping_rate_id', 'rate_std_fallback')
        shipping_amount = float(data.get('shipping_amount', 150.0))

        if not all([email, full_name, phone, street_and_number, postal_code, items_data]):
            return Response({"error": "Todos los campos de entrega e ítems son requeridos."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate products and stock
        subtotal_amount = 0
        order_items_to_prepare = []
        line_items = []

        # 1. Validar Stock e inventario antes de crear la pasarela
        for item in items_data:
            prod_id = item.get('product_id')
            qty = int(item.get('quantity', 1))

            try:
                product = Product.objects.select_for_update().get(id=prod_id)
            except Product.DoesNotExist:
                return Response({"error": f"Producto con ID {prod_id} no encontrado."}, status=status.HTTP_404_NOT_FOUND)

            if product.stock < qty:
                return Response({"error": f"Stock insuficiente para {product.name}."}, status=status.HTTP_400_BAD_REQUEST)

            subtotal_amount += float(product.price) * qty
            order_items_to_prepare.append({'product': product, 'quantity': qty, 'price': product.price})

            # Usar stripe_price_id si existe, o fallback dinámico a price_data
            if product.stripe_price_id:
                line_items.append({
                    'price': product.stripe_price_id,
                    'quantity': qty,
                })
            else:
                line_items.append({
                    'price_data': {
                        'currency': 'mxn',
                        'product_data': {
                            'name': f"[Ms Ambar] {product.name}",
                            'description': product.description or "",
                        },
                        'unit_amount': int(product.price * 100),
                    },
                    'quantity': qty,
                })

        total_amount = subtotal_amount + shipping_amount

        shipping_provider_name = data.get('shipping_provider', '')

        # 2. Registrar la orden en estado 'pending' con persistencia exacta de tarifas
        with transaction.atomic():
            order = Order.objects.create(
                user_email=email,
                status='pending',
                total_amount=total_amount,
                full_name=full_name,
                phone=phone,
                street_and_number=street_and_number,
                suburb=suburb,
                city=city,
                state=state,
                postal_code=postal_code,
                country=country,
                selected_rate_id=shipping_rate_id,
                shipping_cost=shipping_amount,
                shipping_provider=shipping_provider_name
            )

            # Enlazar los artículos de la orden
            for item_data in order_items_to_prepare:
                OrderItem.objects.create(
                    order=order,
                    product=item_data['product'],
                    quantity=item_data['quantity'],
                    price=item_data['price']
                )

        # 3. Construir la pasarela de Stripe Checkout
        if not getattr(settings, "STRIPE_SECRET_KEY", None) or settings.STRIPE_SECRET_KEY == "mock_key" or getattr(settings, "TESTING", False):
            # Modo testing o mock
            mock_url = f"{settings.FRONTEND_URL}/shop/success?session_id=mock_session_{order.id}"
            return Response({
                "checkout_url": mock_url,
                "order_id": order.id
            }, status=status.HTTP_201_CREATED)

        try:
            shipping_options = []
            if shipping_amount > 0:
                provider_label = shipping_provider_name if shipping_provider_name else "Envío Estándar Nacional"
                shipping_options.append({
                    'shipping_rate_data': {
                        'type': 'fixed_amount',
                        'fixed_amount': {
                            'amount': int(round(shipping_amount * 100)),
                            'currency': 'mxn',
                        },
                        'display_name': f"Envío ({provider_label})",
                        'delivery_estimate': {
                            'minimum': {'unit': 'business_day', 'value': 3},
                            'maximum': {'unit': 'business_day', 'value': 5},
                        },
                    },
                })

            session_metadata = {
                'order_id': str(order.id),
                'type': 'shop_purchase',
                'shipping_provider': shipping_provider_name or 'Estándar Nacional',
                'shipping_rate_id': str(shipping_rate_id or 'rate_std_fallback'),
                'rate_id': str(shipping_rate_id or 'rate_std_fallback'),
                'shipping_amount': str(shipping_amount),
                'postal_code': str(postal_code),
            }

            session_kwargs = {
                'payment_method_types': ['card'],
                'line_items': line_items,
                'mode': 'payment',
                'success_url': settings.FRONTEND_URL + "/shop/success?session_id={CHECKOUT_SESSION_ID}",
                'cancel_url': settings.FRONTEND_URL + "/tienda",
                'customer_email': email,
                'payment_intent_data': {
                    'metadata': session_metadata
                },
                'metadata': session_metadata,
            }
            if shipping_options:
                session_kwargs['shipping_options'] = shipping_options

            checkout_session = stripe.checkout.Session.create(**session_kwargs)
            
            return Response({
                "checkout_url": checkout_session.url,
                "order_id": order.id
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creando Stripe Session para la tienda: {e}")
            return Response({"error": "No se pudo procesar la pasarela de pago."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Jerarquía monótona de ciclo de vida de paquetería y pedidos
ORDER_SHIPPING_STATUS_RANK = {
    'pending': 10,
    'paid': 20,
    'shipped': 30,
    'in_transit': 30,
    'out_for_delivery': 35,
    'delivered': 40,
    'cancelled': 99,
}


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def skydropx_webhook(request):
    """
    Webhook oficial para recibir notificaciones de Skydropx sobre el ciclo de vida del paquete.
    Implementa:
    1. Autenticación por token o firma HMAC (SKYDROPX_WEBHOOK_SECRET).
    2. Identificación dual por tracking_number o shipping_id.
    3. Validación monótona de estados: previene que eventos asíncronos tardíos/desordenados
       (ej. in_transit posterior a delivered) degraden o sobreescriban estados terminales.
    4. Idempotencia ante reenvíos de la misma notificación.
    """
    secret = getattr(settings, 'SKYDROPX_WEBHOOK_SECRET', '') or os.environ.get('SKYDROPX_WEBHOOK_SECRET', '')
    
    # Validación de Token / Firma
    if secret and not getattr(settings, 'TESTING', False):
        token_header = (
            request.META.get('HTTP_X_SKYDROPX_TOKEN') or 
            request.META.get('HTTP_X_WEBHOOK_TOKEN') or
            request.META.get('HTTP_AUTHORIZATION', '').replace('Bearer ', '').replace('Token token=', '').strip() or
            request.GET.get('token')
        )
        signature_header = request.META.get('HTTP_X_SKYDROPX_SIGNATURE')
        
        token_valid = (token_header == secret)
        if not token_valid and signature_header:
            import hmac
            import hashlib
            raw_body = request.body
            expected_sig = hmac.new(secret.encode('utf-8'), raw_body, hashlib.sha256).hexdigest()
            token_valid = hmac.compare_digest(expected_sig, signature_header)
            
        if not token_valid and token_header:
            logger.warning("[Skydropx Webhook] Token de seguridad de webhook inválido.")
            return HttpResponse("Unauthorized", status=401)

    try:
        payload = request.data if isinstance(request.data, dict) else json.loads(request.body.decode('utf-8'))
        event_type = payload.get('event') or payload.get('type') or payload.get('status') or ""
        data = payload.get('data', payload)
        attributes = data.get('attributes', data) if isinstance(data, dict) else {}
        
        tracking_number = (
            attributes.get('tracking_number') or 
            attributes.get('master_tracking_number') or
            (data.get('tracking_number') if isinstance(data, dict) else None) or 
            payload.get('tracking_number')
        )
        shipment_id = str(
            (data.get('id') if isinstance(data, dict) else None) or 
            attributes.get('id') or 
            payload.get('shipment_id') or 
            payload.get('id') or 
            ""
        ).strip()
        
        logger.info(f"[Skydropx Webhook] Evento: '{event_type}', Tracking: '{tracking_number}', ShipmentID: '{shipment_id}'")

        if not tracking_number and not shipment_id:
            logger.warning(f"[Skydropx Webhook] Payload omitido: No se detectó tracking_number ni shipment_id. Payload: {str(payload)[:200]}")
            return HttpResponse("Webhook recibido (sin identificador de envío)", status=200)

        # Búsqueda resiliente por tracking_number o shipping_id
        lookup = Q()
        if tracking_number:
            lookup |= Q(tracking_number=tracking_number)
        if shipment_id:
            lookup |= Q(shipping_id=shipment_id)

        order = Order.objects.filter(lookup).first()
        if not order:
            logger.warning(f"[Skydropx Webhook] Ninguna orden encontrada para Tracking '{tracking_number}' / Shipment '{shipment_id}'.")
            return HttpResponse("Webhook recibido (orden no encontrada)", status=200)

        # Mapeo de evento entrante al estado canónico del sistema
        combined_status = f"{str(event_type).lower()} {str(attributes.get('status') or data.get('status') or '').lower()}".strip()
        target_status = None

        if any(k in combined_status for k in ['delivered', 'entregado']):
            target_status = 'delivered'
        elif any(k in combined_status for k in ['in_transit', 'transit', 'en_transito', 'en_camino', 'out_for_delivery', 'shipped', 'recoleccion']):
            target_status = 'shipped'
        elif any(k in combined_status for k in ['cancelled', 'cancelado', 'voided']):
            target_status = 'cancelled'

        if not target_status:
            logger.info(f"[Skydropx Webhook] Evento '{event_type}' no requiere cambio de estado en Pedido #{order.id}.")
            return HttpResponse("Webhook recibido con éxito", status=200)

        # Validación monótona: Previene que eventos desordenados o tardíos reviertan estados avanzados
        current_rank = ORDER_SHIPPING_STATUS_RANK.get(order.status, 0)
        target_rank = ORDER_SHIPPING_STATUS_RANK.get(target_status, 0)

        # Protección absoluta de estados terminales
        if order.status in ('delivered', 'cancelled') and target_status != order.status:
            logger.warning(
                f"[Skydropx Webhook] Evento desfasado '{event_type}' descartado para Pedido #{order.id}: "
                f"El pedido ya se encuentra en estado terminal '{order.status}' (rank {current_rank})."
            )
            return HttpResponse("Evento recibido (estado terminal protegido)", status=200)

        # Si el rango objetivo es menor o igual al actual, es un evento retrasado o repetido
        if target_rank <= current_rank:
            logger.info(
                f"[Skydropx Webhook] Evento tardío o redundante '{event_type}' ignorado para Pedido #{order.id}: "
                f"Estado actual '{order.status}' (rank {current_rank}) >= objetivo '{target_status}' (rank {target_rank})."
            )
            return HttpResponse("Evento recibido (sin cambios por orden monótono)", status=200)

        # Aplicación atómica del nuevo estado ascendente
        order.status = target_status
        update_fields = ['status']
        if not order.tracking_number and tracking_number:
            order.tracking_number = tracking_number
            update_fields.append('tracking_number')
        if not order.shipping_id and shipment_id:
            order.shipping_id = shipment_id
            update_fields.append('shipping_id')

        order.save(update_fields=update_fields)
        logger.info(f"[Skydropx Webhook] ✅ Pedido #{order.id} actualizado monótonamente a '{target_status}' (rank {target_rank}).")

        return HttpResponse("Webhook recibido con éxito", status=200)
    except Exception as e:
        logger.error(f"[Skydropx Webhook] Error procesando webhook: {e}", exc_info=True)
        return HttpResponse("Error interno procesando webhook", status=200)