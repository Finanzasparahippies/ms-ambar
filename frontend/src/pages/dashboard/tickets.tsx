import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Search, Ticket, CheckCircle2, XCircle, ArrowLeft, RefreshCw,
  QrCode, Mail, UserCheck, ShieldCheck, MapPin, Calendar,
  CreditCard, Sparkles, AlertTriangle, Copy, Check, Filter,
  RotateCcw, SlidersHorizontal, ChevronRight, Eye, Phone, User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../lib/api';
import { showAlert, showConfirm, showToast } from '../../lib/notifications';
import TicketPass from '../../components/TicketPass';
import DigitalBoxOfficeControl from '../../components/DigitalBoxOfficeControl';
import ReservedSeatsManager from '../../components/dashboard/ReservedSeatsManager';

interface AdminTicket {
  id: number;
  folio: string;
  token: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string;
  event_id: number;
  event_title: string;
  event?: {
    id: number;
    title: string;
    artist: string;
    date: string;
    venue_name: string;
    venue_address?: string;
  };
  zone: string;
  desglose: {
    row_letter?: string;
    table_number?: string | number;
    seat_number?: string | number;
    formatted: string;
    chips: {
      row?: string;
      table?: string;
      seat?: string;
    };
  };
  row_letter?: string;
  table_number?: string | number;
  seat_number?: string | number;
  status: 'ACTIVE' | 'CHECKED_IN' | 'CANCELLED' | 'COMPLIMENTARY';
  raw_status: string;
  is_scanned: boolean;
  scanned_at?: string;
  amount_paid?: number | string;
  has_mg: boolean;
  payment_reference: string;
  coupon?: {
    code: string;
    discount_type: string;
    is_complimentary: boolean;
  };
  created_at: string;
}

