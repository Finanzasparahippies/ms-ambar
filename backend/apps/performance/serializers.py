from rest_framework import serializers
from .models import PerformanceMetric, ServerRequestLog

class PerformanceMetricSerializer(serializers.ModelSerializer):
    # Override to accept any metric name from Next.js (e.g. internal Next.js metrics
    # like "next-route-prefetch-cache" that don't match the model's choices list).
    name = serializers.CharField(max_length=50)

    class Meta:
        model = PerformanceMetric
        fields = '__all__'

class ServerRequestLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServerRequestLog
        fields = '__all__'
