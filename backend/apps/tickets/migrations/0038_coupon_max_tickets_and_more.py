from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0037_coupon_complimentary_rows_priority'),
    ]

    operations = [
        migrations.AddField(
            model_name='coupon',
            name='max_tickets',
            field=models.PositiveIntegerField(
                default=1,
                help_text="Número máximo de boletos o asientos cubiertos por cortesía en una misma orden (ej. 1 boleto)"
            ),
        ),
        migrations.AddField(
            model_name='coupon',
            name='max_uses_per_email',
            field=models.PositiveIntegerField(
                default=1,
                help_text="Límite máximo de canjes permitidos por cada correo electrónico"
            ),
        ),
        migrations.AddField(
            model_name='coupon',
            name='allow_mixed_checkout',
            field=models.BooleanField(
                default=True,
                help_text="Permite comprar boletos adicionales pagados en la misma orden que el cupón de cortesía"
            ),
        ),
    ]
