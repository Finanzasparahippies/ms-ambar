"""
Motor de Despacho en Cascada y Control de Cuotas con Circuit-Breaker para Nectar Labs (ms-ambar).
Garantiza idempotencia, rotación UTC estricta a las 00:00:00 UTC y desacoplamiento asíncrono.
"""

import logging
import threading
from datetime import datetime, date, timezone
from django.core.cache import cache
from django.conf import settings
from django.db import transaction, OperationalError, models

logger = logging.getLogger(__name__)


def get_today_utc_date() -> date:
    """Retorna la fecha UTC canónica (00:00:00 UTC) alineada con el ciclo de facturación de Brevo."""
    return datetime.now(timezone.utc).date()


def get_brevo_utc_date_str(target_date: date = None) -> str:
    """Retorna la clave de fecha YYYY-MM-DD en UTC estricto."""
    if not target_date:
        target_date = get_today_utc_date()
    return target_date.strftime('%Y-%m-%d')


def get_brevo_quota_cache_key(target_date: date = None) -> str:
    return f"brevo:daily_sent_count:{get_brevo_utc_date_str(target_date)}"


def get_brevo_sent_count(target_date: date = None) -> int:
    """
    Obtiene el conteo acumulado de correos enviados vía Brevo hoy UTC.
    Consulta primero Redis y luego la base de datos persistente.
    """
    if not target_date:
        target_date = get_today_utc_date()

    cache_key = get_brevo_quota_cache_key(target_date)
    sent_count = cache.get(cache_key)
    if sent_count is not None:
        try:
            return int(sent_count)
        except (ValueError, TypeError):
            pass

    from apps.blog.models import DailyEmailQuotaCounter
    try:
        counter, created = DailyEmailQuotaCounter.objects.get_or_create(
            provider='brevo',
            date=target_date,
            defaults={'sent_count': 0}
        )
        sent_count = counter.sent_count
        cache.set(cache_key, sent_count, timeout=86400)
        return sent_count
    except Exception as e:
        logger.error(f"[WATERFALL] Error al obtener contador de cuota Brevo de BD: {e}")
        return 0


def reserve_brevo_quota(count: int = 1) -> int:
    """
    Reserva atómicamente hasta `count` unidades de cuota para Brevo hoy UTC (Límite 300).
    Retorna el número de unidades reservadas exitosamente (0 a count).
    """
    target_date = get_today_utc_date()
    cache_key = get_brevo_quota_cache_key(target_date)

    from apps.blog.models import DailyEmailQuotaCounter

    with transaction.atomic():
        try:
            counter, created = DailyEmailQuotaCounter.objects.select_for_update().get_or_create(
                provider='brevo',
                date=target_date,
                defaults={'sent_count': 0}
            )
            current = counter.sent_count
            remaining = max(0, 300 - current)
            if remaining <= 0:
                cache.set(cache_key, 300, timeout=86400)
                return 0

            to_reserve = min(count, remaining)
            counter.sent_count = current + to_reserve
            counter.save(update_fields=['sent_count', 'updated_at'])

            cache.set(cache_key, counter.sent_count, timeout=86400)
            return to_reserve
        except OperationalError as oe:
            logger.warning(f"[WATERFALL] OperationalError durante reserva atómica de cuota: {oe}")
            current = get_brevo_sent_count(target_date)
            remaining = max(0, 300 - current)
            to_reserve = min(count, remaining)
            if to_reserve > 0:
                DailyEmailQuotaCounter.objects.filter(provider='brevo', date=target_date).update(
                    sent_count=models.F('sent_count') + to_reserve
                )
                cache.set(cache_key, current + to_reserve, timeout=86400)
            return to_reserve


def release_brevo_quota(count: int = 1) -> None:
    """
    Libera cuota reservada de Brevo en caso de fallo de socket/red previo al envío.
    """
    target_date = get_today_utc_date()
    cache_key = get_brevo_quota_cache_key(target_date)

    from apps.blog.models import DailyEmailQuotaCounter

    with transaction.atomic():
        try:
            counter = DailyEmailQuotaCounter.objects.select_for_update().filter(
                provider='brevo', date=target_date
            ).first()
            if counter:
                counter.sent_count = max(0, counter.sent_count - count)
                counter.save(update_fields=['sent_count', 'updated_at'])
                cache.set(cache_key, counter.sent_count, timeout=86400)
        except Exception as e:
            logger.warning(f"[WATERFALL] Error al liberar cuota de Brevo: {e}")


def set_brevo_quota_full() -> None:
    """
    Fuerza la cuota diaria de Brevo a 300 (agotada) hoy UTC ante alertas de webhook o rechazos de límite.
    """
    target_date = get_today_utc_date()
    cache_key = get_brevo_quota_cache_key(target_date)

    from apps.blog.models import DailyEmailQuotaCounter
    try:
        DailyEmailQuotaCounter.objects.update_or_create(
            provider='brevo',
            date=target_date,
            defaults={'sent_count': 300}
        )
        cache.set(cache_key, 300, timeout=86400)
        logger.warning(f"[WATERFALL] [BREVO QUOTA FORCED FULL] Cuota diaria de Brevo fijada a 300 para {get_brevo_utc_date_str(target_date)}.")
    except Exception as e:
        logger.error(f"[WATERFALL] Error al forzar cuota de Brevo a 300: {e}")


def is_brevo_webhook_event_duplicate(event_id: str, ttl_seconds: int = 86400) -> bool:
    """
    Verifica idempotencia del webhook de Brevo mediante SETNX atómico en Redis.
    Retorna True si el evento ya fue procesado en las últimas 24 horas.
    """
    if not event_id:
        return False
    cache_key = f"brevo:event:{event_id}"
    # cache.add equivale a SETNX (retorna True solo si la clave no existía)
    is_new = cache.add(cache_key, 1, timeout=ttl_seconds)
    return not is_new


def dispatch_email_async(email_message) -> threading.Thread:
    """
    Despacha un objeto EmailMultiAlternatives / EmailMessage en segundo plano no bloqueante.
    Protege los endpoints transaccionales contra latencias de red en la cascada.
    """
    def _send():
        try:
            email_message.send(fail_silently=False)
        except Exception as e:
            recipients = getattr(email_message, 'to', [])
            logger.critical(f"[ASYNC EMAIL FAILURE] Error irrecuperable despachando a {recipients}: {e}", exc_info=True)

    thread = threading.Thread(target=_send, daemon=True)
    thread.start()
    return thread
