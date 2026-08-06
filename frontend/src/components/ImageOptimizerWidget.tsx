import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
  Upload, 
  FolderUp, 
  Files, 
  FileImage, 
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  ArrowDownRight, 
  Trash2, 
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export interface ImageOptimizerResult {
  filename: string;
  status: 'success' | 'error';
  error?: string;
  original_size: number;
  optimized_size: number;
  saved_bytes: number;
  reduction_percent: number;
  url?: string;
  public_id?: string;
  gallery_item_id?: number;
}

export interface OptimizationMetrics {
  processed_count: number;
  total_files: number;
  total_original_bytes: number;
  total_optimized_bytes: number;
  total_saved_bytes: number;
  reduction_percent: number;
  results: ImageOptimizerResult[];
}

interface ImageOptimizerWidgetProps {
  onSuccess?: (metrics: OptimizationMetrics) => void;
  onCancel?: () => void;
  defaultCategory?: string;
}

type IngestionMode = 'single' | 'multiple' | 'folder';

export const ImageOptimizerWidget: React.FC<ImageOptimizerWidgetProps> = ({
  onSuccess,
  onCancel,
  defaultCategory = 'Optimizadas'
}) => {
  const [ingestionMode, setIngestionMode] = useState<IngestionMode>('multiple');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Configuration options
  const [quality, setQuality] = useState<number>(80);
  const [maxSize, setMaxSize] = useState<number>(1920);
  const [toWebP, setToWebP] = useState<boolean>(true);
  const [saveToGallery, setSaveToGallery] = useState<boolean>(true);
  const [category, setCategory] = useState<string>(defaultCategory);

  // Execution state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [metrics, setMetrics] = useState<OptimizationMetrics | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      if (ingestionMode === 'single') {
        setSelectedFiles([filesArray[0]]);
      } else {
        setSelectedFiles(prev => [...prev, ...filesArray]);
      }
    }
  };

  const handleFolderSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files).filter(file => 
        /\.(jpe?g|png|webp)$/i.test(file.name)
      );
      setSelectedFiles(filesArray);
      toast.success(`Se cargaron ${filesArray.length} imágenes de la carpeta.`);
    }
  };

  // Drag and drop handler with folder traversal support
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    const files: File[] = [];

    if (items) {
      const traverseFileTree = async (item: any) => {
        return new Promise<void>((resolve) => {
          if (item.isFile) {
            item.file((file: File) => {
              if (/\.(jpe?g|png|webp)$/i.test(file.name)) {
                files.push(file);
              }
              resolve();
            });
          } else if (item.isDirectory) {
            const dirReader = item.createReader();
            dirReader.readEntries(async (entries: any[]) => {
              for (const entry of entries) {
                await traverseFileTree(entry);
              }
              resolve();
            });
          } else {
            resolve();
          }
        });
      };

      const promises: Promise<void>[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry();
        if (item) {
          promises.push(traverseFileTree(item));
        }
      }
      await Promise.all(promises);
    } else {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (/\.(jpe?g|png|webp)$/i.test(file.name)) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      if (ingestionMode === 'single') {
        setSelectedFiles([files[0]]);
      } else {
        setSelectedFiles(prev => [...prev, ...files]);
      }
      toast.success(`${files.length} archivo(s) agregado(s).`);
    } else {
      toast.error('No se encontraron imágenes válidas (JPG, PNG, WebP).');
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setMetrics(null);
  };

  const handleProcessImages = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Por favor seleccione al menos una imagen.');
      return;
    }

    setIsProcessing(true);
    setUploadProgress(0);
    setMetrics(null);

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    formData.append('quality', quality.toString());
    formData.append('max_size', maxSize.toString());
    formData.append('to_webp', toWebP ? 'true' : 'false');
    formData.append('save_to_gallery', saveToGallery ? 'true' : 'false');
    formData.append('category', category);

    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'multipart/form-data',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await axios.post<OptimizationMetrics>(
        `${API_URL}/gallery/items/optimize_images/`,
        formData,
        {
          headers,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(pct);
            }
          }
        }
      );

      setMetrics(response.data);
      toast.success(`Optimización completada! ${response.data.processed_count} de ${response.data.total_files} procesadas.`);
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (err: any) {
      console.error('Error optimizando imágenes:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.files || 'Error al procesar las imágenes en el servidor.';
      toast.error(typeof errMsg === 'string' ? errMsg : 'Ocurrió un error en la optimización.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full bg-[#121218] border border-slate-700/60 rounded-[2.5rem] p-6 sm:p-8 text-slate-100 shadow-2xl space-y-6">
      {/* Header & Modes */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-widest text-xs mb-1">
            <Sparkles size={16} />
            <span>Motor de Optimización Ms Ambar</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white italic tracking-tight">
            Optimizar & <span className="text-amber-400">Comprimir Imágenes</span>
          </h2>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="self-end sm:self-center p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/50 hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Ingestion Mode Selector */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-[#181824] border border-slate-800 rounded-2xl">
        <button
          type="button"
          onClick={() => { setIngestionMode('single'); setSelectedFiles([]); }}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 ${
            ingestionMode === 'single'
              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <FileImage size={15} />
          <span className="hidden sm:inline">Archivo Único</span>
        </button>

        <button
          type="button"
          onClick={() => { setIngestionMode('multiple'); setSelectedFiles([]); }}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 ${
            ingestionMode === 'multiple'
              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Files size={15} />
          <span>Múltiple</span>
        </button>

        <button
          type="button"
          onClick={() => { setIngestionMode('folder'); setSelectedFiles([]); }}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 ${
            ingestionMode === 'folder'
              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <FolderUp size={15} />
          <span>Por Carpeta</span>
        </button>
      </div>

      {/* Configuration Controls Bar */}
      <div className="bg-[#181824] border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
          <Sliders size={14} className="text-amber-400" />
          <span>Parámetros de Compresión</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Quality Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold">
              <label className="text-slate-300">Calidad JPEG/WebP</label>
              <span className="text-amber-400 font-mono">{quality}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full accent-amber-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>

          {/* Max Size */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">Dimensión Máx.</label>
            <select
              value={maxSize}
              onChange={(e) => setMaxSize(Number(e.target.value))}
              className="w-full bg-[#121218] border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            >
              <option value={1920}>1920px (Full HD Standard)</option>
              <option value={1080}>1080px (Web Optimizado)</option>
              <option value={720}>720px (Móvil Rápido)</option>
              <option value={0}>Original (Sin redimensionar)</option>
            </select>
          </div>

          {/* WebP & Gallery Switches */}
          <div className="flex flex-col justify-center gap-2">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-300">
              <input
                type="checkbox"
                checked={toWebP}
                onChange={(e) => setToWebP(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-amber-400 focus:ring-amber-400 accent-amber-400"
              />
              <span>Convertir a WebP</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-300">
              <input
                type="checkbox"
                checked={saveToGallery}
                onChange={(e) => setSaveToGallery(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-amber-400 focus:ring-amber-400 accent-amber-400"
              />
              <span>Guardar en Galería</span>
            </label>
          </div>

          {/* Category Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">Categoría</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ej: Optimizadas"
              className="w-full bg-[#121218] border border-slate-700 text-white placeholder-slate-400 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
          </div>
        </div>
      </div>

      {/* Drag & Drop Ingestion Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (ingestionMode === 'folder') {
            folderInputRef.current?.click();
          } else {
            fileInputRef.current?.click();
          }
        }}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 bg-[#181824]/60 ${
          isDragging
            ? 'border-amber-400 bg-amber-400/10 scale-[1.01]'
            : 'border-slate-700 hover:border-amber-400/60 hover:bg-[#181824]'
        }`}
      >
        {/* Hidden inputs */}
        <input
          type="file"
          ref={fileInputRef}
          multiple={ingestionMode === 'multiple'}
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Directory input using webkitdirectory attribute */}
        <input
          type="file"
          ref={folderInputRef}
          // @ts-ignore
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFolderSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/10 text-amber-400 border border-amber-400/20 flex items-center justify-center">
            {ingestionMode === 'folder' ? <FolderUp size={28} /> : <Upload size={28} />}
          </div>

          <div>
            <p className="text-sm font-bold text-white">
              {ingestionMode === 'folder'
                ? 'Arrastra una Carpeta de imágenes o haz click para explorar'
                : ingestionMode === 'single'
                ? 'Arrastra 1 imagen o haz click para seleccionar'
                : 'Arrastra múltiples imágenes o haz click para seleccionar'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Soporta JPG, PNG y WebP • Límite por archivo: <span className="text-amber-400 font-bold">35MB</span>
            </p>
          </div>
        </div>
      </div>

      {/* Selected Files Queue & Summary */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Cola de Procesamiento ({selectedFiles.length} {selectedFiles.length === 1 ? 'archivo' : 'archivos'})
            </span>
            <button
              onClick={clearAllFiles}
              disabled={isProcessing}
              className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 hover:underline disabled:opacity-50"
            >
              <Trash2 size={13} />
              Limpiar cola
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {selectedFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center justify-between bg-[#181824] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200"
              >
                <div className="flex items-center gap-3 truncate pr-2">
                  <FileImage size={16} className="text-amber-400 shrink-0" />
                  <span className="truncate font-medium">{file.name}</span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-slate-400 font-mono text-[11px]">
                    {formatBytes(file.size)}
                  </span>
                  {!isProcessing && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload & Compression Progress */}
      {isProcessing && (
        <div className="bg-[#181824] border border-amber-400/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-amber-400">
            <span className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Procesando y comprimiendo con Pillow en servidor...
            </span>
            <span className="font-mono">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-400 h-full transition-all duration-200 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 italic text-center">
            Muestreo optimizado secuencial para preservar memoria en servidor (VPS 2GB RAM).
          </p>
        </div>
      )}

      {/* Metrics & Report Display */}
      {metrics && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-6 space-y-5"
        >
          <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-xs">
            <CheckCircle2 size={18} />
            <span>Resultado de la Optimización</span>
          </div>

          {/* Metrics summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#121218] border border-slate-800 rounded-xl p-3.5 text-center">
              <span className="block text-[10px] text-slate-400 font-bold uppercase">Procesadas</span>
              <span className="text-lg font-black text-white font-mono">{metrics.processed_count} / {metrics.total_files}</span>
            </div>

            <div className="bg-[#121218] border border-slate-800 rounded-xl p-3.5 text-center">
              <span className="block text-[10px] text-slate-400 font-bold uppercase">Tamaño Original</span>
              <span className="text-lg font-black text-white font-mono">{formatBytes(metrics.total_original_bytes)}</span>
            </div>

            <div className="bg-[#121218] border border-slate-800 rounded-xl p-3.5 text-center">
              <span className="block text-[10px] text-slate-400 font-bold uppercase">Tamaño Optimizado</span>
              <span className="text-lg font-black text-amber-400 font-mono">{formatBytes(metrics.total_optimized_bytes)}</span>
            </div>

            <div className="bg-[#121218] border border-emerald-500/30 rounded-xl p-3.5 text-center">
              <span className="block text-[10px] text-emerald-400 font-bold uppercase">Ahorro de Disco</span>
              <span className="text-lg font-black text-emerald-400 font-mono">-{metrics.reduction_percent}%</span>
            </div>
          </div>

          {/* Results list */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {metrics.results.map((res, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between border rounded-xl p-3 text-xs ${
                  res.status === 'success'
                    ? 'bg-[#121218] border-slate-800 text-slate-200'
                    : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate pr-2">
                  {res.status === 'success' ? (
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle size={15} className="text-rose-400 shrink-0" />
                  )}
                  <span className="truncate font-medium">{res.filename}</span>
                </div>

                {res.status === 'success' ? (
                  <div className="flex items-center gap-3 shrink-0 font-mono text-[11px]">
                    <span className="text-slate-400 line-through">{formatBytes(res.original_size)}</span>
                    <ArrowDownRight size={12} className="text-emerald-400" />
                    <span className="text-amber-400 font-bold">{formatBytes(res.optimized_size)}</span>
                    <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                      -{res.reduction_percent}%
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] text-rose-400 font-semibold truncate max-w-[200px]">
                    {res.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Primary Action Button */}
      <motion.button
        type="button"
        disabled={selectedFiles.length === 0 || isProcessing}
        onClick={handleProcessImages}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black uppercase tracking-wider py-4 rounded-2xl shadow-lg shadow-amber-400/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 text-xs flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Procesando Imágenes...</span>
          </>
        ) : (
          <>
            <Sparkles size={16} />
            <span>Optimizar y Procesar ({selectedFiles.length} Archivos)</span>
          </>
        )}
      </motion.button>
    </div>
  );
};

export default ImageOptimizerWidget;
