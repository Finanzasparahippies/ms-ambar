/**
 * Cloudinary Media Library Widget Controller for Django Admin
 * Nectar Labs - ms-ambar Architecture
 */
(function() {
    'use strict';

    // Cache de instancias de widgets de Cloudinary
    window._cldWidgets = window._cldWidgets || {};

    /**
     * Obtiene una firma fresca desde el backend si la actual expiró
     */
    async function getFreshSignature() {
        try {
            const response = await fetch('/admin/cloudinary/signature/', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            if (!response.ok) {
                throw new Error('Fallo al obtener firma de Cloudinary (' + response.status + ')');
            }
            return await response.json();
        } catch (err) {
            console.error('Error refreshing Cloudinary signature:', err);
            return null;
        }
    }

    /**
     * Abre el modal interactivo de Cloudinary para un campo específico
     */
    window.cldOpenMediaLibrary = async function(fieldId) {
        const container = document.getElementById('cld_container_' + fieldId);
        if (!container) return;

        if (typeof cloudinary === 'undefined' || !cloudinary.createMediaLibrary) {
            alert('El SDK de Cloudinary Media Library no ha terminado de cargar. Por favor espera un momento.');
            return;
        }

        let cloudName = container.dataset.cloudName;
        let apiKey = container.dataset.apiKey;
        let timestamp = parseInt(container.dataset.timestamp, 10);
        let signature = container.dataset.signature;
        let defaultFolder = container.dataset.defaultFolder || 'ms_ambar/staging';

        const now = Math.floor(Date.now() / 1000);

        // Si la firma tiene más de 30 minutos o no está disponible, renovar vía endpoint
        if (!signature || !timestamp || (now - timestamp > 1800)) {
            const fresh = await getFreshSignature();
            if (fresh) {
                cloudName = fresh.cloud_name;
                apiKey = fresh.api_key;
                timestamp = fresh.timestamp;
                signature = fresh.signature;
                defaultFolder = fresh.default_folder;

                container.dataset.cloudName = cloudName;
                container.dataset.apiKey = apiKey;
                container.dataset.timestamp = timestamp;
                container.dataset.signature = signature;
                container.dataset.defaultFolder = defaultFolder;
            }
        }

        const widgetConfig = {
            cloud_name: cloudName,
            api_key: apiKey,
            timestamp: timestamp,
            signature: signature,
            default_folder: defaultFolder,
            multiple: false,
            max_files: 1
        };

        const callbacks = {
            insertHandler: function(data) {
                if (data && data.assets && data.assets.length > 0) {
                    const asset = data.assets[0];
                    const publicId = asset.public_id;
                    const format = asset.format || '';
                    const assetRef = (format && !publicId.endsWith('.' + format)) ? (publicId + '.' + format) : publicId;

                    // 1. Guardar referencia en el input hidden
                    const hiddenInput = document.getElementById(fieldId + '_cloudinary_asset');
                    if (hiddenInput) {
                        hiddenInput.value = assetRef;
                    }

                    // 2. Limpiar el input de archivo local para evitar conflictos
                    const fileInput = document.getElementById(fieldId);
                    if (fileInput) {
                        fileInput.value = '';
                    }

                    // 3. Desmarcar checkbox de clear si existe
                    const clearCheckbox = document.getElementById(fieldId + '-clear_id');
                    if (clearCheckbox) {
                        clearCheckbox.checked = false;
                    }

                    // 4. Actualizar visualización reactiva
                    const previewWrapper = document.getElementById('cld_preview_' + fieldId);
                    const previewImg = document.getElementById('cld_img_' + fieldId);
                    const previewInfo = document.getElementById('cld_info_' + fieldId);

                    if (previewImg) {
                        previewImg.src = asset.secure_url;
                    }
                    if (previewInfo) {
                        previewInfo.textContent = assetRef;
                    }
                    if (previewWrapper) {
                        previewWrapper.style.display = 'block';
                    }
                }
            }
        };

        try {
            const widget = cloudinary.createMediaLibrary(widgetConfig, callbacks);
            widget.show({
                folder: { path: defaultFolder, resource_type: 'image' }
            });
        } catch (err) {
            console.error('Error al inicializar Cloudinary Media Library:', err);
            alert('No se pudo abrir el Media Library de Cloudinary. Verifique la consola para más detalles.');
        }
    };

    /**
     * Limpia la selección activa de Cloudinary
     */
    window.cldClearAsset = function(fieldId) {
        const hiddenInput = document.getElementById(fieldId + '_cloudinary_asset');
        if (hiddenInput) {
            hiddenInput.value = '';
        }

        const previewWrapper = document.getElementById('cld_preview_' + fieldId);
        if (previewWrapper) {
            previewWrapper.style.display = 'none';
        }

        const clearCheckbox = document.getElementById(fieldId + '-clear_id');
        if (clearCheckbox) {
            clearCheckbox.checked = true;
        }
    };
})();
