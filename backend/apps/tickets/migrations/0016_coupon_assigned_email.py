# Generated for Coupon assigned_email field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0015_coupon_event_allow_seatless_tickets_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='coupon',
            name='assigned_email',
            field=models.EmailField(blank=True, help_text='Correo electrónico exclusivo al que está asignado este cupón (opcional)', max_length=254, null=True),
        ),
    ]
