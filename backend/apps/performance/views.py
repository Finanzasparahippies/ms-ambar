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
