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
            
        return attrs
