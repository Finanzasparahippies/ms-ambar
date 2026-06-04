from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Event, Theater, Ticket, Seat
from .serializers import EventSerializer, TheaterSerializer, TicketSerializer, SeatSerializer

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer

    def get_queryset(self):
        user = self.request.user
        if user and user.is_authenticated and user.is_staff:
            return Event.objects.all()
        return Event.objects.filter(is_active=True)

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'seats']:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    @action(detail=True, methods=['get'])
    def seats(self, request, pk=None):
        event = self.get_object()
        theater = event.theater
        if not theater:
            return Response({
                "seats": [],
                "elements": [],
                "message": "Este evento es un Meet & Greet y no requiere mapa de asientos."
            })
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
    permission_classes = [permissions.AllowAny]  # Open for Nectar Designer integration

    @action(detail=True, methods=['post'], url_path='generate_seats')
    def generate_seats(self, request, pk=None):
        """
        Triggers seat generation from the stored layout JSON.
        Called automatically by the Nectar Studio Designer after saving a layout.
        Nectar Pro: Eliminates the need for Django Admin to sync seats.
        """
        if not request.user or not request.user.is_authenticated or not request.user.is_staff:
            return Response({'error': 'No tienes permisos para realizar esta acción.'}, status=status.HTTP_403_FORBIDDEN)
            
        theater = self.get_object()
        if not theater.layout:
            return Response(
                {'error': 'Este teatro no tiene un layout guardado. Diseña el venue primero en Nectar Studio.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            count = theater.generate_seats()
            return Response({
                'status': 'success',
                'message': f'Se sincronizaron {count} asientos para {theater.name}.',
                'seats_generated': count,
                'theater_id': theater.id,
                'theater_name': theater.name,
            })
        except Exception as e:
            return Response(
                {'error': f'Error al generar asientos: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class TicketViewSet(viewsets.ModelViewSet):
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer

    def get_permissions(self):
        if self.action == 'checkout':
            return [permissions.AllowAny()]
        elif self.action == 'validate':
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return Ticket.objects.none()
        if user.is_staff or user.is_superuser:
            return Ticket.objects.all()
        return Ticket.objects.filter(user_email=user.email)

    def get_object(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup_value = self.kwargs[lookup_url_kwarg]
        
        try:
            import uuid
            # Try parsing as UUID to lookup by token in user's permitted queryset
            uuid.UUID(str(lookup_value))
            return self.get_queryset().get(token=lookup_value)
        except (ValueError, Ticket.DoesNotExist, TypeError):
            # Fallback to default primary key lookup
            return super().get_object()

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
                'seat': f"{ticket.seat.row}{ticket.seat.number}" if ticket.seat else "Meet & Greet"
            })
            
        except Ticket.DoesNotExist:
            return Response({'error': 'Boleto Inválido o Falsificado'}, status=404)

    @action(detail=False, methods=['post'], url_path='checkout')
    def checkout(self, request):
        email = request.data.get('email')
        event_id = request.data.get('event_id')
        seat_ids = request.data.get('seat_ids', [])
        quantity = request.data.get('quantity', 1)
        phone = request.data.get('phone', '')
        has_mg = request.data.get('has_mg', False)

        if not email or not event_id:
            return Response({'error': 'Email y ID de evento son requeridos.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            event = Event.objects.get(id=event_id)
        except Event.DoesNotExist:
            return Response({'error': 'Evento no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        from apps.tickets.utils import send_ticket_email

        tickets_created = []

        if event.event_type == 'meet_greet':
            qty = int(quantity)
            if qty < 1:
                return Response({'error': 'La cantidad debe ser al menos 1.'}, status=status.HTTP_400_BAD_REQUEST)
            
            for _ in range(qty):
                ticket = Ticket.objects.create(
                    event=event,
                    seat=None,
                    ga_zone=None,
                    user_email=email,
                    user_phone=phone,
                    status='paid',
                    has_mg=True
                )
                tickets_created.append(ticket)
                try:
                    send_ticket_email(ticket)
                except Exception as e:
                    print(f"Error sending ticket email: {e}")
        else:
            if not seat_ids:
                return Response({'error': 'Debes seleccionar al menos un asiento.'}, status=status.HTTP_400_BAD_REQUEST)
            
            occupied_seat_ids = Ticket.objects.filter(
                event=event,
                seat_id__in=seat_ids,
                status__in=['paid', 'reserved']
            ).values_list('seat_id', flat=True)

            if occupied_seat_ids:
                return Response({'error': 'Uno o más asientos ya están reservados o pagados.'}, status=status.HTTP_400_BAD_REQUEST)

            for s_id in seat_ids:
                try:
                    seat = Seat.objects.get(id=s_id)
                except Seat.DoesNotExist:
                    return Response({'error': f'Asiento con ID {s_id} no existe.'}, status=status.HTTP_400_BAD_REQUEST)

                ticket = Ticket.objects.create(
                    event=event,
                    seat=seat,
                    ga_zone=None,
                    user_email=email,
                    user_phone=phone,
                    status='paid',
                    has_mg=has_mg
                )
                tickets_created.append(ticket)
                try:
                    send_ticket_email(ticket)
                except Exception as e:
                    print(f"Error sending ticket email: {e}")

        serializer = TicketSerializer(tickets_created, many=True)
        return Response({
            'status': 'success',
            'message': f'Se han generado {len(tickets_created)} boletos exitosamente.',
            'tickets': serializer.data
        }, status=status.HTTP_201_CREATED)
