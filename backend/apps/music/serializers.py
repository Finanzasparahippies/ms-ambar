from rest_framework import serializers
from .models import Album, Track


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
