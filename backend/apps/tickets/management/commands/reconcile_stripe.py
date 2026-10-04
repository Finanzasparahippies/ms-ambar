import logging
from datetime import timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone
import stripe

from apps.tickets.models import Ticket
from apps.tickets.utils import send_ticket_email
from apps.shop.models import Order
from apps.dashboard.views import get_ticket_actual_price

logger = logging.getLogger('apps.tickets')


class Command(BaseCommand):
    help = 'Reconcilia los estados y montos de boletos y órdenes con Stripe API para garantizar precisión financiera y resolver reservas varadas.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Modo simulación: no aplica modificaciones en base de datos.',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        self.stdout.write("=" * 75)
        self.stdout.write(self.style.MIGRATE_HEADING("  MS AMBAR — STRIPE RECONCILIATION ENGINE (PROD)"))
        self.stdout.write("=" * 75)
        if dry_run:
            self.stdout.write(self.style.WARNING("Modo --dry-run activado: no se escribirán cambios en la base de datos."))

        stripe_key = getattr(settings, 'STRIPE_SECRET_KEY', '')
        if stripe_key and not any(p in stripe_key for p in ['placeholder', 'change_me', 'your_']):
            stripe.api_key = stripe_key
            stripe_available = True
        else:
            stripe_available = False
            self.stdout.write(self.style.WARNING("⚠️ Modo offline/mock: Stripe API key no configurada."))

        # 1. Reconciliación de boletos 'reserved' varados o abandonados (> 15 min)
        expiration_cutoff = timezone.now() - timedelta(minutes=15)
        stale_tickets = Ticket.objects.filter(status='reserved', created_at__lt=expiration_cutoff)
        stale_count = stale_tickets.count()
        self.stdout.write(f"\n1. Inspeccionando {stale_count} boletos en estado 'reserved' (> 15 min)...")

        recovered_paid = 0
        cancelled_stale = 0

        for t in stale_tickets:
            if t.stripe_session_id and stripe_available:
                try:
                    sid = t.stripe_session_id.strip()
                    is_paid = False
                    amount_total = None

                    if sid.startswith('cs_'):
                        session = stripe.checkout.Session.retrieve(sid)
                        if session.payment_status == 'paid' or session.status == 'complete':
                            is_paid = True
                            if session.amount_total is not None:
                                amount_total = Decimal(session.amount_total) / Decimal(100)
                    elif sid.startswith('pi_'):
                        pi = stripe.PaymentIntent.retrieve(sid)
                        if pi.status == 'succeeded':
                            is_paid = True
                            if pi.amount is not None:
                                amount_total = Decimal(pi.amount) / Decimal(100)

                    if is_paid:
                        if not dry_run:
                            t.status = 'paid'
                            t.amount_paid = amount_total or get_ticket_actual_price(t)
                            t.save(update_fields=['status', 'amount_paid'])
                            try:
                                send_ticket_email(t)
                            except Exception as email_err:
                                logger.warning(f"Error enviando correo de boleto recuperado #{t.id}: {email_err}")
                        recovered_paid += 1
                        self.stdout.write(self.style.SUCCESS(
                            f"   ✅ [RECUPERADO] Ticket #{t.id} ({t.user_email}) pagado en Stripe ({sid}). Transicionado a PAID."
                        ))
                        continue
                except Exception as exc:
                    logger.warning(f"Error verificando Stripe Session {t.stripe_session_id} para ticket #{t.id}: {exc}")

            # Si no fue pagado en Stripe o no tiene sesión, cancelar y liberar asiento
            if not dry_run:
                old_seat = t.seat
                t.status = 'cancelled'
                t.seat = None
                t.save(update_fields=['status', 'seat'])
            cancelled_stale += 1

        self.stdout.write(self.style.SUCCESS(
            f"   ✓ Proceso completado: {recovered_paid} recuperados a PAID, {cancelled_stale} cancelados y asientos liberados."
        ))

        # 2. Reconciliación de boletos 'paid' sin amount_paid
        self.stdout.write("\n2. Verificando montos en boletos pagados...")
        paid_tickets_without_amount = Ticket.objects.filter(status='paid', amount_paid__isnull=True)
        updated_amount_count = 0
        for t in paid_tickets_without_amount:
            if not dry_run:
                t.amount_paid = get_ticket_actual_price(t)
                t.save(update_fields=['amount_paid'])
            updated_amount_count += 1
        self.stdout.write(self.style.SUCCESS(f"   ✓ {updated_amount_count} boletos pagados regularizados con amount_paid."))

        # 3. Verificación de boletos 'paid' contra Stripe API
        if stripe_available:
            self.stdout.write("\n3. Verificando consistencia de boletos pagados contra Stripe API...")
            checked_count = 0
            cancelled_count = 0

            active_tickets = Ticket.objects.filter(status='paid').exclude(stripe_session_id__isnull=True).exclude(stripe_session_id='')
            for ticket in active_tickets:
                checked_count += 1
                try:
                    sid = ticket.stripe_session_id.strip()
                    if sid.startswith('cs_'):
                        session = stripe.checkout.Session.retrieve(sid)
                        if session.payment_status not in ['paid', 'no_payment_required'] and session.status == 'expired':
                            if not dry_run:
                                ticket.status = 'cancelled'
                                ticket.seat = None
                                ticket.save(update_fields=['status', 'seat'])
                            cancelled_count += 1
                            self.stdout.write(self.style.WARNING(
                                f"   ⚠️ Ticket #{ticket.id} cancelado: Stripe Session {sid} expirada/no pagada ('{session.payment_status}')"
                            ))
                except stripe.error.InvalidRequestError as e:
                    logger.warning(f"Stripe Session ID no encontrado para boleto #{ticket.id}: {ticket.stripe_session_id} - {e}")
                except Exception as e:
                    logger.warning(f"Error verificando Stripe Session {ticket.stripe_session_id}: {e}")

            self.stdout.write(self.style.SUCCESS(
                f"   ✓ Verificación Stripe completada: {checked_count} analizados, {cancelled_count} rechazados marcados como cancelled."
            ))

        self.stdout.write(self.style.SUCCESS("\n🎉 Reconciliación con Stripe finalizada exitosamente."))
