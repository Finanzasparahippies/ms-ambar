import React, { useState, useEffect, useRef, ChangeEvent, DragEvent } from 'react';
import Head from 'next/head';
import api from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  ArrowRight,
  X,
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  Mail,
  User,
  Phone,
  Truck,
  Package,
  ShoppingBag as CartIcon,
  Sparkles,
  Pencil,
  Upload,
  Image as ImageIcon,
  Loader2,
  Check,
  Tag,
  Sliders,
  AlertCircle,
  Star,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Swal from 'sweetalert2';
import ThemedSection from '../components/ThemedSection';
import ProductCard from '../components/ProductCard';
import ProductFormModal from '../components/ProductFormModal';
import ImageOptimizerWidget, { OptimizationMetrics } from '../components/ImageOptimizerWidget';
import { Product, Category, ProductSpecification } from '../types';

const FALLBACK_PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Vinilo "Eclipse" Edición Limitada',
    slug: 'vinilo-eclipse-edicion-limitada',
    price: 850,
    stock: 12,
    is_active: true,
    image: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=500&q=80',
    images: [
      'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=500&q=80',
      'https://images.unsplash.com/photo-1539185441755-769473a23570?w=500&q=80',
      'https://images.unsplash.com/photo-1542208998-f6dbbb27a72f?w=500&q=80'
    ],
    description: 'Prensaje especial en vinilo negro de 180 gramos con insert autografiado y arte conceptual.',
    detailed_description: 'Edición para coleccionistas masterizada a partir de las cintas análogas originales. Incluye funda protectora antiestática y libreto de 12 páginas con letras y fotografías inéditas.',
    specifications: {
      material: 'Vinilo virgen pesado de 180g (High Fidelity)',
      dimensions: '12 pulgadas (31.2 x 31.2 cm)',
      weight: '420 g',
      origin: 'Hecho en México / Edición Sonora',
      care_instructions: 'Almacenar en posición vertical lejos de fuentes directas de calor y luz solar.'
    },
    category: { name: 'Música' },
    category_name: 'Música'
  },
  {
    id: 2,
    name: 'Hoodie Ms Ambar Black Onyx',
    slug: 'hoodie-ms-ambar-black-onyx',
    price: 1200,
    stock: 8,
    is_active: true,
    image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500&q=80',
    images: [
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500&q=80',
      'https://images.unsplash.com/photo-1578768079052-aa76e520036c?w=500&q=80',
      'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=500&q=80'
    ],
    description: 'Sudadera premium corte oversize con bordado en relieve frontal y estampado en serigrafía.',
    detailed_description: 'Confeccionada con felpa suave de alto gramaje para máxima durabilidad y calidez. Capucha forrada y cordones con terminales metálicas personalizadas.',
    specifications: {
      material: '80% Algodón Peinado, 20% Poliéster Reciclado (380 GSM)',
      dimensions: 'Corte Oversize Unisex (S, M, L, XL)',
      weight: '680 g',
      origin: 'Confeccionado en Hermosillo, Sonora',
      care_instructions: 'Lavar con agua fría, no usar blanqueador, secar a la sombra del revés.'
    },
    category: { name: 'Ropa' },
    category_name: 'Ropa'
  },
  {
    id: 3,
    name: 'Playera Oficial Ms Ambar 100% Algodón',
    slug: 'playera-oficial-ms-ambar-algodon',
    price: 550,
    stock: 25,
    is_active: true,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80',
    images: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80',
      'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=500&q=80'
    ],
    description: 'Playera conmemorativa 100% algodón, confeccionada para apoyar el arte y la música independiente.',
    detailed_description: 'Hecha desde Hermosillo, Sonora. Una prenda creada para representar la resistencia cultural y el sueño de seguir creando canciones libres.',
    specifications: {
      material: '100% Algodón Premium 240g',
      dimensions: 'Corte Regular Unisex (XS, S, M, L, XL)',
      weight: '220 g',
      origin: 'Hermosillo, Sonora, México',
      care_instructions: 'Lavar a mano o máquina en ciclo delicado, planchar por el reverso del estampado.'
    },
    category: { name: 'Ropa' },
    category_name: 'Ropa'
  },
  {
    id: 4,
    name: 'Poster Autografiado y Numerado',
    slug: 'poster-autografiado-numerado',
    price: 400,
    stock: 15,
    is_active: true,
    image: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=500&q=80',
    images: [
      'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=500&q=80',
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=500&q=80'
    ],
    description: 'Impresión litográfica en papel de bellas artes de 300g, firmada individualmente por Ms. Ambar.',
    detailed_description: 'Tiraje estrictamente numerado de 100 ejemplares con certificado de autenticidad en sello seco.',
    specifications: {
      material: 'Papel Art Print Texturado 300g libre de ácido',
      dimensions: '50 x 70 cm (Medida estándar para enmarcar)',
      weight: '150 g',
      origin: 'Edición limitada de taller artístico',
      care_instructions: 'Manipular por los bordes. Enmarcar con cristal UV para proteger los pigmentos.'
    },
    category: { name: 'Arte' },
    category_name: 'Arte'
  }
];

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

