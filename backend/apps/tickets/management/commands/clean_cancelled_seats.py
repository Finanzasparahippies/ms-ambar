import logging
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.tickets.models import Ticket

logger = logging.getLogger('apps.tickets')


class Command(BaseCommand):
    help = (
        "Desvincula (seat = None) de forma atómica todas las butacas en boletos cancelados "
        "para evitar colisiones de unicidad (unique_together = ('event', 'seat')) en recompra."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Muestra los boletos cancelados que tienen asiento vinculado sin modificar la base de datos.'
        )
        parser.add_argument(
            '--event-id',
            type=int,
            default=None,
            help='Filtra la limpieza a un ID de evento específico.'
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        event_id = options.get('event_id')

        qs = Ticket.objects.filter(status='cancelled').exclude(seat=None).select_related('event', 'seat')
        if event_id:
            qs = qs.filter(event_id=event_id)

        total_stale = qs.count()

        if total_stale == 0:
            self.stdout.write(self.style.SUCCESS(
                "✅ Base de datos limpia: No se encontraron boletos cancelados con asientos vinculados."
            ))
            return

        self.stdout.write(self.style.WARNING(
            f"🔍 Se encontraron {total_stale} boleto(s) cancelados con butacas aún vinculadas:"
        ))

        for t in qs[:50]:
            seat_desc = f"{t.seat.row}{t.seat.number} (ID: {t.seat.id}, Sec: {t.seat.section})" if t.seat else "N/A"
            self.stdout.write(
                f"   • Ticket #{t.id} | UUID: {t.token} | Email: {t.user_email} | Evento #{t.event_id} | Asiento: {seat_desc}"
            )

        if total_stale > 50:
            self.stdout.write(f"   ... y {total_stale - 50} más.")

        if dry_run:
            self.stdout.write(self.style.NOTICE(
                f"\n[DRY RUN] Operación simulada. Ejecute sin --dry-run para desvincular los {total_stale} asientos."
            ))
            return

        with transaction.atomic():
            ticket_ids = list(qs.values_list('id', flat=True))
            updated_count = Ticket.objects.filter(id__in=ticket_ids).update(seat=None)

            logger.info(
                f"[CLI/CLEAN_CANCELLED_SEATS] Desvinculados {updated_count} asientos en boletos cancelados. "
                f"IDs afectados: {ticket_ids}"
            )

        self.stdout.write(self.style.SUCCESS(
            f"\n✅ Operación completada con éxito: Se desvincularon {updated_count} asientos de boletos cancelados."
        ))
