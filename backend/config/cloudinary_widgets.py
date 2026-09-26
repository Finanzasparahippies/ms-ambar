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
        )

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

    def render(self, name: str, value: Any, attrs: Optional[Dict[str, Any]] = None, renderer: Any = None) -> str:
        context = self.get_context(name, value, attrs)
        return self._render_inline(name, value, attrs, context)

    def _render_inline(self, name: str, value: Any, attrs: Optional[Dict[str, Any]], context: Dict[str, Any]) -> str:
        from django.forms.widgets import FileInput
        from django.utils.html import escape
        from django.utils.safestring import mark_safe

        w = context.get('widget', {})
        widget_attrs = w.get('attrs', {}) or (attrs or {})
        field_id = escape(str(widget_attrs.get('id', f"id_{name}")))
        cloud_name = escape(str(w.get('cloud_name', '')))
        api_key = escape(str(w.get('api_key', '')))
        timestamp = escape(str(w.get('timestamp', '')))
        signature = escape(str(w.get('signature', '')))
        default_folder = escape(str(w.get('default_folder', 'ms_ambar/staging')))
        environment = escape(str(w.get('environment', 'staging')))
        preview_url = escape(str(w.get('preview_url', '')))
        asset_value = escape(str(w.get('asset_value', '')))
        is_initial = w.get('is_initial', False)

        preview_style = 'display: flex;' if preview_url else 'display: none;'
        info_text = asset_value if asset_value else 'Asset seleccionado'
        file_input_html = FileInput().render(name, None, attrs=widget_attrs)

        clear_checkbox_html = ''
        if is_initial:
            checkbox_name = escape(str(w.get('checkbox_name', f"{name}-clear")))
            checkbox_id = escape(str(w.get('checkbox_id', f"{field_id}-clear_id")))
            clear_checkbox_html = (
                f'<div class="cld-initial-wrapper" style="margin-top: 6px; font-size: 12px; color: #64748b;">'
                f'<label for="{checkbox_id}">'
                f'<input type="checkbox" name="{checkbox_name}" id="{checkbox_id}"> '
                f'Limpiar / Eliminar imagen actual'
                f'</label>'
                f'</div>'
            )

        html = f"""
<style>
.cloudinary-widget-container {{
    display: flex; flex-direction: column; gap: 12px; padding: 12px;
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 650px; margin: 6px 0;
}}
.cld-preview-card {{
    display: flex; align-items: center; gap: 14px; background: #0f172a; border: 1px solid #1e293b;
    border-radius: 8px; padding: 10px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
}}
.cld-preview-img {{ width: 100px; height: 75px; object-fit: cover; border-radius: 6px; border: 1px solid #334155; background: #000; }}
.cld-asset-meta {{ display: flex; flex-direction: column; gap: 6px; flex: 1; overflow: hidden; }}
.cld-env-badge {{ align-self: flex-start; font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 7px; border-radius: 4px; }}
.cld-env-badge.cld-env-production, .cld-env-badge.cld-env-prod {{ background: #065f46; color: #6ee7b7; border: 1px solid #047857; }}
.cld-env-badge.cld-env-staging, .cld-env-badge.cld-env-local {{ background: #78350f; color: #fde68a; border: 1px solid #b45309; }}
.cld-asset-name {{ font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px; }}
.cld-remove-btn {{ align-self: flex-start; background: transparent; color: #f87171; border: 1px solid #ef4444; padding: 3px 8px; font-size: 11px; border-radius: 4px; cursor: pointer; transition: all 0.2s; }}
.cld-remove-btn:hover {{ background: #ef4444; color: #fff; }}
.cld-actions-toolbar {{ display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }}
.cld-browse-btn {{
    background: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%); color: #fff !important;
    border: none; border-radius: 6px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: all 0.2s;
}}
.cld-browse-btn:hover {{ background: linear-gradient(135deg, #4338ca 0%, #1d4ed8 100%); transform: translateY(-1px); }}
.cld-separator {{ font-size: 12px; color: #64748b; font-style: italic; }}
.cld-file-input-wrapper input[type="file"] {{ font-size: 12px; }}
</style>

<div class="cloudinary-widget-container" 
     id="cld_container_{field_id}"
     data-field-name="{name}"
     data-field-id="{field_id}"
     data-cloud-name="{cloud_name}"
     data-api-key="{api_key}"
     data-timestamp="{timestamp}"
     data-signature="{signature}"
     data-default-folder="{default_folder}"
     data-environment="{environment}">

    <div class="cld-preview-wrapper" id="cld_preview_{field_id}" style="{preview_style}">
        <div class="cld-preview-card">
            <img src="{preview_url}" alt="Preview" class="cld-preview-img" id="cld_img_{field_id}">
            <div class="cld-asset-meta">
                <span class="cld-env-badge cld-env-{environment}">{environment.upper()}</span>
                <span class="cld-asset-name" id="cld_info_{field_id}">{info_text}</span>
                <button type="button" class="cld-remove-btn" onclick="window.cldClearAsset('{field_id}')">✕ Quitar</button>
            </div>
        </div>
    </div>

    <div class="cld-actions-toolbar">
        <button type="button" class="cld-browse-btn" onclick="window.cldOpenMediaLibrary('{field_id}')">
            <svg class="cld-cloud-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/>
            </svg>
            Explorar / Elegir desde Cloudinary
        </button>

        <span class="cld-separator">o subir archivo local:</span>

        <div class="cld-file-input-wrapper">
            {file_input_html}
        </div>
    </div>

    <input type="hidden" 
           name="{name}_cloudinary_asset" 
           id="{field_id}_cloudinary_asset" 
           value="{asset_value}">

    {clear_checkbox_html}
</div>

<script>
if (!window._cldInitialized) {{
    window._cldInitialized = true;
    window._cldSharedML = null;
    window._cldActiveFieldId = null;

    async function _cldGetFreshSignature() {{
        try {{
            const res = await fetch('/admin/cloudinary/signature/', {{
                headers: {{ 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }}
            }});
            return res.ok ? await res.json() : null;
        }} catch {{ return null; }}
    }}

    window.cldOpenMediaLibrary = async function(fieldId) {{
        window._cldActiveFieldId = fieldId;
        const container = document.getElementById('cld_container_' + fieldId);
        if (!container) return;

        const btn = container.querySelector('.cld-browse-btn');
        const origBtnText = btn ? btn.innerHTML : '';
        if (btn) {{
            btn.disabled = true;
            btn.style.opacity = '0.7';
        }}

        const restoreBtn = () => {{
            if (btn) {{
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.innerHTML = origBtnText;
            }}
        }};

        // Si el widget ya fue instanciado previamente, solo mostrarlo (Singleton reutilizable)
        if (window._cldSharedML) {{
            try {{
                const targetFolder = container.dataset.defaultFolder;
                window._cldSharedML.show({{
                    folder: targetFolder ? {{ path: targetFolder, resource_type: 'image' }} : undefined
                }});
                restoreBtn();
                return;
            }} catch (err) {{
                console.warn('Re-inicializando Media Library Widget...', err);
                window._cldSharedML = null;
            }}
        }}

        if (typeof cloudinary === 'undefined' || !cloudinary.createMediaLibrary) {{
            if (!document.getElementById('cld_sdk_script')) {{
                const s = document.createElement('script');
                s.id = 'cld_sdk_script';
                s.src = 'https://media-library.cloudinary.com/global/all.js';
                s.onload = () => {{
                    restoreBtn();
                    window.cldOpenMediaLibrary(fieldId);
                }};
                document.head.appendChild(s);
                return;
            }} else {{
                restoreBtn();
                alert('El componente de Cloudinary se está cargando. Intenta de nuevo en unos segundos.');
                return;
            }}
        }}

        let {{ cloudName, apiKey, defaultFolder }} = container.dataset;
        let timestamp = parseInt(container.dataset.timestamp, 10);
        let signature = container.dataset.signature;

        const now = Math.floor(Date.now() / 1000);
        if (!signature || !timestamp || (now - timestamp > 1800)) {{
            const fresh = await _cldGetFreshSignature();
            if (fresh) {{
                ({{ cloud_name: cloudName, api_key: apiKey, timestamp, signature, default_folder: defaultFolder }} = fresh);
                Object.assign(container.dataset, {{ cloudName, apiKey, timestamp, signature, defaultFolder }});
            }}
        }}

        try {{
            window._cldSharedML = cloudinary.createMediaLibrary({{
                cloud_name: cloudName,
                api_key: apiKey,
                timestamp: timestamp,
                signature: signature,
                default_folder: defaultFolder,
                multiple: false,
                max_files: 1
            }}, {{
                insertHandler: function(data) {{
                    const currentFieldId = window._cldActiveFieldId;
                    if (!currentFieldId || !data || !data.assets || !data.assets.length) return;

                    const asset = data.assets[0];
                    const ref = asset.format && !asset.public_id.endsWith('.' + asset.format) 
                        ? `${{asset.public_id}}.${{asset.format}}` 
                        : asset.public_id;

                    const hidden = document.getElementById(currentFieldId + '_cloudinary_asset');
                    const fileInput = document.getElementById(currentFieldId);
                    const previewWrapper = document.getElementById('cld_preview_' + currentFieldId);
                    const previewImg = document.getElementById('cld_img_' + currentFieldId);
                    const previewInfo = document.getElementById('cld_info_' + currentFieldId);
                    const clearCheckbox = document.getElementById(currentFieldId + '-clear_id');

                    if (hidden) hidden.value = ref;
                    if (fileInput) fileInput.value = '';
                    if (previewImg) previewImg.src = asset.secure_url;
                    if (previewInfo) previewInfo.textContent = ref;
                    if (previewWrapper) previewWrapper.style.display = 'flex';
                    if (clearCheckbox) clearCheckbox.checked = false;
                }}
            }});

            window._cldSharedML.show({{
                folder: defaultFolder ? {{ path: defaultFolder, resource_type: 'image' }} : undefined
            }});
        }} finally {{
            restoreBtn();
        }}
    }};

    window.cldClearAsset = function(fieldId) {{
        const hidden = document.getElementById(fieldId + '_cloudinary_asset');
        const previewWrapper = document.getElementById('cld_preview_' + fieldId);
        if (hidden) hidden.value = '';
        if (previewWrapper) previewWrapper.style.display = 'none';
        const clearCheckbox = document.getElementById(fieldId + '-clear_id');
        if (clearCheckbox) clearCheckbox.checked = true;
    }};
}}
</script>
"""
        return mark_safe(html)

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
