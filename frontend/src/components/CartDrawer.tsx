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
  Package
} from 'lucide-react';
import api from '../lib/api';
import { useCart } from '../context/CartContext';

const MEXICAN_STATES = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas",
  "Chihuahua", "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México",
  "Guanajuato", "Guerrero", "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit",
  "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí",
  "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas"
];

interface ShippingRate {
  id: string;
  provider: string;
  service_level_name: string;
  total_price: number;
  currency: string;
  days: string;
  is_fallback?: boolean;
}

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartOpen,
    closeCart,
    checkoutStep,
    setCheckoutStep,
    updateQuantity,
    removeFromCart,
    clearCart,
    cartSubtotal,
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
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);
  const [quotingShipping, setQuotingShipping] = useState<boolean>(false);
  const [orderResult, setOrderResult] = useState<any>(null);

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
  }, []);

  // Escuchar cambios en el Código Postal
  useEffect(() => {
    const cleanCp = postalCode.replace(/\D/g, '');
    if (cleanCp.length === 5) {
      handlePostalCodeLookupAndQuote(cleanCp);
    } else {
      setShippingRates([]);
      setSelectedRate(null);
    }
  }, [postalCode]);

  const handlePostalCodeLookupAndQuote = async (cp: string) => {
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
      });

      if (quoteRes.data?.rates && quoteRes.data.rates.length > 0) {
        setShippingRates(quoteRes.data.rates);
        setSelectedRate(quoteRes.data.rates[0]);
      }
    } catch (err: any) {
      console.warn('Fallo al cotizar paquetería, usando tarifa estándar de respaldo:', err);
      const fallbackRate: ShippingRate = {
        id: 'rate_std_fallback',
        provider: 'Estándar Nacional (FedEx / Estafeta)',
        service_level_name: 'Terrestre Estándar',
        total_price: 150.0,
        currency: 'MXN',
        days: '3 a 5 días hábiles',
        is_fallback: true,
      };
      setShippingRates([fallbackRate]);
      setSelectedRate(fallbackRate);
    } finally {
      setQuotingShipping(false);
    }
  };

  const shippingCost = selectedRate ? selectedRate.total_price : 150;
  const orderTotal = cartSubtotal + (cart.length > 0 ? shippingCost : 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanCp = postalCode.replace(/\D/g, '');
    if (cleanCp.length !== 5) {
      setError('Por favor ingresa un Código Postal válido de 5 dígitos.');
      setLoading(false);
      return;
    }

    const itemsPayload = cart.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity,
    }));

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
        shipping_rate_id: selectedRate?.id || 'rate_std_fallback',
        shipping_amount: selectedRate?.total_price || 150.0,
        shipping_provider: selectedRate?.provider || 'Estándar Nacional',
        items: itemsPayload,
      });

      if (res.data?.checkout_url) {
        if (res.data.checkout_url.includes('checkout.stripe.com')) {
          window.location.href = res.data.checkout_url;
          return;
        } else {
          setOrderResult({
            order_id: res.data.order_id,
            total_amount: orderTotal,
            status: 'Confirmado (Modo Desarrollo)',
          });
          clearCart();
          setCheckoutStep('success');
        }
      }
    } catch (err: any) {
      console.error('Checkout failed', err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Error de comunicación con la pasarela. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
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
              className="w-screen max-w-md bg-[#0c100e] border-l border-white/15 p-6 md:p-8 flex flex-col justify-between overflow-y-auto font-sans text-white shadow-2xl relative z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-5">
                <div>
                  <h3 id="cart-drawer-title" className="text-xl font-black uppercase tracking-wider text-white drop-shadow-sm flex items-center gap-2">
                    <ShoppingBag size={20} className="text-amber-400" />
                    Tu Carrito
                  </h3>
                  <p className="text-[10px] text-neutral-300 uppercase tracking-widest font-bold mt-0.5">
                    {checkoutStep === 'cart' ? 'Resumen de Selección' : checkoutStep === 'shipping' ? 'Datos de Envío y Facturación' : 'Confirmación de Orden'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCart}
                  className="p-2.5 hover:bg-white/10 rounded-full text-neutral-300 hover:text-white transition-colors border border-white/10"
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
                        <div className="w-16 h-16 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-neutral-400">
                          <ShoppingBag size={28} />
                        </div>
                        <div>
                          <p className="text-sm text-white font-extrabold uppercase tracking-widest">El carrito está vacío</p>
                          <p className="text-xs text-neutral-400 mt-1">Explora la tienda y agrega tu mercancía favorita.</p>
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
                            className="flex gap-4 p-4 bg-[#141a17] border border-white/15 hover:border-amber-honey/40 rounded-2xl relative overflow-hidden group shadow-md transition-all"
                          >
                            <img
                              src={itemImage}
                              alt={item.product.name}
                              className="w-16 h-16 object-cover rounded-xl shrink-0 border border-white/10"
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-black uppercase tracking-wider truncate mb-1 pr-6 text-white">
                                {item.product.name}
                              </h4>
                              <p className="text-xs text-amber-300 font-black mb-3">
                                ${item.product.price} MXN
                              </p>

                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.product.id, -1)}
                                  className="w-7 h-7 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg flex items-center justify-center text-white transition-colors font-bold active:scale-95"
                                  aria-label="Disminuir cantidad"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="text-xs font-mono font-black text-white px-1">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.product.id, 1)}
                                  className="w-7 h-7 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg flex items-center justify-center text-white transition-colors font-bold active:scale-95"
                                  aria-label="Aumentar cantidad"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeFromCart(item.product.id)}
                              className="absolute top-4 right-4 text-neutral-400 hover:text-red-400 transition-colors p-1"
                              aria-label="Eliminar producto"
                            >
                              <Trash2 size={15} />
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
                        <label className="text-[9px] text-neutral-300 uppercase tracking-widest font-bold block pl-1">
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
                            className="w-full bg-[#121614] border border-white/20 rounded-xl pl-9 pr-3 py-3 text-xs text-white placeholder-neutral-500 outline-none focus:border-amber-honey transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-300 uppercase tracking-widest font-bold block pl-1">
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
                            className="w-full bg-[#121614] border border-white/20 rounded-xl pl-9 pr-3 py-3 text-xs text-white placeholder-neutral-500 outline-none focus:border-amber-honey transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Teléfono y Código Postal */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-300 uppercase tracking-widest font-bold block pl-1">
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
                            className="w-full bg-[#121614] border border-white/20 rounded-xl pl-9 pr-3 py-3 text-xs text-white placeholder-neutral-500 outline-none focus:border-amber-honey transition-all font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-amber-300 uppercase tracking-widest font-bold block pl-1 flex items-center justify-between">
                          <span>Código Postal (5 Dígitos) *</span>
                          {quotingShipping && <span className="text-[8px] animate-pulse text-amber-400">Cotizando...</span>}
                        </label>
                        <div className="relative">
                          <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-3.5 h-3.5" />
                          <input
                            type="text"
                            required
                            maxLength={5}
                            value={postalCode}
                            onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="Ej. 83000"
                            className="w-full bg-[#121614] border border-amber-honey/50 rounded-xl pl-9 pr-3 py-3 text-xs text-white placeholder-neutral-500 outline-none focus:border-amber-honey transition-all font-mono font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Selector de Tarifas de Envío */}
                    {shippingRates.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <label className="text-[9px] text-neutral-300 uppercase tracking-widest font-bold block pl-1 flex items-center gap-1.5">
                          <Truck size={12} className="text-amber-400" /> Paquetería y Método de Envío
                        </label>
                        <div className="space-y-2">
                          {shippingRates.map((rate) => (
                            <div
                              key={rate.id}
                              onClick={() => setSelectedRate(rate)}
                              className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                                selectedRate?.id === rate.id
                                  ? 'border-amber-honey bg-amber-honey/10 text-white shadow-lg shadow-amber-honey/15'
                                  : 'border-white/15 bg-white/[0.04] text-neutral-300 hover:border-white/30'
                              }`}
                            >
                              <div>
                                <p className="font-extrabold uppercase text-[11px] text-white">{rate.provider}</p>
                                <p className="text-[9px] text-neutral-300">
                                  {rate.service_level_name} • {rate.days}
                                </p>
                              </div>
                              <span className="font-black text-amber-300">${rate.total_price} MXN</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Estado y Ciudad */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-300 uppercase tracking-widest font-bold block pl-1">
                          Estado *
                        </label>
                        <select
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          className="w-full bg-[#121614] border border-white/20 rounded-xl px-3 py-3 text-xs outline-none focus:border-amber-honey text-white"
                        >
                          {MEXICAN_STATES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-300 uppercase tracking-widest font-bold block pl-1">
                          Ciudad / Municipio *
                        </label>
                        <input
                          type="text"
                          required
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="Ciudad"
                          className="w-full bg-[#121614] border border-white/20 rounded-xl px-3 py-3 text-xs text-white placeholder-neutral-500 outline-none focus:border-amber-honey"
                        />
                      </div>
                    </div>

                    {/* Colonia y Dirección */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-neutral-300 uppercase tracking-widest font-bold block pl-1">
                        Colonia / Asentamiento *
                      </label>
                      <input
                        type="text"
                        required
                        value={suburb}
                        onChange={(e) => setSuburb(e.target.value)}
                        placeholder="Colonia o Fraccionamiento"
                        className="w-full bg-[#121614] border border-white/20 rounded-xl px-3 py-3 text-xs text-white placeholder-neutral-500 outline-none focus:border-amber-honey"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-neutral-300 uppercase tracking-widest font-bold block pl-1">
                        Calle y Número Exterior / Interior *
                      </label>
                      <input
                        type="text"
                        required
                        value={streetAndNumber}
                        onChange={(e) => setStreetAndNumber(e.target.value)}
                        placeholder="Av. Principal #123 Int 4"
                        className="w-full bg-[#121614] border border-white/20 rounded-xl px-3 py-3 text-xs text-white placeholder-neutral-500 outline-none focus:border-amber-honey"
                      />
                    </div>

                    {/* Botón de Pago */}
                    <div className="pt-4 space-y-3">
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-amber-400 via-amber-honey to-amber-500 hover:brightness-110 active:scale-95 text-nature-night font-black uppercase tracking-widest text-[11px] py-4 rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-amber-honey/30 border border-amber-300/80 disabled:opacity-50 transition-all"
                      >
                        {loading ? (
                          <div className="w-4 h-4 border-2 border-nature-night/30 border-t-nature-night rounded-full animate-spin" />
                        ) : (
                          <>
                            Proceder al Pago Seguro (${orderTotal} MXN) <ArrowRight size={15} />
                          </>
                        )}
                      </motion.button>

                      <button
                        type="button"
                        onClick={() => setCheckoutStep('cart')}
                        className="w-full border border-white/20 hover:bg-white/10 text-neutral-200 hover:text-white transition-all font-bold uppercase tracking-widest text-[9px] py-3 rounded-xl"
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

                    <div className="w-full p-4 bg-[#141a17] border border-white/15 rounded-2xl text-left space-y-2 mt-4">
                      <div className="flex justify-between text-[10px] uppercase font-bold text-neutral-400">
                        <span>Orden ID:</span>
                        <span className="text-white font-mono">#{orderResult?.order_id}</span>
                      </div>
                      <div className="flex justify-between text-[10px] uppercase font-bold text-neutral-400">
                        <span>Total:</span>
                        <span className="text-amber-300 font-black">${orderResult?.total_amount} MXN</span>
                      </div>
                      <div className="flex justify-between text-[10px] uppercase font-bold text-neutral-400">
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
                      className="w-full bg-white text-black font-black uppercase tracking-widest text-[9px] py-3.5 rounded-xl mt-4 hover:bg-neutral-200 transition-colors"
                    >
                      Continuar en la Tienda
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Cart Footer */}
              {checkoutStep === 'cart' && cart.length > 0 && (
                <div className="border-t border-white/15 pt-4 mt-4 space-y-3">
                  <div className="flex justify-between items-center text-sm font-black uppercase tracking-wider pl-1">
                    <span className="text-neutral-200">Subtotal:</span>
                    <span className="text-amber-300 text-glow text-base font-black">${cartSubtotal} MXN</span>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCheckoutStep('shipping')}
                    className="w-full bg-gradient-to-r from-amber-400 via-amber-honey to-amber-500 hover:brightness-110 active:scale-95 text-nature-night font-black uppercase tracking-widest text-[11px] py-4 rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-amber-honey/30 border border-amber-300/80 transition-all"
                  >
                    Proceder al Envío <ArrowRight size={15} />
                  </motion.button>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
