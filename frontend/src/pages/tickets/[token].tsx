import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Calendar, MapPin, Armchair, Mail, ChevronLeft, ShieldCheck, AlertCircle } from 'lucide-react';

const formatoHoraOficial = (fechaString: string) => {
  if (!fechaString) return "--:--";
  try {
    const fecha = new Date(fechaString);
    return fecha.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Mexico_City'
    });
  } catch (e) {
    return "--:--";
  }
};

const formatoDiaOficial = (fechaString: string) => {
  if (!fechaString) return "Fecha por confirmar";
  try {
    const fecha = new Date(fechaString);
    const formatted = fecha.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Mexico_City'
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch (e) {
    return "Fecha por confirmar";
  }
};

export default function TicketPage() {
  const router = useRouter();
  const { token } = router.query;
  const [ticket, setTicket] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const getApiUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== 'undefined' && window.location.origin.includes('github.dev')
        ? window.location.origin.replace(window.location.port, '8000') + '/api'
        : 'http://localhost:8000/api');
  };

  useEffect(() => {
    if (!token) return;
    const apiUrl = getApiUrl();
    setLoading(true);
    setError(null);

    // Paso 1: Recuperar el boleto digital por Token UUID
    fetch(`${apiUrl}/tickets/tickets/${token}/`)
      .then(res => {
        if (!res.ok) {
          throw new Error('El boleto digital especificado no existe o es inválido.');
        }
        return res.json();
      })
      .then(ticketData => {
        setTicket(ticketData);

        // Paso 2: Usar el ID del evento que viene en el boleto para traer el recinto seguro
        const eventId = ticketData.event?.id || ticketData.event;
        if (!eventId) {
          throw new Error('No se pudo asociar el evento vinculado a este acceso.');
        }

        return fetch(`${apiUrl}/tickets/events/${eventId}/`);
      })
      .then(res => {
        if (!res.ok) {
          throw new Error('El concierto asociado a este boleto no está disponible.');
        }
        return res.json();
      })
      .then(eventData => {
        setEvent(eventData);
      })
      .catch(err => {
        console.error("Falla en el pipeline de accesos:", err);
        setError(err.message || 'Error de conexión al validar tus accesos oficiales.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const handleValidateTicket = async () => {
    if (!token || isValidating) return;
    setIsValidating(true);
    const apiUrl = getApiUrl();
    const jwtToken = localStorage.getItem('token');

    try {
      const res = await fetch(`${apiUrl}/tickets/tickets/validate/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': jwtToken ? `Bearer ${jwtToken}` : ''
        },
        body: JSON.stringify({ token })
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav');
          audio.volume = 0.5;
          audio.play();
        } catch (e) {
          console.warn("Audio play blocked/failed:", e);
        }

        setTicket((prev: any) => ({
          ...prev,
          is_scanned: true,
          scanned_at: new Date().toISOString()
        }));
      } else {
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/911/911-84.wav');
          audio.volume = 0.5;
          audio.play();
        } catch (e) {
          console.warn("Audio play blocked/failed:", e);
        }
        alert(data.message || data.error || 'Error al validar el boleto.');
      }
    } catch (err) {
      console.error("Validation error:", err);
      alert('Error de red al intentar validar el boleto.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-amber-500/30">
      <Head>
        <title>Boleto Digital | Ms Ambar</title>
      </Head>

      {/* Decorative Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-600/5 blur-[120px] pointer-events-none" />

      {/* Back Button */}
      <div className="w-full max-w-md mb-6 z-10">
        <Link
          href="/comprar-boletos"
          className="inline-flex items-center text-xs text-neutral-400 hover:text-amber-500 transition-colors duration-200 group"
        >
          <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-0.5 transition-transform duration-200" />
          Volver a Fechas del Tour
        </Link>
      </div>

      {/* Staff Verification HUD */}
      {isStaff && ticket && (
        <div className="w-full max-w-md mb-6 z-10">
          <div className="bg-neutral-950 border border-amber-500/20 p-5 rounded-3xl shadow-xl flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-[6rem] pointer-events-none" />
            <div className="flex items-center gap-2 text-amber-500">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] font-mono">Panel de Control Staff</span>
            </div>

            {ticket.is_scanned ? (
              <div className="bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl text-center">
                <p className="text-red-400 text-xs font-black uppercase tracking-wider font-mono">Acceso Denegado</p>
                <p className="text-[10px] text-neutral-400 font-mono mt-1">
                  Usado el: {formatoDiaOficial(ticket.scanned_at)} a las {formatoHoraOficial(ticket.scanned_at)} hrs
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-center">
                  <p className="text-emerald-400 text-xs font-black uppercase tracking-wider font-mono">Acceso Autorizado</p>
                  <p className="text-[9px] text-neutral-400 font-medium mt-0.5">Boleto válido y listo para ingreso</p>
                </div>
                <button
                  onClick={handleValidateTicket}
                  disabled={isValidating}
                  className="w-full py-3 bg-gradient-to-r from-amber-400 via-amber-50 to-amber-600 text-neutral-950 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] font-mono shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isValidating ? 'Registrando Acceso...' : 'Registrar Acceso / Validar QR'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 z-10"
          >
            <div className="w-12 h-12 rounded-full border-2 border-t-amber-500 border-neutral-800 animate-spin mb-4" />
            <p className="text-xs text-neutral-400 font-mono tracking-widest uppercase">Cargando boleto...</p>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-md bg-neutral-900/60 backdrop-blur-xl border border-red-500/20 p-8 rounded-3xl text-center shadow-2xl z-10"
          >
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">Boleto no encontrado</h2>
            <p className="text-sm text-neutral-400 mb-6">{error}</p>
            <Link
              href="/comprar-boletos"
              className="inline-block bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs px-6 py-3 rounded-xl transition-all duration-200"
            >
              Ir al Tour
            </Link>
          </motion.div>
        ) : (
          <motion.div
            key="ticket"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-[32px] overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.05)] z-10"
          >
            {/* Holographic Top Banner */}
            <div className="relative py-6 px-8 bg-gradient-to-r from-amber-600/20 via-amber-500/10 to-amber-600/20 border-b border-neutral-800 text-center flex flex-col items-center">
              <div className="absolute inset-0 bg-neutral-950/20 mix-blend-overlay pointer-events-none" />
              <img src="/logos/ms_ambar_logo_b.png" alt="Ms Ambar" className="h-8 w-auto object-contain mb-1" />
              <p className="text-amber-500 text-[10px] font-mono uppercase tracking-[0.3em] mt-1 font-bold">BOLETO DIGITAL OFICIAL</p>
            </div>

            {/* QR Section */}
            <div className="p-8 flex flex-col items-center border-b border-dashed border-neutral-800 relative">
              <div className="absolute left-[-12px] bottom-[-12px] w-6 h-6 rounded-full bg-neutral-950 border border-neutral-800" />
              <div className="absolute right-[-12px] bottom-[-12px] w-6 h-6 rounded-full bg-neutral-950 border border-neutral-800" />

              <div className="bg-white p-4 rounded-3xl shadow-[0_0_30px_rgba(255,255,255,0.08)] mb-6 transition-transform duration-300 hover:scale-105">
                <QRCodeSVG
                  value={JSON.stringify({
                    token: ticket.token,
                    event: ticket.event_title,
                    seat: ticket.seat_display
                  })}
                  size={200}
                  level="H"
                />
              </div>

              {ticket.is_scanned ? (
                <div className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 px-3 py-1.5 rounded-full text-red-500 text-[10px] font-mono uppercase tracking-wider font-bold">
                  <AlertCircle className="w-3.5 h-3.5 animate-pulse" />
                  Boleto Ya Utilizado
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-full text-emerald-400 text-[10px] font-mono uppercase tracking-wider font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Boleto Verificado y Activo
                </div>
              )}
            </div>

            {/* Ticket Info Section */}
            {ticket && event && (
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  <div className="col-span-2">
                    <span className="text-[10px] uppercase text-neutral-500 font-mono tracking-widest block mb-1">Artista</span>
                    <span className="font-semibold text-lg text-white block">{ticket.event_artist || event.artist || 'Ms Ambar'}</span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-[10px] uppercase text-neutral-500 font-mono tracking-widest block mb-1">Evento</span>
                    <span className="font-semibold text-sm text-neutral-200 block">{ticket.event_title || event.title}</span>
                  </div>

                  <div className="col-span-2">
                    <div className="flex items-start gap-2.5">
                      <Calendar className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[10px] uppercase text-neutral-500 font-mono tracking-widest block mb-0.5">Fecha y Hora</span>
                        <span className="text-xs text-neutral-200 font-medium block capitalize">
                          {formatoDiaOficial(event.date)}
                        </span>
                        <span className="text-[10px] text-amber-500 font-bold block tracking-wider uppercase mt-1">
                          🚪 Acceso: {formatoHoraOficial(event.doors_open)} hrs • 🎸 Show: {formatoHoraOficial(event.date)} hrs
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[10px] uppercase text-neutral-500 font-mono tracking-widest block mb-0.5">Lugar</span>
                        <span className="text-xs text-neutral-200 font-medium block">{event.venue_name}</span>
                        <span className="text-[10px] text-neutral-500 block leading-tight mt-0.5">{event.venue_address}</span>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <div className="flex items-start gap-2.5">
                      <Armchair className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[10px] uppercase text-neutral-500 font-mono tracking-widest block mb-0.5">Ubicación</span>
                        <span className="text-xs text-neutral-200 font-medium block">
                          {ticket.seat_display || (ticket.seat ? `Fila ${ticket.seat_row} • Asiento ${ticket.seat_number}` : 'Pase General')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 pt-4 border-t border-neutral-800/80">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-neutral-500 shrink-0" />
                      <div>
                        <span className="text-[10px] uppercase text-neutral-500 font-mono tracking-widest block">Propietario</span>
                        <span className="text-xs text-neutral-300 font-mono break-all">{ticket.user_email}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dotted separator for footer */}
                <div className="pt-6 border-t border-dashed border-neutral-800">
                  <span className="text-[9px] uppercase text-neutral-600 font-mono tracking-widest block text-center mb-1">ID Único de Entrada</span>
                  <span className="font-mono text-[10px] text-center text-neutral-400 block break-all tracking-wider">{ticket.token}</span>
                </div>
              </div>
            )}

            {/* Accent Footer */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-4 text-center">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-950">
                PRESENTA ESTE CÓDIGO QR EN LA ENTRADA
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}