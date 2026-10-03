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
  Ticket,
  ChevronDown,
  RefreshCw,
  Sliders
} from 'lucide-react';
import api from '../lib/api';
import { showAlert, showConfirm, showToast } from '../lib/notifications';

interface EventCutoffData {
  id: number;
  title: string;
  date?: string;
  doors_open?: string;
  is_online_sales_active?: boolean;
  cutoff_datetime?: string | null;
  venue_name?: string;
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

  const isOnlineActive = event?.is_online_sales_active !== false;
  const cutoffDate = event?.cutoff_datetime ? new Date(event.cutoff_datetime) : null;
  const isPastCutoff = cutoffDate ? new Date() >= cutoffDate : false;
  const isEffectivelyClosed = !isOnlineActive || isPastCutoff;

  // Initialize input when modal opens or event changes
  useEffect(() => {
    if (event?.cutoff_datetime) {
      // Convert to local YYYY-MM-DDTHH:mm format for datetime-local input
      const d = new Date(event.cutoff_datetime);
      const pad = (n: number) => String(n).padStart(2, '0');
      const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setCutoffInput(localStr);
    } else {
      setCutoffInput('');
    }
  }, [event?.cutoff_datetime]);

  if (!event) return null;

  // 1. Instant 1-Click Toggle for Online Sales
  const handleToggleSalesActive = async () => {
    const nextState = !isOnlineActive;
    const confirmMessage = nextState
      ? `¿Deseas REACTIVAR la venta en línea para "${event.title}"? Los compradores podrán volver a pagar con tarjeta y Stripe inmediatamente.`
      : `¿Deseas CERRAR la venta en línea para "${event.title}" ahora mismo? La página web mostrará el banner de venta exclusiva en taquilla física.`;

    const confirmed = await showConfirm(
      confirmMessage,
      nextState ? 'Reactivar Taquilla Digital' : 'Cerrar Taquilla Digital'
    );
    if (!confirmed) return;

    setIsUpdating(true);
    try {
      const res = await api.post(`/tickets/events/${event.id}/configure-cutoff/`, {
        is_online_sales_active: nextState
      });

      const updated = {
        ...event,
        is_online_sales_active: res.data.is_online_sales_active,
        cutoff_datetime: res.data.cutoff_datetime
      };
      if (onEventUpdated) onEventUpdated(updated);

      showToast(
        nextState
          ? 'Taquilla digital reactivada. Ventas online habilitadas.'
          : 'Taquilla digital cerrada. Banner de taquilla física activo.',
        nextState ? 'success' : 'info'
      );
    } catch (err: any) {
      console.error('[Cutoff Error]', err);
      showAlert(
        err.response?.data?.error || 'No fue posible actualizar el estado de la taquilla digital.',
        'Error de Configuración',
        'error'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  // 2. Save Cutoff Datetime
  const handleSaveCutoffDatetime = async (targetDatetimeIso: string | null) => {
    setIsUpdating(true);
    try {
      const res = await api.post(`/tickets/events/${event.id}/configure-cutoff/`, {
        cutoff_datetime: targetDatetimeIso
      });

      const updated = {
        ...event,
        is_online_sales_active: res.data.is_online_sales_active,
        cutoff_datetime: res.data.cutoff_datetime
      };
      if (onEventUpdated) onEventUpdated(updated);

      showToast(
        targetDatetimeIso
          ? 'Hora de corte programada guardada exitosamente.'
          : 'Fecha de corte programada eliminada (Modo Manual activo).',
        'success'
      );
      setIsOpen(false);
    } catch (err: any) {
      console.error('[Cutoff Error]', err);
      showAlert(
        err.response?.data?.error || 'Formato de fecha inválido o error en el servidor.',
        'Error',
        'error'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  // Preset Buttons Helper
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
      <div className={`inline-flex items-center gap-2 p-1.5 rounded-2xl bg-[#080a0f] border border-white/10 backdrop-blur-xl shadow-lg ${className}`}>
        {/* Live Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isEffectivelyClosed ? 'bg-rose-500' : 'bg-emerald-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isEffectivelyClosed ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
            />
          </span>
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-200">
            {isEffectivelyClosed ? 'Taquilla Digital Cerrada' : 'Taquilla Digital Abierta'}
          </span>
        </div>

        {/* Instant 1-Click Toggle Button */}
        <button
          type="button"
          onClick={handleToggleSalesActive}
          disabled={isUpdating}
          className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
            isOnlineActive
              ? 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 hover:border-rose-500'
              : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:border-emerald-500'
          } ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}
          title={isOnlineActive ? 'Cerrar ventas web inmediatamente' : 'Reactivar ventas web'}
        >
          {isUpdating ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : (
            <Power size={12} />
          )}
          <span>{isOnlineActive ? 'Cerrar Web Ahora' : 'Reactivar Web'}</span>
        </button>

        {/* Modal Trigger for Scheduled Time */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-honey border border-amber-500/30 text-[11px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
          title="Configurar hora de corte programada"
        >
          <Clock size={12} />
          <span>
            {cutoffDate ? cutoffDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'Programar'}
          </span>
        </button>
      </div>

      {/* Glassmorphic Modal for Cutoff Configuration */}
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
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-wider text-white">
                      Corte de Taquilla Digital
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

              {/* Status Summary */}
              <div className="my-5 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Venta en Línea Inmediata:</span>
                  <span className={`font-black ${isOnlineActive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isOnlineActive ? 'HABILITADA' : 'DESACTIVADA'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Cierre Programado:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {cutoffDate ? cutoffDate.toLocaleString('es-MX') : 'Sin fecha límite automática'}
                  </span>
                </div>
                {isEffectivelyClosed && (
                  <div className="pt-2 border-t border-white/10 flex items-center gap-2 text-rose-400 text-xs font-bold">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>Banner de Taquilla Física activo en /comprar-boletos</span>
                  </div>
                )}
              </div>

              {/* Input for Exact Datetime */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-white/70 block">
                  Hora de Cierre Automático:
                </label>
                <input
                  type="datetime-local"
                  value={cutoffInput}
                  onChange={e => setCutoffInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/20 focus:border-amber-honey text-sm text-white font-mono focus:outline-none transition-colors"
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
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Eliminar Programación
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!cutoffInput) {
                        showAlert('Por favor selecciona una fecha y hora o elimina la programación.', 'Atención', 'warning');
                        return;
                      }
                      handleSaveCutoffDatetime(new Date(cutoffInput).toISOString());
                    }}
                    disabled={isUpdating || !cutoffInput}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-honey to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isUpdating ? 'Guardando...' : 'Guardar Hora'}
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
