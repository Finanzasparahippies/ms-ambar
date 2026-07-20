# Nectar Labs — Fix: tickets_theater.layout was NOT NULL in DB (initial migration
# had no null=True). The model was updated to null=True/blank=True but the migration
# was never generated. This makes the column nullable and sets a safe default.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0004_seat_status_ticket_is_scanned_ticket_scanned_at_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='theater',
            name='layout',
            field=models.JSONField(
                blank=True,
                null=True,
                default=dict,
                help_text='JSON representation of sections and rows',
            ),
        ),
    ]
