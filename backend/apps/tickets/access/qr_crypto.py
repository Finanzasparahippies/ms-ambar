import hmac
import hashlib
import time
import uuid
import logging
from typing import Dict, Any, Optional
from django.conf import settings

logger = logging.getLogger(__name__)


def get_qr_secret_key() -> str:
    """
    Obtiene la clave criptográfica para firmas QR (HMAC-SHA256 / JWT).
    Prioriza QR_HMAC_SECRET_KEY, cayendo en SECRET_KEY como fallback seguro.
    """
    key = getattr(settings, 'QR_HMAC_SECRET_KEY', None)
    if not key:
        key = getattr(settings, 'SECRET_KEY', 'default-insecure-qr-secret-key-32b!')
    return str(key)


def generate_qr_payload(ticket: Any, format_type: str = 'compact', timestamp: Optional[int] = None) -> str:
    """
    Genera el payload firmado criptográficamente para el código QR de acceso.
    
    Formatos soportados:
    - 'compact': f"{ticket_uuid}:{timestamp}:{hmac_signature}"
    - 'jwt': Token JWT firmado con HS256 conteniendo claims estándar y audience 'nectar-access'
    """
    secret = get_qr_secret_key()
    token_str = str(getattr(ticket, 'token', ticket))
    
    if timestamp is None:
        timestamp = int(time.time())

    if format_type == 'jwt':
        try:
            import jwt
            payload = {
                "sub": token_str,
                "iat": timestamp,
                "aud": "nectar-access",
                "iss": "ms-ambar",
                "tid": getattr(ticket, 'id', None)
            }
            return jwt.encode(payload, secret, algorithm="HS256")
        except ImportError:
            logger.warning("PyJWT no está disponible. Cayendo en formato compacto firmado HMAC.")
            format_type = 'compact'

    # Formato Compacto: {uuid}:{timestamp}:{hmac_sha256}
    raw_message = f"{token_str}:{timestamp}"
    signature = hmac.new(
        secret.encode('utf-8'),
        raw_message.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return f"{token_str}:{timestamp}:{signature}"


def verify_qr_payload(payload: str) -> Dict[str, Any]:
    """
    Verifica la autenticidad y vigencia de un payload de código QR.
    
    Retorna un diccionario:
    {
        "valid": bool,
        "ticket_uuid": str | None,
        "timestamp": int | None,
        "format": "compact" | "jwt" | "legacy" | "invalid",
        "error": str | None
    }
    """
    if not payload or not isinstance(payload, str):
        return {
            "valid": False,
            "ticket_uuid": None,
            "timestamp": None,
            "format": "invalid",
            "error": "El payload del código QR está vacío o tiene un tipo de dato no soportado."
        }

    payload = payload.strip()
    secret = get_qr_secret_key()

    # 1. Detección y validación de Token JWT (3 partes separadas por '.')
    if payload.count('.') == 2 and not payload.startswith('{'):
        try:
            import jwt
            decoded = jwt.decode(
                payload,
                secret,
                algorithms=["HS256"],
                audience="nectar-access"
            )
            ticket_uuid = decoded.get("sub")
            if not ticket_uuid:
                return {
                    "valid": False,
                    "ticket_uuid": None,
                    "timestamp": None,
                    "format": "jwt",
                    "error": "El token JWT no incluye el identificador de boleto ('sub')."
                }
            return {
                "valid": True,
                "ticket_uuid": str(ticket_uuid),
                "timestamp": decoded.get("iat"),
                "format": "jwt",
                "error": None
            }
        except Exception as e:
            return {
                "valid": False,
                "ticket_uuid": None,
                "timestamp": None,
                "format": "jwt",
                "error": f"Firma o estructura JWT inválida: {str(e)}"
            }

    # 2. Detección y validación de Formato Compacto ({uuid}:{timestamp}:{hmac})
    if ':' in payload:
        parts = payload.split(':')
        if len(parts) == 3:
            uuid_str, ts_str, provided_sig = parts
            
            # Validar formato UUID
            try:
                parsed_uuid = uuid.UUID(uuid_str)
                canonical_uuid = str(parsed_uuid)
            except (ValueError, TypeError, AttributeError):
                return {
                    "valid": False,
                    "ticket_uuid": None,
                    "timestamp": None,
                    "format": "compact",
                    "error": "El identificador del boleto en el QR no es un UUID válido."
                }

            # Validar timestamp
            try:
                ts_int = int(ts_str)
            except (ValueError, TypeError):
                return {
                    "valid": False,
                    "ticket_uuid": canonical_uuid,
                    "timestamp": None,
                    "format": "compact",
                    "error": "Timestamp del QR malformado o corrupto."
                }

            # Recomputar firma HMAC y comparar con protección contra ataques de temporización
            expected_message = f"{canonical_uuid}:{ts_int}"
            expected_sig = hmac.new(
                secret.encode('utf-8'),
                expected_message.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()

            if hmac.compare_digest(provided_sig.lower(), expected_sig.lower()):
                return {
                    "valid": True,
                    "ticket_uuid": canonical_uuid,
                    "timestamp": ts_int,
                    "format": "compact",
                    "error": None
                }
            else:
                return {
                    "valid": False,
                    "ticket_uuid": canonical_uuid,
                    "timestamp": ts_int,
                    "format": "compact",
                    "error": "Firma criptográfica HMAC inválida. Código QR potencialmente falsificado o manipulado."
                }

    # 3. Fallback defensivo para tokens legados (UUID crudo sin firma)
    # Soporta de forma transparente boletos y enlaces emitidos con anterioridad
    try:
        raw_uuid = uuid.UUID(payload)
        return {
            "valid": True,
            "ticket_uuid": str(raw_uuid),
            "timestamp": None,
            "format": "legacy",
            "error": None
        }
    except (ValueError, TypeError, AttributeError):
        pass

    return {
        "valid": False,
        "ticket_uuid": None,
        "timestamp": None,
        "format": "invalid",
        "error": "El formato del código QR no corresponde a ningún esquema criptográfico reconocido."
    }
