import stripe
import json
from django.conf import settings
from django.http import HttpResponse
from django.db import transaction
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
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

    # Handle the checkout.session.completed event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        handle_successful_payment(session)

    return HttpResponse(status=200)

from apps.tickets.utils import send_ticket_email, send_ticket_whatsapp, send_ticket_telegram

def handle_successful_payment(session):
    metadata = session.get('metadata', {})
    if metadata.get('type') == 'ticket_purchase':
        event_id = metadata.get('event_id')
        seat_ids = metadata.get('seat_ids', '').split(',')
        user_email = metadata.get('user_email')
        
        event = Event.objects.get(id=event_id)
        for seat_id in seat_ids:
            seat = Seat.objects.get(id=seat_id)
            # Create or update ticket
            ticket, created = Ticket.objects.get_or_create(
                event=event,
                seat=seat,
                defaults={'user_email': user_email, 'status': 'paid'}
            )
            if not created:
                ticket.status = 'paid'
                ticket.save()
            
            # Trigger delivery
            try:
                send_ticket_email(ticket)
                if ticket.user_phone:
                    send_ticket_whatsapp(ticket)
                # send_ticket_telegram(ticket) # Optional
            except Exception as e:
                print(f"Error delivering ticket: {e}")
            
            print(f"Payment confirmed and ticket delivered: {ticket.token}")


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
        subject = f"🛒 Confirmación de Pedido #{order.id} - MS AMBAR"
        html_content = render_to_string('shop/emails/order_confirmation.html', context)
        text_content = (
            f"¡Gracias por tu compra, {order.full_name}!\n\n"
            f"Hemos recibido tu pago para el pedido #{order.id}.\n"
            f"Monto Total: ${order.total_amount} MXN\n\n"
            f"Dirección de Envío:\n"
            f"{order.address}\n"
            f"{order.city}, {order.country}\n\n"
            f"Atentamente,\nEl equipo de MS AMBAR"
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
        order_items_to_create = []
        products_to_update = []

        for item in items_data:
            prod_id = item.get('product_id')
            qty = int(item.get('quantity', 1))

            try:
                product = Product.objects.select_for_update().get(id=prod_id)
            except Product.DoesNotExist:
                return Response({"error": f"Producto con ID {prod_id} no encontrado."}, status=status.HTTP_404_NOT_FOUND)

            if product.stock < qty:
                return Response({"error": f"Stock insuficiente para {product.name}. Disponibles: {product.stock}."}, status=status.HTTP_400_BAD_REQUEST)

            item_price = product.price
            total_amount += item_price * qty

            # Prepare models
            products_to_update.append((product, qty))
            order_items_to_create.append({
                'product': product,
                'quantity': qty,
                'price': item_price
            })

        # Create Order
        order = Order.objects.create(
            user_email=email,
            status='paid', # Set to paid immediately so it lands on "Pedidos Pendientes"
            total_amount=total_amount,
            full_name=full_name,
            address=address,
            city=city,
            country=country
        )

        # Create OrderItems and decrement stock
        for item_data in order_items_to_create:
            OrderItem.objects.create(
                order=order,
                product=item_data['product'],
                quantity=item_data['quantity'],
                price=item_data['price']
            )

        for product, qty in products_to_update:
            product.stock -= qty
            product.save()

        # Send confirmation email on successful transaction commit
        transaction.on_commit(lambda: send_order_confirmation_email(order))

        return Response({
            "message": "Pedido realizado exitosamente.",
            "order_id": order.id,
            "total_amount": float(total_amount),
            "status": order.status
        }, status=status.HTTP_201_CREATED)
