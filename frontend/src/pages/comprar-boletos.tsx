import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Calendar, CalendarX,
  Check, CheckCircle, Info,
  Mail, MapPin, Maximize2,
  Minus, Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket, Users,
  X
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useState } from 'react';
import { isSeatAllowedByRestriction } from '../components/SeatingChart';
import ThemedSection from '../components/ThemedSection';
import TicketQRModal from '../components/TicketQRModal';
import TourTimeline from '../components/TourTimeline';
import { useEventTheme } from '../context/EventThemeContext';
import api from '../lib/api';
import { showAlert } from '../lib/notifications';
import { SeatMapLoader, formatSeatAssignment, getSeatAssignmentParts } from '../lib/seatMapLoader';
import { cn, getApiUrl } from '../lib/utils';

const SeatingChart = dynamic(() => import('../components/SeatingChart'), {
  ssr: false,
  loading: () => (
    <div className="h-[30rem] flex flex-col items-center justify-center gap-3 bg-nature-night/5 dark:bg-white/5 rounded-3xl border border-nature-night/10 dark:border-white/10">
      <div className="w-8 h-8 rounded-full border-2 border-t-amber-honey border-amber-honey/20 animate-spin" />
      <span className="text-xs uppercase font-bold tracking-widest text-amber-honey">
        Cargando Mapa de Asientos...
      </span>
    </div>
  ),
});

// ── Stripe Fee Mirror (same formula as backend fees.py) ──────────────────────
// Incluye el 16% de IVA trasladado por Stripe sobre su propia comisión bancaria (3.6% * 1.16 = 4.176%, $3.00 * 1.16 = $3.48 MXN)
const EFFECTIVE_PCT_FEE = 0.04176;   // 3.6% base + 16% IVA
const EFFECTIVE_FLAT_FEE = 3.48;     // $3.00 base + 16% IVA

const calculateTotalWithFee = (baseAmount: number): { base_price: number; service_fee: number; total: number } => {
  if (baseAmount <= 0) return { base_price: 0, service_fee: 0, total: 0 };

  const base_price = Number(baseAmount.toFixed(2));

  // 1. Total bruto con recargo Gross-Up de Stripe
  const rawTotal = (base_price + EFFECTIVE_FLAT_FEE) / (1 - EFFECTIVE_PCT_FEE);
  const total = Number(rawTotal.toFixed(2));

  // 2. Comisión exacta (Diferencia entre Total final y Precio Base)
  const service_fee = Number((total - base_price).toFixed(2));

  return {
    base_price,
    service_fee,
    total,
  };
};

