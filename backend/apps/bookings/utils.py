import base64
import logging
from io import BytesIO
from fpdf import FPDF
from django.core.files.base import ContentFile
from django.core.mail import EmailMultiAlternatives
from django.utils.html import strip_tags
from django.conf import settings

class BookingContractPDF(FPDF):
    def header(self):
        # Draw background decoration
        self.set_fill_color(6, 7, 11) # Midnight black
        
        # Header text
        self.set_font('helvetica', 'B', 16)
        self.set_text_color(255, 255, 255)
        self.cell(0, 12, 'CONTRATO DE PRESENTACIÓN ARTÍSTICA', new_x="LMARGIN", new_y="NEXT", align='C')
        
        self.set_font('helvetica', 'B', 11)
        self.set_text_color(245, 158, 11) # Amber Gold (#f59e0b)
        self.cell(0, 8, 'MS AMBAR - ACUERDO DE BOOKING OFICIAL', new_x="LMARGIN", new_y="NEXT", align='C')
        self.ln(8)

    def footer(self):
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, f'Página {self.page_no()} | Generado digitalmente en msambar.dev', align='C')

def generate_booking_contract_pdf(contract):
    try:
        pdf = BookingContractPDF()
        pdf.add_page()
        pdf.set_font('helvetica', '', 10)
        pdf.set_text_color(50, 50, 50)

        inquiry = contract.inquiry
        date_str = inquiry.date.strftime('%d/%m/%Y') if inquiry.date else 'Fecha por definir'
        created_str = contract.created_at.strftime('%d/%m/%Y')

        # Intro
        pdf.set_font('helvetica', 'B', 11)
        pdf.cell(0, 10, 'DATOS DEL COMPROMISO', new_x="LMARGIN", new_y="NEXT")
        pdf.set_font('helvetica', '', 10)
        pdf.cell(0, 6, f'ORGANIZADOR / COMPAÑÍA: {inquiry.name} ({inquiry.company or "Particular"})', new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, f'EMAIL: {inquiry.email} | TELÉFONO: {inquiry.phone}', new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, f'FECHA DE PRESENTACIÓN: {date_str}', new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, f'TIPO DE FORO: {inquiry.get_venue_type_display()}', new_x="LMARGIN", new_y="NEXT")
        pdf.ln(4)

        # Fee
        pdf.set_font('helvetica', 'B', 11)
        pdf.cell(0, 10, 'HONORARIOS Y PAGOS', new_x="LMARGIN", new_y="NEXT")
        pdf.set_font('helvetica', '', 10)
        pdf.multi_cell(0, 6, f'Se acuerda un honorario total de ${contract.fee} MXN por la presentación artística de MS AMBAR. El organizador se compromete a liquidar el 50% para reservar la fecha y el 50% restante antes de subir al escenario.')
        pdf.ln(4)

        # Clauses
        pdf.set_font('helvetica', 'B', 11)
        pdf.cell(0, 10, 'CLÁUSULAS DEL RIDER Y OPERACIÓN', new_x="LMARGIN", new_y="NEXT")
        pdf.set_font('helvetica', '', 10)
        
        clauses = (
            "1. DURACIÓN: El show tendrá una duración mínima de 90 minutos de set en vivo.\n"
            "2. RIDER TÉCNICO: El organizador proveerá el sistema de audio, iluminación y monitores según las especificaciones técnicas adjuntas.\n"
            "3. HOSPITALIDAD: Se solicita catering básico en camerinos, agua y seguridad privada para la artista en el foro.\n"
            "4. CANCELACIÓN: En caso de cancelación por causas ajenas a la artista, el depósito inicial del 50% no será reembolsable.\n"
            "5. PROMOCIÓN: Toda publicidad del evento deberá usar el material gráfico oficial proporcionado por la oficina de la artista."
        )
        pdf.multi_cell(0, 6, clauses)
        pdf.ln(8)

        # Signatures Area
        y_before_sig = pdf.get_y()
        
        # Draw Client Signature
        if contract.signature_base64:
            try:
                header, encoded = contract.signature_base64.split(",", 1)
                sig_data = base64.b64decode(encoded)
                sig_img = BytesIO(sig_data)
                pdf.image(sig_img, x=25, y=y_before_sig, w=45)
                if contract.signed_at:
                    pdf.set_xy(10, y_before_sig + 15)
                    pdf.set_font('helvetica', 'I', 7)
                    pdf.cell(80, 5, f'Firmado: {contract.signed_at.strftime("%d/%m/%Y %H:%M")}', align='C')
            except Exception as e:
                logging.error(f"Error drawing client signature on PDF: {e}")

        pdf.set_font('helvetica', 'B', 10)
        pdf.line(20, y_before_sig + 15, 80, y_before_sig + 15)
        pdf.set_xy(10, y_before_sig + 16)
        pdf.cell(80, 8, inquiry.name, align='C', new_x="LMARGIN", new_y="NEXT")
        pdf.set_font('helvetica', 'I', 8)
        pdf.cell(80, 5, 'EL ORGANIZADOR (CLIENTE)', align='C')

        # Draw Manager Signature
        if contract.manager_signature:
            try:
                header, encoded = contract.manager_signature.split(",", 1)
                sig_data = base64.b64decode(encoded)
                sig_img = BytesIO(sig_data)
                pdf.image(sig_img, x=125, y=y_before_sig, w=45)
                if contract.manager_signed_at:
                    pdf.set_xy(110, y_before_sig + 15)
                    pdf.set_font('helvetica', 'I', 7)
                    pdf.cell(80, 5, f'Firmado: {contract.manager_signed_at.strftime("%d/%m/%Y %H:%M")}', align='C')
            except Exception as e:
                logging.error(f"Error drawing manager signature on PDF: {e}")

        pdf.set_font('helvetica', 'B', 10)
        pdf.line(120, y_before_sig + 15, 180, y_before_sig + 15)
        pdf.set_xy(110, y_before_sig + 16)
        pdf.cell(80, 8, 'Representante Autorizado', align='C', new_x="LMARGIN", new_y="NEXT")
        pdf.set_font('helvetica', 'I', 8)
        pdf.cell(80, 5, 'REPRESENTANTE (MS AMBAR)', align='C')

        # Save PDF
        output = pdf.output()
        filename = f"contrato_booking_{contract.id}_{'FINAL' if contract.is_fully_signed else 'PROPUESTA'}.pdf"
        contract.pdf_file.save(filename, ContentFile(output), save=True)
        return True
    except Exception as e:
        logging.error(f"Failed to generate booking contract PDF: {e}")
        return False

