import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, AlertTriangle, ShieldCheck, Info } from 'lucide-react';
import SeatingChart, { Seat, MapElement } from './SeatingChart';
import { cn } from '../lib/utils';

export interface SeatMapProps {
  seats: Seat[];
  elements?: MapElement[];
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
  theme?: 'light' | 'dark';
  allowZoom?: boolean;
  activeAllowedRows?: string[];
  activeRowName?: string;
  isComplimentaryActive?: boolean;
  orphanSeatIds?: string[];
  onInvalidSelectionAttempt?: (seat: Seat, allowedRows: string[]) => void;
  highlightPulseTrigger?: number;
  className?: string;
  isReadOnly?: boolean;
  readOnlyMessage?: string;
}

export const SeatMap: React.FC<SeatMapProps> = ({
  seats,
  elements = [],
  selectedIds = [],
  onSelect,
  theme = 'dark',
  allowZoom = true,
  activeAllowedRows = [],
  activeRowName,
  isComplimentaryActive = false,
  orphanSeatIds = [],
  onInvalidSelectionAttempt,
  highlightPulseTrigger = 0,
  className = '',
  isReadOnly = false,
  readOnlyMessage = 'Venta en línea concluida · Mapa informativo en modo lectura',
}) => {
  const displayRowLabel = useMemo(() => {
    if (activeRowName && activeRowName.trim()) return activeRowName.trim();
    if (activeAllowedRows.length > 0) {
      const tableRows = activeAllowedRows.filter(r => /^mesa\s+\d+/i.test(r.trim()));
      if (tableRows.length > 1) {
        return `mesas habilitadas [${tableRows[0]} a ${tableRows[tableRows.length - 1]}]`;
      }
      const first = activeAllowedRows[0];
      return first.toLowerCase().startsWith('fila') || first.toLowerCase().startsWith('mesa')
        ? first
        : `Fila ${first}`;
    }
    return 'mesas o filas designadas';
  }, [activeRowName, activeAllowedRows]);

  const hasComplimentaryRestriction = isComplimentaryActive && activeAllowedRows.length > 0;

  return (
    <div className={cn("flex flex-col w-full relative select-none", className)}>
      {/* ── Banners Contextuales Reactivos ── */}
      <div className="space-y-2 mb-3">
        {/* Banner de Guía para Cupón de Cortesía Activo */}
        <AnimatePresence>
          {hasComplimentaryRestriction && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-600/20 border-2 border-amber-400/60 shadow-[0_0_25px_rgba(245,158,11,0.25)] backdrop-blur-md"
            >
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/25 border border-amber-400/50 text-amber-400 shrink-0">
                  <Sparkles size={20} className="animate-spin-slow" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                      Cortesía VIP Aplicada
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/30 text-amber-200 border border-amber-400/40">
                      Asignación Automática
                    </span>
                  </div>
                  <p className="text-sm font-bold text-white mt-0.5 leading-snug">
                    Tu cupón de cortesía aplica para las{' '}
                    <strong className="text-amber-300 underline underline-offset-4 decoration-amber-400/60 decoration-2">
                      {displayRowLabel}
                    </strong>
                    . Selecciona tu asiento en las ubicaciones habilitadas con halo ámbar pulsante.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Banner de Prevención de Asiento Huérfano (Anti-Orphan Seat Alert) */}
        <AnimatePresence>
          {orphanSeatIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="p-3.5 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-amber-200 shadow-lg backdrop-blur-md flex items-start gap-3"
            >
              <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5 animate-bounce" />
              <div className="text-xs leading-relaxed">
                <span className="font-black uppercase tracking-wider text-amber-300 block mb-0.5">
                  Regla de Adyacencia: Asiento Aislado Detectado
                </span>
                Tu selección actual dejaría 1 butaca solitaria. Te recomendamos elegir asientos contiguos para completar tu reserva sin restricciones.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Barra de Leyendas del Mapa ── */}
      <div className="px-4 py-2.5 rounded-t-2xl bg-black/60 backdrop-blur-md border border-b-0 border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs font-black uppercase tracking-wider text-white/80">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-amber-400 border border-amber-200 shadow-[0_0_8px_#f59e0b]" />
            Tu Selección
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-[#22a6b3] border border-[#008b9b]" />
            Disponible
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-red-500/80 border border-red-400/50 shadow-[0_0_6px_#ef4444]" />
            Ocupado
          </span>
          {elements.some(e => e.isGA) && (
            <span className="flex items-center gap-1.5 text-amber-200/90">
              <span className="w-3 h-3 rounded-md border border-dashed border-amber-400 bg-amber-400/20" />
              Zona General (GA)
            </span>
          )}
          {hasComplimentaryRestriction && (
            <span className="flex items-center gap-1.5 text-amber-300 font-black">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400" />
              </span>
              Fila VIP Permitida
            </span>
          )}
          {orphanSeatIds.length > 0 && (
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-3 h-3 rounded-md border-2 border-dashed border-amber-500 bg-amber-500/20" />
              Asiento Huérfano
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-white/50 lowercase tracking-normal">
          <Info size={13} className="shrink-0" />
          <span>usa la rueda del mouse o gestos para zoom y desplazamiento</span>
        </div>
      </div>

      {/* ── Lienzo del SeatingChart Interactivo ── */}
      <div className={cn(
        "relative w-full h-[26rem] xs:h-[30rem] lg:h-[36.5rem] min-h-[380px] overflow-hidden rounded-b-2xl border border-white/10 shadow-2xl bg-[#0b0d17]",
        isReadOnly && "pointer-events-none"
      )}>
        {/* Banner flotante sutil de modo lectura sin bloquear visibilidad */}
        {isReadOnly && (
          <div className="absolute top-4 inset-x-4 z-30 pointer-events-auto flex justify-center">
            <div className="px-4 py-2 rounded-2xl bg-zinc-950/85 backdrop-blur-xl border border-amber-500/40 text-amber-300 shadow-2xl flex items-center gap-2.5 text-xs font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>{readOnlyMessage}</span>
            </div>
          </div>
        )}

        <SeatingChart
          seats={seats}
          elements={elements}
          selectedIds={selectedIds}
          onSelect={isReadOnly ? undefined : onSelect}
          theme={theme}
          allowZoom={allowZoom}
          restrictedRows={activeAllowedRows}
          orphanSeatIds={orphanSeatIds}
          onInvalidSelectionAttempt={onInvalidSelectionAttempt}
          highlightPulseTrigger={highlightPulseTrigger}
        />
      </div>
    </div>
  );
};

export default SeatMap;
