import React, { useState, useMemo } from 'react';
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
  Layers,
  Sparkles,
  ChevronUp,
  ChevronDown,
  ShieldCheck,
  ImageIcon,
} from 'lucide-react';
import { showAlert, showConfirm, showToast } from '../lib/notifications';
import { CloudinaryMediaPicker } from './ui/CloudinaryMediaPicker';

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
  allowed_emails?: string[];
  requires_seat?: boolean;
  is_complimentary?: boolean;
  complimentary_allocation_mode?: 'OPEN' | 'DESIGNATED_ROW';
  complimentary_rows_priority?: string[];
  expiration_date?: string | null;
  created_at?: string;
}

export interface EventOption {
  id: number;
  title: string;
  artist?: string;
  date?: string;
  theater?: number | any;
  theater_name?: string;
  flyer?: string;
  image?: string;
  complimentary_rows_priority?: string[];
}

export interface TheaterOption {
  id: number;
  name: string;
  location?: string;
  layout?: any;
  seats?: any[];
  complimentary_rows_priority?: string[];
}

interface CouponManagerProps {
  coupons: Coupon[];
  events: EventOption[];
  theaters?: TheaterOption[];
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
  theaters = [],
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
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [emailInputText, setEmailInputText] = useState('');
  const [isComplimentary, setIsComplimentary] = useState(false);
  const [requiresSeat, setRequiresSeat] = useState(true);
  const [allocationMode, setAllocationMode] = useState<'OPEN' | 'DESIGNATED_ROW'>('OPEN');
  const [complimentaryRows, setComplimentaryRows] = useState<string[]>([]);
  const [rowInputText, setRowInputText] = useState('');
  const [syncRowsToEvent, setSyncRowsToEvent] = useState(false);
  const [expirationDate, setExpirationDate] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Estados de carga y error del formulario
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── States para Modal de Envío por Correo ──
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedCouponForEmail, setSelectedCouponForEmail] = useState<Coupon | null>(null);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [emailRecipientInput, setEmailRecipientInput] = useState('');
  const [emailRecipientName, setEmailRecipientName] = useState('');
  const [emailNote, setEmailNote] = useState('');
  const [emailImageUrl, setEmailImageUrl] = useState<string | null>(null);
  const [emailImageFile, setEmailImageFile] = useState<File | null>(null);
  const [emailImagePreview, setEmailImagePreview] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);

  // ── Feedback al copiar enlace ──
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Helper para headers con token de autenticación
  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return { Authorization: `Bearer ${token}` };
  };

  // ── Helpers para Múltiples Correos Autorizados ──
  const handleAddAllowedEmail = (raw?: string) => {
    const textToProcess = raw !== undefined ? raw : emailInputText;
    if (!textToProcess.trim()) return;

    // Acepta múltiples correos separados por comas, puntos y comas o saltos de línea
    const splitEmails = textToProcess
      .split(/[\s,;]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0 && e.includes('@'));

    if (splitEmails.length === 0) {
      showToast.error('Ingresa una dirección de correo válida (ej. usuario@dominio.com).');
      return;
    }

    setAllowedEmails(prev => {
      const set = new Set(prev);
      splitEmails.forEach(e => set.add(e));
      return Array.from(set);
    });
    setEmailInputText('');
  };

  const handleRemoveAllowedEmail = (emailToRemove: string) => {
    setAllowedEmails(prev => prev.filter(e => e !== emailToRemove));
  };

  // ── Helpers para Selector de Filas Designadas ──
  const handleAddRow = (raw?: string) => {
    const row = (raw !== undefined ? raw : rowInputText).trim();
    if (!row) return;

    const formattedRow = row.toLowerCase().startsWith('fila ') || row.toLowerCase().startsWith('mesa ')
      ? row
      : `Fila ${row.toUpperCase()}`;

    setComplimentaryRows(prev => {
      if (prev.includes(formattedRow)) return prev;
      return [...prev, formattedRow];
    });
    setRowInputText('');
  };

  const handleRemoveRow = (rowToRemove: string) => {
    setComplimentaryRows(prev => prev.filter(r => r !== rowToRemove));
  };

  const handleMoveRow = (index: number, direction: 'up' | 'down') => {
    setComplimentaryRows(prev => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  // ── Detección de Filas Disponibles en Teatros y Eventos ──
  const availableTheaterRows = useMemo(() => {
    const rowsSet = new Set<string>();

    if (eventId) {
      const selectedEvent = events.find(ev => String(ev.id) === eventId);
      if (selectedEvent) {
        if (selectedEvent.complimentary_rows_priority && Array.isArray(selectedEvent.complimentary_rows_priority)) {
          selectedEvent.complimentary_rows_priority.forEach(r => rowsSet.add(r));
        }

        const theaterId = typeof selectedEvent.theater === 'object' && selectedEvent.theater
          ? selectedEvent.theater.id
          : selectedEvent.theater;

        const theater = theaters?.find(t => String(t.id) === String(theaterId));
        if (theater) {
          if (theater.complimentary_rows_priority && Array.isArray(theater.complimentary_rows_priority)) {
            theater.complimentary_rows_priority.forEach(r => rowsSet.add(r));
          }
          if (theater.seats && Array.isArray(theater.seats)) {
            theater.seats.forEach((s: any) => {
              if (s.row) rowsSet.add(s.row.startsWith('Fila ') ? s.row : `Fila ${s.row}`);
            });
          }
          if (theater.layout?.seats && Array.isArray(theater.layout.seats)) {
            theater.layout.seats.forEach((s: any) => {
              if (s.row) rowsSet.add(s.row.startsWith('Fila ') ? s.row : `Fila ${s.row}`);
            });
          }
        }
      }
    }

    if (theaters && theaters.length > 0) {
      theaters.forEach(t => {
        if (t.seats && Array.isArray(t.seats)) {
          t.seats.forEach((s: any) => {
            if (s.row) rowsSet.add(s.row.startsWith('Fila ') ? s.row : `Fila ${s.row}`);
          });
        }
        if (t.layout?.seats && Array.isArray(t.layout.seats)) {
          t.layout.seats.forEach((s: any) => {
            if (s.row) rowsSet.add(s.row.startsWith('Fila ') ? s.row : `Fila ${s.row}`);
          });
        }
      });
    }

    if (rowsSet.size === 0) {
      ['Fila A', 'Fila B', 'Fila C', 'Fila D', 'Fila E', 'Fila F', 'Fila G', 'Fila H'].forEach(r => rowsSet.add(r));
    }

    return Array.from(rowsSet).sort();
  }, [eventId, events, theaters]);

  // Reset del formulario para nuevo cupón
  const openCreateModal = () => {
    setEditingCoupon(null);
    setCode('');
    setDiscountType('free_vip');
    setDiscountValue('100');
    setMaxUses('1');
    setEventId('');
    setAssignedEmail('');
    setAllowedEmails([]);
    setEmailInputText('');
    setIsComplimentary(true);
    setRequiresSeat(true);
    setAllocationMode('OPEN');
    setComplimentaryRows([]);
    setRowInputText('');
    setSyncRowsToEvent(false);
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

    // Emails múltiples
    const emailsList = coupon.allowed_emails && Array.isArray(coupon.allowed_emails) && coupon.allowed_emails.length > 0
      ? coupon.allowed_emails
      : (coupon.assigned_email ? [coupon.assigned_email] : []);
    setAllowedEmails(emailsList);
    setEmailInputText('');

    // Configuración de cortesía y filas
    setIsComplimentary(Boolean(coupon.is_complimentary || coupon.discount_type === 'free_vip'));
    setRequiresSeat(coupon.requires_seat !== false);
    setAllocationMode(coupon.complimentary_allocation_mode || 'OPEN');
    setComplimentaryRows(coupon.complimentary_rows_priority || []);
    setRowInputText('');
    setSyncRowsToEvent(false);

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

    const payload: any = {
      code: code.trim().toUpperCase(),
      discount_type: discountType,
      discount_value: discountType === 'free_vip' ? 100 : parseFloat(discountValue || '0'),
      max_uses: parseInt(maxUses || '1', 10),
      event: eventId ? parseInt(eventId, 10) : null,
      assigned_email: allowedEmails.length > 0 ? allowedEmails[0] : (assignedEmail.trim() || null),
      allowed_emails: allowedEmails,
      is_complimentary: isComplimentary || discountType === 'free_vip',
      requires_seat: requiresSeat,
      complimentary_allocation_mode: allocationMode,
      complimentary_rows_priority: complimentaryRows,
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

      // Sincronizar filas prioritarias con el evento si fue solicitado
      if (syncRowsToEvent && eventId && complimentaryRows.length > 0) {
        try {
          await axios.patch(`${apiUrl}/tickets/events/${eventId}/`, {
            complimentary_rows_priority: complimentaryRows
          }, { headers });
          showToast.success('Filas prioritarias sincronizadas con el evento.');
        } catch (eventErr) {
          console.error('Error al sincronizar filas con el evento:', eventErr);
        }
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
   * Helpers para gestión de destinatarios del correo
   */
  const handleAddRecipientEmails = (rawText: string) => {
    if (!rawText.trim()) return;
    const splitted = rawText
      .split(/[\s,;]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0 && e.includes('@'));

    if (splitted.length === 0) return;

    setEmailRecipients(prev => {
      const set = new Set(prev.map(e => e.toLowerCase()));
      const next = [...prev];
      for (const em of splitted) {
        if (!set.has(em)) {
          set.add(em);
          next.push(em);
        }
      }
      return next;
    });
    setEmailRecipientInput('');
  };

  const handleRemoveRecipientEmail = (emailToRemove: string) => {
    setEmailRecipients(prev => prev.filter(e => e.toLowerCase() !== emailToRemove.toLowerCase()));
  };

  const handleToggleAllowedRecipient = (email: string) => {
    const normalized = email.trim().toLowerCase();
    setEmailRecipients(prev => {
      const exists = prev.some(e => e.toLowerCase() === normalized);
      if (exists) {
        return prev.filter(e => e.toLowerCase() !== normalized);
      }
      return [...prev, email.trim()];
    });
  };

  const handleSelectAllAllowedRecipients = () => {
    if (!selectedCouponForEmail?.allowed_emails || selectedCouponForEmail.allowed_emails.length === 0) return;
    setEmailRecipients(prev => {
      const set = new Set(prev.map(e => e.toLowerCase()));
      const next = [...prev];
      for (const em of selectedCouponForEmail.allowed_emails) {
        const clean = (em || '').trim();
        if (clean && clean.includes('@') && !set.has(clean.toLowerCase())) {
          set.add(clean.toLowerCase());
          next.push(clean);
        }
      }
      return next;
    });
  };

  /**
   * Abrir Modal de Envío por Correo Electrónico
   */
  const openEmailModal = (coupon: Coupon) => {
    setSelectedCouponForEmail(coupon);

    // Si tiene assigned_email o allowed_emails, pre-cargamos destinatarios elegibles
    const initialRecipients: string[] = [];
    if (coupon.assigned_email && coupon.assigned_email.trim()) {
      initialRecipients.push(coupon.assigned_email.trim());
    }
    if (coupon.allowed_emails && Array.isArray(coupon.allowed_emails)) {
      coupon.allowed_emails.forEach(em => {
        const clean = (em || '').trim();
        if (clean && clean.includes('@') && !initialRecipients.some(r => r.toLowerCase() === clean.toLowerCase())) {
          initialRecipients.push(clean);
        }
      });
    }

    setEmailRecipients(initialRecipients);
    setEmailRecipientInput('');
    setEmailRecipientName('');
    setEmailNote('');

    // Pre-cargar flyer del evento si existe
    const associatedEvent = events.find(ev => ev.id === coupon.event);
    const defaultImage = associatedEvent?.flyer || associatedEvent?.image || null;
    setEmailImageUrl(defaultImage);
    setEmailImageFile(null);
    setEmailImagePreview(defaultImage);

    setIsEmailModalOpen(true);
  };

  /**
   * Despachar correo electrónico con el cupón
   */
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCouponForEmail) return;

    // Procesar cualquier texto remanente en el input de destinatarios
    let targetRecipients = [...emailRecipients];
    if (emailRecipientInput.trim()) {
      const splitted = emailRecipientInput
        .split(/[\s,;]+/)
        .map(em => em.trim().toLowerCase())
        .filter(em => em.length > 0 && em.includes('@'));

      const set = new Set(targetRecipients.map(r => r.toLowerCase()));
      for (const s of splitted) {
        if (!set.has(s)) {
          set.add(s);
          targetRecipients.push(s);
        }
      }
      setEmailRecipients(targetRecipients);
      setEmailRecipientInput('');
    }

    if (targetRecipients.length === 0) {
      showToast.error('Ingresa al menos una dirección de correo válida para el envío.');
      return;
    }

    setEmailSending(true);
    try {
      const headers = getAuthHeaders();
      const payload: {
        emails: string[];
        recipient_name?: string;
        note: string;
        image_url: string | null;
      } = {
        emails: targetRecipients,
        note: emailNote.trim(),
        image_url: emailImageUrl || null
      };

      // Si solo hay un destinatario, se envía el recipient_name manual
      if (targetRecipients.length === 1 && emailRecipientName.trim()) {
        payload.recipient_name = emailRecipientName.trim();
      }

      const res = await axios.post(
        `${apiUrl}/tickets/coupons/${selectedCouponForEmail.id}/send_email/`,
        payload,
        { headers }
      );
      showAlert(
        res.data.message || `Cupón enviado exitosamente a ${targetRecipients.length} destinatario(s).`,
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

                      {/* Monto / Porcentaje & Cortesía */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1">
                          {coupon.discount_type === 'free_vip' ? (
                            <span className="text-amber-300 font-bold text-xs bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40 w-fit">
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

                          {coupon.is_complimentary && (
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 w-fit">
                              ★ Cortesía VIP
                            </span>
                          )}

                          {coupon.complimentary_allocation_mode === 'DESIGNATED_ROW' && (
                            <span className="text-[10px] text-amber-300/80 font-mono flex items-center gap-1">
                              <Layers size={10} />
                              {coupon.complimentary_rows_priority && coupon.complimentary_rows_priority.length > 0
                                ? coupon.complimentary_rows_priority.join(', ')
                                : 'Fila Designada'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Exclusividad por Correo (Múltiples o Único) */}
                      <td className="py-4 px-4">
                        {coupon.allowed_emails && coupon.allowed_emails.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-xs text-purple-300 bg-purple-950/40 px-2.5 py-1 rounded-md border border-purple-800/40 w-fit">
                              <Lock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              <span className="font-semibold" title={coupon.allowed_emails.join(', ')}>
                                {coupon.allowed_emails.length === 1
                                  ? coupon.allowed_emails[0]
                                  : `${coupon.allowed_emails.length} invitados autorizados`}
                              </span>
                            </div>
                            {coupon.allowed_emails.length > 1 && (
                              <span className="text-[10px] text-zinc-500 truncate max-w-[170px]" title={coupon.allowed_emails.join(', ')}>
                                {coupon.allowed_emails.slice(0, 2).join(', ')}...
                              </span>
                            )}
                          </div>
                        ) : coupon.assigned_email ? (
                          <div className="flex items-center gap-1.5 text-xs text-purple-300 bg-purple-950/40 px-2.5 py-1 rounded-md border border-purple-800/40 w-fit">
                            <Lock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-amber-500/30 rounded-2xl w-full max-w-lg max-h-[90vh] shadow-2xl flex flex-col text-zinc-200 overflow-hidden my-auto"
            >
              {/* Modal Header Sticky */}
              <div className="flex items-center justify-between border-b border-zinc-800 p-5 shrink-0 bg-zinc-900/95 backdrop-blur-xs">
                <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  {editingCoupon ? 'Editar Cupón' : 'Crear Nuevo Cupón'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="mx-5 mt-4 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-400 flex items-center gap-2 shrink-0">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              {/* Form Scrollable Body */}
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
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

                {/* ══════ CORREOS AUTORIZADOS (MÚLTIPLES INVITADOS VIP / NOMINATIVO) ══════ */}
                <div className="bg-zinc-950/70 border border-purple-900/40 p-3.5 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-purple-400" />
                      <span>Correos Autorizados (Nominativo / Intransferible)</span>
                    </label>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      {allowedEmails.length === 0 ? 'Público / Abierto' : `${allowedEmails.length} autorizado(s)`}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Ingresa o pega múltiples correos separados por comas, espacios o saltos de línea. Los cupones nominativos son intransferibles y la plataforma protegerá la privacidad sin exponer los correos en pantalla.
                  </p>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="invitado@ejemplo.com, vip@prensa.com..."
                      value={emailInputText}
                      onChange={e => setEmailInputText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddAllowedEmail();
                        }
                      }}
                      className="flex-1 bg-zinc-900 border border-purple-900/60 rounded-lg px-3 py-2 text-xs text-purple-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddAllowedEmail()}
                      disabled={!emailInputText.trim()}
                      className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      + Agregar
                    </button>
                  </div>

                  {/* Chips de Correos Agregados */}
                  {allowedEmails.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-zinc-900/50 rounded-lg border border-purple-950">
                        {allowedEmails.map((em) => (
                          <span
                            key={em}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-950/60 border border-purple-700/50 rounded-md text-xs font-mono text-purple-200 group"
                          >
                            <Mail size={11} className="text-purple-400" />
                            <span>{em}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveAllowedEmail(em)}
                              className="text-purple-400 hover:text-rose-400 p-0.5 rounded transition-colors cursor-pointer ml-0.5"
                              title="Eliminar este correo"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setAllowedEmails([])}
                          className="text-[10px] text-zinc-500 hover:text-rose-400 underline transition-colors"
                        >
                          Limpiar lista de correos
                        </button>
                      </div>
                    </div>
                  )}
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

                {/* ══════ CONFIGURACIÓN DE CORTESÍA VIP & SELECTOR DE FILAS DESIGNADAS ══════ */}
                <div className="bg-zinc-950/80 border border-amber-500/20 p-4 rounded-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                    <label className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500" />
                      <span>Cortesía VIP & Asignación de Asientos</span>
                    </label>
                    {isComplimentary && (
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                        Cortesía Activa
                      </span>
                    )}
                  </div>

                  {/* Toggles de Cortesía y Asiento */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-3 p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-lg cursor-pointer hover:border-zinc-700 transition-colors">
                      <input
                        type="checkbox"
                        checked={isComplimentary}
                        onChange={e => setIsComplimentary(e.target.checked)}
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-zinc-200 block">Es Cortesía VIP / Prensa</span>
                        <span className="text-[10px] text-zinc-500 block">100% Bonificación para invitados especiales</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-lg cursor-pointer hover:border-zinc-700 transition-colors">
                      <input
                        type="checkbox"
                        checked={requiresSeat}
                        onChange={e => setRequiresSeat(e.target.checked)}
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-zinc-200 block">Requiere Asiento Numerado</span>
                        <span className="text-[10px] text-zinc-500 block">Reserva un lugar físico en el mapa interactivo</span>
                      </div>
                    </label>
                  </div>

                  {/* Modo de Asignación de Asientos */}
                  {requiresSeat && (
                    <div className="space-y-3 pt-1">
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Modo de Asignación de Asiento
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAllocationMode('OPEN')}
                          className={`p-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                            allocationMode === 'OPEN'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          <span>Asignación Libre / Abierta</span>
                          <span className="text-[10px] font-normal text-zinc-500">El invitado elige cualquier asiento disponible</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAllocationMode('DESIGNATED_ROW')}
                          className={`p-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                            allocationMode === 'DESIGNATED_ROW'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            <Layers size={13} />
                            <span>Fila Designada Específica</span>
                          </span>
                          <span className="text-[10px] font-normal text-zinc-500">Prioridad con desborde automático</span>
                        </button>
                      </div>

                      {/* ── SELECTOR DE FILAS DESIGNADAS (PRIORIDAD CON DESBORDE) ── */}
                      {allocationMode === 'DESIGNATED_ROW' && (
                        <div className="p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-3 animate-fadeIn">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                              <Layers size={13} className="text-amber-400" />
                              <span>Lista Priorizada de Filas de Cortesía</span>
                            </label>
                            <span className="text-[10px] font-mono text-amber-400/80">
                              {complimentaryRows.length} fila(s) asignada(s)
                            </span>
                          </div>

                          <p className="text-[11px] text-zinc-400 leading-relaxed">
                            El sistema otorgará asientos primero en la <strong>1ª Fila Prioritaria</strong>. Cuando esta fila se agote en el evento, el mapa desbloqueará automáticamente la siguiente fila de la lista de prioridad.
                          </p>

                          {/* Filas Actualmente Seleccionadas en Orden de Prioridad */}
                          {complimentaryRows.length > 0 ? (
                            <div className="space-y-1.5 bg-zinc-900/60 p-2.5 rounded-lg border border-amber-900/40">
                              {complimentaryRows.map((rowName, idx) => (
                                <div
                                  key={rowName}
                                  className="flex items-center justify-between px-3 py-1.5 bg-zinc-950 border border-amber-500/30 rounded-lg text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                                      idx === 0
                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                        : 'bg-zinc-800 text-zinc-400'
                                    }`}>
                                      {idx === 0 ? '1ª Prioridad' : `${idx + 1}ª Desborde`}
                                    </span>
                                    <span className="font-bold text-zinc-100">{rowName}</span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleMoveRow(idx, 'up')}
                                      disabled={idx === 0}
                                      className="p-1 text-zinc-400 hover:text-amber-400 disabled:opacity-20 cursor-pointer"
                                      title="Subir prioridad"
                                    >
                                      <ChevronUp size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveRow(idx, 'down')}
                                      disabled={idx === complimentaryRows.length - 1}
                                      className="p-1 text-zinc-400 hover:text-amber-400 disabled:opacity-20 cursor-pointer"
                                      title="Bajar prioridad"
                                    >
                                      <ChevronDown size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveRow(rowName)}
                                      className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer ml-1"
                                      title="Quitar fila"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-2.5 text-center text-xs text-amber-400/70 border border-dashed border-amber-500/30 rounded-lg">
                              Aún no has agregado filas designadas. Elige una fila abajo o escribe el nombre.
                            </div>
                          )}

                          {/* Botones rápidos de filas detectadas en el teatro */}
                          {availableTheaterRows.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                                Filas detectadas en el recinto / teatro:
                              </span>
                              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                                {availableTheaterRows.map(row => {
                                  const isSelected = complimentaryRows.includes(row);
                                  return (
                                    <button
                                      key={row}
                                      type="button"
                                      onClick={() => isSelected ? handleRemoveRow(row) : handleAddRow(row)}
                                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-all cursor-pointer ${
                                        isSelected
                                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                                          : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-amber-500/50'
                                      }`}
                                    >
                                      {isSelected ? `✓ ${row}` : `+ ${row}`}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Input manual para otra fila o mesa personalizada */}
                          <div className="flex gap-2 pt-1">
                            <input
                              type="text"
                              placeholder="Ej. Fila G, Fila H, Mesa 4..."
                              value={rowInputText}
                              onChange={e => setRowInputText(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddRow();
                                }
                              }}
                              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddRow()}
                              disabled={!rowInputText.trim()}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                            >
                              + Añadir
                            </button>
                          </div>

                          {/* Checkbox para sincronizar con el Evento seleccionado */}
                          {eventId && (
                            <label className="flex items-center gap-2 pt-2 border-t border-amber-500/20 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={syncRowsToEvent}
                                onChange={e => setSyncRowsToEvent(e.target.checked)}
                                className="w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer"
                              />
                              <span className="text-[11px] text-amber-300 font-medium">
                                Guardar y sincronizar también estas filas prioritarias en la configuración del Evento
                              </span>
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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
                </div>

                {/* Submit Buttons Sticky Footer */}
                <div className="flex justify-end gap-3 p-5 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-xs shrink-0">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-purple-500/30 rounded-2xl w-full max-w-md max-h-[90vh] shadow-2xl flex flex-col text-zinc-200 overflow-hidden my-auto"
            >
              {/* Header Sticky */}
              <div className="flex items-center justify-between border-b border-zinc-800 p-5 shrink-0 bg-zinc-900/95 backdrop-blur-xs">
                <h3 className="text-lg font-bold text-purple-400 flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Enviar Cupón por Correo
                </h3>
                <button onClick={() => setIsEmailModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Scrollable Body */}
              <form onSubmit={handleSendEmail} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
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

                  {/* Destinatarios */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Destinatarios del Correo *
                      </label>
                      <span className="text-[11px] font-mono font-medium text-purple-400">
                        {emailRecipients.length === 1
                          ? '1 destinatario'
                          : `${emailRecipients.length} destinatarios`}
                      </span>
                    </div>

                    {/* Input para escribir o pegar correos */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="invitado@ejemplo.com, otro@ejemplo.com..."
                        value={emailRecipientInput}
                        onChange={e => setEmailRecipientInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            handleAddRecipientEmails(emailRecipientInput);
                          }
                        }}
                        onBlur={() => {
                          if (emailRecipientInput.trim()) {
                            handleAddRecipientEmails(emailRecipientInput);
                          }
                        }}
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-purple-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddRecipientEmails(emailRecipientInput)}
                        disabled={!emailRecipientInput.trim()}
                        className="px-3 py-2 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
                      >
                        Añadir
                      </button>
                    </div>

                    {/* Chips de correos agregados actualmente */}
                    {emailRecipients.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar p-2 bg-zinc-950/60 border border-zinc-800/80 rounded-lg">
                        {emailRecipients.map(em => (
                          <span
                            key={em}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono bg-purple-950/70 border border-purple-500/40 text-purple-200 shadow-xs"
                          >
                            <span>{em}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveRecipientEmail(em)}
                              className="text-purple-400 hover:text-white transition-colors cursor-pointer"
                              title="Remover destinatario"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Acciones rápidas de invitados autorizados en el cupón */}
                    {selectedCouponForEmail.allowed_emails && selectedCouponForEmail.allowed_emails.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-zinc-400 font-semibold">
                            Invitados autorizados en el cupón ({selectedCouponForEmail.allowed_emails.length}):
                          </span>
                          <button
                            type="button"
                            onClick={handleSelectAllAllowedRecipients}
                            className="text-[10px] text-purple-400 hover:text-purple-300 font-medium underline cursor-pointer"
                          >
                            Seleccionar todos
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedCouponForEmail.allowed_emails.map((em: string) => {
                            const isSelected = emailRecipients.some(
                              r => r.toLowerCase() === (em || '').trim().toLowerCase()
                            );
                            return (
                              <button
                                key={em}
                                type="button"
                                onClick={() => handleToggleAllowedRecipient(em)}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-purple-600 text-white border-purple-400'
                                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-purple-500'
                                }`}
                              >
                                {isSelected ? `✓ ${em}` : `+ ${em}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-zinc-500">
                      * Puedes ingresar uno o múltiples correos separados por comas, espacios o saltos de línea.
                    </p>
                  </div>

                  {/* Nombre del Destinatario (Solo cuando hay exactamente 1 destinatario) */}
                  {emailRecipients.length === 1 ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold uppercase tracking-wider text-amber-400">
                          Nombre del Destinatario (Opcional)
                        </label>
                        <span className="text-[10px] text-amber-500/80 font-mono">1 Destinatario</span>
                      </div>
                      <input
                        type="text"
                        placeholder="Ej. Carlos Mendoza"
                        value={emailRecipientName}
                        onChange={e => setEmailRecipientName(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                      />
                      <p className="text-[11px] text-zinc-500 mt-1">
                        Aparecerá en el título superior del correo. Si se deja en blanco, el correo no mostrará nombre en el título.
                      </p>
                    </div>
                  ) : emailRecipients.length > 1 ? (
                    <div className="p-3 bg-purple-950/20 border border-purple-900/40 rounded-lg text-xs text-purple-300 flex items-start gap-2">
                      <span className="text-sm">ℹ️</span>
                      <p className="leading-relaxed">
                        <strong>Envío múltiple ({emailRecipients.length} destinatarios):</strong> El sistema intentará resolver automáticamente el nombre registrado de cada destinatario. Si algún correo no tiene cuenta o nombre, su título quedará limpio en blanco.
                      </p>
                    </div>
                  ) : null}

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

                  {/* Imagen del Correo (Cloudinary / Flyer) */}
                  <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                        Imagen / Banner del Correo
                      </label>
                      {selectedCouponForEmail.event && (() => {
                        const associatedEv = events.find(ev => ev.id === selectedCouponForEmail.event);
                        const flyerUrl = associatedEv?.flyer || associatedEv?.image;
                        if (!flyerUrl) return null;
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setEmailImageUrl(flyerUrl);
                              setEmailImageFile(null);
                              setEmailImagePreview(flyerUrl);
                            }}
                            className="text-[10px] text-purple-400 hover:text-purple-300 font-medium underline cursor-pointer"
                          >
                            Usar Flyer Oficial
                          </button>
                        );
                      })()}
                    </div>

                    <CloudinaryMediaPicker
                      category="Cupones"
                      subfolder="coupon_invites"
                      aspectRatio="auto"
                      file={emailImageFile}
                      preview={emailImagePreview}
                      valueUrl={emailImageUrl}
                      onFileChange={(f, p) => {
                        setEmailImageFile(f);
                        setEmailImagePreview(p);
                      }}
                      onUrlChange={(url) => {
                        setEmailImageUrl(url);
                        setEmailImagePreview(url);
                      }}
                    />
                    <p className="text-[10px] text-zinc-500">
                      Opcional: Si no seleccionas una imagen, se enviará el correo con el diseño minimalista de Ms Ambar.
                    </p>
                  </div>
                </div>

                {/* Footer Sticky */}
                <div className="flex justify-end gap-3 p-5 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-xs shrink-0">
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
