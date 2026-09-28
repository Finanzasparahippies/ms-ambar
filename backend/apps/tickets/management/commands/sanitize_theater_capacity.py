import logging
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.tickets.models import Theater, Seat, Ticket

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Diagnostica y sanitiza la capacidad del teatro (ajustando a 168 asientos exactos: 42 mesas x 4 sillas)."

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
            help="Aplica los cambios en la base de datos (por defecto es simulación dry-run)."
        )
        parser.add_argument(
            '--force-tickets',
            action='store_true',
            help="Fuerza la reasignación o eliminación de tickets de prueba en asientos huérfanos."
        )

    def handle(self, *args, **options):
        theater_name = options.get('theater_name')
        apply_changes = options.get('apply', False)
        force_tickets = options.get('force_tickets', False)

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"=== Diagnóstico de Capacidad de Teatro: '{theater_name}' (Modo: {'APLICAR CAMBIOS' if apply_changes else 'SIMULACIÓN (Dry-Run)'}) ==="
        ))

        theater = Theater.objects.filter(name__icontains=theater_name).first()
        if not theater:
            self.stdout.write(self.style.ERROR(f"No se encontró el teatro '{theater_name}'."))
            return

        db_seats = Seat.objects.filter(theater=theater)
        db_seats_count = db_seats.count()

        layout = theater.layout or {}
        layout_seats = layout.get('seats', []) if isinstance(layout, dict) else []
        layout_elements = layout.get('map_elements', []) if isinstance(layout, dict) else []

        tables = [el for el in layout_elements if el.get('type') == 'table' or el.get('tableShape') or str(el.get('label', '')).lower().startswith('mesa')]

        self.stdout.write(f"\n[ESTADO ACTUAL]")
        self.stdout.write(f"  - Mesas en layout: {len(tables)} (Capacidad esperada: {len(tables) * 4} asientos)")
        self.stdout.write(f"  - Asientos en JSON layout: {len(layout_seats)}")
        self.stdout.write(f"  - Asientos en Base de Datos (Seat): {db_seats_count}")

        # Analizar asientos en DB
        seats_with_tickets = []
        seats_without_tickets = []
        for s in db_seats:
            tickets_count = Ticket.objects.filter(seat=s).count()
            if tickets_count > 0:
                seats_with_tickets.append((s, tickets_count))
            else:
                seats_without_tickets.append(s)

        self.stdout.write(f"  - Asientos con Tickets asociados: {len(seats_with_tickets)}")
        self.stdout.write(f"  - Asientos sin Tickets: {len(seats_without_tickets)}")

        # Desglose de filas en DB
        rows_breakdown = {}
        for s in db_seats:
            r = s.row or 'Sin Fila'
            rows_breakdown[r] = rows_breakdown.get(r, 0) + 1

        self.stdout.write(f"\n[DESGLOSE POR FILAS EN BASE DE DATOS]")
        for r, count in sorted(rows_breakdown.items()):
            self.stdout.write(f"  - {r}: {count} asientos")

        # Identificar asientos válidos (asociados a las 42 mesas del layout)
        valid_table_ids = {str(t.get('id')) for t in tables if t.get('id')}
        valid_table_labels = {str(t.get('label', '')).strip().lower() for t in tables if t.get('label')}

        # Verificar si layout_seats tiene exactamente 168 asientos
        target_seat_count = len(tables) * 4 if len(tables) > 0 else 168
        self.stdout.write(f"\n[ANÁLISIS DE EXCESO]")
        excess_count = db_seats_count - target_seat_count
        self.stdout.write(f"  - Asientos excedentes a purgar: {excess_count} (Esperados: {target_seat_count})")

        if excess_count <= 0 and len(layout_seats) == target_seat_count:
            self.stdout.write(self.style.SUCCESS(f"\n El teatro ya tiene exactamente {target_seat_count} asientos."))
            return

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                f"\n[MODO SIMULACIÓN] Para ejecutar el saneamiento y purgar los {excess_count} asientos huérfanos, ejecuta:"
                f"\n  python manage.py sanitize_theater_capacity --theater-name '{theater_name}' --apply"
            ))
            return

        # Aplicar saneamiento
        with transaction.atomic():
            # 1. Si layout_seats excede target_seat_count, filtrar para conservar solo los 168 pertenecientes a las mesas
            if len(layout_seats) > target_seat_count and len(tables) > 0:
                self.stdout.write(f"\n  Saneando layout['seats'] en JSON...")
                sanitized_layout_seats = []
                for s in layout_seats:
                    tid = str(s.get('tableId') or s.get('table_id') or '')
                    r = str(s.get('row') or '').strip().lower()
                    if (tid and tid in valid_table_ids) or (r and r in valid_table_labels):
                        sanitized_layout_seats.append(s)

                if len(sanitized_layout_seats) == target_seat_count:
                    theater.layout['seats'] = sanitized_layout_seats
                    theater.save(update_fields=['layout'])
                    self.stdout.write(self.style.SUCCESS(f"  Layout JSON ajustado a {len(sanitized_layout_seats)} asientos."))
                else:
                    self.stdout.write(self.style.NOTICE(f"  Layout JSON contiene {len(sanitized_layout_seats)} asientos vinculados a mesas."))

            # 2. Purgar asientos de base de datos que no corresponden a las mesas activas
            # Si hay tickets en asientos huérfanos:
            deleted_count = 0
            for s, t_count in seats_with_tickets:
                tid = str(s.table_id or '')
                r = str(s.row or '').strip().lower()
                is_valid = (tid and tid in valid_table_ids) or (r and r in valid_table_labels)
                if not is_valid:
                    if force_tickets:
                        Ticket.objects.filter(seat=s).delete()
                        s.delete()
                        deleted_count += 1
                        self.stdout.write(f"  [PURGADO] Asiento huérfano con tickets ID={s.id} ({s.row} #{s.number}) eliminado con --force-tickets.")
                    else:
                        self.stdout.write(self.style.WARNING(f"  [ALERTA] Asiento huérfano ID={s.id} ({s.row} #{s.number}) tiene {t_count} ticket(s). Usa --force-tickets para purgar."))

            for s in seats_without_tickets:
                tid = str(s.table_id or '')
                r = str(s.row or '').strip().lower()
                is_valid = (tid and tid in valid_table_ids) or (r and r in valid_table_labels)
                if not is_valid:
                    s.delete()
                    deleted_count += 1

            self.stdout.write(f"  Se eliminaron {deleted_count} asientos huérfanos de la base de datos.")

            # 3. Regenerar y sincronizar exactamente los 168 asientos
            final_count = theater.generate_seats()
            self.stdout.write(self.style.SUCCESS(
                f"\n=== Saneamiento Completado: {final_count} asientos sincronizados en '{theater.name}' (Exactamente {target_seat_count}) ==="
            ))
