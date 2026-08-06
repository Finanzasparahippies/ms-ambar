from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAdminUser
from django.db.models import Avg, Max, Count
from .models import PerformanceMetric, ServerRequestLog
from .serializers import PerformanceMetricSerializer, ServerRequestLogSerializer

class PerformanceViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'], url_path='vitals')
    def report_vitals(self, request):
        """Endpoint for the frontend to report Web Vitals (supports single & batch array)."""
        data = request.data
        if isinstance(data, list):
            serializer = PerformanceMetricSerializer(data=data, many=True)
            if serializer.is_valid():
                serializer.save(user_agent=request.META.get('HTTP_USER_AGENT', ''))
                return Response(status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        serializer = PerformanceMetricSerializer(data=data)
        if serializer.is_valid():
            serializer.save(user_agent=request.META.get('HTTP_USER_AGENT', ''))
            return Response(status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='summary', permission_classes=[IsAdminUser])
    def get_summary(self, request):
        """Returns a summary of performance metrics for the admin dashboard."""
        server_summary = ServerRequestLog.objects.aggregate(
            avg_response_time=Avg('response_time'),
            max_response_time=Max('response_time'),
            avg_queries=Avg('query_count'),
            total_requests=Count('id')
        )
        
        vitals_summary = PerformanceMetric.objects.values('name').annotate(
            avg_value=Avg('value'),
            count=Count('id')
        )

        slowest_endpoints = ServerRequestLog.objects.values('path').annotate(
            avg_time=Avg('response_time')
        ).order_by('-avg_time')[:10]

        return Response({
            'server': server_summary,
            'vitals': vitals_summary,
            'slowest_endpoints': slowest_endpoints
        })

    @action(detail=False, methods=['get'], url_path='logs', permission_classes=[IsAdminUser])
    def list_logs(self, request):
        """Lists available log files in the logs directory, including active and rotated files."""
        from django.conf import settings
        import os

        logs_dir = getattr(settings, 'LOGS_DIR', settings.BASE_DIR / 'logs')
        # Crear dinámicamente si no existe para evitar errores E/S
        if not os.path.exists(logs_dir):
            os.makedirs(logs_dir, exist_ok=True)

        allowed_bases = ('tickets.log', 'shop.log', 'events.log', 'users.log', 'blog.log', 'dashboard.log', 'gallery.log', 'music.log')
        log_files = []

        # Obtener los archivos físicos en el directorio de logs que inicien con nuestras bases permitidas
        existing_files = {}
        try:
            for file_name in os.listdir(logs_dir):
                if file_name.startswith(allowed_bases):
                    file_path = os.path.join(logs_dir, file_name)
                    if os.path.isfile(file_path):
                        stat = os.stat(file_path)
                        existing_files[file_name] = {
                            'name': file_name,
                            'size': stat.st_size,
                            'modified': stat.st_mtime
                        }
        except Exception:
            # En caso de error de lectura, continuamos para no romper el admin
            pass

        # Asegurar que las bases principales siempre aparezcan listadas,
        # aunque no se hayan escrito aún físicamente en disco.
        for base_name in allowed_bases:
            if base_name in existing_files:
                log_files.append(existing_files[base_name])
            else:
                log_files.append({
                    'name': base_name,
                    'size': 0,
                    'modified': None
                })

            # También añadimos los archivos rotados que compartan esa misma base ordenados
            for file_name, file_info in sorted(existing_files.items()):
                if file_name != base_name and file_name.startswith(base_name):
                    log_files.append(file_info)

        return Response(log_files)

    @action(detail=False, methods=['get'], url_path='logs/download', permission_classes=[IsAdminUser])
    def download_log(self, request):
        """Downloads a specific log file, preventing path traversal attacks."""
        from django.conf import settings
        from django.http import FileResponse, Http404
        import os

        file_name = request.query_params.get('file', '').strip()
        allowed_bases = ('tickets.log', 'shop.log', 'events.log', 'users.log', 'blog.log', 'dashboard.log', 'gallery.log', 'music.log')

        # Validación estricta del nombre del archivo solicitado
        if not file_name or not file_name.startswith(allowed_bases):
            return Response({'error': 'Archivo no permitido.'}, status=status.HTTP_400_BAD_REQUEST)

        # Mitigación estricta de Path Traversal
        if '/' in file_name or '\\' in file_name or '..' in file_name:
            return Response({'error': 'Nombre de archivo inválido.'}, status=status.HTTP_400_BAD_REQUEST)

        logs_dir = getattr(settings, 'LOGS_DIR', settings.BASE_DIR / 'logs')
        file_path = os.path.join(logs_dir, file_name)

        # Si no existe y es una de las bases principales, lo creamos vacío en caliente
        # para evitar fallos de archivo no encontrado al intentar descargarlo
        if not os.path.exists(file_path):
            if file_name in allowed_bases:
                try:
                    os.makedirs(logs_dir, exist_ok=True)
                    with open(file_path, 'w', encoding='utf-8') as f:
                        pass
                except Exception as e:
                    return Response({'error': f'No se pudo inicializar el archivo de log: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            else:
                raise Http404("El archivo de log no existe.")

        try:
            # FileResponse con as_attachment=True para forzar la descarga directa del navegador con charset UTF-8
            response = FileResponse(
                open(file_path, 'rb'),
                as_attachment=True,
                filename=file_name,
                content_type='text/plain; charset=utf-8'
            )
            return response
        except Exception as e:
            return Response({'error': f'Error al descargar el archivo: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

