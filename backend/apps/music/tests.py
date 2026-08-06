from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from .models import Album, Track
from .services import MusicIngestionService


class MusicAppTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.album = Album.objects.create(
            title="Eclipse Test",
            release_year="2026",
            cover_url="https://example.com/cover.jpg",
            description="Álbum de prueba"
        )
        self.track = Track.objects.create(
            album=self.album,
            track_number=1,
            title="Pista 1",
            duration_seconds=210,
            preview_url="https://example.com/preview.mp3"
        )

    def test_list_albums(self):
        url = reverse('music-album-list')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res.data), 1)

    def test_list_tracks(self):
        url = reverse('music-track-list')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res.data), 1)

    def test_sync_endpoint(self):
        url = reverse('music-sync')
        res = self.client.post(url, {"query": "Ms Ambar"}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("album", res.data)

    def test_seed_initial_discography(self):
        Album.objects.all().delete()
        self.assertEqual(Album.objects.count(), 0)
        MusicIngestionService.seed_initial_discography()
        self.assertGreater(Album.objects.count(), 0)
