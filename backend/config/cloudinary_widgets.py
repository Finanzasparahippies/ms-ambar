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

        # Determinar URL inicial de previsualización jerárquica y defensiva
        preview_url = ''
        cloud_name = sig_data.get('cloud_name') or getattr(settings, 'CLOUDINARY_STORAGE', {}).get('CLOUD_NAME', '')
        default_folder = sig_data.get('default_folder', 'ms_ambar/staging')
        prefix = getattr(settings, 'CLOUDINARY_STORAGE', {}).get('PREFIX', f"{default_folder}/")

        if value:
            # 1. Si value tiene atributo .url (ej. FieldFile), intentar resolverlo
            try:
                url_candidate = value.url if hasattr(value, 'url') else None
                if url_candidate and (url_candidate.startswith('http://') or url_candidate.startswith('https://')):
                    preview_url = url_candidate
            except (ValueError, AttributeError):
                pass
            except Exception as e:
                import logging
                logging.getLogger('config.cloudinary').debug(f"Error al evaluar value.url en widget: {e}")

            # 2. Si no se resolvió con .url, procesar el valor como string
            if not preview_url:
                val_str = getattr(value, 'name', None) or str(value)
                if isinstance(val_str, str) and val_str.strip():
                    val_str = val_str.strip()
                    if val_str.startswith('http://') or val_str.startswith('https://'):
                        preview_url = val_str
                    elif 'https://res.cloudinary.com' in val_str or 'http://res.cloudinary.com' in val_str:
                        parts = val_str.split('https://res.cloudinary.com')
                        preview_url = f"https://res.cloudinary.com{parts[-1]}"
                    else:
                        clean_path = val_str.lstrip('/')
                        if not clean_path.startswith(prefix) and not clean_path.startswith('ms_ambar/') and not clean_path.startswith('ms-ambar/'):
                            clean_path = f"{prefix}{clean_path}"
                        if cloud_name:
                            preview_url = f"https://res.cloudinary.com/{cloud_name}/image/upload/{clean_path}"

            # 3. Limpiar duplicaciones de prefijos (ej. /ms_ambar/prod/ms-ambar/)
            if preview_url:
                preview_url = preview_url.replace('/ms_ambar/prod/ms-ambar/', '/ms-ambar/').replace('/ms_ambar/staging/ms-ambar/', '/ms-ambar/')

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
            <img src="{preview_url}" alt="Preview" class="cld-preview-img" id="cld_img_{field_id}" onerror="this.onerror=null; this.src='/static/images/placeholder-event.webp';">
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
            if (!res.ok) {{
                console.error('[CloudinaryWidget] Error HTTP al obtener firma:', res.status, res.statusText);
                return null;
            }}
            return await res.json();
        }} catch (fetchErr) {{
            console.error('[CloudinaryWidget] Error de red al solicitar firma:', fetchErr);
            return null;
        }}
    }}

    window.cldOpenMediaLibrary = async function(fieldId) {{
        window._cldActiveFieldId = fieldId;
        const container = document.getElementById('cld_container_' + fieldId);
        if (!container) return;

        let modal = document.getElementById('cld_inpage_modal');
        if (!modal) {{
            modal = document.createElement('div');
            modal.id = 'cld_inpage_modal';
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.8);z-index:999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
            modal.innerHTML = `
                <div style="background:#0f172a;border:1px solid #334155;border-radius:14px;width:92%;max-width:880px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 25px 50px -12px rgba(0,0,0,0.6);overflow:hidden;color:#fff;font-family:system-ui,-apple-system,sans-serif;">
                    <div style="display:flex;align-items:center;justify-content:between;padding:14px 18px;border-bottom:1px solid #1e293b;background:#1e293b;">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <span style="font-size:18px;">☁️</span>
                            <div>
                                <h3 style="margin:0;font-size:14px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#f8fafc;">Biblioteca de Medios Cloudinary</h3>
                                <p style="margin:0;font-size:11px;color:#94a3b8;">Selecciona cualquier imagen existente en tu nube de Cloudinary</p>
                            </div>
                        </div>
                        <button type="button" id="cld_modal_close_btn" style="background:transparent;border:none;color:#94a3b8;font-size:20px;cursor:pointer;padding:4px 8px;border-radius:6px;line-height:1;">✕</button>
                    </div>

                    <div style="padding:12px 18px;border-bottom:1px solid #1e293b;background:#090d16;display:flex;gap:10px;align-items:center;">
                        <input type="text" id="cld_modal_search" placeholder="Buscar por nombre o ID..." style="flex:1;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:8px 12px;font-size:12px;color:#fff;outline:none;" />
                        <a href="https://console.cloudinary.com/console/media_library/" target="_blank" style="padding:6px 12px;border:1px solid #475569;border-radius:8px;color:#cbd5e1;text-decoration:none;font-size:11px;display:flex;align-items:center;gap:4px;">↗ Consola Cloudinary</a>
                    </div>

                    <div id="cld_modal_grid" style="flex:1;overflow-y:auto;padding:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;background:#0f172a;min-height:260px;">
                        <div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8;font-size:12px;">Cargando imágenes de Cloudinary...</div>
                    </div>

                    <div style="padding:10px 18px;border-top:1px solid #1e293b;background:#1e293b;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#94a3b8;">
                        <span id="cld_modal_count">0 imágenes</span>
                        <button type="button" id="cld_modal_cancel_btn" style="background:#334155;border:none;color:#fff;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;">Cerrar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('cld_modal_close_btn').onclick = () => {{ modal.style.display = 'none'; }};
            document.getElementById('cld_modal_cancel_btn').onclick = () => {{ modal.style.display = 'none'; }};
            modal.onclick = (e) => {{ if (e.target === modal) modal.style.display = 'none'; }};
        }}

        modal.style.display = 'flex';
        const grid = document.getElementById('cld_modal_grid');
        const count = document.getElementById('cld_modal_count');
        const searchInput = document.getElementById('cld_modal_search');
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8;font-size:12px;">Cargando imágenes de Cloudinary...</div>';
        searchInput.value = '';

        try {{
            const res = await fetch('/admin/cloudinary/assets/');
            const data = res.ok ? await res.json() : {{ assets: [] }};
            const assets = data.assets || [];

            function renderAssets(list) {{
                if (!list.length) {{
                    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8;font-size:12px;">No se encontraron imágenes en Cloudinary.</div>';
                    count.textContent = '0 imágenes';
                    return;
                }}
                count.textContent = list.length + ' imágenes encontradas';
                grid.innerHTML = list.map(item => `
                    <div class="cld-asset-item" data-ref="${{item.public_id}}" data-url="${{item.secure_url}}" style="background:#1e293b;border:1px solid #334155;border-radius:8px;overflow:hidden;cursor:pointer;transition:all 0.2s;display:flex;flex-direction:column;">
                        <div style="width:100%;height:100px;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;">
                            <img src="${{item.secure_url}}" style="width:100%;height:100%;object-fit:cover;" onerror="this.onerror=null;this.src='/static/images/placeholder-event.webp';" />
                            <span style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.7);color:#fbbf24;font-size:9px;font-weight:700;padding:2px 4px;border-radius:3px;">${{(item.format||'img').toUpperCase()}}</span>
                        </div>
                        <div style="padding:8px;font-size:10px;color:#cbd5e1;overflow:hidden;">
                            <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;" title="${{item.public_id}}">${{item.public_id.split('/').pop()}}</div>
                            <div style="display:flex;justify-content:space-between;color:#64748b;margin-top:4px;font-size:9px;">
                                <span>${{item.width && item.height ? item.width + 'x' + item.height : 'Cloud'}}</span>
                                <span>${{item.bytes ? Math.round(item.bytes/1024) + ' KB' : ''}}</span>
                            </div>
                        </div>
                    </div>
                `).join('');

                grid.querySelectorAll('.cld-asset-item').forEach(el => {{
                    el.onmouseover = () => {{ el.style.borderColor = '#fbbf24'; el.style.transform = 'translateY(-2px)'; }};
                    el.onmouseout = () => {{ el.style.borderColor = '#334155'; el.style.transform = 'none'; }};
                    el.onclick = () => {{
                        const ref = el.dataset.ref;
                        const url = el.dataset.url;
                        const activeId = window._cldActiveFieldId;
                        if (!activeId) return;

                        const hidden = document.getElementById(activeId + '_cloudinary_asset');
                        const fileInput = document.getElementById(activeId);
                        const previewWrapper = document.getElementById('cld_preview_' + activeId);
                        const previewImg = document.getElementById('cld_img_' + activeId);
                        const previewInfo = document.getElementById('cld_info_' + activeId);
                        const clearCheckbox = document.getElementById(activeId + '-clear_id');

                        if (hidden) hidden.value = ref;
                        if (fileInput) fileInput.value = '';
                        if (previewImg) previewImg.src = url;
                        if (previewInfo) previewInfo.textContent = ref;
                        if (previewWrapper) previewWrapper.style.display = 'flex';
                        if (clearCheckbox) clearCheckbox.checked = false;

                        modal.style.display = 'none';
                    }};
                }});
            }}

            renderAssets(assets);

            searchInput.oninput = (e) => {{
                const q = e.target.value.toLowerCase().trim();
                const filtered = assets.filter(a => a.public_id.toLowerCase().includes(q) || a.secure_url.toLowerCase().includes(q));
                renderAssets(filtered);
            }};
        }} catch (err) {{
            console.error('Error al cargar assets de Cloudinary:', err);
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#f87171;font-size:12px;">Error al conectar con la API de Cloudinary.</div>';
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
