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
  const [activeTab, setActiveTab] = useState<'summary' | 'orders' | 'expenses' | 'catalog' | 'theaters' | 'contracts' | 'campaigns'>('summary');
  const [contracts, setContracts] = useState<any[]>([]);
  const [orderFilter, setOrderFilter] = useState<'all' | 'paid' | 'shipped' | 'delivered'>('all');

  // Campaigns & Subscribers State
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignSubTab, setCampaignSubTab] = useState<'campaigns' | 'subscribers'>('campaigns');
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any | null>(null);
  const [campId, setCampId] = useState<number | null>(null);
  const [campSubject, setCampSubject] = useState('');
  const [campPoemText, setCampPoemText] = useState('');
  const [campTemplateType, setCampTemplateType] = useState('minimalist');
  const [campImageFile, setCampImageFile] = useState<File | null>(null);
  const [campImagePreview, setCampImagePreview] = useState<string | null>(null);

  // Custom Background and CTA settings
  const [campBgImageFile, setCampBgImageFile] = useState<File | null>(null);
  const [campBgImagePreview, setCampBgImagePreview] = useState<string | null>(null);
  const [campBgOpacity, setCampBgOpacity] = useState(1.0);
  const [campBgSaturation, setCampBgSaturation] = useState(100);
  const [campBgPosition, setCampBgPosition] = useState('center');
  const [campCtaText, setCampCtaText] = useState('');
  const [campCtaLink, setCampCtaLink] = useState('');
  const [campFontFamily, setCampFontFamily] = useState('serif');

  const [campLoading, setCampLoading] = useState(false);
  const [campSuccessMsg, setCampSuccessMsg] = useState<string | null>(null);
  const [campErrorMsg, setCampErrorMsg] = useState<string | null>(null);
  const [previewCampaign, setPreviewCampaign] = useState<any | null>(null);
  const [sendingCampaignId, setSendingCampaignId] = useState<number | null>(null);

  // CSV Import State
  const [importCsvFile, setImportCsvFile] = useState<File | null>(null);
  const [importCsvLoading, setImportCsvLoading] = useState(false);
  const [importCsvError, setImportCsvError] = useState<string | null>(null);
  const [importCsvSuccess, setImportCsvSuccess] = useState<string | null>(null);

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

  // ─── Theaters State (Nectar Pro) ───
  const [theaters, setTheaters] = useState<any[]>([]);
  const [isTheaterModalOpen, setIsTheaterModalOpen] = useState(false);
  const [editingTheater, setEditingTheater] = useState<any | null>(null);
  const [theaterName, setTheaterName] = useState('');
  const [theaterLocation, setTheaterLocation] = useState('');
  const [theaterLoading, setTheaterLoading] = useState(false);
  const [theaterSuccessMsg, setTheaterSuccessMsg] = useState<string | null>(null);
  const [theaterErrorMsg, setTheaterErrorMsg] = useState<string | null>(null);
  const [theaterSyncStatus, setTheaterSyncStatus] = useState<Record<number, 'idle' | 'loading' | 'success' | 'error'>>({});

  const fetchDashboardData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login?redirect=/dashboard');
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch analytics, system metrics, orders, expenses, products, categories, theaters, booking contracts, email campaigns, and subscribers in parallel
      const [analyticsRes, systemRes, ordersRes, expensesRes, productsRes, categoriesRes, theatersRes, contractsRes, campaignsRes, subscribersRes] = await Promise.all([
        axios.get(`${API_URL}/dashboard/analytics/`, { headers }),
        axios.get(`${API_URL}/dashboard/system/`, { headers }).catch(err => {
          console.error("System metrics fetch failed, using fallback", err);
          return { data: null };
        }),
        axios.get(`${API_URL}/dashboard/orders/`, { headers }),
        axios.get(`${API_URL}/dashboard/expenses/`, { headers }),
        axios.get(`${API_URL}/shop/products/`, { headers }),
        axios.get(`${API_URL}/shop/categories/`, { headers }),
        axios.get(`${API_URL}/tickets/theaters/`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/bookings/contracts/`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/blog/campaigns/`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/blog/subscribers/`, { headers }).catch(() => ({ data: [] }))
      ]);

      setStats(analyticsRes.data);
      setOrders(ordersRes.data);
      setExpenses(expensesRes.data);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
      setTheaters(Array.isArray(theatersRes.data) ? theatersRes.data : []);
      setContracts(Array.isArray(contractsRes.data) ? contractsRes.data : []);
      setCampaigns(Array.isArray(campaignsRes.data) ? campaignsRes.data : []);
      setSubscribers(Array.isArray(subscribersRes.data) ? subscribersRes.data : []);
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

  // ════ Campaign CRUD Handlers ════
  const openCampaignCreateModal = () => {
    setEditingCampaign(null);
    setCampId(null);
    setCampSubject('');
    setCampPoemText('');
    setCampTemplateType('minimalist');
    setCampImageFile(null);
    setCampImagePreview(null);
    setCampBgImageFile(null);
    setCampBgImagePreview(null);
    setCampBgOpacity(1.0);
    setCampBgSaturation(100);
    setCampBgPosition('center');
    setCampCtaText('');
    setCampCtaLink('');
    setCampFontFamily('serif');
    setCampErrorMsg(null);
    setCampSuccessMsg(null);
    setIsCampaignModalOpen(true);
  };

  const openCampaignEditModal = (campaign: any) => {
    setEditingCampaign(campaign);
    setCampId(campaign.id);
    setCampSubject(campaign.subject);
    setCampPoemText(campaign.poem_text);
    setCampTemplateType(campaign.template_type);
    setCampImageFile(null);
    setCampImagePreview(campaign.image || null);
    setCampBgImageFile(null);
    setCampBgImagePreview(campaign.bg_image || null);
    setCampBgOpacity(campaign.bg_opacity ?? 1.0);
    setCampBgSaturation(campaign.bg_saturation ?? 100);
    setCampBgPosition(campaign.bg_position || 'center');
    setCampCtaText(campaign.cta_text || '');
    setCampCtaLink(campaign.cta_link || '');
    setCampFontFamily(campaign.font_family || 'serif');
    setCampErrorMsg(null);
    setCampSuccessMsg(null);
    setIsCampaignModalOpen(true);
  };

  const handleCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campSubject.trim()) { setCampErrorMsg('El asunto es obligatorio.'); return; }
    if (!campPoemText.trim()) { setCampErrorMsg('El texto del poema es obligatorio.'); return; }

    setCampLoading(true);
    setCampErrorMsg(null);
    setCampSuccessMsg(null);

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const formData = new FormData();
    formData.append('subject', campSubject);
    formData.append('poem_text', campPoemText);
    formData.append('template_type', campTemplateType);
    if (campImageFile) {
      formData.append('image', campImageFile);
    }
    formData.append('bg_opacity', String(campBgOpacity));
    formData.append('bg_saturation', String(campBgSaturation));
    formData.append('bg_position', campBgPosition);
    formData.append('cta_text', campCtaText);
    formData.append('cta_link', campCtaLink);
    formData.append('font_family', campFontFamily);
    if (campBgImageFile) {
      formData.append('bg_image', campBgImageFile);
    }

    try {
      if (campId) {
        await axios.patch(`${API_URL}/blog/campaigns/${campId}/`, formData, { headers });
        setCampSuccessMsg('¡Campaña de correos actualizada con éxito!');
      } else {
        await axios.post(`${API_URL}/blog/campaigns/`, formData, { headers });
        setCampSuccessMsg('¡Campaña de correos creada con éxito!');
      }
      setIsCampaignModalOpen(false);
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      setCampErrorMsg(err.response?.data ? JSON.stringify(err.response.data) : 'Error al procesar la campaña.');
    } finally {
      setCampLoading(false);
    }
  };

  const handleCampaignDelete = async (id: number, subject: string) => {
    if (!confirm(`¿Eliminar permanentemente la campaña "${subject}"?`)) return;
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      await axios.delete(`${API_URL}/blog/campaigns/${id}/`, { headers });
      fetchDashboardData();
    } catch (err) {
      console.error('Error eliminando campaña:', err);
    }
  };

  const handleCampaignSend = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas enviar esta campaña de poemas a todos los suscriptores activos? Esta acción es irreversible.')) return;
    setSendingCampaignId(id);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      await axios.post(`${API_URL}/blog/campaigns/${id}/send_campaign/`, {}, { headers });
      alert('¡Envío de campaña iniciado con éxito en segundo plano!');
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Error al enviar la campaña.');
    } finally {
      setSendingCampaignId(null);
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importCsvFile) {
      setImportCsvError('Por favor selecciona un archivo CSV.');
      return;
    }
    setImportCsvLoading(true);
    setImportCsvError(null);
    setImportCsvSuccess(null);
    const token = localStorage.getItem('token');
    const headers = {
      Authorization: `Bearer ${token}`
    };
    const formData = new FormData();
    formData.append('file', importCsvFile);
    try {
      const res = await axios.post(`${API_URL}/blog/subscribers/import_csv/`, formData, { headers });
      setImportCsvSuccess(res.data.message || 'Importación completada con éxito.');
      setImportCsvFile(null);
      const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      setImportCsvError(err.response?.data?.error || 'Error al importar los contactos.');
    } finally {
      setImportCsvLoading(false);
    }
  };

  // ════ Theater CRUD Handlers (Nectar Pro) ════
  const openTheaterCreateModal = () => {
    setEditingTheater(null);
    setTheaterName('');
    setTheaterLocation('');
    setTheaterErrorMsg(null);
    setTheaterSuccessMsg(null);
    setIsTheaterModalOpen(true);
  };

  const openTheaterEditModal = (theater: any) => {
    setEditingTheater(theater);
    setTheaterName(theater.name);
    setTheaterLocation(theater.location || '');
    setTheaterErrorMsg(null);
    setTheaterSuccessMsg(null);
    setIsTheaterModalOpen(true);
  };

  const handleTheaterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theaterName.trim()) { setTheaterErrorMsg('El nombre del teatro es obligatorio.'); return; }
    setTheaterLoading(true);
    setTheaterErrorMsg(null);
    try {
      if (editingTheater) {
        await axios.patch(`${API_URL}/tickets/theaters/${editingTheater.id}/`, { name: theaterName, location: theaterLocation });
        setTheaterSuccessMsg('¡Teatro actualizado con éxito!');
      } else {
        await axios.post(`${API_URL}/tickets/theaters/`, { name: theaterName, location: theaterLocation, layout: { seats: [], map_elements: [] } });
        setTheaterSuccessMsg('¡Teatro creado! Ábrelo en Nectar Studio para diseñar su planta.');
      }
      setIsTheaterModalOpen(false);
      fetchDashboardData();
    } catch (err: any) {
      setTheaterErrorMsg(err.response?.data ? JSON.stringify(err.response.data) : 'Error al procesar el teatro.');
    } finally {
      setTheaterLoading(false);
    }
  };

  const handleTheaterDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar permanentemente "${name}"? Se borrarán todos los asientos y eventos asociados.`)) return;
    try {
      await axios.delete(`${API_URL}/tickets/theaters/${id}/`);
      fetchDashboardData();
    } catch (err) { console.error('Error eliminando teatro:', err); }
  };

  const handleTheaterSync = async (id: number) => {
    setTheaterSyncStatus(prev => ({ ...prev, [id]: 'loading' }));
    try {
      await axios.post(`${API_URL}/tickets/theaters/${id}/generate_seats/`);
      setTheaterSyncStatus(prev => ({ ...prev, [id]: 'success' }));
      setTimeout(() => setTheaterSyncStatus(prev => ({ ...prev, [id]: 'idle' })), 3500);
    } catch {
      setTheaterSyncStatus(prev => ({ ...prev, [id]: 'error' }));
      setTimeout(() => setTheaterSyncStatus(prev => ({ ...prev, [id]: 'idle' })), 3500);
    }
  };


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
      <div className="min-h-screen text-[#F4F6F0] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-amber-honey/20 border-t-amber-honey animate-spin" />
        <p className="text-[#F4F6F0]/60 tracking-widest font-black uppercase text-xs">Cargando Bóveda Ms Ambar...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen text-[#F4F6F0] flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full amber-glass border border-white/10 p-8 rounded-[2rem] text-center shadow-2xl shadow-black/30"
        >
          <AlertTriangle className="text-amber-honey w-16 h-16 mx-auto mb-6" />
          <h2 className="text-2xl font-black uppercase italic tracking-tight mb-2 text-[#F4F6F0]">⚠️ Acceso Limitado</h2>
          <p className="text-[#F4F6F0]/60 text-sm mb-6 leading-relaxed">
            {error}. Se requiere una cuenta de administrador registrada en el sistema.
          </p>
          <a
            href="/admin/"
            target="_blank"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-honey to-amber-gold hover:from-amber-gold hover:to-amber-500 text-[#1E2B22] font-black uppercase tracking-widest text-xs px-6 py-4 rounded-xl transition-all shadow-[0_4px_20px_rgba(229,169,59,0.2)]"
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
    <div className="min-h-screen text-[#F4F6F0] py-12 px-6 lg:px-12 relative overflow-hidden font-sans">
      {/* Background Decorative Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-honey/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-nature-sky/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Main Header */}
      <header className="mb-8 relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-[10px] text-amber-honey uppercase tracking-widest font-black flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-honey animate-ping" />
            Consola del Artista
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-[#F4F6F0] uppercase italic tracking-tighter mt-1">
            Bóveda de Resumen
          </h1>
          <p className="text-[#F4F6F0]/50 text-xs font-bold uppercase tracking-widest mt-2">
            Métricas de Ventas, Taquilla, Logística y Salud de Servidores de Ms Ambar
          </p>
        </div>

        <div className="flex gap-4">
          <Link
            href="/dashboard/performance"
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-3 rounded-xl shadow-lg transition-all text-xs font-bold uppercase tracking-widest text-[#F4F6F0]"
          >
            <Activity size={14} className="text-amber-honey" /> Rendimiento
          </Link>
          <a
            href="/admin/"
            target="_blank"
            className="flex items-center gap-2 bg-gradient-to-r from-amber-honey to-amber-500 hover:from-amber-500 hover:to-amber-600 text-[#1E2B22] font-black uppercase tracking-widest text-xs px-5 py-3 rounded-xl transition-all shadow-[0_4px_20px_rgba(229,169,59,0.15)]"
          >
            Django <ExternalLink size={14} />
          </a>
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <div className="flex gap-4 mb-8 amber-glass border border-white/10 p-2 rounded-2xl w-fit relative z-10 shadow-lg flex-wrap">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'summary'
            ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
            : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
            }`}
        >
          📊 Resumen General
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'orders'
            ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
            : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
            }`}
        >
          📦 Despacho de Pedidos
          {pendingOrdersCount > 0 && (
            <span className="w-5 h-5 bg-[#080C0A] border border-[#F4F6F0] text-[#F4F6F0] rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
              {pendingOrdersCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'expenses'
            ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
            : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
            }`}
        >
          💸 Control de Gastos
        </button>
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'catalog'
            ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
            : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
            }`}
        >
          🛍️ Catálogo de Tienda
        </button>
        <button
          onClick={() => setActiveTab('theaters')}
          className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'theaters'
            ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
            : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
            }`}
        >
          🎭 Teatros
        </button>
        <button
          onClick={() => setActiveTab('contracts')}
          className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'contracts'
            ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
            : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
            }`}
        >
          ✍️ Contratos
          {contracts.filter(c => !c.is_fully_signed).length > 0 && (
            <span className="w-5 h-5 bg-[#080C0A] border border-[#F4F6F0] text-[#F4F6F0] rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
              {contracts.filter(c => !c.is_fully_signed).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'campaigns'
            ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
            : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
            }`}
        >
          📧 Campañas de Marketing
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
                <div className="lg:col-span-2 amber-glass border border-white/10 p-6 rounded-[2rem] shadow-lg shadow-black/20 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-lg font-black uppercase italic tracking-tight flex items-center gap-2 text-[#F4F6F0]">
                        <TrendingUp size={18} className="text-amber-honey" /> Flujo de Ingresos Diarios
                      </h3>
                      <p className="text-[#F4F6F0]/50 text-[10px] font-bold uppercase tracking-widest mt-1">
                        Taquilla & Tienda - Últimos 30 días
                      </p>
                    </div>
                    {activePoint && (
                      <div className="text-right">
                        <span className="text-amber-honey font-mono text-sm font-bold">
                          ${activePoint.total.toLocaleString()}
                        </span>
                        <p className="text-[9px] text-[#F4F6F0]/50 uppercase font-black tracking-wider">
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
                          <stop offset="0%" stopColor="#E5A93B" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#E5A93B" stopOpacity="0.00" />
                        </linearGradient>
                      </defs>
                      {[0, 0.25, 0.5, 0.75, 1.0].map((ratio, idx) => {
                        const y = paddingTop + innerHeight * (1 - ratio);
                        const val = maxVal * ratio;
                        return (
                          <g key={idx}>
                            <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#ffffff" strokeOpacity="0.08" strokeDasharray="4 4" />
                            <text x={paddingLeft - 8} y={y + 4} fill="#F4F6F0" fillOpacity="0.4" fontSize="9" fontWeight="bold" textAnchor="end">${Math.round(val)}</text>
                          </g>
                        );
                      })}

                      {/* X-Axis labels with explicit and styled label for the current day (Hoy) */}
                      {points.filter((_: any, idx: number) => idx % 5 === 0 || idx === points.length - 1).map((p: any, idx: number) => {
                        const isLast = p.data.date === points[points.length - 1]?.data?.date;
                        return (
                          <text
                            key={idx}
                            x={p.x}
                            y={paddingTop + innerHeight + 18}
                            fill={isLast ? "#E5A93B" : "#F4F6F0"}
                            fillOpacity={isLast ? "0.9" : "0.4"}
                            fontSize="9"
                            fontWeight={isLast ? "black" : "bold"}
                            textAnchor="middle"
                          >
                            {isLast ? "Hoy" : p.data.date}
                          </text>
                        );
                      })}

                      {areaPath && <path d={areaPath} fill="url(#salesGradient)" />}
                      {linePath && <path d={linePath} fill="none" stroke="#E5A93B" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}

                      {/* Premium Proximity Guide Line and Glowing Dot */}
                      {activePoint && (
                        <g>
                          {/* Vertical guide line */}
                          <line
                            x1={activePoint.x}
                            y1={paddingTop}
                            x2={activePoint.x}
                            y2={paddingTop + innerHeight}
                            stroke="#E5A93B"
                            strokeOpacity="0.3"
                            strokeDasharray="4 4"
                            strokeWidth="1.5"
                          />
                          {/* Concentric glowing indicator */}
                          <circle cx={activePoint.x} cy={activePoint.y} r="8" fill="#E5A93B" fillOpacity="0.35" className="animate-pulse" />
                          <circle cx={activePoint.x} cy={activePoint.y} r="4.5" fill="#E5A93B" stroke="#ffffff" strokeWidth="2" />
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
                          className="pointer-events-none z-[100] bg-[#0B0F0D] border border-amber-honey/30 px-3 py-2 rounded-xl flex flex-col gap-0.5 shadow-xl shadow-black/30 min-w-[100px] text-center backdrop-blur-md"
                        >
                          <span className="text-[10px] font-black text-amber-honey font-mono tracking-tight">
                            ${activePoint.total.toLocaleString()}
                          </span>
                          <span className="text-[8px] text-[#F4F6F0]/50 uppercase font-black tracking-wider">
                            {activePoint.date === points[points.length - 1]?.data?.date ? 'Hoy' : activePoint.date}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Quick Operations */}
                <div className="amber-glass border border-white/10 p-6 rounded-[2rem] shadow-lg shadow-black/20 flex flex-col gap-4">
                  <h3 className="text-lg font-black uppercase italic tracking-tight mb-2 flex items-center gap-2 text-[#F4F6F0]">
                    <Layers size={18} className="text-amber-honey" /> Operaciones Rápidas
                  </h3>
                  <QuickActionBtn href="/designer" title="Diseñador de Mapas" desc="Editor de Seating Chart 2D" icon={<Layers size={18} />} />
                  <QuickActionBtn href="/dashboard/performance" title="Monitor Core Web Vitals" desc="Tiempos del Servidor y Logs" icon={<Activity size={18} />} />
                  <QuickActionBtn href="/admin/shop/product/" title="Catálogo de Productos" desc="Editar Stock de Mercancía" icon={<ShoppingBag size={18} />} external />
                  <QuickActionBtn href="/admin/tickets/event/" title="Fechas & Conciertos" desc="Programar nuevos eventos" icon={<Ticket size={18} />} external />
                  <div
                    onClick={() => setActiveTab('theaters')}
                    className="p-4 bg-white/5 border border-white/10 hover:border-amber-honey/30 hover:bg-amber-honey/[0.02] rounded-2xl shadow-md transition-all group flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-white/5 rounded-xl group-hover:bg-amber-honey/10 group-hover:scale-105 transition-all text-[#F4F6F0]/60 group-hover:text-amber-honey">
                        <MapPin size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-[#F4F6F0] group-hover:text-amber-honey transition-colors">Gestión de Teatros</h4>
                        <p className="text-[9px] uppercase tracking-widest text-[#F4F6F0]/40 group-hover:text-[#F4F6F0]/60 mt-0.5">Crear y administrar recintos</p>
                      </div>
                    </div>
                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-amber-honey" />
                  </div>

                </div>
              </div>

              {/* Health and Products section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="amber-glass border border-white/10 p-6 rounded-[2rem] shadow-lg shadow-black/20">
                  <h3 className="text-lg font-black uppercase italic tracking-tight mb-4 flex items-center gap-2 text-[#F4F6F0]">
                    <Cpu size={18} className="text-amber-honey" /> Servidor y Base de Datos
                  </h3>
                  {sysMetrics ? (
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2 text-[#F4F6F0]">
                          <span className="flex items-center gap-1 opacity-60"><Cpu size={12} /> Carga CPU ({sysMetrics.cpu?.cores} Núcleos)</span>
                          <span className="text-amber-honey">{sysMetrics.cpu?.percent}%</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-honey to-amber-500 transition-all duration-500" style={{ width: `${sysMetrics.cpu?.percent}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2 text-[#F4F6F0]">
                          <span className="flex items-center gap-1 opacity-60"><Layers size={12} /> Memoria RAM</span>
                          <span className="text-amber-honey">{sysMetrics.memory?.used_gb} / {sysMetrics.memory?.total_gb} GB</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-honey to-amber-500 transition-all duration-500" style={{ width: `${sysMetrics.memory?.percent}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2 text-[#F4F6F0]">
                          <span className="flex items-center gap-1 opacity-60"><HardDrive size={12} /> Almacenamiento SSD</span>
                          <span className="text-amber-honey">{sysMetrics.disk?.used_gb?.toFixed(1)} / {sysMetrics.disk?.total_gb?.toFixed(1)} GB</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-honey to-amber-500 transition-all duration-500" style={{ width: `${sysMetrics.disk?.percent}%` }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between">
                          <span className="text-[10px] uppercase opacity-40 font-bold text-[#F4F6F0]/60">Base de Datos</span>
                          <span className="text-sm font-black flex items-center gap-2 mt-2 text-[#F4F6F0]">
                            <Database size={14} className={sysMetrics.database?.status === 'Conectado' ? 'text-green-400' : 'text-red-400'} />
                            {sysMetrics.database?.status}
                          </span>
                        </div>
                        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between">
                          <span className="text-[10px] uppercase opacity-40 font-bold text-[#F4F6F0]/60">Uptime</span>
                          <span className="text-[11px] font-mono font-bold truncate mt-2 text-amber-honey">{sysMetrics.system?.uptime || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[#F4F6F0]/20 text-xs py-8 text-center uppercase tracking-widest font-bold">Sin datos del sistema</p>
                  )}
                </div>

                <div className="amber-glass border border-white/10 p-6 rounded-[2rem] shadow-lg shadow-black/20 lg:col-span-2">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-black uppercase italic tracking-tight flex items-center gap-2 text-[#F4F6F0]">
                      <ShoppingBag size={18} className="text-amber-honey" /> Inteligencia de Ventas (Top Merch)
                    </h3>
                    {shop?.low_stock_count > 0 && (
                      <span className="flex items-center gap-1 bg-amber-950/20 border border-amber-honey/30 text-amber-honey text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full animate-pulse">
                        <AlertTriangle size={10} /> {shop?.low_stock_count} Stock Bajo
                      </span>
                    )}
                  </div>
                  {shop?.top_products && shop.top_products.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-[9px] uppercase tracking-widest opacity-40 text-left text-[#F4F6F0]">
                            <th className="py-3 font-black">Producto</th>
                            <th className="py-3 font-black text-center">Unidades</th>
                            <th className="py-3 font-black text-right">Ingresos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shop.top_products.map((p: any, idx: number) => (
                            <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-all">
                              <td className="py-3.5 text-xs font-black text-[#F4F6F0]/85">{p.name}</td>
                              <td className="py-3.5 text-xs font-mono text-center text-amber-honey font-bold">{p.quantity}</td>
                              <td className="py-3.5 text-xs font-mono text-right text-[#F4F6F0] font-black">${p.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 opacity-30 text-center">
                      <ShoppingBag size={48} className="mb-4 text-[#F4F6F0]/30" />
                      <p className="text-xs uppercase tracking-widest font-black text-[#F4F6F0]/30">Sin ventas de mercancía registradas</p>
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
              <div className="flex gap-3 bg-white/5 border border-white/10 p-1.5 rounded-xl w-fit shadow-lg">
                {['all', 'paid', 'shipped', 'delivered'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setOrderFilter(filter as any)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${orderFilter === filter
                      ? 'bg-white/10 text-white'
                      : 'text-[#F4F6F0]/50 hover:text-[#F4F6F0] hover:bg-white/5'
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
                <div className="fixed inset-0 bg-[#0B0F0D]/60 z-[110] flex items-center justify-center p-6 backdrop-blur-md">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="max-w-md w-full bg-[#0B0F0D] border border-white/10 p-8 rounded-[2.5rem] text-center shadow-2xl shadow-black/40"
                  >
                    {shippingStep === 'contacting' && (
                      <div className="py-6 space-y-4">
                        <div className="w-12 h-12 border-4 border-amber-honey/20 border-t-amber-honey rounded-full animate-spin mx-auto" />
                        <h4 className="text-md font-black uppercase tracking-wider text-[#F4F6F0]">Despachando Guía DHL...</h4>
                        <p className="text-[10px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold">Estableciendo comunicación de paquetería</p>
                      </div>
                    )}
                    {shippingStep === 'generating' && (
                      <div className="py-6 space-y-4">
                        <div className="w-12 h-12 border-4 border-amber-honey/20 border-t-amber-gold rounded-full animate-spin mx-auto" />
                        <h4 className="text-md font-black uppercase tracking-wider text-[#F4F6F0]">Imprimiendo Guía Postal...</h4>
                        <p className="text-[10px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold">Generando archivo PDF y Tracking Number</p>
                      </div>
                    )}
                    {shippingStep === 'success' && (
                      <div className="py-6 space-y-5">
                        <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 flex items-center justify-center mx-auto animate-bounce">
                          <Check size={32} />
                        </div>
                        <div>
                          <h4 className="text-md font-black uppercase tracking-wider text-[#F4F6F0]">¡Guía Generada Exitosamente!</h4>
                          <p className="text-xs text-[#F4F6F0]/50 mt-2">El pedido ha sido entregado a paquetería.</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl text-left space-y-1">
                          <span className="text-[9px] text-[#F4F6F0]/40 uppercase tracking-widest font-black block">Código de Seguimiento</span>
                          <span className="text-xs font-mono font-bold text-amber-honey">{simulatedTracking}</span>
                        </div>
                        <button
                          onClick={() => {
                            setShippingOrderId(null);
                            setShippingStep('idle');
                          }}
                          className="w-full bg-amber-honey text-black font-black uppercase tracking-widest text-[9px] py-3.5 rounded-xl mt-4 hover:bg-amber-gold transition-all"
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
                  <div className="amber-glass border border-white/10 p-16 rounded-[2.5rem] text-center flex flex-col items-center justify-center gap-4 shadow-lg">
                    <Package size={48} className="text-[#F4F6F0]/10" />
                    <p className="text-xs uppercase tracking-widest font-black text-[#F4F6F0]/30">No se encontraron pedidos en esta categoría</p>
                  </div>
                ) : (
                  orders
                    .filter((o) => orderFilter === 'all' ? true : o.status === orderFilter)
                    .map((order) => (
                      <div key={order.id} className="amber-glass border border-white/10 p-6 rounded-[2rem] hover:border-amber-honey/20 transition-all flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative overflow-hidden group shadow-lg">
                        {/* Left Info: Meta, address, items */}
                        <div className="space-y-4 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs font-black text-[#F4F6F0]/80">Orden #{order.id}</span>
                            <span className="text-[9px] opacity-40 font-bold uppercase tracking-wider flex items-center gap-1 text-[#F4F6F0]"><Calendar size={10} /> {new Date(order.created_at).toLocaleString()}</span>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full border ${order.status === 'paid' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse' :
                              order.status === 'shipped' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                                'bg-green-500/10 border-green-500/30 text-green-400'
                              }`}>
                              {order.status === 'paid' ? 'Pendiente Envío (Pagado)' :
                                order.status === 'shipped' ? 'En Tránsito (Shipped)' :
                                  'Entregado'}
                            </span>
                          </div>

                          {/* Recipient card details */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/5 border border-white/10 p-4 rounded-xl">
                            <div className="space-y-1.5">
                              <span className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-black block">Información del Cliente</span>
                              <div className="text-xs font-black flex items-center gap-1.5 text-[#F4F6F0]"><User size={12} className="text-[#F4F6F0]/50" /> {order.full_name}</div>
                              <div className="text-[10px] text-[#F4F6F0]/60 flex items-center gap-1.5"><Mail size={12} className="text-[#F4F6F0]/50" /> {order.user_email}</div>
                            </div>
                            <div className="space-y-1.5">
                              <span className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-black block">Dirección de Despacho</span>
                              <div className="text-xs font-black flex items-center gap-1.5 text-[#F4F6F0]"><MapPin size={12} className="text-[#F4F6F0]/50" /> {order.address}</div>
                              <div className="text-[10px] text-[#F4F6F0]/60 pl-4">{order.city}, {order.country}</div>
                            </div>
                          </div>

                          {/* Items table list */}
                          <div className="space-y-1.5">
                            <span className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-black block">Artículos a Enviar</span>
                            <div className="flex flex-wrap gap-2">
                              {order.items.map((item: any, idx: number) => (
                                <span key={idx} className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-bold text-[#F4F6F0]/80">
                                  {item.quantity}x <span className="text-amber-honey font-black uppercase tracking-wider">{item.product_name}</span> (${item.price})
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Right actions: Total & Shipping Buttons */}
                        <div className="flex flex-col items-end gap-3 shrink-0 self-stretch lg:self-center justify-between border-t lg:border-t-0 border-white/10 pt-4 lg:pt-0">
                          <div className="text-right">
                            <span className="text-[9px] uppercase tracking-widest text-[#F4F6F0]/40 font-black block mb-0.5">Total Abonado</span>
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
                              <div className="p-2 bg-blue-950/20 border border-blue-500/20 rounded-lg text-[9px] text-blue-400 font-mono text-center font-bold">
                                En Tránsito
                              </div>
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                                className="border border-green-500/20 bg-green-500/10 text-green-400 font-black uppercase tracking-widest text-[9px] px-5 py-3 rounded-xl hover:bg-green-500/25 transition-all flex items-center justify-center gap-1"
                              >
                                <Check size={12} /> Confirmar Entrega
                              </motion.button>
                            </div>
                          )}

                          {order.status === 'delivered' && (
                            <div className="flex items-center gap-1 text-green-400 text-xs font-black uppercase tracking-widest border border-green-500/20 bg-green-950/20 px-4 py-2 rounded-xl">
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
                    <h3 className="text-lg font-black uppercase italic tracking-tight text-[#F4F6F0]">Registro de Gastos Históricos</h3>
                    <p className="text-[10px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold mt-0.5">Control de pérdidas y costos logísticos</p>
                  </div>
                </div>

                {expenses.length === 0 ? (
                  <div className="amber-glass border border-white/10 p-16 rounded-[2.5rem] text-center flex flex-col items-center justify-center gap-4 shadow-lg">
                    <ClipboardList size={48} className="text-[#F4F6F0]/10" />
                    <p className="text-xs uppercase tracking-widest font-black text-[#F4F6F0]/30">No se han registrado gastos operativos aún</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expenses.map((e) => (
                      <div key={e.id} className="bg-white/5 border border-white/10 p-5 rounded-2xl flex justify-between items-center gap-6 shadow-lg">
                        <div className="space-y-1">
                          <div className="text-xs font-black uppercase tracking-wider text-[#F4F6F0]">{e.title}</div>
                          {e.description && <p className="text-[10px] text-[#F4F6F0]/60 leading-relaxed max-w-md">{e.description}</p>}
                          <div className="flex gap-3 text-[9px] opacity-40 font-bold uppercase tracking-widest pt-1 text-[#F4F6F0]">
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
              <div className="amber-glass border border-white/10 p-6 rounded-[2rem] h-fit shadow-lg shadow-black/20">
                <h3 className="text-lg font-black uppercase italic tracking-tight mb-4 flex items-center gap-2 text-[#F4F6F0]">
                  <PlusCircle size={18} className="text-amber-honey" /> Registrar Gasto
                </h3>

                <form onSubmit={handleAddExpense} className="space-y-4">
                  {expenseSuccess && (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="p-3.5 bg-green-950/20 border border-green-500/20 text-green-400 rounded-xl text-xs font-bold uppercase tracking-wider text-center"
                    >
                      ¡Gasto registrado con éxito!
                    </motion.div>
                  )}

                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Título del Gasto</label>
                    <input
                      type="text"
                      required
                      value={expenseTitle}
                      onChange={(e) => setExpenseTitle(e.target.value)}
                      placeholder="Ej: Tarifas de Envío DHL"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold text-white placeholder-white/30"
                    />
                  </div>

                  {/* Amount */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Monto (USD/ARS)</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-xs font-bold">$</div>
                      <input
                        type="number"
                        required
                        step="0.01"
                        value={expenseAmount}
                        onChange={(e) => setExpenseAmount(e.target.value)}
                        placeholder="1500.00"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold font-mono text-white placeholder-white/30"
                      />
                    </div>
                  </div>

                  {/* Category Selection */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Categoría</label>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold uppercase tracking-wider text-white bg-[#121915]"
                    >
                      <option value="Logística & Envío" className="bg-[#121915]">🚚 Logística & Envío</option>
                      <option value="Producción de Merch" className="bg-[#121915]">👕 Producción de Merch</option>
                      <option value="Licencias & Hosting" className="bg-[#121915]">💻 Licencias & Hosting</option>
                      <option value="Honorarios Artistas" className="bg-[#121915]">Honorarios Artistas</option>
                      <option value="Marketing & Anuncios" className="bg-[#121915]">📢 Marketing & Anuncios</option>
                      <option value="Gastos Generales" className="bg-[#121915]">💸 Gastos Generales</option>
                    </select>
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Descripción Breve</label>
                    <textarea
                      rows={3}
                      value={expenseDesc}
                      onChange={(e) => setExpenseDesc(e.target.value)}
                      placeholder="Detalles complementarios del gasto..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold text-white placeholder-white/30"
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0B0F0D]/40 border border-white/10 p-4 rounded-[2rem] shadow-lg">
                <div className="flex gap-2 bg-white/5 border border-white/10 p-1 rounded-xl">
                  <button
                    onClick={() => setCatalogSubTab('products')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${catalogSubTab === 'products'
                      ? 'bg-white/10 text-white'
                      : 'text-[#F4F6F0]/50 hover:text-[#F4F6F0] hover:bg-white/5'
                      }`}
                  >
                    🛍️ Productos ({products.length})
                  </button>
                  <button
                    onClick={() => setCatalogSubTab('categories')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${catalogSubTab === 'categories'
                      ? 'bg-white/10 text-white'
                      : 'text-[#F4F6F0]/50 hover:text-[#F4F6F0] hover:bg-white/5'
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
                    <div className="col-span-full bg-white/5 border border-white/10 p-16 rounded-[2.5rem] text-center flex flex-col items-center justify-center gap-4 shadow-lg">
                      <ShoppingBag size={48} className="text-[#F4F6F0]/10" />
                      <p className="text-xs uppercase tracking-widest font-black text-[#F4F6F0]/30">No se encontraron productos registrados</p>
                    </div>
                  ) : (
                    products.map((product) => (
                      <div key={product.id} className="bg-white/5 border border-white/10 p-5 rounded-[2rem] hover:border-amber-honey/20 transition-all flex flex-col justify-between relative overflow-hidden group shadow-lg">
                        {/* Status badge */}
                        <div className="absolute top-4 right-4 flex gap-2 z-10">
                          <button
                            onClick={() => handleProductToggleActive(product)}
                            title={product.is_active ? "Desactivar" : "Activar"}
                            className={`p-2 rounded-xl border backdrop-blur-md transition-all ${product.is_active
                              ? 'bg-green-950/20 border-green-500/20 text-green-400'
                              : 'bg-red-950/20 border-red-500/20 text-red-400'
                              }`}
                          >
                            {product.is_active ? <Eye size={12} /> : <EyeOff size={12} />}
                          </button>
                        </div>

                        <div>
                          {/* Image Preview Container */}
                          <div className="w-full h-40 bg-white/5 border border-white/10 rounded-2xl mb-4 overflow-hidden relative flex items-center justify-center">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <ShoppingBag size={40} className="text-[#F4F6F0]/10" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="space-y-1">
                            <span className="text-[8px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-[#F4F6F0]/50 uppercase tracking-widest font-bold">
                              {product.category_name || 'Sin Categoría'}
                            </span>
                            <h4 className="text-sm font-black text-[#F4F6F0] uppercase tracking-tight line-clamp-1 pt-1">{product.name}</h4>
                            <p className="text-[10px] text-[#F4F6F0]/60 line-clamp-2 leading-relaxed h-8">{product.description || 'Sin descripción'}</p>
                          </div>
                        </div>

                        {/* Bottom Metadata & CTA */}
                        <div className="border-t border-white/10 pt-4 mt-4 flex justify-between items-center">
                          <div>
                            <span className="text-[8px] uppercase tracking-widest text-[#F4F6F0]/40 font-black block">Precio & Stock</span>
                            <div className="flex gap-2 items-baseline">
                              <span className="text-sm font-black text-amber-honey">${product.price}</span>
                              <span className={`text-[9px] font-mono font-bold ${product.stock > 5 ? 'text-[#F4F6F0]/50' : 'text-red-400 animate-pulse'}`}>
                                ({product.stock} disp.)
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => openProductEditModal(product)}
                              className="p-2.5 bg-white/5 border border-white/10 hover:border-amber-honey/30 hover:bg-amber-honey/10 text-[#F4F6F0] rounded-xl transition-all"
                              title="Editar Producto"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleProductDelete(product.id)}
                              className="p-2.5 bg-white/5 border border-white/10 hover:border-red-500/30 hover:bg-red-950/20 border-red-500/20 text-red-400 rounded-xl transition-all"
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
                    <div className="bg-white/5 border border-white/10 p-16 rounded-[2.5rem] text-center flex flex-col items-center justify-center gap-4 shadow-lg">
                      <Layers size={48} className="text-[#F4F6F0]/10" />
                      <p className="text-xs uppercase tracking-widest font-black text-[#F4F6F0]/30">No se encontraron categorías registradas</p>
                    </div>
                  ) : (
                    categories.map((category) => (
                      <div key={category.id} className="bg-white/5 border border-white/10 p-5 rounded-2xl hover:border-amber-honey/20 transition-all flex justify-between items-center gap-6 shadow-lg">
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-[#F4F6F0]">{category.name}</h4>
                          <p className="text-[10px] text-amber-honey/60 font-mono font-bold mt-0.5">slug: {category.slug}</p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => openCategoryEditModal(category)}
                            className="p-2.5 bg-white/5 border border-white/10 hover:border-amber-honey/30 hover:bg-amber-honey/10 text-[#F4F6F0] rounded-xl transition-all"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleCategoryDelete(category.id)}
                            className="p-2.5 bg-white/5 border border-white/10 hover:border-red-500/30 hover:bg-red-950/10 text-red-400 rounded-xl transition-all"
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
                <div className="fixed inset-0 bg-[#0B0F0D]/60 z-[120] flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm">
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="max-w-xl w-full bg-[#0B0F0D] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl shadow-black/40 relative my-8"
                  >
                    <button
                      onClick={() => setIsProductModalOpen(false)}
                      className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-xl text-[#F4F6F0]/50 hover:text-white transition-all"
                    >
                      <X size={16} />
                    </button>

                    <h3 className="text-xl font-black uppercase italic tracking-tight mb-6 text-[#F4F6F0] flex items-center gap-2">
                      <ShoppingBag size={20} className="text-amber-honey" />
                      {prodId ? 'Editar Producto Merch' : 'Nuevo Producto Merch'}
                    </h3>

                    <form onSubmit={handleProductSubmit} className="space-y-4">
                      {/* Name */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Nombre del Producto</label>
                        <input
                          type="text"
                          required
                          value={prodName}
                          onChange={(e) => setProdName(e.target.value)}
                          placeholder="Ej: Remera Ms Ambar Premium Black"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold text-white placeholder-white/30"
                        />
                      </div>

                      {/* Price & Stock */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Precio (USD)</label>
                          <input
                            type="number"
                            required
                            step="0.01"
                            value={prodPrice}
                            onChange={(e) => setProdPrice(e.target.value)}
                            placeholder="25.00"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold font-mono text-white placeholder-white/30"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Stock Disponible</label>
                          <input
                            type="number"
                            required
                            value={prodStock}
                            onChange={(e) => setProdStock(e.target.value)}
                            placeholder="50"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold font-mono text-white placeholder-white/30"
                          />
                        </div>
                      </div>

                      {/* Category Select */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Categoría</label>
                        <select
                          required
                          value={prodCategory}
                          onChange={(e) => setProdCategory(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold uppercase tracking-wider text-white bg-[#121915]"
                        >
                          <option value="" className="bg-[#121915] text-[#F4F6F0]">Seleccionar Categoría...</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id} className="bg-[#121915] text-[#F4F6F0]">🏷️ {c.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Image Upload */}
                      <div className="space-y-2">
                        <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Imagen del Producto</label>
                        <div className="flex gap-4 items-center bg-white/5 border border-white/10 p-4 rounded-xl">
                          <div className="w-16 h-16 bg-white/5 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-white/10">
                            {prodImagePreview ? (
                              <img src={prodImagePreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <ShoppingBag size={24} className="text-[#F4F6F0]/10" />
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
                              className="text-[10px] text-[#F4F6F0]/60 file:bg-white/5 file:border-0 file:rounded-lg file:text-[#F4F6F0] file:px-3 file:py-1.5 file:text-[9px] file:uppercase file:font-black file:tracking-widest file:mr-3 cursor-pointer hover:file:bg-white/10"
                            />
                            <p className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold">Formatos recomendados: JPG, PNG o WebP. Máx 5MB.</p>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Descripción del Producto</label>
                        <textarea
                          rows={3}
                          required
                          value={prodDesc}
                          onChange={(e) => setProdDesc(e.target.value)}
                          placeholder="Características, material, talles, etc..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold text-white placeholder-white/30"
                        />
                      </div>

                      {/* Active Status Checkbox */}
                      <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-4 rounded-xl">
                        <input
                          type="checkbox"
                          id="prodIsActive"
                          checked={prodIsActive}
                          onChange={(e) => setProdIsActive(e.target.checked)}
                          className="w-4 h-4 accent-amber-honey rounded border-white/10 cursor-pointer"
                        />
                        <label htmlFor="prodIsActive" className="text-[10px] text-[#F4F6F0]/80 uppercase tracking-widest font-black cursor-pointer selection:bg-transparent">
                          Artículo Activo (Visible en la Tienda Pública)
                        </label>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-4 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsProductModalOpen(false)}
                          className="w-1/2 bg-white/5 hover:bg-white/10 border border-white/10 text-[#F4F6F0] font-black uppercase tracking-widest text-[9px] py-4 rounded-xl transition-all"
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
                <div className="fixed inset-0 bg-[#0B0F0D]/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="max-w-md w-full bg-[#0B0F0D] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl shadow-black/40 relative"
                  >
                    <button
                      onClick={() => setIsCategoryModalOpen(false)}
                      className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-xl text-[#F4F6F0]/50 hover:text-white transition-all"
                    >
                      <X size={16} />
                    </button>

                    <h3 className="text-xl font-black uppercase italic tracking-tight mb-6 text-[#F4F6F0] flex items-center gap-2">
                      <Layers size={20} className="text-amber-honey" />
                      {catId ? 'Editar Categoría' : 'Nueva Categoría'}
                    </h3>

                    <form onSubmit={handleCategorySubmit} className="space-y-4">
                      {/* Name */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Nombre de la Categoría</label>
                        <input
                          type="text"
                          required
                          value={catName}
                          onChange={(e) => setCatName(e.target.value)}
                          placeholder="Ej: Accesorios"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold text-white placeholder-white/30"
                        />
                      </div>

                      {/* Slug */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Slug Personalizado (Opcional)</label>
                        <input
                          type="text"
                          value={catSlug}
                          onChange={(e) => setCatSlug(e.target.value)}
                          placeholder="Ej: accesorios-indumentaria"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold font-mono text-white placeholder-white/30"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex gap-4 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsCategoryModalOpen(false)}
                          className="w-1/2 bg-white/5 hover:bg-white/10 border border-white/10 text-[#F4F6F0] font-black uppercase tracking-widest text-[9px] py-4 rounded-xl transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={catalogLoading}
                          className="w-1/2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-[9px] py-4 rounded-xl flex items-center justify-center gap-1.5 shadow-[0_2px_15px_rgba(245,158,11,0.15)] disabled:opacity-50"
                        >
                          {catalogLoading ? 'Guardando...' : 'Guardar Categoría'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

                          {/* ══════ TAB 5: THEATERS MANAGEMENT ══════ */}
                            {activeTab === 'theaters' && (
                              <motion.div
                                key="theaters-tab"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-6"
                              >
                                {/* Header */}
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                  <div>
                                    <h2 className="text-2xl font-black uppercase italic tracking-tight flex items-center gap-2">
                                      <MapPin size={20} className="text-amber-500" /> Gestión de Recintos
                                    </h2>
                                    <p className="text-[#F4F6F0]/50 text-[10px] uppercase tracking-widest font-bold mt-1">
                                      Crea y administra teatros — abre cada uno en Nectar Studio para diseñar su planta
                                    </p>
                                  </div>
                                  <button
                                    onClick={openTheaterCreateModal}
                                    className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-xs px-5 py-3 rounded-xl transition-all shadow-[0_4px_20px_rgba(245,158,11,0.15)]"
                                  >
                                    <Plus size={15} /> Nuevo Teatro
                                  </button>
                                </div>

                                {/* Success / Error messages */}
                                {theaterSuccessMsg && (
                                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl">
                                    <Check size={14} className="text-green-600 shrink-0" />
                                    <p className="text-xs font-bold text-green-600">{theaterSuccessMsg}</p>
                                  </motion.div>
                                )}
                                {theaterErrorMsg && (
                                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                                    <AlertTriangle size={14} className="text-red-600 shrink-0" />
                                    <p className="text-xs font-bold text-red-600">{theaterErrorMsg}</p>
                                  </motion.div>
                                )}

                                {/* Theaters Grid */}
                                {theaters.length === 0 ? (
                                  <div className="bg-white/5 border border-white/10 rounded-[2rem] p-16 flex flex-col items-center gap-4 text-center shadow-lg shadow-black/20">
                                    <MapPin size={48} className="text-[#F4F6F0]/20" />
                                    <p className="text-[#F4F6F0]/40 text-xs uppercase tracking-widest font-black">Sin teatros registrados</p>
                                    <p className="text-[#F4F6F0]/30 text-[10px] font-bold">Crea tu primer recinto para comenzar a vender boletos</p>
                                    <button onClick={openTheaterCreateModal} className="mt-4 px-6 py-3 bg-amber-honey text-black font-black uppercase tracking-widest rounded-xl hover:bg-amber-gold transition-all">
                                      Crear primer Teatro
                                    </button>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {theaters.map((theater: any) => {
                                      const seatCount = theater.seats?.length ?? 0;
                                      const syncSt = theaterSyncStatus[theater.id] || 'idle';
                                      return (
                                        <motion.div
                                          key={theater.id}
                                          whileHover={{ y: -4 }}
                                          className="bg-white/5 border border-white/10 hover:border-amber-honey/40 rounded-[2rem] p-6 flex flex-col gap-5 transition-all shadow-lg shadow-black/20"
                                        >
                                          {/* Card Header */}
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                              <div className="w-11 h-11 rounded-2xl bg-amber-honey/10 border border-amber-honey/20 flex items-center justify-center shrink-0">
                                                <MapPin size={18} className="text-amber-honey" />
                                              </div>
                                              <div>
                                                <h3 className="text-sm font-black text-[#F4F6F0] leading-tight">{theater.name}</h3>
                                                <p className="text-[9px] text-[#F4F6F0]/50 uppercase tracking-widest font-bold mt-0.5">{theater.location || 'Sin ubicación'}</p>
                                              </div>
                                            </div>
                                            <span className="shrink-0 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[#F4F6F0]/60">
                                              ID #{theater.id}
                                            </span>
                                          </div>

                                          {/* Stats row */}
                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                                              <p className="text-[8px] uppercase tracking-widest text-[#F4F6F0]/50 font-bold">Asientos</p>
                                              <p className="text-lg font-black text-[#F4F6F0] mt-1">{seatCount}</p>
                                            </div>
                                            <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                                              <p className="text-[8px] uppercase tracking-widest text-[#F4F6F0]/50 font-bold">Zonas GA</p>
                                              <p className="text-lg font-black text-[#F4F6F0] mt-1">{theater.ga_zones?.length ?? 0}</p>
                                            </div>
                                          </div>

                                          {/* Actions */}
                                          <div className="flex flex-col gap-2">
                                            {/* Sync seats button */}
                                            <button
                                              onClick={() => handleTheaterSync(theater.id)}
                                              disabled={syncSt === 'loading'}
                                              className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${syncSt === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                                                syncSt === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                                  'bg-white/5 border border-white/10 text-[#F4F6F0]/60 hover:bg-white/10 hover:text-white'
                                                }`}
                                            >
                                              {syncSt === 'loading' ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> :
                                                syncSt === 'success' ? <Check size={12} /> :
                                                  syncSt === 'error' ? <AlertTriangle size={12} /> :
                                                    <Layers size={12} />}
                                              {syncSt === 'success' ? 'Asientos Sincronizados' : syncSt === 'error' ? 'Error al Sincronizar' : 'Sincronizar Asientos'}
                                            </button>

                                            {/* Secondary actions */}
                                            <div className="grid grid-cols-3 gap-2">
                                              <Link
                                                href="/designer"
                                                onClick={() => { }}
                                                className="py-2.5 rounded-xl text-[8px] font-black uppercase tracking-wider text-center bg-amber-honey/10 border border-amber-honey/20 text-amber-honey hover:bg-amber-honey hover:text-black hover:font-bold transition-all flex items-center justify-center gap-1"
                                              >
                                                <Layers size={11} /> Diseñar
                                              </Link>
                                              <button
                                                onClick={() => openTheaterEditModal(theater)}
                                                className="py-2.5 rounded-xl text-[8px] font-black uppercase tracking-wider bg-white/5 border border-white/10 text-[#F4F6F0]/60 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-1"
                                              >
                                                <Edit2 size={11} /> Editar
                                              </button>
                                              <button
                                                onClick={() => handleTheaterDelete(theater.id, theater.name)}
                                                className="py-2.5 rounded-xl text-[8px] font-black uppercase tracking-wider bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-1"
                                              >
                                                <Trash2 size={11} /> Borrar
                                              </button>
                                            </div>
                                          </div>
                                        </motion.div>
                                      );
                                    })}
                                  </div>
                                )}
                              </motion.div>
                            )}

                          {/* ══════ THEATER MODAL (Dashboard) ══════ */}
                          <AnimatePresence>
                            {isTheaterModalOpen && (
                              <div
                                className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-[#0B0F0D]/60 backdrop-blur-md"
                                onClick={(e) => { if (e.target === e.currentTarget) setIsTheaterModalOpen(false); }}
                              >
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.93, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93, y: 20 }}
                                  transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                                  className="w-full max-w-md bg-[#0B0F0D] border border-white/10 rounded-[2rem] p-8 shadow-2xl shadow-black/40"
                                >
                                  <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                      <div className="w-12 h-12 bg-amber-honey/10 border border-amber-honey/20 rounded-2xl flex items-center justify-center">
                                        <MapPin size={20} className="text-amber-honey" />
                                      </div>
                                      <div>
                                        <h2 className="text-[13px] font-black uppercase tracking-[0.25em] text-[#F4F6F0]">
                                          {editingTheater ? 'Editar Teatro' : 'Nuevo Teatro'}
                                        </h2>
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-amber-honey mt-0.5">Nectar Studio — Venue Management</p>
                                      </div>
                                    </div>
                                    <button onClick={() => setIsTheaterModalOpen(false)} className="w-9 h-9 rounded-xl bg-white/5 text-[#F4F6F0]/40 hover:bg-white/10 hover:text-white flex items-center justify-center transition-all">
                                      <X size={16} />
                                    </button>
                                  </div>

                                  <form onSubmit={handleTheaterSubmit} className="space-y-5">
                                    <div className="space-y-2">
                                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F4F6F0]/60 block">Nombre del Recinto *</label>
                                      <input
                                        type="text" autoFocus value={theaterName} onChange={(e) => setTheaterName(e.target.value)}
                                        placeholder="Ej: Teatro Metropólitan CDMX"
                                        className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold outline-none focus:border-amber-honey transition-all placeholder:text-white/30"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F4F6F0]/60 block">Ubicación / Ciudad</label>
                                      <input
                                        type="text" value={theaterLocation} onChange={(e) => setTheaterLocation(e.target.value)}
                                        placeholder="Ej: Ciudad de México, CDMX"
                                        className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold outline-none focus:border-amber-honey transition-all placeholder:text-white/30"
                                      />
                                    </div>
                                    {!editingTheater && (
                                      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-honey/10 border border-amber-honey/20">
                                        <Calendar size={14} className="text-amber-honey mt-0.5 shrink-0" />
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-[#F4F6F0]/70 leading-relaxed">
                                          Después de crear el teatro, ábrelo en Nectar Studio Designer para diseñar la planta y agregar butacas.
                                        </p>
                                      </div>
                                    )}
                                    {theaterErrorMsg && (
                                      <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                                        <AlertTriangle size={13} className="text-red-400 shrink-0" />
                                        <p className="text-[10px] font-bold text-red-400">{theaterErrorMsg}</p>
                                      </div>
                                    )}
                                    <div className="flex gap-3 pt-2">
                                      <button type="button" onClick={() => setIsTheaterModalOpen(false)} className="flex-1 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] bg-white/5 border border-white/10 text-[#F4F6F0]/60 hover:bg-white/10 transition-all">
                                        Cancelar
                                      </button>
                                      <button type="submit" disabled={theaterLoading} className="flex-1 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] bg-gradient-to-r from-amber-500 to-amber-600 text-black flex items-center justify-center gap-2 shadow-[0_2px_15px_rgba(245,158,11,0.2)] disabled:opacity-50">
                                        {theaterLoading
                                          ? <><div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Guardando...</>
                                          : <><Check size={13} /> {editingTheater ? 'Guardar Cambios' : 'Crear Teatro'}</>
                                        }
                                      </button>
                                    </div>
                                  </form>
                                </motion.div>
                              </div>
                            )}
                          </AnimatePresence>

                          {/* ══════ TAB 6: CONTRACTS PIPELINE ══════ */}
                            {activeTab === 'contracts' && (
                              <motion.div
                                key="contracts-tab"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-6"
                              >
                                {/* Header */}
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                                  <div>
                                    <h2 className="text-2xl font-black uppercase italic tracking-tight flex items-center gap-2 text-[#F4F6F0]">
                                      ✍️ Pipeline de Contratos Artísticos
                                    </h2>
                                    <p className="text-[#F4F6F0]/50 text-[10px] uppercase tracking-widest font-bold mt-1">
                                      Monitorea, comparte enlaces y contrafirma acuerdos digitales de MS Ambar
                                    </p>
                                  </div>
                                </div>

                                {/* Pipeline Kanban Columns */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                                  {/* Column 1: Generated/Pending Client Signature */}
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between px-3 pb-2 border-b border-white/10">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-honey flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-honey animate-pulse" /> Propuestas (Cliente Pendiente)
                                      </span>
                                      <span className="text-[10px] font-black text-[#F4F6F0]/60 bg-white/5 px-2 py-0.5 rounded-full">
                                        {contracts.filter(c => !c.signature_base64).length}
                                      </span>
                                    </div>

                                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                                      {contracts.filter(c => !c.signature_base64).length === 0 ? (
                                        <div className="p-8 text-center rounded-[2rem] border border-white/10 bg-white/5 text-xs text-[#F4F6F0]/40 italic">
                                          No hay propuestas pendientes
                                        </div>
                                      ) : (
                                        contracts.filter(c => !c.signature_base64).map((c: any) => (
                                          <div key={c.id} className="p-6 rounded-3xl border border-white/10 bg-white/5 space-y-4 hover:border-amber-honey/30 transition-all shadow-lg shadow-black/20">
                                            <div className="space-y-1">
                                              <h4 className="text-sm font-black text-[#F4F6F0]">{c.inquiry_detail?.name || 'Promotor'}</h4>
                                              <p className="text-[8px] font-bold text-[#F4F6F0]/50 uppercase tracking-widest">
                                                {c.inquiry_detail?.company || 'Particular'}
                                              </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 pt-2 text-[10px]">
                                              <div>
                                                <p className="opacity-40 uppercase font-bold text-[8px]">Fecha Show</p>
                                                <p className="font-bold text-[#F4F6F0]/80">{c.inquiry_detail?.date || 'Definir'}</p>
                                              </div>
                                              <div>
                                                <p className="opacity-40 uppercase font-bold text-[8px]">Honorarios</p>
                                                <p className="font-bold text-amber-honey">${parseFloat(c.fee).toLocaleString('es-MX')} MXN</p>
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => {
                                                const link = `${window.location.origin}/bookings/sign/${c.id}`;
                                                navigator.clipboard.writeText(link);
                                                alert('Enlace de firma copiado al portapapeles!');
                                              }}
                                              className="w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-[#F4F6F0]/70 transition-all text-center block"
                                            >
                                              🔗 Copiar Enlace de Firma
                                            </button>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>

                                  {/* Column 2: Waiting for Manager Countersign */}
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between px-3 pb-2 border-b border-white/10">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-yellow-600 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-ping" /> Esperando Contrafirma
                                      </span>
                                      <span className="text-[10px] font-black text-[#F4F6F0]/60 bg-white/5 px-2 py-0.5 rounded-full">
                                        {contracts.filter(c => c.signature_base64 && !c.is_fully_signed).length}
                                      </span>
                                    </div>

                                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                                      {contracts.filter(c => c.signature_base64 && !c.is_fully_signed).length === 0 ? (
                                        <div className="p-8 text-center rounded-[2rem] border border-white/10 bg-white/5 text-xs text-[#F4F6F0]/40 italic">
                                          Ningún acuerdo pendiente de firma de management
                                        </div>
                                      ) : (
                                        contracts.filter(c => c.signature_base64 && !c.is_fully_signed).map((c: any) => (
                                          <div key={c.id} className="p-6 rounded-3xl border border-yellow-500/20 bg-white/5 space-y-4 hover:border-yellow-500/40 transition-all shadow-lg shadow-black/20">
                                            <div className="space-y-1">
                                              <h4 className="text-sm font-black text-[#F4F6F0]">{c.inquiry_detail?.name || 'Promotor'}</h4>
                                              <p className="text-[8px] font-bold text-[#F4F6F0]/50 uppercase tracking-widest">
                                                {c.inquiry_detail?.company || 'Particular'}
                                              </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 pt-2 text-[10px]">
                                              <div>
                                                <p className="opacity-40 uppercase font-bold text-[8px]">Fecha Show</p>
                                                <p className="font-bold text-[#F4F6F0]/80">{c.inquiry_detail?.date || 'Definir'}</p>
                                              </div>
                                              <div>
                                                <p className="opacity-40 uppercase font-bold text-[8px]">Honorarios</p>
                                                <p className="font-bold text-amber-honey">${parseFloat(c.fee).toLocaleString('es-MX')} MXN</p>
                                              </div>
                                            </div>
                                            <Link
                                              href={`/bookings/sign/${c.id}`}
                                              className="w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-yellow-500 hover:bg-yellow-600 text-black font-black transition-all text-center block"
                                            >
                                              ✍️ Firmar como Manager
                                            </Link>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>

                                  {/* Column 3: Fully Signed and Certified */}
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between px-3 pb-2 border-b border-white/10">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Cerrados y Certificados
                                      </span>
                                      <span className="text-[10px] font-black text-[#F4F6F0]/60 bg-white/5 px-2 py-0.5 rounded-full">
                                        {contracts.filter(c => c.is_fully_signed).length}
                                      </span>
                                    </div>

                                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                                      {contracts.filter(c => c.is_fully_signed).length === 0 ? (
                                        <div className="p-8 text-center rounded-[2rem] border border-white/10 bg-white/5 text-xs text-[#F4F6F0]/40 italic">
                                          No hay contratos cerrados todavía
                                        </div>
                                      ) : (
                                        contracts.filter(c => c.is_fully_signed).map((c: any) => {
                                          const pdfUrl = c.pdf_file ? (c.pdf_file.startsWith('http') ? c.pdf_file : `${API_URL.replace('/api', '')}${c.pdf_file}`) : '#';
                                          return (
                                            <div key={c.id} className="p-6 rounded-3xl border border-emerald-500/20 bg-white/5 space-y-4 hover:border-emerald-500/40 transition-all shadow-lg shadow-black/20">
                                              <div className="space-y-1">
                                                <h4 className="text-sm font-black text-[#F4F6F0]">{c.inquiry_detail?.name || 'Promotor'}</h4>
                                                <p className="text-[8px] font-bold text-[#F4F6F0]/50 uppercase tracking-widest">
                                                  {c.inquiry_detail?.company || 'Particular'}
                                                </p>
                                              </div>
                                              <div className="grid grid-cols-2 gap-4 pt-2 text-[10px]">
                                                <div>
                                                  <p className="opacity-40 uppercase font-bold text-[8px]">Fecha Show</p>
                                                  <p className="font-bold text-[#F4F6F0]/80">{c.inquiry_detail?.date || 'Definir'}</p>
                                                </div>
                                                <div>
                                                  <p className="opacity-40 uppercase font-bold text-[8px]">Honorarios</p>
                                                  <p className="font-bold text-emerald-400">${parseFloat(c.fee).toLocaleString('es-MX')} MXN</p>
                                                </div>
                                              </div>
                                              <a
                                                href={pdfUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all text-center block border border-emerald-500/20"
                                              >
                                                📄 Descargar Contrato PDF
                                              </a>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>

                                </div>

                              </motion.div>
                            )}

                            {/* TAB 7: EMAIL CAMPAIGNS */}
                            {activeTab === 'campaigns' && (
                              <motion.div
                                key="campaigns-tab"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-8"
                              >
                                {/* Campaigns Sub-Tab Navigation Bar */}
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 amber-glass border border-white/10 p-4 rounded-[2rem]">
                                  <div className="flex gap-2 bg-white/5 border border-white/10 p-1 rounded-xl">
                                    <button
                                      onClick={() => setCampaignSubTab('campaigns')}
                                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${campaignSubTab === 'campaigns'
                                        ? 'bg-amber-honey text-[#1E2B22] shadow-sm'
                                        : 'text-[#F4F6F0]/50 hover:text-[#F4F6F0] hover:bg-white/5'
                                        }`}
                                    >
                                      📧 Campañas de Marketing ({campaigns.length})
                                    </button>
                                    <button
                                      onClick={() => setCampaignSubTab('subscribers')}
                                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${campaignSubTab === 'subscribers'
                                        ? 'bg-amber-honey text-[#1E2B22] shadow-sm'
                                        : 'text-[#F4F6F0]/50 hover:text-[#F4F6F0] hover:bg-white/5'
                                        }`}
                                    >
                                      👥 Lista de Suscriptores ({subscribers.length})
                                    </button>
                                  </div>

                                  {campaignSubTab === 'campaigns' ? (
                                    <button
                                      onClick={openCampaignCreateModal}
                                      className="bg-amber-honey text-black px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-gold transition-all flex items-center gap-2"
                                    >
                                      <Plus size={14} /> Nueva Campaña
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-[#F4F6F0]/50 uppercase tracking-widest font-black pr-4">
                                      Importación y Gestión de Contactos
                                    </span>
                                  )}
                                </div>

                                {campaignSubTab === 'campaigns' && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {campaigns.length === 0 ? (
                                      <div className="col-span-full p-12 text-center rounded-[2rem] border border-white/10 bg-white/5 text-xs text-[#F4F6F0]/40 italic">
                                        No has creado ninguna campaña de Marketing todavía.
                                      </div>
                                    ) : (
                                      campaigns.map((c: any) => (
                                        <div key={c.id} className="p-6 rounded-[2rem] border border-white/10 bg-white/5 space-y-4 hover:border-amber-honey/40 transition-all flex flex-col justify-between shadow-lg shadow-black/20">
                                          <div className="space-y-3">
                                            <div className="flex justify-between items-start">
                                              <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${c.template_type === 'moss' ? 'bg-green-950 text-green-300 border border-green-800' :
                                                c.template_type === 'cosmic' ? 'bg-purple-950 text-purple-300 border border-purple-800' :
                                                  c.template_type === 'glow' ? 'bg-yellow-950 text-yellow-300 border border-yellow-800' :
                                                    c.template_type === 'mist' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                                                      'bg-neutral-900 text-neutral-300 border border-neutral-700'
                                                }`}>
                                                {c.template_type === 'minimalist' ? 'Minimalist Carbon' :
                                                  c.template_type === 'moss' ? 'Moss Green' :
                                                    c.template_type === 'cosmic' ? 'Cosmic Night' :
                                                      c.template_type === 'glow' ? 'Amber Glow' :
                                                        c.template_type === 'mist' ? 'Mystic Mist' : c.template_type}
                                              </span>

                                              {c.is_sent ? (
                                                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
                                                  Enviada
                                                </span>
                                              ) : (
                                                <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
                                                  Borrador
                                                </span>
                                              )}
                                            </div>

                                            <div>
                                              <h4 className="text-base font-black text-[#F4F6F0] leading-snug line-clamp-2">{c.subject}</h4>
                                              <p className="text-[9px] text-[#F4F6F0]/50 font-bold uppercase tracking-widest mt-1">
                                                Creado: {new Date(c.created_at).toLocaleDateString('es-MX')}
                                              </p>
                                              {c.is_sent && c.sent_at && (
                                                <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest font-mono">
                                                  Enviado: {new Date(c.sent_at).toLocaleDateString('es-MX')}
                                                </p>
                                              )}
                                            </div>

                                            <p className="text-xs text-[#F4F6F0]/70 line-clamp-4 italic bg-white/5 p-4 rounded-2xl border border-white/10 whitespace-pre-line">
                                              {c.poem_text.substring(0, 180)}{c.poem_text.length > 180 ? '...' : ''}
                                            </p>
                                          </div>

                                          <div className="flex gap-2 pt-4 border-t border-white/10">
                                            <button
                                              onClick={() => setPreviewCampaign(c)}
                                              className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 text-[#F4F6F0]/70"
                                            >
                                              <Eye size={12} /> Previsualizar
                                            </button>

                                            {!c.is_sent && (
                                              <>
                                                <button
                                                  onClick={() => openCampaignEditModal(c)}
                                                  className="w-10 h-10 bg-white/5 hover:bg-amber-honey/10 border border-white/10 hover:border-amber-honey/30 rounded-xl flex items-center justify-center text-[#F4F6F0]/60 hover:text-amber-honey transition-all"
                                                  title="Editar"
                                                >
                                                  <Edit2 size={12} />
                                                </button>
                                                <button
                                                  onClick={() => handleCampaignSend(c.id)}
                                                  disabled={sendingCampaignId === c.id}
                                                  className="flex-1 py-2 bg-amber-honey hover:bg-amber-gold text-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 font-bold shadow-lg shadow-amber-honey/15"
                                                >
                                                  {sendingCampaignId === c.id ? 'Enviando...' : '🚀 Enviar'}
                                                </button>
                                              </>
                                            )}
                                            <button
                                              onClick={() => handleCampaignDelete(c.id, c.subject)}
                                              className="w-10 h-10 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 rounded-xl flex items-center justify-center text-[#F4F6F0]/40 hover:text-red-400 transition-all"
                                              title="Eliminar"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}

                                {campaignSubTab === 'subscribers' && (
                                  <div className="space-y-6">
                                    {/* Summary & CSV Uploader split */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                      {/* Stats */}
                                      <div className="amber-glass border border-white/10 p-6 rounded-[2rem] flex flex-col justify-between gap-4 shadow-lg shadow-black/20">
                                        <div>
                                          <h4 className="text-xs font-black uppercase tracking-wider text-[#F4F6F0]/50 mb-4">Métricas del Newsletter</h4>
                                          <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                                              <span className="text-[8px] uppercase tracking-widest opacity-40 font-bold block">Activos</span>
                                              <span className="text-2xl font-black text-[#F4F6F0] font-mono">{subscribers.filter(s => s.is_active).length}</span>
                                            </div>
                                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                                              <span className="text-[8px] uppercase tracking-widest opacity-40 font-bold block">Premium</span>
                                              <span className="text-2xl font-black text-amber-honey font-mono">{subscribers.filter(s => s.is_premium).length}</span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-[10px] text-[#F4F6F0]/50 uppercase tracking-widest font-black pl-1">
                                          Total en Bóveda: {subscribers.length} contactos
                                        </div>
                                      </div>

                                      {/* CSV Importer Form */}
                                      <div className="lg:col-span-2 amber-glass border border-white/10 p-6 rounded-[2rem] shadow-lg shadow-black/20">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-amber-honey flex items-center gap-2 mb-2">
                                          📥 Importador Masivo de Contactos (CSV)
                                        </h4>
                                        <p className="text-[9px] text-[#F4F6F0]/50 uppercase tracking-widest font-bold mb-4">
                                          Sube un archivo para importar o actualizar tu lista. Columnas soportadas: subscriber_id, api_subscription_id, email, tags, status, premium?, created_at
                                        </p>

                                        <form onSubmit={handleCsvImport} className="flex flex-col sm:flex-row gap-4 items-end">
                                          <div className="space-y-1.5 flex-1 w-full">
                                            <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Seleccionar Archivo CSV</label>
                                            <input
                                              type="file"
                                              id="csv-file-input"
                                              accept=".csv"
                                              onChange={e => {
                                                const file = e.target.files?.[0] || null;
                                                setImportCsvFile(file);
                                              }}
                                              className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold file:bg-white/10 file:border-0 file:rounded-lg file:text-[#F4F6F0]/70 file:px-3 file:py-1 file:text-[9px] file:uppercase file:font-black file:tracking-widest file:mr-3 cursor-pointer hover:file:bg-white/20"
                                            />
                                          </div>
                                          <button
                                            type="submit"
                                            disabled={importCsvLoading}
                                            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-[9px] px-6 py-4 rounded-xl transition-all shadow-[0_2px_15px_rgba(245,158,11,0.15)] disabled:opacity-50 w-full sm:w-auto self-stretch sm:self-end flex items-center justify-center gap-2"
                                          >
                                            {importCsvLoading ? (
                                              <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                            ) : (
                                              'Importar Contactos'
                                            )}
                                          </button>
                                        </form>

                                        {importCsvSuccess && (
                                          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/25 text-green-400 rounded-xl text-xs font-bold uppercase tracking-wider text-center">
                                            {importCsvSuccess}
                                          </div>
                                        )}
                                        {importCsvError && (
                                          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider text-center">
                                            {importCsvError}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Subscribers list table */}
                                    <div className="amber-glass border border-white/10 rounded-[2rem] p-6 overflow-hidden shadow-lg shadow-black/20">
                                      <h4 className="text-xs font-black uppercase tracking-wider text-[#F4F6F0] mb-4">Lista de Contactos</h4>
                                      {subscribers.length === 0 ? (
                                        <div className="p-8 text-center text-xs text-[#F4F6F0]/40 italic">
                                          No hay suscriptores en la base de datos.
                                        </div>
                                      ) : (
                                        <div className="overflow-x-auto">
                                          <table className="w-full border-collapse">
                                            <thead>
                                              <tr className="border-b border-white/10 text-[9px] uppercase tracking-widest text-[#F4F6F0]/50 text-left">
                                                <th className="py-3 font-black">Email</th>
                                                <th className="py-3 font-black">ID Suscriptor</th>
                                                <th className="py-3 font-black">ID API</th>
                                                <th className="py-3 font-black">Tags</th>
                                                <th className="py-3 font-black text-center">Estado</th>
                                                <th className="py-3 font-black text-center">Premium</th>
                                                <th className="py-3 font-black text-right">Fecha Registro</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {subscribers.map((s: any, idx: number) => (
                                                <tr key={idx} className="border-b border-white/10 last:border-0 hover:bg-white/5 transition-all text-xs">
                                                  <td className="py-3 font-black text-[#F4F6F0]">{s.email}</td>
                                                  <td className="py-3 font-mono text-[#F4F6F0]/55">{s.subscriber_id || '-'}</td>
                                                  <td className="py-3 font-mono text-[#F4F6F0]/55">{s.api_subscription_id || '-'}</td>
                                                  <td className="py-3">
                                                    {s.tags ? (
                                                      <div className="flex flex-wrap gap-1">
                                                        {s.tags.split(',').map((t: string, i: number) => (
                                                          <span key={i} className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-[8px] font-bold text-[#F4F6F0]/60">
                                                            {t.trim()}
                                                          </span>
                                                        ))}
                                                      </div>
                                                    ) : (
                                                      <span className="text-[#F4F6F0]/40">-</span>
                                                    )}
                                                  </td>
                                                  <td className="py-3 text-center">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${s.is_active ? 'bg-green-500/10 border border-green-500/25 text-green-400' : 'bg-red-500/10 border border-red-500/25 text-red-400'
                                                      }`}>
                                                      {s.is_active ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                  </td>
                                                  <td className="py-3 text-center">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${s.is_premium ? 'bg-amber-honey/20 border border-amber-honey/30 text-amber-honey' : 'bg-white/5 border border-white/10 text-[#F4F6F0]/40'
                                                      }`}>
                                                      {s.is_premium ? 'Premium' : 'Estándar'}
                                                    </span>
                                                  </td>
                                                  <td className="py-3 font-mono text-right text-[#F4F6F0]/55">
                                                    {new Date(s.created_at).toLocaleDateString('es-MX')}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Campaign Creation/Edition Modal */}
                          {isCampaignModalOpen && (
                            <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-6 overflow-y-auto">
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="amber-glass border border-white/10 w-full max-w-2xl rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative"
                              >
                                <button
                                  onClick={() => setIsCampaignModalOpen(false)}
                                  className="absolute top-6 right-6 w-9 h-9 rounded-xl border border-white/10 text-[#F4F6F0]/40 hover:text-[#F4F6F0] flex items-center justify-center transition-all hover:bg-white/5"
                                >
                                  <X size={16} />
                                </button>

                                <div>
                                  <h3 className="text-xl font-black uppercase italic tracking-tight text-[#F4F6F0]">
                                    {campId ? 'Editar Campaña de Poemas' : 'Nueva Campaña de Poemas'}
                                  </h3>
                                  <p className="text-[9px] text-[#F4F6F0]/55 uppercase tracking-widest font-bold mt-1">
                                    Redacta y elige el diseño de fondo premium
                                  </p>
                                </div>

                                <form onSubmit={handleCampaignSubmit} className="space-y-6">
                                  {campErrorMsg && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-bold uppercase tracking-wide">
                                      ⚠️ {campErrorMsg}
                                    </div>
                                  )}

                                  <div className="space-y-2">
                                    <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Asunto del Correo</label>
                                    <input
                                      type="text"
                                      value={campSubject}
                                      onChange={e => setCampSubject(e.target.value)}
                                      placeholder="Ej. Susurros del Desierto - Un poema de Ms Ambar"
                                      required
                                      className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:border-amber-honey transition-all placeholder:text-[#F4F6F0]/30"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Plantilla de Fondo / Diseño Premium</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                      {[
                                        { id: 'minimalist', name: 'Carbon', desc: 'Negro & Ámbar', class: 'bg-[#0c0d13] border-amber-honey/40 text-amber-honey' },
                                        { id: 'moss', name: 'Moss', desc: 'Verde Musgo', class: 'bg-[#122017] border-green-800 text-green-300' },
                                        { id: 'cosmic', name: 'Cosmic', desc: 'Índigo Cósmico', class: 'bg-[#0c0a1a] border-purple-800 text-purple-300' },
                                        { id: 'glow', name: 'Glow', desc: 'Cálido Miel', class: 'bg-[#1a130c] border-amber-700 text-amber-500' },
                                        { id: 'mist', name: 'Mist', desc: 'Gris Pizarra', class: 'bg-[#181b22] border-cyan-800 text-cyan-400' },
                                      ].map(t => (
                                        <div
                                          key={t.id}
                                          onClick={() => setCampTemplateType(t.id)}
                                          className={`p-3 rounded-2xl border cursor-pointer text-center transition-all hover:scale-102 flex flex-col justify-center items-center gap-1 ${t.class} ${campTemplateType === t.id ? 'ring-2 ring-amber-honey border-transparent' : 'opacity-65 hover:opacity-100'
                                            }`}
                                        >
                                          <span className="text-[10px] font-black uppercase tracking-wider">{t.name}</span>
                                          <span className="text-[7px] font-bold uppercase tracking-widest opacity-60">{t.desc}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Cuerpo del Poema (Líricas)</label>
                                    <textarea
                                      value={campPoemText}
                                      onChange={e => setCampPoemText(e.target.value)}
                                      placeholder="Escribe el poema aquí con saltos de línea normales..."
                                      required
                                      rows={8}
                                      className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:border-amber-honey transition-all resize-none placeholder:text-[#F4F6F0]/30"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Imagen de Portada (Opcional)</label>
                                    <div className="flex items-center gap-4">
                                      {campImagePreview && (
                                        <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/10">
                                          <img src={campImagePreview} alt="Preview" className="w-full h-full object-cover" />
                                        </div>
                                      )}
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={e => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            setCampImageFile(file);
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                              setCampImagePreview(reader.result as string);
                                            };
                                            reader.readAsDataURL(file);
                                          };
                                        }}
                                        className="text-xs text-[#F4F6F0]/70 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-white/10 file:text-[#F4F6F0] file:cursor-pointer hover:file:bg-white/20"
                                      />
                                    </div>
                                  </div>

                                  {/* Advanced Background Design Settings */}
                                  <div className="bg-white/5 border border-white/10 p-5 rounded-3xl space-y-4">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-honey flex items-center gap-2">
                                      🖼️ Configuración de Fondo del Correo
                                    </h4>

                                    {/* Background Image Upload */}
                                    <div className="space-y-2">
                                      <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Imagen de Fondo (Opcional)</label>
                                      <div className="flex gap-4 items-center bg-white/5 border border-white/10 p-4 rounded-xl">
                                        <div className="w-16 h-16 bg-white/5 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-white/10">
                                          {campBgImagePreview ? (
                                            <img src={campBgImagePreview} alt="Background Preview" className="w-full h-full object-cover" />
                                          ) : (
                                            <Eye size={20} className="text-[#F4F6F0]/20" />
                                          )}
                                        </div>
                                        <div className="space-y-1 flex-1">
                                          <input
                                            type="file"
                                            accept="image/*"
                                            onChange={e => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                setCampBgImageFile(file);
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                  setCampBgImagePreview(reader.result as string);
                                                };
                                                reader.readAsDataURL(file);
                                              }
                                            }}
                                            className="text-[10px] text-[#F4F6F0]/70 file:bg-white/10 file:border-0 file:rounded-lg file:text-[#F4F6F0] file:px-3 file:py-1.5 file:text-[9px] file:uppercase file:font-black file:tracking-widest file:mr-3 cursor-pointer hover:file:bg-white/20"
                                          />
                                          <p className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold">Añade una imagen que se blendeará con la plantilla.</p>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Sliders and Selects */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                      {/* Opacity */}
                                      <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black">
                                          <span>Opacidad</span>
                                          <span className="text-amber-honey font-mono">{Math.round(campBgOpacity * 100)}%</span>
                                        </div>
                                        <input
                                          type="range"
                                          min="0"
                                          max="1"
                                          step="0.05"
                                          value={campBgOpacity}
                                          onChange={e => setCampBgOpacity(parseFloat(e.target.value))}
                                          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-honey"
                                        />
                                      </div>

                                      {/* Saturation */}
                                      <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black">
                                          <span>Saturación</span>
                                          <span className="text-amber-honey font-mono">{campBgSaturation}%</span>
                                        </div>
                                        <input
                                          type="range"
                                          min="0"
                                          max="200"
                                          step="10"
                                          value={campBgSaturation}
                                          onChange={e => setCampBgSaturation(parseInt(e.target.value))}
                                          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-honey"
                                        />
                                      </div>

                                      {/* Position */}
                                      <div className="space-y-1">
                                        <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Posición del Fondo</label>
                                        <select
                                          value={campBgPosition}
                                          onChange={e => setCampBgPosition(e.target.value)}
                                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey transition-all font-semibold uppercase tracking-wider text-[#F4F6F0] bg-[#121915]"
                                        >
                                          <option value="center">Centro</option>
                                          <option value="top">Superior</option>
                                          <option value="bottom">Inferior</option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Call To Action settings */}
                                  <div className="bg-white/5 border border-white/10 p-5 rounded-3xl space-y-4">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-honey flex items-center gap-2">
                                      🎯 Botón de Llamada a la Acción (CTA)
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="space-y-1">
                                        <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Texto del Botón</label>
                                        <input
                                          type="text"
                                          value={campCtaText}
                                          onChange={e => setCampCtaText(e.target.value)}
                                          placeholder="Ej. Escuchar Single"
                                          className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:border-amber-honey transition-all placeholder:text-[#F4F6F0]/30"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Enlace del Botón (URL)</label>
                                        <input
                                          type="url"
                                          value={campCtaLink}
                                          onChange={e => setCampCtaLink(e.target.value)}
                                          placeholder="https://..."
                                          className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:border-amber-honey transition-all font-mono placeholder:text-[#F4F6F0]/30"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Premium Typography settings */}
                                  <div className="bg-white/5 border border-white/10 p-5 rounded-3xl space-y-4">
                                    <div>
                                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-honey flex items-center gap-2">
                                        ✍️ Tipografía Premium del Poema
                                      </h4>
                                      <p className="text-[8px] text-[#F4F6F0]/50 uppercase tracking-widest font-bold mt-1">
                                        Elige una fuente artística de alta fidelidad para el texto del correo
                                      </p>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                      {[
                                        { id: 'serif', name: 'Estándar', css: 'font-serif', desc: 'Georgia Elegante' },
                                        { id: 'playfair', name: 'Playfair', css: 'font-serif', style: { fontFamily: "'Playfair Display', serif" }, desc: 'Clásico & Sofisticado' },
                                        { id: 'cinzel', name: 'Cinzel', css: 'font-serif', style: { fontFamily: "'Cinzel', serif" }, desc: 'Romano Imperial' },
                                        { id: 'garamond', name: 'Garamond', css: 'font-serif', style: { fontFamily: "'Cormorant Garamond', serif" }, desc: 'Musgo Artístico' },
                                        { id: 'montserrat', name: 'Montserrat', css: 'font-sans', style: { fontFamily: "'Montserrat', sans-serif" }, desc: 'Minimalista Moderno' },
                                        { id: 'pinyon', name: 'Pinyon Script', css: 'font-cursive', style: { fontFamily: "'Pinyon Script', cursive" }, desc: 'Caligrafía Íntima' },
                                      ].map(f => (
                                        <div
                                          key={f.id}
                                          onClick={() => setCampFontFamily(f.id)}
                                          className={`p-3 rounded-2xl border cursor-pointer text-center transition-all hover:scale-102 flex flex-col justify-center items-center gap-1 ${campFontFamily === f.id
                                            ? 'bg-amber-honey/10 border-amber-honey text-amber-honey ring-1 ring-amber-honey'
                                            : 'bg-white/5 border border-white/10 text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/10'
                                            }`}
                                        >
                                          <span
                                            className="text-xs font-black"
                                            style={f.style}
                                          >
                                            {f.name}
                                          </span>
                                          <span className="text-[7px] font-bold uppercase tracking-widest opacity-60">{f.desc}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex gap-4 justify-end pt-4 border-t border-white/10">
                                    <button
                                      type="button"
                                      onClick={() => setIsCampaignModalOpen(false)}
                                      className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-[#F4F6F0]/80"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="submit"
                                      disabled={campLoading}
                                      className="px-8 py-3 bg-amber-honey text-[#1E2B22] rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-honey/15 disabled:opacity-50 transition-all hover:bg-amber-gold"
                                    >
                                      {campLoading ? 'Procesando...' : campId ? 'Actualizar Campaña' : 'Crear Campaña'}
                                    </button>
                                  </div>
                                </form>
                              </motion.div>
                            </div>
                          )}

                          {/* Simulated Email Client Live Preview Modal */}
                          {previewCampaign && (
                            <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-6 overflow-y-auto">
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="amber-glass border border-white/10 w-full max-w-2xl rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative flex flex-col max-h-[90vh]"
                              >
                                <button
                                  onClick={() => setPreviewCampaign(null)}
                                  className="absolute top-6 right-6 w-9 h-9 rounded-xl border border-white/10 text-[#F4F6F0]/40 hover:text-[#F4F6F0] flex items-center justify-center transition-all hover:bg-white/5"
                                >
                                  <X size={16} />
                                </button>

                                <div>
                                  <h3 className="text-xl font-black uppercase italic tracking-tight text-[#F4F6F0]">Previsualización de Correo</h3>
                                  <p className="text-[9px] text-[#F4F6F0]/50 uppercase tracking-widest font-bold mt-1">Simulación de bandeja de entrada</p>
                                </div>

                                {/* Simulated Email Client Frame */}
                                <div className="border border-white/10 rounded-2xl overflow-hidden flex flex-col flex-1 bg-[#080C0A]">
                                  {/* Email header bar */}
                                  <div className="bg-white/5 border-b border-white/10 px-6 py-4 space-y-1.5 text-xs text-[#F4F6F0]/70">
                                    <div><span className="font-bold text-[#F4F6F0]/45 mr-2 uppercase text-[9px] tracking-wider">De:</span> Ms Ambar &lt;escribe@msambar.dev&gt;</div>
                                    <div><span className="font-bold text-[#F4F6F0]/45 mr-2 uppercase text-[9px] tracking-wider">Para:</span> suscriptor@ejemplo.com</div>
                                    <div><span className="font-bold text-[#F4F6F0]/45 mr-2 uppercase text-[9px] tracking-wider">Asunto:</span> <span className="text-[#F4F6F0] font-semibold">{previewCampaign.subject}</span></div>
                                  </div>

                                  {/* Email body simulation */}
                                  <div className="flex-1 overflow-y-auto p-8 custom-scroll" style={{
                                    backgroundColor:
                                      previewCampaign.template_type === 'moss' ? '#0b130e' :
                                        previewCampaign.template_type === 'cosmic' ? '#05050f' :
                                          previewCampaign.template_type === 'glow' ? '#0f0b07' :
                                            previewCampaign.template_type === 'mist' ? '#0f1115' : '#06070b'
                                  }}>
                                    <div style={{
                                      maxWidth: '500px',
                                      margin: '0 auto',
                                      backgroundColor:
                                        previewCampaign.template_type === 'moss' ? '#122017' :
                                          previewCampaign.template_type === 'cosmic' ? '#0c0a1a' :
                                            previewCampaign.template_type === 'glow' ? '#1a130c' :
                                              previewCampaign.template_type === 'mist' ? '#181b22' : '#0c0d13',
                                      border:
                                        previewCampaign.template_type === 'moss' ? '1px solid #2e4d38' :
                                          previewCampaign.template_type === 'cosmic' ? '1px solid #4a154b' :
                                            previewCampaign.template_type === 'glow' ? '1px solid #d97706' :
                                              previewCampaign.template_type === 'mist' ? '1px solid #374151' : '1px solid rgba(255, 255, 255, 0.05)',
                                      padding: '30px',
                                      borderRadius: '20px',
                                      fontFamily:
                                        previewCampaign.font_family === 'playfair' ? "'Playfair Display', Georgia, serif" :
                                          previewCampaign.font_family === 'cinzel' ? "'Cinzel', Georgia, serif" :
                                            previewCampaign.font_family === 'garamond' ? "'Cormorant Garamond', 'Times New Roman', serif" :
                                              previewCampaign.font_family === 'montserrat' ? "'Montserrat', Helvetica, sans-serif" :
                                                previewCampaign.font_family === 'pinyon' ? "'Pinyon Script', cursive" :
                                                  'Georgia, serif',
                                      textAlign: 'left',
                                      // Background Image Overlay & blending simulation
                                      ...(previewCampaign.bg_image ? {
                                        backgroundImage: `linear-gradient(rgba(${previewCampaign.template_type === 'moss' ? '18, 32, 23' :
                                          previewCampaign.template_type === 'cosmic' ? '12, 10, 26' :
                                            previewCampaign.template_type === 'glow' ? '26, 19, 12' :
                                              previewCampaign.template_type === 'mist' ? '24, 27, 34' : '12, 13, 19'
                                          }, ${Math.max(0, Math.min(1, 1 - (previewCampaign.bg_opacity ?? 1.0)))}), rgba(${previewCampaign.template_type === 'moss' ? '18, 32, 23' :
                                            previewCampaign.template_type === 'cosmic' ? '12, 10, 26' :
                                              previewCampaign.template_type === 'glow' ? '26, 19, 12' :
                                                previewCampaign.template_type === 'mist' ? '24, 27, 34' : '12, 13, 19'
                                          }, ${Math.max(0, Math.min(1, 1 - (previewCampaign.bg_opacity ?? 1.0)))})) , url(${previewCampaign.bg_image})`,
                                        backgroundPosition: previewCampaign.bg_position || 'center',
                                        backgroundRepeat: 'no-repeat',
                                        backgroundSize: 'cover',
                                        filter: `saturate(${previewCampaign.bg_saturation ?? 100}%)`,
                                      } : {})
                                    }}>
                                      {/* Logo header */}
                                      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                                        <div style={{
                                          display: 'inline-block',
                                          width: '40px',
                                          height: '40px',
                                          borderRadius: '50%',
                                          backgroundColor:
                                            previewCampaign.template_type === 'moss' ? '#82c99b' :
                                              previewCampaign.template_type === 'cosmic' ? '#c084fc' :
                                                previewCampaign.template_type === 'glow' ? '#f59e0b' :
                                                  previewCampaign.template_type === 'mist' ? '#06b6d4' : '#f59e0b',
                                          color: '#030303',
                                          lineHeight: '40px',
                                          textAlign: 'center',
                                          fontWeight: 'bold',
                                          fontSize: '20px'
                                        }}>
                                          <img src="/logos/ms_ambar_monograma_n.png" alt="A" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', padding: '4px', boxSizing: 'border-box' }} />
                                        </div>
                                        <h4 style={{ color: '#ffffff', fontSize: '18px', fontWeight: 'bold', margin: '10px 0 0 0' }}>Ms Ambar</h4>
                                        <p style={{
                                          color:
                                            previewCampaign.template_type === 'moss' ? '#82c99b' :
                                              previewCampaign.template_type === 'cosmic' ? '#c084fc' :
                                                previewCampaign.template_type === 'glow' ? '#f59e0b' :
                                                  previewCampaign.template_type === 'mist' ? '#06b6d4' : '#f59e0b',
                                          fontSize: '8px',
                                          textTransform: 'uppercase',
                                          letterSpacing: '2px',
                                          margin: '2px 0 0 0'
                                        }}>Ambar te escribe • Poesía</p>
                                      </div>

                                      {/* Optional cover image */}
                                      {previewCampaign.image && (
                                        <div style={{
                                          borderRadius: '12px',
                                          overflow: 'hidden',
                                          marginBottom: '20px',
                                          border: '1px solid rgba(255,255,255,0.05)'
                                        }}>
                                          <img src={previewCampaign.image} style={{ width: '100%', height: 'auto', display: 'block' }} alt="Cover" />
                                        </div>
                                      )}

                                      {/* Subject as title inside email */}
                                      <h3 style={{
                                        color: '#ffffff',
                                        fontSize: '20px',
                                        fontWeight: 'bold',
                                        textAlign: 'center',
                                        fontStyle: 'italic',
                                        marginBottom: '25px'
                                      }}>{previewCampaign.subject}</h3>

                                      {/* Poem body */}
                                      <div style={{
                                        color:
                                          previewCampaign.template_type === 'moss' ? '#f5fbf7' :
                                            previewCampaign.template_type === 'cosmic' ? '#ffffff' :
                                              previewCampaign.template_type === 'glow' ? '#fffdfa' :
                                                previewCampaign.template_type === 'mist' ? '#f3f4f6' : '#ffffff',
                                        fontSize: '14px',
                                        lineHeight: '1.8',
                                        textAlign: 'center',
                                        fontStyle: 'italic',
                                        opacity: 0.95
                                      }}>
                                        {previewCampaign.poem_text.split('\n').map((line: string, idx: number) => (
                                          line.trim() ? (
                                            <p key={idx} style={{ margin: '0 0 12px 0' }}>{line}</p>
                                          ) : (
                                            <div key={idx} style={{ height: '12px' }} />
                                          )
                                        ))}
                                      </div>

                                      {/* Dynamic CTA Button */}
                                      {previewCampaign.cta_text && previewCampaign.cta_link && (
                                        <div style={{ textAlign: 'center', marginTop: '30px', marginBottom: '20px' }}>
                                          <a
                                            href={previewCampaign.cta_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                              backgroundColor:
                                                previewCampaign.template_type === 'moss' ? '#82c99b' :
                                                  previewCampaign.template_type === 'cosmic' ? '#c084fc' :
                                                    previewCampaign.template_type === 'glow' ? '#f59e0b' :
                                                      previewCampaign.template_type === 'mist' ? '#06b6d4' : '#f59e0b',
                                              color: '#030303',
                                              padding: '14px 28px',
                                              borderRadius: '12px',
                                              fontSize: '13px',
                                              fontWeight: 'bold',
                                              textDecoration: 'none',
                                              display: 'inline-block',
                                              letterSpacing: '1px',
                                              textTransform: 'uppercase',
                                              boxShadow: '0 5px 15px rgba(0,0,0,0.2)'
                                            }}
                                          >
                                            {previewCampaign.cta_text}
                                          </a>
                                        </div>
                                      )}

                                      {/* Footer */}
                                      <div style={{
                                        textAlign: 'center',
                                        borderTop: '1px solid rgba(255,255,255,0.05)',
                                        paddingTop: '15px',
                                        marginTop: '30px',
                                        color: 'rgba(255,255,255,0.3)',
                                        fontSize: '9px',
                                        lineHeight: '1.4'
                                      }}>
                                        <p style={{ margin: '0 0 8px 0' }}>Recibiste este poema porque eres parte de las Cartas de Ms Ambar.</p>
                                        <p style={{ margin: '0' }}>
                                          <span style={{
                                            color:
                                              previewCampaign.template_type === 'moss' ? '#82c99b' :
                                                previewCampaign.template_type === 'cosmic' ? '#c084fc' :
                                                  previewCampaign.template_type === 'glow' ? '#f59e0b' :
                                                    previewCampaign.template_type === 'mist' ? '#06b6d4' : '#f59e0b',
                                            textDecoration: 'underline',
                                            cursor: 'pointer'
                                          }}>Desuscribirse del boletín</span>
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                  <button
                                    onClick={() => setPreviewCampaign(null)}
                                    className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-[#F4F6F0]/80 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                                  >
                                    Cerrar Vista Previa
                                  </button>
                                </div>
                              </motion.div>
                            </div>
                          )}

                      </div>
                    </div>
                    );
}

                    // Stat Card Component
                    const StatCard = ({icon, title, value, detail, color}: any) => {
  const glowColors: any = {
                      amber: 'shadow-lg shadow-black/20 border-amber-honey/20 hover:border-amber-honey/40',
                    gold: 'shadow-lg shadow-black/20 border-amber-honey/20 hover:border-amber-honey/40',
                    honey: 'shadow-lg shadow-black/20 border-amber-honey/20 hover:border-amber-honey/40',
                    yellow: 'shadow-lg shadow-black/20 border-amber-honey/20 hover:border-amber-honey/40',
  };

                    return (
                    <motion.div
                      whileHover={{ y: -4 }}
                      className={`amber-glass border rounded-[2rem] p-6 transition-all duration-300 relative group overflow-hidden ${glowColors[color]}`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] text-[#F4F6F0]/60 uppercase tracking-widest font-black">{title}</span>
                        <div className="p-2.5 bg-white/5 rounded-xl group-hover:scale-110 transition-transform text-[#F4F6F0]">
                          {icon}
                        </div>
                      </div>
                      <div className="text-2xl md:text-3xl font-black text-[#F4F6F0] tracking-tight mb-2">{value}</div>
                      <div className="text-[#F4F6F0]/40 text-[9px] uppercase tracking-widest font-black">{detail}</div>
                    </motion.div>
                    );
};

                    // Quick Action Button Component
                    const QuickActionBtn = ({href, title, desc, icon, external}: any) => {
  const BtnContent = (
                    <div className="p-4 bg-white/5 border border-white/10 hover:border-amber-honey/30 hover:bg-amber-honey/[0.02] rounded-2xl shadow-md transition-all group flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-white/5 rounded-xl group-hover:bg-amber-honey/10 group-hover:scale-105 transition-all text-[#F4F6F0]/60 group-hover:text-amber-honey">
                          {icon}
                        </div>
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-[#F4F6F0] group-hover:text-amber-honey transition-colors">{title}</h4>
                          <p className="text-[9px] uppercase tracking-widest text-[#F4F6F0]/40 group-hover:text-[#F4F6F0]/60 mt-0.5">{desc}</p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-amber-honey" />
                    </div>
                    );

                    return external ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">{BtnContent}</a>
                    ) : (
                    <Link href={href}>{BtnContent}</Link>
                    );
};
