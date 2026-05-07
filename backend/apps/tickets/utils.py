import qrcode
import io
from django.core.mail import EmailMessage
from django.conf import settings
from django.template.loader import render_to_string

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
    Sends the ticket via email with the QR code attached.
    """
    subject = f"Tu boleto para {ticket.event.title}"
    context = {
        'ticket': ticket,
        'event': ticket.event,
        'qr_url': f"{settings.FRONTEND_URL}/tickets/{ticket.token}"
    }
    # For now, a simple text message. In production use HTML templates.
    message = f"¡Hola! Aquí tienes tu boleto para {ticket.event.title}.\nAsiento: {ticket.seat.row}{ticket.seat.number}\n\nPuedes verlo aquí: {context['qr_url']}"
    
    email = EmailMessage(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [ticket.user_email],
    )
    
    qr_image = generate_ticket_qr(ticket)
    email.attach(f"ticket_{ticket.token}.png", qr_image, "image/png")
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
