import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import stripe

from apps.tickets.models import Ticket
from apps.shop.models import Order
from apps.dashboard.views import get_ticket_actual_price

logger = logging.getLogger('apps.tickets')

class Command(BaseCommand):
    help = 'Reconcilia los estados y montos de boletos y órdenes con Stripe API para garantizar precisión financiera en el Dashboard.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Iniciando reconciliación financiera con Stripe..."))
        
        stripe_key = getattr(settings, 'STRIPE_SECRET_KEY', '')
        if stripe_key and not any(p in stripe_key for p in ['placeholder', 'change_me', 'your_']):
            stripe.api_key = stripe_key
            stripe_available = True
        else:
            stripe_available = False
            self.stdout.write(self.style.WARNING("Modo offline/mock: Stripe API key no configurada."))

        # 1. Limpieza de boletos reservados abandonados o vencidos (> 30 min)
        expiration_cutoff = timezone.now() - timedelta(minutes=30)
        stale_tickets = Ticket.objects.filter(status='reserved', created_at__lt=expiration_cutoff)
        stale_count = stale_tickets.count()
        stale_tickets.update(status='cancelled')
        self.stdout.write(self.style.SUCCESS(f"✅ Se cancelaron {stale_count} boletos reservados abandonados/vencidos."))

        # 2. Reconciliación de boletos 'paid' sin amount_paid
        paid_tickets_without_amount = Ticket.objects.filter(status='paid', amount_paid__isnull=True)
        updated_amount_count = 0
        for t in paid_tickets_without_amount:
            t.amount_paid = get_ticket_actual_price(t)
            t.save(update_fields=['amount_paid'])
            updated_amount_count += 1
        self.stdout.write(self.style.SUCCESS(f"✅ Se actualizaron los montos inmutables en {updated_amount_count} boletos pagados."))

        # 3. Verificación directa contra Stripe API para boletos y órdenes con Stripe Session ID
        if stripe_available:
            checked_count = 0
            cancelled_count = 0
            
            active_tickets = Ticket.objects.filter(status='paid').exclude(stripe_session_id__isnull=True).exclude(stripe_session_id='')
            for ticket in active_tickets:
                checked_count += 1
                try:
                    session = stripe.checkout.Session.retrieve(ticket.stripe_session_id)
                    if session.payment_status != 'paid':
                        ticket.status = 'cancelled'
                        ticket.save(update_fields=['status'])
                        cancelled_count += 1
                        self.stdout.write(self.style.WARNING(f"Boleto #{ticket.id} cancelado: Stripe Session {ticket.stripe_session_id} estado '{session.payment_status}'"))
                except stripe.error.InvalidRequestError as e:
                    logger.warning(f"Stripe Session ID inválido o no encontrado para boleto #{ticket.id}: {ticket.stripe_session_id} - {e}")
                except Exception as e:
                    logger.warning(f"Error verificando Stripe Session {ticket.stripe_session_id}: {e}")

            self.stdout.write(self.style.SUCCESS(f"✅ Verificación Stripe completada: {checked_count} analizados, {cancelled_count} boletos rechazados en Stripe fueron marcados como cancelled."))

        self.stdout.write(self.style.SUCCESS("🎉 Reconciliación completada con éxito."))
