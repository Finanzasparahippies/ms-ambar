import os
import django
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.tickets.models import Theater, Event, Seat

def build_42_tables_layout():
    seats = []
    map_elements = []
    table_id = 1
    # Layout 7 rows by 6 columns of tables = 42 tables
    for row in range(7):
        for col in range(6):
            table_x = 200 + col * 120
            table_y = 200 + row * 120
            label = f"Mesa {table_id}"
            
            map_elements.append({
                "id": f"table-{table_id}",
                "type": "table",
                "tableShape": "circle",
                "x": table_x,
                "y": table_y,
                "w": 80,
                "h": 80,
                "label": label,
                "color": "rgba(255, 191, 0, 0.25)",
                "capacity": 4
            })
            
            # 4 seats around each table (top, right, bottom, left)
            positions = [
                (-25, -25), (25, -25),
                (-25, 25), (25, 25)
            ]
            for seat_idx, (dx, dy) in enumerate(positions, start=1):
                seats.append({
                    "section": f"Planta Baja - Mesas",
                    "row": f"Mesa {table_id}",
                    "number": seat_idx,
                    "category": "vip" if row < 2 else "standard",
                    "base_price": 500.00,
                    "x": table_x + dx,
                    "y": table_y + dy,
                    "angle": 0,
                    "status": "available"
                })
            table_id += 1
    return {"map_elements": map_elements, "seats": seats}

layout_data = build_42_tables_layout()

# 1. Create a Theater
theater, created = Theater.objects.get_or_create(
    name="Teatro Degollado",
    defaults={
        "location": "Guadalajara, Jalisco",
        "layout": layout_data
    }
)

theater.layout = layout_data
theater.save()
seat_count = theater.generate_seats()
print(f"Teatro sincronizado con {seat_count} asientos (42 mesas x 4 butacas).")

# 2. Create a Concert Event
concert, created = Event.objects.get_or_create(
    title="Sinfonía Ámbar 2026 - Concierto Acústico",
    defaults={
        "artist": "Ms Ambar",
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
        "artist": "Ms Ambar",
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
