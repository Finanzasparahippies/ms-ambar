import qrcode
import io
import logging
import re
import math
import uuid
from django.utils.timezone import localtime
from email.mime.image import MIMEImage
from django.conf import settings
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives
from config.email_waterfall import dispatch_email_async


logger = logging.getLogger(__name__)


def format_seat_assignment(seat):
    """
    Formato canónico de asignación de asiento sin duplicaciones ('Fila: F · Mesa: 4 · Asiento: 13').
    """
    if not seat:
        return ""
    row_raw = str(getattr(seat, 'row', '') or '').strip()
    row_clean = re.sub(r'^fila\s*:?\s*', '', row_raw, flags=re.IGNORECASE).strip()

    table_label = None
    theater = getattr(seat, 'theater', None)
    if theater and isinstance(theater.layout, dict):
        layout_seats = theater.layout.get('seats', [])
        layout_elements = theater.layout.get('map_elements', [])
        table_id = None
        for ls in layout_seats:
            if ls.get('id') == seat.id or (ls.get('number') == seat.number and (ls.get('row') == seat.row or ls.get('row') == row_clean)):
                table_id = ls.get('tableId') or ls.get('table_id')
                break
        for el in layout_elements:
            if table_id and str(el.get('id')) == str(table_id):
                table_label = el.get('label')
                break
            if not table_id and (el.get('type') == 'table' or el.get('tableShape')):
                if math.hypot(el.get('x', 0) - getattr(seat, 'x', 0), el.get('y', 0) - getattr(seat, 'y', 0)) <= 80:
                    table_label = el.get('label')
                    break

    parts = []
    if row_clean and not row_clean.lower().startswith('mesa'):
        parts.append(f"Fila: {row_clean.upper()}")

    if table_label:
        pure_tbl = re.sub(r'^mesa\s*:?\s*', '', str(table_label), flags=re.IGNORECASE).strip()
        if pure_tbl:
            parts.append(f"Mesa: {pure_tbl}")
    elif row_raw.lower().startswith('mesa'):
        pure_tbl = re.sub(r'^mesa\s*:?\s*', '', row_raw, flags=re.IGNORECASE).strip()
        if pure_tbl:
            parts.append(f"Mesa: {pure_tbl}")

    pure_num = re.sub(r'^asiento\s*:?\s*', '', str(seat.number), flags=re.IGNORECASE).strip()
    parts.append(f"Asiento: {pure_num}")
    return " · ".join(parts)

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
        seat_str = format_seat_assignment(ticket.seat)
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
        'event_date': local_event_date.strftime('%d / %m / %Y'),
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

    logger.info(f"[DELIVERY/SMTP] [Email: {ticket.user_email} | EventID: {ticket.event.id} | TicketUUID: {ticket.token} | StripeID: {ticket.stripe_session_id or '-'}] Iniciando pipeline de correo para destinatario: {ticket.user_email}")

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
    try:
        msg.send(fail_silently=False)
        logger.info(f"[DELIVERY/SMTP] [Email: {ticket.user_email} | EventID: {ticket.event.id} | TicketUUID: {ticket.token} | StripeID: {ticket.stripe_session_id or '-'}] Status: exitoso. Correo enviado.")
    except Exception as e:
        logger.error(f"[DELIVERY/SMTP] [Email: {ticket.user_email} | EventID: {ticket.event.id} | TicketUUID: {ticket.token} | StripeID: {ticket.stripe_session_id or '-'}] Status: fallido. Error: {str(e)}")
        raise e


def send_ticket_whatsapp(ticket):
    logger.info(f"[DELIVERY/WHATSAPP] [Email: {ticket.user_email} | EventID: {ticket.event.id} | TicketUUID: {ticket.token} | StripeID: {ticket.stripe_session_id or '-'}] Intento de envío por WhatsApp al número: {ticket.user_phone}")

def send_ticket_telegram(ticket):
    logger.info(f"[Ticket] Telegram delivery stub: {ticket.token}")


