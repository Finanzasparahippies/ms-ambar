# Generated manually for EmailCampaign model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('blog', '0006_newslettersubscriber_name'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmailCampaign',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('subject', models.CharField(max_length=255)),
                ('poem_text', models.TextField()),
                ('template_type', models.CharField(choices=[('minimalist', 'Minimalist Carbon'), ('moss', 'Moss Green'), ('cosmic', 'Cosmic Night'), ('glow', 'Amber Glow'), ('mist', 'Mystic Mist')], default='minimalist', max_length=50)),
                ('image', models.ImageField(blank=True, null=True, upload_to='campaigns/')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('is_sent', models.BooleanField(default=False)),
            ],
        ),
    ]
