from django.utils import timezone
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
    permission_classes = [permissions.AllowAny] # Changed to AllowAny for Nectar Designer integration

class TicketViewSet(viewsets.ModelViewSet):
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        email = self.request.query_params.get('email')
        if email:
            return Ticket.objects.filter(user_email=email)
        return Ticket.objects.all()

    @action(detail=False, methods=['post'], url_path='validate')
    def validate(self, request):
        token = request.data.get('token')
        if not token:
            return Response({'error': 'Token QR no proporcionado'}, status=400)
        
        try:
            ticket = Ticket.objects.get(token=token)
            
            if ticket.status != 'paid':
                return Response({
                    'status': 'error',
                    'message': 'Este boleto no ha sido pagado todavía.'
                }, status=400)
                
            if ticket.is_scanned:
                return Response({
                    'status': 'already_used',
                    'message': f'Boleto ya utilizado el {ticket.scanned_at.strftime("%d/%m %H:%M")}',
                    'scanned_at': ticket.scanned_at
                }, status=400)
                
            # Validar y marcar
            ticket.is_scanned = True
            ticket.scanned_at = timezone.now()
            ticket.save()
            
            return Response({
                'status': 'success',
                'message': 'Acceso Permitido',
                'event': ticket.event.title,
                'seat': f"{ticket.seat.row}{ticket.seat.number}"
            })
            
        except Ticket.DoesNotExist:
            return Response({'error': 'Boleto Inválido o Falsificado'}, status=404)
