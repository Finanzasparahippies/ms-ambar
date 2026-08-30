import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Upload, Image as ImageIcon, Sparkles, Loader2, CheckCircle,
  Sliders, Star, Trash2, ChevronLeft, ChevronRight, Layers, FileText, DollarSign, Package
} from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Product, Category, ProductImage } from '../types';

interface OptimizationMetrics {
  originalSize: number;
  optimizedSize: number;
  reductionPercent: number;
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: Product | null;
  categories: Category[];
  onProductSaved: (savedProduct: Product, isNew: boolean) => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  editingProduct,
  categories,
  onProductSaved,
}) => {
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formStock, setFormStock] = useState('0');
  const [formCategoryId, setFormCategoryId] = useState<number | string>('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDetailedDescription, setFormDetailedDescription] = useState('');
  const [formMaterial, setFormMaterial] = useState('');
  const [formDimensions, setFormDimensions] = useState('');
  const [formWeight, setFormWeight] = useState('');
  const [formOrigin, setFormOrigin] = useState('');
  const [formCareInstructions, setFormCareInstructions] = useState('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formIsActive, setFormIsActive] = useState(true);
  const [manualImageUrl, setManualImageUrl] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isOptimizingImage, setIsOptimizingImage] = useState(false);
  const [optimizationStats, setOptimizationStats] = useState<OptimizationMetrics | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingProduct) {
      setFormName(editingProduct.name || '');
      setFormPrice(editingProduct.price ? String(editingProduct.price) : '');
      setFormStock(editingProduct.stock !== undefined ? String(editingProduct.stock) : '0');
      
      const catId = typeof editingProduct.category === 'object' && editingProduct.category !== null
        ? editingProduct.category.id
        : editingProduct.category;
      setFormCategoryId(catId || '');
      setNewCategoryName('');
      
      setFormDescription(editingProduct.description || '');
      setFormDetailedDescription(editingProduct.detailed_description || '');
      
      // Load flat fields or nested specifications
      const specs = editingProduct.specifications;
      setFormMaterial(editingProduct.material || specs?.material || '');
      setFormDimensions(editingProduct.dimensions || specs?.dimensions || '');
      setFormWeight(editingProduct.weight || specs?.weight || '');
      setFormOrigin(editingProduct.origin || specs?.origin || '');
      setFormCareInstructions(editingProduct.care_instructions || specs?.care_instructions || '');
      
      // Load images array
      let imgList: string[] = [];
      if (Array.isArray(editingProduct.images) && editingProduct.images.length > 0) {
        imgList = editingProduct.images.map((img) => (typeof img === 'string' ? img : img.image)).filter(Boolean);
      } else if (editingProduct.image) {
        imgList = [editingProduct.image];
      }
      setFormImages(imgList);
      setFormIsActive(editingProduct.is_active !== undefined ? editingProduct.is_active : true);
      setOptimizationStats(null);
      setManualImageUrl('');
    } else {
      setFormName('');
      setFormPrice('');
      setFormStock('10');
      setFormCategoryId(categories[0]?.id || '');
      setNewCategoryName('');
      setFormDescription('');
      setFormDetailedDescription('');
      setFormMaterial('');
      setFormDimensions('');
      setFormWeight('');
      setFormOrigin('Confeccionado en Hermosillo, Sonora');
      setFormCareInstructions('Lavar con agua fría, no usar blanqueador, secar a la sombra del revés.');
      setFormImages([]);
      setFormIsActive(true);
      setOptimizationStats(null);
      setManualImageUrl('');
    }
  }, [editingProduct, categories, isOpen]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleImageFilesSelected = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    setIsOptimizingImage(true);
    const toastId = toast.loading(`Optimizando ${fileArray.length} ${fileArray.length > 1 ? 'imágenes' : 'imagen'} a WebP...`);

    try {
      const formData = new FormData();
      fileArray.forEach(file => {
        formData.append('files', file);
      });
      formData.append('quality', '82');
      formData.append('max_size', '1600');
      formData.append('to_webp', 'true');
      formData.append('save_to_gallery', 'false');
      formData.append('category', 'Productos');

      const res = await api.post('/gallery/items/optimize_images/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const results = res.data?.results || [];
      const uploadedUrls: string[] = [];
      let totalOrig = 0;
      let totalOpt = 0;

      results.forEach((r: any) => {
        if (r.status === 'success' && r.url) {
          uploadedUrls.push(r.url);
          totalOrig += r.original_size || 0;
          totalOpt += r.optimized_size || 0;
        }
      });

      if (uploadedUrls.length > 0) {
        setFormImages(prev => [...prev, ...uploadedUrls]);
        const reduction = totalOrig > 0 ? Math.round(((totalOrig - totalOpt) / totalOrig) * 100) : 0;
        setOptimizationStats({
          originalSize: totalOrig,
          optimizedSize: totalOpt,
          reductionPercent: Math.max(0, reduction)
        });
        toast.success(`¡${uploadedUrls.length} ${uploadedUrls.length > 1 ? 'imágenes optimizadas' : 'imagen optimizada'} con éxito!`, { id: toastId });
      } else {
        toast.error('No se pudo procesar ningún archivo.', { id: toastId });
      }
    } catch (err) {
      console.error('Error optimizing image files batch', err);
      toast.error('Error al optimizar imágenes en el servidor', { id: toastId });
    } finally {
      setIsOptimizingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSetPrimaryImage = (index: number) => {
    if (index === 0 || index >= formImages.length) return;
    setFormImages(prev => {
      const copy = [...prev];
      const [selected] = copy.splice(index, 1);
      return [selected, ...copy];
    });
    toast.success('Imagen establecida como portada principal');
  };

  const handleRemoveImage = (index: number) => {
    setFormImages(prev => prev.filter((_, i) => i !== index));
    toast('Imagen eliminada de la lista', { icon: '🗑️' });
  };

  const handleMoveImage = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= formImages.length) return;
    setFormImages(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
  };

  const handleAddManualUrl = () => {
    if (!manualImageUrl.trim()) return;
    setFormImages(prev => [...prev, manualImageUrl.trim()]);
    setManualImageUrl('');
    toast.success('URL añadida a la galería');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPrice) {
      toast.error('Nombre y precio son obligatorios');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(editingProduct ? 'Actualizando producto...' : 'Creando producto...');

    try {
      let finalCategoryId = formCategoryId;

      // Create new category if specified
      if (newCategoryName.trim()) {
        const catRes = await api.post('/shop/categories/', { name: newCategoryName.trim() });
        finalCategoryId = catRes.data.id;
      }

      const payload = {
        name: formName.trim(),
        price: parseFloat(formPrice),
        stock: parseInt(formStock, 10) || 0,
        category: finalCategoryId || null,
        description: formDescription.trim(),
        detailed_description: formDetailedDescription.trim(),
        // Flat technical fields
        material: formMaterial.trim(),
        dimensions: formDimensions.trim(),
        weight: formWeight.trim(),
        origin: formOrigin.trim(),
        care_instructions: formCareInstructions.trim(),
        // Structured specifications object for full compatibility
        specifications: {
          material: formMaterial.trim(),
          dimensions: formDimensions.trim(),
          weight: formWeight.trim(),
          origin: formOrigin.trim(),
          care_instructions: formCareInstructions.trim()
        },
        image: formImages[0] || null,
        uploaded_images: formImages,
        is_active: formIsActive
      };

      let resProduct: Product;
      if (editingProduct) {
        const res = await api.patch(`/shop/products/${editingProduct.id}/`, payload);
        resProduct = res.data;
        toast.success('¡Producto actualizado exitosamente!', { id: toastId });
        onProductSaved(resProduct, false);
      } else {
        const res = await api.post('/shop/products/', payload);
        resProduct = res.data;
        toast.success('¡Producto creado exitosamente!', { id: toastId });
        onProductSaved(resProduct, true);
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving product', err);
      const errMsg = err.response?.data?.detail || err.response?.data?.name?.[0] || 'Error al guardar el producto.';
      toast.error(errMsg, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-3xl bg-[#0a0f0d] border border-amber-honey/30 rounded-[2rem] shadow-2xl p-6 sm:p-8 max-h-[92vh] overflow-y-auto text-white z-10 custom-scrollbar"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div>
                <span className="text-[10px] text-amber-honey font-black uppercase tracking-[0.25em] flex items-center gap-1.5">
                  <Package size={13} /> {editingProduct ? 'Administración' : 'Nuevo Producto'}
                </span>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
                  {editingProduct ? 'Editar Producto' : 'Crear Nuevo Producto'}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/[0.08] hover:bg-red-500/20 text-white/70 hover:text-red-400 border border-white/15 flex items-center justify-center transition-all"
                aria-label="Cerrar modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Sección 1: Información Comercial Básica */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-honey border-b border-white/5 pb-2">
                  <FileText size={15} /> 1. Datos Comerciales
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/80 uppercase font-black tracking-widest block">
                    Nombre del Producto *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ej: Hoodie Ms Ambar Black Onyx"
                    className="w-full bg-white/[0.04] border border-white/15 focus:border-amber-honey rounded-xl px-4 py-3 text-xs outline-none text-white placeholder-white/30 font-medium transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-white/80 uppercase font-black tracking-widest block">
                      Precio (MXN) *
                    </label>
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-honey" />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formPrice}
                        onChange={(e) => setFormPrice(e.target.value)}
                        placeholder="1200.00"
                        className="w-full bg-white/[0.04] border border-white/15 focus:border-amber-honey rounded-xl pl-9 pr-4 py-3 text-xs outline-none text-white font-mono font-bold transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-white/80 uppercase font-black tracking-widest block">
                      Stock Disponible *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formStock}
                      onChange={(e) => setFormStock(e.target.value)}
                      placeholder="10"
                      className="w-full bg-white/[0.04] border border-white/15 focus:border-amber-honey rounded-xl px-4 py-3 text-xs outline-none text-white font-mono font-bold transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-white/80 uppercase font-black tracking-widest block">
                      Categoría *
                    </label>
                    <select
                      value={formCategoryId}
                      onChange={(e) => setFormCategoryId(e.target.value)}
                      className="w-full bg-[#141a17] border border-white/15 focus:border-amber-honey rounded-xl px-3 py-3 text-xs outline-none text-white transition-all"
                    >
                      <option value="">Seleccionar Categoría</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/60 uppercase font-bold tracking-widest block">
                    ¿O crear nueva categoría? (Opcional)
                  </label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Ej: Accesorios, Coleccionables"
                    className="w-full bg-white/[0.03] border border-white/15 focus:border-amber-honey rounded-xl px-4 py-2.5 text-xs outline-none text-white placeholder-white/30 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/80 uppercase font-black tracking-widest block">
                    Descripción Corta del Producto *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Resumen del producto, corte, materiales o detalles de arte..."
                    className="w-full bg-white/[0.04] border border-white/15 focus:border-amber-honey rounded-xl px-4 py-3 text-xs outline-none text-white placeholder-white/30 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-amber-honey uppercase font-black tracking-widest block">
                    Descripción Detallada / Ficha Extendida
                  </label>
                  <textarea
                    rows={3}
                    value={formDetailedDescription}
                    onChange={(e) => setFormDetailedDescription(e.target.value)}
                    placeholder="Detalles sobre confección, acabados, historia de la prenda o proceso artesanal..."
                    className="w-full bg-white/[0.04] border border-white/15 focus:border-amber-honey rounded-xl px-4 py-3 text-xs outline-none text-white placeholder-white/30 transition-all"
                  />
                </div>
              </div>

              {/* Sección 2: Especificaciones Técnicas Estructuradas */}
              <div className="space-y-4 bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <label className="text-xs text-amber-honey uppercase font-black tracking-widest flex items-center gap-1.5">
                    <Sliders size={15} /> 2. Ficha Técnica / Especificaciones
                  </label>
                  <span className="text-[9px] font-mono text-white/40 uppercase">Campos Planos & Filtrables</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/70 uppercase tracking-widest font-bold block">
                      Material / Composición
                    </label>
                    <input
                      type="text"
                      value={formMaterial}
                      onChange={(e) => setFormMaterial(e.target.value)}
                      placeholder="Ej: 80% Algodón Peinado, 20% Poliéster (380 GSM)"
                      className="w-full bg-white/[0.03] border border-white/15 focus:border-amber-honey rounded-xl px-3 py-2 text-xs outline-none text-white placeholder-white/30 transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-white/70 uppercase tracking-widest font-bold block">
                      Dimensiones / Tallas
                    </label>
                    <input
                      type="text"
                      value={formDimensions}
                      onChange={(e) => setFormDimensions(e.target.value)}
                      placeholder="Ej: Corte Oversize Unisex (S, M, L, XL)"
                      className="w-full bg-white/[0.03] border border-white/15 focus:border-amber-honey rounded-xl px-3 py-2 text-xs outline-none text-white placeholder-white/30 transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-white/70 uppercase tracking-widest font-bold block">
                      Peso Estimado
                    </label>
                    <input
                      type="text"
                      value={formWeight}
                      onChange={(e) => setFormWeight(e.target.value)}
                      placeholder="Ej: 680 g / 180g Vinilo"
                      className="w-full bg-white/[0.03] border border-white/15 focus:border-amber-honey rounded-xl px-3 py-2 text-xs outline-none text-white placeholder-white/30 transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-white/70 uppercase tracking-widest font-bold block">
                      Origen / Fabricación
                    </label>
                    <input
                      type="text"
                      value={formOrigin}
                      onChange={(e) => setFormOrigin(e.target.value)}
                      placeholder="Ej: Confeccionado en Hermosillo, Sonora"
                      className="w-full bg-white/[0.03] border border-white/15 focus:border-amber-honey rounded-xl px-3 py-2 text-xs outline-none text-white placeholder-white/30 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-[10px] text-white/70 uppercase tracking-widest font-bold block">
                    Instrucciones de Cuidado
                  </label>
                  <input
                    type="text"
                    value={formCareInstructions}
                    onChange={(e) => setFormCareInstructions(e.target.value)}
                    placeholder="Ej: Lavar con agua fría, no usar blanqueador, secar a la sombra del revés."
                    className="w-full bg-white/[0.03] border border-white/15 focus:border-amber-honey rounded-xl px-3 py-2 text-xs outline-none text-white placeholder-white/30 transition-all"
                  />
                </div>
              </div>

              {/* Sección 3: Galería de Múltiples Imágenes & Optimización */}
              <div className="space-y-4 bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <label className="text-xs text-amber-honey uppercase font-black tracking-widest flex items-center gap-1.5">
                    <ImageIcon size={15} /> 3. Galería de Imágenes ({formImages.length})
                  </label>
                  <span className="text-[9px] font-mono text-white/40 uppercase">Pillow WebP • Múltiples Fotos</span>
                </div>

                {/* Dropzone interactiva */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingOver(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleImageFilesSelected(e.dataTransfer.files);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                    isDraggingOver
                      ? 'border-amber-honey bg-amber-honey/15 scale-[1.01]'
                      : 'border-white/20 hover:border-amber-honey/70 bg-black/40 hover:bg-black/60'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleImageFilesSelected(e.target.files);
                      }
                    }}
                    className="hidden"
                  />

                  {isOptimizingImage ? (
                    <div className="flex flex-col items-center py-2 gap-2 text-amber-honey">
                      <Loader2 size={24} className="animate-spin" />
                      <span className="text-xs font-bold">Procesando y optimizando lote a WebP...</span>
                    </div>
                  ) : (
                    <>
                      <Upload size={24} className="text-amber-honey" />
                      <p className="text-xs font-bold text-white">
                        Arrastra imágenes o haz clic para subir y optimizar
                      </p>
                      <p className="text-[10px] text-white/50">
                        Formatos admitidos: JPG, PNG, WebP (Se alojarán en Cloudinary)
                      </p>
                    </>
                  )}
                </div>

                {/* Estadísticas de Optimización */}
                {optimizationStats && (
                  <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-4 py-2.5 text-xs text-emerald-400">
                    <span className="flex items-center gap-1.5 font-bold">
                      <CheckCircle size={14} /> Lote optimizado con éxito
                    </span>
                    <span className="font-mono text-[11px]">
                      {formatBytes(optimizationStats.originalSize)} ➔ {formatBytes(optimizationStats.optimizedSize)}{' '}
                      <strong className="text-white">(-{optimizationStats.reductionPercent}%)</strong>
                    </span>
                  </div>
                )}

                {/* Lista de Miniaturas (Thumbnails) */}
                {formImages.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <span className="text-[9px] uppercase tracking-widest text-white/60 font-bold block">
                      Fotos en la galería (La #1 es la foto de Portada):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {formImages.map((imgUrl, imgIdx) => (
                        <div
                          key={`${imgUrl}-${imgIdx}`}
                          className={`group relative rounded-xl overflow-hidden border bg-black/70 transition-all ${
                            imgIdx === 0
                              ? 'border-amber-honey ring-2 ring-amber-honey/40'
                              : 'border-white/15 hover:border-white/40'
                          }`}
                        >
                          <div className="aspect-square w-full">
                            <img
                              src={imgUrl}
                              alt={`Foto ${imgIdx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          {/* Badge de Portada / Posición */}
                          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 z-10">
                            {imgIdx === 0 ? (
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-honey text-black text-[8px] font-black uppercase tracking-wider shadow-md flex items-center gap-1">
                                <Star size={9} className="fill-current" /> Portada
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-white/80 text-[8px] font-bold">
                                #{imgIdx + 1}
                              </span>
                            )}
                          </div>

                          {/* Botón Eliminar */}
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(imgIdx)}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/80 hover:bg-red-600 text-white/80 hover:text-white border border-white/20 flex items-center justify-center transition-all opacity-90 sm:opacity-0 group-hover:opacity-100 z-10"
                            title="Eliminar de la galería"
                          >
                            <Trash2 size={11} />
                          </button>

                          {/* Barra de Reordenamiento y Portada */}
                          <div className="p-1.5 bg-black/90 border-t border-white/10 flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={imgIdx === 0}
                                onClick={() => handleMoveImage(imgIdx, imgIdx - 1)}
                                className="w-5 h-5 rounded bg-white/10 hover:bg-white/25 disabled:opacity-20 flex items-center justify-center text-white transition-all"
                                title="Mover a la izquierda"
                              >
                                <ChevronLeft size={12} />
                              </button>
                              <button
                                type="button"
                                disabled={imgIdx === formImages.length - 1}
                                onClick={() => handleMoveImage(imgIdx, imgIdx + 1)}
                                className="w-5 h-5 rounded bg-white/10 hover:bg-white/25 disabled:opacity-20 flex items-center justify-center text-white transition-all"
                                title="Mover a la derecha"
                              >
                                <ChevronRight size={12} />
                              </button>
                            </div>

                            {imgIdx !== 0 && (
                              <button
                                type="button"
                                onClick={() => handleSetPrimaryImage(imgIdx)}
                                className="text-[9px] text-amber-honey hover:text-amber-300 font-black flex items-center gap-0.5"
                              >
                                <Star size={10} /> Portada
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Añadir imagen por URL manual */}
                <div className="pt-2">
                  <label className="text-[9px] text-white/50 uppercase tracking-widest font-bold block mb-1">
                    O agregar por URL directa:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={manualImageUrl}
                      onChange={(e) => setManualImageUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/... o URL de Cloudinary"
                      className="flex-1 bg-white/[0.04] border border-white/15 focus:border-amber-honey rounded-xl px-3 py-2 text-xs outline-none text-white font-mono text-[11px] placeholder-white/30 transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualUrl}
                      className="px-4 py-2 bg-amber-honey text-black hover:bg-amber-400 font-black rounded-xl text-xs transition-all shrink-0 border border-amber-honey/50 shadow-md flex items-center gap-1"
                    >
                      + Agregar
                    </button>
                  </div>
                </div>
              </div>

              {/* Botones de Acción / Submit */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-white/20 bg-white/[0.08] hover:bg-white/[0.18] text-white text-xs font-black uppercase tracking-wider transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isOptimizingImage}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-honey to-amber-500 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-black uppercase tracking-wider shadow-xl shadow-amber-honey/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>{editingProduct ? 'Guardar Cambios' : 'Crear Producto'}</span>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ProductFormModal;
