import qrcode
import io
import logging
from django.utils.timezone import localtime
from email.mime.image import MIMEImage
from django.conf import settings
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives


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


def send_ticket_email(ticket):
    
    """
    Compiles content and dispatches the ticket confirmation email.
    The routing and multi-provider failover is handled globally by settings.EMAIL_BACKEND.
    """
    subject = f"✨ Tus accesos confirmados para {ticket.event.title} — Ms Ambar"

    # 1. Resolver desglose dinámico de la ubicación
    if ticket.seat:
        seat_str = f"Fila {ticket.seat.row} · Asiento {ticket.seat.number}"
        section_str = ticket.seat.section or "General"
    elif ticket.ga_zone:
        seat_str = "Zona General Admission"
        section_str = ticket.ga_zone.name
    elif ticket.event and ticket.event.event_type == 'meet_greet':
        seat_str = "Acceso Único Especial"
        section_str = "Meet & Greet (Convivencia)"
    else:
        seat_str = "Entrada General (De pie)"
        section_str = "Zona General / Sin Asiento"

    local_event_date = localtime(ticket.event.date)
    theater_obj = getattr(ticket.event, 'theater', None)
    theater_name = theater_obj.name if theater_obj else "Plataforma Digital / Streaming"
    theater_loc = theater_obj.location if theater_obj else "Acceso en Línea"

    if ticket.event.doors_open:
        local_doors_open = localtime(ticket.event.doors_open)
        event_time_str = local_doors_open.strftime('%H:%M') + " HRS"
    else:
        event_time_str = local_event_date.strftime('%H:%M') + " HRS"

    # 2. Construir contexto para la plantilla de Django
    context = {
        'ticket': ticket,
        'event': ticket.event,
        'seat_str': seat_str,
        'section_str': section_str,
        'theater_name': theater_name,
        'theater_loc': theater_loc,
        'event_date': ticket.event.date.strftime('%d / %m / %Y'),
        'event_time': event_time_str,
        'frontend_url': settings.FRONTEND_URL,
        'venue_location': ticket.event.venue_address,
        'venue_name': ticket.event.venue_name,
    }

    # 3. Renderizar plantilla HTML oficial heredada de la base luxury
    html_content = render_to_string('tickets/emails/ticket_delivery.html', context)

    # 4. Fallback obligatorio a texto plano
    text_content = (
        f"¡Hola! Tu acceso para {ticket.event.title} está listo.\n\n"
        f"Fecha: {context['event_date']} a las {context['event_time']}\n"
        f"Ubicación: {section_str} — {seat_str}\n"
        f"Lugar: {ticket.event.venue_name} ({ticket.event.venue_address})\n\n"
        f"Tu código QR de acceso único está disponible en:\n"
        f"{settings.FRONTEND_URL}/tickets/{ticket.token}\n\n"
        f"IMPORTANTE: Solo puede escanearse una vez. No compartas este enlace.\n\n"
        f"Token de autenticidad: {ticket.token}\n\n"
        f"Atentamente, el equipo de Ms Ambar."
    )

    logger.info(f"[Tickets/Delivery] Inicializando mensaje unificado para {ticket.user_email}")

    # 5. Inicializar el objeto base de Django Mail
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=settings.DEFAULT_FROM_EMAIL, # Delega la firma inicial a los settings globales
        to=[ticket.user_email]
    )
    msg.attach_alternative(html_content, "text/html")
    msg.mixed_subtype = 'related'

    # 6. Incrustar los bytes del código QR de forma segura mediante Content-ID (cid)
    qr_bytes = generate_ticket_qr(ticket)
    qr_image = MIMEImage(qr_bytes, _subtype='png')
    qr_image.add_header('Content-ID', '<qr_code>')
    qr_image.add_header('Content-Disposition', 'inline', filename=f"boleto_{str(ticket.token)[:8]}.png")
    msg.attach(qr_image)

    # 7. Despachar. Al no definir una 'connection' local, Django usará automáticamente tu FailoverEmailBackend
    msg.send(fail_silently=False)
    logger.info(f"[Tickets/Delivery] ✅ Mensaje inyectado exitosamente al pipeline global para {ticket.user_email}")


def send_ticket_whatsapp(ticket):
    logger.info(f"[Ticket] WhatsApp delivery stub: {ticket.token} → {ticket.user_phone}")

def send_ticket_telegram(ticket):
    logger.info(f"[Ticket] Telegram delivery stub: {ticket.token}")