import logging
import time
from typing import Dict, Any, Optional
from django.db import transaction, OperationalError
from django.utils import timezone
from apps.tickets.models import Ticket, TicketCheckInAudit
from apps.tickets.utils import format_seat_assignment
from apps.tickets.access.qr_crypto import verify_qr_payload

logger = logging.getLogger(__name__)


def process_ticket_checkin(
    qr_payload: str,
    scanner_device_id: str = "door-1",
    location: str = "Acceso Principal",
    operator: Any = None,
    idempotency_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Motor transaccional de escaneo y check-in atómico en puerta con blindaje de concurrencia.
    
    Flujo de ejecución:
    1. Verificación de idempotencia (idempotency_key). Si ya se procesó con éxito, devuelve
       el payload previo evitando dobles canjes o fallos por reintentos de red inestable.
    2. Validación criptográfica del payload del código QR (HMAC-SHA256 o JWT).
    3. Bloqueo de concurrencia pesimista en PostgreSQL (`select_for_update(nowait=False)`).
    4. Comprobación estricta de estatus activo ('paid' / 'ACTIVE').
    5. Detección de reuso: si ya fue escaneado, emite HTTP 409 Conflict 'ALREADY_USED'.
    6. Transición atómica a 'CHECKED_IN' / 'used', registro de auditoría y retorno de ubicación.
    """
    operator_user = operator if (operator and getattr(operator, 'is_authenticated', False)) else None
    operator_name = str(operator_user.username or operator_user.email) if operator_user else "Sistema Automatizado"

    # 1. Tolerancia a Conectividad Intermitente: Idempotencia por Llave
    if idempotency_key:
        idempotency_key = str(idempotency_key).strip()
        existing_audit = TicketCheckInAudit.objects.filter(
            idempotency_key=idempotency_key,
            status_result=TicketCheckInAudit.STATUS_SUCCESS
        ).select_related('ticket', 'ticket__event', 'ticket__seat').first()

        if existing_audit and existing_audit.response_payload:
            logger.info(
                f"[CHECKIN IDEMPOTENTE] Reintento detectado para key '{idempotency_key}' "
                f"en dispositivo '{scanner_device_id}'. Replay de confirmación previa."
            )
            replayed_payload = dict(existing_audit.response_payload)
            replayed_payload["idempotent_replay"] = True
            return {
                "success": True,
                "status_code": 200,
                "data": replayed_payload
            }

    # 2. Verificación Criptográfica del Código QR
    verification = verify_qr_payload(qr_payload)
    if not verification.get("valid"):
        error_msg = verification.get("error", "Código QR inválido o falsificado.")
        logger.warning(
            f"[CHECKIN RECHAZADO] QR Inválido desde '{scanner_device_id}' ({location}): {error_msg}"
        )
        TicketCheckInAudit.objects.create(
            ticket=None,
            scanner_device_id=scanner_device_id,
            location=location,
            operator=operator_user,
            operator_name=operator_name,
            idempotency_key=idempotency_key,
            status_result=TicketCheckInAudit.STATUS_INVALID,
            response_payload={"error": error_msg},
            notes=f"Fallo de verificación criptográfica: {error_msg} | Payload recibido: {qr_payload[:50]}..."
        )
        return {
            "success": False,
            "status_code": 400,
            "data": {
                "status": "INVALID_QR",
                "message": error_msg
            }
        }

    ticket_uuid = verification.get("ticket_uuid")

    # 3. Blindaje de Concurrencia Transaccional en Base de Datos (select_for_update)
    max_retries = 5
    for attempt in range(max_retries):
        try:
            with transaction.atomic():
                ticket = (
                    Ticket.objects.select_for_update(nowait=False)
                    .select_related('event', 'seat', 'ga_zone', 'seat__theater')
                    .filter(token=ticket_uuid)
                    .first()
                )

                if not ticket:
                    not_found_msg = "Boleto no encontrado en los registros oficiales del evento."
                    logger.warning(f"[CHECKIN RECHAZADO] Boleto UUID {ticket_uuid} no existe en DB.")
                    TicketCheckInAudit.objects.create(
                        ticket=None,
                        scanner_device_id=scanner_device_id,
                        location=location,
                        operator=operator_user,
                        operator_name=operator_name,
                        idempotency_key=idempotency_key,
                        status_result=TicketCheckInAudit.STATUS_INVALID,
                        response_payload={"error": not_found_msg, "ticket_uuid": ticket_uuid},
                        notes=f"UUID válido criptográficamente pero inexistente en base de datos: {ticket_uuid}"
                    )
                    return {
                        "success": False,
                        "status_code": 404,
                        "data": {
                            "status": "NOT_FOUND",
                            "message": not_found_msg
                        }
                    }

                # 4. Detección de Boleto Previamente Utilizado (Replay Attack / Doble Ingreso)
                if ticket.is_scanned or ticket.status in ['used', 'CHECKED_IN']:
                    scanned_iso = ticket.scanned_at.isoformat() if ticket.scanned_at else timezone.now().isoformat()
                    already_used_msg = "Boleto ya utilizado anteriormente."
                    logger.warning(
                        f"[CHECKIN CONFLICTO] Boleto #{ticket.id} ({ticket_uuid}) ya utilizado el {scanned_iso}. "
                        f"Intento duplicado en '{scanner_device_id}' ({location})."
                    )

                    conflict_payload = {
                        "status": "ALREADY_USED",
                        "checked_in_at": scanned_iso,
                        "message": already_used_msg,
                        "ticket_id": ticket.id,
                        "event": ticket.event.title if ticket.event else "",
                        "buyer": ticket.user_email
                    }

                    TicketCheckInAudit.objects.create(
                        ticket=ticket,
                        scanner_device_id=scanner_device_id,
                        location=location,
                        operator=operator_user,
                        operator_name=operator_name,
                        idempotency_key=idempotency_key,
                        status_result=TicketCheckInAudit.STATUS_ALREADY_USED,
                        response_payload=conflict_payload,
                        notes=f"Intento de doble ingreso detectado. Boleto ya utilizado a las {scanned_iso}."
                    )

                    return {
                        "success": False,
                        "status_code": 409,
                        "data": conflict_payload
                    }

                # 5. Verificación de Estatus Activo ('paid' o 'ACTIVE')
                if ticket.status not in ['paid', 'ACTIVE']:
                    invalid_status_msg = f"Este boleto no está activo para ingreso (Estatus: {ticket.status})."
                    logger.warning(f"[CHECKIN RECHAZADO] Boleto #{ticket.id} en estatus no activo: {ticket.status}")
                    error_payload = {
                        "status": "NOT_ACTIVE",
                        "message": invalid_status_msg,
                        "ticket_status": ticket.status
                    }
                    TicketCheckInAudit.objects.create(
                        ticket=ticket,
                        scanner_device_id=scanner_device_id,
                        location=location,
                        operator=operator_user,
                        operator_name=operator_name,
                        idempotency_key=idempotency_key,
                        status_result=TicketCheckInAudit.STATUS_ERROR,
                        response_payload=error_payload,
                        notes=f"Intento de canje con boleto en estado no pagado/cancelado ({ticket.status})."
                    )
                    return {
                        "success": False,
                        "status_code": 400,
                        "data": error_payload
                    }

                # 6. Transición Atómica a CHECKED_IN
                now = timezone.now()
                ticket.is_scanned = True
                ticket.scanned_at = now
                ticket.status = 'used'
                ticket.save(update_fields=['is_scanned', 'scanned_at', 'status'])

                # Ubicación física compuesta ('Fila: F · Mesa: 4 · Asiento: 13')
                if ticket.seat:
                    physical_location = format_seat_assignment(ticket.seat)
                elif ticket.ga_zone:
                    physical_location = f"Zona GA: {ticket.ga_zone.name}"
                elif ticket.event and getattr(ticket.event, 'event_type', '') == 'meet_greet':
                    physical_location = "Pase Meet & Greet Exclusivo"
                else:
                    physical_location = "Entrada General (De pie)"

                success_response = {
                    "status": "SUCCESS",
                    "message": "Acceso permitido.",
                    "physical_location": physical_location,
                    "attendee": {
                        "email": ticket.user_email,
                        "phone": ticket.user_phone or ""
                    },
                    "ticket_uuid": str(ticket.token),
                    "folio": ticket.id,
                    "event": {
                        "id": ticket.event_id,
                        "title": ticket.event.title,
                        "venue_name": ticket.event.venue_name
                    },
                    "checked_in_at": now.isoformat(),
                    "scanner_device_id": scanner_device_id,
                    "location": location,
                    "has_mg": getattr(ticket, 'has_mg', False)
                }

                # Registrar auditoría exitosa vinculando el boleto y el payload
                TicketCheckInAudit.objects.create(
                    ticket=ticket,
                    scanner_device_id=scanner_device_id,
                    location=location,
                    operator=operator_user,
                    operator_name=operator_name,
                    idempotency_key=idempotency_key,
                    status_result=TicketCheckInAudit.STATUS_SUCCESS,
                    response_payload=success_response,
                    notes=f"Ingreso validado con éxito. Asignación: {physical_location}"
                )

                logger.info(
                    f"[CHECKIN EXITOSO] Boleto #{ticket.id} ({ticket_uuid}) canjeado en '{scanner_device_id}' "
                    f"({location}) por {operator_name}. Ubicación: {physical_location}."
                )

                return {
                    "success": True,
                    "status_code": 200,
                    "data": success_response
                }

        except OperationalError as op_err:
            if attempt < max_retries - 1:
                time.sleep(0.05 * (2 ** attempt))
                continue
            logger.error(f"[CHECKIN ERROR CONCURRENCIA] Bloqueo de base de datos persistente: {op_err}")
            raise op_err
