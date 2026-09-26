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


def generate_cloudinary_signature(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Genera en el servidor la firma HMAC SHA para inicializar el Media Library Widget
    sin exponer el API_SECRET en el cliente.
    """
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
        'default_folder': getattr(settings, 'CLOUDINARY_ENV_FOLDER', 'ms_ambar/staging'),
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
