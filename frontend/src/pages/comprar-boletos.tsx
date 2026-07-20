import * as React from 'react';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import SeatingChart from '../components/SeatingChart';
import TourTimeline from '../components/TourTimeline';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ticket, Users, MapPin, Calendar, CalendarX, Star, Sparkles, Minus, Plus, X, CheckCircle, Info, ShieldCheck
} from 'lucide-react';
import { cn } from '../lib/utils';
import axios from 'axios';
import { showAlert } from '../lib/notifications';

// ── Stripe Fee Mirror (same formula as backend fees.py) ──────────────────────
const STRIPE_PCT_FEE = 0.036;   // 3.6%
const STRIPE_FLAT_FEE = 3.00;   // $3.00 MXN

const calculateTotalWithFee = (baseAmount: number): { base_price: number; service_fee: number; total: number } => {
  if (baseAmount <= 0) return { base_price: 0, service_fee: 0, total: 0 };
  const total = baseAmount;
  const service_fee = baseAmount * STRIPE_PCT_FEE + STRIPE_FLAT_FEE;
  const base_price = total - service_fee;
  return {
    base_price: Math.round(base_price * 100) / 100,
    service_fee: Math.round(service_fee * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
};

// ── Price Breakdown Component ────────────────────────────────────────────────
const PriceBreakdown = ({ baseTotal, label = 'Precio Base' }: { baseTotal: number; label?: string }) => {
  const { base_price, service_fee, total } = calculateTotalWithFee(baseTotal);
  if (baseTotal <= 0) return null;

  return (
    <div className="space-y-2 border-t border-nature-night/10 pt-4 mt-4">
      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-nature-night/60">
        <span>{label}</span>
        <span>${base_price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</span>
      </div>
      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-amber-600">
        <span className="flex items-center gap-1.5">
          <Info size={10} />
          Cargo de servicio
        </span>
        <span>+${service_fee.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</span>
      </div>
      <div className="flex justify-between items-end pt-2 border-t border-nature-night/10">
        <div>
          <p className="text-[9px] uppercase font-bold text-nature-night/50 tracking-[0.25em] mb-1">Total a Pagar</p>
          <p className="text-3xl font-black leading-none text-amber-honey">${Math.ceil(total).toLocaleString('es-MX')} MXN</p>
        </div>
        <Users size={18} className="text-nature-night/30 mb-1" />
      </div>
      <p className="text-[8px] text-nature-night/40 leading-relaxed">
        El precio incluye un cargo de servicio de plataforma (Stripe MX). El monto final a pagar es ${Math.ceil(total).toLocaleString('es-MX')} MXN.
      </p>
    </div>
  );
};

// ── Ultra-Premium CTA Button ─────────────────────────────────────────────────
const PremiumCTAButton = ({
  onClick, disabled, children
}: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) => (
  <motion.button
    whileHover={disabled ? {} : { scale: 1.015 }}
    whileTap={disabled ? {} : { scale: 0.985 }}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "relative w-full overflow-hidden rounded-2xl py-6 px-8 font-black text-[11px] uppercase tracking-[0.3em] transition-all duration-300",
      "bg-gradient-to-r from-amber-400 via-amber-honey to-amber-600 text-nature-night",
      "shadow-[0_8px_32px_rgba(245,158,11,0.35)] hover:shadow-[0_12px_48px_rgba(245,158,11,0.55)]",
      "disabled:opacity-30 disabled:grayscale disabled:pointer-events-none"
    )}
  >
    {/* Shimmer sweep on hover */}
    {!disabled && (
      <span className="absolute inset-0 -translate-x-full hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
    )}
    <span className="relative z-10 flex items-center justify-center gap-3">
      <ShieldCheck size={16} className="shrink-0" />
      {children}
      <Sparkles size={14} className="shrink-0 animate-pulse" />
    </span>
  </motion.button>
);

// ── Main TourPage Component ──────────────────────────────────────────────────
const TourPage = () => {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [currentEvent, setCurrentEvent] = useState<any>(null);
  const [seats, setSeats] = useState<any[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [wantsMG, setWantsMG] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [elements, setElements] = useState<any[]>([]);
  const [pageSubtitle, setPageSubtitle] = useState('Selecciona tu concierto, explora el mapa de asientos interactivo y reserva tus boletos oficiales.');

  // Meet & Greet and Checkout states
  const [mgQuantity, setMgQuantity] = useState(1);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [createdTickets, setCreatedTickets] = useState<any[]>([]);

  const getApiUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== 'undefined' && window.location.origin.includes('github.dev')
        ? window.location.origin.replace(window.location.port, '8000') + '/api'
        : 'http://localhost:8000/api');
  };

  // ── Handle returning from Stripe Checkout (Asynchronous Resilient Webhook Sync) ──
  useEffect(() => {
    if (!router.isReady) return;
    const { success, session_id } = router.query;

    if (success === 'true' && session_id) {
      setIsLoading(true);
      const apiUrl = getApiUrl();
      let attempts = 0;
      const maxAttempts = 5;

      // Función de Polling para esperar pacientemente a que el Webhook procese el pago
      const checkTicketsStatus = async () => {
        try {
          const res = await fetch(`${apiUrl}/tickets/tickets/by_session/?session_id=${session_id}`);

          if (res.status === 204 || res.status === 404) {
            // El Webhook aún se está ejecutando en el backend de Django
            if (attempts < maxAttempts) {
              attempts++;
              setTimeout(checkTicketsStatus, 1500); // Reintentar en 1.5 segundos
              return;
            } else {
              throw new Error('El pago se procesó, pero los boletos están tardando en generarse. Por favor revisa tu correo electrónico.');
            }
          }

          if (!res.ok) throw new Error('No se pudieron recuperar los boletos.');

          const tickets = await res.json();
          if (tickets && tickets.length > 0) {
            setCreatedTickets(tickets);
            setEmail(tickets[0].user_email || '');
            setFullName(tickets[0].full_name || tickets[0].user_name || '');
            setCheckoutSuccess(true);
            setIsCheckoutOpen(true);

            showAlert("Tus accesos oficiales han sido validados con éxito.", "¡Reserva Confirmada!", "success");

            // Limpiar la URL del navegador sin recargar para estética premium
            router.replace('/comprar-boletos', undefined, { shallow: true });
            setIsLoading(false);
          }
        } catch (err: any) {
          console.error("Error retrieving tickets by session:", err);
          showAlert(err.message || "Hubo un error al recuperar tus boletos.", "Verificación en Proceso", "warning");
          setIsLoading(false);
        }
      };

      // Iniciamos la verificación
      checkTicketsStatus();
    }
  }, [router.isReady, router.query]);

  useEffect(() => {
    setIsMounted(true);
    document.documentElement.setAttribute('data-theme', theme);
    const apiUrl = getApiUrl();

    // Fetch events and site settings in parallel
    Promise.all([
      fetch(`${apiUrl}/tickets/events/`).then(r => r.json()),
      fetch(`${apiUrl}/tickets/settings/`).then(r => r.json()).catch(() => null),
    ]).then(([eventsData, settingsData]) => {
      if (eventsData && Array.isArray(eventsData) && eventsData.length > 0) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const activeEvents = eventsData.filter((e: any) => e.is_active !== false);
        setEvents(activeEvents);

        const upcomingEvents = activeEvents.filter((e: any) => {
          if (!e.date) return true;
          return new Date(e.date) >= startOfToday;
        });

        if (upcomingEvents.length > 0) {
          setCurrentEvent(upcomingEvents[0]);
        } else if (activeEvents.length > 0) {
          setCurrentEvent(activeEvents[0]);
        } else {
          setCurrentEvent(null);
        }
      }
      if (settingsData?.tickets_page_subtitle) {
        setPageSubtitle(settingsData.tickets_page_subtitle);
      }
      setIsLoading(false);
    }).catch(err => {
      console.error("Error fetching data:", err);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!currentEvent) return;
    const apiUrl = getApiUrl();

    fetch(`${apiUrl}/tickets/events/${currentEvent.id}/seats/`)
      .then(res => res.json())
      .then(data => {
        if (data.seats) {
          setSeats(data.seats);
          setElements(data.elements || []);
        } else {
          setSeats(data);
          setElements([]);
        }
      })
      .catch(err => console.error("Error fetching seats:", err));
  }, [currentEvent]);

  const handleSelectionChange = (ids: string[]) => {
    const selectedObjects = ids.map(id => {
      return seats.find(s => String(s.id) === id);
    }).filter(Boolean);
    setSelectedSeats(selectedObjects);
  };

  const getSeatBasePrice = (seat: any) => {
    if (!seat) return 0;
    const base = Number(seat.base_price || 0);
    const mult = Number(currentEvent?.price_multiplier || 1);
    return Math.round(base * mult);
  };

  const isMeetGreet = currentEvent?.event_type === 'meet_greet';
  const isCurrentEventPast = React.useMemo(() => {
    if (!currentEvent?.date) return false;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return new Date(currentEvent.date) < startOfToday;
  }, [currentEvent]);

  const seatsBaseTotal = isMeetGreet ? 0 : selectedSeats.reduce((acc, seat) => acc + getSeatBasePrice(seat), 0);
  const mgBaseTotal = isMeetGreet
    ? mgQuantity * Number(currentEvent?.mg_price || 0)
    : (wantsMG ? Number(currentEvent?.mg_price || 0) : 0);
  const baseTotal = seatsBaseTotal + mgBaseTotal;

  const { base_price: checkoutBasePrice, service_fee: checkoutServiceFee, total: checkoutTotal } = calculateTotalWithFee(baseTotal);

  // EDGE CASE SUCCESS CALCULATOR: Extrae el costo bruto real de la orden devuelta por Django
  const getCreatedTicketsTotalAmount = () => {
    if (!createdTickets || createdTickets.length === 0) return 0;

    if (createdTickets[0].seat_display === 'Meet & Greet' && !createdTickets[0].seat) {
      return createdTickets.length * Number(currentEvent?.mg_price || 0);
    }

    return createdTickets.reduce((acc, ticket) => {
      const baseSeatPrice = ticket.seat_details?.base_price || ticket.base_price || 0;
      const multiplier = Number(currentEvent?.price_multiplier || 1);
      let seatCost = Number(baseSeatPrice) * multiplier;

      if (ticket.has_mg && currentEvent?.event_type !== 'meet_greet') {
        seatCost += Number(currentEvent?.mg_price || 0);
      }
      return acc + seatCost;
    }, 0);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName) return;
    setIsSubmitting(true);

    try {
      const apiUrl = getApiUrl();
      const res = await axios.post(`${apiUrl}/tickets/tickets/checkout/`, {
        email,
        event_id: currentEvent.id,
        seat_ids: isMeetGreet ? [] : selectedSeats.map(s => s.id),
        quantity: isMeetGreet ? mgQuantity : 1,
        phone,
        has_mg: isMeetGreet ? true : wantsMG
      });

      if (res.data.session_url) {
        window.location.href = res.data.session_url;
      } else {
        setCreatedTickets(res.data.tickets || []);
        setCheckoutSuccess(true);
        setSelectedSeats([]);
        setWantsMG(false);
      }
    } catch (err) {
      console.error("Error during checkout:", err);
      showAlert("Hubo un error al procesar la reserva. Por favor intenta de nuevo.", "Error de Reserva", "error");
    } finally {
      setIsSubmitting(false);
    }
  };
  const availableSeatsCount = React.useMemo(() => {
    if (!seats || seats.length === 0) return 0;
    return seats.filter(s => s.status === 'available').length;
  }, [seats]);

  const totalSeatsCount = React.useMemo(() => {
    return seats ? seats.length : 0;
  }, [seats]);

  const occupancyPercentage = React.useMemo(() => {
    if (totalSeatsCount === 0) return 0;
    return Math.round(((totalSeatsCount - availableSeatsCount) / totalSeatsCount) * 100);
  }, [availableSeatsCount, totalSeatsCount]);

  return (
    <div className="selection:bg-amber-honey/30 overflow-x-hidden font-outfit text-nature-night dark:text-[#F4F6F0] min-h-screen pb-24 lg:pb-12">
      <Head>
        <title>Ms Ambar | Accesos Oficiales 2026</title>
        <meta name="description" content="MS Ambar Accesos Oficiales 2026. Reserva tus entradas y vive la experiencia acústico-visual de vanguardia." />
      </Head>

      {/* ─── Header Section ─── */}
      <section className="pt-8 pb-10 max-w-[1600px] mx-auto px-6 md:px-10 text-center relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-15%] w-[45%] h-[45%] bg-amber-honey/5 blur-[120px] rounded-full pointer-events-none animate-pulse" />
        <div className="max-w-4xl mx-auto space-y-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 bg-amber-honey/10 border border-amber-honey/20 px-4 py-2 rounded-full w-fit mx-auto"
          >
            <Sparkles size={12} className="text-amber-honey animate-spin" />
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-honey">Reserva Oficial</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter uppercase italic leading-tight px-2 py-2"
          >
            ACCESOS <span className="text-glow text-gradient bg-gradient-to-r from-amber-400 via-amber-honey to-amber-700 bg-clip-text text-transparent px-2">OFICIALES 2026</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-nature-night/70 dark:text-[#F4F6F0]/70 text-xs md:text-sm uppercase tracking-[0.35em] max-w-2xl mx-auto leading-relaxed"
          >
            {pageSubtitle}
          </motion.p>
        </div>
      </section>

      {/* ─── Main Reservation Section ─── */}
      <section className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10">
        <TourTimeline
          events={events}
          onEventSelect={(event) => {
            setCurrentEvent(event);
            setSelectedSeats([]);
            setWantsMG(false);
            setMgQuantity(1);
            setCheckoutSuccess(false);
            setCreatedTickets([]);
          }}
          currentEvent={currentEvent}
        />

        {/* Side-by-Side Main Container (Seating Canvas Left, Cart Summary Right) */}
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-12 mt-10 items-start">

          {/* ══════ LEFT COLUMN: Event Details + Seating Chart (col-span-7/8) ══════ */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">

            {/* Event Info Card & Remaining Tickets Counter Header */}
            <div className="p-6 md:p-8 rounded-[2.5rem] bg-nature-night/[0.02] dark:bg-white/[0.02] border border-nature-night/10 dark:border-white/10 backdrop-blur-md space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <motion.h2
                    key={currentEvent?.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight uppercase italic leading-tight"
                  >
                    {currentEvent ? currentEvent.title : 'Selecciona un Concierto...'}
                  </motion.h2>
                  <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-widest font-black mt-3">
                    <div className="flex items-center gap-2 bg-nature-night/5 dark:bg-white/5 border border-nature-night/10 dark:border-white/10 px-4 py-2 rounded-full">
                      <MapPin size={13} className="text-amber-honey" />
                      <span>{currentEvent?.theater_name || (isMeetGreet ? 'Meet & Greet' : 'Cargando Recinto...')}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-nature-night/5 dark:bg-white/5 border border-nature-night/10 dark:border-white/10 px-4 py-2 rounded-full">
                      <Calendar size={13} className="text-amber-honey" />
                      <span>{currentEvent?.date ? new Date(currentEvent.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</span>
                    </div>
                  </div>
                </div>

                {/* Remaining Tickets Counter Badge */}
                {!isMeetGreet && totalSeatsCount > 0 && (
                  <div className="flex flex-col items-start md:items-end gap-1.5 p-4 rounded-2xl bg-amber-honey/10 border border-amber-honey/20 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-honey">Disponibilidad en Vivo</span>
                    </div>
                    <p className="text-xl font-black uppercase text-nature-night dark:text-white leading-none">
                      {availableSeatsCount} <span className="text-xs text-nature-night/50 dark:text-white/50 font-semibold">/ {totalSeatsCount} Butacas</span>
                    </p>
                    <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden mt-1">
                      <div className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-700" style={{ width: `${100 - occupancyPercentage}%` }} />
                    </div>
                  </div>
                )}

                {isMeetGreet && (
                  <div className="flex flex-col items-start md:items-end gap-1.5 p-4 rounded-2xl bg-amber-honey/10 border border-amber-honey/20 shrink-0">
                    <div className="flex items-center gap-2">
                      <Star size={14} className="text-amber-honey fill-current animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-honey">Pases de Convivencia</span>
                    </div>
                    <p className="text-xl font-black uppercase text-nature-night dark:text-white leading-none">
                      {currentEvent?.mg_available || 0} <span className="text-xs text-nature-night/50 dark:text-white/50 font-semibold">Disponibles</span>
                    </p>
                  </div>
                )}
              </div>

              {isCurrentEventPast && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-5 py-2.5 rounded-full w-fit">
                  <CalendarX size={14} className="text-amber-600 dark:text-amber-400" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">Evento Concluido (Modo Informativo)</span>
                </div>
              )}
            </div>

            {/* Seating Chart Interactive Canvas Container */}
            {!isMeetGreet && (
              <div className="relative group rounded-[2.5rem] overflow-hidden border border-nature-night/10 dark:border-white/10 shadow-2xl bg-[#0b0d17]">
                {/* Header Toolbar Legend for Canvas */}
                <div className="px-6 py-4 bg-black/40 backdrop-blur-md border-b border-white/10 flex flex-wrap items-center justify-between gap-4 text-[10px] font-black uppercase tracking-wider text-white/70">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-[#22a6b3] border border-white/30" /> Disponible
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-[#E5A93B] shadow-[0_0_8px_#E5A93B]" /> Tu Selección
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-white/20 border border-white/10" /> Reservado
                    </span>
                  </div>
                  <span className="text-[9px] text-white/40 tracking-widest hidden sm:block">
                    Arrastra o usa rueda del ratón para explorar
                  </span>
                </div>

                {isLoading ? (
                  <div className="h-[480px] lg:h-[580px] flex flex-col items-center justify-center gap-3 bg-nature-night/[0.01] dark:bg-white/[0.01]">
                    <div className="w-10 h-10 rounded-full border-4 border-amber-honey/20 border-t-amber-honey animate-spin" />
                    <div className="text-amber-honey animate-pulse font-extrabold text-xs uppercase tracking-[0.4em]">Tejiendo la Planta del Venue...</div>
                  </div>
                ) : (
                  <div className={cn(
                    "h-[480px] lg:h-[580px] relative w-full",
                    isCurrentEventPast && "pointer-events-none opacity-85"
                  )}>
                    {isCurrentEventPast && (
                      <div className="absolute inset-0 bg-nature-night/40 backdrop-blur-[2px] z-30 flex items-center justify-center p-6 text-center">
                        <div className="bg-white/95 dark:bg-nature-night/95 backdrop-blur-md p-6 rounded-3xl border border-amber-honey/30 shadow-2xl max-w-sm">
                          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-honey mb-1">Mapa Informativo</p>
                          <p className="text-sm font-black text-nature-night dark:text-white uppercase">Venta Concluida para este Recinto</p>
                        </div>
                      </div>
                    )}
                    <SeatingChart
                      seats={seats}
                      onSelect={handleSelectionChange}
                      selectedIds={selectedSeats.map(s => String(s.id))}
                      theme={theme}
                      elements={elements}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Flyer / Meet & Greet Details Card */}
            <div className="grid md:grid-cols-2 gap-6 items-stretch">
              {currentEvent?.flyer_url && (
                <div className="relative rounded-[2.5rem] overflow-hidden border border-amber-honey/20 group shadow-xl shadow-amber-honey/5 aspect-[4/3] md:aspect-auto">
                  <div className="absolute inset-0 bg-gradient-to-t from-nature-night/80 via-nature-night/20 to-transparent z-10 pointer-events-none" />
                  <img
                    src={currentEvent.flyer_url}
                    alt={`Flyer oficial: ${currentEvent.title}`}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute bottom-6 left-8 z-20">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-honey">Flyer Oficial</span>
                    <h3 className="text-xl font-black text-white uppercase italic">{currentEvent.title}</h3>
                  </div>
                </div>
              )}

              {isMeetGreet && (
                <div className="p-8 rounded-[2.5rem] border border-nature-night/10 dark:border-white/10 bg-nature-night/[0.02] dark:bg-white/[0.02] space-y-5">
                  <div className="flex items-center gap-3 text-amber-honey">
                    <Star className="fill-current animate-pulse" size={20} />
                    <h3 className="text-lg font-black uppercase tracking-wider">Experiencia Convivencia</h3>
                  </div>
                  <p className="text-xs leading-relaxed opacity-80">
                    Vive una experiencia cercana y exclusiva con Ms Ambar. Este pase especial te permite compartir momentos únicos, firmar autógrafos y tomarse fotografías oficiales.
                  </p>
                  <ul className="space-y-2.5 text-[10px] font-bold uppercase tracking-wider opacity-75">
                    <li className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-amber-honey" />
                      Acceso exclusivo al venue de convivencia
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-amber-honey" />
                      Firma de autógrafos y posters de colección
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-amber-honey" />
                      Fotografía digital oficial individual
                    </li>
                  </ul>
                </div>
              )}
            </div>

          </div>

          {/* ══════ RIGHT COLUMN: Sticky Cart Summary Side Panel (col-span-5/4) ══════ */}
          <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-8 space-y-6">
            <motion.div layout className="border border-nature-night/15 bg-white text-nature-night shadow-2xl shadow-nature-night/10 p-6 md:p-8 rounded-[3rem]">
              <div className="text-center mb-6 border-b border-nature-night/10 pb-5">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Ticket size={16} className="text-amber-honey" />
                  <h3 className="text-2xl font-black uppercase tracking-wider">Reserva Digital</h3>
                </div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-nature-night/50 font-bold">Reserva directa mediante Néctar Gateway</p>
              </div>

              {isCurrentEventPast ? (
                <div className="my-6 p-6 rounded-[2rem] bg-nature-night/[0.03] border border-amber-honey/30 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-honey/15 border border-amber-honey/40 flex items-center justify-center mx-auto text-amber-honey shadow-lg">
                    <CalendarX size={20} />
                  </div>
                  <h4 className="text-lg font-black uppercase tracking-wider text-nature-night">Venta Cerrada</h4>
                  <p className="text-xs text-nature-night/70 leading-relaxed font-medium">
                    Este evento ha finalizado. La venta de accesos se encuentra cerrada.
                  </p>
                </div>
              ) : (
                <>
                  {isMeetGreet && (
                    <div className="mb-6 p-5 rounded-[2rem] bg-nature-night/[0.03] border border-nature-night/10 text-center space-y-4">
                      <p className="text-[10px] font-black uppercase text-amber-honey tracking-[0.2em]">Cantidad de Boletos</p>
                      <div className="flex items-center justify-center gap-6">
                        <button
                          onClick={() => setMgQuantity(Math.max(1, mgQuantity - 1))}
                          className="w-11 h-11 rounded-full bg-nature-night/5 hover:bg-amber-honey/20 border border-nature-night/10 flex items-center justify-center font-bold text-nature-night transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-3xl font-black min-w-[2rem] text-center text-nature-night">{mgQuantity}</span>
                        <button
                          onClick={() => setMgQuantity(mgQuantity + 1)}
                          className="w-11 h-11 rounded-full bg-nature-night/5 hover:bg-amber-honey/20 border border-nature-night/10 flex items-center justify-center font-bold text-nature-night transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold uppercase text-nature-night/40 tracking-widest">Precio Unitario</p>
                        <p className="text-xl font-black text-nature-night">${Number(currentEvent?.mg_price || 0).toLocaleString()} MXN</p>
                      </div>
                    </div>
                  )}

                  {!isMeetGreet && (
                    <div
                      onClick={() => currentEvent?.mg_available > 0 && setWantsMG(!wantsMG)}
                      className={cn(
                        "mb-5 p-4.5 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden",
                        wantsMG ? "bg-amber-honey border-amber-honey text-nature-night" : "bg-nature-night/[0.02] border-nature-night/10 hover:border-amber-honey/30"
                      )}
                    >
                      <div className="flex items-center gap-3.5 relative z-10">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500",
                          wantsMG ? "bg-nature-night text-amber-honey rotate-12" : "bg-amber-honey text-nature-night"
                        )}>
                          <Star size={18} fill="currentColor" />
                        </div>
                        <div>
                          <h4 className="font-black text-xs uppercase tracking-widest text-nature-night">Meet & Greet Pase</h4>
                          <p className={cn("text-[9px] font-bold uppercase tracking-widest mt-0.5", wantsMG ? "text-nature-night/70" : "text-amber-honey")}>
                            {currentEvent?.mg_available > 0 ? `${currentEvent.mg_available} Pases Disponibles` : 'Agotado'}
                          </p>
                        </div>
                      </div>
                      {!wantsMG && <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-black opacity-60 text-nature-night italic">
                        {currentEvent ? `+$${Number(currentEvent.mg_price).toLocaleString()}` : ''}
                      </span>}
                    </div>
                  )}

                  {/* Selected Seats List */}
                  <div className="space-y-2.5 mb-5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                    {isMeetGreet ? (
                      <div className="flex justify-between items-center bg-nature-night/[0.02] p-3.5 rounded-xl border border-nature-night/10">
                        <div>
                          <p className="text-[9px] font-black text-amber-honey uppercase tracking-wider">Meet & Greet</p>
                          <p className="text-xs font-bold text-nature-night/80">{mgQuantity} Pase(s) de Convivencia</p>
                        </div>
                        <span className="font-extrabold text-xs text-nature-night">${(mgQuantity * Number(currentEvent?.mg_price || 0)).toLocaleString()} MXN</span>
                      </div>
                    ) : (
                      <>
                        <AnimatePresence mode="popLayout">
                          {selectedSeats.map(seat => (
                            <motion.div
                              key={seat.id}
                              initial={{ opacity: 0, x: -15 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="flex justify-between items-center bg-nature-night/[0.02] p-3.5 rounded-xl border border-nature-night/10"
                            >
                              <div>
                                <p className="text-[9px] font-black text-amber-honey uppercase tracking-wider">{seat.category}</p>
                                <p className="text-xs font-bold text-nature-night/80">Fila {seat.row} • Asiento {seat.number}</p>
                              </div>
                              <span className="font-extrabold text-xs text-nature-night">${getSeatBasePrice(seat).toLocaleString()} MXN</span>
                            </motion.div>
                          ))}
                        </AnimatePresence>

                        {selectedSeats.length === 0 && (
                          <div className="py-10 text-center border border-dashed border-nature-night/20 rounded-2xl opacity-50">
                            <Ticket className="mx-auto mb-2 text-nature-night/40" size={28} />
                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-nature-night/60">Toca un asiento en el mapa interactivo</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Price Breakdown */}
                  {baseTotal > 0 ? (
                    <PriceBreakdown baseTotal={baseTotal} label="Subtotal boletos" />
                  ) : (
                    <div className="pt-4 border-t border-nature-night/10 mb-4">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[9px] uppercase font-bold text-nature-night/50 tracking-[0.25em] mb-1">Total</p>
                          <p className="text-3xl font-black leading-none text-amber-honey">$0 MXN</p>
                        </div>
                        <Users size={18} className="text-nature-night/30 mb-1" />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="mt-6 w-full">
                <PremiumCTAButton
                  disabled={isCurrentEventPast || (isMeetGreet ? false : selectedSeats.length === 0)}
                  onClick={() => !isCurrentEventPast && setIsCheckoutOpen(true)}
                >
                  <span className="text-base md:text-lg font-black uppercase tracking-[0.15em] block">
                    {isCurrentEventPast ? 'Venta Finalizada' : 'Proceder al Pago'}
                  </span>
                </PremiumCTAButton>
              </div>
            </motion.div>
          </div>

        </div>

        {/* ─── MOBILE STICKY BOTTOM BAR (Celulares / Dispositivos Móviles) ─── */}
        {!isCurrentEventPast && (selectedSeats.length > 0 || isMeetGreet) && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] bg-nature-night/95 dark:bg-[#0B0F0D]/95 backdrop-blur-xl border-t border-white/10 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            <div className="max-w-md mx-auto flex items-center justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-honey">
                  {isMeetGreet ? `${mgQuantity} Pase(s)` : `${selectedSeats.length} Seleccionado(s)`}
                </p>
                <p className="text-2xl font-black text-white leading-none mt-0.5">
                  ${Math.ceil(checkoutTotal).toLocaleString('es-MX')} <span className="text-[10px] font-bold text-white/50">MXN</span>
                </p>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(true)}
                className="bg-gradient-to-r from-amber-400 via-amber-honey to-amber-600 text-black font-black uppercase tracking-widest text-xs px-6 py-3.5 rounded-xl shadow-lg shadow-amber-honey/20 active:scale-95 transition-all flex items-center gap-2"
              >
                <ShieldCheck size={16} />
                Reservar Ahora
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ─── NECTAR GATEWAY CHECKOUT MODAL ─── */}
        <AnimatePresence>
          {
            isCheckoutOpen && (
              <div className="fixed inset-0 z-[110] bg-nature-night/60 backdrop-blur-md flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="bg-white border border-nature-night/10 p-8 md:p-10 rounded-[2.5rem] w-full max-w-lg space-y-6 relative text-nature-night shadow-2xl overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-honey/10 rounded-bl-[8rem] pointer-events-none" />

                  {!checkoutSuccess && (
                    <button
                      onClick={() => {
                        setIsCheckoutOpen(false);
                        setFullName('');
                        setEmail('');
                        setPhone('');
                      }}
                      className="absolute top-6 right-6 text-nature-night/50 hover:text-nature-night transition-colors"
                    >
                      <X size={18} />
                    </button>
                  )}

                  {checkoutSuccess ? (
                    <div className="text-center space-y-6 py-4">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-500">
                        <CheckCircle size={32} />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-black uppercase tracking-wider">¡Compra Confirmada!</h3>
                        <p className="text-xs text-nature-night/60">Tus accesos han sido generados y enviados a su correo:</p>
                        <p className="text-xs font-bold text-amber-honey">{email}</p>
                      </div>

                      {/* DESGLOSE FINANCIERO CORREGIDO — MATCHING DESKTOP ASYMMETRIC FLYER SPEC */}
                      {(() => {
                        const totalCargado = getCreatedTicketsTotalAmount();
                        const { base_price: costoNetoBoleto, service_fee: comisionPlataforma } = calculateTotalWithFee(totalCargado);
                        if (totalCargado <= 0) return null;
                        return (
                          <div className="bg-nature-night/[0.02] border border-nature-night/10 p-4 rounded-xl text-left space-y-1.5 text-[11px]">
                            <div className="flex justify-between text-nature-night/60">
                              <span>Costo del Boleto ({createdTickets.length} accesos):</span>
                              <span className="font-semibold text-nature-night">${costoNetoBoleto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</span>
                            </div>
                            <div className="flex justify-between text-amber-600">
                              <span className="flex items-center gap-1"><Info size={10} /> Cargo de servicio (Stripe MX):</span>
                              <span className="font-semibold">+${comisionPlataforma.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</span>
                            </div>
                            <div className="flex justify-between text-nature-night font-bold border-t border-nature-night/10 pt-1.5 mt-1 text-xs">
                              <span>Total Pagado:</span>
                              <span className="text-amber-honey">${Math.ceil(totalCargado).toLocaleString('es-MX')} MXN</span>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="bg-nature-night/[0.02] p-5 rounded-2xl border border-nature-night/10 text-left space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-honey">Tus Boletos Digitales</h4>
                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                          {createdTickets.map((t, idx) => (
                            <div key={t.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-nature-night/10">
                              <span className="text-xs font-bold text-nature-night/80">Boleto #{idx + 1} ({t.seat_display})</span>
                              <Link
                                href={`/tickets/${t.token}`}
                                className="text-[9px] font-black uppercase tracking-wider text-amber-honey hover:text-nature-night transition-colors"
                                target="_blank"
                              >
                                Ver Boleto
                              </Link>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setIsCheckoutOpen(false);
                          setCheckoutSuccess(false);
                          setCreatedTickets([]);
                          setFullName('');
                          setEmail('');
                          setPhone('');
                        }}
                        className="w-full py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.25em] bg-amber-honey text-black hover:scale-[1.02] transition-transform"
                      >
                        Finalizar y Volver
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleCheckoutSubmit} className="space-y-6">
                      <div className="border-b border-nature-night/10 pb-4">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-honey">Pasarela Segura</span>
                        <h3 className="text-2xl font-black uppercase tracking-tight mt-1">Confirmar Reserva</h3>
                      </div>

                      <div className="bg-nature-night/[0.02] border border-nature-night/10 p-5 rounded-2xl space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-nature-night/50">Resumen del Evento</p>
                        <h4 className="text-sm font-black text-nature-night">{currentEvent?.title}</h4>
                        <p className="text-xs text-nature-night/60">
                          {isMeetGreet
                            ? `${mgQuantity} Pase(s) de Convivencia Meet & Greet`
                            : `${selectedSeats.length} Asiento(s): ${selectedSeats.map(s => `${s.row}${s.number}`).join(', ')}`
                          }
                          {wantsMG && !isMeetGreet && " (Incluye Meet & Greet)"}
                        </p>

                        {baseTotal > 0 && (
                          <div className="pt-3 border-t border-nature-night/10 mt-2 space-y-1.5">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-nature-night/50 font-bold uppercase tracking-wider">Precio Base</span>
                              <span className="font-extrabold text-nature-night">${checkoutBasePrice.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-amber-600 font-bold uppercase tracking-wider flex items-center gap-1">
                                <Info size={9} /> Cargo de servicio
                              </span>
                              <span className="font-bold text-amber-600">+${checkoutServiceFee.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</span>
                            </div>
                            <div className="flex justify-between items-end pt-2 border-t border-nature-night/10">
                              <span className="text-[10px] uppercase font-bold text-nature-night/50">Total a Pagar</span>
                              <span className="text-lg font-black text-amber-honey">${Math.ceil(checkoutTotal).toLocaleString('es-MX')} MXN</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] uppercase font-bold tracking-widest text-nature-night/60">Nombre Completo</label>
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            placeholder="Juan Pérez..."
                            className="w-full bg-white border border-nature-night/15 focus:border-amber-honey rounded-xl px-4 py-3 text-xs font-medium focus:outline-none transition-colors text-nature-night"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] uppercase font-bold tracking-widest text-nature-night/60">Correo Electrónico</label>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="juan@example.com..."
                            className="w-full bg-white border border-nature-night/15 focus:border-amber-honey rounded-xl px-4 py-3 text-xs font-medium focus:outline-none transition-colors text-nature-night"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] uppercase font-bold tracking-widest text-nature-night/60">Teléfono (WhatsApp)</label>
                          <input
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="+52 55 1234 5678..."
                            className="w-full bg-white border border-nature-night/15 focus:border-amber-honey rounded-xl px-4 py-3 text-xs font-medium focus:outline-none transition-colors text-nature-night"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-5 rounded-xl text-[9px] font-black uppercase tracking-[0.25em] bg-gradient-to-r from-amber-400 via-amber-honey to-amber-600 text-black disabled:opacity-30 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] shadow-lg shadow-amber-honey/20"
                      >
                        <ShieldCheck size={14} />
                        {isSubmitting ? 'Procesando Pago...' : 'Confirmar y Pagar Boletos'}
                        {!isSubmitting && <Sparkles size={12} className="animate-pulse" />}
                      </button>
                    </form>
                  )}
                </motion.div>
              </div>
            )
          }
        </AnimatePresence>
    </div>
  );
};

export default TourPage;