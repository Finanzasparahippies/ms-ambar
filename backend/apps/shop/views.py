import stripe
import json
from django.conf import settings
from django.http import HttpResponse
from django.db import transaction
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
import logging
from .shipping import generate_shipping_label

logger = logging.getLogger(__name__)
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from apps.tickets.models import Ticket, Event, Seat
from .models import Category, Product, Order, OrderItem
from .serializers import CategorySerializer, ProductSerializer, OrderSerializer

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
    queryset = Product.objects.all().order_by('-id')
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user and user.is_authenticated and (user.is_staff or user.is_superuser):
            return Product.objects.all().order_by('-id')
        return Product.objects.filter(is_active=True).order_by('-id')

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
                order = Order.objects.select_for_update().get(id=order_id)
                
                if order.status == 'pending':
                    order.status = 'paid'
                    order.stripe_session_id = session_id
                    order.save()
                    
                    # Descontar stock
                    for item in order.items.all():
                        product = Product.objects.select_for_update().get(id=item.product.id)
                        product.stock -= item.quantity
                        product.save()
                        
                    # Encadenar la logística y el correo fuera del bloqueo de la base de datos
                    transaction.on_commit(lambda: process_fulfillment(order))
                    logger.info(f"Pedido #{order.id} pagado con éxito.")
        except Order.DoesNotExist:
            logger.error(f"Pedido con ID {order_id} no encontrado.")
        except Exception as e:
            logger.error(f"Error procesando pedido #{order_id}: {e}", exc_info=True)

def send_order_confirmation_email(order):
    try:
        # Precompute subtotal for each order item for rendering
        items = list(order.items.all())
        for item in items:
            item.subtotal = item.price * item.quantity

        context = {
            'order': order,
            'items': items,
            'frontend_url': settings.FRONTEND_URL,
        }
        subject = f"🛒 Confirmación de Pedido #{order.id} - Ms Ambar"
        html_content = render_to_string('shop/emails/order_confirmation.html', context)
        text_content = (
            f"¡Gracias por tu compra, {order.full_name}!\n\n"
            f"Hemos recibido tu pago para el pedido #{order.id}.\n"
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
    
from .shipping import generate_shipping_label, quote_shipping_rates, lookup_postal_code, validate_postal_code

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

        # 2. Registrar la orden en estado 'pending'
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
            country=country
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
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=line_items,
                mode='payment',
                success_url=settings.FRONTEND_URL + "/shop/success?session_id={CHECKOUT_SESSION_ID}",
                cancel_url=settings.FRONTEND_URL + "/tienda",
                customer_email=email,
                payment_intent_data={
                    'metadata': {
                        'order_id': str(order.id),
                        'type': 'shop_purchase'
                    }
                },
                metadata={
                    'order_id': str(order.id),
                    'type': 'shop_purchase'
                }
            )
            
            return Response({
                "checkout_url": checkout_session.url,
                "order_id": order.id
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creando Stripe Session para la tienda: {e}")
            return Response({"error": "No se pudo procesar la pasarela de pago."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)