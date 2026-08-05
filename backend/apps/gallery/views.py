import re
import uuid
import logging
import requests
import cloudinary.utils
from django.conf import settings
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from .models import GalleryItem
from .serializers import GalleryItemSerializer

logger = logging.getLogger(__name__)

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated and request.user.is_staff

class GalleryItemViewSet(viewsets.ModelViewSet):
    queryset = GalleryItem.objects.all()
    serializer_class = GalleryItemSerializer
    permission_classes = [IsAdminOrReadOnly]

    @action(detail=False, methods=['POST'], permission_classes=[permissions.IsAdminUser])
    def signature(self, request):
        """
        Genera una firma presignada para subir archivos directamente a Cloudinary.
        """
        media_type = request.data.get('media_type')
        file_size = request.data.get('file_size')

        if not media_type or media_type not in ['image', 'video']:
            raise ValidationError({'media_type': 'Debe especificar un media_type válido: "image" o "video".'})

        if not file_size:
            raise ValidationError({'file_size': 'Debe especificar el tamaño del archivo en bytes.'})

        try:
            file_size = int(file_size)
        except ValueError:
            raise ValidationError({'file_size': 'El tamaño del archivo debe ser un número entero.'})

        # Límites de tamaño (Edge Cases)
        MAX_IMAGE_SIZE = 10 * 1024 * 1024 # 10MB
        MAX_VIDEO_SIZE = 100 * 1024 * 1024 # 100MB

        if media_type == 'image' and file_size > MAX_IMAGE_SIZE:
            raise ValidationError({'file_size': 'La imagen excede el límite de 10MB.'})
        
        if media_type == 'video' and file_size > MAX_VIDEO_SIZE:
            raise ValidationError({'file_size': 'El video excede el límite de 100MB.'})

        unique_id = uuid.uuid4().hex
        public_id = f"gallery_{media_type}_{unique_id}"
        timestamp = int(timezone.now().timestamp())
        folder = "ms-ambar/gallery"

        params = {
            'timestamp': timestamp,
            'folder': folder,
            'public_id': public_id,
        }

        try:
            signature = cloudinary.utils.api_sign_request(params, settings.CLOUDINARY_STORAGE['API_SECRET'])
        except Exception as e:
            logger.error(f"Error generando firma de Cloudinary: {str(e)}")
            return Response(
                {'error': 'No se pudo generar la firma de subida. Verifique la configuración de Cloudinary.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({
            'signature': signature,
            'timestamp': timestamp,
            'folder': folder,
            'public_id': public_id,
            'api_key': settings.CLOUDINARY_STORAGE['API_KEY'],
            'cloud_name': settings.CLOUDINARY_STORAGE['CLOUD_NAME'],
        })

    @action(detail=False, methods=['POST'], permission_classes=[permissions.IsAdminUser])
    def parse_external_url(self, request):
        """
        Recibe una URL externa (YouTube, Instagram, Vimeo, TikTok)
        y extrae metadatos, miniaturas e embed_url correspondientes.
        """
        url = request.data.get('url', '').strip()
        if not url:
            raise ValidationError({'url': 'La URL es requerida.'})

        # Expresiones regulares para los proveedores soportados
        yt_regex = r'(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})'
        insta_regex = r'instagram\.com\/(?:p|reel)\/([a-zA-Z0-9_-]+)'
        vimeo_regex = r'vimeo\.com\/(?:video\/)?([0-9]+)'
        tiktok_regex = r'tiktok\.com\/@[^\/]+\/video\/([0-9]+)'

        provider = None
        external_id = None
        embed_url = None
        thumbnail_url = None
        media_type = 'video' # Por defecto la mayoría externos son videos
        title = ""
        width = 1280
        height = 720

        # Evaluar proveedor
        yt_match = re.search(yt_regex, url)
        insta_match = re.search(insta_regex, url)
        vimeo_match = re.search(vimeo_regex, url)
        tiktok_match = re.search(tiktok_regex, url)

        if yt_match:
            provider = 'youtube'
            external_id = yt_match.group(1)
            embed_url = f"https://www.youtube-nocookie.com/embed/{external_id}"
            thumbnail_url = f"https://img.youtube.com/vi/{external_id}/hqdefault.jpg"
            media_type = 'video'
            
            # Obtener título mediante oEmbed
            try:
                oembed_url = f"https://www.youtube.com/oembed?url={url}&format=json"
                res = requests.get(oembed_url, timeout=5)
                if res.status_code == 200:
                    data = res.json()
                    title = data.get('title', '')
                    width = data.get('width', 1280)
                    height = data.get('height', 720)
            except Exception as e:
                logger.warning(f"Error al consultar oEmbed de YouTube: {str(e)}")

        elif insta_match:
            provider = 'instagram'
            external_id = insta_match.group(1)
            embed_url = f"https://www.instagram.com/p/{external_id}/embed/"
            thumbnail_url = f"https://www.instagram.com/p/{external_id}/media/?size=l"
            # Un post de Instagram puede ser imagen o video (lo trataremos como imagen por defecto para visualización, o video según se desee)
            # Aunque comúnmente en la galería lo renderizaremos con el widget de incrustación que reproduce el post entero.
            media_type = 'image' 
            title = f"Post de Instagram {external_id}"
            width = 1080
            height = 1080

        elif vimeo_match:
            provider = 'vimeo'
            external_id = vimeo_match.group(1)
            embed_url = f"https://player.vimeo.com/video/{external_id}"
            media_type = 'video'
            
            # Obtener título y miniatura de Vimeo oEmbed
            try:
                oembed_url = f"https://vimeo.com/api/oembed.json?url={url}"
                res = requests.get(oembed_url, timeout=5)
                if res.status_code == 200:
                    data = res.json()
                    title = data.get('title', '')
                    thumbnail_url = data.get('thumbnail_url', '')
                    width = data.get('width', 1280)
                    height = data.get('height', 720)
            except Exception as e:
                logger.warning(f"Error al consultar oEmbed de Vimeo: {str(e)}")

        elif tiktok_match:
            provider = 'tiktok'
            external_id = tiktok_match.group(1)
            embed_url = f"https://www.tiktok.com/embed/{external_id}"
            media_type = 'video'
            
            # Obtener miniatura y título de TikTok oEmbed
            try:
                oembed_url = f"https://www.tiktok.com/oembed?url={url}"
                res = requests.get(oembed_url, timeout=5)
                if res.status_code == 200:
                    data = res.json()
                    title = data.get('title', '')
                    thumbnail_url = data.get('thumbnail_url', '')
                    width = data.get('width', 1280)
                    height = data.get('height', 720)
            except Exception as e:
                logger.warning(f"Error al consultar oEmbed de TikTok: {str(e)}")

        else:
            # Tratamiento genérico
            provider = 'external'
            title = "Enlace Externo"
            embed_url = url
            thumbnail_url = "" # Frontend o admin deberá ingresarla o usar un placeholder
            media_type = 'image'

        return Response({
            'provider': provider,
            'external_id': external_id,
            'embed_url': embed_url,
            'thumbnail_url': thumbnail_url,
            'media_type': media_type,
            'title': title,
            'width': width,
            'height': height,
        })
