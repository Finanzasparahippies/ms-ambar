from rest_framework import viewsets, permissions
from .models import Event, Theater, Ticket
from .serializers import EventSerializer, TheaterSerializer, TicketSerializer

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.filter(is_active=True)
    serializer_class = EventSerializer
    permission_classes = [permissions.AllowAny]

class TheaterViewSet(viewsets.ModelViewSet):
    queryset = Theater.objects.all()
    serializer_class = TheaterSerializer
    permission_classes = [permissions.IsAdminUser]

class TicketViewSet(viewsets.ModelViewSet):
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Ticket.objects.filter(user_email=self.request.user.email)
    
    def perform_create(self, serializer):
        serializer.save(user_email=self.request.user.email)
