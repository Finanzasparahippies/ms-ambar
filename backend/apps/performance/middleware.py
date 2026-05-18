import time
from django.db import connection
from .models import ServerRequestLog

class PerformanceMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # We don't want to log performance requests themselves or static files
        if request.path.startswith('/api/performance/') or request.path.startswith('/static/'):
            return self.get_response(request)

        start_time = time.time()
        initial_queries = len(connection.queries)

        response = self.get_response(request)

        duration = time.time() - start_time
        final_queries = len(connection.queries)
        query_count = final_queries - initial_queries

        # Save the log
        try:
            ServerRequestLog.objects.create(
                path=request.path,
                method=request.method,
                status_code=response.status_code,
                response_time=round(duration, 4),
                query_count=query_count
            )
        except Exception:
            # Avoid breaking the site if logging fails
            pass

        return response
