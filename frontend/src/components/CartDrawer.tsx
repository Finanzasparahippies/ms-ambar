import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  X,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  CheckCircle,
  Mail,
  User,
  Phone,
  Truck,
  Package,
  Sparkles
} from 'lucide-react';
import api from '../lib/api';
import { useCart, ShippingRate } from '../context/CartContext';

const MEXICAN_STATES = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas",
  "Chihuahua", "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México",
  "Guanajuato", "Guerrero", "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit",
  "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí",
  "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas"
];

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartOpen,
    openCart,
    closeCart,
    checkoutStep,
    setCheckoutStep,
    updateQuantity,
    removeFromCart,
    clearCart,
    cartSubtotal,
    cartItemsCount,
    shippingRate: selectedRate,
    setShippingRate: setSelectedRate,
    requiresShipping,
    financials,
  } = useCart();

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Formulario de Envío
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [state, setState] = useState('Sonora');
  const [city, setCity] = useState('');
  const [suburb, setSuburb] = useState('');
  const [streetAndNumber, setStreetAndNumber] = useState('');
  const [country] = useState('México');

  // Cotizador de Envíos
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [quotingShipping, setQuotingShipping] = useState<boolean>(false);
  const [orderResult, setOrderResult] = useState<any>(null);
  const [packagingType, setPackagingType] = useState<'bag' | 'box'>('bag');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.email) setEmail(user.email);
          if (user.first_name || user.last_name) {
            setFullName(`${user.first_name || ''} ${user.last_name || ''}`.trim());
          }
        } catch (e) {}
      }
    }

    // Sincronizar empaque por defecto de la tienda
    const fetchShippingConfig = async () => {
      try {
        const res = await api.get('/shop/shipping/config/');
        if (res.data?.default_packaging_type) {
          setPackagingType(res.data.default_packaging_type);
        }
      } catch (e) {}
    };
    fetchShippingConfig();
  }, []);

  // Escuchar cambios en el Código Postal o Tipo de Empaque
  useEffect(() => {
    const cleanCp = postalCode.replace(/\D/g, '');
    if (cleanCp.length === 5) {
      handlePostalCodeLookupAndQuote(cleanCp, packagingType);
    } else {
      setShippingRates([]);
      setSelectedRate(null);
    }
  }, [postalCode, packagingType]);

  const handlePostalCodeLookupAndQuote = async (cp: string, currentPackaging: 'bag' | 'box' = packagingType) => {
    setQuotingShipping(true);
    setError(null);
    try {
      try {
        const lookupRes = await api.get(`/shop/shipping/postal-code/${cp}/`);
        if (lookupRes.data?.valid && lookupRes.data?.state_name) {
          const matchedState = MEXICAN_STATES.find(
            (s) =>
              s.toLowerCase().includes(lookupRes.data.state_name.toLowerCase()) ||
              lookupRes.data.state_name.toLowerCase().includes(s.toLowerCase())
          );
          if (matchedState) setState(matchedState);
        }
      } catch (e) {}

      const quoteRes = await api.post('/shop/shipping/quote/', {
        postal_code: cp,
        weight_kg: 1.0,
        packaging_type: currentPackaging,
      });

      if (quoteRes.data?.rates && quoteRes.data.rates.length > 0) {
        setShippingRates(quoteRes.data.rates);
        setSelectedRate(null);
      } else {
        setShippingRates([]);
        setSelectedRate(null);
      }
    } catch (err: any) {
      console.warn('Fallo al cotizar paquetería, ofreciendo tarifa estándar de respaldo:', err);
      const fallbackRate: ShippingRate = {
        id: 'rate_std_fallback',
        provider: 'Estándar Nacional (FedEx / Estafeta)',
        service_level_name: 'Terrestre Estándar',
        total_price: 150.0,
        cost: 150.0,
        currency: 'MXN',
        days: '3 a 5 días hábiles',
        is_fallback: true,
        is_fallback_rate: true,
      };
      setShippingRates([fallbackRate]);
      setSelectedRate(null);
    } finally {
      setQuotingShipping(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanCp = postalCode.replace(/\D/g, '');
    if (requiresShipping && cleanCp.length !== 5) {
      setError('Por favor ingresa un Código Postal válido de 5 dígitos.');
      setLoading(false);
      return;
    }

    if (requiresShipping && !selectedRate) {
      setError('Debes cotizar y seleccionar un método de envío antes de proceder al pago.');
      setLoading(false);
      return;
    }

    const itemsPayload = cart.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity,
    }));

    const isFallback = Boolean(selectedRate?.is_fallback || selectedRate?.is_fallback_rate);

    try {
      const res = await api.post('/shop/checkout/', {
        email,
        full_name: fullName,
        phone,
        postal_code: cleanCp,
        state,
        city,
        suburb,
        street_and_number: streetAndNumber,
        country,
        packaging_type: packagingType,
        shipping_rate_id: selectedRate?.id || '',
        accept_fallback_shipping: isFallback,
        shipping_amount: selectedRate ? selectedRate.total_price : 0,
        shipping_provider: selectedRate?.provider || (requiresShipping ? 'Estándar Nacional' : 'Digital'),
        items: itemsPayload,
      });

      if (res.data?.checkout_url) {
        if (res.data.checkout_url.includes('checkout.stripe.com') || res.data.checkout_url.includes('/shop/success')) {
          window.location.href = res.data.checkout_url;
          return;
        } else {
          setOrderResult({
            order_id: res.data.order_id,
            total_amount: financials.total,
            status: 'Confirmado',
          });
          clearCart();
          setCheckoutStep('success');
        }
      }
    } catch (err: any) {
      console.error('Checkout failed', err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Error de comunicación con la pasarela. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Cart Trigger Button (Global & Viewport Anchored) */}
      {cartItemsCount > 0 && !isCartOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={openCart}
          className="fixed bottom-8 right-8 z-[100] w-16 h-16 bg-gradient-to-tr from-purple-600 via-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-[0_10px_35px_rgba(139,92,246,0.45)] border border-purple-400/40 hover:brightness-110 transition-all duration-300 group"
          aria-label="Abrir bolsa de compras"
        >
          <ShoppingBag size={24} className="stroke-[2.2] group-hover:scale-105 transition-transform" />
          <span className="absolute -top-1 -right-1 min-w-[1.375rem] h-[1.375rem] px-1 bg-amber-400 text-black rounded-full text-xs font-black flex items-center justify-center shadow-md border border-amber-200">
            {cartItemsCount}
          </span>
        </motion.button>
      )}

      {/* Drawer Panel and Modal Backdrop */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-[150] overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title">
            {/* Drawer Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCart}
              className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            />

            {/* Slide-out Panel */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                className="w-screen max-w-md bg-[#0A0D0B]/95 backdrop-blur-2xl border-l border-purple-500/20 p-6 md:p-8 flex flex-col justify-between overflow-y-auto font-sans text-white shadow-[-25px_0_60px_rgba(0,0,0,0.9),0_0_50px_rgba(139,92,246,0.12)] relative z-10"
              >
                {/* Decorative Boutique Ambient Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />
                <div className="absolute bottom-10 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />

                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-300 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                      <ShoppingBag size={18} className="stroke-[2.2]" />
                    </div>
                    <div>
                      <h3 id="cart-drawer-title" className="text-lg font-black uppercase tracking-wider text-white drop-shadow-sm flex items-center gap-2">
                        Tu Carrito
                      </h3>
                      <p className="text-xs text-purple-300/80 uppercase tracking-widest font-bold mt-0.5">
                        {checkoutStep === 'cart' ? 'Resumen de Selección' : checkoutStep === 'shipping' ? 'Datos de Envío y Facturación' : 'Confirmación de Orden'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeCart}
                    className="p-2.5 hover:bg-purple-950/40 hover:border-purple-500/30 rounded-xl text-neutral-400 hover:text-white transition-colors border border-white/10"
                    aria-label="Cerrar carrito"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Contenido según el paso */}
                <div className="flex-1 overflow-y-auto pr-1 custom-scroll">
                  {checkoutStep === 'cart' && (
                    <div className="space-y-4">
                      {cart.length === 0 ? (
                        <div className="text-center py-20 flex flex-col items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-purple-950/30 border border-purple-500/20 flex items-center justify-center text-purple-400/70 shadow-inner">
                            <ShoppingBag size={28} />
                          </div>
                          <div>
                            <p className="text-sm text-white font-black uppercase tracking-widest">El carrito está vacío</p>
                            <p className="text-xs text-neutral-400 mt-1">Explora la boutique oficial y agrega tu mercancía favorita.</p>
                          </div>
                        </div>
                      ) : (
                        cart.map((item) => {
                          const itemImage =
                            (item.product.images && item.product.images.length > 0
                              ? typeof item.product.images[0] === 'string'
                                ? item.product.images[0]
                                : item.product.images[0]?.image
                              : item.product.image) || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80';

                          return (
                            <div
                              key={item.product.id}
                              className="flex gap-4 p-4 bg-[#0E1310]/90 border border-white/[0.08] hover:border-purple-500/40 rounded-2xl relative overflow-hidden group shadow-lg transition-all"
                            >
                              <img
                                src={itemImage}
                                alt={item.product.name}
                                className="w-16 h-16 object-cover rounded-xl shrink-0 border border-purple-500/20 bg-purple-950/20"
                              />
                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-black uppercase tracking-wider truncate mb-1 pr-6 text-white group-hover:text-purple-300 transition-colors">
                                  {item.product.name}
                                </h4>
                                <p className="text-xs text-amber-300 font-black mb-3">
                                  ${item.product.price} <span className="text-xs text-neutral-400 font-semibold">MXN</span>
                                </p>

                                <div className="flex items-center gap-2">
                                  <div className="flex items-center bg-white/[0.06] border border-white/15 rounded-xl p-0.5 shrink-0 shadow-sm">
                                    <button
                                      type="button"
                                      onClick={() => updateQuantity(item.product.id, -1)}
                                      className="w-6 h-6 bg-white/[0.08] hover:bg-purple-600 hover:border-purple-400 border border-white/10 rounded-lg flex items-center justify-center text-white transition-colors font-bold active:scale-95"
                                      aria-label="Disminuir cantidad"
                                    >
                                      <Minus size={11} />
                                    </button>
                                    <span className="w-7 text-center text-xs font-mono font-black text-white px-1">
                                      {item.quantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => updateQuantity(item.product.id, 1)}
                                      className="w-6 h-6 bg-white/[0.08] hover:bg-purple-600 hover:border-purple-400 border border-white/10 rounded-lg flex items-center justify-center text-white transition-colors font-bold active:scale-95"
                                      aria-label="Aumentar cantidad"
                                    >
                                      <Plus size={11} />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeFromCart(item.product.id)}
                                className="absolute top-3.5 right-3.5 text-neutral-500 hover:text-rose-400 hover:bg-rose-950/30 p-1.5 rounded-lg border border-transparent hover:border-rose-500/30 transition-all"
                                aria-label="Eliminar producto"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {checkoutStep === 'shipping' && (
                    <form onSubmit={handleCheckout} className="space-y-4">
                      {error && (
                        <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold uppercase tracking-wider">
                          {error}
                        </div>
                      )}

                      {/* Email y Nombre */}
                      <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-neutral-300 uppercase tracking-widest font-bold block pl-1">
                            Correo Electrónico *
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-3.5 h-3.5" />
                            <input
                              type="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="tu@correo.com"
                              className="w-full bg-[#0E1310] border border-white/15 focus:border-purple-400 focus:ring-1 focus:ring-purple-400/30 rounded-xl pl-9 pr-3 py-3 text-xs text-white placeholder-neutral-500 outline-none transition-all shadow-inner"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-neutral-300 uppercase tracking-widest font-bold block pl-1">
                            Nombre Completo *
                          </label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-3.5 h-3.5" />
                            <input
                              type="text"
                              required
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              placeholder="Nombre y Apellidos"
                              className="w-full bg-[#0E1310] border border-white/15 focus:border-purple-400 focus:ring-1 focus:ring-purple-400/30 rounded-xl pl-9 pr-3 py-3 text-xs text-white placeholder-neutral-500 outline-none transition-all shadow-inner"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Teléfono y Código Postal */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-neutral-300 uppercase tracking-widest font-bold block pl-1">
                            WhatsApp / Teléfono *
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-3.5 h-3.5" />
                            <input
                              type="tel"
                              required
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="10 dígitos"
                              className="w-full bg-[#0E1310] border border-white/15 focus:border-purple-400 focus:ring-1 focus:ring-purple-400/30 rounded-xl pl-9 pr-3 py-3 text-xs text-white placeholder-neutral-500 outline-none transition-all font-mono shadow-inner"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-purple-300 uppercase tracking-widest font-bold block pl-1 flex items-center justify-between">
                            <span>Código Postal *</span>
                            {quotingShipping ? <span className="text-xs animate-pulse text-purple-400">Cotizando...</span> : null}
                          </label>
                          <div className="relative">
                            <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400/80 w-3.5 h-3.5" />
                            <input
                              type="text"
                              required
                              maxLength={5}
                              value={postalCode}
                              onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, ''))}
                              placeholder="Ej. 83000"
                              className="w-full bg-[#0E1310] border border-purple-500/40 focus:border-purple-400 focus:ring-1 focus:ring-purple-400/40 rounded-xl pl-9 pr-3 py-3 text-xs text-white placeholder-neutral-500 outline-none transition-all font-mono font-bold shadow-inner"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Selector de Tipo de Empaque (Bolsa vs Caja) */}
                      <div className="space-y-1.5 pt-1">
                        <label className="text-xs text-neutral-300 uppercase tracking-widest font-bold block pl-1">
                          Tipo de Empaque
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPackagingType('bag')}
                            className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                              packagingType === 'bag'
                                ? 'border-purple-500 bg-purple-950/60 text-white shadow-md shadow-purple-950/40 ring-1 ring-purple-500/50'
                                : 'border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/20'
                            }`}
                          >
                            <span>✉️</span> Bolsa de Seguridad
                          </button>
                          <button
                            type="button"
                            onClick={() => setPackagingType('box')}
                            className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                              packagingType === 'box'
                                ? 'border-purple-500 bg-purple-950/60 text-white shadow-md shadow-purple-950/40 ring-1 ring-purple-500/50'
                                : 'border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/20'
                            }`}
                          >
                            <span>📦</span> Caja de Envío
                          </button>
                        </div>
                      </div>

                      {/* Selector de Tarifas de Envío con Dark Glass UI */}
                      {shippingRates.length > 0 && (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-purple-300 uppercase tracking-widest font-bold flex items-center gap-1.5 pl-1">
                              <Truck size={13} className="text-purple-400" /> Opciones de Envío Disponibles
                            </label>
                            <span className="text-[10px] text-neutral-400 font-medium">
                              {selectedRate ? '1 seleccionada' : 'Selecciona una opción'}
                            </span>
                          </div>

                          {/* Fallback warning if rates are fallback */}
                          {shippingRates.some((r) => r.is_fallback || r.is_fallback_rate) && (
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2 shadow-sm">
                              <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-bold text-[11px] uppercase tracking-wider text-amber-300">Tarifa Plana de Contingencia</p>
                                <p className="text-[10px] text-amber-200/85 leading-normal mt-0.5">
                                  Las paqueterías en tiempo real no reportan cobertura directa para este C.P. Confirma voluntariamente la tarifa estándar de respaldo ($150.00 MXN) para continuar.
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            {shippingRates.map((rate) => {
                              const isSelected = selectedRate?.id === rate.id;
                              const isFallback = Boolean(rate.is_fallback || rate.is_fallback_rate);

                              return (
                                <motion.div
                                  key={rate.id}
                                  whileHover={{ scale: 1.01 }}
                                  whileTap={{ scale: 0.99 }}
                                  onClick={() => setSelectedRate(rate)}
                                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all duration-200 flex items-center justify-between gap-3 relative overflow-hidden ${
                                    isSelected
                                      ? 'border-purple-500 bg-purple-950/40 text-white shadow-[0_0_20px_rgba(168,85,247,0.2)] ring-1 ring-purple-500/50'
                                      : 'border-white/10 bg-white/[0.03] text-neutral-300 hover:border-purple-500/40 hover:bg-purple-950/20'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    {/* Custom Radio Button */}
                                    <div
                                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                        isSelected
                                          ? 'border-purple-400 bg-purple-500'
                                          : 'border-white/30 bg-black/40'
                                      }`}
                                    >
                                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>

                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="font-extrabold uppercase text-xs text-white tracking-wide">
                                          {rate.provider}
                                        </p>
                                        {isFallback && (
                                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-[9px] font-bold text-amber-300 uppercase">
                                            Respaldo
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-neutral-400 mt-0.5">
                                        {rate.service_level_name} • {rate.days}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <span className="font-black text-amber-300 font-mono text-sm block">
                                      ${rate.total_price.toFixed(2)}
                                    </span>
                                    <span className="text-[10px] text-neutral-400 font-bold uppercase">MXN</span>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Estado y Ciudad */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-neutral-300 uppercase tracking-widest font-bold block pl-1">
                            Estado *
                          </label>
                          <select
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                            className="w-full bg-[#0E1310] border border-white/15 focus:border-purple-400 focus:ring-1 focus:ring-purple-400/30 rounded-xl px-3 py-3 text-xs outline-none text-white shadow-inner"
                          >
                            {MEXICAN_STATES.map((st) => (
                              <option key={st} value={st} className="bg-[#0E1310] text-white">
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-neutral-300 uppercase tracking-widest font-bold block pl-1">
                            Ciudad / Municipio *
                          </label>
                          <input
                            type="text"
                            required
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="Ciudad"
                            className="w-full bg-[#0E1310] border border-white/15 focus:border-purple-400 focus:ring-1 focus:ring-purple-400/30 rounded-xl px-3 py-3 text-xs text-white placeholder-neutral-500 outline-none shadow-inner"
                          />
                        </div>
                      </div>

                      {/* Colonia y Dirección */}
                      <div className="space-y-1">
                        <label className="text-xs text-neutral-300 uppercase tracking-widest font-bold block pl-1">
                          Colonia / Asentamiento *
                        </label>
                        <input
                          type="text"
                          required
                          value={suburb}
                          onChange={(e) => setSuburb(e.target.value)}
                          placeholder="Colonia o Fraccionamiento"
                          className="w-full bg-[#0E1310] border border-white/15 focus:border-purple-400 focus:ring-1 focus:ring-purple-400/30 rounded-xl px-3 py-3 text-xs text-white placeholder-neutral-500 outline-none shadow-inner"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-neutral-300 uppercase tracking-widest font-bold block pl-1">
                          Calle y Número Exterior / Interior *
                        </label>
                        <input
                          type="text"
                          required
                          value={streetAndNumber}
                          onChange={(e) => setStreetAndNumber(e.target.value)}
                          placeholder="Av. Principal #123 Int 4"
                          className="w-full bg-[#0E1310] border border-white/15 focus:border-purple-400 focus:ring-1 focus:ring-purple-400/30 rounded-xl px-3 py-3 text-xs text-white placeholder-neutral-500 outline-none shadow-inner"
                        />
                      </div>

                      {/* Desglose Financiero Dinámico en Paso Envío */}
                      <div className="p-4 bg-[#0E1310] border border-white/10 rounded-2xl space-y-2 mt-4 shadow-inner">
                        <div className="flex justify-between items-center text-xs text-neutral-400">
                          <span>Subtotal de productos:</span>
                          <span className="font-mono text-white font-bold">${financials.subtotal.toFixed(2)} MXN</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-neutral-400">
                          <span>Envío {selectedRate ? `(${selectedRate.provider})` : ''}:</span>
                          <span className="font-mono font-bold transition-all duration-300">
                            {financials.shipping_cost !== null ? (
                              <span className="text-amber-300">${financials.shipping_cost.toFixed(2)} MXN</span>
                            ) : postalCode.replace(/\D/g, '').length === 5 ? (
                              <span className="text-purple-400">
                                {quotingShipping ? 'Cotizando paqueterías...' : 'Selecciona una opción'}
                              </span>
                            ) : (
                              <span className="text-neutral-500">Ingresa tu C.P.</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider pt-2 border-t border-white/10 text-white">
                          <span>Total a Pagar:</span>
                          <motion.span
                            key={financials.total}
                            initial={{ scale: 0.95, opacity: 0.8 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-amber-300 font-mono font-black text-base drop-shadow-sm"
                          >
                            ${financials.total.toFixed(2)} MXN
                          </motion.span>
                        </div>
                      </div>

                      {/* Botón de Pago con Estados Reactivos A, B, C, D */}
                      <div className="pt-2 space-y-3">
                        {(() => {
                          const cleanCp = postalCode.replace(/\D/g, '');

                          if (loading) {
                            return (
                              <button
                                type="button"
                                disabled
                                className="w-full bg-purple-900/40 text-purple-200/70 font-black uppercase tracking-widest text-xs py-4 rounded-xl flex items-center justify-center gap-2 border border-purple-500/20 cursor-not-allowed"
                              >
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Procesando pago seguro...</span>
                              </button>
                            );
                          }

                          // Estado B: Dirección lista, cotizando paqueterías
                          if (quotingShipping) {
                            return (
                              <button
                                type="button"
                                disabled
                                className="w-full bg-purple-950/60 text-purple-300 font-bold uppercase tracking-widest text-xs py-4 rounded-xl flex items-center justify-center gap-2 border border-purple-500/30 cursor-not-allowed shadow-inner"
                              >
                                <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                                <span>Cotizando paqueterías...</span>
                              </button>
                            );
                          }

                          // Estado A: Falta dirección o C.P. incompleto
                          if (requiresShipping && cleanCp.length < 5) {
                            return (
                              <button
                                type="button"
                                disabled
                                className="w-full bg-white/[0.04] text-neutral-400 font-bold uppercase tracking-widest text-xs py-4 rounded-xl flex items-center justify-center gap-2 border border-white/10 cursor-not-allowed"
                              >
                                <span>Ingresa tu Código Postal para cotizar</span>
                              </button>
                            );
                          }

                          // Estado C: Tarifas listas, falta elegir paquetería
                          if (requiresShipping && !selectedRate) {
                            return (
                              <button
                                type="button"
                                disabled
                                className="w-full bg-purple-950/30 text-purple-300/80 font-bold uppercase tracking-widest text-xs py-4 rounded-xl flex items-center justify-center gap-2 border border-purple-500/20 cursor-not-allowed"
                              >
                                <span>Selecciona una opción de envío</span>
                              </button>
                            );
                          }

                          // Estado D: Tarifa confirmada (o no requiere envío)
                          return (
                            <motion.button
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              type="submit"
                              className="w-full bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:brightness-110 active:scale-95 text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-purple-600/35 border border-purple-400/40 transition-all cursor-pointer"
                            >
                              <span>Proceder al pago seguro · Total: ${financials.total.toFixed(2)} MXN</span>
                              <ArrowRight size={15} />
                            </motion.button>
                          );
                        })()}

                        <button
                          type="button"
                          onClick={() => setCheckoutStep('cart')}
                          className="w-full border border-white/15 hover:bg-purple-950/30 hover:border-purple-500/30 text-neutral-300 hover:text-white transition-all font-bold uppercase tracking-widest text-xs py-3 rounded-xl"
                        >
                          Volver al Carrito
                        </button>
                      </div>
                    </form>
                  )}

                  {checkoutStep === 'success' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="py-10 text-center flex flex-col items-center gap-4"
                    >
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 animate-bounce">
                        <CheckCircle size={36} />
                      </div>
                      <h3 className="text-lg font-black uppercase tracking-wider text-white">¡Pedido Confirmado!</h3>
                      <p className="text-xs text-neutral-300 leading-relaxed px-4">
                        Tu orden ha sido registrada exitosamente. Recibirás tu guía de rastreo y confirmación vía correo electrónico.
                      </p>

                      <div className="w-full p-4 bg-[#0E1310] border border-purple-500/20 rounded-2xl text-left space-y-2.5 mt-4 shadow-xl">
                        <div className="flex justify-between text-xs uppercase font-bold text-neutral-400">
                          <span>Orden ID:</span>
                          <span className="text-white font-mono">#{orderResult?.order_id}</span>
                        </div>
                        <div className="flex justify-between text-xs uppercase font-bold text-neutral-400">
                          <span>Total:</span>
                          <span className="text-amber-300 font-black">${orderResult?.total_amount} MXN</span>
                        </div>
                        <div className="flex justify-between text-xs uppercase font-bold text-neutral-400">
                          <span>Estado:</span>
                          <span className="text-emerald-400 font-extrabold uppercase tracking-widest">
                            {orderResult?.status}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          closeCart();
                          setCheckoutStep('cart');
                        }}
                        className="w-full bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 text-white font-black uppercase tracking-widest text-xs py-3.5 rounded-xl mt-4 hover:brightness-110 border border-purple-400/40 shadow-lg shadow-purple-600/30 transition-all"
                      >
                        Continuar en la Tienda
                      </button>
                    </motion.div>
                  )}
                </div>

                {/* Cart Footer en Paso Carrito */}
                {checkoutStep === 'cart' && cart.length > 0 && (
                  <div className="border-t border-white/10 pt-4 mt-4 space-y-3">
                    <div className="space-y-1.5 text-xs font-semibold pl-1">
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-400">Subtotal:</span>
                        <span className="text-white font-mono font-bold">${financials.subtotal.toFixed(2)} MXN</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-400">Envío:</span>
                        <span className="font-mono text-purple-300 font-bold">
                          {requiresShipping
                            ? selectedRate
                              ? `$${selectedRate.total_price.toFixed(2)} MXN`
                              : 'Por calcular'
                            : 'Gratis / No requerido'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-black uppercase tracking-wider pt-1 border-t border-white/5">
                        <span className="text-neutral-200">Total estimado:</span>
                        <span className="text-amber-300 font-mono font-black text-base drop-shadow-sm">
                          ${financials.total.toFixed(2)} MXN
                        </span>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setCheckoutStep('shipping')}
                      className="w-full bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:brightness-110 active:scale-95 text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-purple-600/35 border border-purple-400/40 transition-all cursor-pointer"
                    >
                      {requiresShipping ? 'Ingresar dirección de envío' : 'Proceder al Pago Seguro'}{' '}
                      <ArrowRight size={15} />
                    </motion.button>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CartDrawer;
