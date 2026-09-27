import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface HeroBannerProps {
  flyerUrl?: string | null;
  title?: string;
  subtitle?: string;
  dateVenueText?: string;
  priority?: boolean;
  className?: string;
  fallbackSrc?: string;
  onImageClick?: () => void;
}

/**
 * HeroBanner resiliente con carga optimizada via next/image,
 * skeleton loader contra CLS y fallback instantáneo ante errores HTTP 404 de Cloudinary.
 */
export const HeroBanner: React.FC<HeroBannerProps> = ({
  flyerUrl,
  title,
  subtitle = 'Evento Oficial',
  dateVenueText = 'Próximamente',
  priority = true,
  className = '',
  fallbackSrc = '/images/placeholder-event.webp',
  onImageClick,
}) => {
  const [imgSrc, setImgSrc] = useState<string>(flyerUrl || fallbackSrc);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    setImgSrc(flyerUrl || fallbackSrc);
    setHasError(false);
    setIsLoading(true);
  }, [flyerUrl, fallbackSrc]);

  return (
    <div
      onClick={onImageClick}
      className={`relative w-full min-h-[380px] h-[500px] sm:h-[600px] lg:h-[720px] max-w-[420px] lg:max-w-none rounded-2xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.7)] border border-pink-400/30 group/flyer bg-black/40 ${
        onImageClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* Skeleton Shimmer Loader (Prevención de Cumulative Layout Shift) */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-br from-[#1c0a1e] via-[#100615] to-[#07050a] animate-pulse">
          <div className="w-12 h-12 rounded-full border-2 border-pink-500/30 border-t-pink-400 animate-spin mb-4" />
          <span className="text-[11px] font-black uppercase tracking-[0.25em] text-pink-300/80">
            Cargando Flyer Oficial...
          </span>
        </div>
      )}

      {/* Ambient Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent z-10 pointer-events-none" />

      {/* Resilient Next.js Image with Fallback */}
      <Image
        src={imgSrc}
        alt={title ? `Flyer: ${title}` : 'Flyer oficial del evento'}
        fill
        priority={priority}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 500px"
        className={`w-full h-full object-contain object-center group-hover/flyer:scale-[1.03] transition-all duration-700 ease-out ${
          isLoading ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 blur-0'
        }`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          if (!hasError && imgSrc !== fallbackSrc) {
            setHasError(true);
            setImgSrc(fallbackSrc);
          }
          setIsLoading(false);
        }}
      />

      {/* Bottom Information Overlay */}
      <div className="absolute bottom-5 left-5 z-20 flex flex-col gap-0.5 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-pink-300">
            {subtitle}
          </span>
          {hasError && (
            <span className="text-[8px] font-bold uppercase tracking-wider bg-pink-500/25 border border-pink-400/40 text-pink-200 px-1.5 py-0.5 rounded-full backdrop-blur-md">
              Arte Oficial
            </span>
          )}
        </div>
        <p className="text-xs font-bold text-white uppercase italic">
          {dateVenueText}
        </p>
      </div>
    </div>
  );
};

export default HeroBanner;
