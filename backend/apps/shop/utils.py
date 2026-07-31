import stripe
from django.conf import settings
from apps.tickets.models import Ticket

stripe.api_key = settings.STRIPE_SECRET_KEY

def create_ticket_checkout_session(event, seats, user_email, success_url, cancel_url, quantity=1, has_mg=False, phone='', is_seatless=False, coupon=None):
    """
    Creates a Stripe Checkout Session for buying tickets with optional coupon discounts.
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
            event_num_price = float(getattr(event, 'numbered_ticket_price', 0) or 0)
            seat_db_price = float(seat.base_price or 0) if seat else 0

            if event_num_price > 0:
                if seat_db_price > 0 and seat_db_price not in [500.0, 1000.0]:
                    seat_base = event_num_price * (seat_db_price / 1000.0)
                else:
                    seat_base = event_num_price
            elif seat_db_price > 0:
                seat_base = seat_db_price
            else:
                seat_base = 1000.0
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

    # --- Aplicar descuento de Cupón a los line_items si existe ---
    if coupon:
        raw_total = sum((item['price_data']['unit_amount'] / 100.0) * item['quantity'] for item in line_items)
        disc_multiplier = 1.0
        if coupon.discount_type == 'percentage':
            pct = float(coupon.discount_value or 0)
            disc_multiplier = max(0.0, (100.0 - pct) / 100.0)
        elif coupon.discount_type == 'fixed':
            fixed_val = float(coupon.discount_value or 0)
            if raw_total > 0:
                disc_multiplier = max(0.0, raw_total - fixed_val) / raw_total
            else:
                disc_multiplier = 0.0
        elif coupon.discount_type == 'free_vip':
            disc_multiplier = 0.0

        for item in line_items:
            orig_cents = item['price_data']['unit_amount']
            new_cents = max(0, int(round(orig_cents * disc_multiplier)))
            item['price_data']['unit_amount'] = new_cents
            if 'product_data' in item['price_data']:
                item['price_data']['product_data']['name'] += f" (Cupón {coupon.code})"

    # Calculate subtotal of base ticket items and add Stripe platform service fee line item
    total_base_amount = 0.0
    for item in line_items:
        unit_price = item['price_data']['unit_amount'] / 100.0
        qty = item['quantity']
        total_base_amount += unit_price * qty

    pass_fees_to_buyer = True
    try:
        from apps.tickets.models import SiteSettings
        site_settings = SiteSettings.get()
        pass_fees_to_buyer = getattr(site_settings, 'pass_fees_to_buyer', True)
    except Exception:
        pass

    service_fee_amount = 0.0
    fee_info = {'service_fee': 0.0, 'total': total_base_amount}

    if pass_fees_to_buyer and total_base_amount > 0:
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

    import logging
    logger = logging.getLogger('apps.shop')
    logger.info(f"[StripeCheckout Debug] Event ID={event.id} ({event.title}): total_base_amount=${total_base_amount} MXN, service_fee=${service_fee_amount} MXN, grand_total=${fee_info['total'] if total_base_amount > 0 else 0} MXN, line_items_count={len(line_items)}")

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
