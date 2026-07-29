import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar, CalendarX,
  CheckCircle, Info,
  MapPin, Maximize2,
  Minus, Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket, Users,
  X
} from 'lucide-react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useState } from 'react';
import SeatingChart from '../components/SeatingChart';
import TourTimeline from '../components/TourTimeline';
import { showAlert } from '../lib/notifications';
import { cn } from '../lib/utils';
import { useEventTheme } from '../context/EventThemeContext';
import ThemedSection from '../components/ThemedSection';

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

  const { fetchThemeForEvent } = useEventTheme();

  useEffect(() => {
    if (currentEvent?.id) {
      fetchThemeForEvent(currentEvent.id);
    }
  }, [currentEvent?.id]);

  // Meet & Greet, Ticket Mode and Coupon Checkout states
  const [mgQuantity, setMgQuantity] = useState(1);
  const [ticketMode, setTicketMode] = useState<'seat' | 'seatless'>('seat');
  const [seatlessQuantity, setSeatlessQuantity] = useState(1);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isFlyerModalOpen, setIsFlyerModalOpen] = useState(false);
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

  const handleValidateCoupon = async (overrideCode?: any, overrideEmail?: any) => {
    const codeToUse = typeof overrideCode === 'string' ? overrideCode.trim() : (couponCode || '').trim();
    const emailToUse = typeof overrideEmail === 'string' ? overrideEmail.trim() : (email || '').trim();
    if (!codeToUse) return;
    setIsValidatingCoupon(true);
    setCouponError('');
    try {
      const apiUrl = getApiUrl();
      const res = await axios.post(`${apiUrl}/tickets/coupons/validate/`, {
        code: codeToUse,
        event_id: currentEvent?.id,
        email: emailToUse || undefined
      });
      if (res.data.valid) {
        setAppliedCoupon(res.data);
        showAlert(res.data.message || "Cupón VIP validado correctamente", "¡Cupón Aplicado!", "success");
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || "El código de cupón no es válido o ha expirado.";
      setCouponError(msg);
      setAppliedCoupon(null);
      showAlert(msg, "Error de Cupón", "error");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  // ── Auto-validación de Cupones desde URL Params (?coupon=CODIGO&email=CORREO) ──
  useEffect(() => {
    if (!router.isReady) return;
    const { coupon, email: urlEmail } = router.query;
    if (coupon && typeof coupon === 'string') {
      const cleanCoupon = coupon.trim();
      setCouponCode(cleanCoupon);
      let cleanEmail = '';
      if (urlEmail && typeof urlEmail === 'string') {
        cleanEmail = urlEmail.trim();
        setEmail(cleanEmail);
      }
      handleValidateCoupon(cleanCoupon, cleanEmail || undefined);
    }
  }, [router.isReady, router.query.coupon, router.query.email]);

  // ── Handle returning from Stripe Checkout (Asynchronous Resilient Webhook Sync) ──
  useEffect(() => {
    if (!router.isReady) return;
    const { success, session_id } = router.query;

    if (success === 'true' && session_id) {
      setIsLoading(true);
      const apiUrl = getApiUrl();
      let attempts = 0;
      const maxAttempts = 5;

      const checkTicketsStatus = async () => {
        try {
          const res = await fetch(`${apiUrl}/tickets/tickets/by_session/?session_id=${session_id}`);

          if (res.status === 204 || res.status === 404) {
            if (attempts < maxAttempts) {
              attempts++;
              setTimeout(checkTicketsStatus, 1500);
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

            router.replace('/comprar-boletos', undefined, { shallow: true });
            setIsLoading(false);
          }
        } catch (err: any) {
          console.error("Error retrieving tickets by session:", err);
          showAlert(err.message || "Hubo un error al recuperar tus boletos.", "Verificación en Proceso", "warning");
          setIsLoading(false);
        }
      };

      checkTicketsStatus();
    }
  }, [router.isReady, router.query]);

  useEffect(() => {
    setIsMounted(true);
    document.documentElement.setAttribute('data-theme', theme);
    const apiUrl = getApiUrl();

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

  /**
   * [Nectar Dynamic Pricing - Ticket Checkout Mirror Engine]
   * Garantiza la tarifa mínima establecida (baseAmount) y aplica aumentos progresivos
   * únicamente en los últimos 3 meses antes del evento.
   */
  const getDynamicPrice = (baseAmount: number) => {
    if (!currentEvent || !baseAmount || baseAmount <= 0) return baseAmount || 0;
    if (currentEvent.enable_dynamic_pricing === false || !currentEvent.date) return baseAmount;
    const eventDate = new Date(currentEvent.date);
    const now = new Date();
    const eventMonthIdx = eventDate.getFullYear() * 12 + eventDate.getMonth();
    const currMonthIdx = now.getFullYear() * 12 + now.getMonth();
    const monthsDiff = eventMonthIdx - currMonthIdx;

    if (monthsDiff > 3) {
      return baseAmount;
    }

    const monthsInLast3 = 3 - Math.max(0, monthsDiff);
    const increment = Number(currentEvent.monthly_price_increment ?? 50);
    const increase = monthsInLast3 * increment;

    return Math.max(baseAmount, baseAmount + increase);
  };

  const fetchSeats = () => {
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
  };

  useEffect(() => {
    fetchSeats();
  }, [currentEvent]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleSelectionChange = (ids: string[]) => {
    const selectedObjects = ids.map(id => {
      return seats.find(s => String(s.id) === id);
    }).filter(Boolean);
    setSelectedSeats(selectedObjects);
  };

  const getSeatBasePrice = (seat: any) => {
    if (!seat) return 0;
    const seatPrice = Number(seat.base_price || 0);
    if (seatPrice > 0) {
      return Math.round(getDynamicPrice(seatPrice));
    }
    const fallbackBase = Number(currentEvent?.numbered_seat_base_price || 1000);
    return Math.round(getDynamicPrice(fallbackBase));
  };

  const getEffectiveSeatlessPrice = () => {
    if (currentEvent?.effective_seatless_ticket_price !== undefined && Number(currentEvent.effective_seatless_ticket_price) > 0) {
      return Number(currentEvent.effective_seatless_ticket_price);
    }
    return Math.round(getDynamicPrice(Number(currentEvent?.seatless_ticket_price ?? 0)));
  };

  const isMeetGreet = currentEvent?.event_type === 'meet_greet';
  const isCurrentEventPast = useMemo(() => {
    if (!currentEvent?.date) return false;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return new Date(currentEvent.date) < startOfToday;
  }, [currentEvent]);

  // ── Cálculo de Disponibilidad de Butacas (Badge Header) ──────────────────
  const { totalSeatsCount, availableSeatsCount, occupancyPercentage } = useMemo(() => {
    const total = seats.length;
    const available = seats.filter((s: any) => s.is_available !== false && s.status !== 'reserved' && s.status !== 'sold' && s.status !== 'occupied').length;
    const pct = total > 0 ? Math.round(((total - available) / total) * 100) : 0;
    return { totalSeatsCount: total, availableSeatsCount: available, occupancyPercentage: pct };
  }, [seats]);

  const seatsBaseTotal = isMeetGreet
    ? 0
    : (ticketMode === 'seat'
      ? selectedSeats.reduce((acc, seat) => acc + getSeatBasePrice(seat), 0)
      : seatlessQuantity * getEffectiveSeatlessPrice());

  const mgBaseTotal = isMeetGreet
    ? mgQuantity * Number(currentEvent?.mg_price || 0)
    : (wantsMG ? Number(currentEvent?.mg_price || 0) : 0);

  const rawBaseTotal = seatsBaseTotal + mgBaseTotal;

  // Aplicar Descuento de Cupón VIP
  const baseTotal = useMemo(() => {
    if (!appliedCoupon) return rawBaseTotal;
    if (appliedCoupon.discount_type === 'free_vip' || Number(appliedCoupon.discount_value) >= 100) {
      return 0;
    }
    if (appliedCoupon.discount_type === 'percentage') {
      return Math.max(0, rawBaseTotal * (1 - Number(appliedCoupon.discount_value) / 100));
    }
    if (appliedCoupon.discount_type === 'fixed') {
      return Math.max(0, rawBaseTotal - Number(appliedCoupon.discount_value));
    }
    return rawBaseTotal;
  }, [rawBaseTotal, appliedCoupon]);

  const { base_price: checkoutBasePrice, service_fee: checkoutServiceFee, total: checkoutTotal } = calculateTotalWithFee(baseTotal);

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
      const payload: any = {
        email,
        event_id: currentEvent?.id,
        phone,
        has_mg: isMeetGreet ? true : wantsMG,
        coupon_code: appliedCoupon ? appliedCoupon.code : (couponCode.trim() || undefined),
      };

      if (isMeetGreet) {
        payload.seat_ids = [];
        payload.quantity = mgQuantity;
        payload.is_seatless = true;
      } else if (ticketMode === 'seatless') {
        payload.seat_ids = [];
        payload.quantity = seatlessQuantity;
        payload.is_seatless = true;
      } else {
        payload.seat_ids = selectedSeats.map(s => s.id);
        payload.quantity = 1;
        payload.is_seatless = false;
      }

      const res = await axios.post(`${apiUrl}/tickets/tickets/checkout/`, payload);

      if (res.data.session_url) {
        window.location.href = res.data.session_url;
      } else {
        setCreatedTickets(res.data.tickets || []);
        setCheckoutSuccess(true);
        setSelectedSeats([]);
        setWantsMG(false);
      }
    } catch (err: any) {
      console.error("Error during checkout:", err);
      const errorMsg = err.response?.data?.error || "Hubo un error al procesar la reserva. Por favor intenta de nuevo.";
      showAlert(errorMsg, "Error de Reserva", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="selection:bg-amber-honey/30 overflow-x-hidden font-outfit text-nature-night dark:text-[#F4F6F0] min-h-screen pb-24 lg:pb-12">
      <Head>
        <title>Ms Ambar | Accesos Oficiales 2026</title>
        <meta name="description" content="MS Ambar Accesos Oficiales 2026. Reserva tus entradas y vive la experiencia acústico-visual de vanguardia." />
      </Head>

      {/* ─── Header Section ─── */}
      <ThemedSection sectionKey="tickets_page" className="pt-8 pb-10 max-w-[1600px] mx-auto px-6 md:px-10 text-center relative overflow-hidden">
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
      </ThemedSection>

      {/* ─── Main Reservation Section ─── */}
      <ThemedSection sectionKey="seating_map" className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10">
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

        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-12 mt-10 items-start">
          {/* ══════ LEFT COLUMN ══════ */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
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

            {/* Ticket Mode Selector & Canvas / Seatless Card Container */}
            {!isMeetGreet && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 bg-nature-night/5 dark:bg-white/5 p-1.5 rounded-2xl border border-nature-night/10 dark:border-white/10">
                  <button
                    onClick={() => setTicketMode('seat')}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                      ticketMode === 'seat'
                        ? "bg-amber-honey text-black shadow-lg shadow-amber-honey/20"
                        : "text-nature-night/60 dark:text-white/60 hover:text-nature-night dark:hover:text-white"
                    )}
                  >
                    <Ticket size={14} />
                    Asientos Numerados
                  </button>
                  <button
                    onClick={() => {
                      setTicketMode('seatless');
                      setSelectedSeats([]);
                    }}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                      ticketMode === 'seatless'
                        ? "bg-amber-honey text-black shadow-lg shadow-amber-honey/20"
                        : "text-nature-night/60 dark:text-white/60 hover:text-nature-night dark:hover:text-white"
                    )}
                  >
                    <Users size={14} />
                    Boleto General (Sin Asiento)
                  </button>
                </div>

                {ticketMode === 'seat' ? (
                  <div className="relative group rounded-[2.5rem] overflow-hidden border border-nature-night/10 dark:border-white/10 shadow-2xl bg-[#0b0d17]">
                    <div className="px-6 py-4 bg-black/40 backdrop-blur-md border-b border-white/10 flex flex-wrap items-center justify-between gap-4 text-[10px] font-black uppercase tracking-wider text-white/70">
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-[#22a6b3] border border-white/30 shadow-[0_0_6px_#22a6b3]" /> Disponible
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-[#f59e0b] border border-white/30 shadow-[0_0_6px_#f59e0b]" /> VIP
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-[#E5A93B] shadow-[0_0_8px_#E5A93B]" /> Tu Selección
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-red-500/80 border border-red-400/50 shadow-[0_0_6px_#ef4444]" /> Ocupado
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
                ) : (
                  <div className="p-8 md:p-12 rounded-[2.5rem] border border-amber-honey/30 bg-nature-night/[0.02] dark:bg-white/[0.02] shadow-2xl space-y-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-amber-honey/20 border border-amber-honey/40 flex items-center justify-center mx-auto text-amber-honey shadow-lg shadow-amber-honey/10">
                      <Users size={32} />
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-honey">Entrada Libre Sin Límite</span>
                      <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-nature-night dark:text-white">
                        Boleto General (Sin Asiento Reservado)
                      </h3>
                      <p className="text-xs text-nature-night/70 dark:text-white/70 max-w-md mx-auto leading-relaxed">
                        Acceso directo de pie a la zona general del recinto con excelente visibilidad y flexibilidad total.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-6 py-4">
                      <button
                        onClick={() => setSeatlessQuantity(Math.max(1, seatlessQuantity - 1))}
                        className="w-12 h-12 rounded-full bg-nature-night/10 dark:bg-white/10 hover:bg-amber-honey/20 border border-nature-night/20 dark:border-white/20 flex items-center justify-center font-bold text-nature-night dark:text-white transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="text-4xl font-black text-nature-night dark:text-white min-w-[3rem] text-center">{seatlessQuantity}</span>
                      <button
                        onClick={() => setSeatlessQuantity(seatlessQuantity + 1)}
                        className="w-12 h-12 rounded-full bg-nature-night/10 dark:bg-white/10 hover:bg-amber-honey/20 border border-nature-night/20 dark:border-white/20 flex items-center justify-center font-bold text-nature-night dark:text-white transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="pt-4 border-t border-nature-night/10 dark:border-white/10 flex justify-between items-center px-4 max-w-md mx-auto">
                      <span className="text-xs font-bold uppercase tracking-wider text-nature-night/60 dark:text-white/60">Precio Unitario General</span>
                      <span className="text-xl font-black text-amber-honey">${getEffectiveSeatlessPrice().toLocaleString('es-MX')} MXN</span>
                    </div>
                  </div>
                )}
              </div>
            )}



            {isMeetGreet && (
              <div className="w-full p-8 rounded-[2.5rem] border border-nature-night/10 dark:border-white/10 bg-nature-night/[0.02] dark:bg-white/[0.02] space-y-5 mt-6">
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

          {/* ══════ RIGHT COLUMN: Cart Summary ══════ */}
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

                  {/* Selected Seats / General Ticket List */}
                  <div className="space-y-2.5 mb-5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                    {isMeetGreet ? (
                      <div className="flex justify-between items-center bg-nature-night/[0.02] p-3.5 rounded-xl border border-nature-night/10">
                        <div>
                          <p className="text-[9px] font-black text-amber-honey uppercase tracking-wider">Meet & Greet</p>
                          <p className="text-xs font-bold text-nature-night/80">{mgQuantity} Pase(s) de Convivencia</p>
                        </div>
                        <span className="font-extrabold text-xs text-nature-night">${(mgQuantity * Number(currentEvent?.mg_price || 0)).toLocaleString()} MXN</span>
                      </div>
                    ) : ticketMode === 'seatless' ? (
                      <div className="flex justify-between items-center bg-nature-night/[0.02] p-3.5 rounded-xl border border-nature-night/10">
                        <div>
                          <p className="text-[9px] font-black text-amber-honey uppercase tracking-wider">Zona General</p>
                          <p className="text-xs font-bold text-nature-night/80">{seatlessQuantity} Boleto(s) Sin Asiento</p>
                        </div>
                        <span className="font-extrabold text-xs text-nature-night">${(seatlessQuantity * Number(currentEvent?.seatless_ticket_price || 500)).toLocaleString()} MXN</span>
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
                          <p className="text-[9px] uppercase font-bold text-nature-night/50 tracking-[0.25em] mb-1">Total (Pase VIP Gratuito)</p>
                          <p className="text-3xl font-black leading-none text-emerald-600">$0 MXN</p>
                        </div>
                        <Sparkles size={20} className="text-amber-honey mb-1 animate-pulse" />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="mt-6 w-full">
                <PremiumCTAButton
                  disabled={isCurrentEventPast || (isMeetGreet ? false : (ticketMode === 'seatless' ? seatlessQuantity < 1 : selectedSeats.length === 0))}
                  onClick={() => !isCurrentEventPast && setIsCheckoutOpen(true)}
                >
                  <span className="text-base md:text-lg font-black uppercase tracking-[0.15em] block">
                    {isCurrentEventPast ? 'Venta Finalizada' : (baseTotal === 0 && appliedCoupon ? 'Reclamar Entrada VIP' : 'Proceder al Pago')}
                  </span>
                </PremiumCTAButton>
              </div>
            </motion.div>
          </div>

          {/* ══════ FULL-WIDTH FLYER SECTION (Abarca el ancho completo del contenedor incluyendo area de pago) ══════ */}
          {currentEvent?.flyer_url && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-12 space-y-4 mt-6"
            >
              <div className="w-full relative rounded-[2.5rem] overflow-hidden border border-amber-honey/20 group shadow-2xl shadow-amber-honey/10 bg-[#08090f] p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center">
                {/* Backdrop ambient blur using flyer image */}
                <div
                  className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-30 scale-110 pointer-events-none transition-all duration-1000"
                  style={{ backgroundImage: `url(${currentEvent.flyer_url})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#08090f] via-[#08090f]/75 to-[#08090f]/40 z-10 pointer-events-none" />

                {/* Top Banner Header */}
                <div className="w-full flex flex-wrap items-center justify-between gap-3 z-20 mb-4 px-2">
                  <div className="flex items-center gap-2 bg-amber-honey/10 border border-amber-honey/30 px-4 py-2 rounded-full backdrop-blur-md">
                    <Sparkles size={14} className="text-amber-honey animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-honey">Flyer Oficial del Evento</span>
                  </div>
                  <button
                    onClick={() => setIsFlyerModalOpen(true)}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-full transition-all backdrop-blur-md shadow-lg hover:border-amber-honey/50"
                  >
                    <Maximize2 size={13} className="text-amber-honey" />
                    <span>Pantalla Completa</span>
                  </button>
                </div>

                {/* Main Flyer Display - Complete Aspect Ratio (Horizontal & Vertical, 0 cropping) */}
                <div
                  onClick={() => setIsFlyerModalOpen(true)}
                  className="relative z-20 w-full flex items-center justify-center rounded-2xl cursor-pointer overflow-hidden group/img transition-transform duration-500 hover:scale-[1.005]"
                >
                  <img
                    src={currentEvent.flyer_url}
                    alt={`Flyer oficial: ${currentEvent.title}`}
                    className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="bg-nature-night/90 text-white border border-amber-honey/40 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 backdrop-blur-md shadow-2xl">
                      <Maximize2 size={14} className="text-amber-honey" /> Ampliar Flyer
                    </span>
                  </div>
                </div>

                {/* Footer caption */}
                <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-2 z-20 mt-6 pt-4 border-t border-white/10 px-2">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-honey">Arte Oficial</span>
                    <h3 className="text-xl md:text-2xl font-black text-white uppercase italic">{currentEvent.title}</h3>
                  </div>
                  <p className="text-xs text-white/60 font-medium">
                    Haz clic en el cartel para explorar todos los detalles en alta resolución.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </ThemedSection>

      {/* ─── MOBILE STICKY BOTTOM BAR ─── */}
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

      {/* ─── NECTAR GATEWAY CHECKOUT MODAL ─── */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-[110] bg-nature-night/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border border-nature-night/10 p-6 md:p-8 rounded-[2.5rem] w-full max-w-lg space-y-6 relative text-nature-night shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-honey/10 rounded-bl-[8rem] pointer-events-none" />

              {/* ─── GUIADO DE PASOS (STEPPER) ─── */}
              <div className="flex items-center justify-between border-b border-nature-night/10 pb-4 pt-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black",
                    !checkoutSuccess ? "bg-amber-honey text-black" : "bg-emerald-100 text-emerald-700"
                  )}>1</span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Datos</span>
                </div>
                <div className="h-[2px] w-8 bg-nature-night/10" />
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black",
                    isSubmitting ? "bg-amber-honey text-black animate-pulse" : (checkoutSuccess ? "bg-emerald-100 text-emerald-700" : "bg-nature-night/10 text-nature-night/50")
                  )}>2</span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Pago</span>
                </div>
                <div className="h-[2px] w-8 bg-nature-night/10" />
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black",
                    checkoutSuccess ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30" : "bg-nature-night/10 text-nature-night/50"
                  )}>3</span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Activado</span>
                </div>
              </div>

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
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase text-emerald-600 tracking-widest">
                      <ShieldCheck size={12} /> Accesos Activados y Asientos Bloqueados
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-wider">¡Adquisición Confirmada!</h3>
                    <p className="text-xs text-nature-night/60">Tus accesos oficiales han sido activados y enviados a tu correo:</p>
                    <p className="text-xs font-bold text-amber-honey">{email}</p>
                  </div>

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
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-honey">Tus Boletos Digitales Activados</h4>
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {createdTickets.map((t, idx) => (
                        <div key={t.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-nature-night/10">
                          <div>
                            <p className="text-xs font-bold text-nature-night/80">Boleto #{idx + 1} ({t.seat_display})</p>
                            <span className="text-[8px] font-extrabold uppercase text-emerald-600 tracking-wider">Estado: Activo • Listo para QR</span>
                          </div>
                          <Link
                            href={`/tickets/${t.token}`}
                            className="text-[9px] font-black uppercase tracking-wider text-amber-honey hover:text-nature-night transition-colors border border-amber-honey/30 px-3 py-1.5 rounded-lg bg-amber-honey/10"
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
                      fetchSeats();
                    }}
                    className="w-full py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.25em] bg-amber-honey text-black hover:scale-[1.02] transition-transform font-black"
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
                        : ticketMode === 'seatless'
                          ? `${seatlessQuantity} Boleto(s) General(es) Sin Asiento`
                          : `${selectedSeats.length} Asiento(s): ${selectedSeats.map(s => `${s.row}${s.number}`).join(', ')}`
                      }
                      {wantsMG && !isMeetGreet && " (Incluye Meet & Greet)"}
                    </p>

                    {baseTotal > 0 ? (
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
                    ) : (
                      <div className="pt-3 border-t border-nature-night/10 mt-2 flex justify-between items-center text-xs">
                        <span className="font-bold text-emerald-600 uppercase tracking-wider">Total Pase VIP Gratuito:</span>
                        <span className="font-black text-emerald-600 text-base">$0.00 MXN</span>
                      </div>
                    )}
                  </div>

                  {/* VIP Coupon Code Input */}
                  <div className="space-y-1.5 bg-nature-night/[0.02] border border-nature-night/10 p-4 rounded-2xl">
                    <label className="text-[9px] uppercase font-bold tracking-widest text-nature-night/60 flex items-center gap-1.5">
                      <Sparkles size={12} className="text-amber-honey animate-pulse" /> Código de Cupón / Entrada VIP
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={e => {
                          setCouponCode(e.target.value);
                          setCouponError('');
                        }}
                        placeholder="Ej. VIP-AMBAR-2026..."
                        className="flex-1 bg-white border border-nature-night/15 focus:border-amber-honey rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none transition-colors text-nature-night uppercase tracking-wider"
                      />
                      <button
                        type="button"
                        onClick={() => handleValidateCoupon()}
                        disabled={isValidatingCoupon || !couponCode.trim()}
                        className="px-4 py-2.5 bg-nature-night text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-nature-night/80 disabled:opacity-40 transition-all"
                      >
                        {isValidatingCoupon ? 'Validando...' : 'Aplicar'}
                      </button>
                    </div>
                    {appliedCoupon && (
                      <div className="mt-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-700 font-bold">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle size={14} className="text-emerald-600" />
                          {appliedCoupon.discount_type === 'free_vip' ? '¡Entrada VIP Gratuita (100% Descuento)!' : '¡Cupón VIP Aplicado!'}
                        </span>
                        <button type="button" onClick={() => { setAppliedCoupon(null); setCouponCode(''); }} className="text-[10px] text-emerald-800 underline">Quitar</button>
                      </div>
                    )}
                    {couponError && (
                      <p className="text-[10px] font-bold text-rose-600 mt-1">{couponError}</p>
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
                    {isSubmitting
                      ? 'Procesando...'
                      : (baseTotal === 0 && appliedCoupon
                        ? 'Reclamar Entrada VIP Gratuita'
                        : 'Confirmar y Pagar Boletos'
                      )
                    }
                    {!isSubmitting && <Sparkles size={12} className="animate-pulse" />}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── FULLSCREEN FLYER LIGHTBOX MODAL ─── */}
      <AnimatePresence>
        {isFlyerModalOpen && currentEvent?.flyer_url && (
          <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 md:p-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-5xl max-h-[95vh] w-full flex flex-col items-center justify-center"
            >
              <button
                onClick={() => setIsFlyerModalOpen(false)}
                className="absolute -top-12 right-0 sm:top-2 sm:right-2 z-50 bg-white/10 hover:bg-amber-honey hover:text-black border border-white/20 text-white p-3 rounded-full transition-all backdrop-blur-md shadow-2xl"
                aria-label="Cerrar vista completa"
              >
                <X size={20} />
              </button>
              <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
                <img
                  src={currentEvent.flyer_url}
                  alt={`Flyer oficial ampliando: ${currentEvent.title}`}
                  className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-2xl shadow-2xl border border-white/10"
                />
              </div>
              <div className="text-center mt-3 text-white/80">
                <p className="text-xs font-black uppercase tracking-widest text-amber-honey">{currentEvent.title}</p>
                <p className="text-[10px] uppercase tracking-wider opacity-60">Flyer Oficial en Alta Resolución</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TourPage;