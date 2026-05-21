from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import BookingInquiry, BookingContract
from .serializers import BookingInquirySerializer, BookingContractSerializer
from .utils import generate_booking_contract_pdf, send_booking_contract_emails

class BookingInquiryViewSet(viewsets.ModelViewSet):
    queryset = BookingInquiry.objects.all().order_by('-created_at')
    serializer_class = BookingInquirySerializer
    
    def get_permissions(self):
        if self.action == 'create':
            # Allow anyone to submit a booking inquiry
            return [permissions.AllowAny()]
        # Only admins can list, view details or delete inquiries
        return [permissions.IsAdminUser()]

    def perform_create(self, serializer):
        inquiry = serializer.save()
        
        # Automatically generate a booking contract proposal with a base fee (e.g. 25,000.00 MXN)
        contract = BookingContract.objects.create(
            inquiry=inquiry,
            fee=25000.00
        )
        
        # Generate proposal PDF and send out emails
        if generate_booking_contract_pdf(contract):
            send_booking_contract_emails(contract)

class BookingContractViewSet(viewsets.ModelViewSet):
    queryset = BookingContract.objects.all().order_by('-created_at')
    serializer_class = BookingContractSerializer

    def get_permissions(self):
        if self.action in ['sign', 'retrieve']:
            # Allow clients to read the contract details and sign
            return [permissions.AllowAny()]
        # Creating, listing or manager signing require admin privileges
        return [permissions.IsAdminUser()]

    @action(detail=True, methods=['post'], url_path='sign')
    def sign(self, request, pk=None):
        contract = self.get_object()
        if contract.is_fully_signed:
            return Response({'error': 'Este contrato ya está completamente firmado'}, status=status.HTTP_400_BAD_REQUEST)

        signature = request.data.get('signature')
        if not signature:
            return Response({'error': 'Firma del organizador requerida'}, status=status.HTTP_400_BAD_REQUEST)

        contract.signature_base64 = signature
        contract.signed_at = timezone.now()
        contract.save()

        # Update contract PDF with client signature and notify manager
        if generate_booking_contract_pdf(contract):
            send_booking_contract_emails(contract)
            return Response({'message': 'Contrato firmado por el organizador con éxito. Pendiente de firma de management.'})
        
        return Response({'error': 'Error al actualizar el PDF del contrato'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='manager_sign')
    def manager_sign(self, request, pk=None):
        contract = self.get_object()
        if not contract.signature_base64:
            return Response({'error': 'El organizador debe firmar antes del representante'}, status=status.HTTP_400_BAD_REQUEST)
        
        signature = request.data.get('signature')
        if not signature:
            return Response({'error': 'Firma del representante requerida'}, status=status.HTTP_400_BAD_REQUEST)

        contract.manager_signature = signature
        contract.manager_signed_at = timezone.now()
        contract.is_fully_signed = True
        contract.save()

        # Generate FINAL certified PDF and email to both
        if generate_booking_contract_pdf(contract):
            send_booking_contract_emails(contract)
            return Response({'message': 'Contrato cerrado y certificado enviado con éxito.'})

        return Response({'error': 'Error al finalizar el contrato'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
