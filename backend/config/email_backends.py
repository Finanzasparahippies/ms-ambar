from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail import get_connection
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class FailoverEmailBackend(BaseEmailBackend):
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)

    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        # Define the providers in order of fallback:
        # 1. Brevo
        # 2. Amazon SES
        # 3. Zoho (which is default SMTP connection backend)
        
        providers = []
        
        # 1. Brevo SMTP
        if getattr(settings, 'BREVO_EMAIL_HOST_USER', None) and getattr(settings, 'BREVO_EMAIL_HOST_PASSWORD', None):
            providers.append(("Brevo SMTP", {
                'host': settings.BREVO_EMAIL_HOST,
                'port': settings.BREVO_EMAIL_PORT,
                'username': settings.BREVO_EMAIL_HOST_USER,
                'password': settings.BREVO_EMAIL_HOST_PASSWORD,
                'use_tls': settings.BREVO_EMAIL_USE_TLS,
                'use_ssl': False,
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
                'use_ssl': False,
                'sender': settings.SES_DEFAULT_FROM_EMAIL
            }))
            
        # 3. Zoho (Default/Fallback SMTP settings)
        providers.append(("Zoho/Default SMTP", {
            'host': settings.EMAIL_HOST,
            'port': settings.EMAIL_PORT,
            'username': settings.EMAIL_HOST_USER,
            'password': settings.EMAIL_HOST_PASSWORD,
            'use_tls': settings.EMAIL_USE_TLS,
            'use_ssl': getattr(settings, 'EMAIL_USE_SSL', False),
            'sender': settings.DEFAULT_FROM_EMAIL
        }))

        last_error = None
        sent_count = 0
        
        for name, config in providers:
            # Skip if config is missing critical settings (e.g. no host/user/pass configured)
            if not config['username'] or not config['password']:
                logger.info(f"FailoverEmailBackend: Skipping {name} due to missing credentials.")
                continue

            try:
                logger.info(f"FailoverEmailBackend: Attempting to send {len(email_messages)} messages via {name}")
                
                # Explicitly use standard SMTP backend to avoid recursive backend lookup
                # Fallback to locmem backend during tests to prevent real SMTP connections
                backend_class = 'django.core.mail.backends.locmem.EmailBackend' if getattr(settings, 'TESTING', False) else 'django.core.mail.backends.smtp.EmailBackend'
                connection = get_connection(
                    backend=backend_class,
                    host=config['host'],
                    port=config['port'],
                    username=config['username'],
                    password=config['password'],
                    use_tls=config['use_tls'],
                    use_ssl=config['use_ssl']
                )
                
                # Temporarily override the sender to match the provider's default from_email.
                # In SES and Brevo, the envelope sender must be verified.
                original_from_emails = []
                for msg in email_messages:
                    original_from_emails.append(msg.from_email)
                    msg.from_email = config['sender']
                
                connection.open()
                sent_count = connection.send_messages(email_messages)
                connection.close()
                
                logger.info(f"FailoverEmailBackend: Successfully sent {sent_count} messages via {name}")
                return sent_count
                
            except Exception as e:
                logger.warning(f"FailoverEmailBackend: Failed to send via {name}: {e}. Trying next provider...")
                last_error = e
                # Restore original from_emails so the next provider can try
                for i, msg in enumerate(email_messages):
                    msg.from_email = original_from_emails[i]
                continue
                
        if last_error:
            if not self.fail_silently:
                raise last_error
        return 0
