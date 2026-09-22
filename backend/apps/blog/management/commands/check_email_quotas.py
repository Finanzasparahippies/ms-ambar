from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.blog.utils import get_brevo_sent_count, _get_today_utc_date
from apps.blog.models import DailyEmailQuotaCounter
from django.core.cache import cache

class Command(BaseCommand):
    help = "Inspects or resets Brevo daily email quota consumption in Redis and DB."

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset-brevo-quota',
            action='store_true',
            help='Resets Brevo sent count to 0 for today UTC.',
        )

    def handle(self, *args, **options):
        today = _get_today_utc_date()
        date_str = today.isoformat()
        cache_key = f"brevo:daily_sent_count:{date_str}"

        if options['reset_brevo_quota']:
            DailyEmailQuotaCounter.objects.update_or_create(
                provider='brevo',
                date=today,
                defaults={'sent_count': 0}
            )
            cache.set(cache_key, 0, timeout=86400)
            self.stdout.write(self.style.SUCCESS(f"[QUOTA] Brevo daily quota successfully reset to 0 for UTC date {date_str}."))
            return

        sent_count = get_brevo_sent_count(today)
        cache_val = cache.get(cache_key)
        
        self.stdout.write(self.style.NOTICE(f"=== BREVO EMAIL QUOTA STATUS (UTC: {date_str}) ==="))
        self.stdout.write(f"Sent Count: {sent_count} / 300")
        self.stdout.write(f"Remaining Quota: {max(0, 300 - sent_count)}")
        self.stdout.write(f"Redis/Cache Value: {cache_val}")
        
        db_counter = DailyEmailQuotaCounter.objects.filter(provider='brevo', date=today).first()
        self.stdout.write(f"DB Record: {db_counter}")
        self.stdout.write(self.style.SUCCESS("Quota check completed."))
