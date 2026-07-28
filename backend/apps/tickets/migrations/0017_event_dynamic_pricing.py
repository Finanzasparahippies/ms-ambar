from django.db import migrations, models

def sanitize_and_resync_theaters(apps, schema_editor):
    Theater = apps.get_model('tickets', 'Theater')
    Seat = apps.get_model('tickets', 'Seat')
    
    for theater in Theater.objects.all():
        layout = theater.layout
        if isinstance(layout, dict) and 'seats' in layout:
            seats_data = layout.get('seats', [])
            map_elements = layout.get('map_elements', [])
            
            table_rows = set()
            for s in seats_data:
                rw = str(s.get('row', '')).strip()
                if rw.lower().startswith('mesa '):
                    table_rows.add(rw)
            
            if len(table_rows) > 42:
                allowed_tables = {f"Mesa {i}" for i in range(1, 43)}
                filtered_seats = [s for s in seats_data if str(s.get('row', '')).strip() in allowed_tables]
                filtered_elements = [
                    el for el in map_elements 
                    if not (el.get('type') == 'table' and str(el.get('label', '')).strip() not in allowed_tables)
                ] if isinstance(map_elements, list) else map_elements
                
                theater.layout['seats'] = filtered_seats
                theater.layout['map_elements'] = filtered_elements
                theater.save(update_fields=['layout'])
                
                # Delete stale seats from DB that belong to tables > 42
                Seat.objects.filter(theater=theater).exclude(row__in=allowed_tables).delete()

class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0016_coupon_assigned_email'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='enable_dynamic_pricing',
            field=models.BooleanField(default=True, help_text='Activa el ajuste dinámico mensual de precios previo al evento'),
        ),
        migrations.AddField(
            model_name='event',
            name='monthly_price_increment',
            field=models.DecimalField(decimal_places=2, default=50.0, max_digits=10, help_text='Monto de incremento mensual (ej. $50.00 MXN)'),
        ),
        migrations.RunPython(sanitize_and_resync_theaters, reverse_code=migrations.RunPython.noop),
    ]
