import logging
import requests
from pathlib import Path
from fpdf import FPDF
from django.conf import settings

logger = logging.getLogger("apps")


def backup_remote_label_pdf(remote_label_url: str, order_id: int) -> str:
    """
    Descarga y persiste una copia local del PDF oficial de la guía en MEDIA_ROOT/shipping_labels/.
    Retorna la URL local relativa si es exitoso, o la remote_label_url original como fallback.
    """
    if not remote_label_url:
        return ""

    try:
        labels_dir = Path(settings.MEDIA_ROOT) / 'shipping_labels'
        labels_dir.mkdir(parents=True, exist_ok=True)
        filename = f"guia_pedido_{order_id}.pdf"
        local_file = labels_dir / filename

        r = requests.get(remote_label_url, timeout=15.0)
        if r.status_code == 200 and len(r.content) > 100:
            local_file.write_bytes(r.content)
            logger.info(f"[Logística Labels] PDF oficial de Skydropx respaldado en {local_file}")
            return f"{settings.MEDIA_URL}shipping_labels/{filename}"
    except Exception as e:
        logger.warning(f"[Logística Labels] No se pudo descargar copia local del PDF ({e}). Conservando URL remota.")

    return remote_label_url


def generate_sample_shipping_label_pdf(order) -> str:
    """
    Genera un PDF con formato de guía estándar 10x15cm (4x6 pulgadas)
    para modo mock/testing o visualización en contingencia.
    """
    try:
        labels_dir = Path(settings.MEDIA_ROOT) / 'shipping_labels'
        labels_dir.mkdir(parents=True, exist_ok=True)
        filename = f"guia_pedido_{order.id}.pdf"
        filepath = labels_dir / filename

        # Formato 100mm x 150mm (etiqueta térmica estándar)
        pdf = FPDF(orientation='P', unit='mm', format=(100, 150))
        pdf.set_auto_page_break(auto=False, margin=0)
        pdf.add_page()

        # Borde exterior
        pdf.set_line_width(0.8)
        pdf.rect(3, 3, 94, 144)

        # Header con Provider
        provider = order.shipping_provider or "PAQUETERÍA NACIONAL"
        pdf.set_font('helvetica', 'B', 12)
        pdf.set_xy(5, 5)
        pdf.cell(90, 8, provider.upper()[:28], align='C')

        pdf.set_font('helvetica', '', 7)
        pdf.set_xy(5, 12)
        pdf.cell(90, 4, 'SERVICIO ESTÁNDAR / EXPRÉS NACIONAL', align='C')

        pdf.set_line_width(0.4)
        pdf.line(3, 17, 97, 17)

        # Matriz 2D / Código QR Simulado
        pdf.rect(6, 19, 15, 15)
        pdf.set_font('courier', 'B', 6)
        pdf.set_xy(6, 20)
        pdf.cell(15, 4, 'QR CODE', align='C')
        pdf.set_xy(6, 26)
        pdf.cell(15, 4, f"#{order.id}", align='C')

        # Recuadro de Número de Rastreo
        tracking = order.tracking_number or f"TRACK-AMBAR-{order.id}MX"
        pdf.set_fill_color(248, 250, 252)
        pdf.rect(24, 19, 71, 15, style='F')
        pdf.set_font('helvetica', 'B', 9)
        pdf.set_text_color(0, 0, 0)
        pdf.set_xy(24, 20)
        pdf.cell(71, 4, 'NO. DE RASTREO / TRACKING', align='C')
        pdf.set_font('courier', 'B', 11)
        pdf.set_xy(24, 25)
        pdf.cell(71, 5, tracking, align='C')

        pdf.line(3, 36, 97, 36)

        # Remitente (FROM)
        pdf.set_font('helvetica', 'B', 8)
        pdf.set_text_color(80, 80, 80)
        pdf.set_xy(6, 38)
        pdf.cell(88, 4, 'REMITENTE (ORIGEN):')
        pdf.set_font('helvetica', '', 8)
        pdf.set_text_color(20, 20, 20)
        pdf.set_xy(6, 42)
        pdf.cell(88, 4, 'Ms Ambar - Almacén Central (Hermosillo, Sonora)')
        pdf.set_xy(6, 46)
        pdf.cell(88, 4, 'C.P. 83000 | Tel: 662-100-0000 | México')

        pdf.line(3, 52, 97, 52)

        # Destinatario (TO)
        pdf.set_font('helvetica', 'B', 9)
        pdf.set_text_color(80, 80, 80)
        pdf.set_xy(6, 54)
        pdf.cell(88, 4, 'DESTINATARIO (ENTREGA):')
        
        pdf.set_font('helvetica', 'B', 11)
        pdf.set_text_color(0, 0, 0)
        pdf.set_xy(6, 59)
        pdf.cell(88, 5, str(order.full_name)[:35])

        pdf.set_font('helvetica', '', 8)
        pdf.set_xy(6, 65)
        dest_addr = str(order.street_and_number or '')[:40]
        pdf.cell(88, 4, dest_addr)

        pdf.set_xy(6, 69)
        col_city = f"Col. {order.suburb or 'Centro'}, {order.city or ''}"[:40]
        pdf.cell(88, 4, col_city)

        pdf.set_xy(6, 73)
        state_cp = f"{order.state or ''} | C.P. {order.postal_code or ''} | Tel: {order.phone or 'N/A'}"
        pdf.cell(88, 4, state_cp)

        pdf.line(3, 80, 97, 80)

        # Información del paquete
        pdf.set_font('helvetica', 'B', 8)
        pdf.set_text_color(80, 80, 80)
        pdf.set_xy(6, 82)
        pdf.cell(88, 4, 'INFORMACIÓN DEL PAQUETE:')
        
        pdf.set_font('helvetica', '', 8)
        pdf.set_text_color(20, 20, 20)
        pdf.set_xy(6, 87)
        pdf.cell(44, 4, f"Pedido ID: #{order.id}")
        pdf.set_xy(50, 87)
        pdf.cell(44, 4, "Peso: 1.0 kg")
        
        pdf.set_xy(6, 92)
        pdf.cell(44, 4, "Contenido: Merch Oficial")
        pdf.set_xy(50, 92)
        pdf.cell(44, 4, "Dims: 15x25x35 cm")

        pdf.line(3, 100, 97, 100)

        # Instrucciones
        pdf.set_font('helvetica', 'I', 7)
        pdf.set_text_color(100, 100, 100)
        pdf.set_xy(6, 103)
        pdf.multi_cell(88, 3.5, 'Conserve esta guía para el seguimiento de su paquete. Para rastreo en línea visite track.skydropx.com o el portal de la paquetería seleccionada.')

        # Barcode inferior
        pdf.set_xy(6, 120)
        pdf.set_font('courier', 'B', 9)
        pdf.set_text_color(0, 0, 0)
        pdf.cell(88, 5, f"* {tracking} *", align='C')
        pdf.set_xy(6, 126)
        pdf.set_font('helvetica', 'B', 7)
        pdf.cell(88, 4, 'DESPACHADO POR LOGÍSTICA MS AMBAR', align='C')

        pdf.output(str(filepath))
        return f"{settings.MEDIA_URL}shipping_labels/{filename}"
    except Exception as e:
        logger.error(f"[Logística Labels] Error generando PDF de guía para Pedido #{order.id}: {e}", exc_info=True)
        return ""
