import os
import io
import uuid
import zipfile
import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils.timezone import localtime

from apps.tickets.models import Ticket
from apps.tickets.utils import format_seat_assignment
from apps.tickets.access.qr_crypto import generate_qr_payload, verify_qr_payload
from apps.tickets.services.apple_wallet import AppleWalletService
from apps.tickets.services.google_wallet import GoogleWalletService

logger = logging.getLogger('apps.tickets')


class Command(BaseCommand):
    help = "Inspecciona y diagnostica el estado integral de un boleto (datos, pagos, wallets y QR criptográfico)."

    def add_arguments(self, parser):
        parser.add_argument(
            'identifier',
            type=str,
            help='UUID (token) o ID numérico del boleto a diagnosticar'
        )

    def handle(self, *args, **options):
        ident = options['identifier'].strip()

        ticket = None
        # Buscar por ID numérico
        if ident.isdigit():
            ticket = Ticket.objects.select_related('event', 'seat', 'ga_zone', 'used_coupon').filter(id=int(ident)).first()

        # Buscar por token UUID
        if not ticket:
            try:
                val_uuid = uuid.UUID(ident)
                ticket = Ticket.objects.select_related('event', 'seat', 'ga_zone', 'used_coupon').filter(token=val_uuid).first()
            except ValueError:
                pass

        # Buscar por coincidencia parcial de token o sesión de Stripe
        if not ticket:
            ticket = Ticket.objects.select_related('event', 'seat', 'ga_zone', 'used_coupon').filter(
                token__icontains=ident
            ).first() or Ticket.objects.select_related('event', 'seat', 'ga_zone', 'used_coupon').filter(
                stripe_session_id=ident
            ).first()

        if not ticket:
            self.stdout.write(self.style.ERROR(f"❌ No se encontró ningún boleto con identificador: '{ident}'"))
            return

        self.stdout.write("=" * 70)
        self.stdout.write(self.style.MIGRATE_HEADING(f" DIAGNÓSTICO INTEGRAL DE BOLETO #{ticket.id}"))
        self.stdout.write("=" * 70)

        # 1. Datos Generales
        self.stdout.write(self.style.SUCCESS("[1. METADATOS Y ACCESO]"))
        self.stdout.write(f"  • ID:            {ticket.id}")
        self.stdout.write(f"  • Token (UUID):  {ticket.token}")
        status_color = self.style.SUCCESS if ticket.status == 'paid' else (self.style.WARNING if ticket.status == 'reserved' else self.style.ERROR)
        self.stdout.write(f"  • Estado:        {status_color(ticket.status.upper())}")
        self.stdout.write(f"  • Comprador:     {ticket.user_email} (Tel: {ticket.user_phone or 'N/A'})")
        self.stdout.write(f"  • Meet & Greet:  {'SÍ' if ticket.has_mg else 'NO'}")
        if ticket.used_coupon:
            self.stdout.write(f"  • Cupón Usado:   {ticket.used_coupon.code} ({ticket.used_coupon.discount_type})")
        self.stdout.write(f"  • Creado:        {localtime(ticket.created_at).strftime('%Y-%m-%d %H:%M:%S %Z')}")

        # 2. Evento y Ubicación
        self.stdout.write(f"\n{self.style.SUCCESS('[2. EVENTO Y UBICACIÓN]')}")
        event = ticket.event
        if event:
            self.stdout.write(f"  • Evento #{event.id}: {event.title} - {event.artist}")
            self.stdout.write(f"  • Fecha Evento:  {localtime(event.date).strftime('%Y-%m-%d %H:%M:%S %Z') if event.date else 'N/A'}")
            venue = getattr(event, 'venue_name', '') or (event.theater.name if event.theater else 'N/A')
            self.stdout.write(f"  • Recinto:       {venue}")
        else:
            self.stdout.write(self.style.ERROR("  • Evento:        SIN EVENTO VINCULADO"))

        seat_formatted = format_seat_assignment(ticket)
        self.stdout.write(f"  • Asignación:    {seat_formatted}")
        if ticket.seat:
            self.stdout.write(f"  • Detalle Butaca:ID={ticket.seat.id} | Fila={ticket.seat.row} | Num={ticket.seat.number} | Sec={ticket.seat.section} | Base=${ticket.seat.base_price}")
        elif ticket.ga_zone:
            self.stdout.write(f"  • Zona General:  ID={ticket.ga_zone.id} | Nombre={ticket.ga_zone.name} | Base=${ticket.ga_zone.base_price}")

        # 3. Transacción Stripe
        self.stdout.write(f"\n{self.style.SUCCESS('[3. PASARELA DE PAGO]')}")
        self.stdout.write(f"  • Stripe Session:{ticket.stripe_session_id or 'N/A'}")

        # 4. QR Criptográfico
        self.stdout.write(f"\n{self.style.SUCCESS('[4. SEGURIDAD QR]')}")
        try:
            qr_payload = generate_qr_payload(ticket, format_type='compact')
            qr_res = verify_qr_payload(qr_payload)
            self.stdout.write(f"  • Payload Compacto:{qr_payload[:40]}... (Total: {len(qr_payload)} chars)")
            if qr_res.get("valid"):
                self.stdout.write(self.style.SUCCESS(f"  • Validación HMAC: ✅ VÁLIDA (Firmado con SHA-256)"))
            else:
                self.stdout.write(self.style.ERROR(f"  • Validación HMAC: ❌ INVÁLIDA: {qr_res.get('error')}"))
        except Exception as qr_err:
            self.stdout.write(self.style.ERROR(f"  • Error QR: {qr_err}"))

        # 5. Apple Wallet (.pkpass)
        self.stdout.write(f"\n{self.style.SUCCESS('[5. APPLE WALLET (PASSKIT)]')}")
        cert_path = getattr(settings, 'APPLE_CERT_PATH', '')
        wwdr_path = getattr(settings, 'APPLE_WWDR_CERT_PATH', '')
        self.stdout.write(f"  • Pass Type ID:  {getattr(settings, 'APPLE_PASS_TYPE_ID', 'N/A')}")
        self.stdout.write(f"  • Team ID:       {getattr(settings, 'APPLE_TEAM_ID', 'N/A')}")
        self.stdout.write(f"  • Cert Path:     {cert_path or 'No configurado'} ({'EXISTE' if cert_path and os.path.exists(cert_path) else 'NO ENCONTRADO'})")
        self.stdout.write(f"  • WWDR Path:     {wwdr_path or 'No configurado'} ({'EXISTE' if wwdr_path and os.path.exists(wwdr_path) else 'NO ENCONTRADO'})")

        try:
            apple_svc = AppleWalletService()
            pkpass_data = apple_svc.generate_pass(ticket)
            zip_buf = io.BytesIO(pkpass_data)
            with zipfile.ZipFile(zip_buf, 'r') as zf:
                files = zf.namelist()
            self.stdout.write(self.style.SUCCESS(
                f"  • Compilación PKCS#7: ✅ EXITOSA ({len(pkpass_data)} bytes, {len(files)} archivos empaquetados)"
            ))
            if not cert_path or not os.path.exists(cert_path):
                self.stdout.write(self.style.WARNING(
                    "    ⚠️ Nota: Usando firma sintética en memoria. Para validación estricta de iOS en producción "
                    "se requiere instalar el certificado Pass Type ID oficial (.p12 o .pem) de Apple Developer."
                ))
        except Exception as apple_err:
            self.stdout.write(self.style.ERROR(f"  • Compilación PKCS#7: ❌ FALLÓ: {apple_err}"))

        # 6. Google Wallet
        self.stdout.write(f"\n{self.style.SUCCESS('[6. GOOGLE WALLET]')}")
        issuer_id = getattr(settings, 'GOOGLE_WALLET_ISSUER_ID', '')
        sa_file = getattr(settings, 'GOOGLE_WALLET_SERVICE_ACCOUNT_KEY_FILE', '')
        self.stdout.write(f"  • Issuer ID:     {issuer_id or 'No configurado'}")
        self.stdout.write(f"  • SA Key File:   {sa_file or 'No configurado'} ({'EXISTE' if sa_file and os.path.exists(sa_file) else 'NO ENCONTRADO'})")
        try:
            gw_svc = GoogleWalletService()
            gw_res = gw_svc.generate_save_url(ticket)
            save_url = gw_res.get('save_url', '') if isinstance(gw_res, dict) else str(gw_res)
            self.stdout.write(self.style.SUCCESS(
                f"  • Save URL JWT:  ✅ GENERADA ({save_url[:50]}...)"
            ))
        except Exception as gw_err:
            self.stdout.write(self.style.ERROR(f"  • Save URL:      ❌ FALLÓ: {gw_err}"))

        self.stdout.write("=" * 70)
