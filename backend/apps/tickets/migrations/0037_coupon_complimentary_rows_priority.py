from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0036_coupon_allowed_emails_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='coupon',
            name='complimentary_rows_priority',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Lista priorizada de filas designadas para este cupón (ej. ['Fila G', 'Fila H'])"
            ),
        ),
    ]
