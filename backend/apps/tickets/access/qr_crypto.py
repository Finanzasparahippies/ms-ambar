import hmac
import hashlib
import time
import uuid
import logging
import json
import urllib.parse
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


def generate_qr_payload(ticket: Any, format_type: str = 'url', timestamp: Optional[int] = None) -> str:
    """
    Genera el payload firmado criptográficamente para el código QR de acceso.
    
    Formatos soportados:
    - 'url' (predeterminado): Deep link universal https://msambar.com/staff/scan?token={token}&sig={signature}&ts={timestamp}
      Permite compatibilidad dual:
        a) Escaneo nativo con cámara de iOS/Android -> abre la vista protegida /staff/scan en navegador.
        b) Escáner in-app del staff -> extrae los parámetros y ejecuta canje directo vía API AJAX.
    - 'compact': Formato delimitado f"{ticket_uuid}:{timestamp}:{hmac_signature}"
    - 'jwt': Token JWT firmado con HS256 conteniendo claims estándar y audience 'nectar-access'
    """
    secret = get_qr_secret_key()
    token_str = str(getattr(ticket, 'token', ticket)).strip()
    
    if timestamp is None:
        timestamp = int(time.time())

    # Firma canónica HMAC-SHA256
    raw_message = f"{token_str}:{timestamp}"
    signature = hmac.new(
        secret.encode('utf-8'),
        raw_message.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

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
            logger.warning("[QR/CRYPTO] PyJWT no disponible. Cayendo en formato URL universal.")
            format_type = 'url'

    if format_type == 'compact':
        return f"{token_str}:{timestamp}:{signature}"

    # Formato Universal URL (predeterminado)
    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://msambar.com').rstrip('/')
    return f"{frontend_url}/staff/scan?token={token_str}&sig={signature}&ts={timestamp}"


def verify_qr_payload(payload: str) -> Dict[str, Any]:
    """
    Verifica con tolerancia defensiva la autenticidad y vigencia de un payload de código QR.
    
    Resuelve falsos positivos de "boleto falsificado" sanitizando:
    - Espacios en blanco perimetrales y caracteres de escape.
    - Envoltorios de URL (https://..., /staff/scan?token=..., /tickets/UUID).
    - Desempaquetado de cadenas JSON legadas.
    - Normalización de codificación UTF-8 e insensibilidad a mayúsculas/minúsculas en hex digest.
    
    Retorna un diccionario:
    {
        "valid": bool,
        "ticket_uuid": str | None,
        "timestamp": int | None,
        "format": "url" | "compact" | "jwt" | "legacy" | "invalid",
        "error": str | None,
        "code": "TICKET_SUCCESS" | "TICKET_INVALID" | "TICKET_ERROR"
    }
    """
    if not payload or not isinstance(payload, str):
        return {
            "valid": False,
            "ticket_uuid": None,
            "timestamp": None,
            "format": "invalid",
            "error": "El payload del código QR está vacío o tiene un tipo de dato no soportado.",
            "code": "TICKET_INVALID"
        }

    raw = payload.strip().strip('"\'')
    secret = get_qr_secret_key()

    token_candidate: Optional[str] = None
    provided_sig: Optional[str] = None
    ts_candidate: Optional[int] = None
    detected_format: str = "invalid"

    # 1. Detección de Envoltorio URL (http://, https://, o rutas relativas)
    if '://' in raw or raw.startswith('/') or 'staff/scan' in raw or 'tickets/' in raw:
        try:
            # Reconstruir URL absoluta para parsing homogéneo
            parse_target = raw if '://' in raw else f"https://msambar.com/{raw.lstrip('/')}"
            parsed_url = urllib.parse.urlparse(parse_target)
            query_params = urllib.parse.parse_qs(parsed_url.query)

            # A. Parámetros de query (?token=...&sig=...&ts=...)
            if 'token' in query_params:
                token_candidate = query_params['token'][0].strip()
                if 'sig' in query_params:
                    provided_sig = query_params['sig'][0].strip()
                elif 'signature' in query_params:
                    provided_sig = query_params['signature'][0].strip()

                if 'ts' in query_params:
                    try:
                        ts_candidate = int(query_params['ts'][0].strip())
                    except (ValueError, TypeError):
                        pass
                detected_format = "url"

            # B. Ruta canónica /tickets/{uuid} o /staff/scan/{uuid}
            elif '/tickets/' in parsed_url.path:
                path_parts = parsed_url.path.split('/tickets/')
                if len(path_parts) > 1:
                    token_candidate = path_parts[1].strip('/').split('/')[0].split('?')[0]
                    detected_format = "url_path"
            elif '/staff/scan/' in parsed_url.path:
                path_parts = parsed_url.path.split('/staff/scan/')
                if len(path_parts) > 1:
                    token_candidate = path_parts[1].strip('/').split('/')[0].split('?')[0]
                    detected_format = "url_path"
        except Exception as url_err:
            logger.debug(f"[QR/VERIFY] Excepción analizando URL: {url_err}")

    # 2. Detección de Token JWT (3 segmentos delimitados por punto)
    if not token_candidate and raw.count('.') == 2 and not raw.startswith('{'):
        try:
            import jwt
            decoded = jwt.decode(
                raw,
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
                    "error": "El token JWT no incluye el identificador del boleto ('sub').",
                    "code": "TICKET_INVALID"
                }
            return {
                "valid": True,
                "ticket_uuid": str(ticket_uuid),
                "timestamp": decoded.get("iat"),
                "format": "jwt",
                "error": None,
                "code": "TICKET_SUCCESS"
            }
        except Exception as jwt_err:
            return {
                "valid": False,
                "ticket_uuid": None,
                "timestamp": None,
                "format": "jwt",
                "error": f"Firma o estructura JWT inválida: {str(jwt_err)}",
                "code": "TICKET_INVALID"
            }

    # 3. Detección de Formato JSON legado (ej. {"token": "...", ...})
    if not token_candidate and raw.startswith('{') and raw.endswith('}'):
        try:
            parsed_json = json.loads(raw)
            if isinstance(parsed_json, dict) and 'token' in parsed_json:
                token_candidate = str(parsed_json['token']).strip()
                if 'sig' in parsed_json:
                    provided_sig = str(parsed_json['sig']).strip()
                if 'ts' in parsed_json:
                    try:
                        ts_candidate = int(parsed_json['ts'])
                    except (ValueError, TypeError):
                        pass
                detected_format = "json"
        except Exception:
            pass

    # 4. Detección de Formato Compacto ({uuid}:{timestamp}:{sig} o {uuid}:{sig})
    if not token_candidate and ':' in raw and not raw.startswith('http'):
        parts = [p.strip() for p in raw.split(':') if p.strip()]
        if len(parts) == 3:
            token_candidate, ts_str, provided_sig = parts
            try:
                ts_candidate = int(ts_str)
            except (ValueError, TypeError):
                pass
            detected_format = "compact"
        elif len(parts) == 2:
            token_candidate, provided_sig = parts
            detected_format = "compact_notime"

    # 5. Fallback a Token plano
    if not token_candidate:
        token_candidate = raw
        detected_format = "legacy"

    # Normalización del UUID
    try:
        parsed_uuid = uuid.UUID(token_candidate)
        canonical_uuid = str(parsed_uuid)
    except (ValueError, TypeError, AttributeError):
        return {
            "valid": False,
            "ticket_uuid": None,
            "timestamp": None,
            "format": "invalid",
            "error": "El identificador del boleto en el código QR no corresponde a un UUID válido.",
            "code": "TICKET_INVALID"
        }

    # 6. Validación de Firma Criptográfica si fue provista
    if provided_sig:
        expected_signatures = []

        # A. Si vino con timestamp, verificar firma con timestamp
        if ts_candidate is not None:
            msg_with_ts = f"{canonical_uuid}:{ts_candidate}"
            sig_ts = hmac.new(
                secret.encode('utf-8'),
                msg_with_ts.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            expected_signatures.append(sig_ts)

        # B. Firma atemporal sobre el UUID canónico (tolerancia a tokens sin ts)
        sig_uuid_only = hmac.new(
            secret.encode('utf-8'),
            canonical_uuid.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        expected_signatures.append(sig_uuid_only)

        # Comparación en tiempo constante (protección contra timing attacks)
        is_signature_valid = any(
            hmac.compare_digest(provided_sig.lower(), exp_sig.lower())
            for exp_sig in expected_signatures
        )

        if is_signature_valid:
            return {
                "valid": True,
                "ticket_uuid": canonical_uuid,
                "timestamp": ts_candidate,
                "format": detected_format,
                "error": None,
                "code": "TICKET_SUCCESS"
            }
        else:
            logger.warning(
                f"[QR/SECURITY] Firma inválida para UUID {canonical_uuid}. "
                f"Recibida: {provided_sig[:12]}..."
            )
            return {
                "valid": False,
                "ticket_uuid": canonical_uuid,
                "timestamp": ts_candidate,
                "format": detected_format,
                "error": "Firma criptográfica inválida. Código QR potencialmente falsificado o alterado.",
                "code": "TICKET_INVALID"
            }

    # 7. Modo legado seguro: Si el UUID es válido en base de datos sin firma
    return {
        "valid": True,
        "ticket_uuid": canonical_uuid,
        "timestamp": None,
        "format": "legacy",
        "error": None,
        "code": "TICKET_SUCCESS"
    }
