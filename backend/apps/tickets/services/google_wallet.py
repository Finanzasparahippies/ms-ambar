import os
import json
import time
import logging
import requests
from typing import Dict, Any, Tuple, Optional
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

    def _get_oauth2_access_token(self) -> Optional[str]:
        """
        Obtiene token Bearer OAuth2 mediante intercambio de aserción JWT firmada con RS256.
        """
        import requests
        email, private_key = self._load_credentials()
        if not email or not private_key:
            return None

        now = int(time.time())
        claims = {
            "iss": email,
            "scope": "https://www.googleapis.com/auth/wallet_object.issuer",
            "aud": "https://oauth2.googleapis.com/token",
            "exp": now + 3600,
            "iat": now
        }

        try:
            assertion = jwt.encode(claims, private_key, algorithm="RS256")
            res = requests.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                    "assertion": assertion
                },
                timeout=5.0
            )
            if res.status_code == 200:
                return res.json().get("access_token")
            logger.error(f"[GOOGLE WALLET] Error token OAuth2 ({res.status_code}): {res.text}")
            return None
        except Exception as e:
            logger.error(f"[GOOGLE WALLET] Excepción obteniendo token OAuth2: {e}")
            return None

    def update_ticket_state(self, ticket: Any, new_state: str = "COMPLETED") -> bool:
        """
        Ejecuta PATCH https://walletobjects.googleapis.com/walletobjects/v1/eventTicketObject/{id}
        para actualizar el estado del pase tras la redención física en el acceso.
        """
        import requests
        object_id = f"{self.issuer_id}.ticket_{ticket.token}"
        token = self._get_oauth2_access_token()
        if not token:
            logger.info(f"[GOOGLE WALLET] Omitiendo PATCH remoto para {object_id} (Modo Local/Dev).")
            return False

        url = f"https://walletobjects.googleapis.com/walletobjects/v1/eventTicketObject/{object_id}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        body = {"state": new_state}

        for attempt in range(3):
            try:
                res = requests.patch(url, headers=headers, json=body, timeout=4.0)
                if res.status_code in [200, 204]:
                    logger.info(f"[GOOGLE WALLET] Estado de boleto {object_id} actualizado a '{new_state}'.")
                    return True
                if res.status_code == 404:
                    logger.warning(f"[GOOGLE WALLET] Objeto {object_id} no existe en servidor de Google.")
                    return False
                time.sleep(0.2 * (2 ** attempt))
            except Exception as patch_err:
                logger.warning(f"[GOOGLE WALLET] Intento {attempt + 1} fallido actualizando estado: {patch_err}")
                time.sleep(0.2 * (2 ** attempt))

        return False
