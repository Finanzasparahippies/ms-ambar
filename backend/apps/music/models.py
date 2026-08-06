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
    
    # Identificadores externos
    spotify_id = models.CharField(max_length=100, blank=True, null=True, help_text="ID de canción en Spotify")
    youtube_id = models.CharField(max_length=100, blank=True, null=True, help_text="ID de video en YouTube")
    
    is_single = models.BooleanField(default=False, help_text="Marcar si fue lanzada como sencillo")
    play_count = models.PositiveIntegerField(default=0, help_text="Contador de reproducciones en plataforma")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['track_number', 'id']
        verbose_name = "Pista / Canción"
        verbose_name_plural = "Pistas / Canciones"

    def __str__(self):
        return f"{self.album.title} - {self.track_number:02d}. {self.title}"
