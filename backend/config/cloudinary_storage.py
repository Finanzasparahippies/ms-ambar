import os
import time
from typing import Dict, Any, Optional
import cloudinary
import cloudinary.uploader
import cloudinary.utils
from cloudinary_storage.storage import MediaCloudinaryStorage
from django.conf import settings
from django.contrib.admin.views.decorators import staff_member_required
from django.http import JsonResponse, HttpRequest, HttpResponseForbidden
from django.views.decorators.http import require_GET


class EnvironmentMediaCloudinaryStorage(MediaCloudinaryStorage):
    """
    Storage de Cloudinary con aislamiento estricto por entorno.
    Garantiza:
    - Destino en subcarpeta por entorno: ms_ambar/staging/ o ms_ambar/prod/
    - Prevención de colisiones con unique_filename=True y overwrite=False
    - Clasificación unívoca con tags de entorno ('staging' o 'production')
    """

    def _upload(self, name: str, content: Any) -> Dict[str, Any]:
        options = {
            'use_filename': True,
            'unique_filename': True,
            'overwrite': False,
            'resource_type': self._get_resource_type(name),
            'tags': [self.TAG] if isinstance(self.TAG, str) else list(self.TAG or []),
        }
        folder = os.path.dirname(name)
        if folder:
            options['folder'] = folder
        return cloudinary.uploader.upload(content, **options)

    def url(self, name: str) -> str:
        if not name:
            return ""
        # 1. Si ya es una URL absoluta o vino anidada con otra URL, limpiar y devolver
        if 'https://res.cloudinary.com' in name or 'http://res.cloudinary.com' in name:
            parts = name.split('https://res.cloudinary.com')
            clean_url = f"https://res.cloudinary.com{parts[-1]}"
            return clean_url.replace('/ms_ambar/prod/ms-ambar/', '/ms-ambar/').replace('/ms_ambar/staging/ms-ambar/', '/ms-ambar/')
        if name.startswith('http://') or name.startswith('https://'):
            return name

        # 2. Si ya contiene el prefijo de entorno o el prefijo de galería heredado, no anteponer PREFIX
        prefix = settings.CLOUDINARY_STORAGE.get('PREFIX', '')
        clean_name = name.strip()
        if prefix and clean_name.startswith(prefix):
            pass
        elif clean_name.startswith('ms-ambar/') or clean_name.startswith('ms_ambar/'):
            pass
        elif prefix:
            clean_name = f"{prefix}{clean_name.lstrip('/')}"

        # Generar URL segura de Cloudinary
        cld_url, _ = cloudinary.utils.cloudinary_url(clean_name, secure=True)
        return cld_url


_ENSURED_FOLDERS = set()


def ensure_cloudinary_folder(folder_path: str) -> None:
    """
    Garantiza que la carpeta raíz exista en Cloudinary para que el Media Library
    no genere errores 404 ni reintentos al inspeccionar rutas inexistentes.
    """
    if not folder_path or folder_path in _ENSURED_FOLDERS:
        return
    try:
        import cloudinary.api
        import cloudinary.exceptions
        cloudinary.api.create_folder(folder_path)
    except cloudinary.exceptions.AlreadyExists:
        pass
    except (cloudinary.exceptions.AuthorizationRequired, cloudinary.exceptions.GeneralError) as cld_err:
        import logging
        logging.getLogger('config.cloudinary').warning(f"No se pudo asegurar carpeta '{folder_path}' en Cloudinary: {cld_err}")
    except Exception as exc:
        import logging
        logging.getLogger('config.cloudinary').debug(f"Verificación de carpeta '{folder_path}' en Cloudinary: {exc}")
    finally:
        _ENSURED_FOLDERS.add(folder_path)