export default function TicketsManagementPage() {
  const router = useRouter();
  const [isStaff, setIsStaff] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'issued' | 'reserved'>('issued');

  // Modal states
  const [activeModalTicket, setActiveModalTicket] = useState<AdminTicket | null>(null);
  const [reassignModalTicket, setReassignModalTicket] = useState<AdminTicket | null>(null);
  const [newSeatIdInput, setNewSeatIdInput] = useState('');
  const [resendModalTicket, setResendModalTicket] = useState<AdminTicket | null>(null);
  const [resendEmailInput, setResendEmailInput] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // 1. Auth Verification
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      router.replace('/login?next=/dashboard/tickets');
      return;
    }
    api.get('/users/profile/')
      .then(res => {
        if (res.data?.is_staff || res.data?.is_superuser) {
          setIsStaff(true);
        } else {
          setIsStaff(false);
          showAlert('Se requieren privilegios administrativos de Staff para acceder a este módulo.', 'Acceso Restringido', 'warning');
          router.replace('/dashboard');
        }
      })
      .catch(() => {
        router.replace('/login?next=/dashboard/tickets');
      });
  }, [router]);

  // 2. Debounce Search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 3. Load Events List for Dropdown Filter
  useEffect(() => {
    api.get('/tickets/events/')
      .then(res => {
        setEvents(Array.isArray(res.data) ? res.data : []);
      })
      .catch(err => console.error('Error fetching events:', err));
  }, []);

  const currentEvent = useMemo(() => {
    if (!events || events.length === 0) return null;
    if (selectedEventId && selectedEventId !== 'all') {
      return events.find((e: any) => String(e.id) === String(selectedEventId)) || events[0];
    }
    return events[0] || null;
  }, [events, selectedEventId]);

  const handleEventUpdated = (updatedEvent: any) => {
    setEvents(prev => prev.map(e => e.id === updatedEvent.id ? { ...e, ...updatedEvent } : e));
  };

  // 4. Fetch Tickets with Backend Filters
  const fetchTickets = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (selectedEventId && selectedEventId !== 'all') {
        params.append('event_id', selectedEventId);
      }
      if (selectedStatus && selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }
      if (selectedType && selectedType !== 'all') {
        params.append('type', selectedType);
      }
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      const [ticketsRes, eventsRes] = await Promise.all([
        api.get(`/tickets/admin/tickets/?${params.toString()}`),
        api.get('/tickets/events/').catch(() => null)
      ]);
      const data = Array.isArray(ticketsRes.data) ? ticketsRes.data : (ticketsRes.data?.results || []);
      setTickets(data);
      if (eventsRes?.data && Array.isArray(eventsRes.data)) {
        setEvents(eventsRes.data);
      }
    } catch (err: any) {
      console.error('Error fetching admin tickets:', err);
      showToast('Error al actualizar la lista de boletos.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedEventId, selectedStatus, selectedType, debouncedSearch]);

  useEffect(() => {
    if (isStaff) {
      fetchTickets();
    }
  }, [isStaff, fetchTickets]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedToken(id);
      showToast('Token UUID copiado al portapapeles', 'success');
      setTimeout(() => setCopiedToken(null), 2000);
    }
  };

  // Transactional Actions: Check-In
  const handleCheckIn = async (ticket: AdminTicket) => {
    setIsActionLoading(true);
    let lat: number | null = null;
    let lng: number | null = null;

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        // Fallback gracefully without geolocation
      }
    }

    try {
      const res = await api.post(`/tickets/admin/tickets/${ticket.id}/check-in/`, {
        latitude: lat,
        longitude: lng,
        location_label: lat ? 'Néctar Check-In Gate' : 'Control Central'
      });
      showToast(res.data?.message || 'Check-in realizado con éxito.', 'success');
      fetchTickets(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Falla al procesar check-in.';
      showAlert(msg, 'Error en Check-In', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Transactional Actions: Resend Email Modal & Handler
  const handleOpenResendModal = (ticket: AdminTicket) => {
    setResendModalTicket(ticket);
    setResendEmailInput(ticket.buyer_email || '');
  };

  const handleExecuteResendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendModalTicket || !resendEmailInput.trim()) return;

    setIsActionLoading(true);
    try {
      const res = await api.post(`/tickets/admin/tickets/${resendModalTicket.id}/resend-email/`, {
        email: resendEmailInput.trim()
      });
      showAlert(
        res.data?.message || `Boleto enviado con éxito a ${resendEmailInput.trim()}.`,
        '¡Correo Transaccional Enviado!',
        'success'
      );
      setResendModalTicket(null);
      fetchTickets(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'No fue posible reenviar el correo en este momento.';
      showAlert(msg, 'Error de Entrega', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Transactional Actions: Cancel Ticket
  const handleCancelTicket = async (ticket: AdminTicket) => {
    const confirmed = await showConfirm(
      `¿Estás seguro de cancelar el boleto ${ticket.folio} (${ticket.buyer_email})? Esta acción liberará la butaca en la matriz del recinto.`,
      'Confirmar Cancelación'
    );
    if (!confirmed) return;

    setIsActionLoading(true);
    try {
      const res = await api.post(`/tickets/admin/tickets/${ticket.id}/cancel/`, {
        reason: 'Cancelación manual por Staff'
      });
      showAlert(res.data?.message || 'Boleto cancelado y butaca liberada.', 'Boleto Cancelado', 'info');
      fetchTickets(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Falla al cancelar boleto.';
      showAlert(msg, 'Error', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Transactional Actions: Atomic Reassignment
  const handleExecuteReassignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignModalTicket || !newSeatIdInput.trim()) return;

    setIsActionLoading(true);
    try {
      const res = await api.post(`/tickets/admin/tickets/${reassignModalTicket.id}/reassign/`, {
        new_seat_id: parseInt(newSeatIdInput.trim(), 10)
      });
      showAlert(res.data?.message || 'Butaca reasignada con éxito.', 'Reasignación Exitosa', 'success');
      setReassignModalTicket(null);
      setNewSeatIdInput('');
      fetchTickets(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'No se pudo reasignar la butaca.';
      showAlert(msg, 'Falla de Reasignación', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const total = tickets.length;
    const checkedIn = tickets.filter(t => t.status === 'CHECKED_IN').length;
    const active = tickets.filter(t => t.status === 'ACTIVE').length;
    const complimentary = tickets.filter(t => t.status === 'COMPLIMENTARY').length;
    const cancelled = tickets.filter(t => t.status === 'CANCELLED').length;
    const totalRevenue = tickets.reduce((acc, t) => acc + (parseFloat(String(t.amount_paid || 0)) || 0), 0);

    return { total, checkedIn, active, complimentary, cancelled, totalRevenue };
  }, [tickets]);

  if (isStaff === false) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Auditoría y Gestión de Boletos | Ms Ambar Admin</title>
        <meta name="description" content="Gestión, verificación y control transaccional de boletos de Ms Ambar" />
      </Head>

      <div className="min-h-screen bg-[#080c0a] text-[#F4F6F0] selection:bg-amber-honey selection:text-slate-950 font-outfit">
        {/* Background glow effects */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[140px]" />
          <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] bg-amber-600/5 rounded-full blur-[160px]" />
          <div className="absolute bottom-[-10%] left-[30%] w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[180px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          {/* Header & Breadcrumb */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-[#F4F6F0]/60 hover:text-amber-honey transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10"
                >
                  <ArrowLeft size={13} /> Volver a Consola
                </Link>
                <span className="text-white/20">/</span>
                <span className="text-xs font-black uppercase tracking-widest text-amber-honey flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-honey animate-ping inline-block" />
                  Módulo de Auditoría
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white">
                Gestión de Boletos Activos
              </h1>
              <p className="text-xs font-bold uppercase tracking-widest text-[#F4F6F0]/50 mt-1">
                Auditoría en tiempo real, control de accesos y reasignación de butacas
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <DigitalBoxOfficeControl
                event={currentEvent}
                onEventUpdated={handleEventUpdated}
              />

              <button
                type="button"
                onClick={() => fetchTickets()}
                disabled={refreshing}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-black uppercase tracking-wider px-4 py-3 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                title="Actualizar datos"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin text-amber-honey' : 'text-amber-honey'} />
                <span>{refreshing ? 'Sincronizando...' : 'Actualizar'}</span>
              </button>

              <Link
                href="/dashboard/scan-tickets"
                className="flex items-center gap-2 bg-gradient-to-r from-amber-honey to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 text-xs font-black uppercase tracking-wider px-5 py-3 rounded-xl transition-all shadow-[0_4px_20px_rgba(229,169,59,0.2)] active:scale-95 cursor-pointer"
              >
                <QrCode size={15} /> Escáner Puerta
              </Link>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
            <div className="bg-[#0c0f0d]/80 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-lg">
              <span className="text-[10px] uppercase font-black tracking-widest text-white/40 block mb-1">
                Total Registrados
              </span>
              <p className="text-2xl sm:text-3xl font-black font-mono text-white leading-none">
                {stats.total}
              </p>
              <span className="text-[9px] font-bold text-white/50 uppercase mt-2 block">
                Folios Emitidos
              </span>
            </div>

            <div className="bg-[#0c0f0d]/80 backdrop-blur-md p-4 rounded-2xl border border-emerald-500/25 shadow-lg">
              <span className="text-[10px] uppercase font-black tracking-widest text-emerald-400 block mb-1">
                Boletos Activos
              </span>
              <p className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 leading-none">
                {stats.active}
              </p>
              <span className="text-[9px] font-bold text-emerald-500/80 uppercase mt-2 block">
                Listos para Ingreso
              </span>
            </div>

            <div className="bg-[#0c0f0d]/80 backdrop-blur-md p-4 rounded-2xl border border-blue-500/25 shadow-lg">
              <span className="text-[10px] uppercase font-black tracking-widest text-blue-400 block mb-1">
                Ingresados
              </span>
              <p className="text-2xl sm:text-3xl font-black font-mono text-blue-400 leading-none">
                {stats.checkedIn}
              </p>
              <span className="text-[9px] font-bold text-blue-500/80 uppercase mt-2 block">
                Check-In Completado
              </span>
            </div>

            <div className="bg-[#0c0f0d]/80 backdrop-blur-md p-4 rounded-2xl border border-amber-500/25 shadow-lg">
              <span className="text-[10px] uppercase font-black tracking-widest text-amber-honey block mb-1">
                Cortesías VIP
              </span>
              <p className="text-2xl sm:text-3xl font-black font-mono text-amber-honey leading-none">
                {stats.complimentary}
              </p>
              <span className="text-[9px] font-bold text-amber-500/80 uppercase mt-2 block">
                Prensa / Invitados
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-[#0c0f0d]/80 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-lg">
              <span className="text-[10px] uppercase font-black tracking-widest text-white/40 block mb-1">
                Recaudación Total
              </span>
              <p className="text-2xl sm:text-3xl font-black font-mono text-white leading-none">
                ${stats.totalRevenue.toLocaleString('es-MX')}
              </p>
              <span className="text-[9px] font-bold text-emerald-400 uppercase mt-2 block">
                MXN Transaccionados
              </span>
            </div>
          </div>

          {/* View Mode Tabs: Boletos Emitidos vs. Butacas Reservadas */}
          <div className="flex items-center gap-2 mb-6 p-1.5 bg-black/40 border border-white/10 rounded-2xl w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('issued')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'issued'
                  ? 'bg-amber-honey text-slate-950 shadow-md shadow-amber-honey/20'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Ticket size={14} />
              <span>Boletos Emitidos ({stats.total})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('reserved')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'reserved'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShieldCheck size={14} />
              <span>Butacas Reservadas / En Proceso</span>
            </button>
          </div>

          {activeTab === 'reserved' ? (
            <ReservedSeatsManager
              selectedEventId={selectedEventId}
              onSeatsReleased={() => fetchTickets()}
            />
          ) : (
            <>
              {/* Interactive Filters Bar (Dark Glass) */}
              <div className="bg-[#0c0f0d]/90 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-5 mb-6 shadow-xl space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
              {/* Buscador en tiempo real con debounce 300ms */}
              <div className="md:col-span-5 relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre, correo, folio (TKT-000001) o token QR..."
                  className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/15 focus:border-amber-honey/70 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none transition-colors"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    <XCircle size={14} />
                  </button>
                )}
              </div>

              {/* Filtro por Evento */}
              <div className="md:col-span-3">
                <select
                  value={selectedEventId}
                  onChange={e => setSelectedEventId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-amber-honey/70 rounded-xl text-xs text-white focus:outline-none transition-colors"
                >
                  <option value="all" className="bg-[#0c0f0d]">Todos los Eventos</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id} className="bg-[#0c0f0d]">
                      {ev.title} ({ev.date ? new Date(ev.date).toLocaleDateString('es-MX') : 'S/F'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por Estatus */}
              <div className="md:col-span-2">
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-amber-honey/70 rounded-xl text-xs text-white focus:outline-none transition-colors"
                >
                  <option value="all" className="bg-[#0c0f0d]">Todos los Estatus</option>
                  <option value="ACTIVE" className="bg-[#0c0f0d]">Activo (Pagado)</option>
                  <option value="CHECKED_IN" className="bg-[#0c0f0d]">Ingresado (Check-In)</option>
                  <option value="COMPLIMENTARY" className="bg-[#0c0f0d]">Cortesía VIP</option>
                  <option value="CANCELLED" className="bg-[#0c0f0d]">Cancelado</option>
                </select>
              </div>

              {/* Filtro por Tipo */}
              <div className="md:col-span-2">
                <select
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-amber-honey/70 rounded-xl text-xs text-white focus:outline-none transition-colors"
                >
                  <option value="all" className="bg-[#0c0f0d]">Todos los Tipos</option>
                  <option value="NUMBERED" className="bg-[#0c0f0d]">Asiento Numerado</option>
                  <option value="GENERAL" className="bg-[#0c0f0d]">Boleto General</option>
                  <option value="MG" className="bg-[#0c0f0d]">Meet & Greet</option>
                  <option value="COMPLIMENTARY" className="bg-[#0c0f0d]">Cortesía</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main High-Performance Dark Glass Table */}
          <div className="bg-[#0c0f0d]/90 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-black uppercase tracking-[0.2em] text-[#F4F6F0]/50">
                    <th className="py-4 px-4 sm:px-6">Folio & Token</th>
                    <th className="py-4 px-4">Comprador</th>
                    <th className="py-4 px-4">Evento</th>
                    <th className="py-4 px-4">Ubicación Física (Chips)</th>
                    <th className="py-4 px-4">Estatus</th>
                    <th className="py-4 px-4">Pago / Cupón</th>
                    <th className="py-4 px-4 sm:px-6 text-right">Acciones Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-white/50">
                        <div className="w-8 h-8 rounded-full border-2 border-t-amber-honey border-amber-honey/20 animate-spin mx-auto mb-3" />
                        <span className="text-xs font-bold uppercase tracking-widest text-amber-honey">
                          Cargando matriz de boletos...
                        </span>
                      </td>
                    </tr>
                  ) : tickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-white/50">
                        <Ticket size={32} className="mx-auto text-white/20 mb-2" />
                        <p className="text-sm font-bold text-white/70">No se encontraron boletos que coincidan con los criterios de búsqueda.</p>
                        <p className="text-xs text-white/40 mt-1">Prueba limpiando los filtros o utilizando otro término de búsqueda.</p>
                      </td>
                    </tr>
                  ) : (
                    tickets.map(ticket => {
                      const chips = ticket.desglose?.chips || {};
                      const isComplimentary = ticket.status === 'COMPLIMENTARY';
                      const isCheckedIn = ticket.status === 'CHECKED_IN';
                      const isCancelled = ticket.status === 'CANCELLED';

                      return (
                        <tr
                          key={ticket.id}
                          className="hover:bg-white/[0.02] transition-colors group"
                        >
                          {/* Columna: Folio & Token */}
                          <td className="py-4 px-4 sm:px-6 align-middle">
                            <div className="space-y-1">
                              <span className="font-mono font-black text-amber-honey text-xs block">
                                {ticket.folio}
                              </span>
                              <div className="flex items-center gap-1.5 text-[11px] text-white/40 font-mono">
                                <span className="truncate max-w-[100px] sm:max-w-[130px]" title={ticket.token}>
                                  {ticket.token}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(ticket.token, String(ticket.id))}
                                  className="text-white/40 hover:text-white transition-colors"
                                  title="Copiar UUID"
                                >
                                  {copiedToken === String(ticket.id) ? (
                                    <Check size={12} className="text-emerald-400" />
                                  ) : (
                                    <Copy size={12} />
                                  )}
                                </button>
                              </div>
                            </div>
                          </td>

                          {/* Columna: Comprador */}
                          <td className="py-4 px-4 align-middle">
                            <div className="space-y-0.5">
                              <p className="font-bold text-white truncate max-w-[180px]">
                                {ticket.buyer_name || 'Asistente'}
                              </p>
                              <p className="text-[11px] text-white/50 truncate max-w-[180px]">
                                {ticket.buyer_email}
                              </p>
                              {ticket.buyer_phone && (
                                <p className="text-[10px] text-white/40 font-mono">
                                  {ticket.buyer_phone}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Columna: Evento */}
                          <td className="py-4 px-4 align-middle">
                            <div className="space-y-0.5 max-w-[170px]">
                              <p className="font-bold text-white truncate" title={ticket.event_title}>
                                {ticket.event_title}
                              </p>
                              <span className="text-[10px] text-amber-honey/70 font-mono block">
                                {ticket.event?.date ? new Date(ticket.event.date).toLocaleDateString('es-MX', {
                                  day: '2-digit', month: 'short', year: 'numeric'
                                }) : 'Fecha pendiente'}
                              </span>
                            </div>
                          </td>

                          {/* Columna: Ubicación Física con chips claros */}
                          <td className="py-4 px-4 align-middle">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {chips.row ? (
                                  <span className="inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono tracking-wider">
                                    {chips.row}
                                  </span>
                                ) : null}

                                {chips.table ? (
                                  <span className="inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono tracking-wider">
                                    {chips.table}
                                  </span>
                                ) : null}

                                {chips.seat ? (
                                  <span className="inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-200 dark:bg-white/10 border border-slate-300 dark:border-white/15 text-slate-800 dark:text-white font-mono tracking-wider">
                                    {chips.seat}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/60">
                                    {ticket.zone}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-white/40 font-mono tracking-tight">
                                {ticket.desglose?.formatted || ticket.zone}
                              </p>
                            </div>
                          </td>

                          {/* Columna: Estatus */}
                          <td className="py-4 px-4 align-middle">
                            {isCheckedIn ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                <CheckCircle2 size={11} className="text-blue-400" /> Ingresado
                              </span>
                            ) : isCancelled ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                <XCircle size={11} className="text-rose-400" /> Cancelado
                              </span>
                            ) : isComplimentary ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                <Sparkles size={11} className="text-amber-400" /> Cortesía VIP
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Activo
                              </span>
                            )}
                            {ticket.scanned_at && (
                              <span className="text-[9px] text-white/30 block mt-1 font-mono">
                                {new Date(ticket.scanned_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </td>

                          {/* Columna: Pago / Cupón */}
                          <td className="py-4 px-4 align-middle">
                            <div className="space-y-0.5">
                              <span className="font-mono font-bold text-white text-xs block">
                                ${parseFloat(String(ticket.amount_paid || 0)).toLocaleString('es-MX')} MXN
                              </span>
                              <span className="text-[10px] text-white/40 font-mono block truncate max-w-[120px]" title={ticket.payment_reference}>
                                {ticket.payment_reference}
                              </span>
                            </div>
                          </td>

                          {/* Columna: Acciones Rápidas */}
                          <td className="py-4 px-4 sm:px-6 align-middle text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Ver Pase Digital Modal */}
                              <button
                                type="button"
                                onClick={() => setActiveModalTicket(ticket)}
                                className="p-2 rounded-xl bg-white/5 hover:bg-amber-honey/20 border border-white/10 hover:border-amber-honey/40 text-white hover:text-amber-honey transition-colors"
                                title="Ver Pase Digital con QR"
                              >
                                <Eye size={14} />
                              </button>

                              {/* Check-In Manual */}
                              <button
                                type="button"
                                onClick={() => handleCheckIn(ticket)}
                                disabled={isActionLoading || isCancelled}
                                className={`p-2 rounded-xl border transition-colors ${isCheckedIn
                                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 hover:bg-blue-500/30'
                                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30'
                                } disabled:opacity-30`}
                                title={isCheckedIn ? 'Actualizar Check-In' : 'Marcar Ingreso Manual'}
                              >
                                <UserCheck size={14} />
                              </button>

                              {/* Reenviar Correo */}
                              <button
                                type="button"
                                onClick={() => handleOpenResendModal(ticket)}
                                disabled={isActionLoading || isCancelled}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors disabled:opacity-30"
                                title="Reenviar Pase por Correo"
                              >
                                <Mail size={14} />
                              </button>

                              {/* Reasignar Butaca */}
                              <button
                                type="button"
                                onClick={() => {
                                  setReassignModalTicket(ticket);
                                  setNewSeatIdInput('');
                                }}
                                disabled={isActionLoading || isCancelled}
                                className="p-2 rounded-xl bg-white/5 hover:bg-amber-500/20 border border-white/10 text-white/70 hover:text-amber-honey transition-colors disabled:opacity-30"
                                title="Reasignar Butaca"
                              >
                                <RotateCcw size={14} />
                              </button>

                              {/* Cancelar Boleto */}
                              {!isCancelled && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelTicket(ticket)}
                                  disabled={isActionLoading}
                                  className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors disabled:opacity-30"
                                  title="Cancelar Boleto"
                                >
                                  <XCircle size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </>
          )}
        </div>

        {/* ══════ MODAL: PASE DIGITAL INTERACTIVO CON QR FUNCIONAL ══════ */}
        <AnimatePresence>
          {activeModalTicket && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
              onClick={() => setActiveModalTicket(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                onClick={e => e.stopPropagation()}
                className="relative max-w-lg w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-2"
              >
                <div className="flex justify-end mb-2">
                  <button
                    type="button"
                    onClick={() => setActiveModalTicket(null)}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
                  >
                    <XCircle size={20} />
                  </button>
                </div>

                <TicketPass
                  ticket={{
                    token: activeModalTicket.token,
                    user_email: activeModalTicket.buyer_email,
                    seat: {
                      row: activeModalTicket.row_letter || '',
                      number: activeModalTicket.seat_number || '—',
                      row_letter: activeModalTicket.row_letter,
                      table_number: activeModalTicket.table_number,
                      table_label: activeModalTicket.table_number ? `Mesa ${activeModalTicket.table_number}` : undefined,
                      section: activeModalTicket.zone,
                    },
                    seat_display: activeModalTicket.desglose?.formatted
                  }}
                  event={{
                    title: activeModalTicket.event_title,
                    date: activeModalTicket.event?.date || new Date().toISOString(),
                    venue_name: activeModalTicket.event?.venue_name || 'London Pub',
                    venue_address: activeModalTicket.event?.venue_address || 'Hermosillo, Sonora',
                    section: activeModalTicket.zone
                  }}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════ MODAL: REASIGNACIÓN ATÓMICA DE BUTACA ══════ */}
        <AnimatePresence>
          {reassignModalTicket && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
              onClick={() => setReassignModalTicket(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                onClick={e => e.stopPropagation()}
                className="relative max-w-md w-full bg-[#0c0f0d] border border-amber-honey/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5"
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2 text-amber-honey font-black text-sm uppercase tracking-wider">
                    <RotateCcw size={16} />
                    <span>Reasignación Atómica de Butaca</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReassignModalTicket(null)}
                    className="text-white/40 hover:text-white"
                  >
                    <XCircle size={18} />
                  </button>
                </div>

                <div className="space-y-3 bg-white/[0.02] p-4 rounded-2xl border border-white/5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-white/40">Boleto Folio:</span>
                    <strong className="text-white font-mono">{reassignModalTicket.folio}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Asistente:</span>
                    <span className="text-white font-bold">{reassignModalTicket.buyer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Asiento Actual:</span>
                    <span className="text-amber-honey font-bold">{reassignModalTicket.desglose?.formatted || 'Sin Asiento'}</span>
                  </div>
                </div>

                <form onSubmit={handleExecuteReassignment} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-white/80 block">
                      ID Numérico de la Nueva Butaca:
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newSeatIdInput}
                      onChange={e => setNewSeatIdInput(e.target.value)}
                      placeholder="Ej. 142"
                      className="w-full px-4 py-2.5 bg-black/50 border border-white/20 focus:border-amber-honey rounded-xl text-white font-mono text-sm focus:outline-none"
                    />
                    <p className="text-[10px] text-white/40 leading-relaxed">
                      El motor ejecutará un bloqueo de base de datos (`select_for_update`) para garantizar que la nueva butaca esté libre.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setReassignModalTicket(null)}
                      className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-xs font-bold uppercase tracking-wider"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isActionLoading || !newSeatIdInput.trim()}
                      className="px-5 py-2.5 rounded-xl bg-amber-honey hover:bg-amber-gold text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg disabled:opacity-50 transition-all"
                    >
                      {isActionLoading ? 'Reasignando...' : 'Confirmar Reasignación'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════ MODAL: REENVÍO DE CORREO TRANSACCIONAL ══════ */}
        <AnimatePresence>
          {resendModalTicket && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
              onClick={() => setResendModalTicket(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                onClick={e => e.stopPropagation()}
                className="relative max-w-md w-full bg-[#0c0f0d] border border-amber-honey/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5"
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2 text-amber-honey font-black text-sm uppercase tracking-wider">
                    <Mail size={16} />
                    <span>Reenviar Boleto Oficial por Correo</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setResendModalTicket(null)}
                    className="text-white/40 hover:text-white"
                  >
                    <XCircle size={18} />
                  </button>
                </div>

                <div className="space-y-2.5 bg-white/[0.02] p-4 rounded-2xl border border-white/5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-white/40">Boleto Folio:</span>
                    <strong className="text-white font-mono">{resendModalTicket.folio}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Evento:</span>
                    <span className="text-white font-bold truncate max-w-[200px]">{resendModalTicket.event_title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Asistente:</span>
                    <span className="text-white font-bold">{resendModalTicket.buyer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Ubicación:</span>
                    <span className="text-amber-honey font-bold">{resendModalTicket.desglose?.formatted || resendModalTicket.zone}</span>
                  </div>
                </div>

                <form onSubmit={handleExecuteResendEmail} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-white/80 block">
                      Correo Electrónico de Destino:
                    </label>
                    <input
                      type="email"
                      required
                      value={resendEmailInput}
                      onChange={e => setResendEmailInput(e.target.value)}
                      placeholder="ejemplo@correo.com"
                      className="w-full px-4 py-2.5 bg-black/50 border border-white/20 focus:border-amber-honey rounded-xl text-white font-mono text-sm focus:outline-none"
                    />
                    <p className="text-[10px] text-white/40 leading-relaxed">
                      El servidor despachará la plantilla HTML oficial con el código QR único e instrucciones completas de acceso al recinto.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setResendModalTicket(null)}
                      className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-xs font-bold uppercase tracking-wider"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isActionLoading || !resendEmailInput.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-honey to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <Mail size={14} />
                      <span>{isActionLoading ? 'Despachando...' : 'Reenviar Ahora'}</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
