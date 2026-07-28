import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag,
  Plus,
  Search,
  Copy,
  Mail,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Lock,
  Gift,
  Percent,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { showAlert, showConfirm, showToast } from '../lib/notifications';

// ─── Interfaces de Tipado Estricto para el Modelo Coupon ───
export interface Coupon {
  id: number;
  code: string;
  discount_type: 'free_vip' | 'percentage' | 'fixed';
  discount_value: number | string;
  max_uses: number;
  times_used: number;
  is_active: boolean;
  event: number | null;
  event_title?: string | null;
  assigned_email?: string | null;
  expiration_date?: string | null;
  created_at?: string;
}

export interface EventOption {
  id: number;
  title: string;
  artist?: string;
  date?: string;
}

interface CouponManagerProps {
  coupons: Coupon[];
  events: EventOption[];
  apiUrl: string;
  onRefresh: () => void;
}

/**
 * Componente `CouponManager`
 * Permite a la administración de Ms Ambar crear, editar, activar/desactivar,
 * compartir por enlace directo y enviar cupones por correo a invitados VIP.
 */
export const CouponManager: React.FC<CouponManagerProps> = ({
  coupons = [],
  events = [],
  apiUrl,
  onRefresh
}) => {
  // ── States para Filtrado y Buscador ──
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'free_vip' | 'percentage' | 'fixed'>('all');

  // ── States para Modal de Creación / Edición ──
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  
  // Campos del formulario
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'free_vip' | 'percentage' | 'fixed'>('free_vip');
  const [discountValue, setDiscountValue] = useState('100');
  const [maxUses, setMaxUses] = useState('1');
  const [eventId, setEventId] = useState<string>('');
  const [assignedEmail, setAssignedEmail] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Estados de carga y error del formulario
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── States para Modal de Envío por Correo ──
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedCouponForEmail, setSelectedCouponForEmail] = useState<Coupon | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailNote, setEmailNote] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  // ── Feedback al copiar enlace ──
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Helper para headers con token de autenticación
  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return { Authorization: `Bearer ${token}` };
  };

  // Reset del formulario para nuevo cupón
  const openCreateModal = () => {
    setEditingCoupon(null);
    setCode('');
    setDiscountType('free_vip');
    setDiscountValue('100');
    setMaxUses('1');
    setEventId('');
    setAssignedEmail('');
    setExpirationDate('');
    setIsActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Carga de datos de un cupón existente para edición
  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCode(coupon.code);
    setDiscountType(coupon.discount_type);
    setDiscountValue(String(coupon.discount_value));
    setMaxUses(String(coupon.max_uses));
    setEventId(coupon.event ? String(coupon.event) : '');
    setAssignedEmail(coupon.assigned_email || '');
    
    // Formatear fecha para el input datetime-local (YYYY-MM-THH:mm)
    if (coupon.expiration_date) {
      const d = new Date(coupon.expiration_date);
      const iso = d.toISOString().slice(0, 16);
      setExpirationDate(iso);
    } else {
      setExpirationDate('');
    }

    setIsActive(coupon.is_active);
    setFormError(null);
    setIsModalOpen(true);
  };

  /**
   * Manejador de Guardado (POST para nuevo, PATCH para edición)
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setFormError('El código del cupón es obligatorio.');
      return;
    }

    setLoading(true);
    setFormError(null);

    const payload = {
      code: code.trim().toUpperCase(),
      discount_type: discountType,
      discount_value: discountType === 'free_vip' ? 100 : parseFloat(discountValue || '0'),
      max_uses: parseInt(maxUses || '1', 10),
      event: eventId ? parseInt(eventId, 10) : null,
      assigned_email: assignedEmail.trim() || null,
      expiration_date: expirationDate ? new Date(expirationDate).toISOString() : null,
      is_active: isActive
    };

    try {
      const headers = getAuthHeaders();
      if (editingCoupon) {
        await axios.patch(`${apiUrl}/tickets/coupons/${editingCoupon.id}/`, payload, { headers });
        showToast.success('Cupón actualizado correctamente.');
      } else {
        await axios.post(`${apiUrl}/tickets/coupons/`, payload, { headers });
        showToast.success('Cupón creado exitosamente.');
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      console.error('Error al guardar cupón:', err);
      const msg = err.response?.data?.code?.[0] || err.response?.data?.error || 'Error al procesar la solicitud.';
      setFormError(msg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Conmutar estado Activo / Inactivo en un clic
   */
  const handleToggleActive = async (coupon: Coupon) => {
    try {
      const headers = getAuthHeaders();
      await axios.patch(`${apiUrl}/tickets/coupons/${coupon.id}/`, { is_active: !coupon.is_active }, { headers });
      showToast.success(`Cupón ${coupon.code} ${!coupon.is_active ? 'activado' : 'desactivado'}.`);
      onRefresh();
    } catch (err) {
      showToast.error('Error al cambiar el estado del cupón.');
    }
  };

  /**
   * Eliminar cupón con confirmación
   */
  const handleDelete = async (coupon: Coupon) => {
    const isConfirmed = await showConfirm(
      `¿Deseas borrar el cupón "${coupon.code}"? Esta acción no se puede deshacer.`,
      'Eliminar Cupón'
    );
    if (!isConfirmed) return;

    try {
      const headers = getAuthHeaders();
      await axios.delete(`${apiUrl}/tickets/coupons/${coupon.id}/`, { headers });
      showToast.success('Cupón eliminado correctamente.');
      onRefresh();
    } catch (err) {
      showToast.error('No se pudo eliminar el cupón.');
    }
  };

  /**
   * Copia enlace de auto-aplicación al portapapeles
   * Formato: https://domain/comprar-boletos?coupon=CODIGO[&email=CORREO][&event=EVENT_ID]
   */
  const handleCopyShareLink = (coupon: Coupon) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    let link = `${origin}/comprar-boletos?coupon=${encodeURIComponent(coupon.code)}`;
    
    if (coupon.assigned_email) {
      link += `&email=${encodeURIComponent(coupon.assigned_email)}`;
    }
    if (coupon.event) {
      link += `&event=${coupon.event}`;
    }

    // Copiado seguro con Clipboard API o fallback execCommand
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(link).then(() => {
        setCopiedId(coupon.id);
        setTimeout(() => setCopiedId(null), 2500);
        showToast.success('¡Enlace de cupón copiado al portapapeles!');
      }).catch(() => fallbackCopy(link, coupon.id));
    } else {
      fallbackCopy(link, coupon.id);
    }
  };

  const fallbackCopy = (text: string, couponId: number) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopiedId(couponId);
      setTimeout(() => setCopiedId(null), 2500);
      showToast.success('¡Enlace copiado al portapapeles!');
    } catch (e) {
      showAlert(`Copia manualmente este enlace:\n\n${text}`, 'Enlace del Cupón', 'info');
    }
    document.body.removeChild(textArea);
  };

  /**
   * Abrir Modal de Envío por Correo Electrónico
   */
  const openEmailModal = (coupon: Coupon) => {
    setSelectedCouponForEmail(coupon);
    setEmailRecipient(coupon.assigned_email || '');
    setEmailNote('');
    setIsEmailModalOpen(true);
  };

  /**
   * Despachar correo electrónico con el cupón
   */
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCouponForEmail || !emailRecipient.trim()) {
      showToast.error('Ingresa una dirección de correo válida.');
      return;
    }

    setEmailSending(true);
    try {
      const headers = getAuthHeaders();
      const res = await axios.post(
        `${apiUrl}/tickets/coupons/${selectedCouponForEmail.id}/send_email/`,
        {
          email: emailRecipient.trim(),
          note: emailNote.trim()
        },
        { headers }
      );
      showAlert(
        res.data.message || `Cupón enviado exitosamente a ${emailRecipient}.`,
        '¡Correo Despachado!',
        'success'
      );
      setIsEmailModalOpen(false);
      onRefresh();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'No se pudo enviar el correo del cupón.';
      showAlert(msg, 'Error al Enviar', 'error');
    } finally {
      setEmailSending(false);
    }
  };

  // ── Cálculo de Estadísticas del Dashboard ──
  const totalCoupons = coupons.length;
  const activeCoupons = coupons.filter(c => c.is_active).length;
  const exclusiveCoupons = coupons.filter(c => Boolean(c.assigned_email)).length;
  const totalUses = coupons.reduce((sum, c) => sum + (c.times_used || 0), 0);

  // ── Filtrado dinámico de la lista ──
  const filteredCoupons = coupons.filter(c => {
    const matchesSearch =
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.assigned_email && c.assigned_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.event_title && c.event_title.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = typeFilter === 'all' || c.discount_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-8">
      {/* ── Tarjetas de Métricas Resumen ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/80 border border-amber-500/20 rounded-xl p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Total Cupones</p>
              <h4 className="text-2xl font-extrabold text-white mt-1">{totalCoupons}</h4>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
              <Tag className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-emerald-500/20 rounded-xl p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Cupones Activos</p>
              <h4 className="text-2xl font-extrabold text-emerald-400 mt-1">{activeCoupons}</h4>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-purple-500/20 rounded-xl p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Nominativos (Intransferibles)</p>
              <h4 className="text-2xl font-extrabold text-purple-400 mt-1">{exclusiveCoupons}</h4>
            </div>
            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-400">
              <Lock className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-blue-500/20 rounded-xl p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Redenciones Totales</p>
              <h4 className="text-2xl font-extrabold text-blue-400 mt-1">{totalUses}</h4>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
              <Gift className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Barra de Herramientas (Filtros, Búsqueda y Botón Crear) ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div className="flex flex-col sm:flex-row items-center gap-3 flex-1">
          {/* Buscador */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por código o email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Filtro por Tipo */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="w-full sm:w-56 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50"
          >
            <option value="all">Todos los tipos</option>
            <option value="free_vip">Entrada VIP Gratuita (100%)</option>
            <option value="percentage">Porcentaje (%)</option>
            <option value="fixed">Monto Fijo ($ MXN)</option>
          </select>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-amber-900/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Crear Nuevo Cupón
        </button>
      </div>

      {/* ── Tabla de Cupones ── */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-950/80 text-xs uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="py-4 px-4 font-bold">Código / Tipo</th>
                <th className="py-4 px-4 font-bold">Beneficio</th>
                <th className="py-4 px-4 font-bold">Asignación Intransferible</th>
                <th className="py-4 px-4 font-bold">Evento Aplicable</th>
                <th className="py-4 px-4 font-bold text-center">Usos / Límite</th>
                <th className="py-4 px-4 font-bold text-center">Estado</th>
                <th className="py-4 px-4 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredCoupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-500">
                    <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    No se encontraron cupones registrados.
                  </td>
                </tr>
              ) : (
                filteredCoupons.map(coupon => {
                  const isExpired = coupon.expiration_date && new Date(coupon.expiration_date) < new Date();
                  const isMaxedOut = coupon.times_used >= coupon.max_uses;

                  return (
                    <tr key={coupon.id} className="hover:bg-zinc-800/30 transition-colors">
                      {/* Código y Badge de Tipo */}
                      <td className="py-4 px-4 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-bold text-amber-400 tracking-wider">
                            {coupon.code}
                          </span>
                          {coupon.discount_type === 'free_vip' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              VIP 100%
                            </span>
                          )}
                          {coupon.discount_type === 'percentage' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              % DESC
                            </span>
                          )}
                          {coupon.discount_type === 'fixed' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              FIJO $
                            </span>
                          )}
                        </div>
                        {coupon.expiration_date && (
                          <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Expira: {new Date(coupon.expiration_date).toLocaleDateString()}
                          </p>
                        )}
                      </td>

                      {/* Monto / Porcentaje */}
                      <td className="py-4 px-4">
                        {coupon.discount_type === 'free_vip' ? (
                          <span className="text-amber-300 font-bold text-xs bg-amber-950/40 px-2 py-1 rounded border border-amber-800/40">
                            Entrada VIP Gratis
                          </span>
                        ) : coupon.discount_type === 'percentage' ? (
                          <span className="text-zinc-200 font-bold">
                            {coupon.discount_value}% Descuento
                          </span>
                        ) : (
                          <span className="text-zinc-200 font-bold">
                            ${Number(coupon.discount_value).toFixed(2)} MXN
                          </span>
                        )}
                      </td>

                      {/* Exclusividad por Correo (assigned_email) */}
                      <td className="py-4 px-4">
                        {coupon.assigned_email ? (
                          <div className="flex items-center gap-1.5 text-xs text-purple-300 bg-purple-950/40 px-2.5 py-1 rounded-md border border-purple-800/40 w-fit">
                            <Lock className="w-3.5 h-3.5 text-purple-400" />
                            <span className="truncate max-w-[160px]" title={coupon.assigned_email}>
                              {coupon.assigned_email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-500 italic">Público / Cualquiera</span>
                        )}
                      </td>

                      {/* Evento Específico */}
                      <td className="py-4 px-4 text-xs">
                        {coupon.event_title ? (
                          <span className="text-amber-200 font-medium">{coupon.event_title}</span>
                        ) : (
                          <span className="text-zinc-500 italic">Todos los eventos</span>
                        )}
                      </td>

                      {/* Usos sobre Límite */}
                      <td className="py-4 px-4 text-center font-mono text-xs">
                        <span className={isMaxedOut ? 'text-rose-400 font-bold' : 'text-zinc-300'}>
                          {coupon.times_used} / {coupon.max_uses}
                        </span>
                      </td>

                      {/* Estado Toggle */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(coupon)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                            coupon.is_active && !isExpired && !isMaxedOut
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                          }`}
                        >
                          {coupon.is_active && !isExpired && !isMaxedOut ? 'Activo' : isExpired ? 'Expirado' : isMaxedOut ? 'Agotado' : 'Inactivo'}
                        </button>
                      </td>

                      {/* Botones de Acción */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botón Copiar Link */}
                          <button
                            onClick={() => handleCopyShareLink(coupon)}
                            title="Copiar Enlace de Compartir"
                            className="p-1.5 bg-zinc-800 hover:bg-amber-600/30 text-zinc-300 hover:text-amber-400 rounded-lg transition-colors cursor-pointer border border-zinc-700 hover:border-amber-500/40"
                          >
                            {copiedId === coupon.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          </button>

                          {/* Botón Enviar Email */}
                          <button
                            onClick={() => openEmailModal(coupon)}
                            title="Enviar Cupón por Correo"
                            className="p-1.5 bg-zinc-800 hover:bg-purple-600/30 text-zinc-300 hover:text-purple-400 rounded-lg transition-colors cursor-pointer border border-zinc-700 hover:border-purple-500/40"
                          >
                            <Mail className="w-4 h-4" />
                          </button>

                          {/* Botón Editar */}
                          <button
                            onClick={() => openEditModal(coupon)}
                            title="Editar Cupón"
                            className="p-1.5 bg-zinc-800 hover:bg-blue-600/30 text-zinc-300 hover:text-blue-400 rounded-lg transition-colors cursor-pointer border border-zinc-700 hover:border-blue-500/40"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Botón Eliminar */}
                          <button
                            onClick={() => handleDelete(coupon)}
                            title="Eliminar Cupón"
                            className="p-1.5 bg-zinc-800 hover:bg-rose-600/30 text-zinc-300 hover:text-rose-400 rounded-lg transition-colors cursor-pointer border border-zinc-700 hover:border-rose-500/40"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* ── MODAL: Creación y Edición de Cupones ── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-6 text-zinc-200"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  {editingCoupon ? 'Editar Cupón' : 'Crear Nuevo Cupón'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Código */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Código del Cupón *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. VIP-AMBAR-2026"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-amber-300 font-mono font-bold tracking-wider uppercase focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Tipo de Descuento */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setDiscountType('free_vip'); setDiscountValue('100'); }}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      discountType === 'free_vip'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <Gift className="w-5 h-5" />
                    <span>Entrada VIP Gratis</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiscountType('percentage')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      discountType === 'percentage'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <Percent className="w-5 h-5" />
                    <span>Porcentaje (%)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiscountType('fixed')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      discountType === 'fixed'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <DollarSign className="w-5 h-5" />
                    <span>Monto Fijo ($ MXN)</span>
                  </button>
                </div>

                {/* Valor del Descuento (Solo visible si NO es free_vip) */}
                {discountType !== 'free_vip' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      {discountType === 'percentage' ? 'Porcentaje de Descuento (%)' : 'Monto de Descuento ($ MXN)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={discountType === 'percentage' ? '100' : '99999'}
                      value={discountValue}
                      onChange={e => setDiscountValue(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {/* Correo Asignado Exclusivo (Security Feature) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1 flex items-center justify-between">
                    <span>Correo de Invitado (Opcional - Intransferible)</span>
                    <Lock className="w-3.5 h-3.5 text-purple-400" />
                  </label>
                  <input
                    type="email"
                    placeholder="ejemplo@invitado.com (Vacío = Público)"
                    value={assignedEmail}
                    onChange={e => setAssignedEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-purple-900/50 rounded-lg px-3 py-2 text-sm text-purple-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    🛡️ Si especificas un correo, solo esa persona podrá validar y canjear el cupón en el checkout.
                  </p>
                </div>

                {/* Límite de Usos y Evento */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Límite de Redenciones
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxUses}
                      onChange={e => setMaxUses(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Evento Específico
                    </label>
                    <select
                      value={eventId}
                      onChange={e => setEventId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="">Todos los eventos</option>
                      {events.map(ev => (
                        <option key={ev.id} value={ev.id}>
                          {ev.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Expiración y Estado */}
                <div className="grid grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Fecha de Expiración (Opcional)
                    </label>
                    <input
                      type="datetime-local"
                      value={expirationDate}
                      onChange={e => setExpirationDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-5">
                    <input
                      type="checkbox"
                      id="isActiveToggle"
                      checked={isActive}
                      onChange={e => setIsActive(e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                    <label htmlFor="isActiveToggle" className="text-xs font-bold text-zinc-300 cursor-pointer">
                      Cupón Activo
                    </label>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-amber-900/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Guardando...' : editingCoupon ? 'Actualizar Cupón' : 'Crear Cupón'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Envío por Correo Electrónico ── */}
      <AnimatePresence>
        {isEmailModalOpen && selectedCouponForEmail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-purple-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5 text-zinc-200"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="text-lg font-bold text-purple-400 flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Enviar Cupón por Correo
                </h3>
                <button onClick={() => setIsEmailModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-purple-950/30 border border-purple-800/40 rounded-xl p-3 text-xs space-y-1">
                <p className="font-bold text-purple-300">
                  Cupón: <span className="font-mono text-amber-400">{selectedCouponForEmail.code}</span>
                </p>
                <p className="text-zinc-400">
                  Beneficio:{' '}
                  {selectedCouponForEmail.discount_type === 'free_vip'
                    ? 'Entrada VIP Gratuita (100%)'
                    : `${selectedCouponForEmail.discount_value}% Descuento`}
                </p>
              </div>

              <form onSubmit={handleSendEmail} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Correo del Destinatario *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="invitado@ejemplo.com"
                    value={emailRecipient}
                    onChange={e => setEmailRecipient(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    * Al enviar, si el cupón no está asignado, se bloqueará exclusivamente a este correo.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Nota Personalizada (Opcional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ej. ¡Hola Carlos! Te invitamos formalmente a nuestro concierto VIP de Ms Ambar..."
                    value={emailNote}
                    onChange={e => setEmailNote(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsEmailModalOpen(false)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={emailSending}
                    className="px-5 py-2 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white text-xs font-bold rounded-lg shadow-lg shadow-purple-900/30 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {emailSending ? 'Despachando...' : 'Despachar Correo'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CouponManager;
