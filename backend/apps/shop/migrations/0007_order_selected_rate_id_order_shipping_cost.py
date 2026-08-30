from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0006_remove_order_address_order_phone_order_postal_code_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='selected_rate_id',
            field=models.CharField(blank=True, help_text='ID de tarifa seleccionado en Skydropx', max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='shipping_cost',
            field=models.DecimalField(decimal_places=2, default=0.0, help_text='Costo de envío cotizado', max_digits=10),
        ),
    ]
