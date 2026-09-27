import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, MapPin, Ticket } from 'lucide-react';

export interface EventCardData {
  id: number;
  title: string;
  artist?: string;
  date: string;
  timezone?: string;
  venue_name?: string;
  venue_address?: string;
  theater_name?: string;
  theater_location?: string;
  flyer_url?: string | null;
  image_url?: string | null;
  flyer?: string | null;
  image?: string | null;
  is_active?: boolean;
  event_type?: 'concert' | 'meet_greet';
  seatless_ticket_price?: number | string;
  numbered_ticket_price?: number | string;
  base_price?: number | string;
  price_with_fee?: number | string;
}

interface EventCardProps {
  event: EventCardData;
  className?: string;
  priority?: boolean;
  onSelect?: (event: EventCardData) => void;
}

/**
 * EventCard blindado contra HTTP 400 de Next.js /_next/image:
 * - Delega la optimización directamente a Cloudinary vía `unoptimized={true}` si la URL es remota.
 * - Resetea reactivamente el estado local ante mutaciones de props (`event.flyer_url`).
 * - Fallback automático e instantáneo a '/images/placeholder-event.webp' en caso de error de red.
 */
export const EventCard: React.FC<EventCardProps> = ({
  event,
  className = '',
  priority = false,
  onSelect,
}) => {
  const rawFlyer = event.flyer_url || event.image_url || event.flyer || event.image;
  const fallbackSrc = '/images/placeholder-event.webp';

  const [imgSrc, setImgSrc] = useState<string>(rawFlyer || fallbackSrc);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Reset reactivo defensivo ante cambios en la data del evento
  useEffect(() => {
    const currentFlyer = event.flyer_url || event.image_url || event.flyer || event.image;
    setImgSrc(currentFlyer || fallbackSrc);
    setHasError(false);
    setIsLoading(true);
  }, [event.flyer_url, event.image_url, event.flyer, event.image]);

  const isCloudinaryOrRemote = typeof imgSrc === 'string' && (
    imgSrc.includes('cloudinary.com') || imgSrc.startsWith('http://') || imgSrc.startsWith('https://')
  );

  const formattedDate = event.date
    ? new Intl.DateTimeFormat('es-MX', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: event.timezone || 'America/Hermosillo',
      }).format(new Date(event.date))
    : 'Próximamente';

  const venueDisplay = event.theater_name || event.venue_name || 'Recinto Oficial';
  const locationDisplay = event.theater_location || event.venue_address || 'Hermosillo, Sonora';

  return (
    <div
      onClick={() => onSelect && onSelect(event)}
      className={`group relative flex flex-col rounded-3xl overflow-hidden bg-slate-950/80 border border-white/10 hover:border-amber-500/40 transition-all duration-300 shadow-xl shadow-black/40 ${
        onSelect ? 'cursor-pointer hover:-translate-y-1' : ''
      } ${className}`}
    >
      {/* Container del Flyer con Relación de Aspecto Fija */}
      <div className="relative w-full aspect-[4/5] overflow-hidden bg-slate-900">
        {/* Shimmer Placeholder Loader */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900 animate-pulse">
            <div className="w-8 h-8 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
          </div>
        )}

        <Image
          src={imgSrc}
          alt={event.title ? `Flyer de ${event.title}` : 'Flyer del evento'}
          fill
          priority={priority}
          unoptimized={isCloudinaryOrRemote}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 350px"
          className={`w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out ${
            isLoading ? 'opacity-0' : 'opacity-100'
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

        {/* Gradiente Protector de Contraste */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent z-10 pointer-events-none" />

        {/* Badge de Tipo de Evento */}
        <div className="absolute top-3 right-3 z-20">
          <span
            className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-md border shadow-md ${
              event.event_type === 'meet_greet'
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                : 'bg-purple-950/80 text-purple-300 border-purple-500/40'
            }`}
          >
            {event.event_type === 'meet_greet' ? 'Meet & Greet' : 'Concierto'}
          </span>
        </div>
      </div>

      {/* Metadatos y Llamado a la Acción */}
      <div className="p-5 flex flex-col flex-1 justify-between gap-3 bg-gradient-to-b from-slate-950/40 to-slate-950 z-20">
        <div className="space-y-1.5">
          <h4 className="text-base font-black text-white leading-snug line-clamp-1 group-hover:text-amber-400 transition-colors">
            {event.title}
          </h4>
          {event.artist && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/80">
              {event.artist}
            </p>
          )}

          <div className="pt-2 space-y-1 text-[11px] text-slate-300 font-medium">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-amber-400 shrink-0" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin size={13} className="text-amber-400 shrink-0" />
              <span className="line-clamp-1">{venueDisplay} • {locationDisplay}</span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
              Desde
            </span>
            <span className="text-sm font-black text-white">
              ${event.base_price || event.seatless_ticket_price || '500.00'} MXN
            </span>
          </div>

          <Link
            href={`/comprar-boletos?event=${event.id}`}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
          >
            <Ticket size={13} /> Boletos
          </Link>
        </div>
      </div>
    </div>
  );
};

export default EventCard;
