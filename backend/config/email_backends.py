import logging
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail import get_connection
from django.conf import settings
from config.email_waterfall import (
    get_brevo_sent_count,
    reserve_brevo_quota,
    release_brevo_quota,
)

logger = logging.getLogger(__name__)

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    boto3 = None
    ClientError = Exception


class FailoverEmailBackend(BaseEmailBackend):
    """
    Motor de envío en cascada resiliente para ms-ambar:
    1. Brevo SMTP: Limitado atómicamente a 300 correos/día UTC con circuit-breaker.
    2. Amazon SES: Vía boto3 SESv2 con serialización Raw MIME RFC 822 (QR inline y PDFs intactos)
       o fallback a SES SMTP con timeout estricto.
    3. Zoho / Default SMTP: Fallback terciario de última instancia.
    """

    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)

    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        sent_count = 0
        last_error = None

        backend_class = (
            'django.core.mail.backends.locmem.EmailBackend'
            if getattr(settings, 'TESTING', False)
            else 'django.core.mail.backends.smtp.EmailBackend'
        )

        for msg in email_messages:
            sent_this_msg = False
            original_from = msg.from_email
            recipient_label = getattr(msg, 'to', ['destinatario'])

            # ─────────────────────────────────────────────────────────────
            # ESCALÓN 1: BREVO SMTP (Circuit Breaker a 300 envíos/día UTC)
            # ─────────────────────────────────────────────────────────────
            brevo_user = getattr(settings, 'BREVO_EMAIL_HOST_USER', None)
            brevo_pass = getattr(settings, 'BREVO_EMAIL_HOST_PASSWORD', None)

            if brevo_user and brevo_pass:
                current_quota = get_brevo_sent_count()
                if current_quota >= 300:
                    logger.info(f"[WATERFALL] [BREVO FULL] ({current_quota}/300) Enrutando {recipient_label} directamente a AWS SES.")
                else:
                    reserved = reserve_brevo_quota(1)
                    if reserved > 0:
                        try:
                            status_count = get_brevo_sent_count()
                            logger.info(f"[WATERFALL] [BREVO {status_count}/300] Intentando despacho a {recipient_label}")

                            conn = get_connection(
                                backend=backend_class,
                                host=getattr(settings, 'BREVO_EMAIL_HOST', 'smtp-relay.brevo.com'),
                                port=getattr(settings, 'BREVO_EMAIL_PORT', 587),
                                username=brevo_user,
                                password=brevo_pass,
                                use_tls=getattr(settings, 'BREVO_EMAIL_USE_TLS', True),
                                use_ssl=False,
                                timeout=getattr(settings, 'EMAIL_TIMEOUT', 5),
                            )
                            msg.from_email = getattr(settings, 'BREVO_DEFAULT_FROM_EMAIL', original_from)
                            conn.open()
                            conn.send_messages([msg])
                            conn.close()

                            logger.info(f"[WATERFALL] [BREVO SUCCESS] Despachado a {recipient_label} ({status_count}/300)")
                            sent_count += 1
                            sent_this_msg = True
                        except Exception as brevo_err:
                            release_brevo_quota(1)
                            logger.warning(f"[WATERFALL] [BREVO FAILED] {recipient_label}: {brevo_err}. Liberando cuota y conmutando a SES...", exc_info=True)
                            last_error = brevo_err
                            msg.from_email = original_from

            if sent_this_msg:
                continue

            # ─────────────────────────────────────────────────────────────
            # ESCALÓN 2: AMAZON SES (boto3 sesv2 Raw MIME o SES SMTP)
            # ─────────────────────────────────────────────────────────────
            ses_user = getattr(settings, 'SES_EMAIL_HOST_USER', None)
            ses_pass = getattr(settings, 'SES_EMAIL_HOST_PASSWORD', None)
            aws_key = getattr(settings, 'AWS_ACCESS_KEY_ID', None)
            aws_secret = getattr(settings, 'AWS_SECRET_ACCESS_KEY', None)
            ses_from = getattr(settings, 'SES_DEFAULT_FROM_EMAIL', getattr(settings, 'DEFAULT_FROM_EMAIL', original_from))

            # Prioridad 2A: SDK boto3 SES v2 con Raw MIME RFC 822 (Adjuntos QR/PDF)
            if boto3 and aws_key and aws_secret and not getattr(settings, 'TESTING', False):
                try:
                    logger.info(f"[WATERFALL] [AWS SES v2] Despachando a {recipient_label} vía boto3 Raw MIME")
                    aws_region = getattr(settings, 'AWS_REGION_NAME', 'us-east-1')
                    ses_client = boto3.client(
                        'sesv2',
                        region_name=aws_region,
                        aws_access_key_id=aws_key,
                        aws_secret_access_key=aws_secret,
                    )
                    msg.from_email = ses_from
                    raw_bytes = msg.message().as_bytes()

                    destination = {'ToAddresses': list(msg.to)}
                    if msg.cc:
                        destination['CcAddresses'] = list(msg.cc)
                    if msg.bcc:
                        destination['BccAddresses'] = list(msg.bcc)

                    ses_client.send_email(
                        FromEmailAddress=ses_from,
                        Destination=destination,
                        Content={'Raw': {'Data': raw_bytes}},
                    )
                    logger.info(f"[WATERFALL] [AWS SES v2 SUCCESS] Despachado a {recipient_label}")
                    sent_count += 1
                    sent_this_msg = True
                except ClientError as ce:
                    logger.warning(f"[WATERFALL] [AWS SES ClientError] {recipient_label}: {ce}")
                    last_error = ce
                    msg.from_email = original_from
                except Exception as ses_err:
                    logger.warning(f"[WATERFALL] [AWS SES FAILED] {recipient_label}: {ses_err}")
                    last_error = ses_err
                    msg.from_email = original_from

            # Prioridad 2B: Fallback a SES SMTP estándar (o en tests unitarios con mocks)
            elif ses_user and ses_pass:
                try:
                    logger.info(f"[WATERFALL] [AWS SES SMTP] Intentando despacho a {recipient_label}")
                    conn = get_connection(
                        backend=backend_class,
                        host=getattr(settings, 'SES_EMAIL_HOST', 'email-smtp.us-east-1.amazonaws.com'),
                        port=getattr(settings, 'SES_EMAIL_PORT', 587),
                        username=ses_user,
                        password=ses_pass,
                        use_tls=getattr(settings, 'SES_EMAIL_USE_TLS', True),
                        use_ssl=False,
                        timeout=getattr(settings, 'EMAIL_TIMEOUT', 5),
                    )
                    msg.from_email = ses_from
                    conn.open()
                    conn.send_messages([msg])
                    conn.close()

                    logger.info(f"[WATERFALL] [AWS SES SMTP SUCCESS] Despachado a {recipient_label}")
                    sent_count += 1
                    sent_this_msg = True
                except Exception as ses_smtp_err:
                    logger.warning(f"[WATERFALL] [AWS SES SMTP FAILED] {recipient_label}: {ses_smtp_err}")
                    last_error = ses_smtp_err
                    msg.from_email = original_from

            if sent_this_msg:
                continue

            # ─────────────────────────────────────────────────────────────
            # ESCALÓN 3: ZOHO / DEFAULT SMTP (Fallback Terciario)
            # ─────────────────────────────────────────────────────────────
            zoho_user = getattr(settings, 'EMAIL_HOST_USER', None)
            zoho_pass = getattr(settings, 'EMAIL_HOST_PASSWORD', None)

            if zoho_user and zoho_pass:
                try:
                    logger.info(f"[WATERFALL] [ZOHO/DEFAULT SMTP] Intentando fallback final para {recipient_label}")
                    conn = get_connection(
                        backend=backend_class,
                        host=getattr(settings, 'EMAIL_HOST', 'smtp.zoho.com'),
                        port=getattr(settings, 'EMAIL_PORT', 587),
                        username=zoho_user,
                        password=zoho_pass,
                        use_tls=getattr(settings, 'EMAIL_USE_TLS', True),
                        use_ssl=getattr(settings, 'EMAIL_USE_SSL', False),
                        timeout=getattr(settings, 'EMAIL_TIMEOUT', 5),
                    )
                    msg.from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', original_from)
                    conn.open()
                    conn.send_messages([msg])
                    conn.close()

                    logger.info(f"[WATERFALL] [ZOHO SUCCESS] Despachado a {recipient_label}")
                    sent_count += 1
                    sent_this_msg = True
                except Exception as zoho_err:
                    logger.error(f"[WATERFALL] [ALL PROVIDERS FAILED] {recipient_label}: {zoho_err}")
                    last_error = zoho_err
                    msg.from_email = original_from
            else:
                logger.warning(f"[WATERFALL] Zoho/Default SMTP omitido por falta de credenciales.")

            if not sent_this_msg and last_error and not self.fail_silently:
                raise last_error

        return sent_count
