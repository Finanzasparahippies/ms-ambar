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

    def test_report_vitals_batch_array(self):
        """Verify that the frontend can submit batch arrays of Web Vitals metrics without network spikes."""
        url = '/api/performance/vitals/'
        data = [
            {'name': 'LCP', 'value': 1200.0, 'path': '/comprar-boletos/'},
            {'name': 'CLS', 'value': 0.02, 'path': '/comprar-boletos/'},
            {'name': 'FID', 'value': 4.5, 'path': '/comprar-boletos/'}
        ]
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PerformanceMetric.objects.count(), 3)

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

    def test_list_logs_includes_music_log(self):
        """Verify that music.log is included in the list of available log files."""
        url = '/api/performance/logs/'
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log_names = [f['name'] for f in response.data]
        self.assertIn('music.log', log_names)

    def test_download_music_log(self):
        """Verify downloading music.log as admin with UTF-8 charset header."""
        url = '/api/performance/logs/download/?file=music.log'
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('text/plain; charset=utf-8', response.headers.get('Content-Type', ''))

    def test_purge_log_success_for_admin(self):
        """Verify admin can purge/empty a log file in real time."""
        from django.conf import settings
        import os
        logs_dir = getattr(settings, 'LOGS_DIR', settings.BASE_DIR / 'logs')
        os.makedirs(logs_dir, exist_ok=True)
        test_file = os.path.join(logs_dir, 'tickets.log')
        with open(test_file, 'w', encoding='utf-8') as f:
            f.write("Log dummy data before purge\n")

        url = '/api/performance/logs/purge/'
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(url, {'file': 'tickets.log'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(os.path.getsize(test_file), 0)

    def test_purge_log_unauthorized(self):
        """Verify unauthenticated user cannot purge log files."""
        url = '/api/performance/logs/purge/'
        response = self.client.post(url, {'file': 'tickets.log'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_purge_log_invalid_file_rejected(self):
        """Verify path traversal or invalid file names are rejected on purge."""
        url = '/api/performance/logs/purge/'
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(url, {'file': '../settings.py'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_export_pdf_success_for_admin(self):
        """Verify admin can generate and download executive PDF report."""
        url = '/api/performance/export/pdf/'
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.headers.get('Content-Type'), 'application/pdf')

    def test_export_pptx_success_for_admin(self):
        """Verify admin can generate and download executive PowerPoint presentation."""
        url = '/api/performance/export/pptx/'
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.headers.get('Content-Type'), 'application/vnd.openxmlformats-officedocument.presentationml.presentation')


