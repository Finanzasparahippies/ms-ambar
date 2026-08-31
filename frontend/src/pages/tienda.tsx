import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import api from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  ShoppingBag as CartIcon,
  Sparkles
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Swal from 'sweetalert2';
import ThemedSection from '../components/ThemedSection';
import ProductCard from '../components/ProductCard';
import ProductFormModal from '../components/ProductFormModal';
import ImageOptimizerWidget, { OptimizationMetrics } from '../components/ImageOptimizerWidget';
import { Product, Category, ProductSpecification } from '../types';
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
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Modales de Administración
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [isOptimizerModalOpen, setIsOptimizerModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Carrito Global
  const { addToCart, openCart, cartItemsCount } = useCart();

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
          onClick={openCart}
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
    </ThemedSection>
  );
}
