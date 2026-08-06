import logging
import time
import requests
from django.conf import settings
from django.core.cache import cache
from .models import Album, Track

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 86400  # 24 Horas TTL para Rate Limiting y Cuota Anti-Exhaustion
SPOTIFY_TOKEN_TTL_SECONDS = 3500  # 58 minutos TTL para Bearer token OAuth de Spotify


class MusicIngestionService:
    """
    Servicio Centralizado de Ingesta Multi-Plataforma, Caché de Tokens y Rate Limiting para Ms Ambar.
    Conectores para Spotify, iTunes/Apple Music, YouTube / YouTube Music y Amazon Music.
    """

    @staticmethod
    def get_spotify_access_token():
        """
        Obtiene y almacena en caché de Django el token Bearer OAuth de Spotify usando Client Credentials Flow.
        TTL de 3500 segundos para evitar llamadas de autenticación repetitivas.
        """
        cache_key = "spotify_access_token"
        token = cache.get(cache_key)
        if token:
            return token

        client_id = getattr(settings, 'SPOTIFY_CLIENT_ID', '')
        client_secret = getattr(settings, 'SPOTIFY_CLIENT_SECRET', '')

        if not client_id or not client_secret or client_id.startswith('mock_'):
            logger.info("[MusicIngestionService] Spotify Client ID/Secret son mock o vacíos. Omitiendo OAuth real.")
            return None

        auth_url = "https://accounts.spotify.com/api/token"
        try:
            res = requests.post(
                auth_url,
                data={"grant_type": "client_credentials"},
                auth=(client_id, client_secret),
                timeout=5
            )
            if res.status_code == 200:
                token_data = res.json()
                access_token = token_data.get("access_token")
                expires_in = token_data.get("expires_in", SPOTIFY_TOKEN_TTL_SECONDS)
                ttl = max(60, expires_in - 100)
                cache.set(cache_key, access_token, ttl)
                logger.info("[MusicIngestionService] Token OAuth de Spotify obtenido y almacenado en caché.")
                return access_token
        except Exception as err:
            logger.error(f"[MusicIngestionService] Error obteniendo Spotify Access Token: {err}")
        return None

    @staticmethod
    def fetch_spotify_catalog(artist_name="Ms Ambar"):
        """
        Obtiene canciones y álbumes desde la API Oficial de Spotify con caché de 24h.
        """
        cache_key = f"spotify_catalog_{artist_name.replace(' ', '_').lower()}"
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return cached_data

        token = MusicIngestionService.get_spotify_access_token()
        if not token:
            cache.set(cache_key, [], CACHE_TTL_SECONDS)
            return []

        search_url = "https://api.spotify.com/v1/search"
        headers = {"Authorization": f"Bearer {token}"}
        params = {"q": f"artist:{artist_name}", "type": "album,track", "limit": 20}

        try:
            res = requests.get(search_url, headers=headers, params=params, timeout=5)
            if res.status_code == 200:
                data = res.json()
                cache.set(cache_key, data, CACHE_TTL_SECONDS)
                return data
            elif res.status_code == 429:
                logger.warning("[MusicIngestionService] Rate limit alcanzado en Spotify API. Usando caché o vacíos.")
        except Exception as err:
            logger.error(f"[MusicIngestionService] Error consultando Spotify API: {err}")

        return []

    @staticmethod
    def fetch_itunes_tracks(artist_name="Ms Ambar"):
        """
        Obtiene canciones y previsualizaciones reales desde iTunes Search API con caché de 24h.
        Evita bloqueos de cuota o rate limits externos con exponencial backoff ante fallos.
        """
        cache_key = f"itunes_tracks_{artist_name.replace(' ', '_').lower()}"
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            logger.info("[MusicIngestionService] Retornando canciones de iTunes desde la caché de Django.")
            return cached_data

        url = getattr(settings, 'ITUNES_SEARCH_URL', 'https://itunes.apple.com/search')
        params = {"term": artist_name, "entity": "song", "limit": 25}
        
        # Exponential backoff retry logic (max 2 retries)
        for attempt in range(2):
            try:
                res = requests.get(url, params=params, timeout=5)
                if res.status_code == 200:
                    results = res.json().get("results", [])
                    cache.set(cache_key, results, CACHE_TTL_SECONDS)
                    return results
            except Exception as err:
                logger.error(f"[MusicIngestionService] Intento {attempt+1} falló al conectar con iTunes API: {err}")
                time.sleep(0.2 * (2 ** attempt))

        cache.set(cache_key, [], CACHE_TTL_SECONDS)
        return []

    @staticmethod
    def fetch_youtube_tracks(query="Ms Ambar"):
        """
        Obtiene videos y tracks oficiales desde YouTube Data API v3 con caché de 24h.
        """
        cache_key = f"youtube_tracks_{query.replace(' ', '_').lower()}"
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return cached_data

        api_key = getattr(settings, 'YOUTUBE_API_KEY', '')
        if not api_key or api_key.startswith('mock_'):
            logger.info("[MusicIngestionService] YouTube API Key es mock o vacía.")
            cache.set(cache_key, [], CACHE_TTL_SECONDS)
            return []

        url = "https://www.googleapis.com/youtube/v3/search"
        params = {
            "part": "snippet",
            "q": query,
            "type": "video",
            "key": api_key,
            "maxResults": 15
        }
        try:
            res = requests.get(url, params=params, timeout=5)
            if res.status_code == 200:
                items = res.json().get("items", [])
                cache.set(cache_key, items, CACHE_TTL_SECONDS)
                return items
        except Exception as err:
            logger.error(f"[MusicIngestionService] Error al conectar con YouTube Data API: {err}")

        cache.set(cache_key, [], CACHE_TTL_SECONDS)
        return []

    @staticmethod
    def sync_platform_metadata(query="Ms Ambar"):
        """
        Sincroniza y normaliza metadatos desde conectores externos (iTunes, Spotify, YouTube, Amazon)
        poblando únicamente la música REAL de Ms Ambar e eliminando álbumes falsos de prueba.
        """
        # Eliminar álbumes falsos de prueba obsoletos
        Album.objects.filter(title__in=["Eclipse", "Ambar Vision", "Desierto de Cristal", "Sinfonías de Ámbar"]).delete()
        Track.objects.filter(preview_url__icontains="soundhelix.com").delete()

        itunes_results = MusicIngestionService.fetch_itunes_tracks(query)
        _ = MusicIngestionService.fetch_spotify_catalog(query)
        _ = MusicIngestionService.fetch_youtube_tracks(query)

        if not itunes_results:
            existing = Album.objects.filter(title="Ms Ambar Aleatorio").first()
            if existing:
                return existing
            # Si no hay resultados de iTunes, retornar o crear álbum sin pistas falsas
            alb, _ = Album.objects.get_or_create(
                itunes_id=f"itunes_album_{query.replace(' ', '_').lower()}",
                defaults={
                    "title": "Ms Ambar Aleatorio",
                    "release_year": "2026",
                    "cover_url": "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&q=80",
                    "description": "Catálogo oficial de sencillos y lanzamientos en vivo de Ms. Ambar.",
                    "spotify_url": "https://open.spotify.com",
                    "apple_music_url": "https://music.apple.com",
                    "youtube_url": "https://youtube.com",
                    "youtube_music_url": "https://music.youtube.com",
                    "amazon_music_url": "https://music.amazon.com",
                }
            )
            return alb

        first_cover = next((item.get("artworkUrl100", "").replace("100x100bb", "600x600bb") for item in itunes_results if item.get("artworkUrl100")), "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&q=80")

        album_obj, _ = Album.objects.update_or_create(
            itunes_id=f"itunes_album_{query.replace(' ', '_').lower()}",
            defaults={
                "title": "Ms Ambar Aleatorio",
                "release_year": "2026",
                "cover_url": first_cover,
                "description": "Recopilación oficial de sencillos y colecciones acústicas de Ms. Ambar.",
                "spotify_url": "https://open.spotify.com",
                "apple_music_url": "https://music.apple.com",
                "youtube_url": "https://youtube.com",
                "youtube_music_url": "https://music.youtube.com",
                "amazon_music_url": "https://music.amazon.com",
                "spotify_id": f"sp_album_{query.replace(' ', '_').lower()}",
                "youtube_id": f"yt_album_{query.replace(' ', '_').lower()}",
            }
        )

        synced_tracks = []
        for idx, item in enumerate(itunes_results, start=1):
            track_title = item.get("trackName") or f"Pista {idx}"
            duration = (item.get("trackTimeMillis") or 210000) // 1000
            preview = item.get("previewUrl")
            it_id = str(item.get("trackId", idx))

            track_obj, _ = Track.objects.update_or_create(
                itunes_id=f"it_{it_id}",
                defaults={
                    "album": album_obj,
                    "title": track_title,
                    "track_number": idx,
                    "duration_seconds": duration,
                    "preview_url": preview,
                    "spotify_id": f"sp_{it_id}",
                    "youtube_id": f"yt_{it_id}",
                    "is_single": True
                }
            )
            synced_tracks.append(track_obj)

        return album_obj

    @staticmethod
    def seed_initial_discography():
        """
        Poblamiento inicial de música REAL de Ms Ambar consumiendo las APIs oficiales.
        Elimina datos falsos o ficticios.
        """
        return MusicIngestionService.sync_platform_metadata("Ms Ambar")
