# Generated manually to add subscriber_id, api_subscription_id, tags, is_premium and alter created_at on NewsletterSubscriber model

from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('blog', '0008_campaign_bg_attributes'),
    ]

    operations = [
        migrations.AddField(
            model_name='newslettersubscriber',
            name='subscriber_id',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='newslettersubscriber',
            name='api_subscription_id',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='newslettersubscriber',
            name='tags',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='newslettersubscriber',
            name='is_premium',
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name='newslettersubscriber',
            name='created_at',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
    ]
