import logging
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.tickets.models import Ticket

logger = logging.getLogger('apps.tickets')


class Command(BaseCommand):
    help = "Cancela un boleto de forma atómica y libera la butaca asociada en la matriz del recinto."

    def add_arguments(self, parser):
        parser.add_argument('ticket_id', type=int, help='ID numérico del boleto a cancelar')
        parser.add_argument('--reason', type=str, default='Cancelación administrativa vía CLI', help='Motivo de la cancelación')
        parser.add_argument('--keep-seat', action='store_true', help='No desvincular el ID de asiento (mantiene seat_id a pesar de estar cancelado)')

    def handle(self, *args, **options):
        ticket_id = options['ticket_id']
        reason = options['reason']
        keep_seat = options['keep_seat']

        try:
            with transaction.atomic():
                ticket = Ticket.objects.select_for_update(of=('self',)).select_related('event', 'seat').get(pk=ticket_id)

                if ticket.status == 'cancelled' and (ticket.seat is None or keep_seat):
                    self.stdout.write(self.style.WARNING(f"El boleto #{ticket.id} ya se encuentra cancelado."))
                    return

                old_status = ticket.status
                old_seat = ticket.seat
                old_seat_desc = f"{old_seat.row}{old_seat.number} (ID: {old_seat.id})" if old_seat else "Sin Asiento"

                ticket.status = 'cancelled'
                update_fields = ['status']
                if not keep_seat and ticket.seat:
                    ticket.seat = None
                    update_fields.append('seat')

                ticket.save(update_fields=update_fields)

                logger.info(
                    f"[CLI/CANCEL] Ticket #{ticket.id} ({ticket.user_email}) cancelado vía CLI. "
                    f"Estado anterior: {old_status}, Asiento anterior: {old_seat_desc}, Motivo: {reason}."
                )

                self.stdout.write(self.style.SUCCESS(
                    f"✅ Boleto #{ticket.id} ({ticket.user_email}) CANCELADO exitosamente.\n"
                    f"   • Evento: #{ticket.event_id} ({ticket.event.title})\n"
                    f"   • Asiento liberado: {old_seat_desc}\n"
                    f"   • Motivo: {reason}"
                ))
        except Ticket.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"❌ Error: El boleto con ID {ticket_id} no existe en la base de datos."))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Error durante la cancelación del boleto #{ticket_id}: {str(e)}"))
            logger.error(f"[CLI/CANCEL] Error cancelando ticket #{ticket_id}: {e}", exc_info=True)
