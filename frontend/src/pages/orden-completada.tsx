import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  CheckCircle2,
  Sparkles,
  Ticket as TicketIcon,
  Calendar,
  MapPin,
  Mail,
  Download,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  Share2,
  RefreshCw
} from 'lucide-react';
import api from '../lib/api';
import { getApiUrl } from '../lib/utils';
import { formatSeatAssignment } from '../lib/seatMapLoader';

export default function OrdenCompletadaPage() {
  const router = useRouter();
  const { session_id } = router.query;

  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [resendStatus, setResendStatus] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    if (!session_id) {
      setLoading(false);
      return;
    }

    const fetchTickets = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/tickets/tickets/by_session/', {
          params: { session_id }
        });
        const data = Array.isArray(res.data) ? res.data : (res.data?.tickets || []);
        setTickets(data);
      } catch (err: any) {
        console.error("Error fetching tickets by session:", err);
        setError(err.response?.data?.error || 'No se pudieron recuperar los detalles de los accesos.');
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [session_id]);

  const handleResendTicket = async (ticketId: number) => {
    setResendingId(ticketId);
    try {
      await api.post(`/tickets/tickets/${ticketId}/send_delivery_email/`);
      setResendStatus(prev => ({ ...prev, [ticketId]: '¡Enviado con éxito!' }));
      setTimeout(() => {
        setResendStatus(prev => {
          const updated = { ...prev };
          delete updated[ticketId];
          return updated;
        });
      }, 5000);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al reenviar.';
      setResendStatus(prev => ({ ...prev, [ticketId]: msg }));
    } finally {
      setResendingId(null);
    }
  };

  const firstTicket = tickets[0];
  const event = firstTicket?.event_details || firstTicket?.event;

  return (
    <div className="min-h-screen bg-slate-950 text-[#F4F6F0] selection:bg-amber-500/30 font-outfit pb-24">
      <Head>
        <title>Orden Completada | Ms Ámbar Accesos Oficiales</title>
        <meta name="description" content="Tus accesos oficiales para Ms Ámbar han sido confirmados exitosamente." />
      </Head>

      {/* Background ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[140px]" />
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-12 relative z-10">
        {/* Back Link */}
        <Link
          href="/comprar-boletos"
          className="inline-flex items-center gap-2 text-xs uppercase font-black tracking-widest text-slate-400 hover:text-amber-400 transition-colors mb-8"
        >
          <ArrowLeft size={14} />
          <span>Volver a Cartelera Oficial</span>
        </Link>

        {loading ? (
          <div className="py-24 text-center space-y-4">
            <RefreshCw size={36} className="text-amber-400 animate-spin mx-auto" />
            <p className="text-sm uppercase tracking-widest font-black text-slate-400">
              Cargando tus accesos oficiales...
            </p>
          </div>
        ) : error ? (
          <div className="p-8 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-center space-y-4">
            <p className="text-sm font-bold text-rose-400">{error}</p>
            <Link
              href="/comprar-boletos"
              className="inline-block px-6 py-3 rounded-xl bg-slate-800 text-white text-xs font-black uppercase tracking-wider"
            >
              Ir a Comprar Boletos
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Header Hero */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-3 bg-white/[0.02] border border-white/10 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10 mb-4">
                <CheckCircle2 size={32} />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest">
                <Sparkles size={12} />
                <span>Reserva Confirmada</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase italic tracking-tight text-white">
                ¡Tus Accesos Están Listos!
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                Hemos enviado tus pases digitales con código QR a tu correo electrónico. Puedes presentarlos en taquilla directamente desde tu celular.
              </p>
            </motion.div>

            {/* Event Summary Card */}
            {event && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 backdrop-blur-md"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                      Concierto Oficial
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white mt-0.5">
                      {event.title || 'Ms Ámbar en Vivo'}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
                      <MapPin size={12} className="text-amber-400" />
                      <span>{event.theater_name || 'Recinto Oficial'}</span>
                    </span>
                    {event.date && (
                      <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
                        <Calendar size={12} className="text-amber-400" />
                        <span>
                          {new Date(event.date).toLocaleDateString('es-MX', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tickets Grid */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-[0.2em] text-slate-400 px-1">
                Boletos Generados ({tickets.length})
              </h3>

              <div className="grid gap-4 md:grid-cols-2">
                {tickets.map((ticket, idx) => {
                  const seatAssignment = ticket.seat
                    ? formatSeatAssignment(ticket.seat)
                    : (ticket.seat_display || 'Entrada General');
                  const isComp = Number(ticket.amount_paid || 0) === 0;

                  return (
                    <motion.div
                      key={ticket.id || idx}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + idx * 0.05 }}
                      className="bg-white/[0.03] border border-white/10 hover:border-amber-400/40 rounded-3xl p-5 backdrop-blur-md space-y-4 transition-all shadow-lg"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border ${
                              isComp
                                ? 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30'
                                : 'bg-amber-400/15 text-amber-400 border-amber-400/30'
                            }`}>
                              {isComp ? 'Cortesía VIP ($0.00)' : 'Boleto Oficial'}
                            </span>
                            {ticket.has_mg && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                Meet & Greet
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-black text-white mt-1.5 font-mono">
                            {seatAssignment}
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            Titular: <strong className="text-slate-200">{ticket.user_name || ticket.user_email}</strong>
                          </p>
                        </div>

                        {/* Mini QR */}
                        <div className="p-2 bg-white rounded-xl shrink-0 shadow-md">
                          <QRCodeSVG
                            value={`${typeof window !== 'undefined' ? window.location.origin : 'https://msambar.com'}/tickets/${ticket.token}`}
                            size={56}
                            level="M"
                          />
                        </div>
                      </div>

                      {/* Ticket Footer / Actions */}
                      <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                        <Link
                          href={`/tickets/${ticket.token}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 border border-amber-400/30 text-xs font-black uppercase tracking-wider transition-all"
                        >
                          <TicketIcon size={13} />
                          <span>Ver Pase</span>
                          <ExternalLink size={11} />
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleResendTicket(ticket.id)}
                          disabled={resendingId === ticket.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-bold transition-all disabled:opacity-50"
                        >
                          <Mail size={13} />
                          <span>{resendingId === ticket.id ? 'Enviando...' : (resendStatus[ticket.id] || 'Reenviar')}</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/comprar-boletos"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs uppercase tracking-[0.2em] text-center hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-amber-500/20"
              >
                Volver a la Taquilla
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
