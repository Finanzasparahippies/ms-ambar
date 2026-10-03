from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0039_ticketcheckinaudit'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='is_online_sales_active',
            field=models.BooleanField(
                default=True,
                help_text="Bandera global de corte para ventas en línea en día de evento."
            ),
        ),
        migrations.AddField(
            model_name='event',
            name='cutoff_datetime',
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="Fecha y hora exacta del corte de venta web previo a taquilla física."
            ),
        ),
    ]
