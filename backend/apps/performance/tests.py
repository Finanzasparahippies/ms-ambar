from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from apps.performance.models import ServerRequestLog, PerformanceMetric

User = get_user_model()

class PerformanceAppTests(APITestCase):
    def setUp(self):
        # Create an admin user for fetching summaries
        self.admin_user = User.objects.create_superuser(
            email='admin@example.com',
            username='admin',
            password='adminpassword'
        )

    def test_performance_middleware_logs_requests(self):
        """Verify the PerformanceMiddleware captures standard web requests."""
        # Clean existing logs
        ServerRequestLog.objects.all().delete()

        # Trigger a request that gets logged (e.g. register view)
        url = reverse('register')
        self.client.post(url, {}) # Bad request, but should still log

        logs = ServerRequestLog.objects.all()
        self.assertEqual(logs.count(), 1)
        log = logs.first()
        self.assertEqual(log.path, '/api/users/register/')
        self.assertEqual(log.method, 'POST')
        self.assertEqual(log.status_code, 400)
        self.assertGreaterEqual(log.response_time, 0.0)

    def test_performance_middleware_ignores_static_and_apm_paths(self):
        """Verify middleware doesn't log static files or performance requests to prevent feedback loops."""
        ServerRequestLog.objects.all().delete()

        # 1. Access APM endpoint
        url_vitals = '/api/performance/vitals/'
        self.client.post(url_vitals, {})
        
        # 2. Access static path
        url_static = '/static/images/hero.jpg'
        self.client.get(url_static)

        # Confirm no logs were created
        self.assertEqual(ServerRequestLog.objects.count(), 0)

    def test_report_vitals_success(self):
        """Verify that the frontend can successfully submit Web Vitals metrics."""
        url = '/api/performance/vitals/'
        data = {
            'name': 'LCP',
            'value': 2500.5,
            'path': '/tour/'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify created metric
        metric = PerformanceMetric.objects.get(name='LCP')
        self.assertEqual(metric.value, 2500.5)
        self.assertEqual(metric.path, '/tour/')

    def test_report_vitals_invalid(self):
        """Verify invalid metrics are rejected with 400 Bad Request."""
        url = '/api/performance/vitals/'
        data = {
            'name': '', # Required field empty
            'value': 'not-a-float',
            'path': ''
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_summary_permission_denied(self):
        """Verify unauthenticated/regular users cannot access performance dashboard summaries."""
        url = '/api/performance/summary/'
        # Unauthenticated request -> 401
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Authenticated as regular user -> 403
        regular_user = User.objects.create_user(
            email='regular@example.com',
            username='regular',
            password='password123'
        )
        self.client.force_authenticate(user=regular_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_summary_success_for_admin(self):
        """Verify admin can retrieve performance summaries."""
        # Seed some request logs
        ServerRequestLog.objects.create(
            path='/tour/',
            method='GET',
            status_code=200,
            response_time=0.15,
            query_count=3
        )
        # Seed some Web Vitals
        PerformanceMetric.objects.create(
            name='FID',
            value=45.0,
            path='/contact/'
        )

        url = '/api/performance/summary/'
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('server', response.data)
        self.assertIn('vitals', response.data)
        self.assertIn('slowest_endpoints', response.data)
        
        self.assertEqual(response.data['server']['total_requests'], 1)
        self.assertEqual(len(response.data['vitals']), 1)
        self.assertEqual(response.data['vitals'][0]['name'], 'FID')
