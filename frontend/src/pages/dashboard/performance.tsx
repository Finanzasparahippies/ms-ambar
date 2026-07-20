import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { BarChart3, Clock, Database, Zap, AlertTriangle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const PerformanceDashboard = () => {
  const router = useRouter();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
