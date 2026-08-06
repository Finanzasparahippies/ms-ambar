from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Album, Track, MusicConfig
from .serializers import AlbumSerializer, TrackSerializer, MusicConfigSerializer
from .services import MusicIngestionService


class IsAdminOrReadOnly(permissions.BasePermission):
    """Acceso público de lectura, mutación (CRUD) solo para administradores."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)


class MusicConfigView(APIView):
    """Endpoint para la lectura y actualización de la descripción configurable de discografía."""
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
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        return self.put(request)



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
        synced_album = MusicIngestionService.sync_platform_metadata(query)
        if synced_album:
            serializer = AlbumSerializer(synced_album)
            return Response({
                "message": "Sincronización de plataformas completada con éxito.",
                "album": serializer.data
            }, status=status.HTTP_200_OK)
        return Response({"error": "No se pudieron obtener datos de las plataformas."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
