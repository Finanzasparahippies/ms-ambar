import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  Package, 
  Truck, 
  Copy, 
  Check, 
  ExternalLink, 
  Download, 
  ShoppingBag, 
  Ticket, 
  MapPin, 
  Mail, 
  Phone, 
  Calendar,
  AlertCircle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import api from '../../lib/api';
import { useCart } from '../../context/CartContext';
import { getApiUrl } from '../../lib/utils';

interface OrderItem {
  id: number;
  product: number;
  product_name: string;
  product_image?: string | null;
  quantity: number;
  price: string | number;
}

interface OrderDetails {
  id: number;
  user_email: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  total_amount: string | number;
  items: OrderItem[];
  created_at: string;
  full_name: string;
  phone: string;
  street_and_number: string;
  suburb: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  address: string;
  selected_rate_id?: string;
  shipping_cost: string | number;
  shipping_provider?: string;
  tracking_number?: string;
  tracking_url?: string;
  shipping_label_pdf?: string;
}

export default function ShopSuccessPage() {
  const router = useRouter();
  const { session_id } = router.query;
  const { clearCart } = useCart();

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedTracking, setCopiedTracking] = useState<boolean>(false);

  useEffect(() => {
    // Vaciar el carrito de inmediato al concretar la compra
    clearCart();
  }, [clearCart]);

  useEffect(() => {
    if (!router.isReady) return;

    if (!session_id) {
      setLoading(false);
      setError('No se proporcionó un ID de sesión de pago válido.');
      return;
    }

    let isMounted = true;
    let attempts = 0;
    const maxAttempts = 4;

    const fetchOrder = async () => {
      try {
        const res = await api.get<OrderDetails>(`/shop/orders/by_session/?session_id=${session_id}`);
        if (isMounted) {
          setOrder(res.data);
          setLoading(false);
          setError(null);
        }
      } catch (err: any) {
        if (attempts < maxAttempts) {
          attempts += 1;
          setTimeout(fetchOrder, 1800);
        } else if (isMounted) {
          console.error('Error fetching order details:', err);
          setError(
            err.response?.data?.error || 
            'No pudimos recuperar los detalles de tu pedido. Si tu pago fue debitado, tu orden está segura y recibirás la confirmación por correo.'
          );
          setLoading(false);
        }
      }
    };

    fetchOrder();

    return () => {
      isMounted = false;
    };
  }, [router.isReady, session_id]);

  const handleCopyTracking = (trackingNum: string) => {
    if (!trackingNum) return;
    navigator.clipboard.writeText(trackingNum);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2500);
  };

  const getLabelUrl = (pdfPath?: string, orderId?: number) => {
    if (!pdfPath && !orderId) return '#';
    if (pdfPath && pdfPath.startsWith('http')) return pdfPath;
    const baseUrl = getApiUrl().replace(/\/api$/, '');
    if (pdfPath) return `${baseUrl}${pdfPath}`;
    return `${baseUrl}/api/shop/orders/${orderId}/label/`;
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>¡Compra Exitosa! — Tienda Oficial Ms Ambar</title>
        <meta name="description" content="Confirmación de tu pedido y datos de envío de la tienda de Ms Ambar." />
      </Head>

      <div className="max-w-4xl mx-auto">
        {/* Loading State Skeleton */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-6 text-center">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-ping" />
              <div className="w-20 h-20 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-wide">Confirmando tu pedido...</h2>
              <p className="text-gray-400 text-sm max-w-md">
                Estamos validando la transacción bancaria y coordinando tu guía de envío.
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-950/40 border border-red-500/30 rounded-3xl p-8 sm:p-10 text-center space-y-6 backdrop-blur-xl"
          >
            <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-2 max-w-lg mx-auto">
              <h2 className="text-2xl font-bold text-white">Detalle de Consulta</h2>
              <p className="text-red-200/80 text-sm leading-relaxed">{error}</p>
            </div>
            <div className="pt-4 flex flex-wrap justify-center gap-4">
              <Link 
                href="/tienda"
                className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-all duration-200"
              >
                Volver a la Tienda
              </Link>
              <Link 
                href="/contacto"
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-200"
              >
                Contactar a Soporte
              </Link>
            </div>
          </motion.div>
        )}

        {/* Success State */}
        {!loading && order && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            {/* Hero Header */}
            <div className="text-center space-y-4">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
                className="w-20 h-20 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-full flex items-center justify-center mx-auto text-black shadow-[0_0_50px_rgba(245,158,11,0.4)]"
              >
                <CheckCircle2 size={44} className="stroke-[2.5]" />
              </motion.div>
              
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck size={14} /> Pago Verificado con Éxito
                </span>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
                  ¡Gracias por tu compra, {order.full_name.split(' ')[0]}!
                </h1>
                <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto">
                  Tu pedido <span className="text-amber-400 font-semibold">#{order.id}</span> ha sido recibido y ya se encuentra en proceso de empaque y logística.
                </p>
              </div>
            </div>

            {/* Logistics & Tracking Card */}
            <div className="bg-gradient-to-b from-[#161822] to-[#0e1017] border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute -right-16 -top-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Truck size={28} />
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wider text-gray-400 font-medium">Paquetería Asignada</span>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {order.shipping_provider || 'Estándar Nacional (FedEx / Estafeta)'}
                    </h3>
                  </div>
                </div>

                {order.tracking_number && (
                  <div className="bg-black/40 border border-white/10 rounded-2xl p-3 sm:px-5 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-gray-400">Número de Guía / Tracking</div>
                      <div className="font-mono text-base font-bold text-emerald-400 tracking-wider">
                        {order.tracking_number}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCopyTracking(order.tracking_number!)}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all duration-150 relative group"
                      aria-label="Copiar número de guía"
                      title="Copiar guía"
                    >
                      {copiedTracking ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons for Tracking & PDF */}
              <div className="pt-6 flex flex-wrap gap-4 items-center justify-start">
                {order.tracking_url && (
                  <a
                    href={order.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm shadow-[0_4px_20px_rgba(245,158,11,0.3)] transition-all duration-200"
                  >
                    <ExternalLink size={16} /> Rastrear Paquete en Vivo
                  </a>
                )}

                <a
                  href={getLabelUrl(order.shipping_label_pdf, order.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-semibold text-sm transition-all duration-200"
                >
                  <Download size={16} /> Descargar Guía de Envío (PDF)
                </a>
              </div>
            </div>

            {/* Order Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Items Card (2 cols) */}
              <div className="md:col-span-2 bg-[#0e1017] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Package size={20} className="text-amber-400" /> Artículos en tu Pedido
                  </h3>
                  <span className="text-xs text-gray-400 font-medium">
                    {order.items?.length || 0} {order.items?.length === 1 ? 'producto' : 'productos'}
                  </span>
                </div>

                <div className="divide-y divide-white/5 space-y-4">
                  {order.items?.map((item) => (
                    <div key={item.id} className="pt-4 first:pt-0 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {item.product_image ? (
                          <img 
                            src={item.product_image} 
                            alt={item.product_name} 
                            className="w-14 h-14 rounded-xl object-cover bg-black/40 border border-white/10 shrink-0" 
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 shrink-0">
                            <ShoppingBag size={20} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="font-semibold text-white text-sm truncate">{item.product_name}</h4>
                          <p className="text-xs text-gray-400">
                            Cantidad: {item.quantity} × ${Number(item.price).toFixed(2)} MXN
                          </p>
                        </div>
                      </div>
                      <div className="text-right font-bold text-white shrink-0 text-sm">
                        ${(Number(item.price) * item.quantity).toFixed(2)} MXN
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Summary Breakdown */}
                <div className="pt-6 border-t border-white/10 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-400">
                    <span>Subtotal de Productos</span>
                    <span className="text-white">
                      ${(Number(order.total_amount) - Number(order.shipping_cost || 0)).toFixed(2)} MXN
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Costo de Envío Logístico</span>
                    <span className="text-white">
                      {Number(order.shipping_cost) > 0 ? `$${Number(order.shipping_cost).toFixed(2)} MXN` : 'Gratis'}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-amber-400 pt-3 border-t border-white/5">
                    <span>Total Pagado</span>
                    <span>${Number(order.total_amount).toFixed(2)} MXN</span>
                  </div>
                </div>
              </div>

              {/* Delivery & Customer Info Card (1 col) */}
              <div className="bg-[#0e1017] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="flex items-center gap-2 pb-4 border-b border-white/10">
                    <MapPin size={20} className="text-amber-400" />
                    <h3 className="text-lg font-bold text-white">Dirección de Entrega</h3>
                  </div>

                  <div className="space-y-3 text-sm text-gray-300">
                    <div className="font-bold text-white text-base">{order.full_name}</div>
                    <div>
                      {order.street_and_number}
                      {order.suburb && <span className="block text-gray-400">Col. {order.suburb}</span>}
                    </div>
                    <div>
                      {order.city}, {order.state} {order.postal_code}
                    </div>
                    <div className="text-gray-400">{order.country}</div>
                  </div>

                  <div className="pt-4 border-t border-white/10 space-y-2 text-xs text-gray-400">
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-amber-400/70 shrink-0" />
                      <span className="truncate">{order.user_email}</span>
                    </div>
                    {order.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-amber-400/70 shrink-0" />
                        <span>{order.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-amber-400/70 shrink-0" />
                      <span>{new Date(order.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10">
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 text-xs text-amber-200/90 leading-relaxed">
                    📦 Hemos enviado un correo a <strong className="text-white">{order.user_email}</strong> con el comprobante y los accesos a tu guía.
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Navigation CTAs */}
            <div className="pt-6 flex flex-wrap justify-center gap-4">
              <Link
                href="/tienda"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-base transition-all duration-200 shadow-[0_4px_25px_rgba(245,158,11,0.3)]"
              >
                <ShoppingBag size={20} /> Seguir Comprando en la Tienda
              </Link>
              <Link
                href="/comprar-boletos"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-semibold text-base transition-all duration-200"
              >
                <Ticket size={20} /> Ver Conciertos y Boletos <ArrowRight size={18} />
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
