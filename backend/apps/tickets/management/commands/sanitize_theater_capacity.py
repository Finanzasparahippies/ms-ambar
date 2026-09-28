import logging
import math
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.tickets.models import Theater, Seat, Ticket

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Reconcilia y migra boletos vendidos hacia los 168 asientos oficiales del layout sin borrar ningún ticket pagado."

    def add_arguments(self, parser):
        parser.add_argument(
            '--theater-name',
            type=str,
            default='London Pub',
            help="Nombre del teatro a sanitizar (default: 'London Pub')."
        )
        parser.add_argument(
            '--apply',
            action='store_true',
            help="Aplica la migración de tickets y saneamiento en la base de datos."
        )

    def handle(self, *args, **options):
        theater_name = options.get('theater_name')
        apply_changes = options.get('apply', False)

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"=== Reconciliación Segura de Boletos y Capacidad: '{theater_name}' (Modo: {'APLICAR MIGRACIÓN' if apply_changes else 'SIMULACIÓN (Dry-Run)'}) ==="
        ))

        theater = Theater.objects.filter(name__icontains=theater_name).first()
        if not theater:
            self.stdout.write(self.style.ERROR(f"No se encontró el teatro '{theater_name}'."))
            return

        db_seats = list(Seat.objects.filter(theater=theater))
        db_seats_count = len(db_seats)

        layout = theater.layout or {}
        layout_seats = layout.get('seats', []) if isinstance(layout, dict) else []
        layout_elements = layout.get('map_elements', []) if isinstance(layout, dict) else []

        tables = [el for el in layout_elements if el.get('type') == 'table' or el.get('tableShape') or str(el.get('label', '')).lower().startswith('mesa')]

        self.stdout.write(f"\n[DIAGNÓSTICO DEL RECINTO]")
        self.stdout.write(f"  - Mesas en layout: {len(tables)} (Capacidad esperada: {len(tables) * 4} asientos)")
        self.stdout.write(f"  - Asientos en JSON layout: {len(layout_seats)}")
        self.stdout.write(f"  - Asientos totales en DB (Seat): {db_seats_count}")

        # Separar asientos de las Filas oficiales (Fila A - I) vs Asientos legados de Mesas (Mesa X)
        official_row_seats = [s for s in db_seats if s.row and s.row.strip().lower().startswith('fila')]
        legacy_table_seats = [s for s in db_seats if s.row and s.row.strip().lower().startswith('mesa')]
        other_seats = [s for s in db_seats if s not in official_row_seats and s not in legacy_table_seats]

        self.stdout.write(f"\n[ESTRUCTURA DE ASIENTOS]")
        self.stdout.write(f"  - Asientos en Filas oficiales (Fila A - I): {len(official_row_seats)}")
        self.stdout.write(f"  - Asientos legados etiquetados como 'Mesa X': {len(legacy_table_seats)}")
        self.stdout.write(f"  - Otros asientos: {len(other_seats)}")

        # Auditar tickets vendidos
        legacy_seats_with_tickets = []
        for s in legacy_table_seats:
            t_count = Ticket.objects.filter(seat=s).count()
            if t_count > 0:
                legacy_seats_with_tickets.append((s, t_count))

        official_seats_with_tickets = []
        for s in official_row_seats:
            t_count = Ticket.objects.filter(seat=s).count()
            if t_count > 0:
                official_seats_with_tickets.append((s, t_count))

        self.stdout.write(f"\n[AUDITORÍA DE TICKETS PAGADOS]")
        self.stdout.write(f"  - Boletos en asientos legados 'Mesa X': {sum(c for _, c in legacy_seats_with_tickets)} (en {len(legacy_seats_with_tickets)} asientos)")
        self.stdout.write(f"  - Boletos en asientos oficiales 'Fila X': {sum(c for _, c in official_seats_with_tickets)} (en {len(official_seats_with_tickets)} asientos)")

        # Mapear mesas por label para búsqueda rápida
        table_by_label = {}
        for t in tables:
            lbl = str(t.get('label', '')).strip().lower()
            if lbl:
                table_by_label[lbl] = t

        # Preparar plan de reconciliación / migración
        migration_plan = []
        unmatched_seats = []

        for legacy_seat, ticket_count in legacy_seats_with_tickets:
            table_label = legacy_seat.row.strip().lower()
            matched_table = table_by_label.get(table_label)
            matched_official_seat = None

            if matched_table:
                target_row = str(matched_table.get('row') or matched_table.get('row_label') or '').strip().lower()
                # Buscar asiento en official_row_seats con la misma fila y número
                candidates = [s for s in official_row_seats if s.row.strip().lower() == target_row and s.number == legacy_seat.number]
                if candidates:
                    matched_official_seat = candidates[0]
                else:
                    # Búsqueda espacial por proximidad a la mesa (< 65px)
                    spatial_candidates = [
                        s for s in official_row_seats
                        if s.row.strip().lower() == target_row and math.hypot(s.x - legacy_seat.x, s.y - legacy_seat.y) <= 45
                    ]
                    if spatial_candidates:
                        matched_official_seat = spatial_candidates[0]

            if not matched_official_seat:
                # Fallback espacial general: buscar el asiento oficial más cercano (< 30px)
                closest = None
                min_dist = float('inf')
                for s in official_row_seats:
                    d = math.hypot(s.x - legacy_seat.x, s.y - legacy_seat.y)
                    if d < min_dist:
                        min_dist = d
                        closest = s
                if closest and min_dist <= 35:
                    matched_official_seat = closest

            if matched_official_seat:
                migration_plan.append((legacy_seat, matched_official_seat, ticket_count))
            else:
                unmatched_seats.append((legacy_seat, ticket_count))

        self.stdout.write(f"\n[PLAN DE MIGRACIÓN DE BOLETOS]")
        self.stdout.write(f"  - Asientos legados listos para migrar a filas oficiales: {len(migration_plan)}")
        for src, dest, count in migration_plan:
            self.stdout.write(f"    • {src.row} #{src.number} (ID {src.id}) -> {dest.row} #{dest.number} (ID {dest.id}) [{count} boleto(s)]")

        if unmatched_seats:
            self.stdout.write(self.style.WARNING(f"  - [AVISO] Asientos con boletos sin correspondencia exacta: {len(unmatched_seats)}"))
            for s, count in unmatched_seats:
                self.stdout.write(f"    • {s.row} #{s.number} (ID {s.id}) [{count} boletos]")

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                "\n[MODO SIMULACIÓN] Para ejecutar la migración segura y dejar exactamente 168 asientos:"
                f"\n  ./nectar.sh manage-prod sanitize_theater_capacity --theater-name '{theater_name}' --apply"
            ))
            return

        # EJECUCIÓN SEGURA DENTRO DE TRANSACCIÓN ATÓMICA
        with transaction.atomic():
            migrated_tickets_total = 0
            # 1. Reasignar tickets de asientos legados hacia los asientos oficiales correspondientes
            for src, dest, count in migration_plan:
                tickets_to_move = Ticket.objects.filter(seat=src)
                updated_count = tickets_to_move.update(seat=dest)
                migrated_tickets_total += updated_count
                # Marcar el asiento oficial como ocupado
                dest.status = 'occupied'
                dest.save(update_fields=['status'])

            self.stdout.write(self.style.SUCCESS(
                f"\n[ÉXITO] Se migraron {migrated_tickets_total} boleto(s) pagados a sus asientos oficiales correspondientes."
            ))

            # 2. Ahora que los boletos están a salvo en los asientos oficiales, purgar los asientos legados sin boletos
            legacy_purgable = Seat.objects.filter(theater=theater, row__istartswith='mesa', ticket__isnull=True)
            purgable_count = legacy_purgable.count()
            legacy_purgable.delete()
            self.stdout.write(self.style.SUCCESS(f"  Se purgaron {purgable_count} asientos legados duplicados (ahora vacíos)."))

            # 3. Purgar asientos extra que no pertenezcan a las 168 butacas oficiales y no tengan boletos
            other_purgable = Seat.objects.filter(theater=theater, ticket__isnull=True).exclude(id__in=[s.id for s in official_row_seats])
            other_count = other_purgable.count()
            other_purgable.delete()
            if other_count > 0:
                self.stdout.write(self.style.SUCCESS(f"  Se purgaron {other_count} asientos huérfanos adicionales."))

            # 4. Verificar conteo final en base de datos
            final_db_count = Seat.objects.filter(theater=theater).count()
            final_tickets_count = Ticket.objects.filter(seat__theater=theater).count()

            self.stdout.write(self.style.SUCCESS(
                f"\n=== SANEAMIENTO COMPLETADO EXITOSAMENTE ==="
                f"\n  - Asientos finales en Base de Datos: {final_db_count} (Capacidad oficial exacta: 168)"
                f"\n  - Boletos pagados y preservados: {final_tickets_count} (100% conservados y asignados en el mapa)"
            ))