// Generador de Slugs Limpios y SEO amigables
const slugifyText = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^a-z0-9 -]/g, '') // Quitar caracteres inválidos
    .replace(/\s+/g, '-') // Espacios a guiones
    .replace(/-+/g, '-'); // Múltiples guiones a uno
};

export default function TiendaPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'shipping' | 'success'>('cart');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Modales de Administración
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [isOptimizerModalOpen, setIsOptimizerModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

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

  const fetchProducts = async () => {
    try {
      const res = await api.get('/shop/products/');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setProducts(res.data);
      } else {
        setProducts(FALLBACK_PRODUCTS);
      }
    } catch (e) {
      console.warn("Using fallback merchandise products due to backend API offline:", e);
      setProducts(FALLBACK_PRODUCTS);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/shop/categories/');
      if (res.data && Array.isArray(res.data)) {
        setCategories(res.data);
      }
    } catch (e) {
      console.warn("Error fetching categories:", e);
    }
  };

  const checkAdminStatus = () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64));
        if (payload && (payload.is_staff || payload.is_superuser) && !(payload.exp && Date.now() / 1000 > payload.exp)) {
          setIsAdmin(true);
          return;
        }
      } catch (e) { }
    }
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u && (u.is_staff || u.is_superuser)) {
          setIsAdmin(true);
        }
      } catch (e) { }
    }
  };

  useEffect(() => {
    checkAdminStatus();
    fetchProducts();
    fetchCategories();

    // Auto-completar datos si el usuario tiene sesión activa
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.email) setEmail(user.email);
        if (user.first_name || user.last_name) {
          setFullName(`${user.first_name || ''} ${user.last_name || ''}`.trim());
        }
      } catch (e) { }
    }
  }, []);

  // Escuchar cambios en el Código Postal para cotización automática en tiempo real
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
          const matchedState = MEXICAN_STATES.find((s) =>
            s.toLowerCase().includes(lookupRes.data.state_name.toLowerCase()) ||
            lookupRes.data.state_name.toLowerCase().includes(s.toLowerCase())
          );
          if (matchedState) setState(matchedState);
        }
      } catch (e) { }

      const quoteRes = await api.post('/shop/shipping/quote/', {
        postal_code: cp,
        weight_kg: 1.0
      });

      if (quoteRes.data?.rates && quoteRes.data.rates.length > 0) {
        setShippingRates(quoteRes.data.rates);
        setSelectedRate(quoteRes.data.rates[0]);
      }
    } catch (err: any) {
      console.warn("Fallo al cotizar paquetería, usando tarifa estándar de respaldo:", err);
      const fallbackRate: ShippingRate = {
        id: 'rate_std_fallback',
        provider: 'Estándar Nacional (FedEx / Estafeta)',
        service_level_name: 'Terrestre Estándar',
        total_price: 150.0,
        currency: 'MXN',
        days: '3 a 5 días hábiles',
        is_fallback: true
      };
      setShippingRates([fallbackRate]);
      setSelectedRate(fallbackRate);
    } finally {
      setQuotingShipping(false);
    }
  };

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  };

  const handleProductSaved = (savedProduct: Product, isNew: boolean) => {
    if (isNew) {
      setProducts(prev => [savedProduct, ...prev]);
    } else {
      setProducts(prev => prev.map(p => (p.id === savedProduct.id ? savedProduct : p)));
    }
    fetchProducts();
  };

  // Eliminación de Producto con Confirmación SweetAlert2 y Revalidación Reactiva
  const handleDeleteProduct = async (product: Product) => {
    const result = await Swal.fire({
      title: '¿Eliminar Producto?',
      text: `¿Estás seguro de que deseas eliminar "${product.name}" de la tienda?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#E5A93B',
      cancelButtonColor: 'rgba(255,255,255,0.08)',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#0B0F0D',
      color: '#F4F6F0',
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/shop/products/${product.id}/`);
        setProducts(prev => prev.filter(p => p.id !== product.id));
        toast.success(`"${product.name}" ha sido eliminado.`);
        fetchProducts();
      } catch (err: any) {
        console.error('Error eliminando producto:', err);
        toast.error('No se pudo eliminar el producto del servidor.');
      }
    }
  };

  const addToCart = (product: Product, quantityToAdd: number = 1) => {
    const qty = Math.max(1, quantityToAdd);
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + qty } : item
        );
      }
      return [...prevCart, { product, quantity: qty }];
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

  const cartSubtotal = cart.reduce(
    (total, item) => total + (typeof item.product.price === 'number' ? item.product.price : parseFloat(item.product.price as string) || 0) * item.quantity,
    0
  );
  const shippingCost = selectedRate ? selectedRate.total_price : 150;
  const orderTotal = cartSubtotal + (cart.length > 0 ? shippingCost : 0);
  const cartItemsCount = cart.reduce((total, item) => total + item.quantity, 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanCp = postalCode.replace(/\D/g, '');
    if (cleanCp.length !== 5) {
      setError("Por favor ingresa un Código Postal válido de 5 dígitos.");
      setLoading(false);
      return;
    }

    const itemsPayload = cart.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity
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
        items: itemsPayload
      });

      if (res.data?.checkout_url) {
        if (res.data.checkout_url.includes('checkout.stripe.com')) {
          window.location.href = res.data.checkout_url;
          return;
        } else {
          setOrderResult({
            order_id: res.data.order_id,
            total_amount: orderTotal,
            status: 'Confirmado (Modo Desarrollo)'
          });
          setCart([]);
          setCheckoutStep('success');
        }
      }
    } catch (err: any) {
      console.error("Checkout failed", err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError("Error de comunicación con la pasarela. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <ThemedSection sectionKey="tienda" className="selection:bg-amber-honey/30 min-h-screen relative">
      <Head>
        <title>Ms Ambar | Tienda Oficial</title>
        <meta name="description" content="Tienda oficial de mercancía exclusiva, vinilos y arte conceptual de Ms Ambar." />
      </Head>
      <Toaster position="bottom-right" />

      {/* Floating Cart Button */}
      {cartItemsCount > 0 && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-8 right-8 z-[90] w-16 h-16 bg-amber-honey rounded-full flex items-center justify-center text-nature-night shadow-2xl shadow-amber-honey/40 border border-amber-honey/20"
          aria-label="Abrir carrito"
        >
          <CartIcon size={24} />
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-white border border-nature-night text-nature-night rounded-full text-[10px] font-black flex items-center justify-center">
            {cartItemsCount}
          </span>
        </motion.button>
      )}

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 pb-24 pt-6">
        {/* Encabezado y Barra de Herramientas de Administrador */}
        <header className="mb-12 md:mb-16 text-center max-w-4xl mx-auto relative">
          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tighter mb-4"
          >
            TIEN<span className="text-amber-honey text-glow">DA</span>
          </motion.h1>

          <p className="text-neutral-400 uppercase tracking-[0.4em] text-[10px] md:text-xs font-black mb-8">
            Catálogo Oficial & Mercancía Exclusiva
          </p>

          {/* Admin Control Bar */}
          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap items-center justify-center gap-3 mb-10"
            >
              <button
                onClick={handleOpenAddProduct}
                className="bg-amber-honey text-black hover:bg-amber-400 font-black px-6 py-3 rounded-full text-xs uppercase tracking-[0.2em] flex items-center gap-2 transition-all hover:scale-105 shadow-xl shadow-amber-honey/25 border border-amber-honey/50"
              >
                <Plus size={16} />
                Agregar Producto
              </button>

              <button
                onClick={() => setIsOptimizerModalOpen(true)}
                className="bg-white/[0.08] hover:bg-amber-honey hover:text-black border border-amber-honey/50 px-6 py-3 rounded-full text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 text-amber-honey transition-all hover:scale-105 shadow-lg"
              >
                <Sparkles size={16} />
                Optimizar Imágenes
              </button>
            </motion.div>
          )}

          {/* Manifiesto Institucional de la Artista */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="relative p-6 sm:p-9 md:p-10 rounded-[2.5rem] bg-white/[0.02] border border-white/10 hover:border-amber-honey/30 transition-all backdrop-blur-md shadow-2xl"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 rounded-full bg-[#080c0a] border border-amber-honey/40 text-[9px] font-black uppercase tracking-[0.25em] text-amber-honey shadow-lg">
              Manifiesto de la Artista
            </div>

            <div className="text-center space-y-4 text-white">
              <h2 className="text-lg sm:text-xl md:text-2xl font-black uppercase tracking-wider text-amber-honey text-glow">
                « ¡Qué acto más punk que consumir arte! »
              </h2>

              <p className="text-xs sm:text-sm md:text-[15px] font-normal leading-relaxed text-neutral-200 max-w-2xl mx-auto">
                Nadie me dijo que dedicarse a hacer canciones también significaba aprender a hacer tantas otras cosas… Mientras intento escribir la siguiente canción, encontrar un nuevo concepto y descubrir cómo trascender entre tanta música y tantas cosas bellas que existen en el mundo… también estoy pensando en cómo seguir sosteniendo este sueño.
              </p>

              <p className="text-xs sm:text-sm md:text-[15px] font-normal leading-relaxed text-neutral-200 max-w-2xl mx-auto">
                Y de ahí nace esta mercancía. Hecha desde Hermosillo, Sonora, creada principalmente para representar algo. Esta energía llegará a convertirse en nuevas canciones libres.
              </p>

              <p className="text-xs sm:text-sm md:text-[15px] font-normal leading-relaxed text-neutral-200 max-w-2xl mx-auto italic">
                Gracias por apoyar. Que la música nos siga uniendo, porque de la guerra y del amor nos curamos con canciones.
              </p>

              <div className="pt-2">
                <span className="inline-block text-xs sm:text-sm font-black uppercase tracking-[0.25em] text-amber-honey border-b border-amber-honey/30 pb-1">
                  — Ms. Ambar
                </span>
              </div>
            </div>
          </motion.div>
        </header>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
          {products.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={addToCart}
              index={i}
              isAdmin={isAdmin}
              onEdit={handleOpenEditProduct}
              onDelete={handleDeleteProduct}
            />
          ))}
        </div>
      </div>

      {/* Modal: Crear / Editar Producto */}
      <ProductFormModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        editingProduct={editingProduct}
        categories={categories}
        onProductSaved={handleProductSaved}
      />

      {/* Modal: Motor de Optimización Masiva de Imágenes */}
      <AnimatePresence>
        {isOptimizerModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOptimizerModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scroll z-10"
            >
              <ImageOptimizerWidget
                defaultCategory="Productos"
                onCancel={() => setIsOptimizerModalOpen(false)}
                onSuccess={(metrics) => {
                  toast.success(`Se procesaron ${metrics.processed_count} imágenes exitosamente.`);
                  fetchProducts();
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shopping Cart Side Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            {/* Drawer Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[95]"
            />

            {/* Slide-out Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-[#0c100e] border-l border-white/15 z-[100] p-6 md:p-8 flex flex-col justify-between overflow-y-auto font-sans !text-white shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-5">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-wider !text-white">Tu Carrito</h3>
                  <p className="text-[10px] text-neutral-300 uppercase tracking-widest font-bold">
                    {checkoutStep === 'cart' ? 'Resumen de Selección' : 'Datos de Envío y Facturación'}
                  </p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full text-neutral-300 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Contenido según el paso */}
              <div className="flex-1 overflow-y-auto pr-1">
                {checkoutStep === 'cart' && (
                  <div className="space-y-4">
                    {cart.length === 0 ? (
                      <div className="text-center py-16 flex flex-col items-center gap-4">
                        <ShoppingBag size={48} className="text-neutral-500" />
                        <p className="text-sm text-neutral-300 font-bold uppercase tracking-widest">El carrito está vacío</p>
                      </div>
                    ) : (
                      cart.map((item) => (
                        <div key={item.product.id} className="flex gap-4 p-4 bg-[#141a17] border border-white/15 rounded-2xl relative overflow-hidden group shadow-md">
                          <img src={item.product.image} alt={item.product.name} className="w-16 h-16 object-cover rounded-xl shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-black uppercase tracking-wider truncate mb-1 pr-4 !text-white">{item.product.name}</h4>
                            <p className="text-xs text-amber-300 font-black mb-3">${item.product.price} MXN</p>

                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => updateQuantity(item.product.id, -1)}
                                className="w-7 h-7 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg flex items-center justify-center text-white transition-colors font-bold"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="text-xs font-mono font-black text-white">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.product.id, 1)}
                                className="w-7 h-7 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg flex items-center justify-center text-white transition-colors font-bold"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>

                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="absolute top-4 right-4 text-neutral-400 hover:text-red-400 transition-colors"
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
                    {error && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider">
                        {error}
                      </div>
                    )}

                    {/* Email y Nombre */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-300 uppercase tracking-widest font-bold block pl-1">Correo Electrónico</label>
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
                        <label className="text-[9px] text-neutral-300 uppercase tracking-widest font-bold block pl-1">Nombre Completo</label>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-300 uppercase tracking-widest font-bold block pl-1">Teléfono (WhatsApp)</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-3.5 h-3.5" />
                          <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="10 dígitos"
                            className="w-full bg-[#121614] border border-white/20 rounded-xl pl-9 pr-3 py-3 text-xs text-white placeholder-neutral-500 outline-none focus:border-amber-honey transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-amber-300 uppercase tracking-widest font-bold block pl-1 flex items-center justify-between">
                          <span>Código Postal (5 Dígitos)</span>
                          {quotingShipping && <span className="text-[8px] animate-pulse">Cotizando...</span>}
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
                              className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${selectedRate?.id === rate.id
                                ? 'border-purple-500 bg-purple-950/40 text-white shadow-lg shadow-purple-950/30'
                                : 'border-white/15 bg-white/[0.04] text-neutral-300 hover:border-white/30'
                                }`}
                            >
                              <div>
                                <p className="font-extrabold uppercase text-[11px] text-white">{rate.provider}</p>
                                <p className="text-[9px] text-neutral-300">{rate.service_level_name} • {rate.days}</p>
                              </div>
                              <span className="font-black text-amber-300">${rate.total_price} MXN</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Estado y Ciudad */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-300 uppercase tracking-widest font-bold block pl-1">Estado</label>
                        <select
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          className="w-full bg-[#121614] border border-white/20 rounded-xl px-3 py-3 text-xs outline-none focus:border-amber-honey text-white"
                        >
                          {MEXICAN_STATES.map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-300 uppercase tracking-widest font-bold block pl-1">Ciudad / Municipio</label>
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
                      <label className="text-[9px] text-neutral-300 uppercase tracking-widest font-bold block pl-1">Colonia / Asentamiento</label>
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
                      <label className="text-[9px] text-neutral-300 uppercase tracking-widest font-bold block pl-1">Calle, Número Exterior e Interior</label>
                      <input
                        type="text"
                        required
                        value={streetAndNumber}
                        onChange={(e) => setStreetAndNumber(e.target.value)}
                        placeholder="Av. Hidalgo #123 Int 4"
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
                        className="w-full bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-purple-900/40 border border-purple-400/40 disabled:opacity-50 transition-all"
                      >
                        {loading ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>Proceder al Pago Seguro (${orderTotal} MXN) <ArrowRight size={14} /></>
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
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 animate-bounce">
                      <CheckCircle size={36} />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-wider !text-white">¡Pedido Confirmado!</h3>
                    <p className="text-xs text-neutral-300 leading-relaxed px-4">
                      Tu orden ha sido registrada. Recibirás tu guía de rastreo y confirmación vía correo electrónico.
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
                        <span className="text-green-400 font-extrabold uppercase tracking-widest">{orderResult?.status}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setIsCartOpen(false);
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
                    className="w-full bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-purple-900/40 border border-purple-400/40 transition-all"
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
