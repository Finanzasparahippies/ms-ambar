import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, 
  Ticket, 
  ShoppingBag, 
  Users, 
  Activity, 
  Database, 
  Cpu, 
  HardDrive, 
  Layers, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Gauge, 
  ExternalLink,
  Truck,
  Package,
  Landmark,
  PlusCircle,
  ClipboardList,
  Check,
  MapPin,
  Mail,
  User,
  Plus,
  Trash2,
  Calendar,
  Edit2,
  X,
  Eye,
  EyeOff
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [sysMetrics, setSysMetrics] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);
  
  // Dashboard Navigation State
  const [activeTab, setActiveTab] = useState<'summary' | 'orders' | 'expenses' | 'catalog'>('summary');
  const [orderFilter, setOrderFilter] = useState<'all' | 'paid' | 'shipped' | 'delivered'>('all');

  // Shipment Simulator State
  const [shippingOrderId, setShippingOrderId] = useState<number | null>(null);
  const [shippingStep, setShippingStep] = useState<'idle' | 'contacting' | 'generating' | 'success'>('idle');
  const [simulatedTracking, setSimulatedTracking] = useState('');

  // Add Expense Form State
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Logística & Envío');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseSuccess, setExpenseSuccess] = useState(false);

  // Merchandise Catalog Administration State
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [catalogSubTab, setCatalogSubTab] = useState<'products' | 'categories'>('products');

  // Modals & Active Edit Forms
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Product Form Fields
  const [prodId, setProdId] = useState<number | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodSlug, setProdSlug] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodCategory, setProdCategory] = useState('');
  const [prodIsActive, setProdIsActive] = useState(true);
  const [prodImageFile, setProdImageFile] = useState<File | null>(null);
  const [prodImagePreview, setProdImagePreview] = useState<string | null>(null);

  // Category Form Fields
  const [catId, setCatId] = useState<number | null>(null);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');

  // Catalog Status Notifications
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSuccessMsg, setCatalogSuccessMsg] = useState<string | null>(null);
  const [catalogErrorMsg, setCatalogErrorMsg] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login?redirect=/dashboard');
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch analytics, system metrics, orders, expenses, products, and categories in parallel
      const [analyticsRes, systemRes, ordersRes, expensesRes, productsRes, categoriesRes] = await Promise.all([
        axios.get(`${API_URL}/dashboard/analytics/`, { headers }),
        axios.get(`${API_URL}/dashboard/system/`, { headers }).catch(err => {
          console.error("System metrics fetch failed, using fallback", err);
          return { data: null };
        }),
        axios.get(`${API_URL}/dashboard/orders/`, { headers }),
        axios.get(`${API_URL}/dashboard/expenses/`, { headers }),
        axios.get(`${API_URL}/shop/products/`, { headers }),
        axios.get(`${API_URL}/shop/categories/`, { headers })
      ]);

      setStats(analyticsRes.data);
      setOrders(ordersRes.data);
      setExpenses(expensesRes.data);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
      if (systemRes.data) {
        setSysMetrics(systemRes.data);
      }
    } catch (err: any) {
      console.error("Error fetching admin stats", err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Acceso denegado. Asegúrate de ser administrador. Redirigiendo...");
        setTimeout(() => {
          router.push('/login?redirect=/dashboard');
        }, 2000);
      } else {
        setError("Error de red al cargar el panel de administración.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Poll system metrics every 15 seconds
    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/dashboard/system/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSysMetrics(res.data);
      } catch (e) {
        // Silent error for polling
      }
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const handleUpdateOrderStatus = async (orderId: number, nextStatus: 'shipped' | 'delivered') => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    if (nextStatus === 'shipped') {
      // Trigger Shipment Simulation sequence
      setShippingOrderId(orderId);
      setShippingStep('contacting');
      
      setTimeout(() => {
        setShippingStep('generating');
      }, 1000);

      setTimeout(async () => {
        const trackingNum = `DHL-MSAMBAR-${Math.floor(100000 + Math.random() * 900000)}`;
        setSimulatedTracking(trackingNum);
        
        try {
          await axios.patch(`${API_URL}/dashboard/orders/`, {
            order_id: orderId,
            status: 'shipped'
          }, { headers });
          
          setShippingStep('success');
          fetchDashboardData();
        } catch (e) {
          console.error("Failed to ship order", e);
          setShippingStep('idle');
        }
      }, 2500);
    } else {
      // Direct Delivery status update
      try {
        await axios.patch(`${API_URL}/dashboard/orders/`, {
          order_id: orderId,
          status: 'delivered'
        }, { headers });
        fetchDashboardData();
      } catch (e) {
        console.error("Failed to deliver order", e);
      }
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseLoading(true);
    setExpenseSuccess(false);

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      await axios.post(`${API_URL}/dashboard/expenses/`, {
        title: expenseTitle,
        amount: parseFloat(expenseAmount),
        category: expenseCategory,
        description: expenseDesc
      }, { headers });

      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseDesc('');
      setExpenseSuccess(true);
      fetchDashboardData();

      setTimeout(() => {
        setExpenseSuccess(false);
      }, 3000);
    } catch (err) {
      console.error("Failed to add expense", err);
    } finally {
      setExpenseLoading(false);
    }
  };

  // Product Operations
  const openProductCreateModal = () => {
    setProdId(null);
    setProdName('');
    setProdSlug('');
    setProdDesc('');
    setProdPrice('');
    setProdStock('');
    setProdCategory(categories[0]?.id || '');
    setProdIsActive(true);
    setProdImageFile(null);
    setProdImagePreview(null);
    setCatalogErrorMsg(null);
    setCatalogSuccessMsg(null);
    setIsProductModalOpen(true);
  };

  const openProductEditModal = (product: any) => {
    setProdId(product.id);
    setProdName(product.name);
    setProdSlug(product.slug || '');
    setProdDesc(product.description || '');
    setProdPrice(String(product.price));
    setProdStock(String(product.stock));
    setProdCategory(product.category || '');
    setProdIsActive(product.is_active !== false);
    setProdImageFile(null);
    setProdImagePreview(product.image || null);
    setCatalogErrorMsg(null);
    setCatalogSuccessMsg(null);
    setIsProductModalOpen(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatalogLoading(true);
    setCatalogErrorMsg(null);
    setCatalogSuccessMsg(null);

    const token = localStorage.getItem('token');
    const headers = { 
      Authorization: `Bearer ${token}`
    };

    const formData = new FormData();
    formData.append('name', prodName);
    if (prodSlug) formData.append('slug', prodSlug);
    formData.append('description', prodDesc);
    formData.append('price', prodPrice);
    formData.append('stock', prodStock);
    if (prodCategory) formData.append('category', prodCategory);
    formData.append('is_active', String(prodIsActive));
    if (prodImageFile) {
      formData.append('image', prodImageFile);
    }

    try {
      if (prodId) {
        await axios.patch(`${API_URL}/shop/products/${prodId}/`, formData, { headers });
        setCatalogSuccessMsg('¡Producto actualizado con éxito!');
      } else {
        await axios.post(`${API_URL}/shop/products/`, formData, { headers });
        setCatalogSuccessMsg('¡Producto creado con éxito!');
      }
      setIsProductModalOpen(false);
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      setCatalogErrorMsg(err.response?.data ? JSON.stringify(err.response.data) : 'Error al procesar el producto.');
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleProductDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este producto?')) return;
    setCatalogLoading(true);
    setCatalogErrorMsg(null);
    
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      await axios.delete(`${API_URL}/shop/products/${id}/`, { headers });
      setCatalogSuccessMsg('Producto eliminado con éxito.');
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      setCatalogErrorMsg('Error al eliminar el producto.');
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleProductToggleActive = async (product: any) => {
    setCatalogLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      await axios.patch(`${API_URL}/shop/products/${product.id}/`, {
        is_active: !product.is_active
      }, { headers });
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    } finally {
      setCatalogLoading(false);
    }
  };

  // Category Operations
  const openCategoryCreateModal = () => {
    setCatId(null);
    setCatName('');
    setCatSlug('');
    setCatalogErrorMsg(null);
    setCatalogSuccessMsg(null);
    setIsCategoryModalOpen(true);
  };

  const openCategoryEditModal = (category: any) => {
    setCatId(category.id);
    setCatName(category.name);
    setCatSlug(category.slug || '');
    setCatalogErrorMsg(null);
    setCatalogSuccessMsg(null);
    setIsCategoryModalOpen(true);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatalogLoading(true);
    setCatalogErrorMsg(null);
    setCatalogSuccessMsg(null);

    const token = localStorage.getItem('token');
    const headers = { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const data: any = { name: catName };
    if (catSlug) data.slug = catSlug;

    try {
      if (catId) {
        await axios.patch(`${API_URL}/shop/categories/${catId}/`, data, { headers });
        setCatalogSuccessMsg('¡Categoría actualizada con éxito!');
      } else {
        await axios.post(`${API_URL}/shop/categories/`, data, { headers });
        setCatalogSuccessMsg('¡Categoría creada con éxito!');
      }
      setIsCategoryModalOpen(false);
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      setCatalogErrorMsg(err.response?.data ? JSON.stringify(err.response.data) : 'Error al procesar la categoría.');
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleCategoryDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta categoría? Si la eliminas, todos los productos en ella quedarán sin categoría.')) return;
    setCatalogLoading(true);
    setCatalogErrorMsg(null);
    
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      await axios.delete(`${API_URL}/shop/categories/${id}/`, { headers });
      setCatalogSuccessMsg('Categoría eliminada con éxito.');
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      setCatalogErrorMsg('Error al eliminar la categoría.');
    } finally {
      setCatalogLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] text-white flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-amber-honey/20 border-t-amber-honey animate-spin" />
        <p className="text-white/60 tracking-widest font-black uppercase text-xs">Cargando Bóveda MS AMBAR...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#030303] text-white flex items-center justify-center p-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/5 border border-white/10 p-8 rounded-[2rem] text-center backdrop-blur-xl amber-glass"
        >
          <AlertTriangle className="text-amber-500 w-16 h-16 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]" />
          <h2 className="text-2xl font-black uppercase italic tracking-tight mb-2">⚠️ Acceso Limitado</h2>
          <p className="text-white/60 text-sm mb-6 leading-relaxed">
            {error}. Se requiere una cuenta de administrador registrada en el sistema.
          </p>
          <a 
            href="/admin/" 
            target="_blank" 
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-honey to-amber-gold hover:from-amber-gold hover:to-amber-500 text-black font-black uppercase tracking-widest text-xs px-6 py-4 rounded-xl transition-all shadow-[0_4px_20px_rgba(245,158,11,0.2)]"
          >
            Django Admin <ExternalLink size={14} />
          </a>
        </motion.div>
      </div>
    );
  }

  const financials = stats?.financials;
  const tickets = stats?.tickets;
  const shop = stats?.shop;
  const vitals = stats?.vitals;
  const chartData = stats?.charts?.daily_sales || [];

  // SVG Area Chart calculations
  const chartWidth = 700;
  const chartHeight = 220;
  const paddingLeft = 40;
  const paddingRight = 10;
  const paddingTop = 20;
  const paddingBottom = 30;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const maxVal = Math.max(...chartData.map((d: any) => d.total), 100) * 1.1;

  const points = chartData.map((d: any, i: number) => {
    const x = paddingLeft + (i / (chartData.length - 1)) * innerWidth;
    const y = paddingTop + innerHeight - (d.total / maxVal) * innerHeight;
    return { x, y, data: d };
  });

  const linePath = points.length > 0 
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p: any) => `L ${p.x} ${p.y}`).join(' ')
    : '';

  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + innerHeight} L ${points[0].x} ${paddingTop + innerHeight} Z`
    : '';

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const viewBoxX = (mouseX / rect.width) * chartWidth;
    
    let closestPoint = points[0];
    let minDiff = Math.abs(points[0].x - viewBoxX);
    
    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(points[i].x - viewBoxX);
      if (diff < minDiff) {
        minDiff = diff;
        closestPoint = points[i];
      }
    }
    
    if (viewBoxX >= paddingLeft - 20 && viewBoxX <= chartWidth - paddingRight + 20) {
      setHoveredPoint({
        ...closestPoint.data,
        x: closestPoint.x,
        y: closestPoint.y
      });
    } else {
      setHoveredPoint(null);
    }
  };

  const pendingOrdersCount = orders.filter(o => o.status === 'paid').length;

  const activePoint = hoveredPoint || (points.length > 0 ? {
    ...points[points.length - 1].data,
    x: points[points.length - 1].x,
    y: points[points.length - 1].y
  } : null);

  return (
    <div className="min-h-screen bg-[#030303] text-white py-12 px-6 lg:px-12 relative overflow-hidden font-sans">
      {/* Background Decorative Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-700/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Main Header */}
      <header className="mb-8 relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-[10px] text-amber-500 uppercase tracking-widest font-black flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            Consola del Artista
          </span>
          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-amber-100 via-amber-300 to-amber-500 bg-clip-text text-transparent uppercase italic tracking-tighter mt-1">
            Bóveda de Resumen
          </h1>
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-2">
            Métricas de Ventas, Taquilla, Logística y Salud de Servidores de MS AMBAR
          </p>
        </div>
        
        <div className="flex gap-4">
          <Link 
            href="/dashboard/performance"
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-3 rounded-xl transition-all text-xs font-bold uppercase tracking-widest"
          >
            <Activity size={14} className="text-amber-400" /> Rendimiento
          </Link>
          <a 
            href="/admin/" 
            target="_blank" 
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-xs px-5 py-3 rounded-xl transition-all shadow-[0_4px_20px_rgba(245,158,11,0.15)]"
          >
            Django <ExternalLink size={14} />
          </a>
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <div className="flex gap-4 mb-8 bg-white/[0.02] border border-white/5 p-2 rounded-2xl w-fit relative z-10 backdrop-blur-xl">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'summary' 
              ? 'bg-amber-honey text-black shadow-lg shadow-amber-honey/20' 
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          📊 Resumen General
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'orders' 
              ? 'bg-amber-honey text-black shadow-lg shadow-amber-honey/20' 
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          📦 Despacho de Pedidos
          {pendingOrdersCount > 0 && (
            <span className="w-5 h-5 bg-white border border-nature-night text-nature-night rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
              {pendingOrdersCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'expenses' 
              ? 'bg-amber-honey text-black shadow-lg shadow-amber-honey/20' 
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          💸 Control de Gastos
        </button>
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'catalog' 
              ? 'bg-amber-honey text-black shadow-lg shadow-amber-honey/20' 
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          🛍️ Catálogo de Tienda
        </button>
      </div>

      {/* Main Administrative Views Context */}
      <div className="relative z-10">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: SUMMARY DASHBOARD */}
          {activeTab === 'summary' && (
            <motion.div
              key="summary-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* stat cards (3x2 Grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard 
                  title="Ingresos Totales" 
                  value={`$${financials?.gross_sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  icon={<DollarSign className="text-amber-400" />}
                  color="amber"
                  detail="Combinado: Taquilla + Tienda"
                />
                <StatCard 
                  title="Ventas de Tickets" 
                  value={`$${financials?.ticket_sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  icon={<Ticket className="text-amber-300" />}
                  color="gold"
                  detail={`Boletos: ${tickets?.total_sold} vendidos`}
                />
                <StatCard 
                  title="Ventas de Tienda" 
                  value={`$${financials?.shop_sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  icon={<ShoppingBag className="text-amber-500" />}
                  color="honey"
                  detail={`Pedidos: ${shop?.total_orders} completados`}
                />
                <StatCard 
                  title="Gastos Operativos" 
                  value={`$${financials?.total_expenses?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  icon={<TrendingDown className="text-red-400" />}
                  color="honey"
                  detail="Pérdidas, Envíos & Producción"
                />
                <StatCard 
                  title="Beneficio Neto Real" 
                  value={`$${financials?.net_profit?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  icon={<Landmark className="text-green-400" />}
                  color="amber"
                  detail="Ingresos libres de gastos"
                />
                <StatCard 
                  title="Upgrades M&G" 
                  value={tickets?.mg_upgrades}
                  icon={<Users className="text-yellow-400" />}
                  color="yellow"
                  detail={`Ingreso M&G: $${financials?.mg_revenue.toLocaleString()}`}
                />
              </div>

              {/* Charts and Operations grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* SVG Interactive Area Chart */}
                <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] backdrop-blur-xl amber-glass flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-lg font-black uppercase italic tracking-tight flex items-center gap-2">
                        <TrendingUp size={18} className="text-amber-500" /> Flujo de Ingresos Diarios
                      </h3>
                      <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">
                        Taquilla & Tienda - Últimos 30 días
                      </p>
                    </div>
                    {activePoint && (
                      <div className="text-right">
                        <span className="text-amber-400 font-mono text-sm font-bold">
                          ${activePoint.total.toLocaleString()}
                        </span>
                        <p className="text-[9px] text-white/50 uppercase font-black tracking-wider">
                          {activePoint.date === points[points.length - 1]?.data?.date ? 'Hoy (Día Actual)' : activePoint.date}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="relative w-full h-[220px]">
                    <svg 
                      viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                      className="w-full h-full overflow-visible select-none cursor-crosshair"
                      onMouseMove={handleMouseMove}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <defs>
                        <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.25"/>
                          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.00"/>
                        </linearGradient>
                      </defs>
                      {[0, 0.25, 0.5, 0.75, 1.0].map((ratio, idx) => {
                        const y = paddingTop + innerHeight * (1 - ratio);
                        const val = maxVal * ratio;
                        return (
                          <g key={idx}>
                            <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#ffffff" strokeOpacity="0.03" strokeDasharray="4 4" />
                            <text x={paddingLeft - 8} y={y + 4} fill="#ffffff" fillOpacity="0.2" fontSize="9" fontWeight="bold" textAnchor="end">${Math.round(val)}</text>
                          </g>
                        );
                      })}
                      
                      {/* X-Axis labels with explicit and styled label for the current day (Hoy) */}
                      {points.filter((_, idx) => idx % 5 === 0 || idx === points.length - 1).map((p, idx) => {
                        const isLast = p.data.date === points[points.length - 1]?.data?.date;
                        return (
                          <text 
                            key={idx} 
                            x={p.x} 
                            y={paddingTop + innerHeight + 18} 
                            fill={isLast ? "#F59E0B" : "#ffffff"} 
                            fillOpacity={isLast ? "0.9" : "0.2"} 
                            fontSize="9" 
                            fontWeight={isLast ? "black" : "bold"} 
                            textAnchor="middle"
                          >
                            {isLast ? "Hoy" : p.data.date}
                          </text>
                        );
                      })}
                      
                      {areaPath && <path d={areaPath} fill="url(#salesGradient)" />}
                      {linePath && <path d={linePath} fill="none" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}
                      
                      {/* Premium Proximity Guide Line and Glowing Dot */}
                      {activePoint && (
                        <g>
                          {/* Vertical guide line */}
                          <line 
                            x1={activePoint.x} 
                            y1={paddingTop} 
                            x2={activePoint.x} 
                            y2={paddingTop + innerHeight} 
                            stroke="#F59E0B" 
                            strokeOpacity="0.2" 
                            strokeDasharray="4 4" 
                            strokeWidth="1.5" 
                          />
                          {/* Concentric glowing indicator */}
                          <circle cx={activePoint.x} cy={activePoint.y} r="8" fill="#F59E0B" fillOpacity="0.35" className="animate-pulse" />
                          <circle cx={activePoint.x} cy={activePoint.y} r="4.5" fill="#F59E0B" stroke="#ffffff" strokeWidth="2" />
                        </g>
                      )}
                    </svg>

                    {/* Floating Glassmorphic Tooltip */}
                    <AnimatePresence>
                      {activePoint && (
                        <motion.div
                          key={`tooltip-${activePoint.date}`}
                          initial={{ opacity: 0, scale: 0.92, y: 5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.92, y: 5 }}
                          transition={{ duration: 0.12, ease: 'easeOut' }}
                          style={{
                            position: 'absolute',
                            left: `${(activePoint.x / chartWidth) * 100}%`,
                            top: `${(activePoint.y / chartHeight) * 100 - 15}%`,
                            transform: 'translate(-50%, -100%)',
                          }}
                          className="pointer-events-none z-[100] bg-black/90 border border-amber-honey/30 px-3 py-2 rounded-xl backdrop-blur-md flex flex-col gap-0.5 shadow-[0_4px_25px_rgba(245,158,11,0.25)] min-w-[100px] text-center"
                        >
                          <span className="text-[10px] font-black text-amber-honey font-mono tracking-tight">
                            ${activePoint.total.toLocaleString()}
                          </span>
                          <span className="text-[8px] text-white/50 uppercase font-black tracking-wider">
                            {activePoint.date === points[points.length - 1]?.data?.date ? 'Hoy' : activePoint.date}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Quick Operations */}
                <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] backdrop-blur-xl amber-glass flex flex-col gap-4">
                  <h3 className="text-lg font-black uppercase italic tracking-tight mb-2 flex items-center gap-2">
                    <Layers size={18} className="text-amber-500" /> Operaciones Rápidas
                  </h3>
                  <QuickActionBtn href="/designer" title="Diseñador de Mapas" desc="Editor de Seating Chart 2D" icon={<Layers size={18} />} />
                  <QuickActionBtn href="/dashboard/performance" title="Monitor Core Web Vitals" desc="Tiempos del Servidor y Logs" icon={<Activity size={18} />} />
                  <QuickActionBtn href="/admin/shop/product/" title="Catálogo de Productos" desc="Editar Stock de Mercancía" icon={<ShoppingBag size={18} />} external />
                  <QuickActionBtn href="/admin/tickets/event/" title="Fechas & Conciertos" desc="Programar nuevos eventos" icon={<Ticket size={18} />} external />
                </div>
              </div>

              {/* Health and Products section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] backdrop-blur-xl amber-glass">
                  <h3 className="text-lg font-black uppercase italic tracking-tight mb-4 flex items-center gap-2">
                    <Cpu size={18} className="text-amber-500" /> Servidor y Base de Datos
                  </h3>
                  {sysMetrics ? (
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
                          <span className="flex items-center gap-1 opacity-60"><Cpu size={12} /> Carga CPU ({sysMetrics.cpu?.cores} Núcleos)</span>
                          <span className="text-amber-400">{sysMetrics.cpu?.percent}%</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500" style={{ width: `${sysMetrics.cpu?.percent}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
                          <span className="flex items-center gap-1 opacity-60"><Layers size={12} /> Memoria RAM</span>
                          <span className="text-amber-400">{sysMetrics.memory?.used_gb} / {sysMetrics.memory?.total_gb} GB</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500" style={{ width: `${sysMetrics.memory?.percent}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
                          <span className="flex items-center gap-1 opacity-60"><HardDrive size={12} /> Almacenamiento SSD</span>
                          <span className="text-amber-400">{sysMetrics.disk?.used_gb?.toFixed(1)} / {sysMetrics.disk?.total_gb?.toFixed(1)} GB</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500" style={{ width: `${sysMetrics.disk?.percent}%` }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col justify-between">
                          <span className="text-[10px] uppercase opacity-40 font-bold">Base de Datos</span>
                          <span className="text-sm font-black flex items-center gap-2 mt-2">
                            <Database size={14} className={sysMetrics.database?.status === 'Conectado' ? 'text-green-400' : 'text-red-400'} />
                            {sysMetrics.database?.status}
                          </span>
                        </div>
                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col justify-between">
                          <span className="text-[10px] uppercase opacity-40 font-bold">Uptime</span>
                          <span className="text-[11px] font-mono font-bold truncate mt-2 text-amber-300">{sysMetrics.system?.uptime || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-white/20 text-xs py-8 text-center uppercase tracking-widest font-bold">Sin datos del sistema</p>
                  )}
                </div>

                <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] backdrop-blur-xl amber-glass lg:col-span-2">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-black uppercase italic tracking-tight flex items-center gap-2">
                      <ShoppingBag size={18} className="text-amber-500" /> Inteligencia de Ventas (Top Merch)
                    </h3>
                    {shop?.low_stock_count > 0 && (
                      <span className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full animate-pulse">
                        <AlertTriangle size={10} /> {shop?.low_stock_count} Stock Bajo
                      </span>
                    )}
                  </div>
                  {shop?.top_products && shop.top_products.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-[9px] uppercase tracking-widest opacity-40 text-left">
                            <th className="py-3 font-black">Producto</th>
                            <th className="py-3 font-black text-center">Unidades</th>
                            <th className="py-3 font-black text-right">Ingresos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shop.top_products.map((p: any, idx: number) => (
                            <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-all">
                              <td className="py-3.5 text-xs font-black text-white/80">{p.name}</td>
                              <td className="py-3.5 text-xs font-mono text-center text-amber-400 font-bold">{p.quantity}</td>
                              <td className="py-3.5 text-xs font-mono text-right text-white font-black">${p.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 opacity-30 text-center">
                      <ShoppingBag size={48} className="mb-4" />
                      <p className="text-xs uppercase tracking-widest font-black">Sin ventas de mercancía registradas</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: ORDERS MANAGEMENT QUEUE */}
          {activeTab === 'orders' && (
            <motion.div
              key="orders-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Order Filtering Options */}
              <div className="flex gap-3 bg-white/[0.02] border border-white/5 p-1.5 rounded-xl w-fit">
                {['all', 'paid', 'shipped', 'delivered'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setOrderFilter(filter as any)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      orderFilter === filter 
                        ? 'bg-white/10 text-white' 
                        : 'text-white/40 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {filter === 'all' && 'Todos'}
                    {filter === 'paid' && 'Pendientes Despacho'}
                    {filter === 'shipped' && 'En Tránsito (Shipped)'}
                    {filter === 'delivered' && 'Entregados'}
                  </button>
                ))}
              </div>

              {/* Simulated Shipping Modal Overlay */}
              {shippingOrderId && shippingStep !== 'idle' && (
                <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-6 backdrop-blur-md">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="max-w-md w-full bg-[#080808] border border-white/10 p-8 rounded-[2.5rem] text-center shadow-2xl"
                  >
                    {shippingStep === 'contacting' && (
                      <div className="py-6 space-y-4">
                        <div className="w-12 h-12 border-4 border-amber-honey/20 border-t-amber-honey rounded-full animate-spin mx-auto" />
                        <h4 className="text-md font-black uppercase tracking-wider">Despachando Guía DHL...</h4>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Estableciendo comunicación de paquetería</p>
                      </div>
                    )}
                    {shippingStep === 'generating' && (
                      <div className="py-6 space-y-4">
                        <div className="w-12 h-12 border-4 border-amber-honey/20 border-t-amber-gold rounded-full animate-spin mx-auto" />
                        <h4 className="text-md font-black uppercase tracking-wider">Imprimiendo Guía Postal...</h4>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Generando archivo PDF y Tracking Number</p>
                      </div>
                    )}
                    {shippingStep === 'success' && (
                      <div className="py-6 space-y-5">
                        <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 flex items-center justify-center mx-auto animate-bounce">
                          <Check size={32} />
                        </div>
                        <div>
                          <h4 className="text-md font-black uppercase tracking-wider">¡Guía Generada Exitosamente!</h4>
                          <p className="text-xs text-white/50 mt-2">El pedido ha sido entregado a paquetería.</p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl text-left space-y-1">
                          <span className="text-[9px] text-white/30 uppercase tracking-widest font-black block">Código de Seguimiento</span>
                          <span className="text-xs font-mono font-bold text-amber-honey">{simulatedTracking}</span>
                        </div>
                        <button 
                          onClick={() => {
                            setShippingOrderId(null);
                            setShippingStep('idle');
                          }}
                          className="w-full bg-white text-black font-black uppercase tracking-widest text-[9px] py-3.5 rounded-xl mt-4"
                        >
                          Cerrar y Actualizar Lista
                        </button>
                      </div>
                    )}
                  </motion.div>
                </div>
              )}

              {/* Orders Listing Queue */}
              <div className="space-y-4">
                {orders
                  .filter((o) => orderFilter === 'all' ? true : o.status === orderFilter)
                  .length === 0 ? (
                    <div className="bg-white/[0.02] border border-white/5 p-16 rounded-[2.5rem] text-center flex flex-col items-center justify-center gap-4">
                      <Package size={48} className="text-white/10" />
                      <p className="text-xs uppercase tracking-widest font-black text-white/30">No se encontraron pedidos en esta categoría</p>
                    </div>
                  ) : (
                    orders
                      .filter((o) => orderFilter === 'all' ? true : o.status === orderFilter)
                      .map((order) => (
                        <div key={order.id} className="bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] hover:border-white/10 transition-all flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative overflow-hidden group">
                          {/* Left Info: Meta, address, items */}
                          <div className="space-y-4 flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="text-xs font-black text-white/80">Orden #{order.id}</span>
                              <span className="text-[9px] opacity-40 font-bold uppercase tracking-wider flex items-center gap-1"><Calendar size={10} /> {new Date(order.created_at).toLocaleString()}</span>
                              <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full border ${
                                order.status === 'paid' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse' :
                                order.status === 'shipped' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                                'bg-green-500/10 border-green-500/30 text-green-400'
                              }`}>
                                {order.status === 'paid' ? 'Pendiente Envío (Pagado)' :
                                 order.status === 'shipped' ? 'En Tránsito (Shipped)' :
                                 'Entregado'}
                              </span>
                            </div>

                            {/* Recipient card details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/[0.01] border border-white/[0.03] p-4 rounded-xl">
                              <div className="space-y-1.5">
                                <span className="text-[8px] text-white/30 uppercase tracking-widest font-black block">Información del Cliente</span>
                                <div className="text-xs font-black flex items-center gap-1.5"><User size={12} className="text-white/40" /> {order.full_name}</div>
                                <div className="text-[10px] text-white/60 flex items-center gap-1.5"><Mail size={12} className="text-white/40" /> {order.user_email}</div>
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-[8px] text-white/30 uppercase tracking-widest font-black block">Dirección de Despacho</span>
                                <div className="text-xs font-black flex items-center gap-1.5"><MapPin size={12} className="text-white/40" /> {order.address}</div>
                                <div className="text-[10px] text-white/60 pl-4">{order.city}, {order.country}</div>
                              </div>
                            </div>

                            {/* Items table list */}
                            <div className="space-y-1.5">
                              <span className="text-[8px] text-white/30 uppercase tracking-widest font-black block">Artículos a Enviar</span>
                              <div className="flex flex-wrap gap-2">
                                {order.items.map((item: any, idx: number) => (
                                  <span key={idx} className="bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white/80">
                                    {item.quantity}x <span className="text-amber-honey font-black uppercase tracking-wider">{item.product_name}</span> (${item.price})
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Right actions: Total & Shipping Buttons */}
                          <div className="flex flex-col items-end gap-3 shrink-0 self-stretch lg:self-center justify-between border-t lg:border-t-0 border-white/5 pt-4 lg:pt-0">
                            <div className="text-right">
                              <span className="text-[9px] uppercase tracking-widest text-white/30 font-black block mb-0.5">Total Abonado</span>
                              <span className="text-lg font-black text-amber-honey">${order.total_amount}</span>
                            </div>

                            {order.status === 'paid' && (
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleUpdateOrderStatus(order.id, 'shipped')}
                                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-[9px] px-5 py-3.5 rounded-xl transition-all shadow-[0_2px_15px_rgba(245,158,11,0.15)] flex items-center gap-1.5"
                              >
                                <Truck size={12} /> Generar Guía y Despachar
                              </motion.button>
                            )}

                            {order.status === 'shipped' && (
                              <div className="flex flex-col gap-2 w-full">
                                <div className="p-2 bg-blue-500/5 border border-blue-500/10 rounded-lg text-[9px] text-blue-400 font-mono text-center font-bold">
                                  En Tránsito
                                </div>
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                                  className="border border-green-500/30 bg-green-500/10 text-green-400 font-black uppercase tracking-widest text-[9px] px-5 py-3 rounded-xl hover:bg-green-500/25 transition-all flex items-center justify-center gap-1"
                                >
                                  <Check size={12} /> Confirmar Entrega
                                </motion.button>
                              </div>
                            )}

                            {order.status === 'delivered' && (
                              <div className="flex items-center gap-1 text-green-400 text-xs font-black uppercase tracking-widest border border-green-500/25 bg-green-500/5 px-4 py-2 rounded-xl">
                                <Check size={14} /> Entregado
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 3: EXPENSES LEDGER */}
          {activeTab === 'expenses' && (
            <motion.div
              key="expenses-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Left Column: Expenses History List */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <h3 className="text-lg font-black uppercase italic tracking-tight">Registro de Gastos Históricos</h3>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-0.5">Control de pérdidas y costos logísticos</p>
                  </div>
                </div>

                {expenses.length === 0 ? (
                  <div className="bg-white/[0.02] border border-white/5 p-16 rounded-[2.5rem] text-center flex flex-col items-center justify-center gap-4">
                    <ClipboardList size={48} className="text-white/10" />
                    <p className="text-xs uppercase tracking-widest font-black text-white/30">No se han registrado gastos operativos aún</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expenses.map((e) => (
                      <div key={e.id} className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl flex justify-between items-center gap-6">
                        <div className="space-y-1">
                          <div className="text-xs font-black uppercase tracking-wider text-white">{e.title}</div>
                          {e.description && <p className="text-[10px] text-white/50 leading-relaxed max-w-md">{e.description}</p>}
                          <div className="flex gap-3 text-[9px] opacity-40 font-bold uppercase tracking-widest pt-1">
                            <span>Categoría: {e.category}</span>
                            <span>•</span>
                            <span>{new Date(e.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-mono font-black text-red-400">-${e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Add Expense Form */}
              <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] backdrop-blur-xl amber-glass h-fit">
                <h3 className="text-lg font-black uppercase italic tracking-tight mb-4 flex items-center gap-2">
                  <PlusCircle size={18} className="text-amber-500" /> Registrar Gasto
                </h3>

                <form onSubmit={handleAddExpense} className="space-y-4">
                  {expenseSuccess && (
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="p-3.5 bg-green-500/10 border border-green-500/25 text-green-400 rounded-xl text-xs font-bold uppercase tracking-wider text-center"
                    >
                      ¡Gasto registrado con éxito!
                    </motion.div>
                  )}

                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-white/50 uppercase tracking-widest font-bold block pl-1">Título del Gasto</label>
                    <input
                      type="text"
                      required
                      value={expenseTitle}
                      onChange={(e) => setExpenseTitle(e.target.value)}
                      placeholder="Ej: Tarifas de Envío DHL"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-500 transition-all font-semibold"
                    />
                  </div>

                  {/* Amount */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-white/50 uppercase tracking-widest font-bold block pl-1">Monto (USD/ARS)</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-xs font-bold">$</div>
                      <input
                        type="number"
                        required
                        step="0.01"
                        value={expenseAmount}
                        onChange={(e) => setExpenseAmount(e.target.value)}
                        placeholder="1500.00"
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-8 pr-4 py-3 text-xs outline-none focus:border-amber-500 transition-all font-semibold font-mono"
                      />
                    </div>
                  </div>

                  {/* Category Selection */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-white/50 uppercase tracking-widest font-bold block pl-1">Categoría</label>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="w-full bg-[#080808] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-500 transition-all font-semibold uppercase tracking-wider text-white"
                    >
                      <option value="Logística & Envío">🚚 Logística & Envío</option>
                      <option value="Producción de Merch">👕 Producción de Merch</option>
                      <option value="Licencias & Hosting">💻 Licencias & Hosting</option>
                      <option value="Honorarios Artistas">🎤 Honorarios Artistas</option>
                      <option value="Marketing & Anuncios">📢 Marketing & Anuncios</option>
                      <option value="Gastos Generales">💸 Gastos Generales</option>
                    </select>
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-white/50 uppercase tracking-widest font-bold block pl-1">Descripción Breve</label>
                    <textarea
                      rows={3}
                      value={expenseDesc}
                      onChange={(e) => setExpenseDesc(e.target.value)}
                      placeholder="Detalles complementarios del gasto..."
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-500 transition-all font-semibold"
                    />
                  </div>

                  {/* Submit Button */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="submit"
                    disabled={expenseLoading}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-[9px] py-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-[0_2px_15px_rgba(245,158,11,0.15)] disabled:opacity-50 mt-2"
                  >
                    {expenseLoading ? (
                      <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    ) : (
                      <><Plus size={12} /> Registrar en Bóveda</>
                    )}
                  </motion.button>
                </form>
              </div>
            </motion.div>
          )}

          {/* TAB 4: MERCHANDISE CATALOG */}
          {activeTab === 'catalog' && (
            <motion.div
              key="catalog-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Notifications */}
              {catalogSuccessMsg && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl text-xs font-bold uppercase tracking-wider text-center">
                  {catalogSuccessMsg}
                </div>
              )}
              {catalogErrorMsg && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs font-bold uppercase tracking-wider text-center">
                  {catalogErrorMsg}
                </div>
              )}

              {/* Catalog Navigation Sub-Bar & Create Buttons */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.01] border border-white/5 p-4 rounded-[2rem]">
                <div className="flex gap-2 bg-white/[0.02] border border-white/5 p-1 rounded-xl">
                  <button
                    onClick={() => setCatalogSubTab('products')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      catalogSubTab === 'products' 
                        ? 'bg-white/10 text-white' 
                        : 'text-white/40 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    🛍️ Productos ({products.length})
                  </button>
                  <button
                    onClick={() => setCatalogSubTab('categories')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      catalogSubTab === 'categories' 
                        ? 'bg-white/10 text-white' 
                        : 'text-white/40 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    🏷️ Categorías ({categories.length})
                  </button>
                </div>

                {catalogSubTab === 'products' ? (
                  <button
                    onClick={openProductCreateModal}
                    className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-[9px] px-5 py-3 rounded-xl transition-all shadow-[0_2px_15px_rgba(245,158,11,0.15)]"
                  >
                    <PlusCircle size={14} /> Agregar Producto
                  </button>
                ) : (
                  <button
                    onClick={openCategoryCreateModal}
                    className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-[9px] px-5 py-3 rounded-xl transition-all shadow-[0_2px_15px_rgba(245,158,11,0.15)]"
                  >
                    <PlusCircle size={14} /> Agregar Categoría
                  </button>
                )}
              </div>

              {/* Sub-Tab Content: Products Grid */}
              {catalogSubTab === 'products' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {products.length === 0 ? (
                    <div className="col-span-full bg-white/[0.02] border border-white/5 p-16 rounded-[2.5rem] text-center flex flex-col items-center justify-center gap-4">
                      <ShoppingBag size={48} className="text-white/10" />
                      <p className="text-xs uppercase tracking-widest font-black text-white/30">No se encontraron productos registrados</p>
                    </div>
                  ) : (
                    products.map((product) => (
                      <div key={product.id} className="bg-white/[0.02] border border-white/5 p-5 rounded-[2rem] hover:border-white/10 transition-all flex flex-col justify-between relative overflow-hidden group">
                        {/* Status badge */}
                        <div className="absolute top-4 right-4 flex gap-2">
                          <button
                            onClick={() => handleProductToggleActive(product)}
                            title={product.is_active ? "Desactivar" : "Activar"}
                            className={`p-2 rounded-xl border backdrop-blur-md transition-all ${
                              product.is_active 
                                ? 'bg-green-500/10 border-green-500/25 text-green-400' 
                                : 'bg-red-500/10 border-red-500/25 text-red-400'
                            }`}
                          >
                            {product.is_active ? <Eye size={12} /> : <EyeOff size={12} />}
                          </button>
                        </div>

                        <div>
                          {/* Image Preview Container */}
                          <div className="w-full h-40 bg-white/[0.01] border border-white/5 rounded-2xl mb-4 overflow-hidden relative flex items-center justify-center">
                            {product.image ? (
                              <img 
                                src={product.image} 
                                alt={product.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <ShoppingBag size={40} className="text-white/10" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="space-y-1">
                            <span className="text-[8px] bg-white/5 border border-white/5 px-2 py-0.5 rounded-full text-white/40 uppercase tracking-widest font-bold">
                              {product.category_name || 'Sin Categoría'}
                            </span>
                            <h4 className="text-sm font-black text-white uppercase tracking-tight line-clamp-1 pt-1">{product.name}</h4>
                            <p className="text-[10px] text-white/50 line-clamp-2 leading-relaxed h-8">{product.description || 'Sin descripción'}</p>
                          </div>
                        </div>

                        {/* Bottom Metadata & CTA */}
                        <div className="border-t border-white/5 pt-4 mt-4 flex justify-between items-center">
                          <div>
                            <span className="text-[8px] uppercase tracking-widest text-white/30 font-black block">Precio & Stock</span>
                            <div className="flex gap-2 items-baseline">
                              <span className="text-sm font-black text-amber-honey">${product.price}</span>
                              <span className={`text-[9px] font-mono font-bold ${product.stock > 5 ? 'text-white/50' : 'text-red-400 animate-pulse'}`}>
                                ({product.stock} disp.)
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => openProductEditModal(product)}
                              className="p-2.5 bg-white/5 border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/10 text-white rounded-xl transition-all"
                              title="Editar Producto"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleProductDelete(product.id)}
                              className="p-2.5 bg-white/5 border border-white/5 hover:border-red-500/30 hover:bg-red-500/10 text-red-400 rounded-xl transition-all"
                              title="Eliminar Producto"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Sub-Tab Content: Categories List */}
              {catalogSubTab === 'categories' && (
                <div className="space-y-4">
                  {categories.length === 0 ? (
                    <div className="bg-white/[0.02] border border-white/5 p-16 rounded-[2.5rem] text-center flex flex-col items-center justify-center gap-4">
                      <Layers size={48} className="text-white/10" />
                      <p className="text-xs uppercase tracking-widest font-black text-white/30">No se encontraron categorías registradas</p>
                    </div>
                  ) : (
                    categories.map((category) => (
                      <div key={category.id} className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl hover:border-white/10 transition-all flex justify-between items-center gap-6">
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-white">{category.name}</h4>
                          <p className="text-[10px] text-amber-honey/60 font-mono font-bold mt-0.5">slug: {category.slug}</p>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => openCategoryEditModal(category)}
                            className="p-2.5 bg-white/5 border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/10 text-white rounded-xl transition-all"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleCategoryDelete(category.id)}
                            className="p-2.5 bg-white/5 border border-white/5 hover:border-red-500/30 hover:bg-red-500/10 text-red-400 rounded-xl transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* PRODUCT CREATION/EDIT MODAL OVERLAY */}
              {isProductModalOpen && (
                <div className="fixed inset-0 bg-black/85 z-[120] flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm">
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="max-w-xl w-full bg-[#080808] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl relative my-8"
                  >
                    <button 
                      onClick={() => setIsProductModalOpen(false)}
                      className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all"
                    >
                      <X size={16} />
                    </button>

                    <h3 className="text-xl font-black uppercase italic tracking-tight mb-6 text-white flex items-center gap-2">
                      <ShoppingBag size={20} className="text-amber-500" />
                      {prodId ? 'Editar Producto Merch' : 'Nuevo Producto Merch'}
                    </h3>

                    <form onSubmit={handleProductSubmit} className="space-y-4">
                      {/* Name */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-white/50 uppercase tracking-widest font-bold block pl-1">Nombre del Producto</label>
                        <input
                          type="text"
                          required
                          value={prodName}
                          onChange={(e) => setProdName(e.target.value)}
                          placeholder="Ej: Remera MS AMBAR Premium Black"
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-500 transition-all font-semibold"
                        />
                      </div>

                      {/* Price & Stock */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] text-white/50 uppercase tracking-widest font-bold block pl-1">Precio (USD)</label>
                          <input
                            type="number"
                            required
                            step="0.01"
                            value={prodPrice}
                            onChange={(e) => setProdPrice(e.target.value)}
                            placeholder="25.00"
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-500 transition-all font-semibold font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-white/50 uppercase tracking-widest font-bold block pl-1">Stock Disponible</label>
                          <input
                            type="number"
                            required
                            value={prodStock}
                            onChange={(e) => setProdStock(e.target.value)}
                            placeholder="50"
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-500 transition-all font-semibold font-mono"
                          />
                        </div>
                      </div>

                      {/* Category Select */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-white/50 uppercase tracking-widest font-bold block pl-1">Categoría</label>
                        <select
                          required
                          value={prodCategory}
                          onChange={(e) => setProdCategory(e.target.value)}
                          className="w-full bg-[#080808] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-500 transition-all font-semibold uppercase tracking-wider text-white"
                        >
                          <option value="">Seleccionar Categoría...</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>🏷️ {c.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Image Upload */}
                      <div className="space-y-2">
                        <label className="text-[9px] text-white/50 uppercase tracking-widest font-bold block pl-1">Imagen del Producto</label>
                        <div className="flex gap-4 items-center bg-white/[0.01] border border-white/5 p-4 rounded-xl">
                          <div className="w-16 h-16 bg-white/[0.02] rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-white/10">
                            {prodImagePreview ? (
                              <img src={prodImagePreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <ShoppingBag size={24} className="text-white/10" />
                            )}
                          </div>
                          <div className="space-y-1 flex-1">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setProdImageFile(file);
                                  setProdImagePreview(URL.createObjectURL(file));
                                }
                              }}
                              className="text-[10px] text-white/60 file:bg-white/5 file:border-0 file:rounded-lg file:text-white file:px-3 file:py-1.5 file:text-[9px] file:uppercase file:font-black file:tracking-widest file:mr-3 cursor-pointer"
                            />
                            <p className="text-[8px] text-white/30 uppercase tracking-widest font-bold">Formatos recomendados: JPG, PNG o WebP. Máx 5MB.</p>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-white/50 uppercase tracking-widest font-bold block pl-1">Descripción del Producto</label>
                        <textarea
                          rows={3}
                          required
                          value={prodDesc}
                          onChange={(e) => setProdDesc(e.target.value)}
                          placeholder="Características, material, talles, etc..."
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-500 transition-all font-semibold"
                        />
                      </div>

                      {/* Active Status Checkbox */}
                      <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-4 rounded-xl">
                        <input
                          type="checkbox"
                          id="prodIsActive"
                          checked={prodIsActive}
                          onChange={(e) => setProdIsActive(e.target.checked)}
                          className="w-4 h-4 accent-amber-honey rounded border-white/10 cursor-pointer"
                        />
                        <label htmlFor="prodIsActive" className="text-[10px] text-white/80 uppercase tracking-widest font-black cursor-pointer selection:bg-transparent">
                          Artículo Activo (Visible en la Tienda Pública)
                        </label>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-4 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsProductModalOpen(false)}
                          className="w-1/2 bg-white/5 hover:bg-white/10 border border-white/5 text-white font-black uppercase tracking-widest text-[9px] py-4 rounded-xl transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={catalogLoading}
                          className="w-1/2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-[9px] py-4 rounded-xl flex items-center justify-center gap-1.5 shadow-[0_2px_15px_rgba(245,158,11,0.15)] disabled:opacity-50"
                        >
                          {catalogLoading ? (
                            <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                          ) : (
                            prodId ? 'Guardar Cambios' : 'Crear Producto'
                          )}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}

              {/* CATEGORY CREATION/EDIT MODAL OVERLAY */}
              {isCategoryModalOpen && (
                <div className="fixed inset-0 bg-black/85 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="max-w-md w-full bg-[#080808] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl relative"
                  >
                    <button 
                      onClick={() => setIsCategoryModalOpen(false)}
                      className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all"
                    >
                      <X size={16} />
                    </button>

                    <h3 className="text-xl font-black uppercase italic tracking-tight mb-6 text-white flex items-center gap-2">
                      <Layers size={20} className="text-amber-500" />
                      {catId ? 'Editar Categoría' : 'Nueva Categoría'}
                    </h3>

                    <form onSubmit={handleCategorySubmit} className="space-y-4">
                      {/* Name */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-white/50 uppercase tracking-widest font-bold block pl-1">Nombre de la Categoría</label>
                        <input
                          type="text"
                          required
                          value={catName}
                          onChange={(e) => setCatName(e.target.value)}
                          placeholder="Ej: Accesorios"
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-500 transition-all font-semibold"
                        />
                      </div>

                      {/* Slug */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-white/50 uppercase tracking-widest font-bold block pl-1">Slug Personalizado (Opcional)</label>
                        <input
                          type="text"
                          value={catSlug}
                          onChange={(e) => setCatSlug(e.target.value)}
                          placeholder="Ej: accesorios-indumentaria"
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-500 transition-all font-semibold font-mono"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex gap-4 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsCategoryModalOpen(false)}
                          className="w-1/2 bg-white/5 hover:bg-white/10 border border-white/5 text-white font-black uppercase tracking-widest text-[9px] py-4 rounded-xl transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={catalogLoading}
                          className="w-1/2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-[9px] py-4 rounded-xl flex items-center justify-center gap-1.5 shadow-[0_2px_15px_rgba(245,158,11,0.15)] disabled:opacity-50"
                        >
                          {catalogLoading ? (
                            <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                          ) : (
                            catId ? 'Guardar Cambios' : 'Crear Categoría'
                          )}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}

            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

// Stat Card Component
const StatCard = ({ icon, title, value, detail, color }: any) => {
  const glowColors: any = {
    amber: 'shadow-[0_4px_30px_rgba(245,158,11,0.05)] border-amber-500/10 hover:border-amber-500/25',
    gold: 'shadow-[0_4px_30px_rgba(251,191,36,0.05)] border-yellow-500/10 hover:border-yellow-500/25',
    honey: 'shadow-[0_4px_30px_rgba(180,83,9,0.05)] border-amber-700/10 hover:border-amber-700/25',
    yellow: 'shadow-[0_4px_30px_rgba(253,224,71,0.05)] border-yellow-300/10 hover:border-yellow-300/25',
  };

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className={`bg-white/[0.02] border rounded-[2rem] p-6 backdrop-blur-xl transition-all duration-300 relative group overflow-hidden ${glowColors[color]}`}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] text-white/50 uppercase tracking-widest font-black">{title}</span>
        <div className="p-2.5 bg-white/5 rounded-xl group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
      <div className="text-2xl md:text-3xl font-black text-white tracking-tight mb-2">{value}</div>
      <div className="text-white/20 text-[9px] uppercase tracking-widest font-black">{detail}</div>
    </motion.div>
  );
};

// Quick Action Button Component
const QuickActionBtn = ({ href, title, desc, icon, external }: any) => {
  const BtnContent = (
    <div className="p-4 bg-white/[0.02] border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/[0.02] rounded-2xl transition-all group flex items-center justify-between cursor-pointer">
      <div className="flex items-center gap-4">
        <div className="p-2.5 bg-white/5 rounded-xl group-hover:bg-amber-500/10 group-hover:scale-105 transition-all text-white/60 group-hover:text-amber-400">
          {icon}
        </div>
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-white group-hover:text-amber-300 transition-colors">{title}</h4>
          <p className="text-[9px] uppercase tracking-widest opacity-30 group-hover:opacity-40 mt-0.5">{desc}</p>
        </div>
      </div>
      <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-amber-400" />
    </div>
  );

  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer">{BtnContent}</a>
  ) : (
    <Link href={href}>{BtnContent}</Link>
  );
};
