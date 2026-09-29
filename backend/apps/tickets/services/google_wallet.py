import os
import json
import time
import logging
from typing import Dict, Any, Tuple
from django.conf import settings
from apps.tickets.utils import format_seat_assignment
from apps.tickets.access.qr_crypto import generate_qr_payload

logger = logging.getLogger(__name__)


class GoogleWalletService:
    """
    Servicio de integración con la API de Google Wallet (Event Tickets).
    Construye las definiciones de EventTicketClass y EventTicketObject,
    firmando criptográficamente el JWT con credenciales de Service Account de Google Cloud
    para generar el enlace directo: https://pay.google.com/gp/v/save/{signed_jwt}
    """

    def __init__(self):
        self.issuer_id = getattr(settings, 'GOOGLE_WALLET_ISSUER_ID', '') or '3388000000022114400'
        self.service_account_file = getattr(settings, 'GOOGLE_WALLET_SERVICE_ACCOUNT_KEY_FILE', '')
        self.service_account_email = getattr(settings, 'GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL', '')
        self.private_key = getattr(settings, 'GOOGLE_WALLET_PRIVATE_KEY', '')

    def _load_credentials(self) -> Tuple[str, str]:
        """
        Carga el email del Service Account y su llave privada RSA en formato PEM.
        """
        email = self.service_account_email
        private_key = self.private_key

        if self.service_account_file and os.path.exists(self.service_account_file):
            try:
                with open(self.service_account_file, 'r', encoding='utf-8') as f:
                    sa_data = json.load(f)
                    email = sa_data.get('client_email', email)
                    private_key = sa_data.get('private_key', private_key)
            except Exception as e:
                logger.error(f"[GOOGLE WALLET] Error al leer archivo de Service Account: {e}")

        return email, private_key

    def build_event_ticket_class(self, event: Any) -> Dict[str, Any]:
        """
        Construye la clase del evento (EventTicketClass) según la especificación de Google Wallet.
        """
        class_id = f"{self.issuer_id}.event_{event.id}"
        venue_name = getattr(event, 'venue_name', '') or 'London Pub'
        venue_address = getattr(event, 'venue_address', '') or 'Hermosillo, Sonora, México'
        doors_open = event.date.isoformat() if (event and event.date) else "2026-10-03T19:00:00Z"
        start_time = event.date.isoformat() if (event and event.date) else "2026-10-03T20:00:00Z"

        return {
            "id": class_id,
            "issuerName": "Ms. Ambar",
            "eventName": {
                "defaultValue": {
                    "language": "es-419",
                    "value": event.title if event else "Ms. Ambar en Concierto"
                }
            },
            "venue": {
                "name": {
                    "defaultValue": {
                        "language": "es-419",
                        "value": venue_name
                    }
                },
                "address": {
                    "defaultValue": {
                        "language": "es-419",
                        "value": venue_address
                    }
                }
            },
            "dateTime": {
                "doorsOpen": doors_open,
                "start": start_time
            },
            "hexBackgroundColor": "#11131c",
            "reviewStatus": "UNDER_REVIEW"
        }

    def build_event_ticket_object(self, ticket: Any, class_id: str) -> Dict[str, Any]:
        """
        Construye el objeto individual de boleto (EventTicketObject).
        """
        object_id = f"{self.issuer_id}.ticket_{ticket.token}"
        seat = ticket.seat
        canonical_location = (
            format_seat_assignment(seat)
            if seat
            else (ticket.ga_zone.name if ticket.ga_zone else "Entrada General (De pie)")
        )

        qr_payload = generate_qr_payload(ticket, format_type='compact')

        row_str = str(getattr(seat, 'row', '—')) if seat else '—'
        seat_num_str = str(getattr(seat, 'number', '—')) if seat else '—'
        section_str = str(getattr(seat, 'section', 'General')) if seat else (
            ticket.ga_zone.name if ticket.ga_zone else 'General'
        )

        ticket_object: Dict[str, Any] = {
            "id": object_id,
            "classId": class_id,
            "state": "ACTIVE",
            "ticketHolderName": ticket.user_email,
            "ticketNumber": str(ticket.id),
            "barcode": {
                "type": "QR_CODE",
                "value": qr_payload,
                "alternateText": f"Folio #{ticket.id}"
            },
            "seatInfo": {
                "row": {
                    "defaultValue": {
                        "language": "es-419",
                        "value": row_str.upper()
                    }
                },
                "seat": {
                    "defaultValue": {
                        "language": "es-419",
                        "value": seat_num_str
                    }
                },
                "section": {
                    "defaultValue": {
                        "language": "es-419",
                        "value": section_str
                    }
                }
            },
            "textModulesData": [
                {
                    "id": "assignment_full",
                    "header": "UBICACIÓN ASIGNADA",
                    "body": canonical_location
                },
                {
                    "id": "folio_info",
                    "header": "FOLIO DE CONTROL",
                    "body": f"#{ticket.id} · Token: {str(ticket.token)[:8]}..."
                },
                {
                    "id": "notice",
                    "header": "ACCESO ÚNICO",
                    "body": "Presenta el código QR en el acceso del recinto. Válido para 1 escaneo."
                }
            ]
        }

        return ticket_object

    def generate_save_url(self, ticket: Any) -> Dict[str, str]:
        """
        Crea las entidades de Google Wallet, empaqueta el payload en un JWT firmado con RS256
        y retorna la URL de guardado directo (Save to Google Wallet).
        """
        import jwt

        event_class = self.build_event_ticket_class(ticket.event)
        event_object = self.build_event_ticket_object(ticket, event_class["id"])

        email, private_key = self._load_credentials()

        frontend_url = getattr(settings, 'FRONTEND_URL', 'https://msambar.com')
        origins = [
            frontend_url,
            "https://msambar.com",
            "https://www.msambar.com",
            "http://localhost:3000"
        ]

        claims = {
            "iss": email or "ms-ambar-wallet@nectar-labs-prod.iam.gserviceaccount.com",
            "aud": "google",
            "typ": "savetowallet",
            "iat": int(time.time()),
            "origins": origins,
            "payload": {
                "eventTicketClasses": [event_class],
                "eventTicketObjects": [event_object]
            }
        }

        # Firma del JWT con RSA Private Key
        signed_jwt = ""
        if private_key:
            try:
                signed_jwt = jwt.encode(claims, private_key, algorithm="RS256")
            except Exception as e:
                logger.error(f"[GOOGLE WALLET] Error al firmar JWT con llave privada de Service Account: {e}")

        # Fallback para entorno de desarrollo si la Service Account aún no tiene llave configurada
        if not signed_jwt:
            logger.info("[GOOGLE WALLET] Generando JWT de desarrollo para pruebas locales.")
            try:
                from cryptography.hazmat.primitives.asymmetric import rsa
                from cryptography.hazmat.primitives import serialization

                dev_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
                dev_pem = dev_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption()
                ).decode('utf-8')
                signed_jwt = jwt.encode(claims, dev_pem, algorithm="RS256")
            except Exception:
                signed_jwt = jwt.encode(claims, "ms-ambar-google-wallet-dev-secret-key-32b", algorithm="HS256")

        save_url = f"https://pay.google.com/gp/v/save/{signed_jwt}"

        return {
            "save_url": save_url,
            "jwt": signed_jwt,
            "class_id": event_class["id"],
            "object_id": event_object["id"]
        }
