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
            return f"https://res.cloudinary.com{parts[-1]}"
        if name.startswith('http://') or name.startswith('https://'):
            return name

        # 2. Si ya contiene el prefijo de entorno o el prefijo de galería heredado, no anteponer PREFIX
        prefix = settings.CLOUDINARY_STORAGE.get('PREFIX', '')
        if prefix and name.startswith(prefix):
            clean_name = name
        elif name.startswith('ms-ambar/') or name.startswith('ms_ambar/'):
            clean_name = name
        elif prefix:
            clean_name = prefix + name
        else:
            clean_name = name

        return cloudinary.utils.cloudinary_url(clean_name)[0]


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
        cloudinary.api.create_folder(folder_path)
    except Exception:
        pass
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
    signature = cloudinary.utils.api_sign_request(payload, api_secret)

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
        return JsonResponse({'error': 'Permiso denegado.'}, status=403)

    data = generate_cloudinary_signature()
    return JsonResponse(data)
