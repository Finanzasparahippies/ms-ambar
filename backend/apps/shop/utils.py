import stripe
from django.conf import settings
from apps.tickets.models import Ticket

stripe.api_key = settings.STRIPE_SECRET_KEY

def create_ticket_checkout_session(event, seats, user_email, success_url, cancel_url):
    """
    Creates a Stripe Checkout Session for buying tickets.
    """
    line_items = []
    
    # Calculate total price and prepare line items
    for seat in seats:
        line_items.append({
            'price_data': {
                'currency': 'mxn',
                'unit_amount': int(seat.base_price * 100),
                'product_data': {
                    'name': f"Boleto - {event.title}",
                    'description': f"Asiento {seat.row}{seat.number} en {event.theater.name}",
                },
            },
            'quantity': 1,
        })

    session_data = {
        'payment_method_types': ['card'],
        'line_items': line_items,
        'mode': 'payment',
        'success_url': success_url + "?session_id={CHECKOUT_SESSION_ID}",
        'cancel_url': cancel_url,
        'customer_email': user_email,
        'metadata': {
            'event_id': event.id,
            'seat_ids': ",".join([str(s.id) for s in seats]),
            'user_email': user_email,
            'type': 'ticket_purchase'
        },
    }
    
    session = stripe.checkout.Session.create(**session_data)
    return session
