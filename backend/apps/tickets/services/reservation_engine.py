import logging
from datetime import timedelta
from django.conf import settings
from django.db import transaction, models
from django.utils import timezone
from django.core.cache import cache
import stripe

from apps.tickets.models import Ticket, Event
from apps.tickets.utils import format_seat_assignment

logger = logging.getLogger('apps.tickets')


def get_reserved_sessions(event_id=None):
    """
    Recupera todas las sesiones/boletos con status='reserved'.
    Calcula minutos transcurridos y evalúa el estatus de la sesión en Stripe si aplica.
    """
    now = timezone.now()
    qs = Ticket.objects.filter(status='reserved').select_related('event', 'seat', 'ga_zone')

    if event_id and str(event_id).isdigit():
        qs = qs.filter(event_id=int(event_id))

    qs = qs.order_by('-created_at')

    # Stripe setup
    stripe_key = getattr(settings, 'STRIPE_SECRET_KEY', '')
    stripe_available = bool(stripe_key and not any(p in stripe_key for p in ['placeholder', 'change_me', 'your_']))
    if stripe_available:
        stripe.api_key = stripe_key

    results = []
    for t in qs:
        elapsed = (now - t.created_at).total_seconds() / 60.0
        is_expired = elapsed >= 15.0

        seat_label = format_seat_assignment(t.seat) if t.seat else (
            "Meet & Greet" if t.has_mg else "General (Sin Asiento)"
        )
        zone = t.seat.section if t.seat else (t.ga_zone.name if t.ga_zone else "General")

        stripe_status = "untracked"
        sid = t.stripe_session_id or ""
        if sid.startswith('mock_') or sid.startswith('free_vip_'):
            stripe_status = "mock"
        elif sid:
            stripe_status = "pending"

        results.append({
            'id': t.id,
            'user_email': t.user_email,
            'user_phone': t.user_phone or '',
            'event_id': t.event_id,
            'event_title': t.event.title if t.event else '',
            'seat_id': t.seat_id,
            'seat_label': seat_label,
            'zone': zone,
            'created_at': t.created_at.isoformat(),
            'elapsed_minutes': round(elapsed, 1),
            'is_expired': is_expired,
            'stripe_session_id': sid,
            'stripe_status': stripe_status,
            'has_mg': t.has_mg,
        })

    return results


