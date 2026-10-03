import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Power,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  X,
  Sparkles,
  RefreshCw,
  Globe,
  Sliders,
  Check
} from 'lucide-react';
import api from '../lib/api';
import { showAlert, showToast } from '../lib/notifications';

export interface EventCutoffData {
  id: number;
  title: string;
  date?: string;
  doors_open?: string;
  is_online_sales_active?: boolean;
  cutoff_datetime?: string | null;
  is_cutoff_reached?: boolean;
  venue_name?: string;
  timezone?: string;
}

interface DigitalBoxOfficeControlProps {
  event: EventCutoffData | null;
  onEventUpdated?: (updatedEvent: any) => void;
  className?: string;
}

export const DigitalBoxOfficeControl: React.FC<DigitalBoxOfficeControlProps> = ({
  event,
  onEventUpdated,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [cutoffInput, setCutoffInput] = useState('');

  // Resolved venue timezone (default to America/Hermosillo)
  const venueTimezone = event?.timezone || 'America/Hermosillo';

  const isOnlineActive = event?.is_online_sales_active !== false;
  const cutoffDate = event?.cutoff_datetime ? new Date(event.cutoff_datetime) : null;
  const isPastCutoff = cutoffDate ? new Date() >= cutoffDate : false;

  // Single source of truth for effective closed state
  const isEffectivelyClosed = typeof event?.is_cutoff_reached === 'boolean'
    ? event.is_cutoff_reached
    : (!isOnlineActive || isPastCutoff);

  // Initialize input when modal opens or event changes
  useEffect(() => {
    if (event?.cutoff_datetime) {
      const d = new Date(event.cutoff_datetime);
      const pad = (n: number) => String(n).padStart(2, '0');
      const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setCutoffInput(localStr);
    } else {
      setCutoffInput('');
    }
  }, [event?.cutoff_datetime, isOpen]);

  if (!event) return null;

  // 1. Bidirectional Instant 1-Click Toggle with Optimistic UI & Rollback
  const handleToggleSalesActive = async (targetState?: boolean) => {
    // If targetState is provided: true means OPEN, false means CLOSE
    // If no argument provided: toggle the current effective state: closed -> open; open -> close
    const willOpen = typeof targetState === 'boolean' ? targetState : isEffectivelyClosed;

    // When reopening sales (willOpen === true):
    // Clear any past/expired cutoff datetime so the event doesn't immediately re-lock itself!
    const nextCutoffDatetime = willOpen ? null : (event.cutoff_datetime || null);

    const previousEventState = { ...event };

    // Optimistic UI update
    const optimisticEvent: EventCutoffData = {
      ...event,
      is_online_sales_active: willOpen,
      cutoff_datetime: nextCutoffDatetime,
      is_cutoff_reached: !willOpen
    };
    if (onEventUpdated) onEventUpdated(optimisticEvent);

    showToast(
      willOpen
        ? 'Taquilla digital abierta: ventas web habilitadas.'
        : 'Taquilla digital cerrada: banner de taquilla física activado.',
      willOpen ? 'success' : 'info'
    );

    setIsUpdating(true);
    try {
      const payload = {
        is_online_sales_active: willOpen,
        cutoff_datetime: nextCutoffDatetime
      };

      const res = await api.post(`/tickets/events/${event.id}/toggle-online-sales/`, payload)
        .catch(() => api.post(`/tickets/events/${event.id}/configure-cutoff/`, payload));

      const serverUpdated: EventCutoffData = {
        ...event,
        is_online_sales_active: res.data.is_online_sales_active,
        cutoff_datetime: res.data.cutoff_datetime,
        is_cutoff_reached: typeof res.data.is_cutoff_reached === 'boolean' ? res.data.is_cutoff_reached : !willOpen,
        timezone: res.data.timezone || venueTimezone
      };
      if (onEventUpdated) onEventUpdated(serverUpdated);
    } catch (err: any) {
      console.error('[Cutoff Toggle Error]', err);
      // Rollback on failure
      if (onEventUpdated) onEventUpdated(previousEventState);
      showAlert(
        err.response?.data?.error || 'No fue posible sincronizar el cambio de taquilla con el servidor. Se ha revertido el estado.',
        'Error de Red',
        'error'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  // 2. Save Cutoff Datetime with Atomic Commit
  const handleSaveCutoffDatetime = async (targetDatetimeIso: string | null) => {
    setIsUpdating(true);
    const previousEventState = { ...event };

    try {
      const payload = {
        is_online_sales_active: true,
        cutoff_datetime: targetDatetimeIso
      };

      const res = await api.post(`/tickets/events/${event.id}/toggle-online-sales/`, payload)
        .catch(() => api.post(`/tickets/events/${event.id}/configure-cutoff/`, payload));

      const updated: EventCutoffData = {
        ...event,
        is_online_sales_active: res.data.is_online_sales_active,
        cutoff_datetime: res.data.cutoff_datetime,
        is_cutoff_reached: res.data.is_cutoff_reached,
        timezone: res.data.timezone || venueTimezone
      };
      if (onEventUpdated) onEventUpdated(updated);

      showToast(
        targetDatetimeIso
          ? `Corte programado guardado (${venueTimezone}).`
          : 'Corte programado cancelado. Venta web en modo manual.',
        'success'
      );
      setIsOpen(false);
    } catch (err: any) {
      console.error('[Cutoff Datetime Error]', err);
      if (onEventUpdated) onEventUpdated(previousEventState);
      showAlert(
        err.response?.data?.error || 'Formato de fecha inválido o error en el servidor.',
        'Error',
        'error'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  // Quick Preset Helper
  const applyPreset = (minutesBeforeEvent: number) => {
    if (!event.date) return;
    const eventTime = new Date(event.date);
    const target = new Date(eventTime.getTime() - minutesBeforeEvent * 60000);
    const pad = (n: number) => String(n).padStart(2, '0');
    setCutoffInput(`${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`);
  };

  return (
    <>
      {/* Control Pill Trigger Button */}
      <div className={`inline-flex items-center gap-2 p-1.5 rounded-2xl bg-[#080a0f] border border-white/10 backdrop-blur-xl shadow-xl ${className}`}>
        {/* State Pill Indicator */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors ${
          isEffectivelyClosed
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        }`}>
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isEffectivelyClosed ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isEffectivelyClosed ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
          </span>
          <span className="text-[11px] font-black uppercase tracking-wider">
            {isEffectivelyClosed ? 'CERRADA' : 'ABIERTA'}
          </span>
        </div>

        {/* Bidirectional Fast Toggle Switch */}
        <button
          type="button"
          onClick={() => handleToggleSalesActive()}
          disabled={isUpdating}
          className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
            isEffectivelyClosed
              ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400'
              : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 hover:border-amber-400'
          } ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}
          title={isEffectivelyClosed ? 'Reabrir venta web' : 'Cerrar venta web y pasar a taquilla física'}
        >
          {isUpdating ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : (
            <Power size={12} />
          )}
          <span>{isEffectivelyClosed ? 'Reabrir Web' : 'Cerrar Web'}</span>
        </button>

        {/* Modal Trigger */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
          title="Configurar horario de corte y zona horaria"
        >
          <Clock size={12} className="text-amber-400" />
          <span>
            {cutoffDate && !isEffectivelyClosed ? cutoffDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'Horario'}
          </span>
        </button>
      </div>

      {/* Glassmorphic Modal for Box Office Cutoff Control */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg rounded-3xl bg-[#0c0f17] border border-amber-500/30 p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden text-white"
            >
              {/* Header Glow */}
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Sliders size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-wider text-white">
                      Control de Taquilla Digital
                    </h3>
                    <p className="text-xs text-white/50">{event.title}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Bidirectional Switch Card */}
              <div className="my-5 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                    Estado de Venta Web:
                  </span>
                  {/* Visual Toggle Pill */}
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/50 border border-white/10">
                    <button
                      type="button"
                      onClick={() => handleToggleSalesActive(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                        !isEffectivelyClosed
                          ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {!isEffectivelyClosed && <Check size={12} />}
                      <span>ABIERTA</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleSalesActive(false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                        isEffectivelyClosed
                          ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {isEffectivelyClosed && <Check size={12} />}
                      <span>CERRADA</span>
                    </button>
                  </div>
                </div>

                {/* Venue Timezone Badge */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Globe size={13} className="text-amber-400" />
                    Zona Horaria del Venue:
                  </span>
                  <span className="font-mono font-bold text-amber-300">
                    {venueTimezone}
                  </span>
                </div>

                {/* Programmed Cutoff Status */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Corte Programado:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {cutoffDate && !isPastCutoff ? cutoffDate.toLocaleString('es-MX', { timeZone: venueTimezone }) : 'Modo Manual (Sin Corte)'}
                  </span>
                </div>
              </div>

              {/* Datetime Input with Presets */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-300 block">
                  Fecha y Hora de Cierre Automático ({venueTimezone}):
                </label>
                <input
                  type="datetime-local"
                  value={cutoffInput}
                  onChange={e => setCutoffInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/20 focus:border-amber-400 text-sm text-white font-mono focus:outline-none transition-colors"
                />

                {/* Quick Presets */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] uppercase font-bold text-white/40 block">Atajos rápidos:</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => applyPreset(60)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-xs border border-white/10 transition-colors"
                    >
                      1h antes del show
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset(120)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-xs border border-white/10 transition-colors"
                    >
                      2h antes del show
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset(0)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-xs border border-white/10 transition-colors"
                    >
                      Al inicio del show
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-7 flex items-center justify-between gap-3 pt-4 border-t border-white/10">
                {event.cutoff_datetime ? (
                  <button
                    type="button"
                    onClick={() => handleSaveCutoffDatetime(null)}
                    disabled={isUpdating}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Quitar Programación
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!cutoffInput) {
                        showAlert('Por favor selecciona una fecha y hora o usa "Quitar Programación".', 'Atención', 'warning');
                        return;
                      }
                      handleSaveCutoffDatetime(new Date(cutoffInput).toISOString());
                    }}
                    disabled={isUpdating || !cutoffInput}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isUpdating ? 'Guardando...' : 'Guardar Horario'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DigitalBoxOfficeControl;
