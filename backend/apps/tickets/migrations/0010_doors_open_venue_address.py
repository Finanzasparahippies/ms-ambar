# Generated manually for ms-ambar project on 2026-06-05

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0009_ticket_stripe_session_id'), 
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='doors_open',
            field=models.DateTimeField(
                help_text='Hora en que se abren las puertas.',
                null=True,
                blank=True
            ),
        ),
        migrations.AddField(
            model_name='event',
            name='venue_name',
            field=models.CharField(
                help_text='Nombre del recinto (Venue).', 
                max_length=255,
                null=True,
                blank=True
            ),
        ),
        migrations.AddField(
            model_name='event',
            name='venue_address',
            field=models.CharField(
                help_text='Dirección del recinto.', 
                max_length=500,
                null=True,
                blank=True
            ),
        ),
        migrations.AddField(
            model_name='event',
            name='duration_minutes',
            field=models.PositiveIntegerField(
                default=120, 
                help_text="Duración estimada del evento en minutos."
            ),
        ),
    ]