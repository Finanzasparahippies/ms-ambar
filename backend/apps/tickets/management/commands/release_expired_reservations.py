import logging
from django.core.management.base import BaseCommand
from apps.tickets.services.reservation_engine import release_reservations

logger = logging.getLogger('apps.tickets')


class Command(BaseCommand):
    help = 'Libera reservaciones de asientos abandonadas o vencidas (> 15 minutos por defecto) y purga la caché Redis.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--timeout-minutes',
            type=int,
            default=15,
            help='Minutos transcurridos desde created_at para considerar la reservación abandonada (default: 15)'
        )
        parser.add_argument(
            '--force-all',
            action='store_true',
            help='Libera todas las reservaciones en estado reserved sin importar el tiempo transcurrido'
        )

    def handle(self, *args, **options):
        timeout = 0 if options['force_all'] else options['timeout_minutes']
        self.stdout.write(self.style.NOTICE(
            f"Iniciando purga y liberación de reservaciones (timeout: {timeout} min)..."
        ))

        result = release_reservations(
            release_all_expired=True,
            timeout_minutes=timeout,
            admin_user=None
        )

        count = result.get('released_count', 0)
        events = result.get('affected_events', [])

        if count > 0:
            self.stdout.write(self.style.SUCCESS(
                f"✅ Se liberaron {count} asiento(s) reservados en {len(events)} evento(s). Caché Redis purgada."
            ))
            for item in result.get('released_tickets', []):
                self.stdout.write(
                    f"   - Boleto #{item['id']} ({item['email']}) -> {item['seat_label']} [Stripe: {item['stripe_session_id']}]"
                )
        else:
            self.stdout.write(self.style.SUCCESS("✨ No hay reservaciones pendientes por liberar."))
