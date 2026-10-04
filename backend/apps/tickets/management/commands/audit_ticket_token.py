import logging
import uuid
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone
import stripe

from apps.tickets.models import Ticket, Seat, Event
from apps.tickets.utils import send_ticket_email, format_seat_assignment
from apps.dashboard.views import get_ticket_actual_price

logger = logging.getLogger('apps.tickets')

DEFAULT_TARGET_TOKENS = [
    "ef7d4a06-1271-4dff-85d2-c046680e0382",
    "dc671d2e-0681-413b-837c-85c96dd6c806",
]


class Command(BaseCommand):
    help = "Audita tokens de boletos contra DB y Stripe API; diagnostica colisiones y reconcilia boletos huérfanos."

    def add_arguments(self, parser):
        parser.add_argument(
            "identifiers",
            nargs="*",
            type=str,
            default=DEFAULT_TARGET_TOKENS,
            help="Uno o más UUIDs de tokens, IDs de boleto o Stripe Session IDs (por defecto los 2 tokens críticos).",
        )
        parser.add_argument(
            "--fix",
            action="store_true",
            help="Aplica reconciliación segura: confirma pagados en Stripe o libera asientos de reservas vencidas/expiradas.",
        )
        parser.add_argument(
            "--cancel",
            action="store_true",
            help="Fuerza la cancelación del boleto y libera la butaca asociada.",
        )
        parser.add_argument(
            "--release-seat",
            action="store_true",
            help="Al cancelar, desvincula explícitamente el seat_id (seat=None) para eliminar colisiones unique_together.",
        )

    def handle(self, *args, **options):
        identifiers = options["identifiers"] or DEFAULT_TARGET_TOKENS
        apply_fix = options["fix"]
        force_cancel = options["cancel"]
        release_seat = options["release_seat"] or force_cancel or apply_fix

        self.stdout.write("=" * 80)
        self.stdout.write(self.style.MIGRATE_HEADING("  MS AMBAR — TICKET & STRIPE AUDIT ENGINE"))
        self.stdout.write("=" * 80)
        self.stdout.write(f"Modo: {'[FIX ACTIVADO]' if apply_fix else '[SOLO LECTURA / INSPECCIÓN]'}")
        if force_cancel:
            self.stdout.write(self.style.WARNING("Modo forzado: [--cancel] activo para los identificadores dados."))
        self.stdout.write("-" * 80)

        # Configurar Stripe SDK
        stripe_key = getattr(settings, "STRIPE_SECRET_KEY", "")
        stripe_available = False
        if stripe_key and not any(p in stripe_key for p in ["placeholder", "change_me", "your_"]):
            stripe.api_key = stripe_key
            stripe_available = True
        else:
            self.stdout.write(self.style.WARNING("⚠️ Stripe API Key no configurada o mock. Consultas directas a Stripe limitadas."))

        for ident in identifiers:
            ident_clean = str(ident).strip()
            if not ident_clean:
                continue

            self._audit_single_identifier(ident_clean, stripe_available, apply_fix, force_cancel, release_seat)
            self.stdout.write("-" * 80)

    def _audit_single_identifier(self, identifier: str, stripe_available: bool, apply_fix: bool, force_cancel: bool, release_seat: bool):
        self.stdout.write(f"\n🔍 Auditando identificador: {self.style.WARNING(identifier)}")

        # 1. Búsqueda en Base de Datos (Token UUID -> ID -> Stripe Session ID)
        ticket = None
        # Intento A: UUID token
        try:
            val_uuid = uuid.UUID(identifier)
            ticket = (
                Ticket.objects.select_related("event", "event__theater", "seat", "ga_zone")
                .filter(token=val_uuid)
                .first()
            )
        except ValueError:
            pass

        # Intento B: ID numérico de boleto
        if not ticket and identifier.isdigit():
            ticket = (
                Ticket.objects.select_related("event", "event__theater", "seat", "ga_zone")
                .filter(pk=int(identifier))
                .first()
            )

        # Intento C: Stripe Session ID o Payment Intent
        if not ticket:
            ticket = (
                Ticket.objects.select_related("event", "event__theater", "seat", "ga_zone")
                .filter(stripe_session_id=identifier)
                .first()
            )

        if not ticket:
            self.stdout.write(self.style.ERROR(f"❌ [DB] No se encontró ningún Ticket en la base de datos para: '{identifier}'"))
            if stripe_available and (identifier.startswith("cs_") or identifier.startswith("pi_")):
                self.stdout.write("   Intentando inspección directa en Stripe API...")
                self._inspect_stripe_orphan(identifier)
            return

        # 2. Imprimir Metadatos del Boleto en Base de Datos
        seat_desc = "Sin Asiento (GA/Meet&Greet)"
        seat_id = "None"
        if ticket.seat:
            seat_id = str(ticket.seat.id)
            seat_desc = f"ID: {ticket.seat.id} | {ticket.seat.row}{ticket.seat.number} (Sec: {ticket.seat.section})"
        elif ticket.ga_zone:
            seat_desc = f"GA Zone: {ticket.ga_zone.name}"

        status_style = self.style.SUCCESS if ticket.status == "paid" else (
            self.style.WARNING if ticket.status == "reserved" else self.style.ERROR
        )

        self.stdout.write(f"  • Ticket ID:          {ticket.id}")
        self.stdout.write(f"  • Token UUID:         {ticket.token}")
        self.stdout.write(f"  • Evento:             #{ticket.event_id} - {ticket.event.title}")
        self.stdout.write(f"  • Asiento:            {seat_desc}")
        self.stdout.write(f"  • Usuario Email:      {ticket.user_email}")
        self.stdout.write(f"  • Usuario Teléfono:   {ticket.user_phone or 'N/A'}")
        self.stdout.write(f"  • Estado DB:          {status_style(ticket.status.upper())}")
        self.stdout.write(f"  • Check-in / Scanned: {'SI (' + str(ticket.scanned_at) + ')' if ticket.is_scanned else 'NO'}")
        self.stdout.write(f"  • Stripe Session ID:  {ticket.stripe_session_id or 'N/A'}")
        self.stdout.write(f"  • Monto Registrado:   ${ticket.amount_paid or 0.00} MXN")
        self.stdout.write(f"  • Creado:             {ticket.created_at.strftime('%Y-%m-%d %H:%M:%S %Z')}")
        self.stdout.write(f"  • Actualizado:        {ticket.updated_at.strftime('%Y-%m-%d %H:%M:%S %Z')}")

        # 3. Detección de Colisiones / Asiento Duplicado (unique_together: event + seat)
        if ticket.seat:
            colliding_tickets = (
                Ticket.objects.filter(event=ticket.event, seat=ticket.seat)
                .exclude(pk=ticket.pk)
            )
            collision_count = colliding_tickets.count()
            if collision_count > 0:
                self.stdout.write(self.style.ERROR(
                    f"⚠️  [ALERTA COLISIÓN] Existen {collision_count} otro(s) boleto(s) asignados al mismo Asiento #{ticket.seat.id} en Evento #{ticket.event_id}:"
                ))
                for c in colliding_tickets:
                    self.stdout.write(
                        f"     -> Ticket #{c.id} | UUID: {c.token} | Email: {c.user_email} | Estado: {c.status} | Session: {c.stripe_session_id}"
                    )

        # 4. Verificación en Stripe API
        stripe_session = None
        payment_intent_id = None
        stripe_payment_status = "UNKNOWN"
        stripe_session_status = "UNKNOWN"
        stripe_amount = None

        if stripe_available and ticket.stripe_session_id:
            try:
                sid = ticket.stripe_session_id.strip()
                if sid.startswith("cs_"):
                    stripe_session = stripe.checkout.Session.retrieve(sid, expand=["payment_intent"])
                    stripe_payment_status = getattr(stripe_session, "payment_status", "unknown")
                    stripe_session_status = getattr(stripe_session, "status", "unknown")
                    if stripe_session.payment_intent:
                        if isinstance(stripe_session.payment_intent, str):
                            payment_intent_id = stripe_session.payment_intent
                        else:
                            payment_intent_id = getattr(stripe_session.payment_intent, "id", None)
                    if getattr(stripe_session, "amount_total", None) is not None:
                        stripe_amount = Decimal(stripe_session.amount_total) / Decimal(100)
                elif sid.startswith("pi_"):
                    pi = stripe.PaymentIntent.retrieve(sid)
                    payment_intent_id = pi.id
                    stripe_payment_status = "paid" if pi.status == "succeeded" else pi.status
                    stripe_session_status = pi.status
                    if getattr(pi, "amount", None) is not None:
                        stripe_amount = Decimal(pi.amount) / Decimal(100)
                else:
                    self.stdout.write(self.style.NOTICE(f"  • Stripe ID no estándar (posible mock): {sid}"))
            except stripe.error.InvalidRequestError as e:
                self.stdout.write(self.style.WARNING(f"  • Stripe API: Sesión no encontrada ({e.user_message or str(e)})"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  • Stripe API Error: {str(e)}"))

        self.stdout.write(f"  • Payment Intent ID:  {payment_intent_id or 'N/A'}")
        self.stdout.write(f"  • Stripe Status:      {stripe_session_status} (payment_status: {stripe_payment_status})")
        if stripe_amount is not None:
            self.stdout.write(f"  • Stripe Total:       ${stripe_amount} MXN")

        # 5. Ejecución de Acciones: Forzar Cancelación o Reconciliación (--fix)
        if force_cancel:
            self._execute_cancellation(ticket, release_seat=release_seat)
            return

        if apply_fix:
            self._execute_reconciliation(ticket, stripe_payment_status, stripe_session_status, stripe_amount, release_seat=release_seat)

    def _execute_cancellation(self, ticket: Ticket, release_seat: bool):
        self.stdout.write(self.style.MIGRATE_LABEL(f"  [ACCION] Forzando cancelación de Ticket #{ticket.id}..."))
        old_seat = ticket.seat
        ticket.status = "cancelled"
        update_fields = ["status"]
        if release_seat and ticket.seat:
            ticket.seat = None
            update_fields.append("seat")

        ticket.save(update_fields=update_fields)
        self.stdout.write(self.style.SUCCESS(
            f"  ✅ Ticket #{ticket.id} ({ticket.token}) marcado como CANCELLED."
            + (f" Butaca #{old_seat.id} ({old_seat.row}{old_seat.number}) LIBERADA de la restricción única." if old_seat and release_seat else "")
        ))

    def _execute_reconciliation(self, ticket: Ticket, payment_status: str, session_status: str, stripe_amount, release_seat: bool):
        self.stdout.write(self.style.MIGRATE_LABEL(f"  [ACCION --fix] Evaluando reconciliación para Ticket #{ticket.id}..."))

        # Caso 1: Pagado en Stripe pero marcado como reserved o cancelled en DB
        if payment_status == "paid" or session_status in ["complete", "succeeded"]:
            if ticket.status != "paid":
                ticket.status = "paid"
                if ticket.amount_paid is None or ticket.amount_paid == 0:
                    ticket.amount_paid = stripe_amount or get_ticket_actual_price(ticket)
                ticket.save(update_fields=["status", "amount_paid"])
                self.stdout.write(self.style.SUCCESS(
                    f"  ✅ Reconciliado a PAID: Ticket #{ticket.id} actualizado con monto ${ticket.amount_paid} MXN."
                ))
                # Enviar correo si no ha sido entregado
                try:
                    send_ticket_email(ticket)
                    self.stdout.write(self.style.SUCCESS(f"  ✉️ Correo de confirmación con código QR despachado a {ticket.user_email}"))
                except Exception as exc:
                    self.stdout.write(self.style.WARNING(f"  ⚠️ Error enviando correo automático: {exc}"))
            else:
                if ticket.amount_paid is None:
                    ticket.amount_paid = stripe_amount or get_ticket_actual_price(ticket)
                    ticket.save(update_fields=["amount_paid"])
                    self.stdout.write(self.style.SUCCESS(f"  ✅ Monto ${ticket.amount_paid} MXN guardado en boleto ya pagado."))
                else:
                    self.stdout.write(self.style.SUCCESS("  ✓ El boleto ya se encuentra en estado consistente PAID."))

        # Caso 2: Sesión Stripe expirada o fallida, y el boleto está retenido como 'reserved'
        elif session_status in ["expired", "canceled", "failed"] or payment_status == "unpaid":
            if ticket.status == "reserved":
                old_seat = ticket.seat
                ticket.status = "cancelled"
                update_fields = ["status"]
                if release_seat and ticket.seat:
                    ticket.seat = None
                    update_fields.append("seat")
                ticket.save(update_fields=update_fields)
                self.stdout.write(self.style.WARNING(
                    f"  ⚠️ Sesión Stripe expirada/fallida. Ticket #{ticket.id} cancelado y asiento liberado."
                ))
            else:
                self.stdout.write(f"  • Boleto en estado {ticket.status}, no requiere cambios.")
        else:
            self.stdout.write(f"  • Estado en Stripe no concluyente ('{session_status}' / '{payment_status}'). Sin cambios.")

    def _inspect_stripe_orphan(self, session_id: str):
        try:
            if session_id.startswith("cs_"):
                s = stripe.checkout.Session.retrieve(session_id)
                self.stdout.write(f"  [Stripe Direct] Status: {s.status} | Payment: {s.payment_status} | Customer Email: {s.customer_details.email if s.customer_details else 'N/A'}")
                meta = s.metadata or {}
                self.stdout.write(f"  [Stripe Metadata] EventID: {meta.get('event_id')} | Seats: {meta.get('seat_ids')} | Email: {meta.get('user_email')}")
            elif session_id.startswith("pi_"):
                p = stripe.PaymentIntent.retrieve(session_id)
                self.stdout.write(f"  [Stripe Direct] PI Status: {p.status} | Amount: ${Decimal(p.amount)/100} {p.currency.upper()}")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  Falla inspeccionando Stripe directamente: {e}"))
