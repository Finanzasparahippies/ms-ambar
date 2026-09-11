import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Download,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  ArrowRight,
  Box,
  Mail
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { getApiUrl } from '../lib/utils';

export interface TrackingEvent {
  stage: 'confirmed' | 'label_created' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception' | 'cancelled';
  status: string;
  description: string;
  location?: string;
  timestamp: string;
}

export interface TrackingResponse {
  success: boolean;
  order_id?: number;
  tracking_number?: string;
  carrier?: string;
  carrier_url?: string;
  current_stage: 'confirmed' | 'label_created' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception' | 'cancelled';
  status_label: string;
  stage_percentage: number;
  packaging_type?: 'box' | 'bag';
  estimated_delivery?: string;
  is_cached?: boolean;
  is_pre_transit?: boolean;
  events: TrackingEvent[];
  message?: string;
  shipping_status?: string;
}

const STEP_DEFINITIONS = [
  { stage: 'confirmed', label: 'Confirmado', icon: CheckCircle2, description: 'Pago recibido' },
  { stage: 'label_created', label: 'Empacado', icon: Package, description: 'Guía emitida' },
  { stage: 'picked_up', label: 'Recolectado', icon: Truck, description: 'En poder de carrier' },
  { stage: 'in_transit', label: 'En Camino', icon: Clock, description: 'Tránsito a destino' },
  { stage: 'delivered', label: 'Entregado', icon: ShieldCheck, description: 'Recibido con éxito' },
];

const STAGE_ORDER_MAP: Record<string, number> = {
  confirmed: 0,
  label_created: 1,
  picked_up: 2,
  in_transit: 3,
  out_for_delivery: 3,
  delivered: 4,
  exception: 3,
  cancelled: 0,
};

