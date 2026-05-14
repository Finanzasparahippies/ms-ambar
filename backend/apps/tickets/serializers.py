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
    theater_name = serializers.CharField(source='theater.name', read_only=True)
    theater_location = serializers.CharField(source='theater.location', read_only=True)
    class Meta:
        model = Event
        fields = ['id', 'title', 'artist', 'date', 'theater', 'theater_name', 'theater_location', 'image', 'is_active', 'mg_price', 'mg_limit', 'mg_available', 'price_multiplier']

class TicketSerializer(serializers.ModelSerializer):
    event_title = serializers.CharField(source='event.title', read_only=True)
    seat_display = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = '__all__'
    
    def get_seat_display(self, obj):
        if obj.seat:
            return f"{obj.seat.row}{obj.seat.number}"
        if obj.ga_zone:
            return f"GA: {obj.ga_zone.name}"
        return "N/A"
