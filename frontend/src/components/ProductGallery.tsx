import React, { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight, ImageOff, Sparkles } from 'lucide-react';

export interface ProductGalleryProps {
  images?: (string | { image?: string; url?: string })[];
  productName: string;
  priority?: boolean;
  aspectRatio?: string; // e.g. 'aspect-[4/5]' or 'aspect-square'
  showThumbnails?: boolean;
  className?: string;
  onImageChange?: (index: number) => void;
  children?: React.ReactNode;
}

/**
 * Inserta transformaciones automáticas de Cloudinary (formato óptimo, compresión inteligente y ancho)
 * sin romper URLs externas (Unsplash, etc.) ni duplicar transformaciones.
 */
export function getOptimizedCloudinaryUrl(url: string, width = 800): string {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    if (url.includes('/upload/f_auto') || url.includes('/upload/w_')) {
      return url;
    }
    return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_limit/`);
  }
  return url;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: 'spring', stiffness: 350, damping: 30 },
      opacity: { duration: 0.25 },
    },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0.98,
    transition: {
      x: { type: 'spring', stiffness: 350, damping: 30 },
      opacity: { duration: 0.2 },
    },
  }),
};

export const ProductGallery: React.FC<ProductGalleryProps> = ({
  images = [],
  productName,
  priority = false,
  aspectRatio = 'aspect-[4/5]',
  showThumbnails = true,
  className = '',
  onImageChange,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [direction, setDirection] = useState<number>(0);
  const [erroredUrls, setErroredUrls] = useState<Record<string, boolean>>({});

  // Normalizar array de imágenes a strings limpios
  const validImages: string[] = useMemo(() => {
    if (!images || images.length === 0) return [];
    return images
      .map((item) => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        return item.image || item.url || '';
      })
      .filter((url): url is string => Boolean(url && typeof url === 'string' && url.trim().length > 0));
  }, [images]);

  const total = validImages.length;
  const currentUrl = validImages[currentIndex] || '';
  const isCurrentErrored = Boolean(erroredUrls[currentUrl]);

  const paginate = useCallback(
    (newDirection: number) => {
      if (total <= 1) return;
      setDirection(newDirection);
      setCurrentIndex((prev) => {
        const nextIndex = (prev + newDirection + total) % total;
        onImageChange?.(nextIndex);
        return nextIndex;
      });
    },
    [total, onImageChange]
  );

  const goToSlide = useCallback(
    (targetIndex: number) => {
      if (targetIndex === currentIndex || targetIndex < 0 || targetIndex >= total) return;
      setDirection(targetIndex > currentIndex ? 1 : -1);
      setCurrentIndex(targetIndex);
      onImageChange?.(targetIndex);
    },
    [currentIndex, total, onImageChange]
  );

  // Manejador del gesto táctil de deslizamiento (Swipe)
  const handleDragEnd = (
    _e: MouseEvent | TouchEvent | PointerEvent,
    { offset, velocity }: PanInfo
  ) => {
    const swipeConfidenceThreshold = 10000;
    const swipePower = Math.abs(offset.x) * velocity.x;

    if (swipePower < -swipeConfidenceThreshold || offset.x < -60) {
      paginate(1);
    } else if (swipePower > swipeConfidenceThreshold || offset.x > 60) {
      paginate(-1);
    }
  };

  const handleImageError = (failedUrl: string) => {
    setErroredUrls((prev) => ({ ...prev, [failedUrl]: true }));
  };

  return (
    <div className={`flex flex-col gap-3 w-full select-none ${className}`}>
      {/* Contenedor Principal con Gesto Táctil Swipe */}
      <div
        className={`relative w-full ${aspectRatio} rounded-[1.5rem] overflow-hidden bg-gradient-to-b from-[#140c1f] via-[#090b0a] to-[#050706] border border-white/[0.08] shadow-2xl group/gallery`}
      >
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            drag={total > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing flex items-center justify-center"
          >
            {currentUrl && !isCurrentErrored ? (
              <Image
                src={getOptimizedCloudinaryUrl(currentUrl, 900)}
                alt={`${productName} - Vista ${currentIndex + 1}`}
                fill
                priority={currentIndex === 0 && priority}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover w-full h-full pointer-events-none transition-transform duration-700 ease-out group-hover/gallery:scale-105"
                onError={() => handleImageError(currentUrl)}
                draggable={false}
              />
            ) : (
              /* Fallback SVG elegante cuando no hay imagen o falla la red */
              <div className="flex flex-col items-center justify-center p-6 text-center text-neutral-400 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-purple-950/40 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-inner">
                  <ImageOff size={28} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-wider text-purple-300">
                    Ms. Ámbar Oficial
                  </p>
                  <p className="text-[11px] text-neutral-400 font-light">
                    {productName || 'Visual no disponible'}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Gradiente sutil inferior para legibilidad de controles */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none z-10" />

        {/* Contador Dinámico Móvil (1 / N) */}
        {total > 1 && (
          <div className="absolute top-3.5 right-3.5 z-20 pointer-events-none">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest bg-black/70 backdrop-blur-md border border-white/10 text-neutral-200 shadow-lg">
              {currentIndex + 1} / {total}
            </span>
          </div>
        )}

        {/* Flechas de Navegación (Visibles en hover en desktop, táctiles en tablet) */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                paginate(-1);
              }}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/70 hover:bg-purple-600 text-white border border-white/20 flex items-center justify-center transition-all opacity-0 group-hover/gallery:opacity-100 z-20 backdrop-blur-md shadow-xl active:scale-95"
              aria-label="Foto anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                paginate(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/70 hover:bg-purple-600 text-white border border-white/20 flex items-center justify-center transition-all opacity-0 group-hover/gallery:opacity-100 z-20 backdrop-blur-md shadow-xl active:scale-95"
              aria-label="Siguiente foto"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* Paginación por Puntos (Dots Interactivos) */}
        {total > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5 z-20">
            {validImages.map((_, dotIdx) => (
              <button
                key={dotIdx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToSlide(dotIdx);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  dotIdx === currentIndex
                    ? 'w-6 bg-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.9)]'
                    : 'w-1.5 bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Ir a foto ${dotIdx + 1}`}
              />
            ))}
          </div>
        )}

        {/* Elementos Superpuestos (Badges, Acciones de Administrador, etc.) */}
        {children && <div className="absolute inset-0 pointer-events-none z-30">{children}</div>}
      </div>

      {/* Miniaturas en Desktop (Opcional, seleccionables) */}
      {showThumbnails && total > 1 && (
        <div className="hidden sm:flex items-center gap-2 overflow-x-auto py-1 custom-scroll">
          {validImages.map((thumbUrl, idx) => {
            const isSelected = idx === currentIndex;
            const isThumbErrored = Boolean(erroredUrls[thumbUrl]);

            return (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToSlide(idx);
                }}
                className={`relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border transition-all duration-200 ${
                  isSelected
                    ? 'border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.5)] scale-105 ring-2 ring-purple-500/30'
                    : 'border-white/10 opacity-60 hover:opacity-100 hover:border-white/30'
                }`}
              >
                {!isThumbErrored ? (
                  <Image
                    src={getOptimizedCloudinaryUrl(thumbUrl, 160)}
                    alt={`${productName} miniatura ${idx + 1}`}
                    fill
                    sizes="60px"
                    className="object-cover w-full h-full"
                    onError={() => handleImageError(thumbUrl)}
                  />
                ) : (
                  <div className="w-full h-full bg-[#121815] flex items-center justify-center text-neutral-500">
                    <ImageOff size={14} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductGallery;
