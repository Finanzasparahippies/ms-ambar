import io
import os
import json
import zipfile
import hashlib
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta, timezone as dt_timezone
from django.conf import settings
from django.utils.timezone import localtime
from PIL import Image, ImageDraw, ImageFont

from apps.tickets.utils import format_seat_assignment
from apps.tickets.access.qr_crypto import generate_qr_payload

logger = logging.getLogger('apps.tickets')


class AppleWalletService:
    """
    Servicio de compilación, empaquetado y firmado criptográfico PKCS#7
    de pases nativos para Apple Wallet (.pkpass) conforme a Apple PassKit Package Format:
    - pass.json (eventTicket)
    - Iconos y banners en resoluciones @1x, @2x, @3x
    - manifest.json con hashes SHA-1
    - Firma digital PKCS#7 / CMS detached contra manifest.json
    - Archivo ZIP en memoria con MIME type 'application/vnd.apple.pkpass'
    """

    def __init__(self):
        self.pass_type_id = (
            getattr(settings, 'APPLE_PASS_TYPE_ID', '') or
            'pass.dev.nectarlabs.msambar'
        )
        self.team_id = getattr(settings, 'APPLE_TEAM_ID', '') or 'NECTARLABS1'
        self.cert_path = getattr(settings, 'APPLE_CERT_PATH', '')
        self.key_path = getattr(settings, 'APPLE_KEY_PATH', '')
        self.cert_password = getattr(settings, 'APPLE_CERT_PASSWORD', '')
        self.wwdr_path = getattr(settings, 'APPLE_WWDR_CERT_PATH', '')
        self.web_service_url = getattr(settings, 'APPLE_WEB_SERVICE_URL', '')

    def generate_pass(self, ticket: Any) -> bytes:
        """
        Genera el paquete binario completo .pkpass en memoria (io.BytesIO).
        """
        pass_data = self._build_pass_json(ticket)
        pass_json_bytes = json.dumps(pass_data, indent=2, ensure_ascii=False).encode('utf-8')

        files_to_pack: Dict[str, bytes] = {
            'pass.json': pass_json_bytes
        }

        # Generar assets gráficos oficiales (@1x, @2x, @3x)
        assets = self._generate_graphical_assets(ticket)
        files_to_pack.update(assets)

        # Generar manifest.json (SHA-1 checksum de cada archivo)
        manifest: Dict[str, str] = {}
        for filename, data in files_to_pack.items():
            manifest[filename] = hashlib.sha1(data).hexdigest()

        manifest_bytes = json.dumps(manifest, indent=2).encode('utf-8')
        files_to_pack['manifest.json'] = manifest_bytes

        # Generar firma digital PKCS#7 detached
        signature_bytes = self._sign_manifest(manifest_bytes)
        files_to_pack['signature'] = signature_bytes

        # Empaquetar todo en un archivo ZIP plano sin subdirectorios
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for filename, data in files_to_pack.items():
                zip_file.writestr(filename, data)

        zip_buffer.seek(0)
        return zip_buffer.getvalue()

    def _build_pass_json(self, ticket: Any) -> Dict[str, Any]:
        """
        Construye la estructura de datos canónica para pass.json tipo eventTicket.
        Aplica contexto del recinto: London Pub en Hermosillo, Sonora (UTC-7).
        """
        event = ticket.event
        seat = ticket.seat

        # 1. Formateo de fecha y hora local (America/Hermosillo UTC-7)
        event_date_str = "03/10/2026"
        doors_time_str = "19:00 HRS"
        relevant_iso_date = None

        if event and event.date:
            try:
                local_dt = localtime(event.date)
                event_date_str = local_dt.strftime("%d/%m/%Y")
                doors_time_str = local_dt.strftime("%H:%M HRS")
                relevant_iso_date = local_dt.isoformat()
            except Exception as dt_err:
                logger.warning(f"[APPLE WALLET] Error al localizar fecha para ticket {ticket.token}: {dt_err}")
                event_date_str = event.date.strftime("%d/%m/%Y")

        venue_name = getattr(event, 'venue_name', '') or (
            event.theater.name if (event and event.theater) else 'Por confirmar'
        )
        venue_address = getattr(event, 'venue_address', '') or (
            event.theater.location if (event and event.theater) else 'Por confirmar'
        )

        # 2. QR Payload autenticado criptográficamente con HMAC-SHA256
        qr_message = generate_qr_payload(ticket, format_type='compact')

        # 3. Categorización y desglose de asiento / zona
        is_comp = bool(ticket.used_coupon and (ticket.used_coupon.is_complimentary or ticket.used_coupon.discount_type == 'free_vip'))
        is_mg = bool(ticket.has_mg or (event and event.event_type == 'meet_greet'))

        if is_mg:
            ticket_type_label = "VIP · MEET & GREET"
        elif is_comp:
            ticket_type_label = "CORTESÍA VIP"
        else:
            ticket_type_label = "GENERAL ADMISIÓN"

        # Secondary Fields: Fecha y Horario de apertura de puertas
        secondary_fields = [
            {
                "key": "event_date",
                "label": "FECHA",
                "value": event_date_str
            },
            {
                "key": "doors_open",
                "label": "ACCESO / PUERTAS",
                "value": doors_time_str
            }
        ]

        # Auxiliary Fields: Desglose de butaca y comprador
        auxiliary_fields = []
        if seat:
            row_str = str(getattr(seat, 'row', '')).strip().upper()
            seat_num_str = str(getattr(seat, 'number', '—'))
            section_str = str(getattr(seat, 'section', 'Preferente')).upper()

            auxiliary_fields.append({
                "key": "seat_section",
                "label": "ZONA",
                "value": section_str
            })
            auxiliary_fields.append({
                "key": "seat_row",
                "label": "FILA",
                "value": row_str or "A"
            })
            auxiliary_fields.append({
                "key": "seat_number",
                "label": "ASIENTO",
                "value": seat_num_str
            })
        elif ticket.ga_zone:
            auxiliary_fields.append({
                "key": "ga_zone",
                "label": "ZONA",
                "value": ticket.ga_zone.name
            })
            auxiliary_fields.append({
                "key": "ga_seat",
                "label": "ASIENTO",
                "value": "Entrada General (De pie)"
            })
        else:
            auxiliary_fields.append({
                "key": "general_entry",
                "label": "ASIENTO",
                "value": "Entrada General (De pie)"
            })

        auxiliary_fields.append({
            "key": "attendee_email",
            "label": "ASISTENTE",
            "value": ticket.user_email
        })

        # Back Fields: Términos, política de reembolso y taquilla física
        back_fields = [
            {
                "key": "venue_details",
                "label": "RECINTO Y DIRECCIÓN",
                "value": f"{venue_name}\n{venue_address}"
            },
            {
                "key": "box_office_policy",
                "label": "CONTROL DE ACCESO Y TAQUILLA FÍSICA",
                "value": (
                    "La venta en línea concluye 2 horas antes de la apertura de puertas. "
                    "Venta de último minuto disponible en taquilla física del recinto conforme a disponibilidad. "
                    "El ingreso requiere la presentación del código QR oficial para validación de acceso."
                )
            },
            {
                "key": "ticket_folio",
                "label": "FOLIO DE CONTROL",
                "value": f"TKT-{ticket.id:06d}"
            },
            {
                "key": "authenticity_token",
                "label": "TOKEN CRIPTOGRÁFICO DE AUTENTICIDAD",
                "value": str(ticket.token)
            },
            {
                "key": "terms_and_conditions",
                "label": "TÉRMINOS Y CONDICIONES",
                "value": (
                    "Este pase digital es personal, único e intransferible. El código QR solo puede "
                    "ser escaneado una única vez en el control de acceso de la puerta. "
                    "Prohibida su reventa o duplicación no autorizada."
                )
            },
            {
                "key": "refund_policy",
                "label": "POLÍTICA DE REEMBOLSOS",
                "value": (
                    "No se admiten cambios ni devoluciones de boletos una vez completada la compra, "
                    "salvo por cancelación definitiva del evento imputable a la producción."
                )
            },
            {
                "key": "support_info",
                "label": "SOPORTE Y ACLARACIONES",
                "value": "contacto@msambar.com · Ms. Ambar Live Experience · Néctar Labs"
            }
        ]

        barcode_config = {
            "format": "PKBarcodeFormatQR",
            "message": qr_message,
            "messageEncoding": "iso-8859-1",
            "altText": f"Folio TKT-{ticket.id:06d}"
        }

        pass_dict: Dict[str, Any] = {
            "formatVersion": 1,
            "passTypeIdentifier": self.pass_type_id,
            "serialNumber": str(ticket.token),
            "teamIdentifier": self.team_id,
            "organizationName": "Ms. Ambar",
            "description": event.title if event else "Ms. Ambar en Concierto",
            "logoText": "Ms. Ambar",
            "foregroundColor": "rgb(244, 246, 240)",
            "backgroundColor": "rgb(12, 14, 20)",      # #0C0E14 solicitado
            "labelColor": "rgb(229, 169, 59)",          # Ámbar / Oro
            "eventTicket": {
                "headerFields": [
                    {
                        "key": "ticket_category",
                        "label": "TIPO DE ENTRADA",
                        "value": ticket_type_label
                    }
                ],
                "primaryFields": [
                    {
                        "key": "event_name",
                        "label": "EVENTO",
                        "value": event.title if event else "Ms. Ambar en Concierto"
                    }
                ],
                "secondaryFields": secondary_fields,
                "auxiliaryFields": auxiliary_fields,
                "backFields": back_fields
            },
            "barcode": barcode_config,
            "barcodes": [barcode_config],
            "locations": [
                {
                    "latitude": 29.0892,
                    "longitude": -110.9613,
                    "relevantText": "London Pub · Presenta tu pase en el acceso"
                }
            ]
        }

        if relevant_iso_date:
            pass_dict["relevantDate"] = relevant_iso_date

        # Configuración opcional de PassKit Web Service (Phase 2 foundations)
        if self.web_service_url:
            pass_dict["webServiceURL"] = self.web_service_url.rstrip('/') + '/'
            pass_dict["authenticationToken"] = hashlib.sha256(
                f"{ticket.token}:{settings.SECRET_KEY}".encode('utf-8')
            ).hexdigest()[:32]

        return pass_dict

    def _generate_graphical_assets(self, ticket: Any) -> Dict[str, bytes]:
        """
        Genera en memoria los activos visuales requeridos por PassKit:
        - icon (29x29, 58x58, 87x87)
        - logo (160x50, 320x100, 480x150)
        - strip (375x98, 750x196, 1125x294)
        """
        assets: Dict[str, bytes] = {}

        # 1. Iconos de aplicación (@1x, @2x, @3x)
        for scale, size in [(1, (29, 29)), (2, (58, 58)), (3, (87, 87))]:
            suffix = f"@{scale}x.png" if scale > 1 else ".png"
            img = Image.new("RGBA", size, color=(12, 14, 20, 255))
            draw = ImageDraw.Draw(img)
            draw.rectangle([(0, 0), (size[0] - 1, size[1] - 1)], outline=(229, 169, 59, 255), width=max(1, scale))
            padding = 4 * scale
            draw.ellipse(
                [(padding, padding), (size[0] - padding, size[1] - padding)],
                fill=(229, 169, 59, 230)
            )
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            assets[f"icon{suffix}"] = buf.getvalue()

        # 2. Logo oficial Ms. Ambar (@1x, @2x, @3x)
        for scale, size in [(1, (160, 50)), (2, (320, 100)), (3, (480, 150))]:
            suffix = f"@{scale}x.png" if scale > 1 else ".png"
            img = Image.new("RGBA", size, color=(12, 14, 20, 0))
            draw = ImageDraw.Draw(img)
            draw.text(
                (12 * scale, 14 * scale),
                "MS. AMBAR",
                fill=(229, 169, 59, 255)
            )
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            assets[f"logo{suffix}"] = buf.getvalue()

        # 3. Strip Banner decorativo superior (@1x, @2x, @3x)
        for scale, size in [(1, (375, 98)), (2, (750, 196)), (3, (1125, 294))]:
            suffix = f"@{scale}x.png" if scale > 1 else ".png"
            img = Image.new("RGBA", size, color=(12, 14, 20, 255))
            draw = ImageDraw.Draw(img)
            draw.line([(0, size[1] - 2), (size[0], size[1] - 2)], fill=(229, 169, 59, 200), width=2 * scale)
            draw.text(
                (20 * scale, 35 * scale),
                "NÉCTAR GATEWAY · PASE OFICIAL",
                fill=(244, 246, 240, 220)
            )
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            assets[f"strip{suffix}"] = buf.getvalue()

        return assets

    def _sign_manifest(self, manifest_bytes: bytes) -> bytes:
        """
        Firma digital PKCS#7 / CMS detached sobre manifest_bytes.
        Utiliza el certificado y clave privada Apple Pass Type ID,
        con el certificado intermedio Apple WWDR G4.
        Incluye fallback sintético en memoria para testing y staging sin credenciales instaladas.
        """
        if self.cert_path and os.path.exists(self.cert_path):
            try:
                from cryptography.hazmat.primitives.serialization import pkcs7, load_pem_private_key
                from cryptography.hazmat.primitives.serialization.pkcs12 import load_key_and_certificates
                from cryptography.hazmat.primitives import hashes, serialization
                from cryptography import x509
                from cryptography.hazmat.backends import default_backend

                with open(self.cert_path, "rb") as f:
                    cert_data = f.read()

                private_key = None
                cert = None
                additional_certs = []
                password_bytes = self.cert_password.encode('utf-8') if self.cert_password else None

                if self.cert_path.endswith(('.p12', '.pfx')):
                    try:
                        private_key, cert, add_certs = load_key_and_certificates(
                            cert_data,
                            password_bytes,
                            backend=default_backend()
                        )
                        if add_certs:
                            additional_certs.extend(add_certs)
                    except Exception as p12_err:
                        logger.error(f"[APPLE WALLET] Error al descifrar contenedor PKCS#12 ({self.cert_path}): {p12_err}")
                else:
                    # 1. Cargar Certificado X.509 PEM
                    try:
                        cert = x509.load_pem_x509_certificate(cert_data, default_backend())
                    except Exception as pem_cert_err:
                        logger.error(f"[APPLE WALLET] Error al cargar certificado X.509 PEM ({self.cert_path}): {pem_cert_err}")

                    # 2. Intentar cargar clave privada desde cert_data
                    try:
                        private_key = load_pem_private_key(cert_data, password=password_bytes, backend=default_backend())
                    except TypeError:
                        try:
                            private_key = load_pem_private_key(cert_data, password=None, backend=default_backend())
                        except Exception as unenc_err:
                            logger.warning(f"[APPLE WALLET] Clave PEM en cert_path requiere contraseña o es inválida: {unenc_err}")
                    except Exception as key_err:
                        logger.debug(f"[APPLE WALLET] Clave privada no hallada en cert_path: {key_err}")

                    # 3. Si no estaba en cert_path, buscar en self.key_path (si está configurado)
                    if not private_key and self.key_path and os.path.exists(self.key_path):
                        try:
                            with open(self.key_path, "rb") as kf:
                                key_data = kf.read()
                            private_key = load_pem_private_key(key_data, password=password_bytes, backend=default_backend())
                        except Exception as sep_key_err:
                            logger.error(f"[APPLE WALLET] Error al cargar clave privada desde key_path ({self.key_path}): {sep_key_err}")

                # 4. Cargar WWDR G4 intermediate (Soporta formatos PEM y DER/ASN.1 nativos de Apple)
                if self.wwdr_path and os.path.exists(self.wwdr_path):
                    try:
                        with open(self.wwdr_path, "rb") as wf:
                            wwdr_data = wf.read()
                        try:
                            wwdr_cert = x509.load_pem_x509_certificate(wwdr_data, default_backend())
                        except Exception:
                            # Apple distribuye AppleWWDRCAG4.cer en DER binario por defecto
                            wwdr_cert = x509.load_der_x509_certificate(wwdr_data, default_backend())
                        additional_certs.append(wwdr_cert)
                    except Exception as wwdr_err:
                        logger.warning(f"[APPLE WALLET] Error al cargar certificado intermedio Apple WWDR ({self.wwdr_path}): {wwdr_err}")

                # 5. Firma PKCS#7 oficial
                if cert and private_key:
                    builder = (
                        pkcs7.PKCS7SignatureBuilder()
                        .set_data(manifest_bytes)
                        .add_signer(cert, private_key, hashes.SHA256())
                    )
                    for extra in additional_certs:
                        builder = builder.add_certificate(extra)

                    return builder.sign(
                        serialization.Encoding.DER,
                        options=[pkcs7.PKCS7Options.DetachedSignature]
                    )
                else:
                    logger.error(
                        f"[APPLE WALLET] Material criptográfico incompleto para PKCS#7 oficial. "
                        f"Certificado={bool(cert)}, ClavePrivada={bool(private_key)}. Se activará fallback sintético."
                    )

            except Exception as e:
                logger.error(f"[APPLE WALLET] Error inesperado al firmar manifest con credenciales Apple: {e}", exc_info=True)

        # Fallback defensivo para desarrollo / pruebas:
        # Generamos una firma auto-contenida con clave temporal en memoria
        logger.warning(
            "[APPLE WALLET] Generando firma PKCS#7 sintética/desarrollo (no apta para validación estricta de iOS en producción)."
        )
        try:
            from cryptography.hazmat.primitives.serialization import pkcs7
            from cryptography.hazmat.primitives.asymmetric import rsa
            from cryptography.hazmat.primitives import hashes, serialization
            from cryptography import x509
            from cryptography.x509.oid import NameOID

            key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            subject = issuer = x509.Name([
                x509.NameAttribute(NameOID.COMMON_NAME, "Ms Ambar Dev Pass Authority"),
            ])
            cert = (
                x509.CertificateBuilder()
                .subject_name(subject)
                .issuer_name(issuer)
                .public_key(key.public_key())
                .serial_number(x509.random_serial_number())
                .not_valid_before(datetime.now(dt_timezone.utc))
                .not_valid_after(datetime.now(dt_timezone.utc) + timedelta(days=365))
                .sign(key, hashes.SHA256())
            )

            builder = (
                pkcs7.PKCS7SignatureBuilder()
                .set_data(manifest_bytes)
                .add_signer(cert, key, hashes.SHA256())
            )
            return builder.sign(
                serialization.Encoding.DER,
                options=[pkcs7.PKCS7Options.DetachedSignature]
            )
        except Exception as e:
            logger.warning(f"[APPLE WALLET] Fallback de firma sintética: {e}")
            return b"MOCK_PKCS7_SIGNATURE_" + hashlib.sha256(manifest_bytes).digest()


# Alias canónico para interoperabilidad con versiones previas
AppleWalletPassGenerator = AppleWalletService
