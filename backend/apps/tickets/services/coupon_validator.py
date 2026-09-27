"""
Service module for coupon validation, complimentary seat row determination,
overflow handling, and orphan seat prevention.
"""
from typing import Dict, Any, List, Optional, Tuple
import logging
from django.utils import timezone
from apps.tickets.models import Coupon, Event, Seat, Ticket

logger = logging.getLogger('apps.tickets')


def normalize_row_name(row_str: str) -> str:
    """
    Normaliza el identificador de fila (ej. 'Fila G' -> 'g', 'G' -> 'g', 'Mesa 4' -> 'mesa 4').
    """
    if not row_str:
        return ''
    s = str(row_str).strip().lower()
    if s.startswith('fila '):
        s = s[5:].strip()
    return s


def get_complimentary_rows_priority(event: Event) -> List[str]:
    """
    Obtiene la lista priorizada de filas para cortesía desde el Evento o su Teatro asociado.
    """
    if event.complimentary_rows_priority and isinstance(event.complimentary_rows_priority, list) and len(event.complimentary_rows_priority) > 0:
        return event.complimentary_rows_priority

    if event.theater and event.theater.complimentary_rows_priority and isinstance(event.theater.complimentary_rows_priority, list):
        return event.theater.complimentary_rows_priority

    return []


def determine_active_complimentary_row(event: Event) -> Tuple[Optional[str], List[str]]:
    """
    Calcula la fila activa con asientos disponibles siguiendo la lista de prioridad.
    Si la primera fila está llena, desborda automáticamente a la siguiente fila de la lista.
    Retorna: (active_row_name, list_of_all_allowed_rows_available)
    """
    priority_list = get_complimentary_rows_priority(event)
    if not priority_list or not event.theater:
        return None, []

    # Obtener IDs de asientos ya ocupados o reservados en este evento
    occupied_seat_ids = set(
        Ticket.objects.filter(
            event=event,
            status__in=['paid', 'reserved'],
            seat__isnull=False
        ).values_list('seat_id', flat=True)
    )

    all_seats = Seat.objects.filter(theater=event.theater).only('id', 'row', 'status')

    for candidate_row in priority_list:
        norm_candidate = normalize_row_name(candidate_row)
        # Buscar asientos en esta fila
        row_seats = [s for s in all_seats if normalize_row_name(s.row) == norm_candidate]
        if not row_seats:
            continue

        available_in_row = [
            s for s in row_seats
            if s.id not in occupied_seat_ids and s.status == 'available'
        ]

        if len(available_in_row) > 0:
            return candidate_row, [candidate_row]

    # Si todas las filas prioritarias se llenaron, retornamos la última fila para que el usuario visualice
    last_row = priority_list[-1] if priority_list else None
    return last_row, ([last_row] if last_row else [])


def check_orphan_seats(event: Event, candidate_seat_ids: List[int]) -> Tuple[bool, Optional[str]]:
    """
    Regla Anti-Asiento Huérfano (Orphan Seat Prevention) en mesas compartidas:
    Verifica que la selección no deje exactamente 1 asiento libre aislado en una mesa compartida.
    """
    if not event.theater or not candidate_seat_ids:
        return True, None

    candidate_set = set(candidate_seat_ids)
    seats = Seat.objects.filter(theater=event.theater, id__in=candidate_set)

    # Identificar las filas/mesas involucradas
    rows_involved = set(s.row for s in seats)

    # Buscar todos los asientos en esas filas/mesas
    table_seats = Seat.objects.filter(theater=event.theater, row__in=rows_involved)

    # Asientos ocupados en el evento
    occupied_in_event = set(
        Ticket.objects.filter(
            event=event,
            status__in=['paid', 'reserved'],
            seat__isnull=False
        ).values_list('seat_id', flat=True)
    )

    # Agrupar por fila/mesa
    seats_by_row: Dict[str, List[Seat]] = {}
    for s in table_seats:
        seats_by_row.setdefault(s.row, []).append(s)

    for row_name, row_seats_list in seats_by_row.items():
        total_seats_in_table = len(row_seats_list)
        # Solo aplicar en mesas compartidas (2 o más asientos)
        if total_seats_in_table < 2:
            continue

        # Asientos que quedarían libres si se efectúa esta compra
        remaining_free_count = 0
        for s in row_seats_list:
            if s.id not in occupied_in_event and s.id not in candidate_set and s.status == 'available':
                remaining_free_count += 1

        # Si queda exactamente 1 asiento libre aislado en la mesa
        if remaining_free_count == 1:
            norm_name = row_name if row_name.lower().startswith('mesa') or row_name.lower().startswith('fila') else f"Mesa {row_name}"
            return False, f"La selección dejaría un asiento individual huérfano en {norm_name}. Por favor selecciona toda la mesa o deja al menos 2 asientos disponibles."

    return True, None


def validate_coupon_comprehensive(code: str, event_id: Optional[int] = None, email: Optional[str] = None) -> Dict[str, Any]:
    """
    Validador integral para cupones con soporte para cortesías proactivas y asignación de filas.
    """
    clean_code = (code or '').strip()
    clean_email = (email or '').strip()

    if not clean_code:
        return {'valid': False, 'error': 'Debes proporcionar un código de cupón.'}

    try:
        coupon = Coupon.objects.get(code__iexact=clean_code)
    except Coupon.DoesNotExist:
        return {'valid': False, 'error': 'El código de cupón ingresado no existe o no es válido.'}

    event = None
    if event_id:
        try:
            event = Event.objects.get(id=event_id)
        except Event.DoesNotExist:
            return {'valid': False, 'error': 'El evento especificado no existe.'}

    # Validar condiciones de base
    is_valid, msg = coupon.is_valid_for_event(event, user_email=clean_email or None)
    if not is_valid:
        return {'valid': False, 'error': msg}

    response_data: Dict[str, Any] = {
        'valid': True,
        'code': coupon.code,
        'discount_type': coupon.discount_type,
        'discount_value': float(coupon.discount_value),
        'assigned_email': coupon.assigned_email,
        'is_complimentary': coupon.is_complimentary,
        'requires_seat': coupon.requires_seat,
        'allowed_mode': coupon.complimentary_allocation_mode,
        'active_allowed_rows': [],
        'message': 'Cupón validado correctamente.'
    }

    if coupon.discount_type == 'free_vip' or coupon.is_complimentary or float(coupon.discount_value) >= 100:
        response_data['message'] = 'Cortesía VIP activada.'

    # Si es modo DESIGNATED_ROW y hay un evento con teatro, calcular la fila activa
    if coupon.complimentary_allocation_mode == 'DESIGNATED_ROW' and event and event.theater:
        active_row, allowed_rows = determine_active_complimentary_row(event)
        response_data['active_allowed_rows'] = allowed_rows
        if active_row:
            response_data['message'] = f"Cortesía VIP activada. Por favor selecciona tu asiento en la {active_row}."
        else:
            # Fallback si no hay filas designadas configuradas
            response_data['message'] = "Cortesía VIP activada con asignación preferencial de asientos."

    return response_data
