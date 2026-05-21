import qrcode
import io
from django.core.mail import EmailMultiAlternatives
from django.utils.html import strip_tags
from django.conf import settings
from django.template.loader import render_to_string
from email.mime.image import MIMEImage

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
    Sends the ticket via email with the QR code embedded inline and attached.
    """
    subject = f"✨ Tu boleto para {ticket.event.title} - MS AMBAR"
    
    context = {
        'ticket': ticket,
        'event': ticket.event,
        'seat': ticket.seat,
        'ga_zone': ticket.ga_zone,
        'frontend_url': settings.FRONTEND_URL,
    }
    
    html_content = render_to_string('tickets/emails/ticket_delivery.html', context)
    
    # Plain text fallback
    if ticket.seat:
        seat_str = f"Sección {ticket.seat.section} - Fila {ticket.seat.row}, Asiento {ticket.seat.number}"
    elif ticket.ga_zone:
        seat_str = f"Zona General: {ticket.ga_zone.name}"
    else:
        seat_str = "Entrada General"
        
    text_content = (
        f"¡Hola!\n\nHemos preparado tu acceso para {ticket.event.title}.\n\n"
        f"Detalles del Evento:\n"
        f"• Artista: {ticket.event.artist}\n"
        f"• Fecha: {ticket.event.date.strftime('%d/%m/%Y %H:%M')} hrs\n"
        f"• Ubicación: {seat_str}\n"
        f"• Lugar: {ticket.event.theater.name} ({ticket.event.theater.location})\n\n"
        f"Puedes ver tu boleto digital en el siguiente enlace:\n"
        f"{settings.FRONTEND_URL}/tickets/{ticket.token}\n\n"
        f"Presenta el código QR adjunto en la entrada.\n"
        f"¡Disfruta del evento!\n\nAtentamente,\nEl equipo de MS AMBAR"
    )
    
    email = EmailMultiAlternatives(
        subject,
        text_content,
        settings.DEFAULT_FROM_EMAIL,
        [ticket.user_email],
    )
    email.attach_alternative(html_content, "text/html")
    
    # Generate QR Image and attach as inline MIMEImage
    qr_image = generate_ticket_qr(ticket)
    msg_img = MIMEImage(qr_image)
    msg_img.add_header('Content-ID', '<ticket_qr>')
    msg_img.add_header('Content-Disposition', 'inline', filename=f"ticket_{ticket.token}.png")
    email.attach(msg_img)
    
    email.send()

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
