import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock, ShieldAlert, AlertTriangle, RefreshCw, Copy, Check,
  Unlock, Trash2, Mail, Phone, Ticket as TicketIcon, Search,
  ExternalLink, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../lib/api';
import { showToast, showConfirm, showAlert } from '../../lib/notifications';

export interface ReservedSessionItem {
  id: number;
  user_email: string;
  user_phone: string;
  event_id: number;
  event_title: string;
  seat_id: number | null;
  seat_label: string;
  zone: string;
  created_at: string;
  elapsed_minutes: number;
  is_expired: boolean;
  stripe_session_id: string;
  stripe_status: string;
  has_mg: boolean;
}

interface ReservedSeatsManagerProps {
  selectedEventId?: string;
  onSeatsReleased?: () => void;
}

export const ReservedSeatsManager: React.FC<ReservedSeatsManagerProps> = ({
  selectedEventId = 'all',
  onSeatsReleased
}) => {
  const [sessions, setSessions] = useState<ReservedSessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [releasingId, setReleasingId] = useState<number | null>(null);
  const [isBulkReleasing, setIsBulkReleasing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchReservedSessions = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const url = selectedEventId && selectedEventId !== 'all'
        ? `/tickets/admin/reserved-sessions/?event_id=${selectedEventId}`
        : '/tickets/admin/reserved-sessions/';
      const res = await api.get(url);
      if (res.data?.status === 'success' && Array.isArray(res.data.sessions)) {
        setSessions(res.data.sessions);
      } else {
        setSessions([]);
      }
    } catch (err: any) {
      console.error('Error al cargar reservaciones atascadas:', err);
      if (!isSilent) {
        showToast('Error al consultar reservaciones atascadas', 'error');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    fetchReservedSessions();
    const interval = setInterval(() => {
      fetchReservedSessions(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchReservedSessions]);

  const handleCopyStripeId = (sid: string) => {
    if (!sid) return;
    navigator.clipboard.writeText(sid);
    setCopiedId(sid);
    showToast('ID de sesión copiado al portapapeles', 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReleaseSingle = async (item: ReservedSessionItem) => {
    const confirmed = await showConfirm(
      `¿Deseas liberar inmediatamente el asiento ${item.seat_label} (${item.user_email})?\n\nEsta acción cancelará la reserva en base de datos, expirará la sesión en Stripe y actualizará el mapa en tiempo real.`,
      'Confirmar Liberación de Asiento'
    );
    if (!confirmed) return;

    setReleasingId(item.id);
    // Optimistic UI removal
    const previous = [...sessions];
    setSessions(prev => prev.filter(s => s.id !== item.id));

    try {
      const res = await api.post('/tickets/admin/release-seats/', {
        ticket_ids: [item.id]
      });
      if (res.data?.status === 'success') {
        showToast(`Asiento ${item.seat_label} liberado exitosamente`, 'success');
        if (onSeatsReleased) onSeatsReleased();
      } else {
        throw new Error(res.data?.error || 'No se pudo completar la liberación');
      }
    } catch (err: any) {
      // Revert optimistic update
      setSessions(previous);
      showAlert(err.response?.data?.error || err.message || 'Error al liberar asiento', 'Falla de Liberación', 'error');
    } finally {
      setReleasingId(null);
    }
  };

  const handleReleaseBulkExpired = async () => {
    const expiredCount = sessions.filter(s => s.is_expired).length;
    if (expiredCount === 0) {
      showToast('No hay reservaciones vencidas (> 15 min) para liberar.', 'info');
      return;
    }

    const confirmed = await showConfirm(
      `Se liberarán ${expiredCount} asiento(s) con más de 15 minutos en estado reservado.\n\nSe cerrarán las pasarelas Stripe correspondientes y se invalidará la caché del mapa. ¿Deseas continuar?`,
      'Liberación Masiva de Asientos Vencidos'
    );
    if (!confirmed) return;

    setIsBulkReleasing(true);
    // Optimistic update
    const previous = [...sessions];
    setSessions(prev => prev.filter(s => !s.is_expired));

    try {
      const res = await api.post('/tickets/admin/release-seats/', {
        release_all_expired: true,
        timeout_minutes: 15
      });
      if (res.data?.status === 'success') {
        const released = res.data.released_count || expiredCount;
        showToast(`Se liberaron ${released} asiento(s) expirados exitosamente`, 'success');
        if (onSeatsReleased) onSeatsReleased();
        fetchReservedSessions(true);
      } else {
        throw new Error(res.data?.error || 'Falla en la liberación masiva');
      }
    } catch (err: any) {
      setSessions(previous);
      showAlert(err.response?.data?.error || err.message || 'Error al liberar asientos expirados', 'Error', 'error');
    } finally {
      setIsBulkReleasing(false);
    }
  };

  const filteredSessions = sessions.filter(s => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.user_email?.toLowerCase().includes(term) ||
      s.seat_label?.toLowerCase().includes(term) ||
      s.stripe_session_id?.toLowerCase().includes(term) ||
      s.event_title?.toLowerCase().includes(term) ||
      String(s.id).includes(term)
    );
  });

  const expiredCount = sessions.filter(s => s.is_expired).length;

  return (
    <div className="bg-[#0c0f0d]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)] space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-honey">
              Control de Concurrencia & TTL
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white flex items-center gap-2.5">
            <ShieldAlert size={22} className="text-amber-honey" />
            Butacas en Reserva / Pasarelas Abiertas
          </h2>
          <p className="text-xs text-white/50 font-medium mt-1">
            Supervisa compras en proceso y libera inmediatamente butacas bloqueadas por carritos abandonados.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => fetchReservedSessions()}
            disabled={loading}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-black uppercase tracking-wider px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-amber-honey' : 'text-amber-honey'} />
            <span>Sincronizar</span>
          </button>

          <button
            type="button"
            onClick={handleReleaseBulkExpired}
            disabled={isBulkReleasing || expiredCount === 0}
            className="flex items-center gap-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all shadow-[0_4px_20px_rgba(225,29,72,0.25)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
          >
            <Trash2 size={14} className={isBulkReleasing ? 'animate-spin' : ''} />
            <span>Liberar Todo lo Expirado ({expiredCount})</span>
          </button>
        </div>
      </div>

      {/* KPI Cards & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">
            Total en Espera
          </span>
          <p className="text-2xl sm:text-3xl font-black font-mono text-white">
            {sessions.length}
          </p>
          <span className="text-[9px] font-bold text-white/40 uppercase mt-1 block">
            Asientos Bloqueados
          </span>
        </div>

        <div className="bg-black/40 border border-amber-500/20 p-4 rounded-2xl">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-1">
            En Proceso (&lt; 15 min)
          </span>
          <p className="text-2xl sm:text-3xl font-black font-mono text-amber-honey">
            {sessions.filter(s => !s.is_expired).length}
          </p>
          <span className="text-[9px] font-bold text-amber-500/70 uppercase mt-1 block">
            Checkout Activo
          </span>
        </div>

        <div className="bg-black/40 border border-rose-500/25 p-4 rounded-2xl">
          <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 block mb-1">
            Expirados (&gt; 15 min)
          </span>
          <p className="text-2xl sm:text-3xl font-black font-mono text-rose-400">
            {expiredCount}
          </p>
          <span className="text-[9px] font-bold text-rose-500/70 uppercase mt-1 block">
            Candidatos a Liberación
          </span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Filtrar por asistente, butaca, Stripe Session ID o evento..."
          className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 focus:border-amber-honey/70 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none transition-colors"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 border-b border-white/10 uppercase font-black text-[10px] tracking-wider text-white/50">
            <tr>
              <th className="py-3 px-4">Asistente</th>
              <th className="py-3 px-4">Butaca / Zona</th>
              <th className="py-3 px-4">Evento</th>
              <th className="py-3 px-4">Tiempo en Reserva</th>
              <th className="py-3 px-4">Pasarela Stripe</th>
              <th className="py-3 px-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && sessions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-white/40">
                  <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-amber-honey" />
                  <span>Consultando reservaciones activas...</span>
                </td>
              </tr>
            ) : filteredSessions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-white/40">
                  <Unlock size={28} className="mx-auto mb-2 text-emerald-400 opacity-60" />
                  <p className="text-white/70 font-bold uppercase tracking-wider text-xs">
                    No hay butacas atascadas en reservación
                  </p>
                  <p className="text-[10px] text-white/40 mt-1">
                    Todos los asientos están disponibles para venta o debidamente pagados.
                  </p>
                </td>
              </tr>
            ) : (
              filteredSessions.map(item => {
                const isReleasing = releasingId === item.id;
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Attendee */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Mail size={12} className="text-amber-honey shrink-0" />
                        <span className="truncate max-w-[200px]">{item.user_email}</span>
                      </div>
                      {item.user_phone && (
                        <div className="text-[10px] text-white/40 flex items-center gap-1 mt-0.5">
                          <Phone size={10} />
                          <span>{item.user_phone}</span>
                        </div>
                      )}
                    </td>

                    {/* Seat / Zone */}
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white font-mono font-bold text-xs">
                        <TicketIcon size={12} className="text-amber-honey shrink-0" />
                        <span>{item.seat_label}</span>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider text-white/40 block mt-0.5">
                        {item.zone}
                      </span>
                    </td>

                    {/* Event */}
                    <td className="py-3.5 px-4">
                      <span className="text-white/80 font-medium truncate max-w-[180px] block">
                        {item.event_title || `Evento #${item.event_id}`}
                      </span>
                    </td>

                    {/* Time in Reservation */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            item.is_expired
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          <Clock size={10} />
                          <span>{item.elapsed_minutes} min</span>
                        </span>
                        {item.is_expired && (
                          <span className="text-[9px] font-black uppercase text-rose-500 tracking-wider">
                            Vencido
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Stripe Session */}
                    <td className="py-3.5 px-4">
                      {item.stripe_session_id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-white/60 truncate max-w-[130px]">
                            {item.stripe_session_id}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyStripeId(item.stripe_session_id)}
                            className="text-white/40 hover:text-white transition-colors p-1"
                            title="Copiar ID de sesión"
                          >
                            {copiedId === item.stripe_session_id ? (
                              <Check size={11} className="text-emerald-400" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-white/30 italic text-[10px]">Sin sesión</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleReleaseSingle(item)}
                        disabled={isReleasing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:border-rose-500/50 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                      >
                        <Unlock size={12} className={isReleasing ? 'animate-spin' : ''} />
                        <span>{isReleasing ? 'Liberando...' : 'Liberar'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReservedSeatsManager;
