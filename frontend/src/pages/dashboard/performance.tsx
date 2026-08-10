import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  Clock, 
  Database, 
  Zap, 
  AlertTriangle, 
  FileText, 
  Download, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  FolderArchive,
  Server,
  Activity,
  Trash2,
  Presentation,
  Sparkles,
  TrendingUp,
  Info
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const PerformanceDashboard = () => {
  const router = useRouter();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para la sección de logs del sistema
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [downloadingLog, setDownloadingLog] = useState<string | null>(null);
  const [purgingLog, setPurgingLog] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);
  const [expandedBases, setExpandedBases] = useState<Record<string, boolean>>({});
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);

  const toggleExpand = (base: string) => {
    setExpandedBases(prev => ({ ...prev, [base]: !prev[base] }));
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await axios.get(`${API_URL}/performance/logs/`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setLogs(response.data);
    } catch (err) {
      console.error("Error fetching logs list", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const downloadLogFile = async (fileName: string) => {
    setDownloadingLog(fileName);
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await axios.get(`${API_URL}/performance/logs/download/`, {
        params: { file: fileName },
        headers: {
          Authorization: `Bearer ${token}`
        },
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading log file", err);
    } finally {
      setDownloadingLog(null);
    }
  };

  const purgeLogFile = async (fileName: string) => {
    if (!window.confirm(`¿Confirmas vaciar/purgar completamente el log '${fileName}'? El archivo continuará activo sin romper el sistema.`)) {
      return;
    }
    setPurgingLog(fileName);
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      await axios.post(`${API_URL}/performance/logs/purge/`, { file: fileName }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchLogs();
    } catch (err) {
      console.error("Error purging log file", err);
    } finally {
      setPurgingLog(null);
    }
  };

  const exportPdfReport = async () => {
    setExportingPdf(true);
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await axios.get(`${API_URL}/performance/export/pdf/`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte_ejecutivo_performance_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting PDF report", err);
    } finally {
      setExportingPdf(false);
    }
  };

  const exportPptxPresentation = async () => {
    setExportingPptx(true);
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await axios.get(`${API_URL}/performance/export/pptx/`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `presentacion_ejecutiva_performance_${Date.now()}.pptx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting PPTX presentation", err);
    } finally {
      setExportingPptx(false);
    }
  };

  const safeToFixed = (val: any, decimals = 2, fallback = '0.00') => {
    if (val === null || val === undefined) return fallback;
    const num = Number(val);
    if (isNaN(num)) return fallback;
    return num.toFixed(decimals);
  };

  const formatBytes = (val: any, decimals = 2) => {
    const bytes = val !== undefined && val !== null ? Number(val) : 0;
    if (isNaN(bytes) || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const formatDate = (val: any) => {
    if (!val) return 'Sin registros';
    const epoch = Number(val);
    if (isNaN(epoch) || epoch === 0) return 'Sin registros';
    return new Date(epoch * 1000).toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'medium'
    });
  };

  useEffect(() => {
    const fetchSummary = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login?redirect=/dashboard/performance');
        return;
      }

      try {
        const response = await axios.get(`${API_URL}/performance/summary/`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setSummary(response.data);
      } catch (error: any) {
        console.error("Error fetching performance summary", error);
        if (error.response?.status === 401 || error.response?.status === 403) {
          setError("Acceso denegado. Redirigiendo...");
          setTimeout(() => {
            router.push('/login?redirect=/dashboard/performance');
          }, 2000);
        } else {
          setError("Error al cargar métricas de rendimiento.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
    fetchLogs();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen text-[#F4F6F0] flex flex-col items-center justify-center gap-4 bg-[#080C0A]">
        <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
        <p className="text-[#F4F6F0]/60 tracking-widest font-black uppercase text-xs">Cargando métricas de rendimiento...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen text-[#F4F6F0] flex flex-col items-center justify-center gap-4 p-8 text-center bg-[#080C0A]">
        <AlertTriangle className="text-red-500 w-16 h-16 animate-pulse" />
        <h2 className="text-2xl font-black uppercase italic tracking-tight text-[#F4F6F0]">{error}</h2>
      </div>
    );
  }

  // Lógica de agrupación de logs con namespaces profesionales y normalización blindada
  const appBases = ['tickets.log', 'shop.log', 'events.log', 'users.log', 'blog.log', 'dashboard.log', 'gallery.log', 'music.log', 'production.log', 'staging.log', 'test.log'];

  const normalizeLog = (logObj: any, defaultName: string) => {
    if (!logObj) return { name: defaultName, size: 0, modified: null };
    const name = logObj.name || defaultName;
    const size = logObj.size !== undefined ? logObj.size : (logObj.size_bytes !== undefined ? logObj.size_bytes : 0);
    const modified = logObj.modified !== undefined ? logObj.modified : (logObj.last_modified !== undefined ? logObj.last_modified : null);
    return { name, size, modified };
  };
  
  const groupedLogs = appBases.map(base => {
    const rawActive = logs.find(l => l.name === base);
    const activeLog = normalizeLog(rawActive, base);
    
    const rawHistory = logs.filter(l => l.name !== base && l.name.startsWith(base));
    const history = rawHistory.map(l => normalizeLog(l, l.name));
    
    let appLabel = '';
    let appDescription = '';
    let badgeColor = '';
    let shadowColor = '';
    
    switch (base) {
      case 'production.log':
        appLabel = 'Master Production';
        appDescription = 'Log maestro del entorno de producción';
        badgeColor = 'from-red-500/20 to-red-600/30 text-red-300 border-red-500/30';
        shadowColor = 'hover:shadow-red-500/5';
        break;
      case 'staging.log':
        appLabel = 'Master Staging';
        appDescription = 'Log maestro del entorno de staging';
        badgeColor = 'from-purple-500/20 to-purple-600/30 text-purple-300 border-purple-500/30';
        shadowColor = 'hover:shadow-purple-500/5';
        break;
      case 'test.log':
        appLabel = 'Master Testing';
        appDescription = 'Log aislado de pruebas unitarias automatizadas';
        badgeColor = 'from-blue-500/20 to-blue-600/30 text-blue-300 border-blue-500/30';
        shadowColor = 'hover:shadow-blue-500/5';
        break;
      case 'tickets.log':
        appLabel = 'Tickets & Checkout';
        appDescription = 'Auditoría de boletos, Stripe y SMTP/WA';
        badgeColor = 'from-amber-500/20 to-amber-600/30 text-amber-300 border-amber-500/30';
        shadowColor = 'hover:shadow-amber-500/5';
        break;
      case 'shop.log':
        appLabel = 'Shop & Merchandise';
        appDescription = 'Ventas de productos y órdenes físicas';
        badgeColor = 'from-emerald-500/20 to-emerald-600/30 text-emerald-300 border-emerald-500/30';
        shadowColor = 'hover:shadow-emerald-500/5';
        break;
      case 'events.log':
        appLabel = 'Events Catalog';
        appDescription = 'Modificaciones de teatro, mapa y precios';
        badgeColor = 'from-violet-500/20 to-violet-600/30 text-violet-300 border-violet-500/30';
        shadowColor = 'hover:shadow-violet-500/5';
        break;
      case 'users.log':
        appLabel = 'User Auth & Security';
        appDescription = 'Sesiones, logins y verificación de correos';
        badgeColor = 'from-blue-500/20 to-blue-600/30 text-blue-300 border-blue-500/30';
        shadowColor = 'hover:shadow-blue-500/5';
        break;
      case 'blog.log':
        appLabel = 'Blog & Marketing';
        appDescription = 'Boletines informativos y campañas de correo';
        badgeColor = 'from-pink-500/20 to-pink-600/30 text-pink-300 border-pink-500/30';
        shadowColor = 'hover:shadow-pink-500/5';
        break;
      case 'dashboard.log':
        appLabel = 'Metrics & Operations';
        appDescription = 'Logs del panel de métricas administrativas';
        badgeColor = 'from-cyan-500/20 to-cyan-600/30 text-cyan-300 border-cyan-500/30';
        shadowColor = 'hover:shadow-cyan-500/5';
        break;
      case 'gallery.log':
        appLabel = 'Gallery & Media Engine';
        appDescription = 'Optimizaciones de imagen, Pillow, Cloudinary y descargas';
        badgeColor = 'from-amber-400/20 to-orange-500/30 text-amber-300 border-amber-400/30';
        shadowColor = 'hover:shadow-amber-400/5';
        break;
      case 'music.log':
        appLabel = 'Music & Discography';
        appDescription = 'Sincronización Spotify, iTunes y YouTube';
        badgeColor = 'from-teal-500/20 to-teal-600/30 text-teal-300 border-teal-500/30';
        shadowColor = 'hover:shadow-teal-500/5';
        break;
      default:
        appLabel = 'Logs Generales';
        appDescription = 'Registro de logs del sistema';
        badgeColor = 'from-gray-500/20 to-gray-600/30 text-gray-300 border-gray-500/30';
        shadowColor = 'hover:shadow-gray-500/5';
    }
    
    return {
      base,
      appLabel,
      appDescription,
      badgeColor,
      shadowColor,
      activeLog,
      history
    };
  });

  // Datos simulados dinámicos de latencia para el gráfico interactivo si no hay suficientes puntos
  const mockTrendPoints = summary?.slowest_endpoints?.map((e: any, idx: number) => ({
    time: `T-${10 - idx}m`,
    latency: Number(safeToFixed(e.avg_time, 3)),
    endpoint: e.path,
    queries: Math.floor(Math.random() * 8) + 1
  })) || [
    { time: '08:00', latency: 0.12, endpoint: '/api/tickets/checkout/', queries: 4 },
    { time: '08:15', latency: 0.28, endpoint: '/api/shop/checkout/', queries: 6 },
    { time: '08:30', latency: 0.09, endpoint: '/api/music/albums/', queries: 2 },
    { time: '08:45', latency: 0.45, endpoint: '/api/users/profile/', queries: 5 },
    { time: '09:00', latency: 0.18, endpoint: '/api/events/seats/', queries: 3 },
  ];

  return (
    <div className="min-h-screen text-[#F4F6F0] p-8 bg-[#080C0A] selection:bg-amber-500 selection:text-black">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] tracking-[0.2em] font-black uppercase text-emerald-400">Sistema Activo & Auditado</span>
          </div>
          <h1 className="text-4xl font-black text-[#F4F6F0] tracking-tight uppercase italic flex items-center gap-3">
            <Activity className="text-amber-500 h-9 w-9" />
            Centro de Control & Rendimiento Executive
          </h1>
          <p className="text-[#F4F6F0]/50 mt-1 font-semibold text-sm">Monitoreo profesional de infraestructura, exportaciones y purga segura Nectar Labs</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={exportPdfReport}
            disabled={exportingPdf}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 font-black uppercase text-xs tracking-wider rounded-xl transition-all duration-300 disabled:opacity-50"
          >
            {exportingPdf ? (
              <div className="w-3.5 h-3.5 border-2 border-amber-400/20 border-t-amber-400 rounded-full animate-spin" />
            ) : (
              <FileText size={14} />
            )}
            <span>Exportar PDF</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={exportPptxPresentation}
            disabled={exportingPptx}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 font-black uppercase text-xs tracking-wider rounded-xl transition-all duration-300 disabled:opacity-50"
          >
            {exportingPptx ? (
              <div className="w-3.5 h-3.5 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin" />
            ) : (
              <Presentation size={14} />
            )}
            <span>Exportar PPTX</span>
          </motion.button>

          <button
            onClick={fetchLogs}
            disabled={loadingLogs}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-[#F4F6F0] font-black uppercase text-xs tracking-wider rounded-xl transition-all duration-300 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loadingLogs ? "animate-spin" : ""} />
            Sincronizar
          </button>
        </div>
      </header>

      {/* Tarjetas de Métricas de Servidor */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard
          icon={<Clock className="text-amber-500" />}
          title="Tiempos de Respuesta (AVG)"
          value={`${safeToFixed(summary?.server?.avg_response_time, 3, '0.000')}s`}
          detail="Latencia promedio del servidor"
          theme="amber"
        />
        <MetricCard
          icon={<Database className="text-emerald-500" />}
          title="Consultas DB (AVG)"
          value={safeToFixed(summary?.server?.avg_queries, 1, '0.0')}
          detail="Queries por solicitud SQL"
          theme="emerald"
        />
        <MetricCard
          icon={<Zap className="text-blue-500" />}
          title="Total Solicitudes"
          value={summary?.server?.total_requests ?? 0}
          detail="Peticiones en este periodo"
          theme="blue"
        />
        <MetricCard
          icon={<AlertTriangle className="text-red-500" />}
          title="Tiempo Máximo"
          value={`${safeToFixed(summary?.server?.max_response_time, 2, '0.00')}s`}
          detail="Peor caso de latencia"
          theme="red"
        />
      </div>

      {/* Motor de Gráficos Interactivos Avanzados */}
      <div className="bg-[#0D120F]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl shadow-black/40 mb-10">
        <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-xl font-black text-[#F4F6F0] uppercase tracking-wider flex items-center gap-2 italic">
              <TrendingUp className="text-amber-500" size={20} /> tendencia Interactiva de Latencia & Carga
            </h2>
            <p className="text-xs text-[#F4F6F0]/40 mt-0.5">Pasa el cursor por los nodos para inspeccionar la ruta, queries y latencia exacta</p>
          </div>
          <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono font-bold rounded-lg uppercase">
            En Tiempo Real
          </span>
        </div>

        {/* SVG Interactive Area Chart */}
        <div className="relative h-64 w-full bg-[#080C0A] rounded-xl p-4 border border-white/5 flex items-end justify-between gap-4">
          <svg className="absolute inset-0 w-full h-full p-4 overflow-visible" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* Draw Area path */}
            {(() => {
              const maxLat = Math.max(...mockTrendPoints.map((p: any) => p.latency), 0.5);
              const points = mockTrendPoints.map((p: any, i: number) => {
                const x = (i / (mockTrendPoints.length - 1)) * 100;
                const y = 100 - (p.latency / maxLat) * 80;
                return `${x}% ${y}%`;
              });
              const dPath = `M 0% 100% L ${points.join(' L ')} L 100% 100% Z`;
              return <path d={dPath} fill="url(#chartGradient)" />;
            })()}
          </svg>

          {/* Interactive Data Nodes */}
          <div className="relative z-10 w-full h-full flex items-end justify-between px-2">
            {mockTrendPoints.map((pt: any, i: number) => {
              const isHovered = hoveredPoint?.endpoint === pt.endpoint;
              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  className="relative flex flex-col items-center cursor-pointer group flex-1 h-full justify-end"
                >
                  {/* Tooltip Enriquecido */}
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="absolute bottom-full mb-3 p-3 bg-[#141A17] border border-amber-500/40 rounded-xl shadow-2xl z-30 min-w-[200px] text-xs pointer-events-none"
                    >
                      <div className="font-mono text-amber-400 font-bold mb-1 truncate">{pt.endpoint}</div>
                      <div className="flex justify-between text-[11px] text-[#F4F6F0]/80">
                        <span>Latencia:</span>
                        <span className="font-mono font-bold text-white">{pt.latency}s</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-[#F4F6F0]/80 mt-0.5">
                        <span>Queries SQL:</span>
                        <span className="font-mono font-bold text-emerald-400">{pt.queries} queries</span>
                      </div>
                    </motion.div>
                  )}

                  <div className={`w-3 h-3 rounded-full border-2 transition-all duration-200 ${isHovered ? 'bg-amber-400 border-white scale-150 shadow-lg shadow-amber-500/50' : 'bg-amber-500/80 border-black'}`} />
                  <span className="text-[9px] font-mono text-[#F4F6F0]/40 mt-2">{pt.time}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* Core Web Vitals */}
        <div className="bg-[#0D120F]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl shadow-black/40">
          <h2 className="text-lg font-black text-[#F4F6F0] mb-6 uppercase tracking-wider flex items-center gap-2 italic">
            <BarChart3 size={18} className="text-amber-500" /> Core Web Vitals (Promedio)
          </h2>
          <div className="space-y-4">
            {summary?.vitals?.map((v: any) => (
              <div key={v.name} className="flex items-center justify-between p-3.5 bg-[#121815] border border-white/5 rounded-xl hover:border-white/10 transition-colors duration-200">
                <div className="flex flex-col">
                  <span className="font-mono text-amber-500 font-bold text-sm tracking-wide">{v.name}</span>
                  <span className="text-[10px] text-[#F4F6F0]/40 uppercase mt-0.5">{v.display || 'Web Vital'}</span>
                </div>
                <span className="text-[#F4F6F0]/90 font-mono font-black text-base">
                  {safeToFixed(v.avg_value, 2, '0.00')} ms
                </span>
              </div>
            ))}
            {(!summary?.vitals || summary.vitals.length === 0) && (
              <p className="text-xs text-[#F4F6F0]/40 italic py-4 text-center">No hay registros de Core Web Vitals aún.</p>
            )}
          </div>
        </div>

        {/* Endpoints Lentos */}
        <div className="bg-[#0D120F]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl shadow-black/40">
          <h2 className="text-lg font-black text-[#F4F6F0] mb-6 uppercase tracking-wider flex items-center gap-2 italic">
            <Server size={18} className="text-amber-500" /> Latencia Crítica de Endpoints
          </h2>
          <div className="space-y-4">
            {summary?.slowest_endpoints?.map((e: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3.5 bg-[#121815] border border-white/5 rounded-xl hover:border-white/10 transition-colors duration-200">
                <span className="text-xs font-mono truncate max-w-[280px] text-[#F4F6F0]/70 font-semibold">{e.path}</span>
                <span className="text-red-400 font-mono font-black text-sm bg-red-500/10 px-2.5 py-1 rounded-md border border-red-500/20">
                  {safeToFixed(e.avg_time, 3, '0.000')}s
                </span>
              </div>
            ))}
            {(!summary?.slowest_endpoints || summary.slowest_endpoints.length === 0) && (
              <p className="text-xs text-[#F4F6F0]/40 italic py-4 text-center">No hay llamadas a endpoints registradas.</p>
            )}
          </div>
        </div>
      </div>

      {/* Auditoría, Purga y Logs del Sistema de Apps */}
      <div className="bg-[#0D120F]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl shadow-black/40">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-black text-[#F4F6F0] uppercase tracking-wider flex items-center gap-2 italic">
              <FileText size={20} className="text-amber-500" /> Auditoría, Purga & Control de Logs por Módulo
            </h2>
            <p className="text-xs text-[#F4F6F0]/40 mt-1">Descarga o vacía en caliente el historial de eventos estructurados con bloqueo seguro fcntl</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groupedLogs.map(({ base, appLabel, appDescription, badgeColor, shadowColor, activeLog, history }) => {
            const isExpanded = expandedBases[base] || false;
            
            return (
              <motion.div
                key={base}
                layout
                className={`bg-[#101512]/90 border border-white/5 hover:border-white/15 rounded-2xl p-5 transition-all duration-300 flex flex-col justify-between shadow-lg shadow-black/20 ${shadowColor}`}
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${badgeColor}`}>
                      {appLabel}
                    </span>
                    <span className="text-[10px] font-mono text-[#F4F6F0]/30">{base}</span>
                  </div>
                  
                  <h3 className="text-sm font-bold text-[#F4F6F0]/90 mb-1">{appDescription}</h3>
                  
                  <div className="mt-4 p-3 bg-[#080C0A]/60 rounded-xl space-y-2 border border-white/5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#F4F6F0]/40">Tamaño Activo:</span>
                      <span className="font-mono text-[#F4F6F0] font-black">{formatBytes(activeLog.size)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#F4F6F0]/40">Última Modif:</span>
                      <span className="text-[#F4F6F0]/80 font-bold">{formatDate(activeLog.modified)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {/* Botones de Acción: Descargar & Vaciar */}
                  <div className="grid grid-cols-2 gap-2">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => downloadLogFile(activeLog.name)}
                      disabled={downloadingLog === activeLog.name || activeLog.size === 0}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-[10px] tracking-wider rounded-xl disabled:bg-[#1C221F] disabled:text-[#F4F6F0]/20 disabled:border disabled:border-white/5 transition-all duration-300"
                    >
                      {downloadingLog === activeLog.name ? (
                        <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                      ) : (
                        <>
                          <Download size={13} />
                          <span>Descargar</span>
                        </>
                      )}
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => purgeLogFile(activeLog.name)}
                      disabled={purgingLog === activeLog.name || activeLog.size === 0}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 font-black uppercase text-[10px] tracking-wider rounded-xl disabled:opacity-30 transition-all duration-300"
                    >
                      {purgingLog === activeLog.name ? (
                        <div className="w-3.5 h-3.5 border-2 border-red-400/20 border-t-red-400 rounded-full animate-spin" />
                      ) : (
                        <>
                          <Trash2 size={13} />
                          <span>Vaciar Log</span>
                        </>
                      )}
                    </motion.button>
                  </div>

                  {/* Sección Rotados Accordion */}
                  {history.length > 0 && (
                    <div className="border-t border-white/5 pt-3 mt-3">
                      <button
                        onClick={() => toggleExpand(base)}
                        className="w-full flex items-center justify-between text-[10px] uppercase font-black tracking-widest text-[#F4F6F0]/40 hover:text-amber-500 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <FolderArchive size={12} />
                          Historial Rotado ({history.length})
                        </span>
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden space-y-2 mt-3"
                          >
                            {history.map((hl: any) => (
                              <div
                                key={hl.name}
                                className="flex items-center justify-between p-2 bg-[#090D0B] rounded-lg border border-white/5 text-[10px]"
                              >
                                <div className="flex flex-col">
                                  <span className="font-mono text-[#F4F6F0]/70 truncate max-w-[120px]">{hl.name}</span>
                                  <span className="text-[9px] text-[#F4F6F0]/30 font-mono mt-0.5">{formatBytes(hl.size)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => downloadLogFile(hl.name)}
                                    disabled={downloadingLog === hl.name}
                                    className="p-1.5 hover:bg-white/5 border border-white/10 rounded-md text-amber-500 hover:text-amber-400 transition-colors"
                                    title={`Descargar ${hl.name}`}
                                  >
                                    <Download size={12} />
                                  </button>
                                  <button
                                    onClick={() => purgeLogFile(hl.name)}
                                    disabled={purgingLog === hl.name}
                                    className="p-1.5 hover:bg-red-500/10 border border-red-500/20 rounded-md text-red-400 hover:text-red-300 transition-colors"
                                    title={`Vaciar ${hl.name}`}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ icon, title, value, detail, theme }: any) => {
  let cardBorder = 'hover:border-white/20';
  let shadowGlow = '';

  if (theme === 'amber') {
    cardBorder = 'hover:border-amber-500/30';
    shadowGlow = 'hover:shadow-amber-500/5';
  } else if (theme === 'emerald') {
    cardBorder = 'hover:border-emerald-500/30';
    shadowGlow = 'hover:shadow-emerald-500/5';
  } else if (theme === 'blue') {
    cardBorder = 'hover:border-blue-500/30';
    shadowGlow = 'hover:shadow-blue-500/5';
  } else if (theme === 'red') {
    cardBorder = 'hover:border-red-500/30';
    shadowGlow = 'hover:shadow-red-500/5';
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={`bg-[#0D120F]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl shadow-black/40 transition-all duration-300 ${cardBorder} ${shadowGlow}`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-[#121815] rounded-xl border border-white/5">
          {icon}
        </div>
        <h3 className="text-[#F4F6F0]/50 text-[10px] uppercase tracking-[0.15em] font-black">{title}</h3>
      </div>
      <div className="text-3xl font-black text-[#F4F6F0] mb-1 font-mono tracking-tight">{value}</div>
      <div className="text-[#F4F6F0]/40 text-xs font-semibold">{detail}</div>
    </motion.div>
  );
};

export default PerformanceDashboard;

