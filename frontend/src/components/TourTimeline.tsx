import * as React from 'react';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, ArrowRight, ArrowLeft, Sparkles, Ticket } from 'lucide-react';
import { cn } from '../lib/utils';
import { useEventTheme } from '../context/EventThemeContext';

export interface Event {
  id: number;
  title?: string;
  artist?: string;
  date: string;
  theater_name?: string;
  theater_location?: string;
  venue_name?: string;
  venue_address?: string;
  flyer_url?: string;
  image_url?: string;
  flyer?: string;
  image?: string;
  is_active?: boolean;
  timezone?: string;
  is_online_sales_active?: boolean;
  cutoff_datetime?: string | null;
  is_cutoff_reached?: boolean;
}

interface TourTimelineProps {
  events: Event[];
  currentEvent: Event | null;
  onEventSelect: (event: Event) => void;
}

interface VenueMapTooltipProps {
  displayName: string;
  displayLocation: string;
  isPast: boolean;
  isClosed?: boolean;
  isActive: boolean;
  selectedYear: number;
  secTheme: any;
  theme: any;
  alignOffset: 'left' | 'center' | 'right';
}

const VenueMapTooltip: React.FC<VenueMapTooltipProps> = ({
  displayName,
  displayLocation,
  isPast,
  isClosed = false,
  isActive,
  selectedYear,
  secTheme,
  theme,
  alignOffset
}) => {
  const [shouldLoadIframe, setShouldLoadIframe] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // 150ms debounce before mounting Google Maps iframe to protect scroll performance
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShouldLoadIframe(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const query = encodeURIComponent(`${displayName}, ${displayLocation}`);
  const mapEmbedUrl = `https://maps.google.com/maps?q=${query}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  const externalMapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;

  const alignmentClass =
    alignOffset === 'left'
      ? 'left-0'
      : alignOffset === 'right'
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2';

  const tailClass =
    alignOffset === 'left'
      ? 'left-8'
      : alignOffset === 'right'
      ? 'right-8'
      : 'left-1/2 -translate-x-1/2';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.94 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={cn(
        "absolute top-[5.2rem] z-[100] w-80 p-3.5 bg-slate-950/95 backdrop-blur-2xl border border-amber-500/40 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(245,158,11,0.22)] flex flex-col gap-2.5 text-left",
        alignmentClass
      )}
      style={{
        backgroundColor: secTheme.card_bg ? `${secTheme.card_bg}f5` : undefined,
        borderColor: secTheme.border_color || undefined
      }}
    >
      {/* Balloon Tail Arrow Pointing UP to Date Bubble */}
      <div 
        className={cn(
          "w-3.5 h-3.5 bg-slate-950 border-t border-l border-amber-500/40 rotate-45 absolute -top-1.5 z-10",
          tailClass
        )} 
        style={{ 
          backgroundColor: secTheme.card_bg || undefined, 
          borderColor: secTheme.border_color || undefined 
        }} 
      />

      {/* Map Container */}
      <div className="relative h-36 w-full rounded-xl overflow-hidden bg-[#0a0d14] border border-amber-500/30 shadow-inner group/map z-20">
        {shouldLoadIframe ? (
          <>
            {!iframeLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950 z-10 text-amber-400">
                <MapPin className="animate-bounce text-amber-400" size={24} />
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Localizando Recinto...</span>
              </div>
            )}
            <iframe
              src={mapEmbedUrl}
              title={`Mapa de ${displayName}`}
              onLoad={() => setIframeLoaded(true)}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="w-full h-full border-0 pointer-events-none transition-opacity duration-300"
              style={{
                filter: 'invert(90%) hue-rotate(180deg) contrast(1.15) brightness(0.85)',
                opacity: iframeLoaded ? 1 : 0
              }}
            />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-950 text-amber-400/60">
            <MapPin size={22} className="animate-pulse" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Cargando mapa...</span>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-amber-500/40 text-[9px] font-black uppercase tracking-wider text-amber-300 shadow-lg pointer-events-none z-20">
          {isPast ? 'Concluido' : (isClosed ? 'Taquilla Física' : (isActive ? 'Seleccionado' : 'En Venta'))}
        </div>

        {/* Center Venue Location Marker Accent */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
          <div className="relative flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-amber-400/30" />
            <div className="w-4 h-4 rounded-full bg-amber-400 border-2 border-slate-950 shadow-[0_0_12px_#F59E0B]" />
          </div>
        </div>
      </div>

      {/* Info & External Link Header */}
      <div className="px-1 space-y-1.5 z-20">
        <div className="flex items-center justify-between gap-2">
          <h5 className="text-xs font-black text-white line-clamp-1 uppercase tracking-tight" style={{ color: secTheme.heading_color || undefined }}>
            {displayName}
          </h5>
          <span className="text-[9px] font-mono text-amber-400/80 uppercase shrink-0">Hermosillo</span>
        </div>
        <p className="text-[10.5px] text-slate-300 font-medium flex items-center gap-1.5 line-clamp-2 leading-tight" style={{ color: secTheme.subtitle_color || undefined }}>
          <MapPin size={12} className="text-amber-400 shrink-0" style={{ color: secTheme.accent_color || undefined }} />
          <span>{displayLocation}</span>
        </p>

        {/* Navigation Action Row */}
        <div className="pt-2 flex items-center justify-between text-[10px] border-t border-white/10 mt-1.5 pointer-events-auto">
          <span className="text-amber-400/90 font-bold uppercase tracking-wider" style={{ color: secTheme.accent_color || undefined }}>
            Ms Ambar Tour {selectedYear}
          </span>
          <a
            href={externalMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[9.5px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
            title="Abrir ubicación en Google Maps"
          >
            <span>Ver en Maps</span>
            <ArrowRight size={10} />
          </a>
        </div>
      </div>
    </motion.div>
  );
};

const TourTimeline = ({ events, currentEvent, onEventSelect }: TourTimelineProps) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [hoveredEventId, setHoveredEventId] = useState<number | null>(null);
  const { getSectionTheme, theme } = useEventTheme();
  const secTheme = getSectionTheme('tour_timeline');

  const years = useMemo(() => {
    const yearsSet = new Set(events.map(e => new Date(e.date).getFullYear()));
    yearsSet.add(2026);
    yearsSet.add(2027);
    return Array.from(yearsSet).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events
      .filter(e => new Date(e.date).getFullYear() === selectedYear)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events, selectedYear]);

  // Helper to extract image poster URL with fallbacks
  const getEventImage = (event: Event) => {
    return event.flyer_url || event.image_url || event.flyer || event.image || null;
  };

  return (
    <div className="w-full relative py-6">
      {/* Timeline Controls & Year Filter Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8 px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest">
            <Sparkles size={12} className="animate-spin text-amber-400" />
            <span style={{ color: secTheme.heading_color || theme.primaryColor }}>Ruta de Esencia</span>
          </div>

          <div className="flex items-center gap-2">
            {years.map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                style={{
                  color: selectedYear === year ? (secTheme.heading_color || theme.primaryColor) : undefined
                }}
                className={cn(
                  "text-2xl sm:text-3xl font-black transition-all relative px-3 py-1 rounded-xl",
                  selectedYear === year 
                    ? "drop-shadow-[0_0_12px_rgba(245,158,11,0.5)] scale-105" 
                    : "text-slate-500 hover:text-slate-300 dark:text-slate-500 dark:hover:text-slate-300"
                )}
              >
                {year}
                {selectedYear === year && (
                  <motion.div 
                    layoutId="year-dot"
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full shadow-[0_0_12px_#F59E0B]" 
                    style={{ backgroundColor: secTheme.heading_color || theme.primaryColor }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 bg-slate-900/60 dark:bg-slate-950/60 px-4 py-2 rounded-full border border-white/5 shadow-sm">
          <ArrowLeft size={12} className="text-amber-400" />
          <span>Desliza para explorar fechas</span>
          <ArrowRight size={12} className="text-amber-400" />
        </div>
      </div>

      {/* Timeline Track */}
      <div className="relative group z-30">
        {/* Luminous Track Line */}
        <div className="absolute top-[4.5rem] left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/30 dark:via-amber-400/20 to-transparent z-0 pointer-events-none" />

        <div className="flex gap-8 overflow-x-auto pb-8 pt-4 px-4 no-scrollbar scroll-smooth relative z-30">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedYear}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="flex gap-8 w-full"
            >
              {filteredEvents.length > 0 ? (
                filteredEvents.map((event, index) => {
                  const date = new Date(event.date);
                  const isActive = currentEvent?.id === event.id;
                  const now = new Date();
                  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const isPast = date < startOfToday;
                  const isClosed = !isPast && (
                    event.is_online_sales_active === false ||
                    event.is_cutoff_reached === true ||
                    (Boolean(event.cutoff_datetime) && now >= new Date(event.cutoff_datetime!))
                  );
                  const isHovered = hoveredEventId === event.id;
                  const coverImg = getEventImage(event);

                  const displayName = event.theater_name || event.title || event.venue_name || 'Ms Ambar en Vivo';
                  const displayLocation = event.theater_location || event.venue_address || 'Sede por confirmar';

                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.08 }}
                      className={cn(
                        "flex-shrink-0 w-[330px] relative transition-all duration-300",
                        isHovered ? "z-50" : "z-10"
                      )}
                      onMouseEnter={() => setHoveredEventId(event.id)}
                      onMouseLeave={() => setHoveredEventId(null)}
                    >
                      {/* Floating Venue Geographic Map Balloon Tooltip (Downward Pop, Lazy-Loaded) */}
                      <AnimatePresence>
                        {isHovered && (
                          <VenueMapTooltip
                            displayName={displayName}
                            displayLocation={displayLocation}
                            isPast={isPast}
                            isClosed={isClosed}
                            isActive={isActive}
                            selectedYear={selectedYear}
                            secTheme={secTheme}
                            theme={theme}
                            alignOffset={index === 0 ? 'left' : (index === filteredEvents.length - 1 ? 'right' : 'center')}
                          />
                        )}
                      </AnimatePresence>

                      {/* Date Node Bubble */}
                      <div className="flex flex-col items-center mb-6">
                        <div className={cn(
                          "w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center transition-all duration-300 mb-4 z-10 shadow-2xl relative",
                          isActive 
                            ? "bg-slate-950 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.5)] scale-110" 
                            : (isHovered ? "bg-slate-950 border-amber-400/80 scale-105" : "bg-slate-900/90 dark:bg-slate-950/90 border-slate-800 dark:border-white/10")
                        )}>
                          {isActive && (
                            <span className="absolute inset-0 rounded-full border-2 border-amber-400/40 animate-ping pointer-events-none" />
                          )}
                          <span className={cn(
                            "text-[10px] font-black uppercase leading-none mb-0.5 transition-colors duration-300 tracking-wider", 
                            isActive || isHovered ? "text-amber-400" : "text-slate-400 dark:text-slate-400"
                          )} style={{ color: (isActive || isHovered) ? (secTheme.accent_color || theme.primaryColor) : undefined }}>
                            {new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: event.timezone || 'America/Hermosillo' }).format(date)}
                          </span>
                          <span className={cn(
                            "text-lg font-black leading-none transition-colors duration-300", 
                            isActive || isHovered ? "text-white" : "text-slate-200 dark:text-white"
                          )}>
                            {new Intl.DateTimeFormat('es-MX', { day: 'numeric', timeZone: event.timezone || 'America/Hermosillo' }).format(date)}
                          </span>
                        </div>
                      </div>

                      {/* Event Card (Ultrapremium Glass State) */}
                      <motion.button
                        whileHover={{ y: -6, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onEventSelect(event)}
                        style={{
                          backgroundColor: secTheme.card_bg || undefined,
                          borderColor: isActive ? (secTheme.accent_color || theme.primaryColor) : (secTheme.border_color || undefined)
                        }}
                        className={cn(
                          "w-full text-left p-7 rounded-[2rem] border transition-all duration-300 relative overflow-hidden group/card shadow-xl",
                          isActive 
                            ? "bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/50 border-amber-400/80 shadow-[0_0_35px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/30" 
                            : "bg-slate-900/60 dark:bg-slate-950/60 border-slate-800 dark:border-white/10 hover:border-amber-500/40 hover:bg-slate-900/80"
                        )}
                      >
                        {/* 1. Fondo de la tarjeta con imagen del evento y protección de contraste al 80% */}
                        <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none z-0">
                          {coverImg ? (
                            <img
                              src={coverImg}
                              alt={displayName}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover object-center opacity-30 group-hover/card:opacity-45 scale-105 group-hover/card:scale-110 transition-all duration-700 ease-out"
                            />
                          ) : (
                            <div className="w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/15 via-slate-900/60 to-black/80" />
                          )}
                          {/* Capa de degradado con 80-85% de opacidad para garantizar legibilidad WCAG AAA */}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#080c0a] via-[#080c0a]/85 to-[#080c0a]/75 backdrop-blur-[1px]" />
                        </div>
                        <div className="relative z-10 space-y-3.5">
                          <div className="flex justify-between items-center gap-2">
                            <div className="flex items-center gap-2">
                              <span 
                                style={{
                                  color: secTheme.text_color || undefined,
                                  borderColor: secTheme.border_color || undefined
                                }}
                                className={cn(
                                "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                isActive 
                                  ? "bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-sm" 
                                  : "bg-slate-800/80 dark:bg-white/5 text-slate-300 dark:text-slate-300 border-white/5"
                              )}>
                                {displayLocation}
                              </span>

                              {isPast ? (
                                <span className="px-2.5 py-1 rounded-full text-[8.5px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  Concluido
                                </span>
                              ) : isClosed ? (
                                <span className="px-2.5 py-1 rounded-full text-[8.5px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  Taquilla Física
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-[8.5px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  En Venta
                                </span>
                              )}
                            </div>

                            {isActive && (
                              <motion.div 
                                layoutId="active-indicator" 
                                className="w-3 h-3 bg-amber-400 rounded-full shadow-[0_0_12px_#F59E0B] shrink-0 animate-pulse" 
                                style={{ backgroundColor: secTheme.accent_color || theme.primaryColor }}
                              />
                            )}
                          </div>
                          
                          <h4 
                            style={{ color: secTheme.heading_color || undefined }}
                            className={cn(
                            "text-xl font-extrabold tracking-tight line-clamp-1 transition-colors",
                            isActive ? "text-white drop-shadow-sm" : "text-slate-100 dark:text-white"
                          )}>
                            {displayName}
                          </h4>
                          
                          <div 
                            style={{ color: secTheme.subtitle_color || undefined }}
                            className={cn(
                            "flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider",
                            isActive ? "text-amber-300/90" : "text-slate-400 dark:text-slate-400"
                          )}>
                            <Calendar size={13} className={isActive ? "text-amber-400" : "text-slate-500"} />
                            <span>{new Intl.DateTimeFormat('es-MX', { weekday: 'long', timeZone: event.timezone || 'America/Hermosillo' }).format(date)}</span>
                          </div>
                        </div>

                        {/* Hover & Active Glowing Accents */}
                        <div className={cn(
                          "absolute -right-6 -bottom-6 w-32 h-32 blur-2xl rounded-full transition-all duration-500 pointer-events-none",
                          isActive ? "bg-amber-500/25" : "bg-amber-500/5 group-hover/card:bg-amber-500/15"
                        )} />
                      </motion.button>
                    </motion.div>
                  );
                })
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full py-20 text-center bg-slate-900/40 dark:bg-slate-950/40 backdrop-blur-xl rounded-[2.5rem] border-2 border-dashed border-slate-800 dark:border-white/10"
                >
                  <p className="text-sm font-bold uppercase tracking-widest text-slate-400">No hay fechas programadas para este año</p>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default TourTimeline;

