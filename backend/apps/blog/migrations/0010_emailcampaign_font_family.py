# Generated manually to add font_family to EmailCampaign model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('blog', '0009_subscriber_extra_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='emailcampaign',
            name='font_family',
            field=models.CharField(default='serif', max_length=100),
        ),
    ]
