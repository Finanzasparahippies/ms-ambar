# Generated for ms-ambar shop flat technical specifications fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0010_productimage'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='material',
            field=models.CharField(blank=True, default='', help_text='Composición o material', max_length=255),
        ),
        migrations.AddField(
            model_name='product',
            name='dimensions',
            field=models.CharField(blank=True, default='', help_text='Dimensiones o tallas disponibles', max_length=255),
        ),
        migrations.AddField(
            model_name='product',
            name='weight',
            field=models.CharField(blank=True, default='', help_text='Peso estimado del producto', max_length=100),
        ),
        migrations.AddField(
            model_name='product',
            name='origin',
            field=models.CharField(blank=True, default='', help_text='Lugar de fabricación o confección', max_length=255),
        ),
        migrations.AddField(
            model_name='product',
            name='care_instructions',
            field=models.TextField(blank=True, default='', help_text='Instrucciones de cuidado y lavado'),
        ),
    ]
