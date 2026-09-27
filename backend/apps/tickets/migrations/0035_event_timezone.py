# Generated for Event timezone field
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0034_alter_event_flyer_alter_event_image'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='timezone',
            field=models.CharField(
                default='America/Hermosillo',
                help_text='Zona horaria IANA del evento (ej. America/Hermosillo, America/Mexico_City). Evita desfasamientos entre UTC y hora local.',
                max_length=50,
            ),
        ),
    ]
