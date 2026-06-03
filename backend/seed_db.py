import os
import django
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.tickets.models import Theater, Event, Seat

# 1. Create a Theater
theater, created = Theater.objects.get_or_create(
    name="Teatro Degollado",
    defaults={
        "location": "Guadalajara, Jalisco",
        "layout": {
            "sections": [
                {
                    "name": "Platea VIP",
                    "layout_type": "grid",
                    "x": 100,
                    "y": 100,
                    "rows": [
                        {"label": "A", "count": 6, "category": "vip", "base_price": 1500},
                        {"label": "B", "count": 6, "category": "standard", "base_price": 1000}
                    ]
                }
            ]
        }
    }
)

if created or Seat.objects.filter(theater=theater).count() == 0:
    theater.generate_seats()
    print("Theater and seats created.")
else:
    print("Theater already exists.")

# 2. Create a Concert Event
concert, created = Event.objects.get_or_create(
    title="Sinfonía Ámbar 2026 - Concierto Acústico",
    defaults={
        "artist": "MS AMBAR",
        "date": timezone.now() + timezone.timedelta(days=30),
        "theater": theater,
        "event_type": "concert",
        "mg_price": 600.00,
        "mg_limit": 20,
        "price_multiplier": 1.20,
        "is_active": True
    }
)
if created:
    print("Concert event created.")
else:
    print("Concert event already exists.")

# 3. Create a Meet & Greet Event
meet_greet, created = Event.objects.get_or_create(
    title="Convivencia Mística VIP - Hermosillo",
    defaults={
        "artist": "MS AMBAR",
        "date": timezone.now() + timezone.timedelta(days=15),
        "theater": None,
        "event_type": "meet_greet",
        "mg_price": 850.00,
        "mg_limit": 50,
        "price_multiplier": 1.0,
        "is_active": True
    }
)
if created:
    print("Meet & Greet event created.")
else:
    print("Meet & Greet event already exists.")
