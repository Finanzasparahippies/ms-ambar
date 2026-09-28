import logging
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.tickets.models import Event, Coupon, Theater, Seat
from apps.tickets.services.coupon_validator import build_spatial_virtual_rows

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Sanitiza y alinea complimentary_rows_priority en eventos y cupones con recintos tipo cabaret/mesas."

    def add_arguments(self, parser):
        parser.add_argument(
            '--event-id',
            type=int,
            help="ID del evento específico a sanitizar. Si se omite, analiza todos los eventos."
        )
        parser.add_argument(
            '--target-tables',
            type=str,
            help="Mesas explícitas separadas por coma (ej. 'Mesa 31,Mesa 32,Mesa 33,Mesa 34')."
        )
        parser.add_argument(
            '--virtual-tier',
            type=str,
            default='D',
            help="Fila virtual a mapear espacialmente en recintos cabaret (default: 'D')."
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help="Simular operaciones sin persistir modificaciones en base de datos."
        )

    def handle(self, *args, **options):
        event_id = options.get('event_id')
        target_tables_str = options.get('target_tables')
        virtual_tier = options.get('virtual_tier', 'D').strip().upper()
        dry_run = options.get('dry_run', False)

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"=== Saneamiento de Cortesías para Recintos de Mesas (DryRun={dry_run}) ==="
        ))

        events_qs = Event.objects.all().select_related('theater')
        if event_id:
            events_qs = events_qs.filter(id=event_id)

        if not events_qs.exists():
            self.stdout.write(self.style.WARNING("No se encontraron eventos para procesar."))
            return

        for event in events_qs:
            theater = event.theater
            if not theater:
                continue

            seats = list(Seat.objects.filter(theater=theater))
            if not seats:
                continue

            # Detectar si el recinto es tipo cabaret / mesas
            table_seats = [s for s in seats if (s.row and 'mesa' in s.row.lower()) or s.table_id]
            is_cabaret = len(table_seats) > (len(seats) * 0.4)

            self.stdout.write(
                f"\nAnalizando Evento [{event.id}] '{event.title}' | Teatro: '{theater.name}' "
                f"| Cabaret: {'SÍ' if is_cabaret else 'NO'} (Total asientos: {len(seats)}, Mesas: {len(table_seats)})"
            )

            # Determinar mesas objetivo
            resolved_tables = []
            if target_tables_str:
                resolved_tables = [t.strip() for t in target_tables_str.split(',') if t.strip()]
            elif is_cabaret:
                spatial_map = build_spatial_virtual_rows(seats)
                clean_tier = virtual_tier.replace("FILA", "").strip()
                tier_candidates = [virtual_tier, f"Fila {clean_tier}", clean_tier]

                for candidate in tier_candidates:
                    if candidate in spatial_map:
                        resolved_tables = spatial_map[candidate]
                        break

                if not resolved_tables and spatial_map:
                    # Fallback a la primera franja espacial disponible
                    first_band = next(iter(spatial_map.keys()))
                    resolved_tables = spatial_map[first_band]
                    self.stdout.write(self.style.WARNING(
                        f"  [AVISO] Fila virtual '{virtual_tier}' no hallada. Fallback espacial a '{first_band}': {resolved_tables}"
                    ))

            if not resolved_tables:
                self.stdout.write(f"  Sin mesas que sanitizar para este evento.")
                continue

            self.stdout.write(self.style.SUCCESS(
                f"  Mesas objetivo para cortesía: {resolved_tables}"
            ))

            with transaction.atomic():
                # 1. Actualizar Event si tiene prioridad tradicional
                curr_event_prio = event.complimentary_rows_priority or []
                if curr_event_prio != resolved_tables:
                    self.stdout.write(
                        f"  -> Event [{event.id}] complimentary_rows_priority: {curr_event_prio} -> {resolved_tables}"
                    )
                    if not dry_run:
                        event.complimentary_rows_priority = resolved_tables
                        event.save(update_fields=['complimentary_rows_priority'])

                # 2. Actualizar Cupones asociados al evento o globales
                coupons = Coupon.objects.filter(is_complimentary=True).filter(
                    event=event
                ) | Coupon.objects.filter(is_complimentary=True, event__isnull=True)

                for coupon in coupons:
                    curr_coupon_prio = coupon.complimentary_rows_priority or []
                    needs_update = False

                    # Si el cupón tiene letras convencionales (ej. ['D'] o ['Fila D']) o está desalineado
                    if any(p.strip().upper() in ['A', 'B', 'C', 'D', 'E', 'FILA D', 'FILA A', 'FILA B', 'FILA C'] for p in curr_coupon_prio):
                        needs_update = True
                    elif curr_coupon_prio != resolved_tables:
                        needs_update = True

                    if needs_update:
                        self.stdout.write(
                            f"  -> Cupón [{coupon.code}] priority: {curr_coupon_prio} -> {resolved_tables}"
                        )
                        if not dry_run:
                            coupon.complimentary_rows_priority = resolved_tables
                            coupon.save(update_fields=['complimentary_rows_priority'])

        self.stdout.write(self.style.SUCCESS("\n[OK] Saneamiento de prioridades de cortesía completado exitosamente."))
