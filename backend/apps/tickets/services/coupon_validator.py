"""
Service module for coupon validation, complimentary seat row determination,
overflow handling, concurrency shielding, and orphan seat prevention.
"""
from typing import Dict, Any, List, Optional, Tuple, Union
import logging
import re
import unicodedata
from django.db import transaction
from django.utils import timezone
from apps.tickets.models import Coupon, Event, Seat, Ticket

logger = logging.getLogger('apps.tickets')


def sanitize_row_identifier(row_str: str) -> str:
    """
    Genera un identificador de fila unívoco, normalizado y libre de caracteres especiales
    (ej. 'Fila G' -> 'g', 'Mesa 4' -> 'mesa_4', 'Zona A#1' -> 'zona_a_1').
    """
    if not row_str:
        return ''
    # Normalizar acentos y diacríticos
    norm = unicodedata.normalize('NFKD', str(row_str)).encode('ASCII', 'ignore').decode('utf-8')
    norm = norm.strip().lower()
    # Si comienza con prefijo 'fila ', removerlo para unificar
    if norm.startswith('fila '):
        norm = norm[5:].strip()
    # Reemplazar espacios y caracteres no alfanuméricos por guiones bajos
    clean = re.sub(r'[^a-z0-9]+', '_', norm).strip('_')
    return clean


def format_row_label(row_str: str) -> str:
    """
    Retorna una etiqueta de presentación limpia y profesional
    (ej. 'g' -> 'Fila G', 'mesa_4' -> 'Mesa 4', 'Fila G' -> 'Fila G').
    """
    if not row_str:
        return ''
    s = str(row_str).strip()
    low = s.lower()
    if low.startswith('mesa') or low.startswith('table'):
        num_part = re.sub(r'^(mesa|table)\s*[_#\-]?\s*', '', low).strip()
        return f"Mesa {num_part.upper() if not num_part.isdigit() else num_part}"
    if low.startswith('fila'):
        row_letter = re.sub(r'^fila\s*[_#\-]?\s*', '', low).strip()
        return f"Fila {row_letter.upper()}"
    if s.isdigit():
        return f"Fila {s}"
    return f"Fila {s.upper()}"


def normalize_row_name(row_str: str) -> str:
    """
    Normaliza el identificador de fila para matching exacto
    (ej. 'Fila G' -> 'g', 'G' -> 'g', 'Mesa 4' -> 'mesa 4').
    """
    if not row_str:
        return ''
    # Normalizar acentos
    s = unicodedata.normalize('NFKD', str(row_str)).encode('ASCII', 'ignore').decode('utf-8')
    s = s.strip().lower()
    if s.startswith('fila '):
        s = s[5:].strip()
    elif s.startswith('fila_'):
        s = s[5:].strip()
    # Normalizar mesas separadas por guión bajo a espacio
    s = re.sub(r'^mesa_(\d+)$', r'mesa \1', s)
    return s


def get_complimentary_rows_priority(event: Optional[Event] = None, coupon: Optional[Coupon] = None) -> List[str]:
    """
    Obtiene la lista priorizada de filas para cortesía desde el Cupón, el Evento o su Teatro asociado.
    """
    if coupon and coupon.complimentary_rows_priority and isinstance(coupon.complimentary_rows_priority, list) and len(coupon.complimentary_rows_priority) > 0:
        return coupon.complimentary_rows_priority

    if event:
        if event.complimentary_rows_priority and isinstance(event.complimentary_rows_priority, list) and len(event.complimentary_rows_priority) > 0:
            return event.complimentary_rows_priority

        if event.theater and event.theater.complimentary_rows_priority and isinstance(event.theater.complimentary_rows_priority, list):
            return event.theater.complimentary_rows_priority

    return []


def determine_active_complimentary_row(
    event: Event,
    coupon: Optional[Coupon] = None
) -> Tuple[Optional[str], List[str]]:
    """
    Calcula la fila activa con asientos disponibles siguiendo la lista de prioridad.
    Si la primera fila está llena (por compras o cortesías previas), desborda automáticamente
    a la siguiente fila con inventario libre (Dynamic Overflow Adjustment).
    Retorna: (active_row_name, list_of_all_allowed_rows_available)
    """
    priority_list = get_complimentary_rows_priority(event, coupon)
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
            formatted_name = format_row_label(candidate_row)
            return formatted_name, [candidate_row, formatted_name]

    # Si todas las filas prioritarias se llenaron, retornamos la última fila para que el usuario visualice
    last_row = priority_list[-1] if priority_list else None
    formatted_last = format_row_label(last_row) if last_row else None
    return formatted_last, ([last_row, formatted_last] if last_row and formatted_last else [])


