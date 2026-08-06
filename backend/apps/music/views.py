from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Album, Track
from .serializers import AlbumSerializer, TrackSerializer
from .services import MusicIngestionService


class IsAdminOrReadOnly(permissions.BasePermission):
    """Acceso público de lectura, mutación (CRUD) solo para administradores."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)


class AlbumViewSet(viewsets.ModelViewSet):
    queryset = Album.objects.all()
    serializer_class = AlbumSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = Album.objects.all()
        # Seed automatic discography if database is fresh
        if not queryset.exists():
            MusicIngestionService.seed_initial_discography()
            queryset = Album.objects.all()
        return queryset


class TrackViewSet(viewsets.ModelViewSet):
    queryset = Track.objects.all()
    serializer_class = TrackSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = Track.objects.all()
        album_id = self.request.query_params.get('album_id')
        if album_id:
            queryset = queryset.filter(album_id=album_id)
        return queryset


class SyncPlatformMusicView(APIView):
    """Endpoint para sincronización e ingesta multi-plataforma (Spotify, iTunes, YouTube, Amazon)."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        query = request.data.get('query', 'Ms Ambar')
        synced_album = MusicIngestionService.sync_platform_metadata(query)
        if synced_album:
            serializer = AlbumSerializer(synced_album)
            return Response({
                "message": "Sincronización de plataformas completada con éxito.",
                "album": serializer.data
            }, status=status.HTTP_200_OK)
        return Response({"error": "No se pudieron obtener datos de las plataformas."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
