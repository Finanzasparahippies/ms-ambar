import io
import os
import json
import zipfile
import hashlib
import logging
from typing import Dict, Any, Optional
from django.conf import settings
from django.utils.timezone import localtime
from PIL import Image, ImageDraw, ImageFont

from apps.tickets.utils import format_seat_assignment
from apps.tickets.access.qr_crypto import generate_qr_payload

logger = logging.getLogger(__name__)


class AppleWalletPassGenerator:
    """
    Servicio de compilación, empaquetado y firmado de pases nativos para Apple Wallet (.pkpass).
    Cumple rigurosamente con la especificación Apple PassKit Package Format:
    - pass.json (eventTicket)
    - Iconos y banners en resoluciones @1x, @2x, @3x
    - manifest.json con checksums SHA-1
    - Firma digital PKCS#7 detached contra manifest.json
    """

    def __init__(self):
        self.pass_type_id = getattr(settings, 'APPLE_PASS_TYPE_ID', 'pass.com.msambar.tickets')
        self.team_id = getattr(settings, 'APPLE_TEAM_ID', 'NECTARLABS1')
        self.cert_path = getattr(settings, 'APPLE_CERT_PATH', '')
        self.cert_password = getattr(settings, 'APPLE_CERT_PASSWORD', '')
        self.wwdr_path = getattr(settings, 'APPLE_WWDR_CERT_PATH', '')

    def generate_pass(self, ticket: Any) -> bytes:
        """
        Genera el archivo binario completo .pkpass en memoria.
        """
        pass_data = self._build_pass_json(ticket)
        pass_json_bytes = json.dumps(pass_data, indent=2, ensure_ascii=False).encode('utf-8')

        files_to_pack: Dict[str, bytes] = {
            'pass.json': pass_json_bytes
        }

        # Generar assets gráficos requeridos (@1x, @2x, @3x)
        assets = self._generate_graphical_assets(ticket)
        files_to_pack.update(assets)

        # Generar manifest.json (SHA-1 de cada archivo)
        manifest: Dict[str, str] = {}
        for filename, data in files_to_pack.items():
            manifest[filename] = hashlib.sha1(data).hexdigest()

        manifest_bytes = json.dumps(manifest, indent=2).encode('utf-8')
        files_to_pack['manifest.json'] = manifest_bytes

        # Generar firma digital PKCS#7
        signature_bytes = self._sign_manifest(manifest_bytes)
        files_to_pack['signature'] = signature_bytes

        # Empaquetar todo en un archivo ZIP en memoria
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for filename, data in files_to_pack.items():
                zip_file.writestr(filename, data)

        zip_buffer.seek(0)
        return zip_buffer.getvalue()

    def _build_pass_json(self, ticket: Any) -> Dict[str, Any]:
        """
        Construye la estructura de datos canónica para pass.json tipo eventTicket.
        """
        event = ticket.event
        seat = ticket.seat

        # Formateo de fecha y hora local
        event_date_str = ""
        if event and event.date:
            try:
                local_dt = localtime(event.date)
                event_date_str = local_dt.strftime("%d/%m/%Y · %H:%M HRS")
            except Exception:
                event_date_str = event.date.strftime("%d/%m/%Y")

        # QR payload criptográficamente firmado
        qr_message = generate_qr_payload(ticket, format_type='compact')

        # Asignación de asientos
        secondary_fields = []
        if seat:
            # Fila
            row_str = str(getattr(seat, 'row', '')).strip()
            if row_str:
                secondary_fields.append({
                    "key": "seat_row",
                    "label": "FILA",
                    "value": row_str.upper()
                })

            # Mesa (si aplica)
            seat_label = format_seat_assignment(seat)
            if "Mesa" in seat_label:
                try:
                    import re
                    match = re.search(r'Mesa\s*([0-9A-Za-z]+)', seat_label, re.IGNORECASE)
                    if match:
                        secondary_fields.append({
                            "key": "seat_table",
                            "label": "MESA",
                            "value": match.group(1)
                        })
                except Exception:
                    pass

            # Asiento
            secondary_fields.append({
                "key": "seat_num",
                "label": "ASIENTO",
                "value": str(seat.number)
            })
        elif ticket.ga_zone:
            secondary_fields.append({
                "key": "zone",
                "label": "ZONA",
                "value": ticket.ga_zone.name
            })
        else:
            secondary_fields.append({
                "key": "general",
                "label": "ACCESO",
                "value": "Entrada General (De pie)"
            })

        # Auxiliary fields
        auxiliary_fields = [
            {
                "key": "buyer_name",
                "label": "ASISTENTE",
                "value": ticket.user_email
            },
            {
                "key": "ticket_folio",
                "label": "FOLIO",
                "value": f"#{ticket.id}"
            },
            {
                "key": "event_venue",
                "label": "RECINTO",
                "value": event.venue_name if event and event.venue_name else "London Pub"
            }
        ]

        # Back fields (términos y contacto)
        back_fields = [
            {
                "key": "venue_address",
                "label": "DIRECCIÓN DEL RECINTO",
                "value": getattr(event, 'venue_address', '') or "Hermosillo, Sonora, México."
            },
            {
                "key": "authenticity_token",
                "label": "TOKEN CRIPTOGRÁFICO DE AUTENTICIDAD",
                "value": str(ticket.token)
            },
            {
                "key": "support_info",
                "label": "SOPORTE Y ACLARACIONES",
                "value": "Para dudas respecto a tu acceso, escribe a contacto@msambar.com o ingresa a https://msambar.com"
            },
            {
                "key": "terms",
                "label": "TÉRMINOS Y CONDICIONES",
                "value": (
                    "Este pase digital es personal, único e intransferible. El código QR solo puede "
                    "ser escaneado una única vez en el control de acceso. Prohibida su reventa o duplicación."
                )
            }
        ]

        barcode_config = {
            "format": "PKBarcodeFormatQR",
            "message": qr_message,
            "messageEncoding": "iso-8859-1",
            "altText": f"Folio #{ticket.id}"
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
            "backgroundColor": "rgb(17, 19, 28)",
            "labelColor": "rgb(229, 169, 59)",
            "eventTicket": {
                "primaryFields": [
                    {
                        "key": "event_title",
                        "label": "CONCIERTO",
                        "value": event.title if event else "Ms. Ambar en Concierto"
                    }
                ],
                "secondaryFields": secondary_fields,
                "auxiliaryFields": auxiliary_fields,
                "backFields": back_fields
            },
            "barcode": barcode_config,
            "barcodes": [barcode_config]
        }

        # Header field (fecha o subtítulo)
        if event_date_str:
            pass_dict["eventTicket"]["headerFields"] = [
                {
                    "key": "event_header_date",
                    "label": "FECHA",
                    "value": event_date_str.split('·')[0].strip()
                }
            ]

        return pass_dict

    def _generate_graphical_assets(self, ticket: Any) -> Dict[str, bytes]:
        """
        Genera en memoria los activos visuales oficiales requeridos por PassKit:
        icon (29x29, 58x58, 87x87), logo (160x50, 320x100, 480x150) y strip (375x98, 750x196, 1125x294).
        """
        assets: Dict[str, bytes] = {}

        # 1. Iconos (cuadrado ámbar con monograma 'A')
        for scale, size in [(1, (29, 29)), (2, (58, 58)), (3, (87, 87))]:
            suffix = f"@{scale}x.png" if scale > 1 else ".png"
            img = Image.new("RGBA", size, color=(17, 19, 28, 255))
            draw = ImageDraw.Draw(img)
            # Borde ámbar elegante
            draw.rectangle([(0, 0), (size[0] - 1, size[1] - 1)], outline=(229, 169, 59, 255), width=max(1, scale))
            # Centro con acento dorado
            padding = 4 * scale
            draw.ellipse(
                [(padding, padding), (size[0] - padding, size[1] - padding)],
                fill=(229, 169, 59, 220)
            )
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            assets[f"icon{suffix}"] = buf.getvalue()

        # 2. Logo (Ms. Ambar banner)
        for scale, size in [(1, (160, 50)), (2, (320, 100)), (3, (480, 150))]:
            suffix = f"@{scale}x.png" if scale > 1 else ".png"
            img = Image.new("RGBA", size, color=(17, 19, 28, 0)) # Transparente
            draw = ImageDraw.Draw(img)
            # Dibujar tipografía Ms. Ambar
            draw.text(
                (10 * scale, 12 * scale),
                "MS. AMBAR",
                fill=(229, 169, 59, 255)
            )
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            assets[f"logo{suffix}"] = buf.getvalue()

        # 3. Strip banner superior
        for scale, size in [(1, (375, 98)), (2, (750, 196)), (3, (1125, 294))]:
            suffix = f"@{scale}x.png" if scale > 1 else ".png"
            img = Image.new("RGBA", size, color=(17, 19, 28, 255))
            draw = ImageDraw.Draw(img)
            # Gradiente decorativo superior e inferior
            draw.line([(0, size[1] - 2), (size[0], size[1] - 2)], fill=(229, 169, 59, 180), width=2 * scale)
            draw.text(
                (20 * scale, 35 * scale),
                "NÉCTAR GATEWAY · PASE OFICIAL",
                fill=(244, 246, 240, 200)
            )
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            assets[f"strip{suffix}"] = buf.getvalue()

        return assets

    def _sign_manifest(self, manifest_bytes: bytes) -> bytes:
        """
        Genera la firma PKCS#7 / CMS detached sobre manifest_bytes.
        Si las claves de Apple (.p12 / .pem) están configuradas, utiliza cryptography para firmar.
        Si se encuentra en entorno de desarrollo/testing sin claves instaladas, genera una estructura
        de firma de respaldo para permitir validación de paquete sin interrumpir el flujo.
        """
        if self.cert_path and os.path.exists(self.cert_path):
            try:
                from cryptography.hazmat.primitives.serialization import pkcs7, load_pem_private_key
                from cryptography.hazmat.primitives.serialization.pkcs12 import load_key_and_certificates
                from cryptography.hazmat.primitives import hashes
                from cryptography import x509
                from cryptography.hazmat.backends import default_backend

                with open(self.cert_path, "rb") as f:
                    cert_data = f.read()

                private_key = None
                cert = None
                additional_certs = []

                if self.cert_path.endswith('.p12') or self.cert_path.endswith('.pfx'):
                    password = self.cert_password.encode('utf-8') if self.cert_password else None
                    private_key, cert, add_certs = load_key_and_certificates(
                        cert_data,
                        password,
                        backend=default_backend()
                    )
                    if add_certs:
                        additional_certs.extend(add_certs)
                else:
                    # Formato PEM
                    cert = x509.load_pem_x509_certificate(cert_data, default_backend())
                    # Asumimos que la llave privada está en el mismo archivo o separada
                    try:
                        private_key = load_pem_private_key(cert_data, password=None, backend=default_backend())
                    except Exception:
                        pass

                # Cargar WWDR intermediate si existe
                if self.wwdr_path and os.path.exists(self.wwdr_path):
                    with open(self.wwdr_path, "rb") as wf:
                        wwdr_cert = x509.load_pem_x509_certificate(wf.read(), default_backend())
                        additional_certs.append(wwdr_cert)

                if cert and private_key:
                    builder = (
                        pkcs7.PKCS7SignatureBuilder()
                        .set_data(manifest_bytes)
                        .add_signer(cert, private_key, hashes.SHA256())
                    )
                    for extra in additional_certs:
                        builder = builder.add_certificate(extra)

                    from cryptography.hazmat.primitives import serialization
                    return builder.sign(
                        serialization.Encoding.DER,
                        options=[pkcs7.PKCS7Options.DetachedSignature]
                    )

            except Exception as e:
                logger.error(f"[APPLE WALLET] Error al firmar con certificado PKCS#7 oficial: {e}")

        # Fallback defensivo para desarrollo / pruebas:
        # Generamos una firma auto-contenida con clave temporal en memoria
        logger.info("[APPLE WALLET] Usando firma PKCS#7 en memoria de desarrollo (certificados Apple no configurados en .env).")
        try:
            from cryptography.hazmat.primitives.serialization import pkcs7
            from cryptography.hazmat.primitives.asymmetric import rsa
            from cryptography.hazmat.primitives import hashes, serialization
            from cryptography import x509
            from cryptography.x509.oid import NameOID
            import datetime

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
                .not_valid_before(datetime.datetime.now(datetime.timezone.utc))
                .not_valid_after(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=365))
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
