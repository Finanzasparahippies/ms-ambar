"""
Pricing Engine - Néctar Labs & Ms Ámbar
Motor centralizado de cálculo de precios, desglose híbrido de cortesías y tarifas de plataforma.
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from decimal import Decimal

logger = logging.getLogger('apps.tickets.pricing')


def calculate_ticket_order_pricing(
    event: Any,
    seats: Optional[List[Any]] = None,
    quantity: int = 1,
    has_mg: bool = False,
    coupon: Optional[Any] = None,
    is_seatless: bool = False,
    pass_fees_to_buyer: bool = True
) -> Dict[str, Any]:
    """
    Calcula de manera unitaria y transparente el desglose de una orden de boletos.
    Soporta compras 100% cortesía, compras regulares y compras híbridas (cortesía + boletos de pago).
    """
    from apps.tickets.fees import calculate_total_with_fee

    seats = seats or []
    is_meet_greet = getattr(event, 'event_type', '') == 'meet_greet'
    mg_unit_price = float(getattr(event, 'mg_price', 0) or 0)

    # 1. Construir lista de items base
    items: List[Dict[str, Any]] = []

    if is_meet_greet:
        qty = max(1, int(quantity))
        for idx in range(qty):
            items.append({
                'id': f'mg_{idx + 1}',
                'seat': None,
                'seat_id': None,
                'type': 'meet_greet',
                'label': f'Meet & Greet #{idx + 1}',
                'base_price': mg_unit_price,
                'has_mg': True,
                'mg_cost': 0.0,
                'discount_applied': 0.0,
                'final_price': mg_unit_price,
                'is_complimentary': False
            })
    elif is_seatless or not seats:
        qty = max(1, int(quantity))
        seatless_price = float(getattr(event, 'seatless_ticket_price', 500) or 500)
        multiplier = float(getattr(event, 'price_multiplier', 1.0) or 1.0)
        raw_price = seatless_price * multiplier
        dynamic_price = float(event.get_dynamic_price(raw_price) if hasattr(event, 'get_dynamic_price') else raw_price)
        mg_add = mg_unit_price if (has_mg and mg_unit_price > 0) else 0.0

        for idx in range(qty):
            items.append({
                'id': f'seatless_{idx + 1}',
                'seat': None,
                'seat_id': None,
                'type': 'seatless',
                'label': f'Boleto General #{idx + 1}',
                'base_price': round(dynamic_price + mg_add, 2),
                'has_mg': has_mg,
                'mg_cost': mg_add,
                'discount_applied': 0.0,
                'final_price': round(dynamic_price + mg_add, 2),
                'is_complimentary': False
            })
    else:
        event_num_price = float(getattr(event, 'numbered_ticket_price', 0) or 0)
        multiplier = float(getattr(event, 'price_multiplier', 1.0) or 1.0)
        mg_add = mg_unit_price if (has_mg and mg_unit_price > 0) else 0.0

        for seat in seats:
            seat_db_price = float(seat.base_price or 0) if seat else 0.0
            if event_num_price > 0:
                if seat_db_price > 0 and seat_db_price not in [500.0, 1000.0]:
                    seat_base = event_num_price * (seat_db_price / 1000.0)
                else:
                    seat_base = event_num_price
            elif seat_db_price > 0:
                seat_base = seat_db_price
            else:
                seat_base = 1000.0

            raw_seat_price = seat_base * multiplier
            dynamic_price = float(event.get_dynamic_price(raw_seat_price) if hasattr(event, 'get_dynamic_price') else raw_seat_price)
            unit_total = round(dynamic_price + mg_add, 2)

            seat_label = f"Asiento {seat.row}{seat.number}" if seat else "Asiento Numerado"
            items.append({
                'id': str(seat.id) if seat else f'seat_{len(items) + 1}',
                'seat_id': seat.id if seat else None,
                'type': 'seat',
                'label': seat_label,
                'base_price': unit_total,
                'has_mg': has_mg,
                'mg_cost': mg_add,
                'discount_applied': 0.0,
                'final_price': unit_total,
                'is_complimentary': False
            })

    total_seats_count = len(items)

    # 2. Aplicar descuentos de cupón
    if coupon:
        is_comp = bool(getattr(coupon, 'is_complimentary', False) or coupon.discount_type == 'free_vip')
        max_tickets = int(getattr(coupon, 'max_tickets', 1) or 1)
        allow_mixed = bool(getattr(coupon, 'allow_mixed_checkout', True))

        if is_comp:
            # Caso C: Política de Exclusividad Estricta
            if not allow_mixed and total_seats_count > max_tickets:
                error_detail = (
                    f"El cupón {coupon.code} solo cubre {max_tickets} asiento(s) de cortesía. "
                    "Para comprar boletos adicionales, por favor realiza una orden separada o retira el cupón."
                )
                logger.warning(
                    f"[PRICING/REJECTED] Cupón: {coupon.code} | Asientos: {total_seats_count} > Límite: {max_tickets} "
                    f"| allow_mixed_checkout=False"
                )
                return {
                    'success': False,
                    'error_code': 'COMPLIMENTARY_ORDER_LIMIT_EXCEEDED',
                    'error': error_detail,
                    'detail': error_detail,
                    'max_tickets': max_tickets
                }

            # Regla Canónica de Bonificación: Priorizar y bonificar el asiento de mayor valor a favor del usuario
            items.sort(key=lambda item: item['base_price'], reverse=True)

            # Aplicar 100% de descuento a las primeras `max_tickets` butacas
            for idx, item in enumerate(items):
                if idx < max_tickets:
                    item['is_complimentary'] = True
                    item['discount_applied'] = item['base_price']
                    item['final_price'] = 0.0
                else:
                    item['is_complimentary'] = False
                    item['discount_applied'] = 0.0
                    item['final_price'] = item['base_price']

        elif coupon.discount_type == 'percentage':
            pct = float(coupon.discount_value or 0)
            disc_multiplier = max(0.0, (100.0 - pct) / 100.0)
            for item in items:
                discount_val = round(item['base_price'] * (pct / 100.0), 2)
                item['discount_applied'] = discount_val
                item['final_price'] = max(0.0, round(item['base_price'] - discount_val, 2))

        elif coupon.discount_type == 'fixed':
            fixed_val = float(coupon.discount_value or 0)
            remaining_discount = fixed_val
            for item in items:
                applied = min(item['base_price'], remaining_discount)
                item['discount_applied'] = round(applied, 2)
                item['final_price'] = max(0.0, round(item['base_price'] - applied, 2))
                remaining_discount = max(0.0, remaining_discount - applied)

    # 3. Sumarizar totales
    subtotal = round(sum(item['final_price'] for item in items), 2)
    total_discount = round(sum(item['discount_applied'] for item in items), 2)
    total_base_raw = round(sum(item['base_price'] for item in items), 2)

    covered_count = sum(1 for item in items if item['is_complimentary'])
    payable_count = total_seats_count - covered_count

    # 4. Cálculo de Comisión de Pasarela (Gross-Up)
    service_fee = 0.0
    grand_total = subtotal

    if pass_fees_to_buyer and subtotal > 0:
        fee_info = calculate_total_with_fee(subtotal)
        service_fee = round(fee_info.get('service_fee', 0.0), 2)
        grand_total = round(fee_info.get('total', subtotal), 2)

    is_free_order = (grand_total == 0.0)

    # 5. Trazabilidad de Auditoría en Logs
    coupon_code_display = coupon.code if coupon else "Sin cupón"
    covered_val = round(sum(item['discount_applied'] for item in items if item['is_complimentary']), 2)
    logger.info(
        f"[PRICING] Cupón: {coupon_code_display} | Asientos: {total_seats_count} | "
        f"Cubiertos: {covered_count} (${covered_val:.2f}) | "
        f"Cobrables: {payable_count} (${subtotal:.2f}) | "
        f"Comisión: ${service_fee:.2f} | Cargo Stripe: ${grand_total:.2f} MXN"
    )

    return {
        'success': True,
        'items': items,
        'total_seats_count': total_seats_count,
        'covered_count': covered_count,
        'payable_count': payable_count,
        'total_base_raw': total_base_raw,
        'total_discount': total_discount,
        'subtotal': subtotal,
        'service_fee': service_fee,
        'grand_total': grand_total,
        'is_free_order': is_free_order,
        'is_hybrid_order': (covered_count > 0 and payable_count > 0),
        'coupon_applied': coupon.code if coupon else None
    }
