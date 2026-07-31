import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import api from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Star,
  ArrowRight,
  X,
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  Mail,
  MapPin,
  Globe,
  User,
  ShoppingBag as CartIcon
} from 'lucide-react';
import ThemedSection from '../components/ThemedSection';

const FALLBACK_PRODUCTS = [
  { id: 1, name: 'Vinilo "Eclipse" Edición Limitada', price: 850, image: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=500&q=80', category: { name: 'Música' } },
  { id: 2, name: 'Hoodie Ms Ambar Black Onyx', price: 1200, image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500&q=80', category: { name: 'Ropa' } },
  { id: 3, name: 'T-Shirt Gira Mundial 2026', price: 550, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80', category: { name: 'Ropa' } },
  { id: 4, name: 'Poster Autografiado Numerado', price: 400, image: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=500&q=80', category: { name: 'Arte' } },
];

export default function MerchPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<{ product: any; quantity: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'shipping' | 'success'>('cart');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shipping Form State
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Argentina');
  const [orderResult, setOrderResult] = useState<any>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get('/shop/products/');
        if (res.data && res.data.length > 0) {
          setProducts(res.data);
        } else {
          setProducts(FALLBACK_PRODUCTS);
        }
      } catch (e) {
        console.warn("Using fallback merchandise products due to backend API offline:", e);
        setProducts(FALLBACK_PRODUCTS);
      }
    };
    fetchProducts();

    // Auto-fill email if user is logged in
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.email) setEmail(user.email);
      } catch (e) { }
    }
  }, []);

  const addToCart = (product: any) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { product, quantity: 1 }];
    });
    setIsCartOpen(true);
    setCheckoutStep('cart');
  };

  const updateQuantity = (productId: number, amount: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + amount;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
  };

  const cartTotal = cart.reduce((total, item) => total + item.product.price * item.quantity, 0);
  const cartItemsCount = cart.reduce((total, item) => total + item.quantity, 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const itemsPayload = cart.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity
    }));

    try {
      const res = await api.post('/shop/checkout/', {
        email,
        full_name: fullName,
        address,
        city,
        country,
        items: itemsPayload
      });

      setOrderResult(res.data);
      setCart([]);
      setCheckoutStep('success');
    } catch (err: any) {
      console.error("Checkout failed", err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError("Error de comunicación. Intenta de nuevo en unos momentos.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedSection sectionKey="tienda" className="selection:bg-amber-honey/30 min-h-screen relative">
      <Head>
        <title>Ms Ambar | Tienda</title>
      </Head>

      {/* Floating Cart Button */}
      {cartItemsCount > 0 && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-8 right-8 z-[90] w-16 h-16 bg-amber-honey rounded-full flex items-center justify-center text-nature-night shadow-2xl shadow-amber-honey/40 border border-amber-honey/20"
        >
          <CartIcon size={24} />
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-white border border-nature-night text-nature-night rounded-full text-[10px] font-black flex items-center justify-center">
            {cartItemsCount}
          </span>
        </motion.button>
      )}

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 pb-20 pt-10">
        {/* Categories Bar */}
        <div className="flex flex-wrap justify-center gap-4 sm:gap-10 mb-16 md:mb-24 amber-glass px-6 sm:px-10 py-4 sm:py-6 rounded-3xl sm:rounded-full w-full sm:w-fit mx-auto text-[10px] uppercase font-black tracking-[0.3em]">
          <button className="text-amber-honey text-glow">Todos</button>
          <button className="opacity-40 hover:opacity-100 transition-all">Música</button>
          <button className="opacity-40 hover:opacity-100 transition-all">Ropa</button>
          <button className="opacity-40 hover:opacity-100 transition-all">Arte</button>
        </div>

        <header className="mb-16 md:mb-24 text-center">
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-5xl sm:text-7xl md:text-9xl font-black tracking-tighter"
          >
            TIEN<span className="text-amber-honey text-glow">DA</span>
          </motion.h1>
          <p className="opacity-40 mt-4 text-[10px] font-bold uppercase tracking-[0.5em]">Colección Curada 2026</p>
        </header>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-10">
          {products.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group cursor-pointer"
            >
              <div className="aspect-[4/5] rounded-[3rem] overflow-hidden relative mb-8 amber-glass border-2 border-transparent group-hover:border-amber-honey/20 transition-all p-3">
                <div className="w-full h-full rounded-[2.2rem] overflow-hidden relative">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-90 group-hover:opacity-100" />
                  <div className="absolute inset-0 bg-gradient-to-t from-nature-night/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => addToCart(product)}
                      className="w-16 h-16 bg-amber-honey rounded-full flex items-center justify-center text-nature-night shadow-2xl shadow-amber-honey/40"
                    >
                      <ShoppingBag size={28} />
                    </motion.button>
                  </div>
                </div>
              </div>

              <div className="px-4">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest group-hover:text-amber-honey transition-colors leading-tight max-w-[70%]">{product.name}</h3>
                  <span className="font-black text-sm text-amber-honey">${product.price}</span>
                </div>
                <span className="text-[9px] font-bold opacity-30 uppercase tracking-[0.3em]">
                  {product.category?.name || product.category || 'Merch'}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Shopping Cart Side Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            {/* Drawer Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-[#000] z-[95]"
            />

            {/* Slide-out Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#070707] border-l border-white/10 z-[100] p-6 md:p-8 flex flex-col justify-between overflow-y-auto font-sans text-white shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-wider">Tu Carrito</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Resumen de tu Pedido</p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-white/60 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Steps Rendering */}
              <div className="flex-1 overflow-y-auto pr-1">
                {checkoutStep === 'cart' && (
                  <div className="space-y-4">
                    {cart.length === 0 ? (
                      <div className="text-center py-16 flex flex-col items-center gap-4">
                        <ShoppingBag size={48} className="text-white/20" />
                        <p className="text-sm text-white/40 font-bold uppercase tracking-widest">El carrito está vacío</p>
                      </div>
                    ) : (
                      cart.map((item) => (
                        <div key={item.product.id} className="flex gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl relative overflow-hidden group">
                          <img src={item.product.image} className="w-16 h-16 object-cover rounded-xl shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-black uppercase tracking-wider truncate mb-1 pr-4">{item.product.name}</h4>
                            <p className="text-xs text-amber-honey font-bold mb-3">${item.product.price}</p>

                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => updateQuantity(item.product.id, -1)}
                                className="w-7 h-7 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center text-white/60 hover:text-white transition-colors"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="text-xs font-black">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.product.id, 1)}
                                className="w-7 h-7 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center text-white/60 hover:text-white transition-colors"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>

                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="absolute top-4 right-4 text-white/30 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {checkoutStep === 'shipping' && (
                  <form onSubmit={handleCheckout} className="space-y-4">
                    <span className="text-[9px] text-amber-500 uppercase tracking-widest font-black block mb-2">Paso 2: Detalles de Entrega</span>

                    {error && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider">
                        {error}
                      </div>
                    )}

                    {/* Email Input */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-white/50 uppercase tracking-widest font-bold block pl-1">Correo de Contacto</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="nombre@correo.com"
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-xs outline-none focus:border-amber-500 transition-all font-semibold"
                        />
                      </div>
                    </div>

                    {/* Recipient Full Name */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-white/50 uppercase tracking-widest font-bold block pl-1">Nombre Completo del Destinatario</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Juan Pérez"
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-xs outline-none focus:border-amber-500 transition-all font-semibold"
                        />
                      </div>
                    </div>

                    {/* Shipping Address */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-white/50 uppercase tracking-widest font-bold block pl-1">Dirección de Entrega</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-4 text-white/30 w-4 h-4" />
                        <textarea
                          required
                          rows={2}
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Calle Falsa 123, Depto 4B"
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-xs outline-none focus:border-amber-500 transition-all font-semibold"
                        />
                      </div>
                    </div>

                    {/* City */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-white/50 uppercase tracking-widest font-bold block pl-1">Ciudad</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
                        <input
                          type="text"
                          required
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="Buenos Aires"
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-xs outline-none focus:border-amber-500 transition-all font-semibold"
                        />
                      </div>
                    </div>

                    {/* Country */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-white/50 uppercase tracking-widest font-bold block pl-1">País</label>
                      <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
                        <input
                          type="text"
                          required
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          placeholder="Argentina"
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-xs outline-none focus:border-amber-500 transition-all font-semibold"
                        />
                      </div>
                    </div>

                    {/* Actions Inside Form */}
                    <div className="pt-4 space-y-3">
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-[10px] py-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(245,158,11,0.15)] disabled:opacity-50"
                      >
                        {loading ? (
                          <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        ) : (
                          <>Confirmar y Pagar Compra <ArrowRight size={14} /></>
                        )}
                      </motion.button>

                      <button
                        type="button"
                        onClick={() => setCheckoutStep('cart')}
                        className="w-full border border-white/10 hover:bg-white/5 text-white/60 hover:text-white transition-all font-bold uppercase tracking-widest text-[9px] py-3.5 rounded-xl"
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
                    className="py-10 text-center flex flex-col items-center gap-5"
                  >
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 animate-bounce">
                      <CheckCircle size={40} />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-wider italic">¡Pedido Completado!</h3>
                    <p className="text-xs text-white/60 leading-relaxed px-4">
                      Tu orden ha sido registrada en el sistema de Ms Ambar. Generando el pedido para el despacho logístico.
                    </p>

                    <div className="w-full p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-left space-y-2 mt-4">
                      <div className="flex justify-between text-[10px] uppercase font-bold text-white/40">
                        <span>Orden ID:</span>
                        <span className="text-white font-mono">#{orderResult?.order_id}</span>
                      </div>
                      <div className="flex justify-between text-[10px] uppercase font-bold text-white/40">
                        <span>Total Abonado:</span>
                        <span className="text-amber-honey">${orderResult?.total_amount}</span>
                      </div>
                      <div className="flex justify-between text-[10px] uppercase font-bold text-white/40">
                        <span>Estado:</span>
                        <span className="text-green-400 font-extrabold uppercase tracking-widest">{orderResult?.status}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setIsCartOpen(false);
                        setCheckoutStep('cart');
                      }}
                      className="w-full bg-white text-black font-black uppercase tracking-widest text-[9px] py-3.5 rounded-xl mt-6"
                    >
                      Continuar Navegando
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Cart Footer */}
              {checkoutStep === 'cart' && cart.length > 0 && (
                <div className="border-t border-white/10 pt-4 mt-6 space-y-4">
                  <div className="flex justify-between items-center text-sm font-black uppercase tracking-wider pl-1">
                    <span>Subtotal:</span>
                    <span className="text-amber-honey text-glow text-lg">${cartTotal}</span>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCheckoutStep('shipping')}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-[10px] py-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(245,158,11,0.15)]"
                  >
                    Proceder al Envío <ArrowRight size={14} />
                  </motion.button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ThemedSection>
  );
}
