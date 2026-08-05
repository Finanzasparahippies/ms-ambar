from django.contrib import admin
from .models import GalleryItem

@admin.register(GalleryItem)
class GalleryItemAdmin(admin.ModelAdmin):
    list_display = ('title', 'media_type', 'provider', 'category', 'order', 'created_at')
    list_filter = ('media_type', 'provider', 'category')
    search_fields = ('title', 'description', 'category', 'public_id', 'external_id')
    ordering = ('order', '-created_at')
    fieldsets = (
        (None, {
            'fields': ('title', 'description', 'media_type', 'provider', 'category', 'order')
        }),
        ('URLs y Fuentes', {
            'fields': ('url', 'optimized_url', 'streaming_url', 'embed_url', 'thumbnail_url', 'external_id', 'public_id')
        }),
        ('Dimensiones y Metadatos', {
            'fields': ('width', 'height', 'duration')
        }),
    )
