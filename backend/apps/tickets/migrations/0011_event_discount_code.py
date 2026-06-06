# Generated manually for ms-ambar project on 2026-06-05

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0010_doors_open_venue_address'), 
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='discount_code',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]