from django.db import models


class Album(models.Model):
    title = models.CharField(max_length=255, help_text="Título del álbum o EP")
    release_year = models.CharField(max_length=10, default="2026", help_text="Año de lanzamiento")
    cover_url = models.CharField(max_length=500, blank=True, null=True, help_text="URL de la carátula / portada")
    release_date = models.DateField(blank=True, null=True, help_text="Fecha de lanzamiento oficial")
    description = models.TextField(blank=True, default="", help_text="Reseña artística del álbum")
    
    # Enlaces de plataformas de streaming
    spotify_url = models.URLField(blank=True, null=True, help_text="Enlace directo Spotify")
    apple_music_url = models.URLField(blank=True, null=True, help_text="Enlace directo Apple Music")
    youtube_url = models.URLField(blank=True, null=True, help_text="Enlace a Canal de YouTube")
    youtube_music_url = models.URLField(blank=True, null=True, help_text="Enlace YouTube Music")
    amazon_music_url = models.URLField(blank=True, null=True, help_text="Enlace Amazon Music")
    
    # Identificadores externos con restricciones de unicidad a nivel SQL
    spotify_id = models.CharField(max_length=100, unique=True, blank=True, null=True, db_index=True, help_text="ID de álbum en Spotify")
    youtube_id = models.CharField(max_length=100, unique=True, blank=True, null=True, db_index=True, help_text="ID de playlist/album en YouTube")
    itunes_id = models.CharField(max_length=100, unique=True, blank=True, null=True, db_index=True, help_text="ID de colección en iTunes")
    
    is_featured = models.BooleanField(default=True, help_text="Destacar en portada de discografía")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-release_year', '-created_at']
        verbose_name = "Álbum"
        verbose_name_plural = "Álbumes"

    def __str__(self):
        return f"{self.title} ({self.release_year})"


class Track(models.Model):
    album = models.ForeignKey(Album, related_name='tracks', on_delete=models.CASCADE)
    track_number = models.IntegerField(default=1, help_text="Número de pista en el álbum")
    title = models.CharField(max_length=255, help_text="Nombre de la canción o tema")
    duration_seconds = models.IntegerField(default=210, help_text="Duración en segundos")
    preview_url = models.URLField(blank=True, null=True, help_text="URL de audio preview (mp3/stream)")
    
    # Identificadores externos con restricciones de unicidad a nivel SQL
    spotify_id = models.CharField(max_length=100, unique=True, blank=True, null=True, db_index=True, help_text="ID de canción en Spotify")
    youtube_id = models.CharField(max_length=100, unique=True, blank=True, null=True, db_index=True, help_text="ID de video en YouTube")
    itunes_id = models.CharField(max_length=100, unique=True, blank=True, null=True, db_index=True, help_text="ID de canción en iTunes")
    
    is_single = models.BooleanField(default=False, help_text="Marcar si fue lanzada como sencillo")
    play_count = models.PositiveIntegerField(default=0, help_text="Contador de reproducciones en plataforma")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['track_number', 'id']
        verbose_name = "Pista / Canción"
        verbose_name_plural = "Pistas / Canciones"

    def __str__(self):
        return f"{self.album.title} - {self.track_number:02d}. {self.title}"


class MusicConfig(models.Model):
    discography_description = models.TextField(
        default="Explora las producciones acústicas y sencillos oficiales de Ms. Ambar en todas las plataformas digitales ✨🎶",
        help_text="Descripción editable con emojis para el encabezado de la sección de discografía."
    )
    # Credenciales de API externas configurables
    youtube_api_key = models.CharField(max_length=255, blank=True, default="", help_text="YouTube Data API Key")
    spotify_client_id = models.CharField(max_length=255, blank=True, default="", help_text="Spotify Client ID")
    spotify_client_secret = models.CharField(max_length=255, blank=True, default="", help_text="Spotify Client Secret")
    apple_music_region = models.CharField(max_length=10, blank=True, default="us", help_text="Código de región de Apple Music / iTunes (ej: us, mx)")
    amazon_music_artist_id = models.CharField(max_length=255, blank=True, default="", help_text="ID o enlace base de artista/afiliado en Amazon Music")

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuración de Música"
        verbose_name_plural = "Configuraciones de Música"

    def __str__(self):
        return "Configuración de Música & Discografía"

    @classmethod
    def get_solo(cls):
        config, _ = cls.objects.get_or_create(id=1)
        return config


class Playlist(models.Model):
    PLATFORM_CHOICES = [
        ('spotify', 'Spotify'),
        ('youtube', 'YouTube'),
        ('apple_music', 'Apple Music'),
        ('amazon_music', 'Amazon Music'),
    ]

    RENDER_CHOICES = [
        ('iframe', 'Iframe Embebido'),
        ('api_sync', 'Sincronización por API'),
    ]

    title = models.CharField(max_length=255, help_text="Título de la lista de reproducción o widget")
    platform = models.CharField(max_length=50, blank=True, null=True, choices=PLATFORM_CHOICES, default='spotify', help_text="Plataforma de streaming")
    render_type = models.CharField(max_length=50, blank=True, null=True, choices=RENDER_CHOICES, default='iframe', help_text="Modo de renderizado (Iframe o API)")
    embed_url = models.TextField(blank=True, default="", help_text="URL del iframe embebido para Spotify / YouTube / etc.")
    external_id = models.CharField(max_length=255, blank=True, default="", help_text="ID externo de playlist / colección en la plataforma")
    description = models.TextField(blank=True, default="", help_text="Descripción o notas del widget")
    is_active = models.BooleanField(default=True, help_text="Mostrar en el sitio público")
    order = models.PositiveIntegerField(default=0, help_text="Orden de visualización")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'id']
        verbose_name = "Lista de Reproducción"
        verbose_name_plural = "Listas de Reproducción"

    def __str__(self):
        return f"[{self.platform.upper()}] {self.title} ({self.render_type})"


# Receptores de señales para invalidación inmediata de caché
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache


def clear_music_caches():
    """Limpia en tiempo real las claves de caché de credenciales, playlists y catálogos de música."""
    keys_to_clear = [
        "spotify_access_token",
        "music_config_cache",
        "music_playlists_cache",
        "spotify_catalog_ms_ambar",
        "youtube_tracks_ms_ambar",
        "itunes_tracks_ms_ambar"
    ]
    for key in keys_to_clear:
        cache.delete(key)


@receiver(post_save, sender=MusicConfig)
@receiver(post_delete, sender=MusicConfig)
@receiver(post_save, sender=Playlist)
@receiver(post_delete, sender=Playlist)
def invalidate_music_cache_signal_handler(sender, instance, **kwargs):
    clear_music_caches()




