import qrcode
import io
import logging
from email.mime.image import MIMEImage
from django.conf import settings
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives, get_connection

logger = logging.getLogger(__name__)


def generate_ticket_qr(ticket):
    """
    Generates a QR code PNG image for a ticket token.
    Returns raw bytes of the PNG image.
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    data = f"{settings.FRONTEND_URL}/tickets/{ticket.token}"
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#080C0A", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def _build_ticket_email_message(ticket, subject, html_content, text_content, qr_bytes, sender, connection=None):
    """
    Builds an EmailMultiAlternatives message with an inline QR code attachment (cid:qr_code).
    """
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=sender,
        to=[ticket.user_email],
        connection=connection,
    )

    # Attach HTML as alternative
    msg.attach_alternative(html_content, "text/html")

    # Make it a multipart/related so the CID reference works in email clients
    msg.mixed_subtype = 'related'

    # Attach QR image inline with Content-ID = qr_code
    qr_image = MIMEImage(qr_bytes, _subtype='png')
    qr_image.add_header('Content-ID', '<qr_code>')
    qr_image.add_header('Content-Disposition', 'inline', filename=f"boleto_{str(ticket.token)[:8]}.png")
    msg.attach(qr_image)

    return msg


def send_ticket_email(ticket):
    """
    Generates a QR code and dispatches the ticket confirmation email
    with the QR embedded inline using a robust multi-provider failover strategy.

    Priority: Brevo SMTP → Amazon SES → Zoho/Default SMTP.
    """
    subject = f"✨ Tus accesos confirmados para {ticket.event.title} — Ms Ambar"

    # 1. Resolve dynamic seat/zone description
    if ticket.seat:
        seat_str = f"Fila {ticket.seat.row} · Asiento {ticket.seat.number}"
        section_str = ticket.seat.section or "General"
    elif ticket.ga_zone:
        seat_str = "Zona General Admission"
        section_str = ticket.ga_zone.name
    else:
        seat_str = "Acceso Único Especial"
        section_str = "Meet & Greet (Convivencia)"

    theater_name = ticket.event.theater.name if ticket.event.theater else "Plataforma Digital / Streaming"
    theater_loc = ticket.event.theater.location if ticket.event.theater else "Acceso en Línea"

    # 2. Build template context
    context = {
        'ticket': ticket,
        'event': ticket.event,
        'seat_str': seat_str,
        'section_str': section_str,
        'theater_name': theater_name,
        'theater_loc': theater_loc,
        'event_date': ticket.event.date.strftime('%d / %m / %Y'),
        'event_time': ticket.event.date.strftime('%H:%M') + " HRS",
        'frontend_url': settings.FRONTEND_URL,
    }

    # 3. Render HTML template
    html_content = render_to_string('tickets/emails/ticket_delivery.html', context)

    # 4. Plain text fallback
    text_content = (
        f"¡Hola! Tu acceso para {ticket.event.title} está listo.\n\n"
        f"Fecha: {context['event_date']} a las {context['event_time']}\n"
        f"Ubicación: {section_str} — {seat_str}\n"
        f"Lugar: {theater_name} ({theater_loc})\n\n"
        f"Tu código QR de acceso único está disponible en:\n"
        f"{settings.FRONTEND_URL}/tickets/{ticket.token}\n\n"
        f"IMPORTANTE: Solo puede escanearse una vez. No compartas este enlace.\n\n"
        f"Token de autenticidad: {ticket.token}\n\n"
        f"Atentamente, el equipo de Ms Ambar."
    )

    # 5. Generate QR code bytes
    qr_bytes = generate_ticket_qr(ticket)

    # 6. Build failover provider list
    providers = []

    has_brevo = bool(getattr(settings, 'BREVO_EMAIL_HOST_USER', '') and getattr(settings, 'BREVO_EMAIL_HOST_PASSWORD', ''))
    has_ses = bool(getattr(settings, 'SES_EMAIL_HOST_USER', '') and getattr(settings, 'SES_EMAIL_HOST_PASSWORD', ''))
    has_default = bool(getattr(settings, 'EMAIL_HOST_USER', '') and getattr(settings, 'EMAIL_HOST_PASSWORD', ''))

    logger.info(
        f"[send_ticket_email] Iniciando entrega para {ticket.user_email} | "
        f"Ticket: {ticket.token} | "
        f"Brevo: {'✅' if has_brevo else '❌ no configurado'} | "
        f"SES: {'✅' if has_ses else '❌ no configurado'} | "
        f"Zoho/Default: {'✅' if has_default else '❌ no configurado'}"
    )

    if has_brevo:
        providers.append(("Brevo SMTP", {
            'host': settings.BREVO_EMAIL_HOST,
            'port': settings.BREVO_EMAIL_PORT,
            'username': settings.BREVO_EMAIL_HOST_USER,
            'password': settings.BREVO_EMAIL_HOST_PASSWORD,
            'use_tls': settings.BREVO_EMAIL_USE_TLS,
            'sender': settings.BREVO_DEFAULT_FROM_EMAIL,
        }))

    if has_ses:
        providers.append(("Amazon SES", {
            'host': settings.SES_EMAIL_HOST,
            'port': settings.SES_EMAIL_PORT,
            'username': settings.SES_EMAIL_HOST_USER,
            'password': settings.SES_EMAIL_HOST_PASSWORD,
            'use_tls': settings.SES_EMAIL_USE_TLS,
            'sender': settings.SES_DEFAULT_FROM_EMAIL,
        }))

    if has_default:
        providers.append(("Zoho/Default SMTP", {
            'host': settings.EMAIL_HOST,
            'port': settings.EMAIL_PORT,
            'username': settings.EMAIL_HOST_USER,
            'password': settings.EMAIL_HOST_PASSWORD,
            'use_tls': settings.EMAIL_USE_TLS,
            'sender': settings.DEFAULT_FROM_EMAIL,
        }))

    # En tests siempre hay un proveedor locmem disponible, sin importar credenciales
    if getattr(settings, 'TESTING', False) and not providers:
        providers.append(("locmem (Test)", {
            'host': 'localhost', 'port': 25,
            'username': '', 'password': '',
            'use_tls': False,
            'sender': settings.DEFAULT_FROM_EMAIL,
        }))

    if not providers:
        logger.error(
            f"[send_ticket_email] ❌ NINGÚN proveedor SMTP configurado. "
            f"Configura BREVO_EMAIL_HOST_USER/PASSWORD, SES_EMAIL_HOST_USER/PASSWORD, "
            f"o EMAIL_HOST_USER/PASSWORD en tu .env.staging"
        )
        raise RuntimeError(
            "No hay proveedores SMTP configurados. "
            "Agrega credenciales de Brevo, SES o Zoho en .env.staging"
        )

    last_error = None
    for name, config in providers:
        try:
            logger.info(f"[send_ticket_email] Intentando envío via {name}...")

            backend_class = (
                'django.core.mail.backends.locmem.EmailBackend'
                if getattr(settings, 'TESTING', False)
                else 'django.core.mail.backends.smtp.EmailBackend'
            )
            active_conn = get_connection(
                backend=backend_class,
                host=config['host'],
                port=config['port'],
                username=config['username'],
                password=config['password'],
                use_tls=config['use_tls'],
            )
            sender = config['sender']

            msg = _build_ticket_email_message(
                ticket=ticket,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
                qr_bytes=qr_bytes,
                sender=sender,
                connection=active_conn,
            )
            msg.send(fail_silently=False)

            logger.info(f"[send_ticket_email] ✅ Enviado exitosamente via {name} a {ticket.user_email}")
            return name

        except Exception as e:
            logger.warning(
                f"[send_ticket_email] ⚠️ Falló via {name}: {e}. Intentando siguiente proveedor...",
                exc_info=True
            )
            last_error = e

    logger.error(
        f"[send_ticket_email] ❌ Todos los proveedores SMTP fallaron para {ticket.token} → {ticket.user_email}"
    )
    if last_error:
        raise last_error


def send_ticket_whatsapp(ticket):
    logger.info(f"[Ticket] WhatsApp delivery stub: {ticket.token} → {ticket.user_phone}")


def send_ticket_telegram(ticket):
    logger.info(f"[Ticket] Telegram delivery stub: {ticket.token}")