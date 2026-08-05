from rest_framework import serializers
from .models import GalleryItem

class GalleryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = GalleryItem
        fields = '__all__'
        read_only_fields = ('created_at', 'optimized_url', 'streaming_url')

    def validate(self, attrs):
        provider = attrs.get('provider', 'cloudinary')
        media_type = attrs.get('media_type')
        public_id = attrs.get('public_id')
        
        # En caso de actualización parcial
        if self.instance:
            if 'provider' not in attrs:
                provider = self.instance.provider
            if 'media_type' not in attrs:
                media_type = self.instance.media_type
            if 'public_id' not in attrs:
                public_id = self.instance.public_id

        if provider == 'cloudinary':
            if not public_id:
                raise serializers.ValidationError({'public_id': 'El public_id es obligatorio para elementos de Cloudinary.'})
            
            import cloudinary.utils
            
            if media_type == 'image':
                # Formato y calidad automáticos (WebP/AVIF)
                attrs['optimized_url'] = cloudinary.utils.cloudinary_url(
                    public_id,
                    fetch_format="auto",
                    quality="auto",
                    secure=True
                )[0]
                attrs['streaming_url'] = None
            elif media_type == 'video':
                # Video MP4/WebM optimizado
                attrs['optimized_url'] = cloudinary.utils.cloudinary_url(
                    public_id,
                    resource_type="video",
                    fetch_format="auto",
                    quality="auto",
                    secure=True
                )[0]
                # Streaming HLS .m3u8
                attrs['streaming_url'] = cloudinary.utils.cloudinary_url(
                    public_id,
                    resource_type="video",
                    format="m3u8",
                    transformation=[{"streaming_profile": "auto"}],
                    secure=True
                )[0]
        else:
            # Limpiar campos Cloudinary para externos
            attrs['public_id'] = None
            
        # Validación y sanitización de embed_url para prevenir XSS y ataques de inyección
        embed_url = attrs.get('embed_url')
        if not embed_url and self.instance:
            embed_url = self.instance.embed_url

        if embed_url:
            from urllib.parse import urlparse
            parsed = urlparse(embed_url)
            # Solo permitir protocolos seguros
            if parsed.scheme not in ['http', 'https']:
                raise serializers.ValidationError({'embed_url': 'La URL debe utilizar un protocolo seguro (http o https).'})
            
            # Whitelist de dominios permitidos para incrustación de iframes
            allowed_domains = [
                'youtube.com', 'www.youtube.com',
                'youtube-nocookie.com', 'www.youtube-nocookie.com',
                'youtu.be',
                'instagram.com', 'www.instagram.com',
                'vimeo.com', 'www.vimeo.com', 'player.vimeo.com',
                'tiktok.com', 'www.tiktok.com',
                'cloudinary.com', 'res.cloudinary.com'
            ]
            
            # Extraer dominio base (quitando subdominios si es necesario, o validando contra whitelist completo)
            domain = parsed.netloc.lower()
            # Validar si coincide con el final del host de la whitelist
            is_valid_domain = any(domain == d or domain.endswith('.' + d) for d in allowed_domains)
            
            if not is_valid_domain:
                raise serializers.ValidationError({'embed_url': 'El dominio del iframe no está en la lista de proveedores autorizados.'})

            # Prevenir inyecciones maliciosas de caracteres html o scripts
            if any(char in embed_url for char in ['<', '>', '"', "'", '`', 'javascript:']):
                raise serializers.ValidationError({'embed_url': 'La URL de incrustación contiene caracteres no autorizados o sospechosos de XSS.'})

        return attrs

