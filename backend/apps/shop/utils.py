import stripe
from django.conf import settings
from apps.tickets.models import Ticket

stripe.api_key = settings.STRIPE_SECRET_KEY

def create_ticket_checkout_session(event, seats, user_email, success_url, cancel_url, quantity=1, has_mg=False, phone=''):
    """
    Creates a Stripe Checkout Session for buying tickets.
    """
    line_items = []
    
    if event.event_type == 'meet_greet':
        # Pure Meet & Greet tickets
        unit_amount = int(event.mg_price * 100)
        price_data = {
            'currency': 'mxn',
            'unit_amount': unit_amount,
        }
        if event.stripe_product_id:
            price_data['product'] = event.stripe_product_id
        else:
            price_data['product_data'] = {
                'name': f"Boleto Meet & Greet - {event.title}",
                'description': f"Pase de convivencia para {event.title}",
            }
        line_items.append({
            'price_data': price_data,
            'quantity': int(quantity),
        })
    else:
        # Concert tickets
        for seat in seats:
            unit_amount = int(seat.base_price * event.price_multiplier * 100)
            price_data = {
                'currency': 'mxn',
                'unit_amount': unit_amount,
            }
            if event.stripe_product_id:
                price_data['product'] = event.stripe_product_id
            else:
                price_data['product_data'] = {
                    'name': f"Boleto - {event.title}",
                    'description': f"Asiento {seat.row}{seat.number} en {event.theater.name}" if event.theater else f"Boleto para {event.title}",
                }
            
            line_items.append({
                'price_data': price_data,
                'quantity': 1,
            })
            
        # Add Meet & Greet Upgrade line item if has_mg is True
        if has_mg and float(event.mg_price) > 0:
            mg_unit_amount = int(event.mg_price * 100)
            price_data = {
                'currency': 'mxn',
                'unit_amount': mg_unit_amount,
                'product_data': {
                    'name': f"Upgrade Meet & Greet - {event.title}",
                    'description': f"Pase exclusivo de convivencia con Ms Ambar",
                }
            }
            line_items.append({
                'price_data': price_data,
                'quantity': len(seats), # One upgrade per seat purchased
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
            'phone': phone,
            'has_mg': str(has_mg),
            'quantity': str(quantity),
            'type': 'ticket_purchase'
        },
    }
    
    session = stripe.checkout.Session.create(**session_data)
    return session
