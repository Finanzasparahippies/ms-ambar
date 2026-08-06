from django.test import TestCase
from django.urls import reverse
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient
from .models import Album, Track, MusicConfig
from .services import MusicIngestionService


class MusicAppTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.album = Album.objects.create(
            title="Eclipse Test",
            release_year="2026",
            cover_url="https://example.com/cover.jpg",
            description="Álbum de prueba",
            spotify_id="sp_test_album_001",
            youtube_id="yt_test_album_001",
            itunes_id="it_test_album_001"
        )
        self.track = Track.objects.create(
            album=self.album,
            track_number=1,
            title="Pista 1",
            duration_seconds=210,
            preview_url="https://example.com/preview.mp3",
            spotify_id="sp_test_track_001",
            youtube_id="yt_test_track_001",
            itunes_id="it_test_track_001"
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

    def test_music_config_endpoint_and_emoji_persistence(self):
        url = reverse('music-config')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("discography_description", res.data)

        emoji_text = "Música Oficial de Ms. Ambar ✨🎵🔥 Sencillos & Lanzamientos 🎧🌟"
        config = MusicConfig.get_solo()
        config.discography_description = emoji_text
        config.save()

        config.refresh_from_db()
        self.assertEqual(config.discography_description, emoji_text)

    def test_seed_initial_discography(self):
        Album.objects.all().delete()
        self.assertEqual(Album.objects.count(), 0)
        MusicIngestionService.seed_initial_discography()
        self.assertGreater(Album.objects.count(), 0)

    def test_spotify_token_caching(self):
        token = MusicIngestionService.get_spotify_access_token()
        self.assertIsNone(token)

    def test_fetch_connectors_graceful_fallbacks(self):
        itunes = MusicIngestionService.fetch_itunes_tracks("Ms Ambar")
        self.assertIsInstance(itunes, list)
        
        youtube = MusicIngestionService.fetch_youtube_tracks("Ms Ambar")
        self.assertIsInstance(youtube, list)

        spotify = MusicIngestionService.fetch_spotify_catalog("Ms Ambar")
        self.assertIsInstance(spotify, list)
