from urllib.parse import urlparse
from rest_framework import serializers
from .models import Album, Track, MusicConfig, Playlist

ALLOWED_EMBED_DOMAINS = [
    'spotify.com',
    'open.spotify.com',
    'youtube.com',
    'www.youtube.com',
    'youtube-nocookie.com',
    'youtu.be',
    'apple.com',
    'music.apple.com',
    'embed.music.apple.com',
    'amazon.com',
    'music.amazon.com',
    'amazon.es',
    'amazon.co.uk',
]

MASK_PLACEHOLDER = "••••••••"


class MusicConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = MusicConfig
        fields = [
            'id', 'discography_description', 'youtube_api_key',
            'spotify_client_id', 'spotify_client_secret',
            'apple_music_region', 'amazon_music_artist_id', 'updated_at'
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Sanitizar / enmascarar secretos visualmente
        if data.get('youtube_api_key'):
            key = data['youtube_api_key']
            data['youtube_api_key'] = f"{MASK_PLACEHOLDER}{key[-4:]}" if len(key) > 4 else MASK_PLACEHOLDER
        if data.get('spotify_client_secret'):
            sec = data['spotify_client_secret']
            data['spotify_client_secret'] = f"{MASK_PLACEHOLDER}{sec[-4:]}" if len(sec) > 4 else MASK_PLACEHOLDER
        return data

    def update(self, instance, validated_data):
        # Prevenir sobreescribir secreto real si el usuario envía el enmascarado
        yt_key = validated_data.get('youtube_api_key')
        if yt_key and MASK_PLACEHOLDER in yt_key:
            validated_data.pop('youtube_api_key', None)

        sp_secret = validated_data.get('spotify_client_secret')
        if sp_secret and MASK_PLACEHOLDER in sp_secret:
            validated_data.pop('spotify_client_secret', None)

        return super().update(instance, validated_data)


class PlaylistSerializer(serializers.ModelSerializer):
    class Meta:
        model = Playlist
        fields = [
            'id', 'title', 'platform', 'render_type', 'embed_url',
            'external_id', 'description', 'is_active', 'order',
            'created_at', 'updated_at'
        ]

    def validate_embed_url(self, value):
        if not value:
            return value

        cleaned = value.strip()
        if not (cleaned.startswith("http://") or cleaned.startswith("https://")):
            raise serializers.ValidationError("La URL del iframe debe iniciar con http:// o https://")

        try:
            parsed = urlparse(cleaned)
            hostname = (parsed.hostname or "").lower()
            
            is_allowed = any(
                hostname == domain or hostname.endswith("." + domain)
                for domain in ALLOWED_EMBED_DOMAINS
            )
            if not is_allowed:
                raise serializers.ValidationError(
                    f"Dominio no autorizado '{hostname}'. Solo se permiten reproductores de Spotify, YouTube, Apple Music o Amazon Music."
                )
        except Exception as err:
            if isinstance(err, serializers.ValidationError):
                raise err
            raise serializers.ValidationError("URL de iframe inválida o mal estructurada.")

        return cleaned


class TrackSerializer(serializers.ModelSerializer):
    duration_display = serializers.SerializerMethodField()

    class Meta:
        model = Track
        fields = [
            'id', 'album', 'track_number', 'title', 'duration_seconds',
            'duration_display', 'preview_url', 'spotify_id', 'youtube_id',
            'itunes_id', 'is_single', 'play_count', 'created_at'
        ]

    def get_duration_display(self, obj):
        mins = obj.duration_seconds // 60
        secs = obj.duration_seconds % 60
        return f"{mins}:{secs:02d}"


class AlbumSerializer(serializers.ModelSerializer):
    tracks = TrackSerializer(many=True, read_only=True)
    tracks_count = serializers.SerializerMethodField()

    class Meta:
        model = Album
        fields = [
            'id', 'title', 'release_year', 'cover_url', 'release_date',
            'description', 'spotify_url', 'apple_music_url', 'youtube_url',
            'youtube_music_url', 'amazon_music_url', 'spotify_id',
            'youtube_id', 'itunes_id', 'is_featured',
            'tracks', 'tracks_count', 'created_at', 'updated_at'
        ]

    def get_tracks_count(self, obj):
        return obj.tracks.count()


