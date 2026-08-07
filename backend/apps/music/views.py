import logging
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from django.core.cache import cache
from .models import Album, Track, MusicConfig, Playlist
from .serializers import AlbumSerializer, TrackSerializer, MusicConfigSerializer, PlaylistSerializer
from .services import MusicIngestionService

logger = logging.getLogger('apps.music')


class IsAdminOrReadOnly(permissions.BasePermission):
    """Acceso público de lectura, mutación (CRUD) solo para administradores."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)


class MusicConfigView(APIView):
    """Endpoint para la lectura y actualización de la configuración y credenciales de música."""
    permission_classes = [IsAdminOrReadOnly]

    def get(self, request):
        config = MusicConfig.get_solo()
        serializer = MusicConfigSerializer(config)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        config = MusicConfig.get_solo()
        serializer = MusicConfigSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            # Invalidar cachés de autenticación y catálogos al actualizar claves de API
            cache.delete("spotify_access_token")
            logger.info(f"[MUSIC/CONFIG] Configuración de música y credenciales actualizada por usuario staff ID={getattr(request.user, 'id', 'Anon')}.")
            return Response(serializer.data, status=status.HTTP_200_OK)
        logger.warning(f"[MUSIC/CONFIG] Error de validación al actualizar la configuración: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        return self.put(request)


class PlaylistViewSet(viewsets.ModelViewSet):
    """ViewSet CRUD para la administración de listas de reproducción y widgets de streaming."""
    queryset = Playlist.objects.all()
    serializer_class = PlaylistSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = Playlist.objects.all()
        # Si la petición no es de un usuario staff admin, filtrar solo activas
        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(is_active=True)
        return queryset




class AlbumViewSet(viewsets.ModelViewSet):
    queryset = Album.objects.all()
    serializer_class = AlbumSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        # Excluir álbumes obsoletos ficticios
        Album.objects.filter(title__in=["Eclipse", "Ambar Vision", "Desierto de Cristal", "Sinfonías de Ámbar"]).delete()
        Track.objects.filter(preview_url__icontains="soundhelix.com").delete()

        queryset = Album.objects.exclude(title__in=["Eclipse", "Ambar Vision", "Desierto de Cristal", "Sinfonías de Ámbar"])
        if not queryset.exists():
            logger.info("[MUSIC/ALBUMS] No se encontraron álbumes válidos en BD. Iniciando sincronización por defecto.")
            MusicIngestionService.sync_platform_metadata("Ms Ambar")
            queryset = Album.objects.exclude(title__in=["Eclipse", "Ambar Vision", "Desierto de Cristal", "Sinfonías de Ámbar"])
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
        logger.info(f"[MUSIC/SYNC] Petición recibida en /api/music/sync/ para la consulta: '{query}'")
        synced_album = MusicIngestionService.sync_platform_metadata(query)
        if synced_album:
            serializer = AlbumSerializer(synced_album)
            logger.info(f"[MUSIC/SYNC] Sincronización exitosa. Álbum normalizado: {synced_album.title} (ID: {synced_album.id})")
            return Response({
                "message": "Sincronización de plataformas completada con éxito.",
                "album": serializer.data
            }, status=status.HTTP_200_OK)
        logger.error(f"[MUSIC/SYNC] Falló la sincronización de metadatos de música para la consulta: '{query}'")
        return Response({"error": "No se pudieron obtener datos de las plataformas."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ApiHealthcheckView(APIView):
    """Endpoint para verificar la validez y estado operativo de las credenciales de API de música."""
    permission_classes = [IsAdminOrReadOnly]

    def get(self, request):
        health = MusicIngestionService.check_api_health()
        return Response(health, status=status.HTTP_200_OK)

