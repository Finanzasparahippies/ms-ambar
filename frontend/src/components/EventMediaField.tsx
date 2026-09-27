import React, { useState, useRef, useEffect } from 'react';
import { Cloud, Upload, Trash2, Sparkles, Loader2, Link2, CheckCircle2, Image as ImageIcon, Search, X, ExternalLink, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

interface CloudinaryAssetItem {
  public_id: string;
  secure_url: string;
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
  created_at?: string;
}

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
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [assets, setAssets] = useState<CloudinaryAssetItem[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualUrlInput, setManualUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  const getApiUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
  };

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // ─── 1. Consultar Assets de Cloudinary ───
  const fetchCloudinaryAssets = async () => {
    setIsLoadingAssets(true);
    try {
      const res = await axios.get(`${getApiUrl()}/tickets/events/cloudinary-assets/`, {
        headers: getAuthHeaders(),
      });
      const items: CloudinaryAssetItem[] = res.data?.assets || [];
      setAssets(items);
    } catch (err: unknown) {
      console.error('Error consultando assets de Cloudinary:', err);
      let errorMsg = 'No se pudieron cargar los medios remotos.';
      if (axios.isAxiosError(err)) {
        errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message || errorMsg;
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }
      toast.error(errorMsg);
    } finally {
      setIsLoadingAssets(false);
    }
  };

  const handleOpenGalleryModal = () => {
    setIsGalleryModalOpen(true);
    fetchCloudinaryAssets();
  };

  const handleSelectAsset = (asset: CloudinaryAssetItem) => {
    const url = asset.secure_url;
    onUrlChange(url);
    onFileChange(null, url);
    setIsGalleryModalOpen(false);
    toast.success('¡Imagen seleccionada desde Cloudinary!');
  };

  // ─── 2. Subir Archivo Local y Optimizar a WebP en el Servidor ───
  const processAndUploadFile = async (selected: File) => {
    // Generar previsualización inmediata local
    const reader = new FileReader();
    reader.onloadend = () => {
      onFileChange(selected, reader.result as string);
    };
    reader.readAsDataURL(selected);

    setIsOptimizing(true);
    const toastId = toast.loading('Optimizando a WebP y subiendo a Cloudinary...');

    try {
      const formData = new FormData();
      formData.append('files', selected);
      formData.append('quality', '82');
      formData.append('max_size', '1920');
      formData.append('to_webp', 'true');
      formData.append('save_to_gallery', 'true');
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
        toast.success(`¡Optimizada a WebP con éxito! (${savedPercent}% más ligera)`, { id: toastId });
        if (isGalleryModalOpen) {
          fetchCloudinaryAssets();
        }
      } else {
        onFileChange(selected, preview);
        toast('Se usará el archivo local para subida estándar.', { id: toastId, icon: '📁' });
      }
    } catch (err: unknown) {
      console.warn('Fallo optimización en servidor, recurriendo a subida directa:', err);
      let detailMsg = 'Optimizador no disponible; se enviará como archivo local directo.';
      if (axios.isAxiosError(err) && err.response?.data) {
        detailMsg = err.response.data?.detail || err.response.data?.error || detailMsg;
      } else if (err instanceof Error) {
        detailMsg = `${detailMsg} (${err.message})`;
      }
      toast(detailMsg, { id: toastId, icon: 'ℹ️' });
    } finally {
      setIsOptimizing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (modalFileInputRef.current) modalFileInputRef.current.value = '';
    }
  };

  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processAndUploadFile(selected);
    }
  };

  // ─── 3. Agregar URL Manual ───
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

  const filteredAssets = assets.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return item.public_id.toLowerCase().includes(q) || item.secure_url.toLowerCase().includes(q);
  });

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
            {isCloudinaryAsset ? 'Cloudinary CDN' : 'Archivo Local'}
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
        {/* Botón Selector de Galería / Cloudinary */}
        <button
          type="button"
          onClick={handleOpenGalleryModal}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-600/90 to-amber-700/90 hover:from-amber-600 hover:to-amber-700 border border-amber-honey/40 shadow-md transition-all"
        >
          <Cloud size={14} className="text-amber-honey" />
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
          <span>{isOptimizing ? 'Optimizando...' : 'Subir y Optimizar'}</span>
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

      {/* ─── MODAL IN-APP: SELECTOR DE MEDIOS CLOUDINARY ─── */}
      {isGalleryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0f172a] border border-[#334155] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-honey/20 text-amber-honey border border-amber-honey/30">
                  <Cloud size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Biblioteca de Medios Cloudinary
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Selecciona cualquier flyer o imagen ya almacenada en tu nube de Cloudinary
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGalleryModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Toolbar */}
            <div className="p-4 border-b border-white/10 bg-slate-900/40 flex flex-wrap gap-3 items-center justify-between">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o public_id..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-black/50 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-honey"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchCloudinaryAssets}
                  disabled={isLoadingAssets}
                  className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                  title="Recargar medios"
                >
                  <RefreshCw size={13} className={isLoadingAssets ? 'animate-spin' : ''} />
                  <span>Actualizar</span>
                </button>

                <button
                  type="button"
                  onClick={() => modalFileInputRef.current?.click()}
                  disabled={isOptimizing}
                  className="px-3 py-2 bg-amber-honey text-black font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-amber-gold transition-colors"
                >
                  {isOptimizing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  <span>Subir Nueva</span>
                </button>
                <input
                  ref={modalFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  className="hidden"
                  onChange={handleLocalFileSelect}
                />

                <a
                  href="https://console.cloudinary.com/console/media_library/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-slate-400 hover:text-amber-honey text-xs flex items-center gap-1"
                  title="Abrir consola completa de Cloudinary"
                >
                  <ExternalLink size={13} />
                  <span className="hidden sm:inline">Consola</span>
                </a>
              </div>
            </div>

            {/* Modal Body: Assets Grid */}
            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
              {isLoadingAssets ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 size={28} className="animate-spin text-amber-honey" />
                  <p className="text-xs">Consultando Cloudinary API...</p>
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <ImageIcon size={32} className="mx-auto mb-2 text-slate-600" />
                  <p className="text-xs font-semibold">No se encontraron imágenes en Cloudinary.</p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Puedes usar el botón "Subir Nueva" para cargar y optimizar directamente.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredAssets.map((asset) => {
                    const isSelected = valueUrl === asset.secure_url || preview === asset.secure_url;
                    return (
                      <div
                        key={asset.public_id}
                        onClick={() => handleSelectAsset(asset)}
                        className={`group relative rounded-xl overflow-hidden border cursor-pointer transition-all bg-black/60 hover:scale-[1.02] ${
                          isSelected
                            ? 'border-amber-honey shadow-lg shadow-amber-honey/20 ring-2 ring-amber-honey'
                            : 'border-white/10 hover:border-amber-honey/60'
                        }`}
                      >
                        <div className="aspect-[4/3] w-full bg-slate-950 flex items-center justify-center overflow-hidden relative">
                          <img
                            src={asset.secure_url}
                            alt={asset.public_id}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.onerror = null;
                              target.src = '/images/placeholder-event.webp';
                            }}
                          />
                          {asset.format && (
                            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[8px] font-black uppercase rounded bg-black/70 text-amber-honey border border-white/10">
                              {asset.format}
                            </span>
                          )}
                          {isSelected && (
                            <div className="absolute inset-0 bg-amber-honey/20 flex items-center justify-center">
                              <CheckCircle2 size={24} className="text-amber-honey drop-shadow" />
                            </div>
                          )}
                        </div>

                        <div className="p-2 bg-slate-900/90 border-t border-white/5">
                          <p className="text-[10px] text-white font-medium truncate" title={asset.public_id}>
                            {asset.public_id.split('/').pop() || asset.public_id}
                          </p>
                          <div className="flex items-center justify-between text-[8px] text-slate-400 mt-0.5">
                            <span>
                              {asset.width && asset.height ? `${asset.width}x${asset.height}` : 'Cloud'}
                            </span>
                            {asset.bytes ? (
                              <span>{(asset.bytes / 1024).toFixed(0)} KB</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-white/10 bg-slate-900/60 flex items-center justify-between text-[10px] text-slate-400">
              <span>{filteredAssets.length} asset(s) cargado(s)</span>
              <button
                type="button"
                onClick={() => setIsGalleryModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