def check_orphan_seats(
    event: Event,
    candidate_seat_ids: List[int],
    return_details: bool = False
) -> Union[Tuple[bool, Optional[str]], Tuple[bool, Optional[str], List[int]]]:
    """
    Regla Anti-Asiento Huérfano (Orphan Seat Prevention) en mesas compartidas o filas contiguas:
    Verifica que la selección no deje exactamente 1 asiento libre aislado en una mesa compartida.
    Si return_details=True, retorna (is_valid, error_msg, orphan_seat_ids).
    Si return_details=False, retorna (is_valid, error_msg) para compatibilidad con código existente.
    """
    empty_orphans: List[int] = []
    if not event.theater or not candidate_seat_ids:
        return (True, None, empty_orphans) if return_details else (True, None)

    candidate_set = set(candidate_seat_ids)
    seats = list(Seat.objects.filter(theater=event.theater, id__in=candidate_set))

    # Identificar las filas/mesas involucradas
    rows_involved = set(s.row for s in seats)

    # Buscar todos los asientos en esas filas/mesas
    table_seats = list(Seat.objects.filter(theater=event.theater, row__in=rows_involved))

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

    all_orphan_ids: List[int] = []

    for row_name, row_seats_list in seats_by_row.items():
        total_seats_in_table = len(row_seats_list)
        # Solo aplicar en mesas o agrupaciones compartidas (2 o más asientos)
        if total_seats_in_table < 2:
            continue

        # Asientos que quedarían libres si se efectúa esta compra
        free_seats_in_table = [
            s for s in row_seats_list
            if s.id not in occupied_in_event and s.id not in candidate_set and s.status == 'available'
        ]

        # Si queda exactamente 1 asiento libre aislado en la mesa
        if len(free_seats_in_table) == 1:
            isolated_seat = free_seats_in_table[0]
            all_orphan_ids.append(isolated_seat.id)
            norm_name = format_row_label(row_name)
            msg = f"La selección dejaría un asiento individual huérfano (Asiento #{isolated_seat.number}) en {norm_name}. Por favor selecciona toda la mesa o deja al menos 2 asientos disponibles."
            return (False, msg, all_orphan_ids) if return_details else (False, msg)

    return (True, None, empty_orphans) if return_details else (True, None)


def lock_and_validate_seats_atomic(
    event: Event,
    seat_ids: List[int],
    coupon_code: Optional[str] = None,
    user_email: Optional[str] = None
) -> Dict[str, Any]:
    """
    Blindaje de Concurrencia Transaccional:
    Ejecuta select_for_update(nowait=False) atómicamente sobre los asientos y el cupón
    para evitar race conditions o dobles reservas bajo concurrencia elevada.
    """
    with transaction.atomic():
        coupon_locked = None
        if coupon_code:
            try:
                coupon_locked = Coupon.objects.select_for_update(nowait=False).get(code__iexact=coupon_code.strip())
            except Coupon.DoesNotExist:
                return {'valid': False, 'error': 'El cupón especificado no existe.'}

            is_valid, msg = coupon_locked.is_valid_for_event(event, user_email=user_email)
            if not is_valid:
                return {'valid': False, 'error': msg}

            if coupon_locked.times_used >= coupon_locked.max_uses:
                return {'valid': False, 'error': 'El cupón ha alcanzado el límite máximo de redenciones.'}

        # Bloquear los asientos en la base de datos
        locked_seats = list(
            Seat.objects.select_for_update(nowait=False).filter(
                id__in=seat_ids,
                theater=event.theater
            )
        )

        if len(locked_seats) != len(seat_ids):
            return {'valid': False, 'error': 'Uno o más asientos no pertenecen a este recinto.'}

        # Verificar si algún asiento ya fue ocupado o reservado
        already_taken = Ticket.objects.filter(
            event=event,
            seat__in=locked_seats,
            status__in=['paid', 'reserved']
        ).exists()

        if already_taken:
            return {'valid': False, 'error': 'Uno o más asientos acaban de ser ocupados por otra orden.'}

        # Si el cupón es de cortesía con DESIGNATED_ROW, verificar pertenencia a fila activa
        if coupon_locked and coupon_locked.is_complimentary and coupon_locked.complimentary_allocation_mode == 'DESIGNATED_ROW':
            active_row_name, allowed_rows = determine_active_complimentary_row(event, coupon_locked)
            if allowed_rows:
                norm_allowed = set(normalize_row_name(r) for r in allowed_rows)
                for seat in locked_seats:
                    if normalize_row_name(seat.row) not in norm_allowed:
                        target_row_display = active_row_name or (allowed_rows[0] if allowed_rows else 'la fila autorizada')
                        return {
                            'valid': False,
                            'error': f"Este cupón de cortesía es válido exclusivamente en la {target_row_display}. Selecciona un asiento iluminado."
                        }

        # Validar regla Anti-Asiento Huérfano
        no_orphans, orphan_err = check_orphan_seats(event, seat_ids)
        if not no_orphans:
            return {'valid': False, 'error': orphan_err}

        return {
            'valid': True,
            'locked_seats': locked_seats,
            'locked_coupon': coupon_locked
        }


def validate_coupon_comprehensive(
    code: str,
    event_id: Optional[int] = None,
    email: Optional[str] = None
) -> Dict[str, Any]:
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
        has_email_restriction = bool(coupon.assigned_email) or (isinstance(coupon.allowed_emails, list) and len(coupon.allowed_emails) > 0)
        requires_email = has_email_restriction and not clean_email
        return {'valid': False, 'error': msg, 'requires_email': requires_email}

    response_data: Dict[str, Any] = {
        'valid': True,
        'code': coupon.code,
        'discount_type': coupon.discount_type,
        'discount_value': float(coupon.discount_value),
        'is_complimentary': coupon.is_complimentary,
        'requires_seat': coupon.requires_seat,
        'allowed_mode': coupon.complimentary_allocation_mode,
        'active_allowed_rows': [],
        'active_row_name': None,
        'message': 'Cupón validado correctamente.'
    }

    if coupon.discount_type == 'free_vip' or coupon.is_complimentary or float(coupon.discount_value) >= 100:
        response_data['message'] = 'Cortesía VIP activada.'

    # Si es modo DESIGNATED_ROW y hay un evento con teatro, calcular la fila activa
    if coupon.complimentary_allocation_mode == 'DESIGNATED_ROW' and event and event.theater:
        active_row, allowed_rows = determine_active_complimentary_row(event, coupon)
        response_data['active_allowed_rows'] = allowed_rows
        response_data['active_row_name'] = active_row
        if active_row:
            response_data['message'] = f"Cortesía VIP activada. Por favor selecciona tu asiento en la {active_row}."
        else:
            # Fallback si no hay filas designadas configuradas
            response_data['message'] = "Cortesía VIP activada con asignación preferencial de asientos."

    return response_data
