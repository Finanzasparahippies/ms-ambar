from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AlbumViewSet, TrackViewSet, SyncPlatformMusicView, MusicConfigView

router = DefaultRouter()
router.register(r'albums', AlbumViewSet, basename='music-album')
router.register(r'tracks', TrackViewSet, basename='music-track')

urlpatterns = [
    path('', include(router.urls)),
    path('config/', MusicConfigView.as_view(), name='music-config'),
    path('sync/', SyncPlatformMusicView.as_view(), name='music-sync'),
]

