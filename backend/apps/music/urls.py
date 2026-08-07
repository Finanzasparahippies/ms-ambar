from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AlbumViewSet, TrackViewSet, SyncPlatformMusicView, MusicConfigView, PlaylistViewSet, ApiHealthcheckView

router = DefaultRouter()
router.register(r'albums', AlbumViewSet, basename='music-album')
router.register(r'tracks', TrackViewSet, basename='music-track')
router.register(r'playlists', PlaylistViewSet, basename='music-playlist')

urlpatterns = [
    path('', include(router.urls)),
    path('config/', MusicConfigView.as_view(), name='music-config'),
    path('healthcheck/', ApiHealthcheckView.as_view(), name='music-healthcheck'),
    path('sync/', SyncPlatformMusicView.as_view(), name='music-sync'),
]



