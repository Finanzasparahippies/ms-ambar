import * as React from 'react';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import SeatingChart from '../components/SeatingChart';
import TourTimeline from '../components/TourTimeline';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ticket, Users, MapPin, Calendar, Star, Sparkles, Minus, Plus, X, CheckCircle, Info, ShieldCheck
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
      if (eventsData && eventsData.length > 0) {
        setEvents(eventsData);
        setCurrentEvent(eventsData[0]);
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

  return (
    <div className="selection:bg-amber-honey/30 overflow-x-hidden font-outfit text-nature-night dark:text-[#F4F6F0] min-h-screen">
      <Head>
        <title>Ms Ambar | Accesos Oficiales 2026</title>
        <meta name="description" content="MS Ambar Accesos Oficiales 2026. Reserva tus entradas y vive la experiencia acústico-visual de vanguardia." />
      </Head>

      {/* ─── Header Section ─── */}
      <section className="pt-10 pb-16 max-w-[1600px] mx-auto px-6 md:px-10 text-center relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-15%] w-[45%] h-[45%] bg-amber-honey/5 blur-[120px] rounded-full pointer-events-none animate-pulse" />
        <div className="max-w-4xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 bg-amber-honey/10 border border-amber-honey/20 px-4 py-2 rounded-full w-fit mx-auto"
          >
            <Sparkles size={12} className="text-amber-honey animate-spin" />
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-honey">Experiencia Inmersiva</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-6xl md:text-8xl font-black tracking-tighter uppercase italic leading-tight px-4 md:px-8 py-2 md:py-4"
          >
            ACCESOS <span className="text-glow text-gradient bg-gradient-to-r from-amber-400 via-amber-honey to-amber-700 bg-clip-text text-transparent px-2">OFICIALES 2026</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-nature-night/70 dark:text-[#F4F6F0]/70 text-xs md:text-sm uppercase tracking-[0.4em] max-w-2xl mx-auto leading-relaxed"
          >
            {pageSubtitle}
          </motion.p>
        </div>
      </section>

      {/* ─── Main Reservation Section ─── */}
      <section className="pb-32 max-w-[1600px] mx-auto px-6 md:px-10">
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

        <div className="grid lg:grid-cols-12 gap-12 xl:gap-20 mt-12 items-start">

          {/* Left Column: Event details + Flyer */}
          <div className="lg:col-span-4 space-y-8">
            <header className="mb-10 text-left">
              <motion.h2
                key={currentEvent?.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-5xl font-black tracking-tight mb-8 uppercase italic leading-tight"
              >
                {currentEvent ? currentEvent.title : 'Selecciona un Concierto...'}
              </motion.h2>
              <div className="flex flex-col gap-4 text-xs uppercase tracking-widest font-black">
                <div className="flex items-center gap-3 bg-nature-night/[0.02] dark:bg-white/[0.02] border border-nature-night/10 dark:border-white/10 px-6 py-3 rounded-full backdrop-blur-md w-fit">
                  <MapPin size={14} className="text-amber-honey" />
                  <span>{currentEvent && currentEvent.theater_name ? currentEvent.theater_name : isMeetGreet ? 'Meet & Greet' : 'Cargando Recinto...'}</span>
                </div>
                <div className="flex items-center gap-3 bg-nature-night/[0.02] dark:bg-white/[0.02] border border-nature-night/10 dark:border-white/10 px-6 py-3 rounded-full backdrop-blur-md w-fit">
                  <Calendar size={14} className="text-amber-honey" />
                  <span>{currentEvent ? new Date(currentEvent.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</span>
                </div>
              </div>
            </header>

            <AnimatePresence mode="wait">
              {currentEvent?.flyer_url && (
                <motion.div
                  key={`flyer-${currentEvent.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="relative rounded-[2.5rem] overflow-hidden border border-amber-honey/20 group shadow-xl shadow-amber-honey/5 w-full aspect-[3/4]"
                >
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
                </motion.div>
              )}
            </AnimatePresence>

            {isMeetGreet && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 rounded-[2.5rem] border border-nature-night/10 dark:border-white/10 bg-nature-night/[0.02] dark:bg-white/[0.02] space-y-6"
              >
                <div className="flex items-center gap-3 text-amber-honey">
                  <Star className="fill-current animate-pulse" size={20} />
                  <h3 className="text-lg font-black uppercase tracking-wider">Detalles de la Convivencia</h3>
                </div>
                <p className="text-xs leading-relaxed opacity-80">
                  Vive una experiencia cercana y exclusiva con Ms Ambar. Este pase especial te permite compartir momentos únicos, firmar autógrafos y tomarse fotografías oficiales con la artista.
                </p>
                <ul className="space-y-3 text-[10px] font-bold uppercase tracking-wider opacity-75">
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
                  <li className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-amber-honey" />
                    Monograma Ámbar de edición limitada
                  </li>
                </ul>
              </motion.div>
            )}
          </div>

          {/* Right Column: Booking Panel + Seating Chart */}
          <div className="lg:col-span-8 flex flex-col gap-8">
            <motion.div layout className="border border-nature-night/15 bg-white text-nature-night shadow-xl shadow-nature-night/5 p-8 rounded-[3rem]">
              <div className="text-center mb-8 border-b border-nature-night/10 pb-6">
                <h3 className="text-2xl font-black uppercase tracking-wider mb-2">Reserva Digital</h3>
                <p className="text-[9px] uppercase tracking-[0.3em] text-nature-night/50 font-bold">Reserva directa mediante Néctar Gateway</p>
              </div>

              {isMeetGreet && (
                <div className="mb-6 p-6 rounded-[2rem] bg-nature-night/[0.03] border border-nature-night/10 text-center space-y-4">
                  <p className="text-[10px] font-black uppercase text-amber-honey tracking-[0.2em]">Cantidad de Boletos</p>
                  <div className="flex items-center justify-center gap-6">
                    <button
                      onClick={() => setMgQuantity(Math.max(1, mgQuantity - 1))}
                      className="w-12 h-12 rounded-full bg-nature-night/5 hover:bg-amber-honey/20 border border-nature-night/10 flex items-center justify-center font-bold text-nature-night transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-3xl font-black min-w-[2rem] text-center text-nature-night">{mgQuantity}</span>
                    <button
                      onClick={() => setMgQuantity(mgQuantity + 1)}
                      className="w-12 h-12 rounded-full bg-nature-night/5 hover:bg-amber-honey/20 border border-nature-night/10 flex items-center justify-center font-bold text-nature-night transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold uppercase text-nature-night/40 tracking-widest">Precio Unitario</p>
                    <p className="text-xl font-black text-nature-night">${Number(currentEvent?.mg_price || 0).toLocaleString()} MXN</p>
                  </div>
                </div>
              )}

              {!isMeetGreet && (
                <div
                  onClick={() => currentEvent?.mg_available > 0 && setWantsMG(!wantsMG)}
                  className={cn(
                    "mb-6 p-5 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden",
                    wantsMG ? "bg-amber-honey border-amber-honey text-nature-night" : "bg-nature-night/[0.02] border-nature-night/10 hover:border-amber-honey/30"
                  )}
                >
                  <div className="flex items-center gap-4 relative z-10">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500",
                      wantsMG ? "bg-nature-night text-amber-honey rotate-12" : "bg-amber-honey text-nature-night"
                    )}>
                      <Star size={20} fill="currentColor" />
                    </div>
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-widest text-nature-night">Meet & Greet</h4>
                      <p className={cn("text-[9px] font-bold uppercase tracking-widest mt-1", wantsMG ? "text-nature-night/70" : "text-amber-honey")}>
                        {currentEvent?.mg_available > 0 ? `${currentEvent.mg_available} Pases Disponibles` : 'Agotado'}
                      </p>
                    </div>
                  </div>
                  {!wantsMG && <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-black opacity-60 text-nature-night italic">
                    {currentEvent ? `+$${Number(currentEvent.mg_price).toLocaleString()}` : ''}
                  </span>}
                </div>
              )}

              <div className="space-y-3 mb-6 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                {isMeetGreet ? (
                  <div className="flex justify-between items-center bg-nature-night/[0.02] p-4 rounded-xl border border-nature-night/10">
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
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="flex justify-between items-center bg-nature-night/[0.02] p-4 rounded-xl border border-nature-night/10"
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
                      <div className="py-12 text-center border border-dashed border-nature-night/20 rounded-2xl opacity-40">
                        <Ticket className="mx-auto mb-2 text-nature-night/40" size={32} />
                        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-nature-night/40">Elige un asiento en el mapa</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {baseTotal > 0 ? (
                <PriceBreakdown baseTotal={baseTotal} label="Subtotal boletos" />
              ) : (
                <div className="pt-6 border-t border-nature-night/10 mb-6">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[9px] uppercase font-bold text-nature-night/50 tracking-[0.25em] mb-2">Total</p>
                      <p className="text-4xl font-black leading-none text-amber-honey">$0 MXN</p>
                    </div>
                    <Users size={18} className="text-nature-night/30 mb-1" />
                  </div>
                </div>
              )}

              <div className="mt-6">
                <PremiumCTAButton
                  disabled={isMeetGreet ? false : selectedSeats.length === 0}
                  onClick={() => setIsCheckoutOpen(true)}
                >
                  Proceder al Pago
                </PremiumCTAButton>
              </div>
            </motion.div>

            {!isMeetGreet && (
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-honey/10 to-amber-600/10 rounded-[3.6rem] blur-xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
                {isLoading ? (
                  <div className="h-[450px] md:h-[600px] flex items-center justify-center border border-nature-night/10 dark:border-white/10 bg-nature-night/[0.01] dark:bg-white/[0.01] rounded-[3.5rem]">
                    <div className="text-amber-honey animate-pulse font-extrabold uppercase tracking-[0.5em]">Tejiendo la Planta...</div>
                  </div>
                ) : (
                  <div className="h-[450px] md:h-[600px] rounded-[3.5rem] overflow-hidden border border-nature-night/10 dark:border-white/10">
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
          </div>

        </div>

        {/* ─── NECTAR GATEWAY CHECKOUT MODAL ─── */}
        <AnimatePresence>
          {isCheckoutOpen && (
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
          )}
        </AnimatePresence>
      </section>
    </div>
  );
};

export default TourPage;