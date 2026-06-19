import logging
from django.core.mail import EmailMultiAlternatives, get_connection
from django.conf import settings

logger = logging.getLogger(__name__)

def send_failover_email(subject, html_content, text_content, recipient_list, reply_to=None):
    """
    Sends HTML and text emails with automatic failover across configured SMTP relays:
    Brevo SMTP -> Amazon SES SMTP -> Zoho/Default SMTP.
    """
    providers = []

    # 1. Brevo SMTP
    if getattr(settings, 'BREVO_EMAIL_HOST_USER', None) and getattr(settings, 'BREVO_EMAIL_HOST_PASSWORD', None):
        providers.append(("Brevo SMTP", {
            'host': settings.BREVO_EMAIL_HOST,
            'port': settings.BREVO_EMAIL_PORT,
            'username': settings.BREVO_EMAIL_HOST_USER,
            'password': settings.BREVO_EMAIL_HOST_PASSWORD,
            'use_tls': settings.BREVO_EMAIL_USE_TLS,
            'sender': settings.BREVO_DEFAULT_FROM_EMAIL
        }))

    # 2. Amazon SES
    if getattr(settings, 'SES_EMAIL_HOST_USER', None) and getattr(settings, 'SES_EMAIL_HOST_PASSWORD', None):
        providers.append(("Amazon SES", {
            'host': settings.SES_EMAIL_HOST,
            'port': settings.SES_EMAIL_PORT,
            'username': settings.SES_EMAIL_HOST_USER,
            'password': settings.SES_EMAIL_HOST_PASSWORD,
            'use_tls': settings.SES_EMAIL_USE_TLS,
            'sender': settings.SES_DEFAULT_FROM_EMAIL
        }))

    # 3. Zoho/Default SMTP
    providers.append(("Zoho/Default SMTP", None))

    last_error = None
    recipients_log = f"{len(recipient_list)} recipients" if len(recipient_list) > 5 else str(recipient_list)

    for name, config in providers:
        try:
            logger.info(f"Attempting to send email via {name} to {recipients_log}")
            
            if config is None:
                # Use default connection and default from_email
                active_conn = None
                sender = settings.DEFAULT_FROM_EMAIL
            else:
                # Use locmem backend during tests to avoid real SMTP network requests
                backend_class = 'django.core.mail.backends.locmem.EmailBackend' if getattr(settings, 'TESTING', False) else 'django.core.mail.backends.smtp.EmailBackend'
                active_conn = get_connection(
                    backend=backend_class,
                    host=config['host'],
                    port=config['port'],
                    username=config['username'],
                    password=config['password'],
                    use_tls=config['use_tls']
                )
                sender = config['sender']

            msg = EmailMultiAlternatives(
                subject,
                text_content,
                sender,
                recipient_list,
                connection=active_conn,
                reply_to=reply_to
            )
            msg.attach_alternative(html_content, "text/html")
            msg.send(fail_silently=False)
            
            logger.info(f"Successfully sent email via {name} to {recipients_log}")
            return name  # Return the name of the provider that succeeded
            
        except Exception as e:
            logger.warning(f"Failed to send email via {name}: {e}. Trying next provider...")
            last_error = e

    if last_error:
        logger.error(f"All email providers failed to send email to {recipients_log}")
        raise last_error
    return None

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
    event_slug = slugify(event.title)
    list_name = f"Compradores - {event.title}"
    marketing_list, created_list = MarketingList.objects.get_or_create(
        event=event,
        defaults={
            'name': list_name,
            'description': f"Contactos que adquirieron boletos para el evento: {event.title}",
            'slug': f"compradores-{event_slug}-{event.id}"
        }
    )

    # 3. Vincular el suscriptor a la lista de marketing
    marketing_list.subscribers.add(subscriber)
    logger.info(f"Subscriber {email} added to Marketing List: {list_name}")
