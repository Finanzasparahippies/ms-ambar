from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0011_product_technical_specifications'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='shipping_id',
            field=models.CharField(blank=True, help_text='ID del envío en Skydropx', max_length=255, null=True),
        ),
    ]
