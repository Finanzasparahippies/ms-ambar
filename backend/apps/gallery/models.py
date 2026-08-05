from django.db import models

class GalleryItem(models.Model):
    MEDIA_TYPE_CHOICES = [
        ('image', 'Imagen'),
        ('video', 'Video'),
    ]

    PROVIDER_CHOICES = [
        ('cloudinary', 'Cloudinary'),
        ('youtube', 'YouTube'),
        ('instagram', 'Instagram'),
        ('vimeo', 'Vimeo'),
        ('external', 'Externo / Directo'),
    ]

    title = models.CharField(max_length=255, verbose_name="Título")
    description = models.TextField(blank=True, null=True, verbose_name="Descripción")
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPE_CHOICES, verbose_name="Tipo de Media")
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default='cloudinary', verbose_name="Proveedor")
    
    # URL del medio (URL original o enlace externo original)
    url = models.URLField(max_length=1000, verbose_name="URL Original")
    
    # URLs optimizadas de Cloudinary
    optimized_url = models.URLField(max_length=1000, blank=True, null=True, verbose_name="URL Optimizada")
    streaming_url = models.URLField(max_length=1000, blank=True, null=True, verbose_name="URL de Streaming (HLS)")
    
    # Datos de incrustación para YouTube/Instagram/Vimeo
    embed_url = models.URLField(max_length=1000, blank=True, null=True, verbose_name="URL de Incrustación")
    thumbnail_url = models.URLField(max_length=1000, blank=True, null=True, verbose_name="URL de Miniatura")
    external_id = models.CharField(max_length=255, blank=True, null=True, verbose_name="ID Externo (YouTube ID, etc.)")
    
    public_id = models.CharField(max_length=255, blank=True, null=True, verbose_name="Cloudinary Public ID")
    width = models.IntegerField(blank=True, null=True, verbose_name="Ancho")
    height = models.IntegerField(blank=True, null=True, verbose_name="Alto")
    duration = models.FloatField(blank=True, null=True, verbose_name="Duración (segundos)")
    category = models.CharField(max_length=100, blank=True, null=True, verbose_name="Categoría")
    
    order = models.IntegerField(default=0, verbose_name="Orden de visualización")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación")

    class Meta:
        ordering = ['order', '-created_at']
        verbose_name = "Elemento de Galería"
        verbose_name_plural = "Elementos de Galería"

    def __str__(self):
        return f"{self.title} ({self.get_media_type_display()} - {self.get_provider_display()})"
