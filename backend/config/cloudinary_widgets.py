from typing import Any, Optional, Dict
from django import forms
from django.db import models
from django.contrib import admin
from django.conf import settings
from .cloudinary_storage import generate_cloudinary_signature


class CloudinaryImageFormField(forms.ImageField):
    """
    Campo de formulario que soporta tanto subidas binarias multipart locales
    como strings con public_id / URL provenientes del Cloudinary Media Library Widget,
    evitando que Pillow intente abrir archivos remotos en disco local.
    """

    def to_python(self, data: Any) -> Any:
        if isinstance(data, str) and data:
            return data
        return super().to_python(data)

    def clean(self, data: Any, initial: Any = None) -> Any:
        if data is False:
            if not self.required:
                return False
            return None
        if isinstance(data, str) and data:
            return data
        if not data and initial:
            return initial
        return super().clean(data, initial)


class CloudinaryMediaLibraryWidget(forms.ClearableFileInput):
    """
    Widget para Django Admin que integra el Cloudinary Media Library modal
    junto al input estándar de subida, con previsualización reactiva.
    """
    template_name = 'admin/widgets/cloudinary_media_library.html'

    class Media:
        js = (
            'https://media-library.cloudinary.com/global/all.js',
            'admin/js/cloudinary_media_library.js',
        )
        css = {
            'all': ('admin/css/cloudinary_media_library.css',)
        }

    def get_context(self, name: str, value: Any, attrs: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        context = super().get_context(name, value, attrs)

        # Generar firma para el widget del lado del servidor sin exponer API_SECRET
        sig_data = generate_cloudinary_signature()

        # Determinar URL inicial de previsualización
        preview_url = ''
        if value:
            val_str = getattr(value, 'url', None) or str(value)
            if isinstance(val_str, str):
                if val_str.startswith('http://') or val_str.startswith('https://'):
                    preview_url = val_str
                else:
                    cloud_name = sig_data.get('cloud_name')
                    preview_url = f"https://res.cloudinary.com/{cloud_name}/image/upload/{val_str}"

        context['widget'].update({
            'cloud_name': sig_data.get('cloud_name', ''),
            'api_key': sig_data.get('api_key', ''),
            'timestamp': sig_data.get('timestamp', ''),
            'signature': sig_data.get('signature', ''),
            'default_folder': sig_data.get('default_folder', 'ms_ambar/staging'),
            'environment': sig_data.get('environment', 'staging'),
            'preview_url': preview_url,
            'asset_value': str(value) if value else '',
        })
        return context

    def value_from_datadict(self, data: Dict[str, Any], files: Dict[str, Any], name: str) -> Any:
        # 1. Si se seleccionó un archivo local estándar, priorizarlo
        upload = files.get(name)
        if upload:
            return upload

        # 2. Si se marcó el checkbox de limpiar imagen
        clear_checkbox = f"{name}-clear"
        if data.get(clear_checkbox):
            return False

        # 3. Si se seleccionó un asset en el modal de Cloudinary
        cloudinary_asset = data.get(f"{name}_cloudinary_asset")
        if cloudinary_asset:
            return cloudinary_asset.strip()

        # 4. Comportamiento por defecto
        return super().value_from_datadict(data, files, name)


class CloudinaryMediaAdminMixin:
    """
    Mixin para ModelAdmin que inyecta automáticamente el CloudinaryMediaLibraryWidget
    y CloudinaryImageFormField en todos los campos ImageField y FileField.
    """

    def formfield_for_dbfield(self, db_field: models.Field, request: Any, **kwargs: Any) -> Any:
        if isinstance(db_field, (models.ImageField, models.FileField)):
            kwargs.setdefault('widget', CloudinaryMediaLibraryWidget)
            kwargs.setdefault('form_class', CloudinaryImageFormField)
        return super().formfield_for_dbfield(db_field, request, **kwargs)


class CloudinaryTabularInline(CloudinaryMediaAdminMixin, admin.TabularInline):
    """Inline tabular con soporte completo para Cloudinary Media Library Widget."""
    pass


class CloudinaryStackedInline(CloudinaryMediaAdminMixin, admin.StackedInline):
    """Inline apilado con soporte completo para Cloudinary Media Library Widget."""
    pass
