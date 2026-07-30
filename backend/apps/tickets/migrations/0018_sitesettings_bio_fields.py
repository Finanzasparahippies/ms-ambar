# Generated for SiteSettings bio fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0017_event_allow_numbered_tickets'),
    ]

    operations = [
        migrations.AddField(
            model_name='sitesettings',
            name='bio_badge',
            field=models.CharField(default='La Cantautora', help_text='Badge superior de la sección de biografía.', max_length=255),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='bio_title',
            field=models.CharField(default='Ms. Ambar', help_text='Título principal de la biografía.', max_length=255),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='bio_image',
            field=models.ImageField(blank=True, help_text='Imagen oficial de la biografía en el index.', null=True, upload_to='site_settings/'),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='bio_location',
            field=models.CharField(default='Hermosillo • México', help_text='Ubicación o pie de biografía.', max_length=255),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='bio_content',
            field=models.TextField(blank=True, default='Ms. Ambar, nombre artístico de la cantautora originaria de Hermosillo, Sonora, es una figura destacada en la música latina por su fusión de géneros como R&B, soul, regional mexicano y bachata. Su carrera profesional comenzó en 2017 con la banda "Moonset", pero consolidó su relevancia al unirse a la gira del rapero mexicano Charles Ans en 2022, actuando como telonera en grandes escenarios como el Auditorio Nacional.\n\nSu primer álbum formal, "14•28", fue lanzado en octubre de 2024; el título hace referencia a la numerología y a fechas significativas. A través de su música, busca conectar emocionalmente con el público compartiendo historias autobiográficas y reflexiones sobre la vida, la muerte y las memorias.\n\nUn hito reciente en su trayectoria fue su selección para representar a México en la categoría folclórica del Festival de Viña del Mar 2025, con la canción "No te voy a llorar", consolidándose como una de las artistas más prometedoras de la nueva generación musical mexicana.', help_text='Texto completo de la biografía. Separa párrafos con salto de línea.', null=True),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='bio_cta_text',
            field=models.CharField(default='Ver Próximos Eventos', help_text='Texto del botón CTA de biografía.', max_length=255),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='bio_cta_url',
            field=models.CharField(default='/tour', help_text='URL o enlace del botón CTA de biografía.', max_length=255),
        ),
    ]
