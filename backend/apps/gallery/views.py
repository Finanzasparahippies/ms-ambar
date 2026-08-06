import os
import re
import gc
import uuid
import logging
import tempfile
import requests
import cloudinary.utils
import cloudinary.uploader
from PIL import Image, ImageOps
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
    def optimize_images(self, request):
        """
        Recibe 1 o varias imágenes (o estructura de carpetas), las optimiza localmente
        con Pillow (respetando calidad, dimensiones máximas y conversión a WebP),
        las sube a Cloudinary y opcionalmente las guarda en la base de datos de la Galería.
        
        Blindado contra consumo excesivo de RAM (VPS 2GB) mediante procesamiento en disco temporal.
        Límite por archivo individual: 35MB.
        """
        files = request.FILES.getlist('files') or request.FILES.getlist('file')
        if not files and request.FILES:
            files = list(request.FILES.values())

        if not files:
            raise ValidationError({'files': 'No se enviaron archivos para optimizar.'})

        try:
            quality = max(10, min(100, int(request.data.get('quality', 80))))
        except (ValueError, TypeError):
            quality = 80

        try:
            max_size = int(request.data.get('max_size', 1920))
        except (ValueError, TypeError):
            max_size = 1920

        to_webp_raw = str(request.data.get('to_webp', 'true')).lower()
        to_webp = to_webp_raw in ['true', '1', 'yes']

        save_to_gallery_raw = str(request.data.get('save_to_gallery', 'false')).lower()
        save_to_gallery = save_to_gallery_raw in ['true', '1', 'yes']

        category = str(request.data.get('category', '')).strip()

        MAX_SINGLE_FILE_SIZE = 35 * 1024 * 1024  # 35MB
        ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

        results = []
        total_original = 0
        total_optimized = 0
        success_count = 0

        for uploaded_file in files:
            filename = uploaded_file.name
            original_size = uploaded_file.size
            ext = os.path.splitext(filename)[1].lower()

            if original_size > MAX_SINGLE_FILE_SIZE:
                results.append({
                    'filename': filename,
                    'status': 'error',
                    'error': 'El archivo excede el límite permitido de 35MB.',
                    'original_size': original_size,
                    'optimized_size': original_size,
                    'saved_bytes': 0,
                    'reduction_percent': 0.0
                })
                continue

            if ext not in ALLOWED_EXTENSIONS and not (uploaded_file.content_type and uploaded_file.content_type.startswith('image/')):
                results.append({
                    'filename': filename,
                    'status': 'error',
                    'error': f'Formato "{ext}" no soportado. Se requieren imágenes JPG, PNG o WebP.',
                    'original_size': original_size,
                    'optimized_size': original_size,
                    'saved_bytes': 0,
                    'reduction_percent': 0.0
                })
                continue

            temp_path = None
            try:
                img = Image.open(uploaded_file)
                img = ImageOps.exif_transpose(img)
                orig_mode = img.mode
                
                orig_w, orig_h = img.size
                if max_size > 0 and max(orig_w, orig_h) > max_size:
                    img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

                save_format = "WEBP" if to_webp else (img.format or ("JPEG" if ext in ['.jpg', '.jpeg'] else "PNG"))
                if save_format not in ["WEBP", "JPEG", "PNG"]:
                    save_format = "WEBP" if to_webp else "JPEG"

                if save_format == "JPEG" and orig_mode in ("RGBA", "P", "LA"):
                    img = img.convert("RGB")

                out_ext = ".webp" if save_format == "WEBP" else (".jpg" if save_format == "JPEG" else ".png")

                with tempfile.NamedTemporaryFile(delete=False, suffix=out_ext) as tmp_file:
                    temp_path = tmp_file.name

                if save_format == "WEBP":
                    img.save(temp_path, "WEBP", quality=quality, method=6)
                elif save_format == "JPEG":
                    img.save(temp_path, "JPEG", quality=quality, optimize=True)
                else:
                    img.save(temp_path, "PNG", optimize=True)

                optimized_size = os.path.getsize(temp_path)
                saved_bytes = max(0, original_size - optimized_size)
                reduction_pct = round((saved_bytes / original_size * 100), 1) if original_size > 0 else 0.0

                unique_id = uuid.uuid4().hex
                public_id = f"gallery_opt_{unique_id}"
                folder = "ms-ambar/gallery"

                upload_res = cloudinary.uploader.upload(
                    temp_path,
                    folder=folder,
                    public_id=public_id,
                    resource_type="image"
                )

                secure_url = upload_res.get('secure_url') or upload_res.get('url')
                final_public_id = upload_res.get('public_id', f"{folder}/{public_id}")
                final_width = upload_res.get('width', img.width)
                final_height = upload_res.get('height', img.height)

                item_id = None
                if save_to_gallery:
                    clean_title = os.path.splitext(filename)[0].replace('-', ' ').replace('_', ' ').title()
                    gallery_item = GalleryItem.objects.create(
                        title=clean_title,
                        description=f"Imagen optimizada (-{reduction_pct}%).",
                        media_type="image",
                        provider="cloudinary",
                        url=secure_url,
                        public_id=final_public_id,
                        width=final_width,
                        height=final_height,
                        category=category or "Optimizadas"
                    )
                    item_id = gallery_item.id

                total_original += original_size
                total_optimized += optimized_size
                success_count += 1

                results.append({
                    'filename': filename,
                    'status': 'success',
                    'original_size': original_size,
                    'optimized_size': optimized_size,
                    'saved_bytes': saved_bytes,
                    'reduction_percent': reduction_pct,
                    'url': secure_url,
                    'public_id': final_public_id,
                    'width': final_width,
                    'height': final_height,
                    'gallery_item_id': item_id
                })

            except Exception as e:
                logger.error(f"Error procesando imagen {filename}: {str(e)}", exc_info=True)
                results.append({
                    'filename': filename,
                    'status': 'error',
                    'error': f'No se pudo optimizar la imagen: {str(e)}',
                    'original_size': original_size,
                    'optimized_size': original_size,
                    'saved_bytes': 0,
                    'reduction_percent': 0.0
                })
            finally:
                if temp_path and os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except Exception as clean_err:
                        logger.warning(f"No se pudo eliminar archivo temporal {temp_path}: {clean_err}")
                gc.collect()

        total_saved = max(0, total_original - total_optimized)
        overall_reduction = round((total_saved / total_original * 100), 1) if total_original > 0 else 0.0

        return Response({
            'processed_count': success_count,
            'total_files': len(files),
            'total_original_bytes': total_original,
            'total_optimized_bytes': total_optimized,
            'total_saved_bytes': total_saved,
            'reduction_percent': overall_reduction,
            'results': results
        }, status=status.HTTP_200_OK)

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
