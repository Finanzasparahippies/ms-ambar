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


def is_seat_in_priority(seat_row_str: str, target_tier: str) -> bool:
    """
    Normaliza y verifica coincidencia flexible entre el identificador de fila/mesa
    del asiento y el target de prioridad del cupón/evento.
    Soporta:
      - 'Fila D' <-> 'D'
      - 'Mesa 4' <-> 'MESA 4'
      - 'Mesa 31' <-> '31'
      - 'Zona D' / 'Tier 2' (coincidencia de subcadena flexible)
    """
    if not seat_row_str or not target_tier:
        return False

    clean_seat = unicodedata.normalize('NFKD', str(seat_row_str)).encode('ASCII', 'ignore').decode('utf-8').strip().upper()
    clean_target = unicodedata.normalize('NFKD', str(target_tier)).encode('ASCII', 'ignore').decode('utf-8').strip().upper()

    if clean_seat == clean_target:
        return True

    # Quitar prefijos 'FILA ' o 'FILA_'
    norm_seat = re.sub(r'^FILA\s*[_#\-]?\s*', '', clean_seat).strip()
    norm_target = re.sub(r'^FILA\s*[_#\-]?\s*', '', clean_target).strip()

    if norm_seat == norm_target:
        return True

    # Quitar prefijo 'MESA ' o 'MESA_'
    mesa_seat = re.sub(r'^MESA\s*[_#\-]?\s*', '', clean_seat).strip()
    mesa_target = re.sub(r'^MESA\s*[_#\-]?\s*', '', clean_target).strip()

    if mesa_seat == mesa_target:
        return True

    if clean_seat.startswith('MESA') and norm_target.isdigit() and mesa_seat == norm_target:
        return True
    if clean_target.startswith('MESA') and norm_seat.isdigit() and mesa_target == norm_seat:
        return True

    # Subcadena bidireccional (ej. 'ZONA D' vs 'D', 'TIER 2' vs 'TIER 2')
    if len(clean_target) >= 2 and (clean_target in clean_seat or clean_seat in clean_target):
        return True

    return False


def build_spatial_virtual_rows(seats: List[Seat], tolerance_y: float = 35.0) -> List[Dict[str, Any]]:
    """
    Agrupa asientos en bandas horizontales espaciales por coordenada Y (tolerancia ±35px).
    Ordena las bandas de menor Y a mayor Y (frente/escenario hacia atrás).
    Asigna a cada banda una letra ('A', 'B', 'C', 'D'...) y recopila las mesas físicas contenidas.
    """
    if not seats:
        return []

    # Filtrar asientos con coordenadas válidas
    valid_seats = [s for s in seats if s.y is not None]
    if not valid_seats:
        return []

    sorted_seats = sorted(valid_seats, key=lambda s: (s.y, s.x))
    bands: List[List[Seat]] = []

    for s in sorted_seats:
        matched_band = None
        for b in bands:
            avg_y = sum(item.y for item in b) / len(b)
            if abs(s.y - avg_y) <= tolerance_y:
                matched_band = b
                break
        if matched_band is not None:
            matched_band.append(s)
        else:
            bands.append([s])

    bands.sort(key=lambda b: sum(item.y for item in b) / len(b))

    result: List[Dict[str, Any]] = []
    for idx, b in enumerate(bands):
        n = idx + 1
        letter = ""
        while n > 0:
            rem = (n - 1) % 26
            letter = chr(65 + rem) + letter
            n = (n - 1) // 26

        table_rows = list(dict.fromkeys(s.row for s in b if s.row))
        avg_y = sum(item.y for item in b) / len(b)

        result.append({
            'letter': letter,
            'virtual_row': f"Fila {letter}",
            'seats': b,
            'table_rows': table_rows,
            'avg_y': avg_y
        })

    return result


def format_table_group_label(table_rows: List[str], virtual_row: Optional[str] = None) -> str:
    """
    Construye una etiqueta legible y concisa para un conjunto de mesas o filas.
    Ej. ['Mesa 31', 'Mesa 32', 'Mesa 33', 'Mesa 34'] -> 'Mesas 31 a 34'
    Con virtual_row: 'Fila D (Mesas 31 a 34)'
    """
    if not table_rows:
        return virtual_row or ''

    nums = []
    for t in table_rows:
        match = re.search(r'\d+', str(t))
        if match:
            nums.append(int(match.group()))

    table_desc = ""
    if len(nums) == len(table_rows) and len(nums) > 1:
        nums.sort()
        is_consecutive = all(nums[i] == nums[i - 1] + 1 for i in range(1, len(nums)))
        if is_consecutive:
            table_desc = f"Mesas {nums[0]} a {nums[-1]}"
        else:
            table_desc = f"Mesas {', '.join(str(n) for n in nums[:4])}"
            if len(nums) > 4:
                table_desc += "..."
    elif len(table_rows) == 1:
        table_desc = format_row_label(table_rows[0])
    else:
        table_desc = ", ".join(table_rows[:4])
        if len(table_rows) > 4:
            table_desc += "..."

    if virtual_row and table_desc:
        if "mesa" in table_desc.lower():
            return f"{virtual_row} ({table_desc})"
        return f"{virtual_row} - {table_desc}"
    return virtual_row or table_desc


