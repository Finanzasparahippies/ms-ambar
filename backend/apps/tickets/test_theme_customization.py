from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from apps.users.models import User
from apps.tickets.models import SiteSettings
from apps.tickets.serializers import SiteSettingsSerializer

class ThemeCustomizationSchemaAndScaleTest(TestCase):
    def setUp(self):
        # Limpiar singleton si existe
        SiteSettings.objects.all().delete()
        self.settings = SiteSettings.get()

    def test_theme_color_schema_persistence(self):
        """Verify color hex codes schema validates and persists properly in SiteSettings."""
        self.settings.primary_color = '#E5A93B'
        self.settings.secondary_color = '#22A6B7'
        self.settings.background_start = '#080c0a'
        self.settings.background_end = '#040605'
        self.settings.accent_color = '#9F2B00'
        self.settings.card_background = '#0c0f0d'
        self.settings.text_color = '#F4F6F0'
        self.settings.save()

        # Recargar de base de datos
        db_settings = SiteSettings.objects.get(pk=1)
        self.assertEqual(db_settings.primary_color, '#E5A93B')
        self.assertEqual(db_settings.accent_color, '#9F2B00')
        self.assertEqual(db_settings.text_color, '#F4F6F0')

    def test_typography_and_border_scales_persistence(self):
        """Verify typographic presets, border-radius controls, patterns and zoom controls persist correctly."""
        self.settings.font_preset = 'outfit'
        self.settings.card_style = 'rounded-2xl'
        self.settings.background_pattern = 'grid'
        self.settings.allow_canvas_zoom = False
        self.settings.custom_css = 'body { overflow-x: hidden; }'
        self.settings.save()

        db_settings = SiteSettings.objects.get(pk=1)
        self.assertEqual(db_settings.font_preset, 'outfit')
        self.assertEqual(db_settings.card_style, 'rounded-2xl')
        self.assertEqual(db_settings.background_pattern, 'grid')
        self.assertFalse(db_settings.allow_canvas_zoom)
        self.assertEqual(db_settings.custom_css, 'body { overflow-x: hidden; }')

    def test_theme_mode_default_fallback_values(self):
        """Verify that get_theme_config returns safe default fallback values to avoid blank screen crashes."""
        # Limpiar campos para probar fallbacks
        self.settings.primary_color = ''
        self.settings.secondary_color = None
        self.settings.background_start = ''
        self.settings.background_end = None
        self.settings.save()

        config = self.settings.get_theme_config()
        # Debe aplicar los fallbacks configurados en el modelo
        self.assertEqual(config['primary_color'], '#E5A93B')
        self.assertEqual(config['secondary_color'], '#22A6B7')
        self.assertEqual(config['background_start'], '#080c0a')
        self.assertEqual(config['background_end'], '#040605')


class ThemeCustomizationPageOverrideIntegrationTest(APITestCase):
    def setUp(self):
        SiteSettings.objects.all().delete()
        self.settings = SiteSettings.get()
        self.admin_user = User.objects.create_user(
            email='theme_admin@msambar.com', 
            username='theme_admin', 
            password='Password123!', 
            is_staff=True
        )
        self.settings_url = reverse('site-settings')
        self.active_theme_url = reverse('active-theme')

    def test_theme_settings_override_by_page(self):
        """Verify dynamic visual parameters override properly in section_themes without modifying global parameters."""
        self.client.force_authenticate(user=self.admin_user)
        
        # Estructura de prueba con override para la página de 'galleria'
        data = {
            'theme_mode': 'section',
            'primary_color': '#E5A93B', # Global
            'section_themes': {
                'galleria': {
                    'primary_color': '#FF007F', # Sobrescribe color primario solo en la galería
                    'background_start': '#1A0033',
                    'background_end': '#000000',
                    'card_style': 'rounded-[3rem]',
                    'font_preset': 'space-grotesk'
                },
                'contact': {
                    'primary_color': '#00FFCC'
                }
            }
        }
        res = self.client.post(self.settings_url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Consultar la configuración del tema activo
        res_active = self.client.get(self.active_theme_url)
        self.assertEqual(res_active.status_code, status.HTTP_200_OK)
        
        # Validar la persistencia de las llaves en section_themes
        section_themes = res_active.data.get('section_themes', {})
        self.assertIn('galleria', section_themes)
        self.assertEqual(section_themes['galleria']['primary_color'], '#FF007F')
        self.assertEqual(section_themes['galleria']['font_preset'], 'space-grotesk')

        # Comprobar que el primario global en SiteSettings no se vio modificado por los valores del override
        self.assertEqual(res_active.data['primary_color'], '#E5A93B')
        self.assertEqual(section_themes['contact']['primary_color'], '#00FFCC')
