import logging
import time
from datetime import datetime, date
from django.core.cache import cache
from django.core.mail import EmailMultiAlternatives, get_connection
from django.conf import settings
from django.db import transaction, OperationalError
from django.utils import timezone

logger = logging.getLogger(__name__)

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    boto3 = None
    ClientError = Exception


def _get_today_utc_date() -> date:
    return timezone.now().date()


def get_brevo_sent_count(target_date: date = None) -> int:
    if not target_date:
        target_date = _get_today_utc_date()
    
    date_str = target_date.isoformat()
    cache_key = f"brevo:daily_sent_count:{date_str}"
    
    # Try getting from Redis / Cache first
    sent_count = cache.get(cache_key)
    if sent_count is not None:
        try:
            return int(sent_count)
        except (ValueError, TypeError):
            pass

    # Fallback to Database persistence
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
        logger.error(f"[WATERFALL] Error fetching Brevo quota counter from DB: {e}")
        return 0


def reserve_brevo_quota(count: int = 1) -> int:
    """
    Atomically reserves up to `count` quota units for Brevo for today UTC.
    Returns the number of units successfully reserved (0 to count).
    """
    target_date = _get_today_utc_date()
    date_str = target_date.isoformat()
    cache_key = f"brevo:daily_sent_count:{date_str}"
    
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
            
            # Update cache
            cache.set(cache_key, counter.sent_count, timeout=86400)
            return to_reserve
        except OperationalError as oe:
            logger.warning(f"[WATERFALL] OperationalError during atomic quota reservation: {oe}")
            # Fallback non-locking
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
    Releases previously reserved Brevo quota (e.g. if socket error occurred before handover).
    """
    target_date = _get_today_utc_date()
    date_str = target_date.isoformat()
    cache_key = f"brevo:daily_sent_count:{date_str}"
    
    from apps.blog.models import DailyEmailQuotaCounter
    from django.db.models import F
    
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
            logger.warning(f"[WATERFALL] Error releasing Brevo quota: {e}")


def set_brevo_quota_full() -> None:
    """
    Forces Brevo quota to 300 (exhausted) for today UTC (triggered by webhooks or limit notices).
    """
    target_date = _get_today_utc_date()
    date_str = target_date.isoformat()
    cache_key = f"brevo:daily_sent_count:{date_str}"
    
    from apps.blog.models import DailyEmailQuotaCounter
    try:
        DailyEmailQuotaCounter.objects.update_or_create(
            provider='brevo',
            date=target_date,
            defaults={'sent_count': 300}
        )
        cache.set(cache_key, 300, timeout=86400)
        logger.warning(f"[WATERFALL] [BREVO QUOTA FORCED FULL] Brevo daily quota exhausted/set to 300 for {date_str}.")
    except Exception as e:
        logger.error(f"[WATERFALL] Error forcing Brevo quota full: {e}")


def send_mail_waterfall(subject, html_content, text_content, recipient_list, reply_to=None, unsubscribe_url=None, headers=None):
    """
    Sends HTML and text emails using a Waterfall strategy with persistent Circuit Breaker:
    Phase 1: Brevo SMTP (Strictly capped at 300/day UTC with atomic pre-reservation).
    Phase 2: Amazon SES (boto3 SES v2 send_email or SMTP fallback with rate limiting).
    Phase 3: Zoho / Default SMTP (Tertiary fallback).
    """
    if not recipient_list:
        return None

    success_providers = []
    last_error = None

    for recipient in recipient_list:
        sent_successfully = False
        
        # ── PHASE 1: BREVO SMTP (Circuit Breaker Check & Pre-Reservation) ──
        brevo_enabled = bool(getattr(settings, 'BREVO_EMAIL_HOST_USER', None) and getattr(settings, 'BREVO_EMAIL_HOST_PASSWORD', None))
        if brevo_enabled:
            current_sent = get_brevo_sent_count()
            if current_sent >= 300:
                logger.info(f"[WATERFALL] [BREVO FULL] ({current_sent}/300) routing {recipient} directly to AWS SES.")
            else:
                reserved = reserve_brevo_quota(1)
                if reserved > 0:
                    current_status_count = get_brevo_sent_count()
                    try:
                        logger.info(f"[WATERFALL] [BREVO {current_status_count}/300] attempting send to {recipient}")
                        
                        backend_class = 'django.core.mail.backends.locmem.EmailBackend' if getattr(settings, 'TESTING', False) else 'django.core.mail.backends.smtp.EmailBackend'
                        brevo_conn = get_connection(
                            backend=backend_class,
                            host=settings.BREVO_EMAIL_HOST,
                            port=settings.BREVO_EMAIL_PORT,
                            username=settings.BREVO_EMAIL_HOST_USER,
                            password=settings.BREVO_EMAIL_HOST_PASSWORD,
                            use_tls=settings.BREVO_EMAIL_USE_TLS
                        )
                        msg = EmailMultiAlternatives(
                            subject, text_content, settings.BREVO_DEFAULT_FROM_EMAIL, [recipient],
                            connection=brevo_conn, reply_to=reply_to, headers=headers
                        )
                        if unsubscribe_url:
                            msg.extra_headers['List-Unsubscribe'] = f'<{unsubscribe_url}>'
                            msg.extra_headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
                        msg.attach_alternative(html_content, "text/html")
                        msg.send(fail_silently=False)
                        
                        logger.info(f"[WATERFALL] [BREVO SUCCESS] Sent to {recipient} ({current_status_count}/300)")
                        success_providers.append("Brevo SMTP")
                        sent_successfully = True
                    except Exception as e:
                        # Release reserved quota on socket/network failure before handover
                        release_brevo_quota(1)
                        logger.warning(f"[WATERFALL] [BREVO FAILED] {recipient}: {e}. Releasing quota and failing over...")
                        last_error = e

        if sent_successfully:
            continue

        # ── PHASE 2: AMAZON SES (boto3 SES v2 send_email or SMTP fallback) ──
        ses_sent = False
        ses_enabled = bool(getattr(settings, 'SES_EMAIL_HOST_USER', None) and getattr(settings, 'SES_EMAIL_HOST_PASSWORD', None))
        
        if ses_enabled:
            try:
                # Try boto3 SES v2 if configured and available
                aws_region = getattr(settings, 'AWS_REGION_NAME', 'us-east-1')
                aws_key = getattr(settings, 'AWS_ACCESS_KEY_ID', None)
                aws_secret = getattr(settings, 'AWS_SECRET_ACCESS_KEY', None)
                
                if boto3 and aws_key and aws_secret:
                    ses_client = boto3.client('sesv2', region_name=aws_region, aws_access_key_id=aws_key, aws_secret_access_key=aws_secret)
                    
                    # Rate limiting control (e.g. sleep 0.1s to respect rate limits)
                    time.sleep(0.05)
                    
                    response = ses_client.send_email(
                        FromEmailAddress=settings.SES_DEFAULT_FROM_EMAIL,
                        Destination={'ToAddresses': [recipient]},
                        Content={
                            'Simple': {
                                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                                'Body': {
                                    'Html': {'Data': html_content, 'Charset': 'UTF-8'},
                                    'Text': {'Data': text_content, 'Charset': 'UTF-8'}
                                }
                            }
                        }
                    )
                    logger.info(f"[WATERFALL] [AWS SES v2 SUCCESS] Sent to {recipient} via boto3.")
                    success_providers.append("Amazon SES")
                    ses_sent = True
                else:
                    # Fallback to SMTP SES backend
                    backend_class = 'django.core.mail.backends.locmem.EmailBackend' if getattr(settings, 'TESTING', False) else 'django.core.mail.backends.smtp.EmailBackend'
                    ses_conn = get_connection(
                        backend=backend_class,
                        host=settings.SES_EMAIL_HOST,
                        port=settings.SES_EMAIL_PORT,
                        username=settings.SES_EMAIL_HOST_USER,
                        password=settings.SES_EMAIL_HOST_PASSWORD,
                        use_tls=settings.SES_EMAIL_USE_TLS
                    )
                    msg = EmailMultiAlternatives(
                        subject, text_content, settings.SES_DEFAULT_FROM_EMAIL, [recipient],
                        connection=ses_conn, reply_to=reply_to, headers=headers
                    )
                    if unsubscribe_url:
                        msg.extra_headers['List-Unsubscribe'] = f'<{unsubscribe_url}>'
                        msg.extra_headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
                    msg.attach_alternative(html_content, "text/html")
                    msg.send(fail_silently=False)
                    
                    logger.info(f"[WATERFALL] [AWS SES SMTP SUCCESS] Sent to {recipient}")
                    success_providers.append("Amazon SES")
                    ses_sent = True
            except ClientError as ce:
                logger.warning(f"[WATERFALL] [AWS SES ClientError] {recipient}: {ce}")
                last_error = ce
            except Exception as ses_e:
                logger.warning(f"[WATERFALL] [AWS SES FAILED] {recipient}: {ses_e}")
                last_error = ses_e

        if ses_sent:
            continue

        # ── PHASE 3: ZOHO / DEFAULT SMTP (Tertiary Fallback) ──
        try:
            logger.info(f"[WATERFALL] [ZOHO/DEFAULT SMTP] Attempting fallback for {recipient}")
            backend_class = 'django.core.mail.backends.locmem.EmailBackend' if getattr(settings, 'TESTING', False) else 'django.core.mail.backends.smtp.EmailBackend'
            zoho_conn = get_connection(backend=backend_class)
            msg = EmailMultiAlternatives(
                subject, text_content, settings.DEFAULT_FROM_EMAIL, [recipient],
                connection=zoho_conn, reply_to=reply_to, headers=headers
            )
            if unsubscribe_url:
                msg.extra_headers['List-Unsubscribe'] = f'<{unsubscribe_url}>'
                msg.extra_headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
            msg.attach_alternative(html_content, "text/html")
            msg.send(fail_silently=False)
            
            logger.info(f"[WATERFALL] [ZOHO SUCCESS] Sent to {recipient}")
            success_providers.append("Zoho/Default SMTP")
        except Exception as zoho_e:
            logger.error(f"[WATERFALL] [ALL PROVIDERS FAILED] {recipient}: {zoho_e}")
            last_error = zoho_e

    if not success_providers and last_error:
        raise last_error

    return success_providers[0] if success_providers else None


def send_failover_email(subject, html_content, text_content, recipient_list, reply_to=None, unsubscribe_url=None, headers=None):
    """
    Wrapper delegating to send_mail_waterfall to maintain backward compatibility.
    """
    return send_mail_waterfall(
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        recipient_list=recipient_list,
        reply_to=reply_to,
        unsubscribe_url=unsubscribe_url,
        headers=headers
    )


def add_buyer_to_event_marketing_list(email, event):
    from apps.blog.models import NewsletterSubscriber, MarketingList
    from django.utils.text import slugify

    # 1. Obtener o crear suscriptor de newsletter
    subscriber, created = NewsletterSubscriber.objects.get_or_create(
        email=email,
        defaults={
            'is_active': True,
            'tags': 'comprador',
        }
    )

    # 2. Obtener o crear la lista de marketing asociada al evento
    event_slug = slugify(event.title)[:100]
    list_name = f"Compradores - {event.title}"[:250]
    m_slug = slugify(f"compradores-{event_slug}-{event.id}")[:200]
    marketing_list, created_list = MarketingList.objects.get_or_create(
        event=event,
        defaults={
            'name': list_name,
            'description': f"Contactos que adquirieron boletos para el evento: {event.title}",
            'slug': m_slug
        }
    )

    # 3. Vincular el suscriptor a la lista de marketing
    marketing_list.subscribers.add(subscriber)
    logger.info(f"Subscriber {email} added to Marketing List: {list_name}")
