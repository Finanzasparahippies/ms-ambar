from rest_framework import serializers
from .models import Event, Theater, Seat, Ticket, GADeclaration

class SeatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Seat
        fields = ['id', 'section', 'row', 'number', 'category', 'status', 'base_price', 'x', 'y', 'angle']

class GADeclarationSerializer(serializers.ModelSerializer):
    class Meta:
        model = GADeclaration
        fields = '__all__'

class TheaterSerializer(serializers.ModelSerializer):
    seats = SeatSerializer(many=True, read_only=True)
    ga_zones = GADeclarationSerializer(many=True, read_only=True)
    class Meta:
        model = Theater
        fields = '__all__'

class EventSerializer(serializers.ModelSerializer):
    theater_name = serializers.SerializerMethodField()
    theater_location = serializers.SerializerMethodField()
    class Meta:
        model = Event
        fields = ['id', 'title', 'artist', 'date', 'theater', 'theater_name', 'theater_location', 'image', 'is_active', 'mg_price', 'mg_limit', 'mg_available', 'price_multiplier', 'event_type']

    def get_theater_name(self, obj):
        return obj.theater.name if obj.theater else None

    def get_theater_location(self, obj):
        return obj.theater.location if obj.theater else None

class TicketSerializer(serializers.ModelSerializer):
    event_title = serializers.CharField(source='event.title', read_only=True)
    event_date = serializers.DateTimeField(source='event.date', read_only=True)
    event_artist = serializers.CharField(source='event.artist', read_only=True)
    theater_name = serializers.SerializerMethodField()
    theater_location = serializers.SerializerMethodField()
    seat_display = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = '__all__'
    
    def get_theater_name(self, obj):
        return obj.event.theater.name if obj.event and obj.event.theater else "Convivencia"

    def get_theater_location(self, obj):
        return obj.event.theater.location if obj.event and obj.event.theater else "Plataforma Digital"

    def get_seat_display(self, obj):
        if obj.seat:
            return f"{obj.seat.row}{obj.seat.number}"
        if obj.ga_zone:
            return f"GA: {obj.ga_zone.name}"
        return "Meet & Greet"
