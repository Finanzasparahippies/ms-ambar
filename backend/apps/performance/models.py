from django.db import models

class PerformanceMetric(models.Model):
    """Stores Web Vitals from the frontend."""
    METRIC_TYPES = [
        ('LCP', 'Largest Contentful Paint'),
        ('FID', 'First Input Delay'),
        ('CLS', 'Cumulative Layout Shift'),
        ('FCP', 'First Contentful Paint'),
        ('TTFB', 'Time to First Byte'),
        ('INP', 'Interaction to Next Paint'),
    ]
    
    name = models.CharField(max_length=10, choices=METRIC_TYPES)
    value = models.FloatField()
    path = models.CharField(max_length=255)
    user_agent = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.name}: {self.value} at {self.path}"

class ServerRequestLog(models.Model):
    """Stores server-side performance metrics for every request."""
    path = models.CharField(max_length=255)
    method = models.CharField(max_length=10)
    status_code = models.IntegerField()
    response_time = models.FloatField(help_text="Time in seconds")
    query_count = models.IntegerField(default=0)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.method} {self.path} - {self.status_code} ({self.response_time}s)"