def send_booking_contract_emails(contract):
    try:
        inquiry = contract.inquiry
        
        if not contract.is_fully_signed:
            # Stage 1: Proposal sent to Client, notify Manager to track it
            client_subject = "✨ Propuesta de Contrato de Booking - MS AMBAR"
            sign_url = f"{settings.FRONTEND_URL}/bookings/sign/{contract.id}"
            
            client_context = {
                'inquiry': inquiry,
                'contract': contract,
                'sign_url': sign_url,
                'frontend_url': settings.FRONTEND_URL,
            }
            client_html = render_to_string('bookings/emails/booking_proposal.html', client_context)
            client_text = (
                f"Hola {inquiry.name},\n\n"
                f"Hemos recibido tu solicitud de booking para la fecha {inquiry.date} en un {inquiry.get_venue_type_display()}.\n\n"
                f"Hemos elaborado una propuesta de contrato artístico digital con los honorarios base de ${contract.fee} MXN.\n"
                f"Puedes revisar y estampar tu firma de conformidad en el siguiente enlace:\n"
                f"{sign_url}\n\n"
                f"Saludos cordiales,\nMS AMBAR Management"
            )
            
            # Send proposal email to client
            email_client = EmailMultiAlternatives(client_subject, client_text, settings.DEFAULT_FROM_EMAIL, [inquiry.email])
            email_client.attach_alternative(client_html, "text/html")
            if contract.pdf_file:
                contract.pdf_file.seek(0)
                email_client.attach(f"Propuesta_Contrato_Booking_{contract.id}.pdf", contract.pdf_file.read(), 'application/pdf')
            email_client.send()
            
            # Send notification to Manager/Agent
            manager_subject = f"🔔 Nuevo Booking Recibido: {inquiry.name} ({inquiry.date})"
            manager_context = {
                'inquiry': inquiry,
                'contract': contract,
                'frontend_url': settings.FRONTEND_URL,
            }
            manager_html = render_to_string('bookings/emails/booking_notification.html', manager_context)
            manager_text = (
                f"Se ha registrado una nueva solicitud de booking en el sitio web:\n\n"
                f"Organizador: {inquiry.name}\n"
                f"Email: {inquiry.email} | Teléfono: {inquiry.phone}\n"
                f"Fecha propuesta: {inquiry.date}\n"
                f"Mensaje: {inquiry.message}\n\n"
                f"Se generó la propuesta #{contract.id} con honorarios de ${contract.fee} MXN. Firma del cliente pendiente."
            )
            email_manager = EmailMultiAlternatives(manager_subject, manager_text, settings.DEFAULT_FROM_EMAIL, [settings.DEFAULT_FROM_EMAIL])
            email_manager.attach_alternative(manager_html, "text/html")
            email_manager.send()
            
        else:
            # Stage 2: Fully Signed Contract copies sent to client and manager
            final_subject = f"✅ Contrato de Booking Certificado - {inquiry.name} ({inquiry.date})"
            
            final_context = {
                'inquiry': inquiry,
                'contract': contract,
                'frontend_url': settings.FRONTEND_URL,
            }
            final_html = render_to_string('bookings/emails/booking_certified.html', final_context)
            final_text = (
                f"¡Felicidades {inquiry.name}!\n\n"
                f"El contrato de presentación artística ha sido firmado por ambas partes. Adjunto encontrarás el documento final certificado en formato PDF.\n\n"
                f"Nos vemos pronto en el escenario.\n\n"
                f"MS AMBAR Management"
            )
            
            recipients = [inquiry.email, settings.DEFAULT_FROM_EMAIL]
            for dest in recipients:
                email = EmailMultiAlternatives(final_subject, final_text, settings.DEFAULT_FROM_EMAIL, [dest])
                email.attach_alternative(final_html, "text/html")
                if contract.pdf_file:
                    contract.pdf_file.seek(0)
                    email.attach(f"Contrato_Booking_Ambar_{contract.id}_FINAL.pdf", contract.pdf_file.read(), 'application/pdf')
                email.send()
                
    except Exception as e:
        logging.error(f"Failed to send booking contract emails: {e}", exc_info=True)