export default function RastreoPage() {
  const router = useRouter();
  const { tracking, order_id, order: orderParam } = router.query;

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TrackingResponse | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);

  // Escucha cambios en parámetros de URL para búsqueda automática instantánea
  useEffect(() => {
    if (!router.isReady) return;
    const initialQuery = (tracking || order_id || orderParam || '') as string;
    if (initialQuery) {
      setSearchQuery(initialQuery);
      performTrackingSearch(initialQuery);
    }
  }, [router.isReady, tracking, order_id, orderParam]);

  const performTrackingSearch = async (query: string, forceLive: boolean = false) => {
    const clean = query.trim();
    if (!clean) {
      toast.error('Por favor escribe un número de guía o pedido');
      return;
    }

    if (forceLive) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const params: Record<string, string> = {};
      if (forceLive) params.force = 'true';

      // Detecta si es un order_id (ej. #16, 16) o un tracking_number
      const numericCandidate = clean.replace('#', '').trim();
      if (/^\d{1,6}$/.test(numericCandidate) && !clean.toUpperCase().startsWith('TRACK')) {
        params.order_id = numericCandidate;
      } else {
        params.tracking_number = clean;
      }

      const res = await api.get<TrackingResponse>('/shop/shipping/track/', { params });
      if (res.data && res.data.success) {
        setData(res.data);
        setError(null);
        if (forceLive) {
          toast.success('Información actualizada en vivo.');
        }
      } else {
        setError(res.data?.message || 'No se encontró información para el identificador proporcionado.');
        setData(null);
      }
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'No pudimos localizar este envío. Verifica que el número de guía o pedido sea correcto.';
      setError(errorMsg);
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    performTrackingSearch(searchQuery);
  };

  const handleCopy = (text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedTracking(true);
    toast.success('Número de guía copiado al portapapeles');
    setTimeout(() => setCopiedTracking(false), 2500);
  };

  const formatEventDate = (isoStr: string) => {
    try {
      const dt = new Date(isoStr);
      return new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(dt);
    } catch {
      return isoStr;
    }
  };

  const currentStepIndex = data ? (STAGE_ORDER_MAP[data.current_stage] ?? 1) : 0;

  return (
    <div className="min-h-screen bg-[#060807] text-white selection:bg-amber-500/30 py-8 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Rastreo de Pedidos y Envíos — Ms Ambar</title>
        <meta
          name="description"
          content="Sigue en vivo la ubicación y estado de entrega de tus compras y boletos de Ms Ambar."
        />
      </Head>

      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header Section */}
        <div className="text-center space-y-4 pt-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-semibold uppercase tracking-widest"
          >
            <Truck size={14} className="animate-pulse" /> Logística Oficial Ms Ambar
          </motion.div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Rastreo de Paquetes
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Consulta el avance de tu entrega en tiempo real ingresando tu número de guía de paquetería o número de pedido.
          </p>

          {/* Search Form */}
          <form onSubmit={handleSubmit} className="pt-4 max-w-2xl mx-auto">
            <div className="relative flex items-center bg-[#111613] border border-amber-500/30 hover:border-amber-500/60 focus-within:border-amber-400 rounded-2xl p-1.5 shadow-2xl transition-all duration-300">
              <div className="pl-4 text-gray-400">
                <Search size={20} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ej. #16 o número de guía (FedEx, Paquetexpress, DHL...)"
                className="w-full bg-transparent px-4 py-3 text-white placeholder-gray-500 text-sm sm:text-base focus:outline-none font-medium"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold text-sm transition-all duration-200 shadow-[0_0_20px_rgba(245,158,11,0.25)] flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Buscando...
                  </>
                ) : (
                  <>
                    Rastrear <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 pt-3 text-xs text-gray-500">
              <span>💡 Tip: Puedes ingresar tanto tu número de orden (ej.</span>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('16');
                  performTrackingSearch('16');
                }}
                className="text-amber-400 hover:underline font-mono"
              >
                #16
              </button>
              <span>) como el código de rastreo completo.</span>
            </div>
          </form>
        </div>

        {/* Error Notification */}
        <AnimatePresence>
          {error && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-950/40 border border-red-500/30 rounded-2xl p-6 text-center space-y-3 max-w-2xl mx-auto backdrop-blur-xl"
            >
              <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-lg font-bold text-white">No pudimos encontrar el paquete</h3>
              <p className="text-red-200/80 text-sm leading-relaxed">{error}</p>
              <div className="pt-2 flex justify-center gap-4 text-xs">
                <Link href="/contacto" className="text-amber-400 hover:underline">
                  ¿Necesitas ayuda con tu pedido? Contactar Soporte
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Tracking Result */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-8"
          >
            {/* Main Status & Stepper Card */}
            <div className="bg-gradient-to-b from-[#121815] to-[#0c100e] border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-8">
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Status Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      {data.status_label || 'En Proceso'}
                    </span>
                    {data.order_id && (
                      <span className="text-xs font-mono px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300">
                        Pedido #{data.order_id}
                      </span>
                    )}
                    {data.packaging_type && (
                      <span className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 flex items-center gap-1.5">
                        {data.packaging_type === 'bag' ? <Mail size={12} /> : <Box size={12} />}
                        {data.packaging_type === 'bag' ? 'Bolsa de Seguridad (5M)' : 'Caja de Envío (4G)'}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
                    {data.carrier || 'Paquetería Nacional'}
                  </h2>
                  {data.estimated_delivery && (
                    <p className="text-sm text-emerald-400 flex items-center gap-1.5 font-medium">
                      <Clock size={15} /> Entrega estimada: {data.estimated_delivery}
                    </p>
                  )}
                </div>

                {/* Tracking Number pill & Refresh */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {data.tracking_number ? (
                    <div className="bg-black/50 border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-400">Guía de Rastreo</div>
                        <div className="font-mono text-sm sm:text-base font-bold text-amber-400">
                          {data.tracking_number}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(data.tracking_number)}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all duration-150"
                        title="Copiar guía"
                      >
                        {copiedTracking ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 text-xs text-amber-300">
                      Guía en proceso de asignación con carrier
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => performTrackingSearch(searchQuery, true)}
                    disabled={refreshing}
                    className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all duration-150 flex items-center justify-center"
                    title="Actualizar estado en vivo"
                  >
                    <RefreshCw size={18} className={refreshing ? 'animate-spin text-amber-400' : ''} />
                  </button>
                </div>
              </div>

              {/* 5-Phase Interactive Visual Stepper */}
              <div className="py-4 space-y-6">
                <div className="relative">
                  {/* Background Progress Track */}
                  <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-1.5 bg-white/10 rounded-full z-0" />
                  {/* Glowing Active Progress Bar */}
                  <div
                    className="absolute top-1/2 left-4 -translate-y-1/2 h-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 rounded-full z-0 shadow-[0_0_12px_rgba(245,158,11,0.6)] transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, data.stage_percentage || 20))}%` }}
                  />

                  {/* Step Nodes */}
                  <div className="relative z-10 flex justify-between items-center">
                    {STEP_DEFINITIONS.map((step, idx) => {
                      const Icon = step.icon;
                      const isCompleted = idx < currentStepIndex || data.current_stage === 'delivered';
                      const isCurrent = idx === currentStepIndex && data.current_stage !== 'delivered';

                      return (
                        <div key={step.stage} className="flex flex-col items-center text-center max-w-[80px]">
                          <div
                            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                              isCompleted
                                ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                                : isCurrent
                                ? 'bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.6)] ring-4 ring-amber-500/30 animate-pulse'
                                : 'bg-[#18201b] border border-white/10 text-gray-500'
                            }`}
                          >
                            {isCompleted ? <Check size={20} className="stroke-[3]" /> : <Icon size={20} />}
                          </div>
                          <div className="pt-3">
                            <span
                              className={`text-xs font-bold block ${
                                isCompleted || isCurrent ? 'text-white' : 'text-gray-500'
                              }`}
                            >
                              {step.label}
                            </span>
                            <span className="text-[10px] text-gray-400 hidden sm:block leading-tight">
                              {step.description}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="pt-2 flex flex-wrap gap-4 items-center">
                {data.carrier_url && data.carrier_url !== '#' && (
                  <a
                    href={data.carrier_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs sm:text-sm shadow-[0_4px_15px_rgba(245,158,11,0.25)] transition-all duration-200"
                  >
                    <ExternalLink size={15} /> Ver en portal oficial ({data.carrier?.split(' ')[0] || 'Carrier'})
                  </a>
                )}

                {data.order_id && (
                  <a
                    href={`${getApiUrl()}/shop/orders/${data.order_id}/label/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-medium text-xs sm:text-sm transition-all duration-200"
                  >
                    <Download size={15} /> Descargar Guía de Envío (PDF)
                  </a>
                )}

                {data.is_pre_transit && (
                  <span className="text-xs text-amber-300/80 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 flex items-center gap-1.5">
                    <Clock size={14} /> Paquete embalado. Los movimientos de carretera se activan tras el escaneo de recolección física.
                  </span>
                )}
              </div>
            </div>

            {/* Vertical Timeline of Events */}
            <div className="bg-[#0f1411] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock size={20} className="text-amber-400" /> Historial de Movimientos del Paquete
                </h3>
                <span className="text-xs text-gray-400">
                  {data.events?.length || 0} {data.events?.length === 1 ? 'evento' : 'eventos'} registrados
                </span>
              </div>

              {(!data.events || data.events.length === 0) ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  Aún no hay movimientos registrados por la paquetería para este envío.
                </div>
              ) : (
                <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-2 sm:before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-white/10">
                  {data.events.map((ev, index) => {
                    const isLatest = index === data.events.length - 1;
                    return (
                      <div key={`${ev.timestamp}-${index}`} className="relative group">
                        {/* Milestone bullet point */}
                        <div
                          className={`absolute -left-6 sm:-left-8 top-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 transition-all duration-200 ${
                            isLatest
                              ? 'bg-amber-400 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.8)] scale-110'
                              : 'bg-[#18201b] border-gray-600'
                          }`}
                        />

                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono text-gray-400">
                              {formatEventDate(ev.timestamp)}
                            </span>
                            {ev.location && (
                              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10">
                                <MapPin size={10} className="text-amber-400" /> {ev.location}
                              </span>
                            )}
                            {isLatest && (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                Última Actualización
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-bold text-white">{ev.status}</h4>
                          <p className="text-sm text-gray-400 leading-relaxed">{ev.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* FAQ and Contact Footer */}
        <div className="border-t border-white/10 pt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <HelpCircle size={18} className="text-amber-400" /> ¿Cuánto tarda en actualizarse mi guía?
            </h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Las paqueterías (FedEx, Paquetexpress, DHL, etc.) suelen tardar entre 2 y 6 horas en reflejar el primer escaneo físico en sus terminales tras recolectar el paquete en nuestro almacén.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-400" /> Compra y Entrega Protegida
            </h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Todos los paquetes viajan con empaque de alta seguridad (Bolsa 5M o Caja 4G) y seguro de tránsito. Si tienes dudas, contáctanos por WhatsApp o correo oficial.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
