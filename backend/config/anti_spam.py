import logging
import os
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

DISPOSABLE_TLDS = ('.ru', '.xyz')
DISPOSABLE_KEYWORDS = (
    'tempmail',
    'mailinator',
    'yopmail',
    'guerrillamail',
    '10minutemail',
    'dispostable',
    'trashmail',
    'throwawaymail',
    'fakeinbox',
    'sharklasers',
    'disposable',
    'mytemp',
    'mohmal',
    'getnada'
)

def get_client_ip(request):
    """
    Extracts the real client IP address, handling proxies like Nginx.
    """
    if not request:
        return '127.0.0.1'
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR', '127.0.0.1')
    return ip

def is_disposable_email(email: str) -> bool:
    """
    Checks whether an email address uses a known disposable domain or high-risk TLD.
    """
    if not email or '@' not in email:
        return False
    
    email_clean = email.strip().lower()
    domain = email_clean.split('@')[-1]
    
    if any(domain.endswith(tld) for tld in DISPOSABLE_TLDS):
        return True
        
    if any(keyword in domain for keyword in DISPOSABLE_KEYWORDS):
        return True
        
    return False

def validate_turnstile_token(token: str, remote_ip: str = '127.0.0.1') -> tuple[bool, str | None]:
    """
    Validates Cloudflare Turnstile token against siteverify API with 3.0s timeout & fail-open resilience.
    """
    secret_key = getattr(settings, 'CLOUDFLARE_TURNSTILE_SECRET_KEY', '') or os.environ.get('CLOUDFLARE_TURNSTILE_SECRET_KEY', '')
    
    # Bypass verification if secret key is not configured (e.g., local dev or testing without key)
    if not secret_key:
        return True, None

    if not token:
        logger.warning(f"Anti-spam trigger [MISSING_TURNSTILE_TOKEN]: Registration attempt without Turnstile token from IP {remote_ip}")
        return False, "Se requiere la verificación de seguridad Turnstile."

    try:
        response = requests.post(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            data={
                'secret': secret_key,
                'response': token,
                'remoteip': remote_ip
            },
            timeout=3.0
        )
        result = response.json()
        if not result.get('success', False):
            logger.warning(f"Anti-spam trigger [TURNSTILE_FAILED]: Turnstile siteverify failed from IP {remote_ip}: {result}")
            return False, "La verificación de seguridad de Turnstile no ha sido superada."
            
        return True, None
    except (requests.Timeout, requests.RequestException) as exc:
        # Circuit Breaker / Fail-Open Resilience
        logger.warning(f"Anti-spam warning [TURNSTILE_TIMEOUT_FAIL_OPEN]: Turnstile API call failed/timed out from IP {remote_ip}: {exc}")
        return True, None

def validate_registration_anti_spam(data: dict, request=None, remote_ip: str = None) -> tuple[bool, str | None]:
    """
    Combined anti-spam validator for registration & subscription endpoints.
    """
    if not remote_ip and request:
        remote_ip = get_client_ip(request)
    elif not remote_ip:
        remote_ip = '127.0.0.1'

    email = data.get('email', '')
    if is_disposable_email(email):
        logger.warning(f"Anti-spam trigger [DISPOSABLE_EMAIL]: Rejected email '{email}' from IP {remote_ip}")
        return False, "El dominio del correo electrónico no está permitido por seguridad."

    turnstile_token = data.get('turnstile_token') or data.get('cf_turnstile_response') or data.get('turnstileToken')
    is_valid_turnstile, turnstile_err = validate_turnstile_token(turnstile_token, remote_ip)
    if not is_valid_turnstile:
        return False, turnstile_err

    return True, None
