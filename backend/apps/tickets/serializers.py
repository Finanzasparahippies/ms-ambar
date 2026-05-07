from rest_framework import serializers
from .models import Event, Theater, Seat, Ticket

class SeatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Seat
        fields = '__all__'

class TheaterSerializer(serializers.ModelSerializer):
    seats = SeatSerializer(many=True, read_only=True)
    class Meta:
        model = Theater
        fields = '__all__'

class EventSerializer(serializers.ModelSerializer):
    theater_name = serializers.CharField(source='theater.name', read_only=True)
    class Meta:
        model = Event
        fields = '__all__'

class TicketSerializer(serializers.ModelSerializer):
    event_title = serializers.CharField(source='event.title', read_only=True)
    seat_display = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = '__all__'
    
    def get_seat_display(self, obj):
        return f"{obj.seat.row}{obj.seat.number}"
