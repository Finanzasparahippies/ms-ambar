from rest_framework import serializers
from .models import PerformanceMetric, ServerRequestLog

class PerformanceMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = PerformanceMetric
        fields = '__all__'

class ServerRequestLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServerRequestLog
        fields = '__all__'
