import React, { useState, useRef } from 'react';
import { Cloud, Upload, Trash2, Sparkles, Loader2, Link2, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

interface EventMediaFieldProps {
  label: string;
  helpText?: string;
  file: File | null;
  preview: string | null;
  valueUrl?: string | null;
  subfolder?: string;
  onFileChange: (file: File | null, preview: string | null) => void;
  onUrlChange: (url: string | null) => void;
}

declare global {
  interface Window {
    cloudinary?: any;
    _cldSharedML?: any;
  }
}

export const EventMediaField: React.FC<EventMediaFieldProps> = ({
  label,
  helpText,
  file,
  preview,
  valueUrl,
  subfolder = 'event_flyers',
  onFileChange,
  onUrlChange,
}) => {
  const [isOpeningCloudinary, setIsOpeningCloudinary] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualUrlInput, setManualUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getApiUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
  };

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // ─── 1. Abrir Cloudinary Media Library Modal ───
  const handleOpenMediaLibrary = async () => {
    setIsOpeningCloudinary(true);
    const toastId = toast.loading('Conectando con biblioteca de Cloudinary...');

    try {
      // 1. Obtener firma autenticada desde el backend
      const sigRes = await axios.get(
        `${getApiUrl()}/tickets/events/cloudinary-signature/?subfolder=${encodeURIComponent(subfolder)}`,
        { headers: getAuthHeaders() }
      );
      const sigData = sigRes.data;

      // 2. Asegurar que el SDK de Cloudinary esté cargado
      if (typeof window.cloudinary === 'undefined' || !window.cloudinary.createMediaLibrary) {
        await new Promise<void>((resolve, reject) => {
          if (document.getElementById('cld-ml-sdk-script')) {
            resolve();
            return;
          }
          const script = document.createElement('script');
          script.id = 'cld-ml-sdk-script';
          script.src = 'https://media-library.cloudinary.com/global/all.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('No se pudo cargar el script de Cloudinary'));
          document.head.appendChild(script);
        });
      }

      toast.dismiss(toastId);

      // 3. Configurar e instanciar widget singleton o nuevo
      const ml = window.cloudinary.createMediaLibrary(
        {
          cloud_name: sigData.cloud_name,
          api_key: sigData.api_key,
          timestamp: sigData.timestamp,
          signature: sigData.signature,
          default_folder: sigData.default_folder || `ms_ambar/staging/${subfolder}`,
          multiple: false,
          max_files: 1,
        },
        {
          insertHandler: (data: any) => {
            if (data && data.assets && data.assets.length > 0) {
              const asset = data.assets[0];
              const selectedUrl = asset.secure_url || asset.url;
              onUrlChange(selectedUrl);
              onFileChange(null, selectedUrl);
              toast.success('¡Imagen seleccionada desde Cloudinary!');
            }
          },
        }
      );

      ml.show({
        folder: sigData.default_folder ? { path: sigData.default_folder, resource_type: 'image' } : undefined,
      });
    } catch (err: any) {
      console.error('Error al inicializar Cloudinary Media Library:', err);
      toast.error(
        err.response?.data?.error || 'No se pudo abrir la biblioteca de Cloudinary. Verifica permisos de administrador.',
        { id: toastId }
      );
    } finally {
      setIsOpeningCloudinary(false);
    }
  };

  // ─── 2. Subir Archivo Local y Optimizar a WebP en el Servidor ───
  const handleLocalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Generar previsualización inmediata local
    const reader = new FileReader();
    reader.onloadend = () => {
      onFileChange(selected, reader.result as string);
    };
    reader.readAsDataURL(selected);

    // Intentar optimizar a WebP y subir a Cloudinary directamente
    setIsOptimizing(true);
    const toastId = toast.loading('Optimizando imagen a WebP y subiendo a Cloudinary...');

    try {
      const formData = new FormData();
      formData.append('files', selected);
      formData.append('quality', '82');
      formData.append('max_size', '1920');
      formData.append('to_webp', 'true');
      formData.append('save_to_gallery', 'false');
      formData.append('category', 'Eventos');

      const res = await axios.post(`${getApiUrl()}/gallery/items/optimize_images/`, formData, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'multipart/form-data',
        },
      });

      const results = res.data?.results || [];
      const successful = results.find((r: any) => r.status === 'success' && r.url);

      if (successful) {
        onUrlChange(successful.url);
        onFileChange(null, successful.url);
        const savedPercent = successful.reduction_percent || 0;
        toast.success(`¡Imagen optimizada a WebP con éxito! (${savedPercent}% más ligera)`, { id: toastId });
      } else {
        // Fallback: conservar archivo binario local para envío estándar multipart
        onFileChange(selected, preview);
        toast('Se usará el archivo local para subida directa estándar.', { id: toastId, icon: '📁' });
      }
    } catch (err) {
      console.warn('Fallo optimización en servidor, recurriendo a subida directa multipart:', err);
      // Fallback gracioso: mantener archivo binario
      toast('Optimizador no disponible; se enviará como archivo local directo.', { id: toastId, icon: 'ℹ️' });
    } finally {
      setIsOptimizing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─── 3. Agregar URL Manual / Cloudinary ───
  const handleApplyManualUrl = () => {
    const clean = manualUrlInput.trim();
    if (!clean) return;
    onUrlChange(clean);
    onFileChange(null, clean);
    setManualUrlInput('');
    setShowManualInput(false);
    toast.success('URL de imagen aplicada');
  };

  // ─── 4. Limpiar / Remover Medio ───
  const handleClear = () => {
    onFileChange(null, null);
    onUrlChange(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast('Imagen eliminada', { icon: '🗑️' });
  };

  const isCloudinaryAsset = Boolean(
    (valueUrl && valueUrl.includes('cloudinary.com')) ||
    (preview && preview.includes('cloudinary.com'))
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-honey block">
          {label}
        </label>
        {preview && (
          <span className={`text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
            isCloudinaryAsset
              ? 'bg-amber-honey/20 text-amber-honey border border-amber-honey/30'
              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          }`}>
            {isCloudinaryAsset ? 'Cloudinary' : 'Archivo Local'}
          </span>
        )}
      </div>

      {/* Tarjeta de Previsualización Activa */}
      {preview && (
        <div className="flex items-center gap-4 p-3 rounded-xl bg-black/60 border border-white/10 backdrop-blur-md transition-all hover:border-amber-honey/30">
          <div className="w-20 h-16 rounded-lg bg-black/80 border border-white/10 overflow-hidden shrink-0 relative flex items-center justify-center">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.currentTarget;
                target.onerror = null;
                target.src = '/images/placeholder-event.webp';
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white font-semibold truncate">
              {file ? file.name : (valueUrl || preview || 'Asset Seleccionado')}
            </p>
            <p className="text-[9px] text-[#F4F6F0]/40 truncate mt-0.5">
              {isCloudinaryAsset ? 'Hospedada en Cloudinary CDN' : (file ? `${(file.size / 1024).toFixed(1)} KB` : 'Referencia Activa')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-2 text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            title="Quitar imagen"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}

      {/* Barra de Acciones */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Botón Explorar Cloudinary */}
        <button
          type="button"
          onClick={handleOpenMediaLibrary}
          disabled={isOpeningCloudinary}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-600/80 to-amber-700/80 hover:from-amber-600 hover:to-amber-700 border border-amber-honey/30 shadow-md transition-all disabled:opacity-50"
        >
          {isOpeningCloudinary ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} className="text-amber-honey" />}
          <span>Elegir de Cloudinary</span>
        </button>

        {/* Botón Subir Archivo Local */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isOptimizing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white/90 bg-white/5 hover:bg-white/10 border border-white/10 transition-all disabled:opacity-50"
        >
          {isOptimizing ? <Loader2 size={14} className="animate-spin text-amber-honey" /> : <Upload size={14} className="text-amber-honey" />}
          <span>{isOptimizing ? 'Optimizando...' : 'Subir Archivo'}</span>
        </button>

        {/* Botón Toggle URL Manual */}
        <button
          type="button"
          onClick={() => setShowManualInput(!showManualInput)}
          className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-[#F4F6F0]/60 hover:text-white bg-transparent hover:bg-white/5 transition-all"
        >
          <Link2 size={13} />
          <span>Pegar URL</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/jpg"
          className="hidden"
          onChange={handleLocalFileSelect}
        />
      </div>

      {/* Input de URL Manual Expandible */}
      {showManualInput && (
        <div className="flex gap-2 items-center pt-1">
          <input
            type="url"
            placeholder="https://res.cloudinary.com/... o events/flyer.webp"
            value={manualUrlInput}
            onChange={(e) => setManualUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleApplyManualUrl();
              }
            }}
            className="flex-1 px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs outline-none focus:border-amber-honey"
          />
          <button
            type="button"
            onClick={handleApplyManualUrl}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-honey text-black hover:bg-amber-gold transition-colors"
          >
            Aplicar
          </button>
        </div>
      )}

      {helpText && (
        <p className="text-[8px] text-[#F4F6F0]/40 font-bold uppercase tracking-wider">
          {helpText}
        </p>
      )}
    </div>
  );
};
