from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Event, Theater, Ticket, Seat
from .serializers import EventSerializer, TheaterSerializer, TicketSerializer, SeatSerializer

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.filter(is_active=True)
    serializer_class = EventSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=True, methods=['get'])
    def seats(self, request, pk=None):
        event = self.get_object()
        theater = event.theater
        seats = Seat.objects.filter(theater=theater)
        
        # Get occupied seats for this event
        occupied_seat_ids = Ticket.objects.filter(
            event=event, 
            status__in=['paid', 'reserved']
        ).values_list('seat_id', flat=True)
        
        serializer = SeatSerializer(seats, many=True)
        data = serializer.data
        
        # Add status to each seat
        for seat_data in data:
            if seat_data['id'] in occupied_seat_ids:
                seat_data['status'] = 'occupied'
            else:
                seat_data['status'] = 'available'
        
        return Response({
            "seats": data,
            "elements": theater.layout.get('map_elements', []) if isinstance(theater.layout, dict) else []
        })

class TheaterViewSet(viewsets.ModelViewSet):
    queryset = Theater.objects.all()
    serializer_class = TheaterSerializer
    permission_classes = [permissions.IsAdminUser]

class TicketViewSet(viewsets.ModelViewSet):
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer
    permission_classes = [permissions.AllowAny] # Changed to allow any for demo, should be authenticated in prod

    def get_queryset(self):
        email = self.request.query_params.get('email')
        if email:
            return Ticket.objects.filter(user_email=email)
        return Ticket.objects.none()
