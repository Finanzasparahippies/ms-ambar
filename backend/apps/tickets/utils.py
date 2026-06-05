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
    data = f"{settings.FRONTEND_URL}/tickets/{ticket.token}"
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()

def send_ticket_email(ticket):
    """
    Compiles variables and dispatches confirmation ticket emails 
    using the unifed Failover SMTP Relay Engine.
    """
    subject = f"✨ Tus accesos confirmados para {ticket.event.title} - Ms Ambar"
    
    # 1. Resolver el desglose dinámico de la ubicación
    if ticket.seat:
        seat_str = f"Fila {ticket.seat.row} • Asiento {ticket.seat.number}"
        section_str = ticket.seat.section
    elif ticket.ga_zone:
        seat_str = "Zona General Admission"
        section_str = ticket.ga_zone.name
    else:
        seat_str = "Acceso Único Especial"
        section_str = "Meet & Greet (Convivencia)"
        
    theater_name = ticket.event.theater.name if ticket.event.theater else "Plataforma Digital / Streaming"
    theater_loc = ticket.event.theater.location if ticket.event.theater else "Acceso en Línea"
    
    # 2. Formatear Fechas para Contexto de Plantilla
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
    
    # 3. Compilar HTML usando el motor de render de Django
    html_content = render_to_string('tickets/emails/ticket_delivery.html', context)
    
    # 4. Fallback a texto plano para clientes antiguos
    text_content = (
        f"¡Hola! Tu acceso para {ticket.event.title} está listo.\n\n"
        f"Ubicación: {section_str} - {seat_str}\n"
        f"Lugar: {theater_name}\n"
        f"Fecha: {context['event_date']} a las {context['event_time']}\n\n"
        f"Puedes descargar tu boleto oficial en el siguiente enlace:\n"
        f"{settings.FRONTEND_URL}/tickets/{ticket.token}\n\n"
        f"Atentamente, el equipo de Ms Ambar."
    )
    
    # 5. Despachar a través del motor de failover unificado de la agencia
    send_failover_email(subject, html_content, text_content, [ticket.user_email])

def send_ticket_whatsapp(ticket):
    print(f"Enviando boleto {ticket.token} vía WhatsApp a {ticket.user_phone}")

def send_ticket_telegram(ticket):
    print(f"Enviando boleto {ticket.token} vía Telegram")