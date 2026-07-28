from django.db import migrations

def sanitize_event_prices(apps, schema_editor):
    Event = apps.get_model('tickets', 'Event')
    Seat = apps.get_model('tickets', 'Seat')
    Theater = apps.get_model('tickets', 'Theater')

    for event in Event.objects.all():
        updated = False
        # Si es el concierto de Hadas en el Desierto u otro concierto en vivo
        if 'hadas' in event.title.lower() or event.event_type == 'concert':
            event.seatless_ticket_price = 450.00
            event.enable_dynamic_pricing = False
            event.price_multiplier = 1.00
            updated = True

            # Actualizar todos los asientos del recinto a $500.00 MXN
            if event.theater:
                Seat.objects.filter(theater=event.theater).update(base_price=500.00)
                
                # Actualizar el layout JSON del teatro
                th = event.theater
                if isinstance(th.layout, dict) and 'seats' in th.layout:
                    for s in th.layout['seats']:
                        s['base_price'] = 500.00
                    th.save(update_fields=['layout'])
        elif event.event_type == 'meet_greet':
            if not event.mg_price or event.mg_price <= 0:
                event.mg_price = 500.00
                updated = True

        if updated:
            event.save()

class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0018_sanitize_168_seats'),
    ]

    operations = [
        migrations.RunPython(sanitize_event_prices, reverse_code=migrations.RunPython.noop),
    ]
