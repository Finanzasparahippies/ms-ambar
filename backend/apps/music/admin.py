from django.contrib import admin
from .models import Album, Track, MusicConfig


class TrackInline(admin.TabularInline):
    model = Track
    extra = 1


@admin.register(Album)
class AlbumAdmin(admin.ModelAdmin):
    list_display = ('title', 'release_year', 'spotify_id', 'youtube_id', 'itunes_id', 'is_featured', 'created_at')
    list_filter = ('release_year', 'is_featured')
    search_fields = ('title', 'description', 'spotify_id', 'youtube_id', 'itunes_id')
    inlines = [TrackInline]


@admin.register(Track)
class TrackAdmin(admin.ModelAdmin):
    list_display = ('title', 'album', 'track_number', 'duration_seconds', 'spotify_id', 'youtube_id', 'itunes_id', 'is_single')
    list_filter = ('album', 'is_single')
    search_fields = ('title', 'album__title', 'spotify_id', 'youtube_id', 'itunes_id')


@admin.register(MusicConfig)
class MusicConfigAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'discography_description', 'updated_at')