def release_reservations(
    ticket_ids=None,
    stripe_session_id=None,
    release_all_expired=False,
    timeout_minutes=15,
    admin_user=None
):
    """
    Motor Transaccional Atómico de Liberación de Asientos:
    1. Bloquea filas bajo select_for_update().
    2. Valida contra Stripe para prevenir cancelación de pagos completados concurrentemente.
    3. Expira la Checkout Session en Stripe vía API para impedir pagos tardíos.
    4. Cambia status a 'cancelled' y resetea el puntero seat=None para liberar la restricción unique_together.
    5. Invalida todas las claves de caché Redis correspondientes a los eventos afectados.
    """
    now = timezone.now()
    admin_name = getattr(admin_user, 'username', 'system') if admin_user else 'system'

    # Stripe setup
    stripe_key = getattr(settings, 'STRIPE_SECRET_KEY', '')
    stripe_available = bool(stripe_key and not any(p in stripe_key for p in ['placeholder', 'change_me', 'your_']))
    if stripe_available:
        stripe.api_key = stripe_key

    with transaction.atomic():
        qs = Ticket.objects.select_for_update().filter(status='reserved')

        if ticket_ids:
            clean_ids = [int(i) for i in ticket_ids if str(i).isdigit()]
            qs = qs.filter(id__in=clean_ids)
        elif stripe_session_id:
            clean_sid = str(stripe_session_id).strip()
            qs = qs.filter(stripe_session_id=clean_sid)
        elif release_all_expired:
            cutoff = now - timedelta(minutes=int(timeout_minutes))
            qs = qs.filter(created_at__lt=cutoff)
        else:
            return {
                'status': 'error',
                'error': 'Debe especificar ticket_ids, stripe_session_id o activar release_all_expired.',
                'released_count': 0,
                'released_tickets': []
            }

        tickets_list = list(qs.select_related('event', 'seat'))
        if not tickets_list:
            return {
                'status': 'success',
                'released_count': 0,
                'released_tickets': [],
                'affected_events': [],
                'message': 'No se encontraron reservaciones pendientes que coincidan con los criterios.'
            }

        released_info = []
        affected_event_ids = set()
        unique_sessions = set(t.stripe_session_id for t in tickets_list if t.stripe_session_id)

        # 1. Intentar expirar sesiones en Stripe para evitar cargos tardíos concurrentes
        if stripe_available:
            for sid in unique_sessions:
                if sid.startswith('mock_') or sid.startswith('free_vip_') or not sid.startswith('cs_'):
                    continue
                try:
                    session = stripe.checkout.Session.retrieve(sid)
                    # Si el usuario pagó justo en el milisegundo anterior, salvaguardar y no cancelar
                    if session.payment_status == 'paid' or session.status == 'complete':
                        logger.warning(
                            f"[RESERVATION/SAFETY] Sesión Stripe {sid} pagada concurrentemente. "
                            f"Marcando boletos como paid en lugar de cancelarlos."
                        )
                        for t in tickets_list:
                            if t.stripe_session_id == sid:
                                t.status = 'paid'
                                t.save(update_fields=['status'])
                        # Remover de la lista de boletos a liberar
                        tickets_list = [t for t in tickets_list if t.stripe_session_id != sid]
                        continue

                    if session.status == 'open':
                        stripe.checkout.Session.expire(sid)
                        logger.info(f"[RESERVATION/STRIPE] Stripe Session {sid} expirada exitosamente vía API.")
                except stripe.error.InvalidRequestError as inv_err:
                    logger.debug(f"[RESERVATION/STRIPE] Sesión {sid} no requirió expiración: {inv_err}")
                except Exception as stripe_err:
                    logger.warning(f"[RESERVATION/STRIPE] Error verificando/expirando sesión {sid}: {stripe_err}")

        # 2. Transición de estado y liberación de butacas
        for ticket in tickets_list:
            if ticket.status == 'paid':
                continue

            seat_display = format_seat_assignment(ticket.seat) if ticket.seat else "Sin asiento"
            event_id = ticket.event_id
            affected_event_ids.add(event_id)

            ticket_id = ticket.id
            ticket_email = ticket.user_email
            sid = ticket.stripe_session_id

            # Desvincular seat y cancelar ticket
            ticket.status = 'cancelled'
            ticket.seat = None
            ticket.save(update_fields=['status', 'seat'])

            released_info.append({
                'id': ticket_id,
                'email': ticket_email,
                'seat_label': seat_display,
                'event_id': event_id,
                'stripe_session_id': sid
            })

            logger.info(
                f"[RESERVATION/RELEASE] Ticket #{ticket_id} ({ticket_email}) liberado exitosamente por {admin_name}. "
                f"Asiento previo: '{seat_display}', StripeID: {sid}"
            )

        # 3. Purgar caché Redis / Django para todos los eventos afectados
        for eid in affected_event_ids:
            cache.delete('active_events')
            cache.delete('ms_ambar_active_events_public')
            cache.delete('ms_ambar_active_theme_global')
            cache.delete(f'event_{eid}')
            cache.delete(f'event_seats_{eid}')
            cache.delete(f'seats_event_{eid}')
            logger.info(f"[RESERVATION/CACHE_FLUSH] Claves de caché purgadas para Evento #{eid}")

    return {
        'status': 'success',
        'released_count': len(released_info),
        'released_tickets': released_info,
        'affected_events': list(affected_event_ids),
        'message': f'Se liberaron exitosamente {len(released_info)} asiento(s) reservados.'
    }
