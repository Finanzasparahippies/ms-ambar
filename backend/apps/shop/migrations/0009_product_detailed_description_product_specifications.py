# Generated for ms-ambar shop product model update

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0008_alter_product_image'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='detailed_description',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='product',
            name='specifications',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
