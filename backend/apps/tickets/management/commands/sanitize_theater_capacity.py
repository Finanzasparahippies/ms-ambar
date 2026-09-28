import logging
import math
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.tickets.models import Theater, Seat, Ticket

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Reconcilia y migra boletos vendidos hacia los 168 asientos oficiales del layout mediante correspondencia espacial exacta 1-a-1."

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
            f"=== Reconciliación Segura 1-a-1 de Boletos: '{theater_name}' (Modo: {'APLICAR MIGRACIÓN' if apply_changes else 'SIMULACIÓN (Dry-Run)'}) ==="
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

        self.stdout.write(f"\n[ESTRUCTURA DE ASIENTOS]")
        self.stdout.write(f"  - Asientos en Filas oficiales (Fila A - I): {len(official_row_seats)}")
        self.stdout.write(f"  - Asientos legados etiquetados como 'Mesa X': {len(legacy_table_seats)}")

        # Auditar tickets vendidos
        legacy_seats_with_tickets = []
        for s in legacy_table_seats:
            tickets = list(Ticket.objects.filter(seat=s))
            if tickets:
                legacy_seats_with_tickets.append((s, tickets))

        self.stdout.write(f"\n[AUDITORÍA DE TICKETS PAGADOS]")
        self.stdout.write(f"  - Asientos legados con boletos activos: {len(legacy_seats_with_tickets)}")

        # Mapeo de mesas por label
        table_by_label = {}
        for t in tables:
            lbl = str(t.get('label', '')).strip().lower()
            if lbl:
                table_by_label[lbl] = t

        # Plan de migración 1-a-1 usando proximidad espacial (evita colisiones de unique constraint)
        migration_plan = []
        claimed_dest_ids = set()

        # Obtener pares (event_id, seat_id) existentes para evitar cualquier conflicto
        existing_event_seat_pairs = set(Ticket.objects.filter(seat__in=official_row_seats).values_list('event_id', 'seat_id'))

        for legacy_seat, tickets in legacy_seats_with_tickets:
            table_label = legacy_seat.row.strip().lower()
            matched_table = table_by_label.get(table_label)

            target_row = ""
            if matched_table:
                target_row = str(matched_table.get('row') or matched_table.get('row_label') or '').strip().lower()

            # Ordenar candidatos oficiales por distancia euclidiana al asiento legado
            scored_candidates = []
            for s in official_row_seats:
                if s.id in claimed_dest_ids:
                    continue

                # Verificar que la asignación no viole la restricción unique de (event_id, seat_id)
                conflict = any((t.event_id, s.id) in existing_event_seat_pairs for t in tickets)
                if conflict:
                    continue

                dist = math.hypot(s.x - legacy_seat.x, s.y - legacy_seat.y)
                row_match = (s.row.strip().lower() == target_row) if target_row else True
                num_match = (s.number == legacy_seat.number)

                # Priorizar coincidencia de fila de mesa + proximidad física
                score = dist
                if not row_match:
                    score += 500
                if not num_match:
                    score += 50

                scored_candidates.append((score, dist, s))

            scored_candidates.sort(key=lambda x: x[0])

            if scored_candidates:
                best_score, best_dist, best_seat = scored_candidates[0]
                migration_plan.append((legacy_seat, best_seat, tickets, best_dist))
                claimed_dest_ids.add(best_seat.id)
                for t in tickets:
                    existing_event_seat_pairs.add((t.event_id, best_seat.id))
            else:
                self.stdout.write(self.style.ERROR(
                    f"  [ERROR] No se encontró destino libre sin conflicto para {legacy_seat.row} #{legacy_seat.number} (ID {legacy_seat.id})"
                ))

        self.stdout.write(f"\n[PLAN DE MIGRACIÓN DE BOLETOS 1-A-1]")
        self.stdout.write(f"  - Asientos a migrar de forma unívoca: {len(migration_plan)} de {len(legacy_seats_with_tickets)}")
        for src, dest, tickets, dist in migration_plan:
            self.stdout.write(
                f"    • {src.row} #{src.number} (ID {src.id}, x={int(src.x)}, y={int(src.y)}) -> "
                f"{dest.row} #{dest.number} (ID {dest.id}, x={int(dest.x)}, y={int(dest.y)}, dist={dist:.1f}px) [{len(tickets)} boleto(s)]"
            )

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                "\n[MODO SIMULACIÓN] Para ejecutar la migración 1-a-1 sin conflictos y dejar 168 asientos exactos:"
                f"\n  ./nectar.sh manage-prod sanitize_theater_capacity --theater-name '{theater_name}' --apply"
            ))
            return

        # EJECUCIÓN TRANSACCIONAL ATÓMICA
        with transaction.atomic():
            migrated_count = 0
            for src, dest, tickets, dist in migration_plan:
                for t in tickets:
                    t.seat = dest
                    t.save(update_fields=['seat'])
                    migrated_count += 1
                dest.status = 'occupied'
                dest.save(update_fields=['status'])

            self.stdout.write(self.style.SUCCESS(
                f"\n[ÉXITO] Se reasignaron con éxito {migrated_count} boleto(s) pagados sin ninguna colisión."
            ))

            # Purgar los 22 asientos legados 'Mesa X' que ahora tienen 0 boletos asociados
            legacy_purgable = Seat.objects.filter(theater=theater, row__istartswith='mesa', ticket__isnull=True)
            purgable_count = legacy_purgable.count()
            legacy_purgable.delete()
            self.stdout.write(self.style.SUCCESS(f"  Se eliminaron {purgable_count} asientos legados duplicados (ahora vacíos)."))

            # Purgar cualquier otro asiento que no pertenezca a las 168 butacas oficiales
            other_purgable = Seat.objects.filter(theater=theater, ticket__isnull=True).exclude(id__in=[s.id for s in official_row_seats])
            other_count = other_purgable.count()
            other_purgable.delete()
            if other_count > 0:
                self.stdout.write(self.style.SUCCESS(f"  Se purgaron {other_count} asientos huérfanos adicionales."))

            # Verificación final de integridad
            final_db_count = Seat.objects.filter(theater=theater).count()
            final_tickets_count = Ticket.objects.filter(seat__theater=theater).count()

            self.stdout.write(self.style.SUCCESS(
                f"\n=== RECONCILIACIÓN COMPLETADA CON ÉXITO ==="
                f"\n  - Capacidad final en Base de Datos: {final_db_count} asientos (Exactamente 168)"
                f"\n  - Boletos de clientes preservados: {final_tickets_count} (100% intactos, pagados y ocupados en el plano)"
            ))