def send_coupon_email(coupon, recipient_email, custom_note='', image_url=None, async_send=False):
    """
    Despacha un correo electrónico elegante con la información del cupón, imagen opcional (Cloudinary/Flyer) y link de auto-aplicación.
    Si el cupón no tenía correo asignado, lo asigna automáticamente al correo del destinatario para blindar el beneficio.
    """
    logger.info(f"[DELIVERY/SMTP] [Email: {recipient_email.strip()} | EventID: {coupon.event.id if coupon.event else '-'} | TicketUUID: - | StripeID: -] Iniciando pipeline de correo de cupón {coupon.code} para destinatario: {recipient_email.strip()}")
    recipient_email = recipient_email.strip()
    if not coupon.assigned_email:
        coupon.assigned_email = recipient_email
        coupon.save(update_fields=['assigned_email'])

    # Determinar URL de imagen segura (Cloudinary o Flyer de Evento)
    selected_image = None
    if image_url and isinstance(image_url, str) and (image_url.startswith('https://') or image_url.startswith('http://')):
        selected_image = image_url.strip()
    elif not image_url and coupon.event:
        if coupon.event.flyer and hasattr(coupon.event.flyer, 'url'):
            selected_image = coupon.event.flyer.url
        elif coupon.event.image and hasattr(coupon.event.image, 'url'):
            selected_image = coupon.event.image.url

    # Optimización inteligente para Cloudinary (calidad y formato automático sin distorsión)
    if selected_image and ("res.cloudinary.com" in selected_image or "/upload/" in selected_image):
        if "/upload/" in selected_image and "f_auto" not in selected_image:
            parts = selected_image.split("/upload/", 1)
            selected_image = f"{parts[0]}/upload/f_auto,q_auto,w_800/{parts[1]}"

    discount_desc = "100% de descuento (Entrada VIP Gratuita)" if coupon.discount_type == 'free_vip' else (
        f"{coupon.discount_value}% de descuento" if coupon.discount_type == 'percentage' else f"${coupon.discount_value} MXN de descuento"
    )
    subject = f"🎟️ ¡Tienes un cupón exclusivo de Ms Ambar! ({coupon.code})"

    checkout_url = f"{settings.FRONTEND_URL}/comprar-boletos?coupon={coupon.code}&email={recipient_email}"
    if coupon.event:
        checkout_url += f"&event={coupon.event.id}"

    text_content = (
        f"¡Hola!\n\n"
        f"Has recibido un cupón exclusivo para los eventos de Ms Ambar:\n\n"
        f"Código: {coupon.code}\n"
        f"Beneficio: {discount_desc}\n"
        + (f"Evento: {coupon.event.title}\n" if coupon.event else "")
        + (f"Expiración: {coupon.expiration_date.strftime('%d/%m/%Y')}\n" if coupon.expiration_date else "")
        + (f"\nNota: {custom_note}\n\n" if custom_note else "\n")
        + f"Este cupón es personal e intransferible para {recipient_email}.\n"
        f"Reclama tu beneficio directamente en:\n"
        f"{checkout_url}\n\n"
        f"¡Te esperamos!\n"
        f"Con cariño, Ms Ambar"
    )

    image_html = f"""
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 24px auto;">
        <tr>
          <td align="center" style="padding: 0;">
            <img src="{selected_image}" alt="Ms Ambar Evento" width="536" style="width: 100%; max-width: 536px; height: auto; display: block; margin: 0 auto; border-radius: 12px; border: 1px solid rgba(217, 119, 6, 0.4); box-shadow: 0 8px 24px rgba(0,0,0,0.6);" />
          </td>
        </tr>
      </table>
    """ if selected_image else ""

    # Preheader invisible y divisor de hilo único anti-recorte para Gmail
    preheader_text = f"Tu invitación exclusiva y cupón {coupon.code} para Ms Ambar"
    thread_breaker_id = uuid.uuid4().hex

    html_content = f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&display=swap');
      </style>
    </head>
    <body style="background-color: #050505; margin: 0; padding: 30px 10px; -webkit-font-smoothing: antialiased;">
      <!-- Gmail Preheader & Space Padding -->
      <div style="display: none; font-size: 1px; color: #050505; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
        {preheader_text} &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
      </div>

      <div style="font-family: 'Playfair Display', Georgia, serif; max-width: 600px; margin: 0 auto; background: #0d0d0d; color: #f3f4f6; border: 1px solid #d97706; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.8);">
        <h2 style="color: #f59e0b; text-align: center; margin-top: 0; font-size: 26px; letter-spacing: 3px;">MS AMBAR</h2>
        <hr style="border: 0; border-top: 1px solid rgba(217, 119, 6, 0.4); margin: 20px 0;" />
        {image_html}
        <h3 style="color: #ffffff; text-align: center; font-size: 20px;">¡Tienes una Invitación Exclusiva!</h3>
        <p style="font-size: 15px; line-height: 1.7; color: #d1d5db; text-align: center;">
          Se ha emitido un cupón exclusivo asignado especialmente a tu correo (<strong>{recipient_email}</strong>) para disfrutar de los eventos de <strong>Ms Ambar</strong>.
        </p>
        {f'<blockquote style="background: rgba(217,119,6,0.1); border-left: 4px solid #d97706; padding: 14px; margin: 20px 0; color: #fbbf24; font-style: italic; border-radius: 4px;">"{custom_note}"</blockquote>' if custom_note else ''}
        <div style="background: #18181b; border: 2px dashed #f59e0b; border-radius: 12px; padding: 24px; text-align: center; margin: 25px 0;">
          <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #9ca3af; display: block; margin-bottom: 8px;">Código de Cupón Personal</span>
          <span style="font-size: 30px; font-weight: 900; color: #f59e0b; letter-spacing: 4px; font-family: monospace;">{coupon.code}</span>
          <div style="margin-top: 12px; font-size: 14px; color: #e5e7eb;">
            <strong>Beneficio:</strong> {discount_desc}
          </div>
          <div style="margin-top: 6px; font-size: 11px; color: #f59e0b;">
            🛡️ Intransferible — Válido únicamente para {recipient_email}
          </div>
        </div>
        <div style="text-align: center; margin: 32px 0;">
          <a href="{checkout_url}" style="background: linear-gradient(135deg, #d97706, #b45309); color: #ffffff; text-decoration: none; padding: 16px 36px; font-size: 14px; font-weight: bold; border-radius: 30px; display: inline-block; letter-spacing: 1px; box-shadow: 0 4px 20px rgba(217, 119, 6, 0.5);">
            RECLAMAR MI BENEFICIO
          </a>
        </div>
        <p style="font-size: 12px; color: #6b7280; text-align: center; margin-bottom: 0;">
          Si tienes problemas con el botón, copia y abre este enlace:<br />
          <a href="{checkout_url}" style="color: #f59e0b; word-break: break-all;">{checkout_url}</a>
        </p>
        
        <!-- Gmail quote-breaker anti-trim divider -->
        <div style="display:none!important;font-size:0;max-height:0;line-height:0;opacity:0;mso-hide:all;">{thread_breaker_id}</div>
      </div>
    </body>
    </html>
    """

    # Minificación segura para mantener el peso del correo muy por debajo del umbral de 102KB
    html_minified = re.sub(r'>\s+<', '><', html_content)
    html_minified = re.sub(r'[ \t]+', ' ', html_minified).strip()

    unique_message_id = f"<{uuid.uuid4()}@msambar.com>"

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient_email],
            headers={'Message-ID': unique_message_id}
        )
        msg.attach_alternative(html_minified, "text/html")
        if async_send:
            dispatch_email_async(msg)
            logger.info(f"[DELIVERY/SMTP] [Email: {recipient_email} | EventID: {coupon.event.id if coupon.event else '-'} | TicketUUID: - | StripeID: -] Correo de cupón encolado asíncronamente con Message-ID: {unique_message_id}")
            return True, "Email encolado para despacho asíncrono."

        msg.send(fail_silently=False)
        logger.info(f"[DELIVERY/SMTP] [Email: {recipient_email} | EventID: {coupon.event.id if coupon.event else '-'} | TicketUUID: - | StripeID: -] Status: exitoso. Correo de cupón enviado a {recipient_email}")
        return True, "Email enviado correctamente."
    except Exception as e:
        logger.error(f"[DELIVERY/SMTP] [Email: {recipient_email} | EventID: {coupon.event.id if coupon.event else '-'} | TicketUUID: - | StripeID: -] Status: fallido. Error: {str(e)}")
        return False, str(e)