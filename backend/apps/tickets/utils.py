import qrcode
import io
from django.conf import settings
from django.template.loader import render_to_string
from apps.blog.utils import send_failover_email

def generate_ticket_qr(ticket):
    """
    Generates a QR code image for a ticket token.
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    # The QR links to the digital ticket page
    data = f"{settings.FRONTEND_URL}/tickets/{ticket.token}"
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()

def send_ticket_email(ticket):
    """
    Sends the ticket via email leveraging Nectar Labs Failover Email Architecture.
    """
    subject = f"✨ Tu acceso para {ticket.event.title} - Ms Ambar"
    
    context = {
        'ticket': ticket,
        'event': ticket.event,
        'seat': ticket.seat,
        'ga_zone': ticket.ga_zone,
        'frontend_url': settings.FRONTEND_URL,
    }
    
    html_content = render_to_string('tickets/emails/ticket_delivery.html', context)
    
    if ticket.seat:
        seat_str = f"Sección {ticket.seat.section} - Fila {ticket.seat.row}, Asiento {ticket.seat.number}"
    elif ticket.ga_zone:
        seat_str = f"Zona General: {ticket.ga_zone.name}"
    else:
        seat_str = "Pase Meet & Greet"
        
    theater_name = ticket.event.theater.name if ticket.event.theater else "Convivencia Online / Lugar por confirmar"
    theater_loc = ticket.event.theater.location if ticket.event.theater else "Plataforma Digital"
        
    text_content = (
        f"¡Hola!\n\nHemos preparado tu acceso para {ticket.event.title}.\n\n"
        f"Detalles del Evento:\n"
        f"• Artista: {ticket.event.artist}\n"
        f"• Fecha: {ticket.event.date.strftime('%d/%m/%Y %H:%M')} hrs\n"
        f"• Ubicación: {seat_str}\n"
        f"• Lugar: {theater_name} ({theater_loc})\n\n"
        f"Puedes ver tu boleto digital en el siguiente enlace:\n"
        f"{settings.FRONTEND_URL}/tickets/{ticket.token}\n\n"
        f"Presenta el código QR adjunto en la entrada.\n"
        f"¡Disfruta del evento!\n\nAtentamente,\nEl equipo de Ms Ambar"
    )
    
    # Despachamos usando el backend de contingencia unificado
    send_failover_email(subject, html_content, text_content, [ticket.user_email])

def send_ticket_whatsapp(ticket):
    """
    Placeholder for WhatsApp delivery (e.g. using Twilio).
    """
    # Example logic:
    # client = Client(settings.TWILIO_SID, settings.TWILIO_AUTH)
    # client.messages.create(...)
    print(f"Enviando boleto {ticket.token} vía WhatsApp a {ticket.user_phone}")

def send_ticket_telegram(ticket):
    """
    Placeholder for Telegram delivery.
    """
    print(f"Enviando boleto {ticket.token} vía Telegram")