def generate_cloudinary_signature(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Genera en el servidor la firma HMAC SHA para inicializar el Media Library Widget
    sin exponer el API_SECRET en el cliente.
    """
    default_folder = getattr(settings, 'CLOUDINARY_ENV_FOLDER', 'ms_ambar/staging')
    ensure_cloudinary_folder(default_folder)

    timestamp = int(time.time())
    payload = {'timestamp': timestamp}
    if params:
        payload.update(params)

    api_secret = settings.CLOUDINARY_STORAGE.get('API_SECRET', '')
    if not api_secret:
        import logging
        logging.getLogger('config.cloudinary').warning("CLOUDINARY_STORAGE['API_SECRET'] no está configurado.")
        signature = ""
    else:
        try:
            signature = cloudinary.utils.api_sign_request(payload, api_secret)
        except Exception as e:
            import logging
            logging.getLogger('config.cloudinary').error(f"Falla al firmar payload de Cloudinary: {e}")
            signature = ""

    return {
        'cloud_name': settings.CLOUDINARY_STORAGE.get('CLOUD_NAME', ''),
        'api_key': settings.CLOUDINARY_STORAGE.get('API_KEY', ''),
        'timestamp': timestamp,
        'signature': signature,
        'default_folder': default_folder,
        'environment': getattr(settings, 'CLOUDINARY_ENV_TAG', 'staging'),
    }


@staff_member_required
@require_GET
def cloudinary_signature_view(request: HttpRequest) -> JsonResponse:
    """
    Endpoint autenticado para administradores de Django que provee
    parámetros y firma criptográfica para el Cloudinary Media Library Widget.
    """
    if not (request.user.is_authenticated and request.user.is_staff):
        return JsonResponse({'error': 'Permiso denegado. Se requiere cuenta de administrador.'}, status=403)

    try:
        data = generate_cloudinary_signature()
        if not data.get('signature'):
            return JsonResponse({'error': 'Configuración de Cloudinary incompleta en el servidor.'}, status=503)
        return JsonResponse(data)
    except Exception as exc:
        import logging
        logging.getLogger('config.cloudinary').error(f"Error generando firma de Cloudinary: {exc}", exc_info=True)
        return JsonResponse({'error': 'Error interno al generar firma de Cloudinary.', 'detail': str(exc)}, status=500)


def fetch_cloudinary_assets(max_results: int = 80, prefix: Optional[str] = None) -> list:
    """
    Obtiene la lista consolidada de assets visuales desde Cloudinary API y GalleryItem en BD.
    Permite selección in-app inmediata sin depender de iframes de terceros ni sesiones OAuth.
    """
    import logging
    logger = logging.getLogger('config.cloudinary')
    assets = []
    seen_ids = set()

    # 1. Consultar Cloudinary API directamente
    cld_storage = getattr(settings, 'CLOUDINARY_STORAGE', {})
    cloud_name = cld_storage.get('CLOUD_NAME', '')
    api_key = cld_storage.get('API_KEY', '')
    api_secret = cld_storage.get('API_SECRET', '')

    if cloud_name and api_key and api_secret and cloud_name != 'your_cloudinary_name':
        try:
            import cloudinary.api
            import cloudinary.exceptions
            query_kwargs = {
                'type': 'upload',
                'resource_type': 'image',
                'max_results': min(max_results, 100),
            }
            if prefix:
                query_kwargs['prefix'] = prefix

            res = cloudinary.api.resources(**query_kwargs)
            for item in res.get('resources', []):
                pid = item.get('public_id')
                if pid and pid not in seen_ids:
                    seen_ids.add(pid)
                    assets.append({
                        'public_id': pid,
                        'secure_url': item.get('secure_url', ''),
                        'format': item.get('format', ''),
                        'bytes': item.get('bytes', 0),
                        'width': item.get('width', 0),
                        'height': item.get('height', 0),
                        'created_at': item.get('created_at', ''),
                    })
        except Exception as exc:
            logger.warning(f"Error consultando recursos remotos de Cloudinary: {exc}")

    # 2. Complementar con GalleryItems almacenados en BD
    try:
        from apps.gallery.models import GalleryItem
        g_items = GalleryItem.objects.filter(media_type='image').order_by('-created_at')[:max_results]
        for g in g_items:
            pid = g.public_id or ''
            if pid and pid in seen_ids:
                continue
            if pid:
                seen_ids.add(pid)
            url = g.optimized_url or g.url
            if url:
                assets.append({
                    'public_id': pid or url,
                    'secure_url': url,
                    'format': 'webp' if '.webp' in url else 'jpg',
                    'bytes': 0,
                    'width': g.width or 0,
                    'height': g.height or 0,
                    'created_at': g.created_at.isoformat() if g.created_at else '',
                })
    except Exception as exc:
        logger.debug(f"Error consultando GalleryItems locales: {exc}")

    return assets


@staff_member_required
@require_GET
def cloudinary_assets_view(request: HttpRequest) -> JsonResponse:
    """
    Endpoint autenticado para administradores de Django que retorna la lista
    de assets disponibles en Cloudinary para el selector in-app.
    """
    if not (request.user.is_authenticated and request.user.is_staff):
        return JsonResponse({'error': 'Permiso denegado. Se requiere cuenta de administrador.'}, status=403)

    try:
        prefix = request.GET.get('prefix')
        assets = fetch_cloudinary_assets(max_results=80, prefix=prefix)
        return JsonResponse({'assets': assets})
    except Exception as exc:
        import logging
        logging.getLogger('config.cloudinary').error(f"Error en cloudinary_assets_view: {exc}", exc_info=True)
        return JsonResponse({'assets': [], 'error': str(exc)}, status=500)
