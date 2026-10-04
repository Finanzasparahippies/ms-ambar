import logging
import hashlib
from django.conf import settings
from django.http import HttpResponse
from django.utils.http import http_date, parse_http_date_safe
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from apps.tickets.models import Ticket
from apps.tickets.services.apple_wallet import AppleWalletService

logger = logging.getLogger('apps.tickets')


def _verify_passkit_auth(request, serial_number: str) -> bool:
    """
    Verifica el encabezado Authorization: ApplePass <authenticationToken>
    comparándolo contra el token derivado del serialNumber (ticket.token).
    """
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('ApplePass '):
        return False

    received_token = auth_header.split(' ', 1)[1].strip()
    expected_token = hashlib.sha256(
        f"{serial_number}:{settings.SECRET_KEY}".encode('utf-8')
    ).hexdigest()[:32]

    return received_token == expected_token


class PassKitDeviceRegistrationView(APIView):
    """
    Apple PassKit Web Service: Registro y desregistro de dispositivos para Notificaciones Push (APNs).
    POST /api/tickets/passkit/v1/devices/{device_id}/registrations/{pass_type_id}/{serial_number}
    DELETE /api/tickets/passkit/v1/devices/{device_id}/registrations/{pass_type_id}/{serial_number}
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, device_id: str, pass_type_id: str, serial_number: str):
        if not _verify_passkit_auth(request, serial_number):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

        push_token = request.data.get('pushToken')
        if not push_token:
            return Response({'error': 'pushToken is required'}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f"passkit_device:{device_id}:{serial_number}"
        is_already_registered = bool(cache.get(cache_key))

        cache.set(cache_key, {
            'device_id': device_id,
            'pass_type_id': pass_type_id,
            'serial_number': serial_number,
            'push_token': push_token,
        }, timeout=86400 * 30)

        logger.info(f"[PASSKIT/REGISTER] Dispositivo {device_id[:8]}... registrado para pase {serial_number}")

        return Response(status=status.HTTP_200_OK if is_already_registered else status.HTTP_201_CREATED)

    def delete(self, request, device_id: str, pass_type_id: str, serial_number: str):
        if not _verify_passkit_auth(request, serial_number):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

        cache_key = f"passkit_device:{device_id}:{serial_number}"
        cache.delete(cache_key)

        logger.info(f"[PASSKIT/UNREGISTER] Dispositivo {device_id[:8]}... desregistrado para pase {serial_number}")
        return Response(status=status.HTTP_200_OK)


class PassKitLatestPassView(APIView):
    """
    Apple PassKit Web Service: Entrega la versión más reciente del pase .pkpass.
    Invocado por iOS tras recibir un Push Notification silencioso (APNs) o al refrescar el pase.
    GET /api/tickets/passkit/v1/passes/{pass_type_id}/{serial_number}
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, pass_type_id: str, serial_number: str):
        if not _verify_passkit_auth(request, serial_number):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            ticket = Ticket.objects.select_related('event', 'seat', 'ga_zone', 'used_coupon').get(token=serial_number)
        except Ticket.DoesNotExist:
            return Response({'error': 'Pass not found'}, status=status.HTTP_404_NOT_FOUND)

        if ticket.status == 'cancelled':
            return Response({'error': 'Pass cancelled'}, status=status.HTTP_400_BAD_REQUEST)

        # Validación condicional If-Modified-Since
        ims_header = request.headers.get('If-Modified-Since')
        if ims_header and ticket.updated_at:
            ims_timestamp = parse_http_date_safe(ims_header)
            if ims_timestamp and int(ticket.updated_at.timestamp()) <= ims_timestamp:
                return HttpResponse(status=304)

        service = AppleWalletService()
        pkpass_bytes = service.generate_pass(ticket)

        response = HttpResponse(pkpass_bytes, content_type='application/vnd.apple.pkpass')
        response['Content-Disposition'] = f'attachment; filename="ms-ambar-ticket-{ticket.id}.pkpass"'
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        if ticket.updated_at:
            response['Last-Modified'] = http_date(ticket.updated_at.timestamp())

        return response


class PassKitLogView(APIView):
    """
    Apple PassKit Web Service: Receptor de reportes y diagnósticos de clientes iOS.
    POST /api/tickets/passkit/v1/log
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        logs = request.data.get('logs', [])
        for log_entry in logs:
            logger.warning(f"[PASSKIT_DEVICE_LOG] {log_entry}")
        return Response(status=status.HTTP_200_OK)
