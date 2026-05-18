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
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
        <p className="text-white/60 tracking-widest font-black uppercase text-xs">Cargando métricas de rendimiento...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertTriangle className="text-red-500 w-16 h-16 animate-pulse" />
        <h2 className="text-2xl font-black uppercase italic tracking-tight">{error}</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <header className="mb-10">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">
          Administrador de Rendimiento
        </h1>
        <p className="text-white/40 mt-2">Monitoreo profesional de MS AMBAR</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard 
          icon={<Clock className="text-amber-400" />} 
          title="Tiempos de Respuesta (AVG)" 
          value={`${summary?.server?.avg_response_time?.toFixed(3)}s`} 
          detail="Promedio global del servidor"
        />
        <MetricCard 
          icon={<Database className="text-blue-400" />} 
          title="Consultas DB (AVG)" 
          value={summary?.server?.avg_queries?.toFixed(1)} 
          detail="Queries por solicitud"
        />
        <MetricCard 
          icon={<Zap className="text-green-400" />} 
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
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <BarChart3 size={20} className="text-amber-400" /> Core Web Vitals (Promedio)
          </h2>
          <div className="space-y-4">
            {summary?.vitals?.map((v: any) => (
              <div key={v.name} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="font-mono text-amber-200">{v.name}</span>
                <span className="text-white/80">{v.avg_value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Zap size={20} className="text-amber-400" /> Endpoints más lentos
          </h2>
          <div className="space-y-4">
            {summary?.slowest_endpoints?.map((e: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-sm font-mono truncate max-w-[250px] text-white/60">{e.path}</span>
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
    className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm"
  >
    <div className="flex items-center gap-3 mb-4">
      {icon}
      <h3 className="text-white/60 text-sm uppercase tracking-wider font-semibold">{title}</h3>
    </div>
    <div className="text-3xl font-bold text-white mb-1">{value}</div>
    <div className="text-white/20 text-xs">{detail}</div>
  </motion.div>
);

export default PerformanceDashboard;
