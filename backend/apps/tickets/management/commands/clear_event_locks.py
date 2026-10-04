import os
import logging
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.core.cache import cache
from django.conf import settings
from django.utils import timezone

from apps.tickets.models import Ticket, Event

logger = logging.getLogger('apps.tickets')


class Command(BaseCommand):
    help = "Limpia y purga bloqueos de asientos en Redis/Cache y reservas expiradas para un ID de evento específico."

    def add_arguments(self, parser):
        parser.add_argument('event_id', type=int, help='ID numérico del evento a desbloquear')
        parser.add_argument('--release-stale', action='store_true', help='Cancela boletos reservados abandonados (> 15 minutos) liberando los asientos en la matriz')

    def handle(self, *args, **options):
        event_id = options['event_id']
        release_stale = options['release_stale']

        self.stdout.write("=" * 70)
        self.stdout.write(self.style.MIGRATE_HEADING(f"  MS AMBAR — CLEAR LOCKS & CACHE ENGINE (Evento #{event_id})"))
        self.stdout.write("=" * 70)

        try:
            event = Event.objects.get(pk=event_id)
            self.stdout.write(f"Evento: {event.title} (ID #{event.id})")
        except Event.DoesNotExist:
            self.stdout.write(self.style.WARNING(f"⚠️ Evento #{event_id} no existe en base de datos. Procediendo con purga de llaves huérfanas en Redis/Cache."))

        # 1. Invalidación en Django Cache
        django_keys = [
            f"event_{event_id}",
            f"event_layout_{event_id}",
            f"seat_map_{event_id}",
            "active_events",
            "ms_ambar_active_events_public",
            "ms_ambar_active_theme_global",
        ]
        cleared_django = 0
        for k in django_keys:
            try:
                cache.delete(k)
                cleared_django += 1
            except Exception as e:
                logger.debug(f"Error borrando llave de cache {k}: {e}")

        self.stdout.write(self.style.SUCCESS(f"✅ Llaves de caché Django invalidadas: {cleared_django} llaves purgadas."))

        # 2. Purga directa en Redis mediante redis-py si está disponible
        redis_purged = 0
        redis_url = getattr(settings, 'REDIS_URL', os.environ.get('REDIS_URL', 'redis://redis:6379/1'))
        try:
            import redis
            client = redis.from_url(redis_url, socket_connect_timeout=2)
            patterns = [
                f"*event*{event_id}*",
                f"*seat*{event_id}*",
                f"*lock*{event_id}*",
                f"*reservation*{event_id}*",
                f"*ticket*{event_id}*",
            ]
            for pat in patterns:
                for k in client.scan_iter(match=pat, count=100):
                    client.delete(k)
                    redis_purged += 1

            self.stdout.write(self.style.SUCCESS(f"✅ Llaves Redis eliminadas asociadas al evento: {redis_purged} bloqueos purgados en '{redis_url}'."))
        except ImportError:
            self.stdout.write(self.style.NOTICE("ℹ️ Librería 'redis' no instalada en este entorno; se confió en la interfaz unificada de django.core.cache."))
        except Exception as exc:
            self.stdout.write(self.style.WARNING(f"⚠️ Aviso al contactar servidor Redis ({redis_url}): {exc} (la caché Django estándar fue purgada)."))

        # 3. Detección y Liberación de Reservas Inconclusas / Abandonadas en PostgreSQL
        cutoff = timezone.now() - timedelta(minutes=15)
        stale_qs = Ticket.objects.filter(event_id=event_id, status='reserved', created_at__lt=cutoff)
        stale_count = stale_qs.count()

        self.stdout.write(f"📊 Reservas inconclusas en DB (> 15 min): {stale_count} boletos reteniendo asientos.")

        if stale_count > 0:
            if release_stale:
                for t in stale_qs:
                    old_seat = t.seat
                    t.status = 'cancelled'
                    t.seat = None
                    t.save(update_fields=['status', 'seat'])
                self.stdout.write(self.style.SUCCESS(f"✅ {stale_count} reservas vencidas canceladas y sus asientos liberados."))
            else:
                self.stdout.write(self.style.NOTICE("ℹ️ Pasa '--release-stale' para cancelar automáticamente estos boletos y liberar sus asientos."))

        self.stdout.write(self.style.SUCCESS(f"\n🎉 Purga de bloqueos completada exitosamente para Evento #{event_id}."))
