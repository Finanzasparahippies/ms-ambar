from django.contrib import admin
from .models import PerformanceMetric, ServerRequestLog

@admin.register(PerformanceMetric)
class PerformanceMetricAdmin(admin.ModelAdmin):
    list_display = ('name', 'value', 'path', 'timestamp')
    list_filter = ('name', 'timestamp')
    search_fields = ('path', 'user_agent')
    readonly_fields = ('timestamp',)

@admin.register(ServerRequestLog)
class ServerRequestLogAdmin(admin.ModelAdmin):
    list_display = ('method', 'path', 'status_code', 'response_time', 'query_count', 'timestamp')
    list_filter = ('method', 'status_code', 'timestamp')
    search_fields = ('path',)
    readonly_fields = ('timestamp',)