def determine_active_complimentary_row(
    event: Event,
    coupon: Optional[Coupon] = None
) -> Tuple[Optional[str], List[str]]:
    """
    Calcula la fila o grupo de mesas activo con asientos disponibles siguiendo la lista de prioridad.
    Soporta:
      a) Recintos tradicionales de butacas (Fila A, B, C...).
      b) Recintos tipo cabaret/mesas (Mesa 1, Mesa 2...) con matching directo o agrupamiento espacial por Y.
    Si la fila prioritaria se llena, desborda automáticamente a la siguiente (Dynamic Overflow).
    Si la prioridad configurada no existe en el layout, registra advertencia defensiva y fallbackea
    ordenadamente a la primera mesa/fila con asientos disponibles en lugar de colapsar la selección.
    Retorna: (active_row_name, list_of_all_allowed_rows_available)
    """
    priority_list = get_complimentary_rows_priority(event, coupon)
    if not event.theater:
        return None, []

    # Obtener IDs de asientos ya ocupados o reservados en este evento
    occupied_seat_ids = set(
        Ticket.objects.filter(
            event=event,
            status__in=['paid', 'reserved'],
            seat__isnull=False
        ).values_list('seat_id', flat=True)
    )

    all_seats = list(Seat.objects.filter(theater=event.theater).only('id', 'row', 'status', 'x', 'y'))
    if not all_seats:
        return None, []

    # Detectar si el teatro usa filas de letras directas o mesas
    has_letters = any(re.match(r'^(fila\s*)?[a-zA-Z]$', s.row.strip(), re.IGNORECASE) for s in all_seats if s.row)
    spatial_bands = None
    if not has_letters:
        spatial_bands = build_spatial_virtual_rows(all_seats, tolerance_y=35.0)

    # 1. Intentar matching ordenado por la lista de prioridad
    if priority_list:
        for candidate_row in priority_list:
            norm_candidate = normalize_row_name(candidate_row)

            # A) Búsqueda directa por concordancia flexible
            direct_row_seats = [
                s for s in all_seats
                if is_seat_in_priority(s.row, candidate_row) or normalize_row_name(s.row) == norm_candidate
            ]

            # B) Si no hay match directo y tenemos bandas espaciales, buscar por alias virtual (ej. candidate='D')
            band_match = None
            if not direct_row_seats and spatial_bands:
                cand_clean = re.sub(r'^FILA\s*', '', candidate_row.strip().upper())
                for band in spatial_bands:
                    if band['letter'] == cand_clean or is_seat_in_priority(band['virtual_row'], candidate_row):
                        band_match = band
                        direct_row_seats = band['seats']
                        break

            if not direct_row_seats:
                continue

            available_in_row = [
                s for s in direct_row_seats
                if s.id not in occupied_seat_ids and s.status == 'available'
            ]

            if len(available_in_row) > 0:
                allowed = set()
                allowed.add(candidate_row)
                allowed.add(format_row_label(candidate_row))
                for s in direct_row_seats:
                    if s.row:
                        allowed.add(s.row)
                        allowed.add(normalize_row_name(s.row))

                if band_match:
                    allowed.add(band_match['letter'])
                    allowed.add(band_match['virtual_row'])
                    formatted_name = format_table_group_label(band_match['table_rows'], band_match['virtual_row'])
                else:
                    unique_rows = list(dict.fromkeys(s.row for s in direct_row_seats if s.row))
                    if len(unique_rows) > 1:
                        formatted_name = format_table_group_label(unique_rows, format_row_label(candidate_row))
                    else:
                        formatted_name = format_row_label(candidate_row)

                return formatted_name, list(allowed)

    # 2. FALLBACK DEFENSIVO: Si priority_list no produjo asientos libres o no coincidió
    logger.warning(
        "[COMPLIMENTARY/FALLBACK] Event ID=%s: La prioridad %s no produjo asientos libres en el teatro '%s'. "
        "Activando fallback ordenado a la primera fila/mesa con disponibilidad.",
        event.id, priority_list, event.theater.name
    )

    if spatial_bands:
        for band in spatial_bands:
            avail = [s for s in band['seats'] if s.id not in occupied_seat_ids and s.status == 'available']
            if avail:
                allowed = set([band['letter'], band['virtual_row']])
                for s in band['seats']:
                    if s.row:
                        allowed.add(s.row)
                        allowed.add(normalize_row_name(s.row))
                formatted_name = format_table_group_label(band['table_rows'], band['virtual_row'])
                return formatted_name, list(allowed)
    else:
        seats_by_row: Dict[str, List[Seat]] = {}
        for s in all_seats:
            seats_by_row.setdefault(s.row, []).append(s)
        for r_name, r_seats in seats_by_row.items():
            avail = [s for s in r_seats if s.id not in occupied_seat_ids and s.status == 'available']
            if avail:
                formatted_name = format_row_label(r_name)
                return formatted_name, [r_name, formatted_name, normalize_row_name(r_name)]

    last_row = priority_list[-1] if priority_list else (all_seats[0].row if all_seats else None)
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
                    seat_norm = normalize_row_name(seat.row)
                    is_match = (
                        seat_norm in norm_allowed
                        or any(is_seat_in_priority(seat.row, r) for r in allowed_rows)
                    )
                    if not is_match:
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
