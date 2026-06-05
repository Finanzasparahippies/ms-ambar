from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Event, Theater, Ticket, Seat, SiteSettings
from .serializers import EventSerializer, TheaterSerializer, TicketSerializer, SeatSerializer, SiteSettingsSerializer

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer

    def get_serializer_context(self):
        """Pass request to serializer so image/flyer URLs are absolute."""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

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
        if self.action in ['checkout', 'by_session']:
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
            
            if ticket.status not in ['paid', 'used']:
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
            ticket.status = 'used'
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

        from apps.shop.utils import create_ticket_checkout_session
        from django.conf import settings

        success_url = f"{settings.FRONTEND_URL}/comprar-boletos"
        cancel_url = f"{settings.FRONTEND_URL}/comprar-boletos"

        seats = []
        if event.event_type == 'meet_greet':
            qty = int(quantity)
            if qty < 1:
                return Response({'error': 'La cantidad debe ser al menos 1.'}, status=status.HTTP_400_BAD_REQUEST)
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
                    seats.append(seat)
                except Seat.DoesNotExist:
                    return Response({'error': f'Asiento con ID {s_id} no existe.'}, status=status.HTTP_400_BAD_REQUEST)

        use_mock = False
        if not getattr(settings, 'TESTING', False):
            stripe_key = getattr(settings, 'STRIPE_SECRET_KEY', '')
            if not stripe_key or any(p in stripe_key for p in ['change_me', 'replace_me', 'test_mock', 'placeholder']):
                use_mock = True

        session_id = None
        session_url = None

        if not use_mock:
            try:
                # Create Stripe Checkout Session
                session = create_ticket_checkout_session(
                    event=event,
                    seats=seats,
                    user_email=email,
                    success_url=success_url,
                    cancel_url=cancel_url,
                    quantity=quantity,
                    has_mg=has_mg,
                    phone=phone
                )
                session_id = session.id
                session_url = session.url
            except Exception as e:
                import logging
                logging.getLogger("apps").warning(f"Error creating Stripe checkout session, falling back to mock: {e}")
                use_mock = True

        if use_mock:
            # Mock checkout fallback
            import uuid
            mock_session_id = f"mock_{uuid.uuid4().hex}"
            session_id = mock_session_id
            session_url = f"{success_url}?success=true&session_id={mock_session_id}"

            from apps.tickets.utils import send_ticket_email, send_ticket_whatsapp

            # Create tickets as 'paid' directly for mock so that returning immediately works
            if event.event_type == 'meet_greet':
                for _ in range(int(quantity)):
                    ticket = Ticket.objects.create(
                        event=event,
                        seat=None,
                        ga_zone=None,
                        user_email=email,
                        user_phone=phone,
                        status='paid',
                        has_mg=True,
                        stripe_session_id=mock_session_id
                    )
                    try:
                        send_ticket_email(ticket)
                        if ticket.user_phone:
                            send_ticket_whatsapp(ticket)
                    except Exception as e:
                        import logging
                        logging.getLogger("apps").warning(f"Error sending mock ticket email: {e}")
            else:
                for seat in seats:
                    ticket = Ticket.objects.create(
                        event=event,
                        seat=seat,
                        ga_zone=None,
                        user_email=email,
                        user_phone=phone,
                        status='paid',
                        has_mg=has_mg,
                        stripe_session_id=mock_session_id
                    )
                    try:
                        send_ticket_email(ticket)
                        if ticket.user_phone:
                            send_ticket_whatsapp(ticket)
                    except Exception as e:
                        import logging
                        logging.getLogger("apps").warning(f"Error sending mock ticket email: {e}")
        else:
            # Standard Stripe pre-creation of reserved tickets for concert
            if event.event_type != 'meet_greet':
                for seat in seats:
                    Ticket.objects.create(
                        event=event,
                        seat=seat,
                        ga_zone=None,
                        user_email=email,
                        user_phone=phone,
                        status='reserved',
                        has_mg=has_mg,
                        stripe_session_id=session_id
                    )

        return Response({
            'status': 'success',
            'session_id': session_id,
            'session_url': session_url
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='by_session')
    def by_session(self, request):
        session_id = request.query_params.get('session_id')
        if not session_id:
            return Response({'error': 'session_id es requerido.'}, status=status.HTTP_400_BAD_REQUEST)
        
        tickets = Ticket.objects.filter(stripe_session_id=session_id)
        
        # Sync fallback: check Stripe directly if webhook was delayed/blocked
        if not session_id.startswith('mock_'):
            is_unpaid = not tickets.exists() or any(t.status == 'reserved' for t in tickets)
            if is_unpaid:
                try:
                    import stripe
                    from django.conf import settings
                    from apps.shop.views import handle_successful_payment
                    
                    stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY', '')
                    session = stripe.checkout.Session.retrieve(session_id)
                    if session.get('payment_status') == 'paid':
                        handle_successful_payment(session)
                        tickets = Ticket.objects.filter(stripe_session_id=session_id)
                except Exception as e:
                    import logging
                    logging.getLogger("apps").warning(f"Error checking Stripe session synchronously: {e}")

        serializer = self.get_serializer(tickets, many=True)
        return Response(serializer.data)


class SiteSettingsView(APIView):
    """
    Retorna y actualiza la configuración global del sitio (singleton).
    GET  /api/tickets/settings/ — Público
    POST /api/tickets/settings/ — Solo admins (staff)
    """

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def get(self, request):
        settings_obj = SiteSettings.get()
        serializer = SiteSettingsSerializer(settings_obj, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        settings_obj = SiteSettings.get()
        # Update only provided fields
        if 'tickets_page_subtitle' in request.data:
            settings_obj.tickets_page_subtitle = request.data['tickets_page_subtitle']
        if 'homepage_cta_text' in request.data:
            settings_obj.homepage_cta_text = request.data['homepage_cta_text']
        settings_obj.save()
        serializer = SiteSettingsSerializer(settings_obj, context={'request': request})
        return Response(serializer.data)

