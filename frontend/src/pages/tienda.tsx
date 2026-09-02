import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import api from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  ShoppingBag as CartIcon,
  Sparkles,
  Search,
  SlidersHorizontal,
  X,
  Truck,
  ShieldCheck,
  Disc,
  Quote,
  ChevronDown
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Swal from 'sweetalert2';
import ThemedSection from '../components/ThemedSection';
import ProductCard from '../components/ProductCard';
import ProductFormModal from '../components/ProductFormModal';
import ImageOptimizerWidget from '../components/ImageOptimizerWidget';
import { Product, Category } from '../types';
import { useCart } from '../context/CartContext';

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

export default function TiendaPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Filtros y Búsqueda
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'name'>('featured');
  const [isManifestoExpanded, setIsManifestoExpanded] = useState<boolean>(false);

  // Modales de Administración
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [isOptimizerModalOpen, setIsOptimizerModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Carrito Global
  const { addToCart, openCart, cartItemsCount } = useCart();

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/shop/products/');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setProducts(res.data);
      } else {
        setProducts(FALLBACK_PRODUCTS);
      }
    } catch (e) {
      console.warn("Using fallback merchandise products due to backend API offline:", e);
      setProducts(FALLBACK_PRODUCTS);
    } finally {
      setLoading(false);
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
  }, []);

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
      confirmButtonColor: '#8B5CF6',
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

  // Extraer lista unificada de categorías con recuento dinámico
  const categoryFilters = useMemo(() => {
    const list = ['Todos'];
    const catMap = new Map<string, number>();
    catMap.set('Todos', products.length);

    products.forEach((p) => {
      const name =
        p.category_name ||
        (typeof p.category === 'object' && p.category?.name ? p.category.name : undefined) ||
        (typeof p.category === 'string' ? p.category : undefined) ||
        'Otros';
      catMap.set(name, (catMap.get(name) || 0) + 1);
      if (!list.includes(name)) {
        list.push(name);
      }
    });

    return { list, catMap };
  }, [products]);

  // Filtrado y ordenamiento en tiempo real
  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        // Filtro por categoría
        if (selectedCategory !== 'Todos') {
          const catName =
            product.category_name ||
            (typeof product.category === 'object' && product.category?.name ? product.category.name : undefined) ||
            (typeof product.category === 'string' ? product.category : undefined) ||
            'Otros';
          if (catName.toLowerCase() !== selectedCategory.toLowerCase()) {
            return false;
          }
        }
        // Filtro por búsqueda
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          const matchName = product.name?.toLowerCase().includes(q);
          const matchDesc = product.description?.toLowerCase().includes(q);
          if (!matchName && !matchDesc) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const priceA = Number(a.price) || 0;
        const priceB = Number(b.price) || 0;
        if (sortBy === 'price-asc') return priceA - priceB;
        if (sortBy === 'price-desc') return priceB - priceA;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return 0; // featured / default
      });
  }, [products, selectedCategory, searchQuery, sortBy]);

  return (
    <ThemedSection sectionKey="tienda" className="selection:bg-purple-500/30 min-h-screen relative overflow-hidden">
      <Head>
        <title>Ms Ambar | Tienda Oficial</title>
        <meta name="description" content="Tienda oficial de mercancía exclusiva, vinilos y arte conceptual de Ms Ambar." />
      </Head>
      <Toaster position="bottom-right" />

      {/* Ambient Lighting & Luxury Violet / Obsidian Mesh Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-64 right-[-10%] w-[450px] h-[350px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-96 left-[-10%] w-[450px] h-[350px] bg-purple-900/10 rounded-full blur-[130px] pointer-events-none -z-10" />

      {/* Floating Cart Button */}
      {cartItemsCount > 0 && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={openCart}
          className="fixed bottom-8 right-8 z-[90] w-16 h-16 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-full flex items-center justify-center text-white shadow-2xl shadow-purple-600/40 border border-purple-400/40 hover:brightness-110 transition-all duration-300"
          aria-label="Abrir carrito"
        >
          <CartIcon size={24} className="stroke-[2.2]" />
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 text-black rounded-full text-[11px] font-black flex items-center justify-center shadow-md">
            {cartItemsCount}
          </span>
        </motion.button>
      )}

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 pt-28 md:pt-36 pb-24">
        {/* Encabezado Principal y Branding */}
        <header className="mb-12 text-center max-w-4xl mx-auto relative">
          {/* Top Boutique Pill Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/40 border border-purple-500/30 text-purple-300 text-[10px] md:text-xs font-black uppercase tracking-[0.25em] mb-4 shadow-[0_0_20px_rgba(139,92,246,0.15)] backdrop-blur-md"
          >
            <Sparkles size={13} className="text-purple-400 animate-pulse" />
            <span>Boutique Oficial & Arte Conceptual</span>
          </motion.div>

          {/* Hero Typography with Purple Glowing Brand Accent */}
          <motion.h1
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter uppercase italic leading-none mb-3"
          >
            TIEN<span className="bg-gradient-to-r from-purple-400 via-violet-300 to-indigo-300 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(139,92,246,0.4)]">DA</span>
          </motion.h1>

          <p className="text-neutral-400 uppercase tracking-[0.35em] text-[10px] md:text-xs font-semibold mb-8 max-w-xl mx-auto">
            Colección Oficial de Ms Ambar
          </p>

          {/* Admin Control Bar */}
          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap items-center justify-center gap-3 mb-10 p-2.5 rounded-2xl bg-purple-950/30 border border-purple-500/30 backdrop-blur-md max-w-fit mx-auto"
            >
              <button
                onClick={handleOpenAddProduct}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black px-5 py-2.5 rounded-xl text-xs uppercase tracking-[0.18em] flex items-center gap-2 transition-all hover:scale-105 shadow-lg shadow-purple-600/30 border border-purple-400/40"
              >
                <Plus size={15} />
                Agregar Producto
              </button>

              <button
                onClick={() => setIsOptimizerModalOpen(true)}
                className="bg-white/[0.06] hover:bg-purple-600/20 border border-purple-500/40 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.18em] flex items-center gap-2 text-purple-300 hover:text-white transition-all hover:scale-105 shadow-md backdrop-blur-md"
              >
                <Sparkles size={15} />
                Optimizar Imágenes
              </button>
            </motion.div>
          )}

          {/* Value Props Strip (Luxury Ecommerce Standard) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 my-8 max-w-4xl mx-auto">
            <div className="p-3.5 rounded-2xl bg-[#0C0F0D]/60 border border-white/[0.06] backdrop-blur-md flex items-center gap-3 text-left">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <Truck size={18} />
              </div>
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-white">Envíos Seguros</h4>
                <p className="text-[10px] text-neutral-400">A Todo México</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#0C0F0D]/60 border border-white/[0.06] backdrop-blur-md flex items-center gap-3 text-left">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <Disc size={18} />
              </div>
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-white">100% Auténtico</h4>
                <p className="text-[10px] text-neutral-400">Ediciones limitadas</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#0C0F0D]/60 border border-white/[0.06] backdrop-blur-md flex items-center gap-3 text-left">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-white">Compra Segura</h4>
                <p className="text-[10px] text-neutral-400">Cifrado de alta fidelidad</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#0C0F0D]/60 border border-white/[0.06] backdrop-blur-md flex items-center gap-3 text-left">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <Sparkles size={18} />
              </div>
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-white">Música Libre</h4>
                <p className="text-[10px] text-neutral-400">Apoyo directo a la artista</p>
              </div>
            </div>
          </div>

          {/* Manifiesto Institucional de la Artista (Editorial Accordion Card) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="relative p-6 sm:p-8 rounded-[2rem] bg-[#0C0F0D]/80 border border-purple-500/20 hover:border-purple-500/40 transition-all backdrop-blur-xl shadow-2xl text-left overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <Quote size={18} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-purple-300 block">
                    Manifiesto de la Artista
                  </span>
                  <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white">
                    « ¡Qué acto más punk que consumir arte! »
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsManifestoExpanded((prev) => !prev)}
                className="self-start sm:self-auto px-4 py-1.5 rounded-full bg-white/[0.05] hover:bg-purple-600/20 border border-white/10 hover:border-purple-500/40 text-neutral-300 hover:text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
              >
                <span>{isManifestoExpanded ? 'Menos' : 'Leer Manifiesto'}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 ${isManifestoExpanded ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            <AnimatePresence>
              {isManifestoExpanded ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="pt-4 space-y-3 text-xs sm:text-sm text-neutral-300 font-light leading-relaxed"
                >
                  <p>
                    Nadie me dijo que dedicarse a hacer canciones también significaba aprender a hacer tantas otras cosas… Mientras intento escribir la siguiente canción, encontrar un nuevo concepto y descubrir cómo trascender entre tanta música y tantas cosas bellas que existen en el mundo… también estoy pensando en cómo seguir sosteniendo este sueño.
                  </p>
                  <p>
                    Y de ahí nace esta mercancía. Hecha desde Hermosillo, Sonora, creada principalmente para representar algo. Esta energía llegará a convertirse en nuevas canciones libres.
                  </p>
                  <p className="italic text-purple-200">
                    Gracias por darle play. Que la música nos siga uniendo, porque de la guerra y del amor nos curamos con canciones.
                  </p>
                  <div className="pt-2 text-right">
                    <span className="inline-block text-xs font-black uppercase tracking-[0.25em] text-purple-300 border-b border-purple-500/40 pb-0.5">
                      — Ms. Ambar
                    </span>
                  </div>
                </motion.div>
              ) : (
                <p className="pt-3 text-xs text-neutral-400 line-clamp-1 italic">
                  "Nadie me dijo que dedicarse a hacer canciones también significaba aprender a hacer tantas otras cosas... Gracias por apoyar este proyecto independiente."
                </p>
              )}
            </AnimatePresence>
          </motion.div>
        </header>

        {/* Barra de Filtros, Búsqueda y Ordenamiento */}
        <div className="mb-10 space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {categoryFilters.list.map((cat) => {
                const count = categoryFilters.catMap.get(cat) || 0;
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-1.5 ${isSelected
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400/50 scale-105'
                      : 'bg-[#0C0F0D]/70 border border-white/[0.08] text-neutral-400 hover:text-white hover:border-purple-500/30'
                      }`}
                  >
                    <span>{cat}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-black/40 text-purple-200' : 'bg-white/[0.08] text-neutral-400'
                        }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input & Sort Selector */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              {/* Search Bar */}
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={15} />
                <input
                  type="text"
                  placeholder="Buscar artículos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0C0F0D]/80 border border-white/[0.08] focus:border-purple-500/50 rounded-full pl-9 pr-8 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none transition-all shadow-inner"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Sort Selector */}
              <div className="relative shrink-0">
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="bg-[#0C0F0D]/80 border border-white/[0.08] focus:border-purple-500/50 rounded-full px-4 py-2 text-xs text-neutral-200 focus:outline-none transition-all cursor-pointer font-semibold uppercase tracking-wider"
                >
                  <option value="featured">Destacados</option>
                  <option value="price-asc">Precio: Menor a Mayor</option>
                  <option value="price-desc">Precio: Mayor a Menor</option>
                  <option value="name">Nombre: A - Z</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results Summary Bar */}
          <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
            <span>
              Mostrando <strong className="text-white">{filteredProducts.length}</strong> artículos exclusivos
            </span>
            {(selectedCategory !== 'Todos' || searchQuery !== '') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('Todos');
                  setSearchQuery('');
                }}
                className="text-purple-400 hover:text-purple-300 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 transition-colors"
              >
                <X size={12} />
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Product Grid / Empty State */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
            {filteredProducts.map((product, i) => (
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
        ) : (
          <div className="py-20 text-center p-8 rounded-[2rem] bg-[#0C0F0D]/60 border border-white/[0.06] max-w-md mx-auto">
            <div className="w-14 h-14 rounded-full bg-purple-950/40 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto mb-4">
              <Search size={24} />
            </div>
            <h3 className="text-lg font-black uppercase tracking-wider text-white mb-2">
              No se encontraron artículos
            </h3>
            <p className="text-xs text-neutral-400 mb-6">
              No hay productos que coincidan con los filtros seleccionados.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('Todos');
                setSearchQuery('');
              }}
              className="px-6 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-wider transition-all"
            >
              Ver todos los productos
            </button>
          </div>
        )}
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
    </ThemedSection>
  );
}
