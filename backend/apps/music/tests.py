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

    def test_sanitize_sensitive_info(self):
        from .services import sanitize_sensitive_info
        raw_log = "Error connecting with Bearer secret_token_12345 key=secret_key_abc"
        clean_log = sanitize_sensitive_info(raw_log)
        self.assertNotIn("secret_token_12345", clean_log)
        self.assertNotIn("secret_key_abc", clean_log)
        self.assertIn("[REDACTED_TOKEN]", clean_log)
        self.assertIn("[REDACTED]", clean_log)

    def test_music_logging_with_utf8(self):
        import logging
        logger = logging.getLogger('apps.music')
        logger.info("Prueba de traza de música con caracteres especiales: Ámbar Canción ✨🎵")

    def test_playlist_crud_and_whitelist_validation(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        admin_user = User.objects.create_superuser('admin_music', 'admin@test.com', 'pass123')
        self.client.force_authenticate(user=admin_user)

        url = reverse('music-playlist-list')
        
        # 1. Crear playlist con dominio permitido
        valid_payload = {
            "title": "Oficial Spotify",
            "platform": "spotify",
            "render_type": "iframe",
            "embed_url": "https://open.spotify.com/embed/playlist/4SIS3MJKl1MVuumtycPU22",
            "is_active": True,
            "order": 1
        }
        res_valid = self.client.post(url, valid_payload, format='json')
        self.assertEqual(res_valid.status_code, status.HTTP_201_CREATED)
        playlist_id = res_valid.data['id']

        # 2. Intentar crear playlist con dominio no autorizado (malicioso)
        invalid_payload = {
            "title": "Playlist Maliciosa",
            "platform": "spotify",
            "render_type": "iframe",
            "embed_url": "https://malicious-site.com/phishing/embed",
            "is_active": True
        }
        res_invalid = self.client.post(url, invalid_payload, format='json')
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("embed_url", res_invalid.data)

        # 3. Usuario anónimo solo ve activas
        self.client.logout()
        res_anon = self.client.get(url)
        self.assertEqual(res_anon.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_anon.data), 1)

    def test_music_config_credentials_masking(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        admin_user = User.objects.create_superuser('admin_config', 'admin2@test.com', 'pass123')
        self.client.force_authenticate(user=admin_user)

        url = reverse('music-config')
        
        # Guardar credenciales iniciales
        payload = {
            "discography_description": "Nueva desc",
            "spotify_client_id": "sp_client_123",
            "spotify_client_secret": "secret_real_9999",
            "youtube_api_key": "yt_key_real_8888"
        }
        res_put = self.client.put(url, payload, format='json')
        self.assertEqual(res_put.status_code, status.HTTP_200_OK)

        # Verificar que la respuesta visual enmascara el secreto
        self.assertIn("••••••••", res_put.data['spotify_client_secret'])
        self.assertTrue(res_put.data['spotify_client_secret'].endswith("9999"))

        # Actualizar conservando el placeholder enmascarado
        update_payload = {
            "discography_description": "Desc actualizada",
            "spotify_client_secret": res_put.data['spotify_client_secret']
        }
        res_update = self.client.put(url, update_payload, format='json')
        self.assertEqual(res_update.status_code, status.HTTP_200_OK)

        # Verificar en BD que no se sobreescribió el secreto real
        config = MusicConfig.get_solo()
        self.assertEqual(config.spotify_client_secret, "secret_real_9999")
        self.assertEqual(config.discography_description, "Desc actualizada")


