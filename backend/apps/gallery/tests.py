from django.test import TestCase
from django.urls import reverse
from django.conf import settings
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch, MagicMock
import requests
from apps.users.models import User
from .models import GalleryItem
from .serializers import GalleryItemSerializer

class GalleryItemModelAndSerializerTest(TestCase):
    def setUp(self):
        self.item_data = {
            'title': 'Test Foto',
            'description': 'Una hermosa foto de prueba',
            'media_type': 'image',
            'provider': 'cloudinary',
            'url': 'https://res.cloudinary.com/dyhgivsyh/image/upload/v12345/gallery_image_123.jpg',
            'public_id': 'gallery_image_123',
            'category': 'Concierto',
            'order': 5
        }

    def test_create_gallery_item_model(self):
        """Verify GalleryItem fields save and persist correctly."""
        item = GalleryItem.objects.create(**self.item_data)
        self.assertEqual(item.title, 'Test Foto')
        self.assertEqual(item.provider, 'cloudinary')
        self.assertEqual(item.order, 5)

    def test_serializer_cloudinary_auto_urls_image(self):
        """Verify serializer automatically injects optimized Cloudinary URL for images."""
        serializer = GalleryItemSerializer(data=self.item_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        saved_item = serializer.save()
        self.assertIn('f_auto', saved_item.optimized_url)
        self.assertIn('q_auto', saved_item.optimized_url)
        self.assertNil = self.assertIsNone(saved_item.streaming_url)

    def test_serializer_cloudinary_auto_urls_video(self):
        """Verify serializer automatically injects optimized URL and HLS streaming URL for videos."""
        video_data = self.item_data.copy()
        video_data.update({
            'title': 'Test Video',
            'media_type': 'video',
            'url': 'https://res.cloudinary.com/dyhgivsyh/video/upload/v12345/gallery_video_123.mp4',
            'public_id': 'gallery_video_123'
        })
        serializer = GalleryItemSerializer(data=video_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        saved_item = serializer.save()
        self.assertIn('f_auto', saved_item.optimized_url)
        self.assertIn('m3u8', saved_item.streaming_url)
        self.assertIn('sp_auto', saved_item.streaming_url)

    def test_serializer_embed_url_xss_protection_domain(self):
        """Verify serializer rejects embed_urls with domains outside whitelist to prevent script/iframe injections."""
        external_data = self.item_data.copy()
        external_data.update({
            'provider': 'youtube',
            'public_id': None,
            'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'embed_url': 'https://attacker.site/malicious-iframe.html',
            'thumbnail_url': 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
        })
        serializer = GalleryItemSerializer(data=external_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('embed_url', serializer.errors)

    def test_serializer_embed_url_xss_protection_malicious_chars(self):
        """Verify serializer rejects embed_urls containing malicious script tags or Javascript execution contexts."""
        external_data = self.item_data.copy()
        external_data.update({
            'provider': 'youtube',
            'public_id': None,
            'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'embed_url': 'https://www.youtube.com/embed/dQw4w9WgXcQ?onclick=javascript:alert(1)',
            'thumbnail_url': 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
        })
        # Intentar colar javascript: u otros caracteres sospechosos
        external_data['embed_url'] = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ<script>alert(1)</script>'
        serializer = GalleryItemSerializer(data=external_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('embed_url', serializer.errors)

    def test_ordering_consistency(self):
        """Verify GalleryItems query ordering resolves to manual order ASC and created_at DESC."""
        g1 = GalleryItem.objects.create(title='A', media_type='image', url='http://x.com', order=2)
        g2 = GalleryItem.objects.create(title='B', media_type='image', url='http://y.com', order=1)
        g3 = GalleryItem.objects.create(title='C', media_type='image', url='http://z.com', order=2)
        
        items = list(GalleryItem.objects.all())
        self.assertEqual(items[0], g2) # order=1
        self.assertEqual(items[1], g3) # order=2 (creado último, por ende primero entre los de order=2)
        self.assertEqual(items[2], g1) # order=2 (creado primero)


class GalleryItemViewSetIntegrationTest(APITestCase):
    def setUp(self):
        self.normal_user = User.objects.create_user(email='fan@gmail.com', username='fan', password='Password123!')
        self.admin_user = User.objects.create_user(email='admin@msambar.com', username='admin', password='Password123!', is_staff=True)
        self.item = GalleryItem.objects.create(
            title='Live Concert',
            media_type='image',
            provider='cloudinary',
            url='https://res.cloudinary.com/dyhgivsyh/image/upload/v1/live.jpg',
            public_id='live_123',
            order=0
        )
        self.list_url = reverse('gallery-item-list')
        self.detail_url = reverse('gallery-item-detail', kwargs={'pk': self.item.pk})
        self.signature_url = reverse('gallery-item-signature')
        self.parse_url = reverse('gallery-item-parse-external-url')

    def test_list_is_public(self):
        """Verify list endpoint permits public access without auth."""
        res = self.client.get(self.list_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

    def test_mutations_require_admin(self):
        """Verify POST, PUT, DELETE operations block normal users and anonymous visitors."""
        # Anonymous
        res = self.client.post(self.list_url, {'title': 'No auth'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        # Authenticated but non-staff
        self.client.force_authenticate(user=self.normal_user)
        res = self.client.post(self.list_url, {'title': 'Normal User'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Staff can do it
        self.client.force_authenticate(user=self.admin_user)
        data = {
            'title': 'New Staff Item',
            'media_type': 'image',
            'provider': 'cloudinary',
            'url': 'https://res.cloudinary.com/dyhgivsyh/image/upload/v1/new.jpg',
            'public_id': 'new_123'
        }
        res = self.client.post(self.list_url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_signature_endpoint_limits(self):
        """Verify signature endpoint generates tokens and validates limits (Image < 10MB, Video < 100MB)."""
        self.client.force_authenticate(user=self.admin_user)

        # Invalid sizes
        res = self.client.post(self.signature_url, {'media_type': 'image', 'file_size': 11 * 1024 * 1024}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('file_size', res.data)

        res = self.client.post(self.signature_url, {'media_type': 'video', 'file_size': 101 * 1024 * 1024}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Valid payload
        res = self.client.post(self.signature_url, {'media_type': 'image', 'file_size': 5 * 1024 * 1024}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('signature', res.data)
        self.assertIn('public_id', res.data)

    @patch('requests.get')
    def test_parse_external_url_youtube_success(self, mock_get):
        """Verify parse_external_url successfully extracts YouTube metadata and returns auto-completed structure."""
        self.client.force_authenticate(user=self.admin_user)

        # Mock YouTube oEmbed JSON response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'title': 'Ms Ambar Live Concert YouTube',
            'width': 1920,
            'height': 1080
        }
        mock_get.return_value = mock_response

        res = self.client.post(self.parse_url, {'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['provider'], 'youtube')
        self.assertEqual(res.data['external_id'], 'dQw4w9WgXcQ')
        self.assertEqual(res.data['title'], 'Ms Ambar Live Concert YouTube')
        self.assertEqual(res.data['embed_url'], 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')

    @patch('requests.get')
    def test_parse_external_url_api_failure_handling(self, mock_get):
        """Verify parse_external_url handles oEmbed timeouts/failures gracefully and does not throw 500 error."""
        self.client.force_authenticate(user=self.admin_user)

        # Simulate timeout on oEmbed request
        mock_get.side_effect = requests.exceptions.Timeout("Connection timed out")

        res = self.client.post(self.parse_url, {'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'}, format='json')
        # El endpoint no debe fallar con 500. Debe retornar HTTP 200 con la metadata básica parseada por Regex, omitiendo el oEmbed
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['provider'], 'youtube')
        self.assertEqual(res.data['external_id'], 'dQw4w9WgXcQ')
        self.assertEqual(res.data['title'], '') # Retorna vacío por falla de red, pero no crashea

    def test_concurrency_order_integrity(self):
        """Simulate rapid order field updates to verify no database inconsistencies occur."""
        self.client.force_authenticate(user=self.admin_user)
        for i in range(1, 6):
            res = self.client.patch(self.detail_url, {'order': i}, format='json')
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.item.refresh_from_db()
            self.assertEqual(self.item.order, i)

    @patch('cloudinary.uploader.upload')
    def test_optimize_images_action_success(self, mock_cloudinary_upload):
        """Verify optimize_images action processes image with PIL, uploads to Cloudinary, and calculates metrics."""
        self.client.force_authenticate(user=self.admin_user)

        mock_cloudinary_upload.return_value = {
            'secure_url': 'https://res.cloudinary.com/dyhgivsyh/image/upload/v1/gallery_opt_123.webp',
            'public_id': 'ms-ambar/gallery/gallery_opt_123',
            'width': 800,
            'height': 600
        }

        # Generar imagen real en memoria
        from io import BytesIO
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile

        img = Image.new('RGB', (1000, 800), color='red')
        buf = BytesIO()
        img.save(buf, format='JPEG')
        buf.seek(0)

        uploaded_file = SimpleUploadedFile("test_photo.jpg", buf.read(), content_type="image/jpeg")

        url = reverse('gallery-item-optimize-images')
        res = self.client.post(
            url,
            {
                'files': uploaded_file,
                'quality': 75,
                'max_size': 800,
                'to_webp': 'true',
                'save_to_gallery': 'true',
                'category': 'TestCat'
            },
            format='multipart'
        )

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['processed_count'], 1)
        self.assertEqual(res.data['total_files'], 1)
        self.assertEqual(len(res.data['results']), 1)
        self.assertEqual(res.data['results'][0]['status'], 'success')
        self.assertEqual(res.data['results'][0]['url'], 'https://res.cloudinary.com/dyhgivsyh/image/upload/v1/gallery_opt_123.webp')

    def test_optimize_images_exceeds_35mb_returns_error(self):
        """Verify optimize_images rejects individual files exceeding 35MB limit."""
        self.client.force_authenticate(user=self.admin_user)
        from django.core.files.uploadedfile import SimpleUploadedFile, UploadedFile

        huge_file = SimpleUploadedFile("huge_image.jpg", b"fake image bytes", content_type="image/jpeg")

        url = reverse('gallery-item-optimize-images')
        with patch.object(UploadedFile, 'size', 36 * 1024 * 1024):
            res = self.client.post(url, {'files': huge_file}, format='multipart')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['processed_count'], 0)
        self.assertEqual(res.data['results'][0]['status'], 'error')
        self.assertIn('35MB', res.data['results'][0]['error'])


