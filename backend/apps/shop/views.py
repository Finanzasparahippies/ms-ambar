import stripe
import json
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from apps.tickets.models import Ticket, Event, Seat
from .models import Category, Product, Order
from .serializers import CategorySerializer, ProductSerializer, OrderSerializer

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]

class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.filter(is_active=True)
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]

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
