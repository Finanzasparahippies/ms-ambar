import stripe
import json
from django.conf import settings
from django.http import HttpResponse
from django.db import transaction
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
import logging

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
        except Exception:
            return HttpResponse("Event processing in progress", status=200)

    # Handle the checkout.session.completed event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        handle_successful_payment(session)

    return HttpResponse(status=200)

from apps.tickets.utils import send_ticket_email, send_ticket_whatsapp, send_ticket_telegram

def handle_successful_payment(session):
    metadata = session.get('metadata', {})
    session_id = session.get('id')

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

        if seat_ids:
            for seat_id in seat_ids:
                seat = Seat.objects.get(id=seat_id)
                # First try to find by session_id and seat, then fallback to event and seat
                ticket = None
                if session_id:
                    ticket = Ticket.objects.filter(stripe_session_id=session_id, seat=seat).first()
                if not ticket:
                    ticket = Ticket.objects.filter(event=event, seat=seat).first()
                
                if ticket:
                    ticket.status = 'paid'
                    ticket.user_email = user_email
                    ticket.user_phone = phone
                    ticket.has_mg = has_mg
                    ticket.save()
                else:
                    ticket = Ticket.objects.create(
                        event=event,
                        seat=seat,
                        user_email=user_email,
                        user_phone=phone,
                        status='paid',
                        has_mg=has_mg,
                        stripe_session_id=session_id
                    )
                
                # Trigger delivery
                try:
                    send_ticket_email(ticket)
                    if ticket.user_phone:
                        send_ticket_whatsapp(ticket)
                except Exception as e:
                    logger.error(f"Error entregando boleto numerado: {e}")
        else:
            existing_count = Ticket.objects.filter(stripe_session_id=session_id).count() if session_id else 0
            to_create = quantity - existing_count
            for _ in range(max(0, to_create)):
                ticket = Ticket.objects.create(
                    event=event,
                    seat=None,
                    ga_zone=None,
                    user_email=user_email,
                    user_phone=phone,
                    status='paid',
                    has_mg=True,
                    stripe_session_id=session_id
                )
                
                # Trigger delivery
                try:
                    send_ticket_email(ticket)
                    if ticket.user_phone:
                        send_ticket_whatsapp(ticket)
                except Exception as e:
                    logger.error(f"Error entregando boleto general: {e}")

    # --- CASO B: COMPRA DE MERCHANDISE / TIENDA ---
    elif metadata.get('type') == 'shop_purchase':
        order_id = metadata.get('order_id')
        try:
            with transaction.atomic():
                # Bloqueamos la orden para evitar condiciones de carrera
                order = Order.objects.select_for_update().get(id=order_id)
                
                if order.status == 'pending':
                    order.status = 'paid'
                    order.stripe_session_id = session_id
                    order.save()
                    
                    # Decrementar el stock de forma segura hasta este momento
                    for item in order.items.all():
                        product = Product.objects.select_for_update().get(id=item.product.id)
                        product.stock -= item.quantity
                        product.save()
                        
                    # Enviar el correo cuando la transacción se confirme en la Base de Datos
                    transaction.on_commit(lambda: send_order_confirmation_email(order))
                    logger.info(f"Pedido #{order.id} pagado con éxito vía Webhook.")
        except Order.DoesNotExist:
            logger.error(f"Pedido con ID {order_id} no encontrado en el webhook.")
        except Exception as e:
            logger.error(f"Error procesando el pago del pedido #{order_id}: {e}", exc_info=True)

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


class ShopCheckoutView(APIView):
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        data = request.data
        email = data.get('email')
        full_name = data.get('full_name')
        address = data.get('address')
        city = data.get('city')
        country = data.get('country')
        items_data = data.get('items', [])

        if not all([email, full_name, address, city, country, items_data]):
            return Response({"error": "Todos los campos de entrega e ítems son requeridos."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate products and stock
        total_amount = 0
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

            total_amount += product.price * qty
            order_items_to_prepare.append({'product': product, 'quantity': qty, 'price': product.price})

            # Formatear el item para Stripe usando los Price IDs dinámicos que creas al guardar el modelo
            line_items.append({
                'price': product.stripe_price_id,
                'quantity': qty,
            })

        # 2. Registrar la orden en estado 'pending'
        order = Order.objects.create(
            user_email=email,
            status='pending',
            total_amount=total_amount,
            full_name=full_name,
            address=address,
            city=city,
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
        try:
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=line_items,
                mode='payment',
                success_url=settings.FRONTEND_URL + "/shop/success?session_id={CHECKOUT_SESSION_ID}",
                cancel_url=settings.FRONTEND_URL + "/shop/cart",
                customer_email=email,
                metadata={
                    'order_id': str(order.id),
                    'type': 'shop_purchase'
                }
            )
            
            # Devolvemos la URL a Next.js para que el frontend redirija al usuario
            return Response({
                "checkout_url": checkout_session.url,
                "order_id": order.id
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creando Stripe Session para la tienda: {e}")
            return Response({"error": "No se pudo procesar la pasarela de pago."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)