// ── Price Breakdown Component ────────────────────────────────────────────────
const PriceBreakdown = ({ baseTotal, label = 'Subtotal boletos' }: { baseTotal: number; label?: string }) => {
  const { base_price, service_fee, total } = calculateTotalWithFee(baseTotal);
  if (baseTotal <= 0) return null;

  return (
    <div className="pt-4 border-t border-slate-200/80 dark:border-white/10 space-y-3 mt-4">
      {/* Subtotal line */}
      <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
        <span className="uppercase tracking-widest text-xs font-black text-slate-400 dark:text-slate-400">{label}</span>
        <span className="font-extrabold font-mono text-slate-900 dark:text-slate-100">
          ${base_price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-slate-400">MXN</span>
        </span>
      </div>

      {/* Service Fee line */}
      <div className="flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
        <span className="inline-flex items-center gap-1.5 uppercase tracking-widest text-xs font-black">
          <Info size={12} className="text-amber-500 shrink-0" />
          Cargo de servicio
        </span>
        <span className="font-extrabold font-mono text-amber-600 dark:text-amber-400">
          +${service_fee.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs opacity-75">MXN</span>
        </span>
      </div>

      {/* Total Box */}
      <div className="mt-3 p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-amber-600/10 border border-amber-500/30 dark:border-amber-400/30 flex items-center justify-between shadow-sm relative overflow-hidden group">
        <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-amber-400/10 rounded-full blur-xl pointer-events-none group-hover:bg-amber-400/20 transition-all" />
        <div className="space-y-0.5 relative z-10">
          <span className="text-xs uppercase font-black tracking-[0.25em] text-amber-700 dark:text-amber-300 block">
            Total a Pagar
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
              ${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-black text-amber-600 dark:text-amber-400 tracking-wider">MXN</span>
          </div>
        </div>

        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-inner relative z-10">
          <Users size={18} />
        </div>
      </div>

      {/* Transparencia Tarifaria Notice */}
      <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-400/[0.06] border border-amber-500/25 dark:border-amber-400/25 space-y-1.5">
        <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 text-xs font-black uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-amber-500 shrink-0" />
            Transparencia Tarifaria
          </span>
          <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            Nectar Checkout
          </span>
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
          El subtotal de tus accesos (<strong className="font-mono text-slate-900 dark:text-white">${base_price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</strong>) va íntegramente al artista. El cargo de servicio (<strong className="font-mono text-amber-600 dark:text-amber-400">${service_fee.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</strong>) cubre el procesamiento seguro con cifrado bancario.
        </p>
      </div>
    </div>
  );
};

// ── Ultra-Premium CTA Button ─────────────────────────────────────────────────
const PremiumCTAButton = ({
  onClick, disabled, children
}: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) => (
  <motion.button
    whileHover={disabled ? {} : { scale: 1.015, y: -1 }}
    whileTap={disabled ? {} : { scale: 0.98 }}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "relative w-full overflow-hidden rounded-2xl py-4.5 px-6 font-black text-xs uppercase tracking-[0.25em] transition-all duration-300 shadow-xl",
      "bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-black",
      "shadow-[0_8px_30px_rgba(245,158,11,0.3)] hover:shadow-[0_12px_40px_rgba(245,158,11,0.5)]",
      "border border-amber-200/50 dark:border-amber-400/30 active:scale-95",
      "disabled:opacity-40 disabled:grayscale disabled:pointer-events-none disabled:shadow-none"
    )}
  >
    {!disabled && (
      <span className="absolute inset-0 -translate-x-full hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />
    )}
    <span className="relative z-10 flex items-center justify-center gap-2.5">
      <ShieldCheck size={18} className="shrink-0 text-slate-950" />
      {children}
      <Sparkles size={16} className="shrink-0 text-slate-950 animate-pulse" />
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
  const [allowCanvasZoom, setAllowCanvasZoom] = useState<boolean>(true);
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
  const [couponEmailInput, setCouponEmailInput] = useState('');
  const [couponRequiresEmail, setCouponRequiresEmail] = useState(false);
  const [activeAllowedRows, setActiveAllowedRows] = useState<string[]>([]);
  const [activeRowName, setActiveRowName] = useState<string>('');

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isFlyerModalOpen, setIsFlyerModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [createdTickets, setCreatedTickets] = useState<any[]>([]);
  const [ticketPassModalData, setTicketPassModalData] = useState<{ ticket: any; seat?: any } | null>(null);
  const [limitExceededModalData, setLimitExceededModalData] = useState<{ maxTickets: number; detail: string } | null>(null);

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
    setCouponRequiresEmail(false);
    setActiveAllowedRows([]);
    setActiveRowName('');
    showAlert('Cupón removido. Todas las zonas y filas vuelven a estar disponibles a tarifa normal.', 'Cupón Removido', 'info');
  };

  const handleValidateCoupon = async (overrideCode?: any, overrideEmail?: any) => {
    const codeToUse = typeof overrideCode === 'string' ? overrideCode.trim() : (couponCode || '').trim();
    const emailToUse = typeof overrideEmail === 'string'
      ? overrideEmail.trim()
      : (couponEmailInput || email || '').trim();
    if (!codeToUse) return;
    setIsValidatingCoupon(true);
    setCouponError('');
    try {
      const res = await api.post('/tickets/coupons/validate/', {
        code: codeToUse,
        event_id: currentEvent?.id,
        email: emailToUse || undefined
      });
      if (res.data.valid) {
        setAppliedCoupon(res.data);
        setCouponRequiresEmail(false);
        const rows: string[] = res.data.active_allowed_rows || [];
        setActiveAllowedRows(rows);
        const resolvedRowName = res.data.active_row_name || (rows.length > 0 ? rows[0] : '');
        setActiveRowName(resolvedRowName);

        // Si el cupón exige fila designada y el usuario ya tenía asientos en otra fila, filtrar o reubicar
        if (res.data.allowed_mode === 'DESIGNATED_ROW' && rows.length > 0) {
          const normAllowed = new Set(rows.map((r: string) => String(r).toLowerCase().replace(/^fila\s+/i, '').trim()));
          setSelectedSeats(prev => {
            const filtered = prev.filter(s => {
              const seatRowNorm = String(s.row || '').toLowerCase().replace(/^fila\s+/i, '').trim();
              return normAllowed.has(seatRowNorm);
            });
            if (filtered.length < prev.length) {
              const displayLabel = resolvedRowName || rows[0];
              showAlert(`Tu cortesía está asignada a la ${displayLabel}. Por favor selecciona tu asiento en esta fila.`, 'Asiento Asignado a Cortesía', 'info');
            }
            return filtered;
          });
        }

        showAlert(res.data.message || "Cupón validado correctamente", "¡Cupón Aplicado!", "success");
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || "El código de cupón no es válido o ha expirado.";
      const reqEmail = Boolean(err.response?.data?.requires_email || msg.toLowerCase().includes('correo'));
      if (reqEmail) {
        setCouponRequiresEmail(true);
      }
      setCouponError(msg);
      setAppliedCoupon(null);
      setActiveAllowedRows([]);
      showAlert(msg, "Validación de Cupón", reqEmail ? "info" : "error");
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
        setCouponEmailInput(cleanEmail);
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
      let attempts = 0;
      const maxAttempts = 5;

      const checkTicketsStatus = async () => {
        try {
          const res = await api.get(`/tickets/tickets/by_session/?session_id=${session_id}`).catch(err => err.response);

          if (!res || res.status === 204 || res.status === 404) {
            if (attempts < maxAttempts) {
              attempts++;
              setTimeout(checkTicketsStatus, 1500);
              return;
            } else {
              throw new Error('El pago se procesó, pero los boletos están tardando en generarse. Por favor revisa tu correo electrónico.');
            }
          }

          const tickets = res.data;
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

    Promise.all([
      api.get('/tickets/events/').then(r => r.data).catch(() => []),
      api.get('/tickets/settings/').then(r => r.data).catch(() => null),
    ]).then(([eventsData, settingsData]) => {
      if (settingsData && typeof settingsData.allow_canvas_zoom === 'boolean') {
        setAllowCanvasZoom(settingsData.allow_canvas_zoom);
      }
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
    if (currentEvent) {
      const hasNumbered = currentEvent.allow_numbered_tickets !== false;
      const hasSeatless = currentEvent.allow_seatless_tickets !== false;
      if (!hasNumbered && hasSeatless) {
        setTicketMode('seatless');
      } else if (hasNumbered && !hasSeatless) {
        setTicketMode('seat');
      }
    }
  }, [currentEvent]);

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

    if (monthsDiff >= 2) {
      return baseAmount;
    }

    const increments = 2 - Math.max(0, monthsDiff);
    const increment = Number(currentEvent.monthly_price_increment ?? 50);
    const increase = increments * increment;

    return Math.max(baseAmount, baseAmount + increase);
  };

  const fetchSeats = () => {
    if (!currentEvent) return;
    api.get(`/tickets/events/${currentEvent.id}/seats/`)
      .then(res => {
        const data = res.data;
        if (data.seats) {
          const els = data.elements || [];
          const mappedSeats = SeatMapLoader.loadAndMapSeats(data.seats, els);
          const tables = els.filter((e: any) => e.type === 'table' || e.tableShape || String(e.label || '').trim().toLowerCase().startsWith('mesa'));
          if (tables.length > 0) {
            const tableIds = new Set(tables.map((t: any) => String(t.id)));
            // Filtrar asientos huérfanos que no pertenecen a ninguna mesa del layout activo
            const validSeats = mappedSeats.filter((s: any) => {
              const tid = s.tableId || s.table_id;
              if (tid && tableIds.has(String(tid))) return true;
              return tables.some((t: any) => Math.hypot(t.x - s.x, t.y - s.y) <= 80);
            });
            setSeats(validSeats.length > 0 ? validSeats : mappedSeats);
          } else {
            setSeats(mappedSeats);
          }
          setElements(els);
        } else {
          setSeats(Array.isArray(data) ? SeatMapLoader.loadAndMapSeats(data, []) : []);
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

  const handleInvalidSeatAttempt = (seat: any, allowedRows: string[]) => {
    let displayLabel = activeRowName;
    if (!displayLabel) {
      const tableRows = allowedRows.filter(r => /^mesa\s+\d+/i.test(r.trim()));
      if (tableRows.length > 1) {
        displayLabel = `mesas habilitadas [${tableRows[0]} a ${tableRows[tableRows.length - 1]}]`;
      } else if (allowedRows.length > 0) {
        const raw = allowedRows[0];
        displayLabel = raw.toLowerCase().startsWith('fila') || raw.toLowerCase().startsWith('mesa')
          ? raw
          : `Fila ${raw}`;
      } else {
        displayLabel = 'mesas o filas designadas';
      }
    }
    showAlert(
      `Tu cupón de cortesía aplica para las ${displayLabel}. Por favor, selecciona tu asiento en las ubicaciones habilitadas e iluminadas.`,
      'Zona Restringida por Cortesía',
      'warning'
    );
  };

  // ── Regla Anti-Asiento Huérfano (Orphan Seat Detection) ──
  const orphanSeatIds = useMemo(() => {
    if (!selectedSeats || selectedSeats.length === 0 || !seats || seats.length === 0) return [];

    const isComplimentary = Boolean(
      appliedCoupon && (
        appliedCoupon.is_complimentary ||
        appliedCoupon.discount_type === 'free_vip' ||
        appliedCoupon.allowed_mode === 'DESIGNATED_ROW' ||
        Number(appliedCoupon.discount_value || 0) >= 100
      )
    );

    // Si el usuario tiene cupón de cortesía y los asientos seleccionados están en la fila permitida,
    // se permite seleccionar un boleto aislado sin restricción de asiento huérfano.
    if (isComplimentary) {
      if (activeAllowedRows && activeAllowedRows.length > 0) {
        const normAllowed = new Set(
          activeAllowedRows.map(r => String(r || '').toLowerCase().replace(/^fila\s+/i, '').trim())
        );
        const allInDesignated = selectedSeats.every(s =>
          isSeatAllowedByRestriction(s, activeAllowedRows, normAllowed, elements)
        );
        if (allInDesignated) {
          return [];
        }
      } else {
        // Cortesía general sin restricción de fila
        return [];
      }
    }

    const selectedSet = new Set(selectedSeats.map(s => String(s.id)));
    const orphans: string[] = [];

    // 1. Detección por Mesa
    const tableSeatsMap: { [tableId: string]: any[] } = {};
    const rowSeatsMap: { [row: string]: any[] } = {};

    seats.forEach(s => {
      const tid = s.tableId || s.table_id || s.element_id;
      const isTableSeat = Boolean(tid || String(s.row || '').toLowerCase().startsWith('mesa'));
      if (tid) {
        const key = String(tid);
        if (!tableSeatsMap[key]) tableSeatsMap[key] = [];
        tableSeatsMap[key].push(s);
      } else if (String(s.row || '').toLowerCase().startsWith('mesa')) {
        const key = String(s.row).trim().toUpperCase();
        if (!tableSeatsMap[key]) tableSeatsMap[key] = [];
        tableSeatsMap[key].push(s);
      }
      // Solo evaluar en filas contiguas (butacas lineales de teatro) si NO es parte de una mesa
      if (s.row && !isTableSeat) {
        const rKey = String(s.row).trim().toUpperCase();
        if (!rowSeatsMap[rKey]) rowSeatsMap[rKey] = [];
        rowSeatsMap[rKey].push(s);
      }
    });

    // Validar mesas: si queda exactamente 1 asiento libre en la mesa
    Object.values(tableSeatsMap).forEach(tableSeats => {
      const availableUnselected = tableSeats.filter(s => {
        const isOccupied = s.status === 'occupied' || s.status === 'reserved';
        return !isOccupied && !selectedSet.has(String(s.id));
      });
      const selectedInTable = tableSeats.filter(s => selectedSet.has(String(s.id)));
      const isTableInitiallyEmpty = tableSeats.every(
        s => s.status !== 'occupied' && s.status !== 'reserved'
      );

      // Si la mesa estaba completamente vacía y el usuario selecciona 1 boleto individual, no restringir
      if (isTableInitiallyEmpty && selectedInTable.length === 1) {
        return;
      }

      if (selectedInTable.length > 0 && availableUnselected.length === 1) {
        orphans.push(String(availableUnselected[0].id));
      }
    });

    // Validar filas contiguas: si queda 1 asiento libre aislado entre ocupados/seleccionados
    Object.values(rowSeatsMap).forEach(rowSeats => {
      const sorted = [...rowSeats].sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));
      for (let i = 0; i < sorted.length; i++) {
        const curr = sorted[i];
        const isOccupied = curr.status === 'occupied' || curr.status === 'reserved';
        const isSelected = selectedSet.has(String(curr.id));
        if (isOccupied || isSelected) continue;

        const left = i > 0 ? sorted[i - 1] : null;
        const right = i < sorted.length - 1 ? sorted[i + 1] : null;
        const leftTaken = !left || left.status === 'occupied' || left.status === 'reserved' || selectedSet.has(String(left.id));
        const rightTaken = !right || right.status === 'occupied' || right.status === 'reserved' || selectedSet.has(String(right.id));

        if (leftTaken && rightTaken) {
          const leftUser = left && selectedSet.has(String(left.id));
          const rightUser = right && selectedSet.has(String(right.id));
          if (leftUser || rightUser) {
            orphans.push(String(curr.id));
          }
        }
      }
    });

    return Array.from(new Set(orphans));
  }, [seats, selectedSeats, appliedCoupon, activeAllowedRows, elements]);

  const handleProceedToCheckout = () => {
    if (isCurrentEventPast) return;
    if (orphanSeatIds.length > 0) {
      showAlert(
        'Tu selección actual deja 1 asiento libre aislado en el recinto. Por favor selecciona asientos contiguos antes de proceder al pago.',
        'Restricción de Asiento Huérfano',
        'warning'
      );
      return;
    }
    setIsCheckoutOpen(true);
  };

  const getSeatBasePrice = (seat?: any) => {
    const seatPrice = Number(seat?.base_price || 0);
    let resolvedPrice = 0;
    let source = '';

    if (seatPrice > 0) {
      resolvedPrice = Math.round(seatPrice);
      source = 'seat.base_price (from backend /seats/ API)';
    } else if (currentEvent?.numbered_seat_base_price !== undefined && Number(currentEvent.numbered_seat_base_price) > 0) {
      resolvedPrice = Math.round(Number(currentEvent.numbered_seat_base_price));
      source = 'currentEvent.numbered_seat_base_price (from EventSerializer)';
    } else {
      const multiplier = Number(currentEvent?.price_multiplier || 1.0);
      const fallbackBase = Number(currentEvent?.numbered_ticket_price || 400) * multiplier;
      resolvedPrice = Math.round(getDynamicPrice(fallbackBase));
      source = 'fallback (getDynamicPrice + multiplier)';
    }

    console.log(`[TicketPricing Debug] getSeatBasePrice resolved: $${resolvedPrice} MXN | Source: ${source} | Seat ID: ${seat?.id || 'N/A'}`);
    return resolvedPrice;
  };

  const getSeatDisplayText = (seat: any) => {
    if (!seat) return '';
    return formatSeatAssignment({
      row_letter: seat.row_letter,
      table_number: seat.table_number,
      table_label: seat.table_label,
      number: seat.number,
      row: seat.row
    });
  };

  const getEffectiveSeatlessPrice = () => {
    let resolvedPrice = 0;
    let source = '';

    if (currentEvent?.effective_seatless_ticket_price !== undefined && Number(currentEvent.effective_seatless_ticket_price) > 0) {
      resolvedPrice = Math.round(Number(currentEvent.effective_seatless_ticket_price));
      source = 'currentEvent.effective_seatless_ticket_price (from EventSerializer)';
    } else {
      const rawBase = Number(currentEvent?.seatless_ticket_price ?? 500);
      resolvedPrice = Math.round(getDynamicPrice(rawBase));
      source = 'fallback (getDynamicPrice + seatless_ticket_price)';
    }

    console.log(`[TicketPricing Debug] getEffectiveSeatlessPrice resolved: $${resolvedPrice} MXN | Source: ${source}`);
    return resolvedPrice;
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

  // Desglose de asientos con cupón / cortesía unitaria
  const seatBreakdown = useMemo(() => {
    if (ticketMode !== 'seat') return [];

    // Priorizar asientos en fila designada si el cupón la especifica
    const normAllowed = new Set(
      (activeAllowedRows || []).map((r: string) => String(r).toLowerCase().replace(/^fila\s+/i, '').trim())
    );

    const sorted = [...selectedSeats].sort((a, b) => {
      const aInRow = normAllowed.has(String(a.row || '').toLowerCase().replace(/^fila\s+/i, '').trim());
      const bInRow = normAllowed.has(String(b.row || '').toLowerCase().replace(/^fila\s+/i, '').trim());
      if (aInRow && !bInRow) return -1;
      if (!aInRow && bInRow) return 1;
      return 0;
    });

    const isCourtesy = Boolean(appliedCoupon && (appliedCoupon.is_complimentary || appliedCoupon.discount_type === 'free_vip'));
    const maxTickets = Number(appliedCoupon?.max_tickets || 1);

    return sorted.map((seat, index) => {
      const originalPrice = getSeatBasePrice(seat);
      const isComplimentary = isCourtesy && index < maxTickets;
      const payablePrice = isComplimentary ? 0 : originalPrice;
      return {
        seat,
        index,
        originalPrice,
        isComplimentary,
        payablePrice,
      };
    });
  }, [selectedSeats, appliedCoupon, activeAllowedRows, ticketMode, currentEvent]);

  // Aplicar Descuento de Cupón VIP (Soporte Híbrido: Cortesía + Excedente Regular)
  const baseTotal = useMemo(() => {
    if (!appliedCoupon) return rawBaseTotal;

    const isCourtesy = Boolean(appliedCoupon.is_complimentary || appliedCoupon.discount_type === 'free_vip');
    const maxTickets = Number(appliedCoupon.max_tickets || 1);

    if (isCourtesy) {
      if (ticketMode === 'seat') {
        const payableSeatsSum = seatBreakdown.reduce((sum, item) => sum + item.payablePrice, 0);
        return payableSeatsSum + mgBaseTotal;
      } else {
        const payableQty = Math.max(0, seatlessQuantity - maxTickets);
        return (payableQty * getEffectiveSeatlessPrice()) + mgBaseTotal;
      }
    }

    if (appliedCoupon.discount_type === 'percentage') {
      const pct = Number(appliedCoupon.discount_value || 0);
      return Math.max(0, rawBaseTotal * (1 - pct / 100));
    }

    if (appliedCoupon.discount_type === 'fixed') {
      return Math.max(0, rawBaseTotal - Number(appliedCoupon.discount_value || 0));
    }

    return rawBaseTotal;
  }, [rawBaseTotal, appliedCoupon, ticketMode, seatBreakdown, mgBaseTotal, seatlessQuantity]);

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
        payload.seat_ids = seatBreakdown.map(item => item.seat.id);
        payload.quantity = 1;
        payload.is_seatless = false;
      }

      const res = await api.post('/tickets/tickets/checkout/', payload);

      if (res.data.session_url) {
        window.location.href = res.data.session_url;
      } else if (res.data.redirect_url) {
        window.location.href = res.data.redirect_url;
      } else {
        setCreatedTickets(res.data.tickets || []);
        setCheckoutSuccess(true);
        setSelectedSeats([]);
        setWantsMG(false);
      }
    } catch (err: any) {
      console.error("Error during checkout:", err);
      const data = err.response?.data;
      if (data?.error_code === 'COMPLIMENTARY_ORDER_LIMIT_EXCEEDED' || data?.code === 'COMPLIMENTARY_ORDER_LIMIT_EXCEEDED') {
        setLimitExceededModalData({
          maxTickets: Number(data.max_tickets || appliedCoupon?.max_tickets || 1),
          detail: data.detail || data.error || `El cupón solo cubre ${data.max_tickets || 1} asiento(s) de cortesía.`
        });
        return;
      }
      const errorMsg = data?.detail || data?.error || "Hubo un error al procesar la reserva. Por favor intenta de nuevo.";
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
      <ThemedSection sectionKey="tickets_page" className="pt-6 pb-8 max-w-[100rem] mx-auto px-3 sm:px-6 md:px-10 text-center relative z-10">
        <div className="absolute top-[-10%] left-[-15%] w-[45%] h-[45%] bg-amber-honey/5 blur-[120px] rounded-full pointer-events-none animate-pulse" />
        <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-1.5 bg-amber-honey/10 border border-amber-honey/20 px-3 py-1.5 xs:px-4 xs:py-2 rounded-full w-fit mx-auto"
          >
            <Sparkles size={12} className="text-amber-honey animate-spin" />
            <span className="text-xs font-black uppercase tracking-[0.2em] xs:tracking-[0.25em] text-amber-honey">Reserva Oficial</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-2xl xs:text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter uppercase italic leading-tight px-1 py-1 text-[var(--heading-color,#E5A93B)]"
          >
            ACCESOS <span className="text-glow text-gradient-theme px-1 sm:px-2">OFICIALES 2026</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs md:text-sm uppercase tracking-[0.25em] xs:tracking-[0.35em] max-w-2xl mx-auto leading-relaxed text-[var(--subtitle-color,#F4F6F0)] opacity-90 px-2"
          >
            {pageSubtitle}
          </motion.p>
        </div>
      </ThemedSection>

      {/* ─── Main Reservation Section ─── */}
      <ThemedSection sectionKey="seating_map" className="max-w-[100rem] mx-auto px-2 xs:px-4 sm:px-6 lg:px-10 relative z-30">
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

        <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 xl:gap-12 mt-6 sm:mt-10 items-start">
          {/* ══════ LEFT COLUMN ══════ */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            <div className="p-3.5 xs:p-5 md:p-8 rounded-2xl xs:rounded-[2.5rem] bg-nature-night/[0.02] dark:bg-white/[0.02] border border-nature-night/10 dark:border-white/10 backdrop-blur-md space-y-5 xs:space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <motion.h2
                    key={currentEvent?.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl xs:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight uppercase italic leading-tight text-[var(--heading-color,#E5A93B)]"
                  >
                    {currentEvent ? currentEvent.title : 'Selecciona un Concierto...'}
                  </motion.h2>
                  <div className="flex flex-wrap items-center gap-2 xs:gap-3 text-xs uppercase tracking-widest font-black mt-2.5">
                    <div className="flex items-center gap-1.5 bg-nature-night/5 dark:bg-white/5 border border-nature-night/10 dark:border-white/10 px-3 py-1.5 xs:px-4 xs:py-2 rounded-full">
                      <MapPin size={12} className="text-amber-honey shrink-0" />
                      <span className="truncate max-w-[140px] xs:max-w-none">{currentEvent?.theater_name || (isMeetGreet ? 'Meet & Greet' : 'Cargando Recinto...')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-nature-night/5 dark:bg-white/5 border border-nature-night/10 dark:border-white/10 px-3 py-1.5 xs:px-4 xs:py-2 rounded-full">
                      <Calendar size={12} className="text-amber-honey shrink-0" />
                      <span>{currentEvent?.date ? new Date(currentEvent.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</span>
                    </div>
                  </div>
                </div>

                {!isMeetGreet && totalSeatsCount > 0 && (
                  <div className="flex flex-col items-start md:items-end gap-1.5 p-3 xs:p-4 rounded-2xl bg-amber-honey/10 border border-amber-honey/20 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-xs font-black uppercase tracking-[0.15em] xs:tracking-[0.2em] text-amber-honey">Disponibilidad en Vivo</span>
                    </div>
                    <p className="text-lg xs:text-xl font-black uppercase text-nature-night dark:text-white leading-none">
                      {availableSeatsCount} <span className="text-xs text-nature-night/50 dark:text-white/50 font-semibold">/ {totalSeatsCount} Butacas</span>
                    </p>
                    <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden mt-1">
                      <div className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-700" style={{ width: `${100 - occupancyPercentage}%` }} />
                    </div>
                  </div>
                )}

                {isMeetGreet && (
                  <div className="flex flex-col items-start md:items-end gap-1.5 p-3 xs:p-4 rounded-2xl bg-amber-honey/10 border border-amber-honey/20 shrink-0">
                    <div className="flex items-center gap-2">
                      <Star size={14} className="text-amber-honey fill-current animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-[0.15em] xs:tracking-[0.2em] text-amber-honey">Pases de Convivencia</span>
                    </div>
                    <p className="text-lg xs:text-xl font-black uppercase text-nature-night dark:text-white leading-none">
                      {currentEvent?.mg_available || 0} <span className="text-xs text-nature-night/50 dark:text-white/50 font-semibold">Disponibles</span>
                    </p>
                  </div>
                )}
              </div>

              {isCurrentEventPast && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-4 py-2 rounded-full w-fit">
                  <CalendarX size={14} className="text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-black uppercase tracking-[0.15em] xs:tracking-[0.2em] text-amber-600 dark:text-amber-400">Evento Concluido (Modo Informativo)</span>
                </div>
              )}
            </div>

            {/* Ticket Mode Selector & Canvas / Seatless Card Container */}
            {!isMeetGreet && (
              <div className="space-y-4">
                {(currentEvent?.allow_numbered_tickets === false && currentEvent?.allow_seatless_tickets === false) ? (
                  <div className="p-8 md:p-12 rounded-[2.5rem] border border-amber-honey/30 bg-amber-honey/10 text-center space-y-3 shadow-2xl">
                    <span className="text-xs font-black uppercase tracking-[0.3em] text-amber-honey block">Aviso de Taquilla</span>
                    <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-nature-night dark:text-white">
                      Venta Inhabilitada Temporálmente
                    </h3>
                    <p className="text-xs text-nature-night/70 dark:text-white/70 max-w-md mx-auto leading-relaxed">
                      La venta de boletos numerados y generales para este evento no está disponible por el momento.
                    </p>
                  </div>
                ) : (
                  <>
                    {(currentEvent?.allow_numbered_tickets !== false && currentEvent?.allow_seatless_tickets !== false) && (
                      <div className="flex flex-col xs:flex-row items-stretch xs:items-center justify-between gap-2 bg-nature-night/5 dark:bg-white/5 p-1.5 rounded-2xl border border-nature-night/10 dark:border-white/10">
                        <button
                          onClick={() => setTicketMode('seat')}
                          className={cn(
                            "flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 text-center leading-tight",
                            ticketMode === 'seat'
                              ? "bg-amber-honey text-black shadow-lg shadow-amber-honey/20"
                              : "text-nature-night/60 dark:text-white/60 hover:text-nature-night dark:hover:text-white"
                          )}
                        >
                          <Ticket size={13} className="shrink-0" />
                          <span>Numerados (${getSeatBasePrice().toLocaleString('es-MX')} MXN)</span>
                        </button>
                        <button
                          onClick={() => {
                            setTicketMode('seatless');
                            setSelectedSeats([]);
                          }}
                          className={cn(
                            "flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 text-center leading-tight",
                            ticketMode === 'seatless'
                              ? "bg-amber-honey text-black shadow-lg shadow-amber-honey/20"
                              : "text-nature-night/60 dark:text-white/60 hover:text-nature-night dark:hover:text-white"
                          )}
                        >
                          <Users size={13} className="shrink-0" />
                          <span>Boleto General (${getEffectiveSeatlessPrice().toLocaleString('es-MX')} MXN)</span>
                        </button>
                      </div>
                    )}

                    {ticketMode === 'seat' ? (
                      <div className="space-y-3">
                        {/* ── Banner de Guía para Cupón de Cortesía Activo ── */}
                        {appliedCoupon?.allowed_mode === 'DESIGNATED_ROW' && activeAllowedRows.length > 0 && (
                          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-600/20 border-2 border-amber-400/60 shadow-[0_0_25px_rgba(245,158,11,0.25)] flex items-center gap-3.5 backdrop-blur-md animate-fade-in">
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
                                  Cortesía VIP Activa
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/30 text-amber-200 border border-amber-400/40">
                                  Asignación Automática
                                </span>
                              </div>
                              <p className="text-xs md:text-sm font-bold text-white mt-0.5 leading-snug">
                                Tu cupón de cortesía aplica para las{' '}
                                <strong className="text-amber-300 underline underline-offset-4 decoration-amber-400/60 decoration-2">
                                  {activeRowName || (
                                    (() => {
                                      const tableRows = activeAllowedRows.filter(r => /^mesa\s+\d+/i.test(r.trim()));
                                      if (tableRows.length > 1) {
                                        return `mesas habilitadas [${tableRows[0]} a ${tableRows[tableRows.length - 1]}]`;
                                      }
                                      const first = activeAllowedRows[0];
                                      return first?.toLowerCase().startsWith('fila') || first?.toLowerCase().startsWith('mesa')
                                        ? first
                                        : `Fila ${first || 'Designada'}`;
                                    })()
                                  )}
                                </strong>
                                . Selecciona tu asiento.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* ── Banner de Prevención de Asiento Huérfano (Anti-Orphan Alert) ── */}
                        {orphanSeatIds.length > 0 && (
                          <div className="p-3.5 rounded-2xl bg-amber-950/70 border border-amber-500/50 text-amber-200 shadow-xl backdrop-blur-md flex items-start gap-3 animate-fade-in">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 text-sm font-bold mt-0.5">
                              ⚠️
                            </div>
                            <div className="text-xs leading-relaxed flex-1">
                              <span className="font-black uppercase tracking-wider text-amber-300 block mb-0.5">
                                Regla de Adyacencia: Asiento Aislado Detectado
                              </span>
                              Tu selección actual deja un asiento libre aislado en el recinto. Te sugerimos seleccionar asientos contiguos para evitar restricciones antes del checkout.
                            </div>
                          </div>
                        )}

                        <div className="relative group rounded-2xl xs:rounded-[2.5rem] overflow-hidden border border-nature-night/10 dark:border-white/10 shadow-2xl bg-[#0b0d17]">
                          <div className="px-3 xs:px-6 py-3 bg-black/40 backdrop-blur-md border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5 text-xs font-black uppercase tracking-wider text-white/70">
                            <div className="flex flex-wrap items-center gap-4">
                              <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-blue-600 border border-blue-400/50 shadow-[0_0_8px_#2563eb]" /> Tu Selección
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-red-500/80 border border-red-400/50 shadow-[0_0_6px_#ef4444]" /> Ocupado
                              </span>
                              {appliedCoupon?.allowed_mode === 'DESIGNATED_ROW' && activeAllowedRows.length > 0 && (
                                <span className="flex items-center gap-1.5 text-amber-300 font-black">
                                  <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400" />
                                  </span>
                                  Fila VIP Permitida
                                </span>
                              )}
                              {orphanSeatIds.length > 0 && (
                                <span className="flex items-center gap-1.5 text-amber-400 font-black">
                                  <span className="w-3 h-3 rounded-full border-2 border-dashed border-amber-500 bg-amber-500/20" />
                                  Asiento Aislado
                                </span>
                              )}
                            </div>
                            <span className="text-xs tracking-widest font-black text-[var(--heading-color,#E5A93B)]">
                              Precio Base Numerado: ${getSeatBasePrice().toLocaleString('es-MX')} MXN
                            </span>
                          </div>

                          {isLoading ? (
                            <div className="h-[30rem] lg:h-[36.25rem] flex flex-col items-center justify-center gap-3 bg-nature-night/[0.01] dark:bg-white/[0.01]">
                              <div className="w-10 h-10 rounded-full border-4 border-amber-honey/20 border-t-amber-honey animate-spin" />
                              <div className="text-amber-honey animate-pulse font-extrabold text-xs uppercase tracking-[0.4em]">Tejiendo la Planta del Venue...</div>
                            </div>
                          ) : (
                            <div className={cn(
                              "h-[25rem] xs:h-[30rem] lg:h-[36.25rem] relative w-full overflow-hidden",
                              isCurrentEventPast && "pointer-events-none opacity-85"
                            )}>
                              {isCurrentEventPast && (
                                <div className="absolute inset-0 bg-nature-night/40 backdrop-blur-[2px] z-30 flex items-center justify-center p-6 text-center">
                                  <div className="bg-white/95 dark:bg-nature-night/95 backdrop-blur-md p-6 rounded-3xl border border-amber-honey/30 shadow-2xl max-w-sm">
                                    <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-honey mb-1">Mapa Informativo</p>
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
                                allowZoom={allowCanvasZoom}
                                restrictedRows={activeAllowedRows}
                                orphanSeatIds={orphanSeatIds}
                                onInvalidSelectionAttempt={handleInvalidSeatAttempt}
                              />

                              {/* Barra flotante de selección rápida para pantallas táctiles/móviles */}
                              {selectedSeats.length > 0 && (
                                <div className="absolute top-3 left-3 right-3 z-20 pointer-events-auto flex flex-col gap-1.5 md:hidden">
                                  <div className="bg-nature-night/95 dark:bg-[#0b0d17]/95 backdrop-blur-xl border border-amber-honey/40 rounded-2xl p-2 shadow-2xl flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none max-w-[calc(100%-75px)]">
                                      {selectedSeats.map((seat: any) => {
                                        const seatLabel = getSeatDisplayText(seat) || `Asiento ${seat.row}${seat.number}`;
                                        return (
                                          <div
                                            key={String(seat.id)}
                                            className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-honey/20 border border-amber-honey/40 text-amber-honey rounded-xl text-[11px] font-black shrink-0 animate-fadeIn"
                                          >
                                            <span className="truncate max-w-[120px]">{seatLabel}</span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedSeats(prev => prev.filter(s => String(s.id) !== String(seat.id)));
                                              }}
                                              className="w-6 h-6 rounded-full bg-amber-honey/30 active:bg-red-500 active:text-white flex items-center justify-center text-xs font-bold transition-colors"
                                              title="Quitar asiento"
                                              aria-label={`Quitar ${seatLabel}`}
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedSeats([])}
                                      className="px-2.5 py-1.5 bg-red-500/20 active:bg-red-500/30 border border-red-500/30 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition-colors"
                                    >
                                      Quitar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 md:p-12 rounded-[2.5rem] border border-amber-honey/30 bg-nature-night/[0.02] dark:bg-white/[0.02] shadow-2xl space-y-6 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-amber-honey/20 border border-amber-honey/40 flex items-center justify-center mx-auto text-amber-honey shadow-lg shadow-amber-honey/10">
                          <Users size={32} />
                        </div>
                        <div className="space-y-2">
                          <span className="text-xs font-black uppercase tracking-[0.3em] text-amber-honey">Entrada Libre Sin Límite</span>
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
                  </>
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
                <ul className="space-y-2.5 text-xs font-bold uppercase tracking-wider opacity-75">
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
          </div>          {/* ══════ RIGHT COLUMN: Cart Summary ══════ */}
          <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-8 space-y-6">
            <motion.div layout className="border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0e101a] text-slate-900 dark:text-white shadow-2xl shadow-slate-900/10 p-3.5 xs:p-5 md:p-8 rounded-2xl xs:rounded-[2.5rem] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-bl-full pointer-events-none blur-2xl" />

              <div className="text-center mb-6 border-b border-slate-100 dark:border-white/10 pb-5 relative z-10">
                <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 px-3.5 py-1 rounded-full text-amber-600 dark:text-amber-400 mb-2">
                  <Ticket size={14} className="shrink-0" />
                  <span className="text-xs font-black uppercase tracking-[0.25em]">Néctar Gateway</span>
                </div>
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-wider text-slate-900 dark:text-white">Reserva Digital</h3>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-400 font-bold mt-0.5">Transacción Encriptada Segura</p>
              </div>

              {isCurrentEventPast ? (
                <div className="my-6 p-6 rounded-[2rem] bg-amber-500/5 border border-amber-500/30 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-500 shadow-lg">
                    <CalendarX size={20} />
                  </div>
                  <h4 className="text-lg font-black uppercase tracking-wider text-slate-900 dark:text-white">Venta Cerrada</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    Este evento ha finalizado. La venta de accesos se encuentra cerrada.
                  </p>
                </div>
              ) : (
                <>
                  {isMeetGreet && (
                    <div className="mb-6 p-4 xs:p-5 rounded-[2rem] bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-transparent border border-amber-500/20 text-center space-y-4 shadow-sm">
                      <p className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 tracking-[0.2em]">Cantidad de Boletos M&G</p>
                      <div className="flex items-center justify-center gap-6">
                        <button
                          onClick={() => setMgQuantity(Math.max(1, mgQuantity - 1))}
                          className="w-11 h-11 rounded-full bg-white dark:bg-white/10 hover:bg-amber-400/20 border border-slate-200 dark:border-white/15 flex items-center justify-center font-bold text-slate-800 dark:text-white transition-all shadow-sm active:scale-95"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-3xl font-black font-mono min-w-[2rem] text-center text-slate-900 dark:text-white">{mgQuantity}</span>
                        <button
                          onClick={() => setMgQuantity(mgQuantity + 1)}
                          className="w-11 h-11 rounded-full bg-white dark:bg-white/10 hover:bg-amber-400/20 border border-slate-200 dark:border-white/15 flex items-center justify-center font-bold text-slate-800 dark:text-white transition-all shadow-sm active:scale-95"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="space-y-0.5 pt-1">
                        <p className="text-xs font-bold uppercase text-slate-400 tracking-widest">Precio Unitario</p>
                        <p className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">${Number(currentEvent?.mg_price || 0).toLocaleString()} MXN</p>
                      </div>
                    </div>
                  )}

                  {!isMeetGreet && (
                    <motion.div
                      whileHover={currentEvent?.mg_available > 0 ? { scale: 1.01, y: -1 } : {}}
                      whileTap={currentEvent?.mg_available > 0 ? { scale: 0.985 } : {}}
                      onClick={() => currentEvent?.mg_available > 0 && setWantsMG(!wantsMG)}
                      className={cn(
                        "mb-5 p-3 xs:p-4 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden shadow-md",
                        wantsMG
                          ? "bg-gradient-to-br from-amber-500/15 via-amber-400/10 to-amber-600/15 border-2 border-amber-500 dark:border-amber-400 shadow-[0_4px_25px_rgba(245,158,11,0.2)]"
                          : "bg-slate-50 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/10 hover:border-amber-400/50 hover:bg-amber-50/50 dark:hover:bg-amber-400/[0.03]"
                      )}
                    >
                      {/* Pulse glow background effect when active */}
                      {wantsMG && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0.15, 0.3, 0.15] }}
                          transition={{ repeat: Infinity, duration: 2.5 }}
                          className="absolute inset-0 bg-amber-400/10 pointer-events-none"
                        />
                      )}
                      <div className="flex items-center justify-between gap-3 relative z-10">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <motion.div
                            animate={wantsMG ? { rotate: [0, 15, -15, 0], scale: [1, 1.08, 1] } : { rotate: 0, scale: 1 }}
                            transition={{ duration: 0.4 }}
                            className={cn(
                              "w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center transition-all duration-300 shadow-md",
                              wantsMG
                                ? "bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 border border-amber-300 shadow-amber-500/30"
                                : "bg-amber-400/10 text-amber-500 border border-amber-400/30"
                            )}
                          >
                            <Star size={19} fill={wantsMG ? "currentColor" : "none"} />
                          </motion.div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h4 className="font-extrabold text-xs uppercase tracking-wider truncate text-slate-900 dark:text-white">
                                Experiencia Meet & Greet
                              </h4>
                              {wantsMG && (
                                <span className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1 shrink-0">
                                  <CheckCircle size={10} className="text-amber-500" /> Añadido
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col justify-center items-end text-right shrink-0">
                          <span className={cn(
                            "text-xs font-black font-mono tracking-wide whitespace-nowrap px-2.5 py-1 rounded-lg transition-colors",
                            wantsMG ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30" : "text-amber-600 dark:text-amber-400"
                          )}>
                            +${Number(currentEvent?.mg_price || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs">MXN</span>
                          </span>
                          <span className="text-xs font-bold uppercase tracking-widest block text-slate-400 mt-0.5">
                            Tarifa Base
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Selected Seats / General Ticket List */}
                  <div className="space-y-2.5 mb-5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                    {isMeetGreet ? (
                      <div className="flex justify-between items-center bg-slate-50 dark:bg-white/[0.03] p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10">
                        <div>
                          <p className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">Meet & Greet</p>
                          <p className="text-xs font-bold text-slate-800 dark:text-white">{mgQuantity} Pase(s) de Convivencia</p>
                        </div>
                        <span className="font-black font-mono text-xs text-slate-900 dark:text-white">${(mgQuantity * Number(currentEvent?.mg_price || 0)).toLocaleString()} MXN</span>
                      </div>
                    ) : ticketMode === 'seatless' ? (
                      <div className="flex justify-between items-center bg-slate-50 dark:bg-white/[0.03] p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10">
                        <div>
                          <p className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">Zona General</p>
                          <p className="text-xs font-bold text-slate-800 dark:text-white">{seatlessQuantity} Boleto(s) Sin Asiento</p>
                        </div>
                        <span className="font-black font-mono text-xs text-slate-900 dark:text-white">${(seatlessQuantity * getEffectiveSeatlessPrice()).toLocaleString()} MXN</span>
                      </div>
                    ) : (
                      <>
                        <AnimatePresence mode="popLayout">
                          {seatBreakdown.map(item => {
                            const { seat, originalPrice, isComplimentary } = item;
                            const parts = getSeatAssignmentParts(seat);
                            const canonicalSeatDisplay = formatSeatAssignment(seat);
                            return (
                              <motion.div
                                key={seat.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className={`flex justify-between items-center bg-slate-50 dark:bg-white/[0.03] p-3.5 rounded-2xl border transition-all group shadow-sm ${isComplimentary
                                    ? 'border-emerald-500/40 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05]'
                                    : 'border-slate-200/80 dark:border-white/10 hover:border-amber-400/40'
                                  }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`w-10 h-10 rounded-xl border flex flex-col items-center justify-center font-black font-mono text-[10px] leading-tight shrink-0 shadow-inner ${isComplimentary
                                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                      : 'bg-gradient-to-br from-amber-400/20 to-amber-600/10 border-amber-400/30 text-amber-600 dark:text-amber-400'
                                    }`}>
                                    <span>{parts.rowText ? parts.rowText.replace(/^fila\s*:?\s*/i, '').trim().toUpperCase() : 'F'}</span>
                                    <span className="text-[9px] opacity-80">#{seat.number}</span>
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                      <span className={`inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${isComplimentary
                                          ? 'bg-emerald-400/15 text-emerald-700 dark:text-emerald-400 border-emerald-400/30'
                                          : 'bg-amber-400/10 text-amber-600 dark:text-amber-400 border-amber-400/20'
                                        }`}>
                                        {isComplimentary ? 'Cortesía VIP' : (seat.category || 'Reservado')}
                                      </span>
                                      <span className="text-[11px] font-black text-slate-800 dark:text-white font-mono tracking-tight">
                                        {canonicalSeatDisplay}
                                      </span>
                                    </div>
                                    {/* Chips independientes: [Fila: F] [Mesa: 4] [Asiento: 13] */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {parts.rowText && (
                                        <span className="inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono tracking-wider">
                                          {parts.rowText}
                                        </span>
                                      )}
                                      {parts.tableText && (
                                        <span className="inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono tracking-wider">
                                          {parts.tableText}
                                        </span>
                                      )}
                                      <span className="inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-200 dark:bg-white/10 border border-slate-300 dark:border-white/15 text-slate-800 dark:text-white font-mono tracking-wider">
                                        {parts.seatText}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2.5 shrink-0">
                                  {isComplimentary ? (
                                    <div className="flex flex-col items-end">
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono tracking-wider">
                                        <Sparkles size={10} className="text-amber-500" /> Cortesía: $0.00 MXN
                                      </span>
                                      <span className="text-[9px] line-through text-slate-400 font-mono">
                                        ${originalPrice.toLocaleString()} MXN
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-end">
                                      <span className="font-black font-mono text-xs text-slate-900 dark:text-white">
                                        ${originalPrice.toLocaleString()} <span className="text-xs text-slate-400">MXN</span>
                                      </span>
                                      {appliedCoupon && (
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                          Regular
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSeats(selectedSeats.filter(s => String(s.id) !== String(seat.id)))}
                                    className="w-7 h-7 rounded-xl bg-slate-200/60 dark:bg-white/10 hover:bg-rose-500/20 text-slate-500 dark:text-white/50 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-all active:scale-90"
                                    title="Quitar asiento"
                                  >
                                    <X size={13} />
                                  </button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>

                        {/* Banner Informativo Híbrido: Cuando hay asientos cubiertos y asientos regulares */}
                        {appliedCoupon && (appliedCoupon.is_complimentary || appliedCoupon.discount_type === 'free_vip') && selectedSeats.length > (appliedCoupon.max_tickets || 1) && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5"
                          >
                            <Info size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                              <strong className="text-emerald-600 dark:text-emerald-400 font-black">
                                {appliedCoupon.max_tickets || 1}
                              </strong> de tus asientos seleccionados está cubierto por tu cortesía. El asiento restante será procesado con pago regular.
                            </p>
                          </motion.div>
                        )}

                        {selectedSeats.length === 0 && (
                          <div className="py-8 text-center border border-dashed border-slate-200 dark:border-white/15 rounded-2xl bg-slate-50/50 dark:bg-white/[0.01]">
                            <Ticket className="mx-auto mb-2 text-slate-300 dark:text-slate-600" size={26} />
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Toca un asiento en el mapa interactivo</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* ══════ WIDGET PROACTIVO DE CUPONES / CORTESÍAS (PRE-SEAT REDEMPTION) ══════ */}
                  <div className="mb-5 space-y-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 p-3.5 xs:p-4 rounded-2xl transition-all">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase font-black tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Sparkles size={13} className="text-amber-500 animate-pulse" />
                        <span>¿Tienes un cupón o cortesía VIP?</span>
                      </label>
                      {appliedCoupon && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          Activo
                        </span>
                      )}
                    </div>

                    {!appliedCoupon ? (
                      <div className="space-y-2.5">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={couponCode}
                            onChange={e => {
                              setCouponCode(e.target.value);
                              setCouponError('');
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleValidateCoupon();
                              }
                            }}
                            placeholder="Ej. PRENSA_VIP, AMBAR2026..."
                            className="flex-1 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/15 focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-none transition-colors text-slate-900 dark:text-white uppercase tracking-wider"
                          />
                          <button
                            type="button"
                            onClick={() => handleValidateCoupon()}
                            disabled={isValidatingCoupon || !couponCode.trim()}
                            className="px-4 py-2 bg-slate-900 dark:bg-amber-honey dark:text-slate-950 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:bg-slate-800 dark:hover:bg-amber-gold disabled:opacity-40 transition-all active:scale-95 shrink-0"
                          >
                            {isValidatingCoupon ? 'Validando...' : 'Aplicar'}
                          </button>
                        </div>

                        {/* Input condicional de correo para cupones personales/exclusivos */}
                        {(couponRequiresEmail || couponEmailInput) && (
                          <div className="p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-1.5 animate-fadeIn">
                            <label className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                              <Mail size={12} />
                              <span>Ingresa tu correo autorizado para validar este cupón:</span>
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="email"
                                value={couponEmailInput}
                                onChange={e => {
                                  setCouponEmailInput(e.target.value);
                                  setEmail(e.target.value);
                                  setCouponError('');
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleValidateCoupon(undefined, e.currentTarget.value);
                                  }
                                }}
                                placeholder="tu-correo@ejemplo.com"
                                className="flex-1 bg-white dark:bg-white/5 border border-amber-400/50 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleValidateCoupon(undefined, couponEmailInput)}
                                disabled={isValidatingCoupon || !couponEmailInput.trim()}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors shrink-0"
                              >
                                Validar
                              </button>
                            </div>
                          </div>
                        )}

                        {!couponRequiresEmail && !couponEmailInput && (
                          <button
                            type="button"
                            onClick={() => setCouponRequiresEmail(true)}
                            className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-amber-500 underline flex items-center gap-1 font-medium transition-colors cursor-pointer"
                          >
                            <Mail size={11} />
                            <span>¿Tu cupón es personal / exclusivo? Ingresar correo</span>
                          </button>
                        )}

                        {couponError && (
                          <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 leading-tight">
                            {couponError}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle size={15} className="text-emerald-500" />
                            <span className="tracking-wide">
                              {appliedCoupon.code} • {appliedCoupon.discount_type === 'free_vip' || appliedCoupon.is_complimentary ? '100% Cortesía' : `${appliedCoupon.discount_value}% Desc.`}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={handleRemoveCoupon}
                            className="text-[10px] font-black uppercase tracking-wider text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition-colors flex items-center gap-0.5 ml-2"
                            title="Quitar cupón"
                          >
                            <X size={12} /> Quitar
                          </button>
                        </div>

                        {appliedCoupon.allowed_mode === 'DESIGNATED_ROW' && activeAllowedRows.length > 0 && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-extrabold flex items-center gap-1 pt-0.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block" />
                            <span>Fila de cortesía asignada: <strong>{activeAllowedRows.join(', ')}</strong></span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Price Breakdown */}
                  {baseTotal > 0 ? (
                    <PriceBreakdown baseTotal={baseTotal} label="Subtotal boletos" />
                  ) : (
                    <div className="pt-4 border-t border-slate-200/80 dark:border-white/10 mb-4">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-xs uppercase font-bold text-slate-400 tracking-[0.25em] mb-1">Total (Pase VIP Gratuito)</p>
                          <p className="text-3xl font-black font-mono leading-none text-emerald-500">$0 MXN</p>
                        </div>
                        <Sparkles size={20} className="text-amber-500 mb-1 animate-pulse" />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="mt-6 w-full">
                <PremiumCTAButton
                  disabled={isCurrentEventPast || (isMeetGreet ? false : (ticketMode === 'seatless' ? seatlessQuantity < 1 : selectedSeats.length === 0))}
                  onClick={handleProceedToCheckout}
                >
                  <span className="text-sm md:text-base font-black uppercase tracking-[0.2em] block">
                    {isCurrentEventPast
                      ? 'Venta Finalizada'
                      : (baseTotal === 0 && appliedCoupon
                        ? 'Reclamar Entrada VIP'
                        : (checkoutTotal > 0
                          ? `Pagar $${checkoutTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`
                          : 'Proceder al Pago'
                        )
                      )
                    }
                  </span>
                </PremiumCTAButton>
              </div>
            </motion.div>
          </div>

          {/* ══════ FULL-WIDTH FLYER SECTION (Abarca el ancho completo del contenedor incluyendo area de pago) ══════ */}
          {(() => {
            const flyerSrc = currentEvent?.flyer_url || currentEvent?.image_url || currentEvent?.flyer || currentEvent?.image;
            if (!flyerSrc) return null;
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="lg:col-span-12 space-y-4 mt-6"
              >
                <div className="w-full relative rounded-[2.5rem] overflow-hidden border border-amber-honey/20 group shadow-2xl shadow-amber-honey/10 bg-[#08090f] p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center">
                  {/* Backdrop ambient blur using flyer image */}
                  <div
                    className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-30 scale-110 pointer-events-none transition-all duration-1000"
                    style={{ backgroundImage: `url(${flyerSrc})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08090f] via-[#08090f]/75 to-[#08090f]/40 z-10 pointer-events-none" />

                  {/* Top Banner Header */}
                  <div className="w-full flex flex-wrap items-center justify-between gap-3 z-20 mb-4 px-2">
                    <div className="flex items-center gap-2 bg-amber-honey/10 border border-amber-honey/30 px-4 py-2 rounded-full backdrop-blur-md">
                      <Sparkles size={14} className="text-amber-honey animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-[0.25em] text-amber-honey">Flyer Oficial del Evento</span>
                    </div>
                    <button
                      onClick={() => setIsFlyerModalOpen(true)}
                      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-black uppercase tracking-wider px-4 py-2 rounded-full transition-all backdrop-blur-md shadow-lg hover:border-amber-honey/50"
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
                      src={flyerSrc}
                      alt={`Flyer oficial: ${currentEvent?.title || 'Evento'}`}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/images/placeholder-event.webp';
                      }}
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
                      <span className="text-xs font-black uppercase tracking-[0.3em] text-amber-honey">Arte Oficial</span>
                      <h3 className="text-xl md:text-2xl font-black text-white uppercase italic">{currentEvent?.title}</h3>
                    </div>
                    <p className="text-xs text-white/60 font-medium">
                      Haz clic en el cartel para explorar todos los detalles en alta resolución.
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </div>
      </ThemedSection>

      {/* ─── MOBILE STICKY BOTTOM BAR ─── */}
      {!isCurrentEventPast && (selectedSeats.length > 0 || isMeetGreet) && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] bg-nature-night/95 dark:bg-[#0B0F0D]/95 backdrop-blur-xl border-t border-white/10 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
          <div className="max-w-md mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-honey">
                {isMeetGreet ? `${mgQuantity} Pase(s)` : `${selectedSeats.length} Seleccionado(s)`}
              </p>
              <p className="text-2xl font-black text-white leading-none mt-0.5">
                ${Math.ceil(checkoutTotal).toLocaleString('es-MX')} <span className="text-xs font-bold text-white/50">MXN</span>
              </p>
            </div>
            <button
              onClick={handleProceedToCheckout}
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
          <div data-section-key="checkout_modal" className="fixed inset-0 z-[110] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              style={{
                backgroundColor: 'var(--sec-checkout_modal-card-bg, var(--card-bg, #0e101a))',
                borderColor: 'var(--sec-checkout_modal-border, var(--border-color, rgba(255,255,255,0.15)))',
                color: 'var(--sec-checkout_modal-text, var(--text-color, #ffffff))'
              }}
              className="border p-6 md:p-8 rounded-[2.5rem] w-full max-w-lg space-y-6 relative shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar backdrop-blur-xl transition-all duration-300"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-bl-[8rem] pointer-events-none blur-xl" />

              {/* ─── GUIADO DE PASOS (STEPPER) ─── */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-4 pt-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black",
                    !checkoutSuccess ? "bg-amber-400 text-slate-950" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                  )}>1</span>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">Datos</span>
                </div>
                <div className="h-[2px] w-8 bg-slate-200 dark:bg-white/10" />
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black",
                    isSubmitting ? "bg-amber-400 text-slate-950 animate-pulse" : (checkoutSuccess ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-slate-200 dark:bg-white/10 text-slate-400")
                  )}>2</span>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">Pago</span>
                </div>
                <div className="h-[2px] w-8 bg-slate-200 dark:bg-white/10" />
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black",
                    checkoutSuccess ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30" : "bg-slate-200 dark:bg-white/10 text-slate-400"
                  )}>3</span>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Activado</span>
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
                  className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
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
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest">
                      <ShieldCheck size={12} /> Accesos Activados y Asientos Bloqueados
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-wider text-slate-900 dark:text-white">¡Adquisición Confirmada!</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Tus accesos oficiales han sido activados y enviados a tu correo:</p>
                    <p className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">{email}</p>
                  </div>

                  {(() => {
                    const totalCargado = getCreatedTicketsTotalAmount();
                    const { base_price: costoNetoBoleto, service_fee: comisionPlataforma } = calculateTotalWithFee(totalCargado);
                    if (totalCargado <= 0) return null;
                    return (
                      <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-4 rounded-2xl text-left space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-500 dark:text-slate-400">
                          <span>Costo del Boleto ({createdTickets.length} accesos):</span>
                          <span className="font-semibold text-slate-900 dark:text-white">${costoNetoBoleto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</span>
                        </div>
                        <div className="flex justify-between text-amber-600 dark:text-amber-400">
                          <span className="flex items-center gap-1"><Info size={10} /> Cargo de servicio:</span>
                          <span className="font-semibold">+${comisionPlataforma.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</span>
                        </div>
                        <div className="flex justify-between text-slate-900 dark:text-white font-bold border-t border-slate-200 dark:border-white/10 pt-1.5 mt-1 text-xs">
                          <span>Total Pagado:</span>
                          <span className="text-amber-600 dark:text-amber-400 font-mono font-black">${Math.ceil(totalCargado).toLocaleString('es-MX')} MXN</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="bg-slate-50 dark:bg-white/[0.03] p-5 rounded-2xl border border-slate-200 dark:border-white/10 text-left space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Tus Boletos Digitales Activados</h4>
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {createdTickets.map((t, idx) => {
                        const ticketSeatDisplay = formatSeatAssignment({
                          row_letter: t.seat_row_letter || t.seat?.row_letter,
                          table_number: t.table_number || t.seat?.table_number,
                          row: t.seat_row || t.seat?.row,
                          number: t.seat_number || t.seat?.number || (idx + 1)
                        }) || t.seat_display;

                        return (
                          <div key={t.id} className="flex justify-between items-center bg-white dark:bg-white/5 p-3 rounded-xl border border-slate-200 dark:border-white/10">
                            <div>
                              <p className="text-xs font-bold text-slate-800 dark:text-white">Boleto #{idx + 1} ({ticketSeatDisplay})</p>
                              <span className="text-xs font-extrabold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">Estado: Activo • Listo para QR</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setTicketPassModalData({ ticket: t, seat: t.seat })}
                                className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 hover:text-slate-900 transition-colors border border-amber-400/30 px-3 py-1.5 rounded-lg bg-amber-400/10 cursor-pointer"
                              >
                                Ver Pase
                              </button>
                              <Link
                                href={`/tickets/${t.token}`}
                                className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-amber-500 transition-colors border border-slate-300 dark:border-white/10 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5"
                                target="_blank"
                              >
                                Enlace
                              </Link>
                            </div>
                          </div>
                        );
                      })}
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
                    className="w-full py-4 rounded-xl text-xs font-black uppercase tracking-[0.25em] bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:scale-[1.01] transition-all shadow-md active:scale-95"
                  >
                    Finalizar y Volver
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCheckoutSubmit} className="space-y-6">
                  <div className="border-b border-slate-100 dark:border-white/10 pb-4">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">Pasarela Segura</span>
                    <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white mt-1">Confirmar Reserva</h3>
                  </div>

                  <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 p-5 rounded-2xl space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resumen del Evento</p>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">{currentEvent?.title}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {isMeetGreet
                        ? `${mgQuantity} Pase(s) de Convivencia Meet & Greet`
                        : ticketMode === 'seatless'
                          ? `${seatlessQuantity} Boleto(s) General(es) Sin Asiento`
                          : `${selectedSeats.length} Asiento(s): ${selectedSeats.map(s => `${s.row}${s.number}`).join(', ')}`
                      }
                      {wantsMG && !isMeetGreet && " (Incluye Meet & Greet)"}
                    </p>

                    {baseTotal > 0 ? (
                      <div className="pt-3 border-t border-slate-200 dark:border-white/10 mt-2 space-y-1.5">
                        {!isMeetGreet && (
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Subtotal Boletos Concierto</span>
                            <span className="font-extrabold font-mono text-slate-900 dark:text-white">${seatsBaseTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</span>
                          </div>
                        )}
                        {(wantsMG || isMeetGreet) && (
                          <div className="flex justify-between items-center text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                            <span className="uppercase tracking-wider flex items-center gap-1">
                              <Star size={9} fill="currentColor" /> Pase(s) Meet & Greet
                            </span>
                            <span className="font-mono">+${mgBaseTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Subtotal Base</span>
                          <span className="font-extrabold font-mono text-slate-900 dark:text-white">${checkoutBasePrice.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Info size={10} className="shrink-0" /> Cargo de servicio
                          </span>
                          <span className="font-bold font-mono text-amber-600 dark:text-amber-400">+${checkoutServiceFee.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</span>
                        </div>
                        <p className="text-[8.5px] text-slate-500 dark:text-slate-400 pt-0.5 leading-snug">
                          🔒 <strong>Garantía de Transparencia:</strong> Recargo de procesamiento bancario seguro para validar tus accesos oficiales sin comisiones ocultas.
                        </p>
                        <div className="flex justify-between items-end pt-2 border-t border-slate-200 dark:border-white/10">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Total a Pagar</span>
                          <span className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">${checkoutTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</span>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-3 border-t border-slate-200 dark:border-white/10 mt-2 flex justify-between items-center text-xs">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Total Pase VIP Gratuito:</span>
                        <span className="font-black font-mono text-emerald-600 dark:text-emerald-400 text-base">$0.00 MXN</span>
                      </div>
                    )}
                  </div>

                  {/* VIP Coupon Code Input */}
                  <div className="space-y-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 p-4 rounded-2xl">
                    <label className="text-[9.5px] uppercase font-black tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Sparkles size={12} className="text-amber-500 animate-pulse" /> Código de Cupón / Entrada VIP
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
                        className="flex-1 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/15 focus:border-amber-400 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none transition-colors text-slate-900 dark:text-white uppercase tracking-wider"
                      />
                      <button
                        type="button"
                        onClick={() => handleValidateCoupon(undefined, email || couponEmailInput)}
                        disabled={isValidatingCoupon || !couponCode.trim()}
                        className="px-4 py-2.5 bg-slate-900 dark:bg-white dark:text-slate-950 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:bg-slate-800 disabled:opacity-40 transition-all active:scale-95"
                      >
                        {isValidatingCoupon ? 'Validando...' : 'Aplicar'}
                      </button>
                    </div>

                    {/* Email requerido en modal si el cupón lo necesita y aún no hay correo */}
                    {(couponRequiresEmail || (!appliedCoupon && !email && couponEmailInput)) && (
                      <div className="p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-1.5 animate-fadeIn">
                        <label className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <Mail size={12} />
                          <span>Correo de validación para este cupón:</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            value={couponEmailInput || email}
                            onChange={e => {
                              setCouponEmailInput(e.target.value);
                              setEmail(e.target.value);
                              setCouponError('');
                            }}
                            placeholder="tu-correo@ejemplo.com"
                            className="flex-1 bg-white dark:bg-white/5 border border-amber-400/50 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleValidateCoupon(undefined, couponEmailInput || email)}
                            disabled={isValidatingCoupon || !(couponEmailInput || email).trim()}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors shrink-0"
                          >
                            Validar
                          </button>
                        </div>
                      </div>
                    )}

                    {appliedCoupon && (
                      <div className="mt-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle size={14} className="text-emerald-500" />
                          {appliedCoupon.discount_type === 'free_vip' ? '¡Entrada VIP Gratuita (100% Descuento)!' : '¡Cupón VIP Aplicado!'}
                        </span>
                        <button type="button" onClick={handleRemoveCoupon} className="text-[10px] text-emerald-800 dark:text-emerald-300 underline font-bold">Quitar</button>
                      </div>
                    )}
                    {couponError && (
                      <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-1">{couponError}</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9.5px] uppercase font-black tracking-widest text-slate-500 dark:text-slate-400">Nombre Completo</label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        placeholder="Juan Pérez..."
                        className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/15 focus:border-amber-400 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none transition-colors text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9.5px] uppercase font-black tracking-widest text-slate-500 dark:text-slate-400">Correo Electrónico</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="juan@example.com..."
                        className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/15 focus:border-amber-400 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none transition-colors text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9.5px] uppercase font-black tracking-widest text-slate-500 dark:text-slate-400">Teléfono (WhatsApp)</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+52 55 1234 5678..."
                        className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/15 focus:border-amber-400 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none transition-colors text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || checkoutSuccess}
                    className="w-full py-4.5 rounded-2xl text-xs font-black uppercase tracking-[0.25em] bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 shadow-xl shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2.5 hover:scale-[1.01] active:scale-95"
                  >
                    <ShieldCheck size={18} className="text-sm md:text-base font-black uppercase tracking-[0.2em] block" />
                    {isSubmitting
                      ? 'Procesando...'
                      : (baseTotal === 0 && appliedCoupon
                        ? 'Reclamar Entrada VIP Gratuita'
                        : `Pagar $${checkoutTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`
                      )
                    }
                    {!isSubmitting ? <Sparkles size={16} className="shrink-0 animate-pulse" /> : null}
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
                  src={currentEvent?.flyer_url || currentEvent?.image_url || currentEvent?.flyer || currentEvent?.image || '/images/placeholder-event.webp'}
                  alt={`Flyer oficial ampliando: ${currentEvent?.title || 'Evento'}`}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/images/placeholder-event.webp';
                  }}
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

        {/* Modal de Pase Digital (TicketQRModal) */}
        {ticketPassModalData && currentEvent && (
          <TicketQRModal
            isOpen={Boolean(ticketPassModalData)}
            onClose={() => setTicketPassModalData(null)}
            ticket={ticketPassModalData.ticket}
            event={currentEvent}
            seat={ticketPassModalData.seat}
          />
        )}

        {/* ─── MODAL LÍMITE DE CORTESÍA EXCEDIDO (COMPLIMENTARY_ORDER_LIMIT_EXCEEDED) ─── */}
        {limitExceededModalData && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-[#121418] border border-amber-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                  <AlertCircle size={26} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                    Política de Cortesía
                  </span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                    Límite de Cortesía Excedido
                  </h3>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {limitExceededModalData.detail}
              </p>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const maxT = limitExceededModalData.maxTickets || 1;
                    setSelectedSeats(prev => prev.slice(0, maxT));
                    setLimitExceededModalData(null);
                    showAlert(`Se conservó ${maxT === 1 ? '1 asiento gratis' : `${maxT} asientos gratis`}.`, 'Asiento Ajustado', 'info');
                  }}
                  className="w-full py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-slate-950 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-emerald-500/20"
                >
                  <Check size={16} />
                  <span>Dejar solo {limitExceededModalData.maxTickets} asiento{limitExceededModalData.maxTickets > 1 ? 's' : ''} gratis</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleRemoveCoupon();
                    setLimitExceededModalData(null);
                  }}
                  className="w-full py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <X size={16} />
                  <span>Retirar cupón (mantener boletos a tarifa regular)</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TourPage;