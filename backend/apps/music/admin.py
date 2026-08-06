from django.contrib import admin
from .models import Album, Track


class TrackInline(admin.TabularInline):
    model = Track
    extra = 1


@admin.register(Album)
class AlbumAdmin(admin.ModelAdmin):
    list_display = ('title', 'release_year', 'is_featured', 'created_at')
    list_filter = ('release_year', 'is_featured')
    search_fields = ('title', 'description')
    inlines = [TrackInline]


@admin.register(Track)
class TrackAdmin(admin.ModelAdmin):
    list_display = ('title', 'album', 'track_number', 'duration_seconds', 'is_single')
    list_filter = ('album', 'is_single')
    search_fields = ('title', 'album__title')
