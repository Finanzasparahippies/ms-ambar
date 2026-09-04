import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Download, 
  ShieldAlert, 
  Settings2, 
  DollarSign, 
  Activity, 
  FileText,
  HelpCircle,
  Radio,
  Sliders
} from 'lucide-react';
import api from '../../lib/api';
import { showToast } from '../../lib/notifications';
import { Order, ShopShippingConfig, ShippingEvent } from '../../types';

interface ShippingConfigResponse {
  config: ShopShippingConfig;
  environment: string;
  is_configured: boolean;
  credits?: {
    balance?: number;
    amount?: number;
    currency?: string;
  } | null;
  auto_advance_sandbox_allowed: boolean;
}

interface ShippingManagerProps {
  orders: Order[];
  onRefreshOrders?: () => void;
}

export const ShippingManager: React.FC<ShippingManagerProps> = ({ orders, onRefreshOrders }) => {
  const [configData, setConfigData] = useState<ShippingConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcilingOrderId, setReconcilingOrderId] = useState<number | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'config' | 'events'>('orders');
  const [shippingEvents, setShippingEvents] = useState<ShippingEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [selectedEventOrder, setSelectedEventOrder] = useState<number | null>(null);

  // Form State
  const [methodMode, setMethodMode] = useState<'quotation' | 'direct_rate'>('quotation');
  const [defaultCarrier, setDefaultCarrier] = useState('fedex');
  const [defaultService, setDefaultService] = useState('standard');
  const [allowCustomerSelection, setAllowCustomerSelection] = useState(true);
  const [autoAdvanceSandbox, setAutoAdvanceSandbox] = useState(false);
  const [minBalanceAlert, setMinBalanceAlert] = useState(500);

  const fetchShippingConfig = async () => {
    try {
      setLoading(true);
      const res = await api.get('/shop/shipping/config/');
      setConfigData(res.data);
      if (res.data?.config) {
        const c = res.data.config;
        setMethodMode(c.method_mode || 'quotation');
        setDefaultCarrier(c.default_carrier || 'fedex');
        setDefaultService(c.default_service || 'standard');
        setAllowCustomerSelection(Boolean(c.allow_customer_carrier_selection));
        setAutoAdvanceSandbox(Boolean(c.auto_advance_sandbox));
        setMinBalanceAlert(c.min_balance_alert || 500);
      }
    } catch (err: any) {
      console.error('Error cargando configuración logística:', err);
      showToast.error('No se pudo cargar la configuración de Skydropx.');
    } finally {
      setLoading(false);
    }
  };

  const fetchShippingEvents = async (orderId?: number) => {
    try {
      setEventsLoading(true);
      const url = orderId ? `/shop/shipping/events/?order_id=${orderId}` : '/shop/shipping/events/';
      const res = await api.get(url);
      setShippingEvents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error cargando auditoría de envíos:', err);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    fetchShippingConfig();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/shop/shipping/config/', {
        method_mode: methodMode,
        default_carrier: defaultCarrier,
        default_service: defaultService,
        allow_customer_carrier_selection: allowCustomerSelection,
        auto_advance_sandbox: autoAdvanceSandbox,
        min_balance_alert: minBalanceAlert,
      });
      showToast.success('Configuración logística actualizada correctamente.');
      fetchShippingConfig();
    } catch (err: any) {
      console.error('Error guardando configuración:', err);
      showToast.error('Error al guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  const handleReconcileAll = async () => {
    setReconciling(true);
    try {
      const res = await api.post('/shop/shipping/reconcile/');
      showToast.success(`Reconciliación completa: ${res.data?.reconciled_count || 0} pedidos revisados.`);
      if (onRefreshOrders) onRefreshOrders();
    } catch (err) {
      console.error('Error reconciliando envíos:', err);
      showToast.error('Error al ejecutar la reconciliación con Skydropx.');
    } finally {
      setReconciling(false);
    }
  };

  const handleReconcileSingle = async (orderId: number) => {
    setReconcilingOrderId(orderId);
    try {
      const res = await api.post('/shop/shipping/reconcile/', { order_id: orderId });
      if (res.data?.reconciled) {
        showToast.success(`Pedido #${orderId} reconciliado exitosamente.`);
      } else {
        showToast.error(`Pedido #${orderId}: ${res.data?.error || res.data?.message || 'Sin cambios'}`);
      }
      if (onRefreshOrders) onRefreshOrders();
    } catch (err) {
      console.error(`Error reconciliando pedido #${orderId}:`, err);
      showToast.error(`Error al reconciliar Pedido #${orderId}`);
    } finally {
      setReconcilingOrderId(null);
    }
  };

  const balance = configData?.credits?.balance ?? configData?.credits?.amount ?? null;
  const isBalanceCritical = balance !== null && balance < minBalanceAlert;

  const getStatusBadge = (status?: string, order?: Order) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 size={12} /> Guía Oficial Lista
          </span>
        );
      case 'label_pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-pulse">
            <Clock size={12} /> Generando Etiqueta
          </span>
        );
      case 'processing':
      case 'requested':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <RefreshCw size={12} className="animate-spin" /> En Proceso Skydropx
          </span>
        );
      case 'reconciliation_required':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/10 border border-red-500/30 text-red-400">
            <ShieldAlert size={12} /> Requiere Reconciliación
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <AlertTriangle size={12} /> Emisión Fallida
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/5 border border-white/10 text-white/50">
            Pendiente
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner: Environment, Status & Balance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Wallet Balance Card */}
        <div className={`p-6 rounded-3xl border transition-all ${
          isBalanceCritical 
            ? 'bg-red-950/20 border-red-500/40 shadow-lg shadow-red-950/30' 
            : 'bg-[#141C16] border-[#2B392F]'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-widest text-[#F4F6F0]/60 font-bold flex items-center gap-1.5">
              <DollarSign size={14} className="text-amber-honey" /> Saldo en Cartera Skydropx
            </span>
            {isBalanceCritical && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-500 text-white animate-pulse">
                Crítico
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">
              {balance !== null ? `$${balance.toFixed(2)}` : 'N/A'}
            </span>
            <span className="text-xs font-bold text-[#F4F6F0]/40 uppercase font-mono">MXN</span>
          </div>
          <p className="text-[11px] text-[#F4F6F0]/50 mt-2">
            {isBalanceCritical 
              ? `Por debajo del umbral mínimo de seguridad ($${minBalanceAlert} MXN). Recarga saldo para evitar interrupciones.`
              : `Umbral de alerta configurado en $${minBalanceAlert} MXN.`}
          </p>
        </div>

        {/* Operating Method Mode Card */}
        <div className="p-6 rounded-3xl border bg-[#141C16] border-[#2B392F]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-widest text-[#F4F6F0]/60 font-bold flex items-center gap-1.5">
              <Sliders size={14} className="text-amber-honey" /> Modo de Operación Activo
            </span>
          </div>
          <div className="text-xl font-black text-white uppercase tracking-tight mt-1 flex items-center gap-2">
            {methodMode === 'quotation' ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-honey animate-pulse" />
                Opción A: Cotización Multi-Tarifa
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                Opción B: Emisión Directa
              </>
            )}
          </div>
          <p className="text-[11px] text-[#F4F6F0]/50 mt-2">
            {methodMode === 'quotation' 
              ? 'Cotiza en tiempo real contra múltiples paqueterías (FedEx, Estafeta, DHL) y permite elegir.'
              : `Emite directamente con el transportista por defecto (${defaultCarrier.toUpperCase()} - ${defaultService}).`}
          </p>
        </div>

        {/* Gateway & Environment Card */}
        <div className="p-6 rounded-3xl border bg-[#141C16] border-[#2B392F]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-widest text-[#F4F6F0]/60 font-bold flex items-center gap-1.5">
              <Activity size={14} className="text-amber-honey" /> Entorno & Conectividad
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
              configData?.is_configured ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
            }`}>
              {configData?.is_configured ? 'Conectado' : 'Mock Mode'}
            </span>
          </div>
          <div className="text-xl font-black text-white font-mono uppercase">
            {configData?.environment || 'SANDBOX'}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 text-[11px]">
            <span className="text-[#F4F6F0]/50">Auto-Advance Sandbox:</span>
            <span className={`font-mono font-bold ${autoAdvanceSandbox ? 'text-emerald-400' : 'text-[#F4F6F0]/40'}`}>
              {autoAdvanceSandbox ? 'ACTIVADO' : 'DESACTIVADO'}
            </span>
          </div>
        </div>
      </div>

      {/* Sub Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#141C16] p-4 rounded-2xl border border-[#2B392F]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('orders')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeSubTab === 'orders'
                ? 'bg-amber-honey text-[#1E2B22] shadow-md'
                : 'text-[#F4F6F0]/60 hover:text-white'
            }`}
          >
            📦 Pedidos & Guías ({orders.length})
          </button>
          <button
            onClick={() => setActiveSubTab('config')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeSubTab === 'config'
                ? 'bg-amber-honey text-[#1E2B22] shadow-md'
                : 'text-[#F4F6F0]/60 hover:text-white'
            }`}
          >
            ⚙️ Configuración Logística
          </button>
          <button
            onClick={() => {
              setActiveSubTab('events');
              fetchShippingEvents();
            }}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeSubTab === 'events'
                ? 'bg-amber-honey text-[#1E2B22] shadow-md'
                : 'text-[#F4F6F0]/60 hover:text-white'
            }`}
          >
            🛡️ Auditoría Inmutable (ShippingEvent)
          </button>
        </div>

        {/* Global Action: Reconcile */}
        <button
          type="button"
          onClick={handleReconcileAll}
          disabled={reconciling}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-honey to-amber-gold hover:from-amber-gold hover:to-amber-500 text-[#1E2B22] font-black uppercase tracking-wider text-xs px-5 py-2.5 rounded-xl transition-all disabled:opacity-50 shadow-md"
        >
          <RefreshCw size={14} className={reconciling ? 'animate-spin' : ''} />
          {reconciling ? 'Reconciliando con Skydropx...' : 'Reconciliar Todo'}
        </button>
      </div>

      {/* SUBTAB 1: ORDERS SHIPPING TABLE */}
      {activeSubTab === 'orders' && (
        <div className="bg-[#141C16] rounded-3xl border border-[#2B392F] overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                Control de Envíos y Guías por Pedido
              </h3>
              <p className="text-xs text-[#F4F6F0]/50 mt-0.5">
                Seguimiento de estados asíncronos, números de guía oficiales y descarga de comprobantes PDF.
              </p>
            </div>
            {onRefreshOrders && (
              <button
                onClick={onRefreshOrders}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                title="Refrescar lista"
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0C120E] text-[#F4F6F0]/50 uppercase tracking-wider font-mono text-[10px] border-b border-white/5">
                <tr>
                  <th className="p-4">Pedido</th>
                  <th className="p-4">Destinatario</th>
                  <th className="p-4">Transportista / Método</th>
                  <th className="p-4">Estado Logístico</th>
                  <th className="p-4">Tracking Number</th>
                  <th className="p-4">Guía PDF</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#F4F6F0]/40 uppercase tracking-wider italic">
                      No hay pedidos registrados en la tienda.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const isOrderReconciling = reconcilingOrderId === order.id;
                    return (
                      <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 font-mono font-bold text-white">
                          #{order.id}
                          <span className="block text-[10px] text-[#F4F6F0]/40 font-normal">
                            {new Date(order.created_at).toLocaleDateString('es-MX')}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-white block">{order.full_name}</span>
                          <span className="text-[11px] text-[#F4F6F0]/50 block">
                            {order.city} ({order.postal_code || 'S/CP'})
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="font-medium text-[#F4F6F0]/90 block">
                            {order.shipping_provider || 'Estándar Nacional'}
                          </span>
                          {order.shipping_cost !== undefined && (
                            <span className="text-[10px] text-amber-honey font-mono font-bold">
                              ${Number(order.shipping_cost).toFixed(2)} MXN
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {getStatusBadge(order.shipping_status, order)}
                          {order.shipping_error && (
                            <span 
                              className="block text-[10px] text-red-400/80 mt-1 max-w-xs truncate"
                              title={order.shipping_error}
                            >
                              {order.shipping_error}
                            </span>
                          )}
                        </td>
                        <td className="p-4 font-mono">
                          {order.tracking_number ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-white font-bold">{order.tracking_number}</span>
                              {order.tracking_url && (
                                <a
                                  href={order.tracking_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-amber-honey hover:text-white transition-colors"
                                  title="Rastrear paquete"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#F4F6F0]/30 italic">Sin asignar</span>
                          )}
                        </td>
                        <td className="p-4">
                          {order.shipping_label_pdf ? (
                            <a
                              href={order.shipping_label_pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-[11px] transition-colors"
                            >
                              <Download size={12} className="text-amber-honey" /> PDF
                            </a>
                          ) : (
                            <span className="text-[#F4F6F0]/30 italic">No disponible</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedEventOrder(order.id);
                                setActiveSubTab('events');
                                fetchShippingEvents(order.id);
                              }}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#F4F6F0]/70 hover:text-white transition-colors"
                              title="Ver eventos de auditoría"
                            >
                              <FileText size={13} />
                            </button>
                            <button
                              onClick={() => handleReconcileSingle(order.id)}
                              disabled={isOrderReconciling}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-honey/10 hover:bg-amber-honey/20 text-amber-honey border border-amber-honey/25 font-black text-[10px] uppercase tracking-wider transition-colors disabled:opacity-50"
                              title="Reconciliar con Skydropx"
                            >
                              <RefreshCw size={10} className={isOrderReconciling ? 'animate-spin' : ''} />
                              {isOrderReconciling ? '...' : 'Reconciliar'}
                            </button>
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
      )}

      {/* SUBTAB 2: LOGISTICS CONFIGURATION */}
      {activeSubTab === 'config' && (
        <form onSubmit={handleSaveConfig} className="bg-[#141C16] p-8 rounded-3xl border border-[#2B392F] space-y-8">
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
              <Settings2 size={18} className="text-amber-honey" /> Parámetros Globales de Logística
            </h3>
            <p className="text-xs text-[#F4F6F0]/60 mt-1">
              Controla el flujo de cotización, paquetería predeterminada y alertas de saldo crítico.
            </p>
          </div>

          {/* Selector de Método (Opción A vs Opción B) */}
          <div className="space-y-4">
            <label className="text-xs font-black text-white uppercase tracking-wider block">
              Modo de Operación de Envíos
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                onClick={() => setMethodMode('quotation')}
                className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                  methodMode === 'quotation'
                    ? 'bg-amber-honey/10 border-amber-honey/50 ring-1 ring-amber-honey/30'
                    : 'bg-[#0C120E] border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <Radio size={14} className={methodMode === 'quotation' ? 'text-amber-honey' : 'text-white/40'} />
                    Opción A: Cotización Multi-Tarifa
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-amber-honey font-bold">
                    POST /quotations
                  </span>
                </div>
                <p className="text-xs text-[#F4F6F0]/60 leading-relaxed">
                  Calcula tarifas en vivo contra transportistas en tiempo real y permite al comprador seleccionar su paquetería preferida durante el checkout.
                </p>
              </div>

              <div 
                onClick={() => setMethodMode('direct_rate')}
                className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                  methodMode === 'direct_rate'
                    ? 'bg-amber-honey/10 border-amber-honey/50 ring-1 ring-amber-honey/30'
                    : 'bg-[#0C120E] border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <Radio size={14} className={methodMode === 'direct_rate' ? 'text-amber-honey' : 'text-white/40'} />
                    Opción B: Emisión Directa
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-emerald-400 font-bold">
                    POST /rate/shipments
                  </span>
                </div>
                <p className="text-xs text-[#F4F6F0]/60 leading-relaxed">
                  Emite la guía directamente con la paquetería y servicio predeterminado configurado abajo, omitiendo la cotización previa del cliente.
                </p>
              </div>
            </div>
          </div>

          {/* Opciones Específicas para Opción B */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
            <div>
              <label className="text-xs font-black text-white uppercase tracking-wider block mb-2">
                Transportista Predeterminado (Opción B)
              </label>
              <select
                value={defaultCarrier}
                onChange={(e) => setDefaultCarrier(e.target.value)}
                className="w-full bg-[#0C120E] border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-amber-honey outline-none font-bold"
              >
                <option value="fedex">FedEx</option>
                <option value="dhl">DHL Express</option>
                <option value="estafeta">Estafeta</option>
                <option value="paquetexpress">Paquetexpress</option>
                <option value="redpack">Redpack</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-black text-white uppercase tracking-wider block mb-2">
                Servicio Predeterminado
              </label>
              <input
                type="text"
                value={defaultService}
                onChange={(e) => setDefaultService(e.target.value)}
                placeholder="standard / express / dia_siguiente"
                className="w-full bg-[#0C120E] border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-amber-honey outline-none font-mono"
              />
            </div>
          </div>

          {/* Toggles & Umbrales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowCustomerSelection}
                  onChange={(e) => setAllowCustomerSelection(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-honey focus:ring-amber-honey bg-[#0C120E] border-white/20"
                />
                <span className="text-xs font-bold text-white">
                  Permitir al cliente seleccionar transportista en Checkout
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAdvanceSandbox}
                  disabled={!configData?.auto_advance_sandbox_allowed}
                  onChange={(e) => setAutoAdvanceSandbox(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-honey focus:ring-amber-honey bg-[#0C120E] border-white/20 disabled:opacity-30"
                />
                <span className="text-xs font-bold text-white">
                  Auto-Advance en Sandbox (Avanzar estados automáticamente en pruebas)
                </span>
              </label>
              {!configData?.auto_advance_sandbox_allowed && (
                <p className="text-[10px] text-amber-honey/70 ml-7">
                  Deshabilitado por seguridad: El auto-advance nunca se permite en Producción.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-black text-white uppercase tracking-wider block mb-2">
                Umbral Mínimo de Saldo para Alerta (MXN)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-xs font-mono text-[#F4F6F0]/40">$</span>
                <input
                  type="number"
                  step="50"
                  value={minBalanceAlert}
                  onChange={(e) => setMinBalanceAlert(Number(e.target.value))}
                  className="w-full bg-[#0C120E] border border-white/10 rounded-xl pl-8 pr-4 py-3 text-xs text-white focus:border-amber-honey outline-none font-mono font-bold"
                />
              </div>
              <p className="text-[11px] text-[#F4F6F0]/40 mt-1">
                Se enviará una alerta crítica en logs y panel si el saldo es inferior a este monto.
              </p>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-honey to-amber-gold hover:from-amber-gold hover:to-amber-500 text-[#1E2B22] font-black uppercase tracking-wider text-xs px-6 py-3 rounded-xl transition-all disabled:opacity-50 shadow-md"
            >
              {saving ? 'Guardando...' : 'Guardar Configuración Logística'}
            </button>
          </div>
        </form>
      )}

      {/* SUBTAB 3: IMMUTABLE AUDIT EVENTS LOG */}
      {activeSubTab === 'events' && (
        <div className="bg-[#141C16] rounded-3xl border border-[#2B392F] overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                <ShieldAlert size={16} className="text-amber-honey" /> Registro de Auditoría Inmutable (ShippingEvent)
              </h3>
              <p className="text-xs text-[#F4F6F0]/50 mt-0.5">
                {selectedEventOrder 
                  ? `Mostrando eventos del Pedido #${selectedEventOrder}` 
                  : 'Últimos 50 eventos registrados de llamadas hacia la API de Skydropx.'}
              </p>
            </div>
            {selectedEventOrder && (
              <button
                onClick={() => {
                  setSelectedEventOrder(null);
                  fetchShippingEvents();
                }}
                className="text-xs text-amber-honey hover:underline"
              >
                Ver todos los pedidos
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0C120E] text-[#F4F6F0]/50 uppercase tracking-wider text-[10px] border-b border-white/5">
                <tr>
                  <th className="p-4">Fecha/Hora</th>
                  <th className="p-4">Pedido</th>
                  <th className="p-4">Evento / Endpoint</th>
                  <th className="p-4">Status HTTP</th>
                  <th className="p-4">Saldo Antes / Después</th>
                  <th className="p-4">Correlation ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[11px]">
                {eventsLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#F4F6F0]/40">
                      Cargando eventos...
                    </td>
                  </tr>
                ) : shippingEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#F4F6F0]/40 italic">
                      No hay eventos de auditoría registrados aún.
                    </td>
                  </tr>
                ) : (
                  shippingEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 text-[#F4F6F0]/70">
                        {new Date(ev.created_at).toLocaleString('es-MX')}
                      </td>
                      <td className="p-4 font-bold text-white">
                        {ev.order ? `#${ev.order}` : 'N/A'}
                      </td>
                      <td className="p-4">
                        <span className="text-amber-honey font-bold uppercase">{ev.event_type}</span>
                        <span className="block text-[10px] text-[#F4F6F0]/40">{ev.endpoint}</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ev.status_code >= 200 && ev.status_code < 300
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {ev.status_code}
                        </span>
                      </td>
                      <td className="p-4">
                        {ev.balance_before !== null || ev.balance_after !== null ? (
                          <span>
                            ${ev.balance_before?.toFixed(2) ?? '-'} → ${ev.balance_after?.toFixed(2) ?? '-'}
                          </span>
                        ) : (
                          <span className="text-[#F4F6F0]/30">-</span>
                        )}
                      </td>
                      <td className="p-4 text-[10px] text-[#F4F6F0]/50 max-w-xs truncate" title={ev.correlation_id}>
                        {ev.correlation_id || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
export default ShippingManager;
