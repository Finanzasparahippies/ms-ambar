import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { BarChart3, Clock, Database, Zap, AlertTriangle, FileText, Download, RefreshCw } from 'lucide-react';

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
        responseType: 'blob' // Obligatorio para manejar descargas de archivos con Axios correctamente
      });

      // Crear URL temporal para simular clic de descarga nativo
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

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const formatDate = (epoch: number | null) => {
    if (!epoch) return 'Sin registros';
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
      <div className="min-h-screen text-[#F4F6F0] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-amber-honey/20 border-t-amber-honey animate-spin" />
        <p className="text-[#F4F6F0]/60 tracking-widest font-black uppercase text-xs">Cargando métricas de rendimiento...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen text-[#F4F6F0] flex flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertTriangle className="text-red-500 w-16 h-16 animate-pulse" />
        <h2 className="text-2xl font-black uppercase italic tracking-tight text-[#F4F6F0]">{error}</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-[#F4F6F0] p-8">
      <header className="mb-10">
        <h1 className="text-4xl font-black text-[#F4F6F0] tracking-tight uppercase italic">
          Administrador de Rendimiento
        </h1>
        <p className="text-[#F4F6F0]/50 mt-2 font-semibold">Monitoreo profesional de Ms Ambar</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard
          icon={<Clock className="text-amber-honey" />}
          title="Tiempos de Respuesta (AVG)"
          value={`${summary?.server?.avg_response_time?.toFixed(3)}s`}
          detail="Promedio global del servidor"
        />
        <MetricCard
          icon={<Database className="text-[#0f766e]" />}
          title="Consultas DB (AVG)"
          value={summary?.server?.avg_queries?.toFixed(1)}
          detail="Queries por solicitud"
        />
        <MetricCard
          icon={<Zap className="text-[#15803d]" />}
          title="Total Solicitudes"
          value={summary?.server?.total_requests}
          detail="Registradas en este periodo"
        />
        <MetricCard
          icon={<AlertTriangle className="text-red-400" />}
          title="Tiempo Máximo"
          value={`${summary?.server?.max_response_time?.toFixed(2)}s`}
          detail="Peor caso registrado"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="amber-glass border border-white/10 rounded-2xl p-6 shadow-lg shadow-black/20">
          <h2 className="text-xl font-black text-[#F4F6F0] mb-6 flex items-center gap-2">
            <BarChart3 size={20} className="text-amber-honey" /> Core Web Vitals (Promedio)
          </h2>
          <div className="space-y-4">
            {summary?.vitals?.map((v: any) => (
              <div key={v.name} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-lg">
                <span className="font-mono text-amber-honey font-bold">{v.name}</span>
                <span className="text-[#F4F6F0]/85 font-semibold">{v.avg_value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="amber-glass border border-white/10 rounded-2xl p-6 shadow-lg shadow-black/20">
          <h2 className="text-xl font-black text-[#F4F6F0] mb-6 flex items-center gap-2">
            <Zap size={20} className="text-amber-honey" /> Endpoints más lentos
          </h2>
          <div className="space-y-4">
            {summary?.slowest_endpoints?.map((e: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-lg">
                <span className="text-sm font-mono truncate max-w-[250px] text-[#F4F6F0]/60">{e.path}</span>
                <span className="text-red-400 font-bold">{e.avg_time.toFixed(3)}s</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sección Profesional de Logs del Sistema */}
      <div className="mt-8 amber-glass border border-white/10 rounded-2xl p-6 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-[#F4F6F0] flex items-center gap-2">
            <FileText size={20} className="text-amber-honey" /> Logs del Sistema
          </h2>
          <button
            onClick={fetchLogs}
            disabled={loadingLogs}
            className="p-2 hover:bg-white/5 border border-white/10 rounded-lg text-[#F4F6F0]/60 hover:text-amber-honey disabled:opacity-50 transition-all duration-200"
            title="Refrescar lista de logs"
          >
            <RefreshCw size={16} className={loadingLogs ? "animate-spin" : ""} />
          </button>
        </div>

        {loadingLogs && logs.length === 0 ? (
          <div className="flex justify-center p-8">
            <div className="w-6 h-6 border-2 border-amber-honey/20 border-t-amber-honey rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {logs.map((log: any) => (
              <div
                key={log.name}
                className="p-4 bg-white/5 border border-white/5 rounded-xl hover:border-amber-honey/30 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-mono text-amber-honey font-bold text-sm truncate mb-2">{log.name}</h3>
                  <div className="text-xs text-[#F4F6F0]/65 space-y-1 mb-4">
                    <p>Tamaño: <span className="font-mono text-[#F4F6F0] font-bold">{formatBytes(log.size)}</span></p>
                    <p>Modificado: <span className="text-[#F4F6F0] font-bold">{formatDate(log.modified)}</span></p>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => downloadLogFile(log.name)}
                  disabled={downloadingLog === log.name}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-amber-honey hover:bg-amber-honey/95 text-black font-black uppercase text-xs tracking-wider rounded-lg disabled:bg-amber-honey/40 transition-all duration-200"
                >
                  {downloadingLog === log.name ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                      <span>Descargando...</span>
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      <span>Descargar</span>
                    </>
                  )}
                </motion.button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MetricCard = ({ icon, title, value, detail }: any) => (
  <motion.div
    whileHover={{ y: -5 }}
    className="amber-glass border border-white/10 rounded-2xl p-6 shadow-lg shadow-black/20"
  >
    <div className="flex items-center gap-3 mb-4">
      {icon}
      <h3 className="text-[#F4F6F0]/60 text-sm uppercase tracking-wider font-semibold">{title}</h3>
    </div>
    <div className="text-3xl font-black text-[#F4F6F0] mb-1">{value}</div>
    <div className="text-[#F4F6F0]/40 text-xs font-medium">{detail}</div>
  </motion.div>
);

export default PerformanceDashboard;
