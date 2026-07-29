import stripe
from django.conf import settings
from apps.tickets.models import Ticket

stripe.api_key = settings.STRIPE_SECRET_KEY

def create_ticket_checkout_session(event, seats, user_email, success_url, cancel_url, quantity=1, has_mg=False, phone='', is_seatless=False):
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
    elif is_seatless or not seats:
        # Seatless / General admission tickets
        seatless_price = getattr(event, 'seatless_ticket_price', 500)
        multiplier = getattr(event, 'price_multiplier', 1.0)
        raw_price = float(seatless_price) * float(multiplier)
        dynamic_price = event.get_dynamic_price(raw_price) if hasattr(event, 'get_dynamic_price') else raw_price
        unit_amount = int(round(dynamic_price * 100))
        price_data = {
            'currency': 'mxn',
            'unit_amount': unit_amount,
        }
        if event.stripe_product_id:
            price_data['product'] = event.stripe_product_id
        else:
            price_data['product_data'] = {
                'name': f"Boleto General - {event.title}",
                'description': f"Boleto general sin asiento para {event.title}",
            }
        line_items.append({
            'price_data': price_data,
            'quantity': int(quantity),
        })

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
                'quantity': int(quantity),
            })
    else:
        # Concert tickets
        for seat in seats:
            seat_base = float(seat.base_price) if seat.base_price and float(seat.base_price) > 0 else float(getattr(event, 'numbered_seat_base_price', 1000) or 1000)
            raw_seat_price = seat_base * float(getattr(event, 'price_multiplier', 1.0) or 1.0)
            dynamic_price = event.get_dynamic_price(raw_seat_price) if hasattr(event, 'get_dynamic_price') else raw_seat_price
            unit_amount = int(round(dynamic_price * 100))
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

    # Calculate subtotal of base ticket items and add Stripe platform service fee line item
    total_base_amount = 0.0
    for item in line_items:
        unit_price = item['price_data']['unit_amount'] / 100.0
        qty = item['quantity']
        total_base_amount += unit_price * qty

    if total_base_amount > 0:
        from apps.tickets.fees import calculate_total_with_fee
        fee_info = calculate_total_with_fee(total_base_amount)
        service_fee_amount = fee_info['service_fee']
        if service_fee_amount > 0:
            line_items.append({
                'price_data': {
                    'currency': 'mxn',
                    'unit_amount': int(round(service_fee_amount * 100)),
                    'product_data': {
                        'name': 'Cargo de servicio de plataforma (Stripe MX)',
                        'description': 'Comisión de procesamiento seguro Stripe (3.6% + $3.00 MXN)',
                    }
                },
                'quantity': 1,
            })

    session_data = {
        'payment_method_types': ['card'],
        'line_items': line_items,
        'mode': 'payment',
        'success_url': success_url + "?success=true&session_id={CHECKOUT_SESSION_ID}",        'cancel_url': cancel_url,
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
        'payment_intent_data': {
            'metadata': {
                'event_id': event.id,
                'seat_ids': ",".join([str(s.id) for s in seats]),
                'user_email': user_email,
                'phone': phone,
                'has_mg': str(has_mg),
                'quantity': str(quantity),
                'type': 'ticket_purchase'
            }
        },
    }
    
    session = stripe.checkout.Session.create(**session_data)
    return session
