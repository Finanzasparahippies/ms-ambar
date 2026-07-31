# Generated for Event allow_numbered_tickets field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0016_coupon_assigned_email'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='allow_numbered_tickets',
            field=models.BooleanField(default=True, help_text='Permite la compra de boletos numerados reservables en mapa del teatro'),
        ),
    ]
