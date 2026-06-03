# Generated manually to add background custom attributes and CTA button fields to EmailCampaign model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('blog', '0007_emailcampaign'),
    ]

    operations = [
        migrations.AddField(
            model_name='emailcampaign',
            name='bg_image',
            field=models.ImageField(blank=True, null=True, upload_to='campaign_bg/'),
        ),
        migrations.AddField(
            model_name='emailcampaign',
            name='bg_opacity',
            field=models.FloatField(default=1.0),
        ),
        migrations.AddField(
            model_name='emailcampaign',
            name='bg_saturation',
            field=models.IntegerField(default=100),
        ),
        migrations.AddField(
            model_name='emailcampaign',
            name='bg_position',
            field=models.CharField(default='center', max_length=50),
        ),
        migrations.AddField(
            model_name='emailcampaign',
            name='cta_text',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='emailcampaign',
            name='cta_link',
            field=models.URLField(blank=True, default=''),
        ),
    ]
