import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, Users, DollarSign, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

interface DailyStat {
  date: string;
  tickets: number;
  shop: number;
  total: number;
  new_users?: number;
  successful_payments?: number;
  failed_payments?: number;
}

interface CrossAnalyticsProps {
  data: DailyStat[];
  adSpendTotal?: number;
}

export const CrossAnalyticsChart: React.FC<CrossAnalyticsProps> = ({ data, adSpendTotal = 0 }) => {
  const [activeSeries, setActiveSeries] = useState<'sales_vs_ads' | 'users_vs_conversions' | 'funnel'>('sales_vs_ads');
  const [hoveredItem, setHoveredItem] = useState<DailyStat | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-black/40 border border-amber-500/20 text-center text-neutral-500 text-sm">
        No hay datos de análisis cruzado disponibles para el período seleccionado.
      </div>
    );
  }

  // Estimar costo pauta diario para la gráfica basada en adSpendTotal
  const estimatedDailyAdSpend = (adSpendTotal && adSpendTotal > 0 && data.length > 0) ? roundVal(adSpendTotal / data.length) : 0;

  // Calcular valor máximo para escalar barras/gráficas adecuadamente
  const maxVal = Math.max(
    1,
    ...data.map(d => {
      if (activeSeries === 'sales_vs_ads') return Math.max(d.total, estimatedDailyAdSpend);
      if (activeSeries === 'users_vs_conversions') return Math.max((d.new_users || 0) * 10, 50);
      return Math.max((d.successful_payments || 0), (d.failed_payments || 0), 1);
    })
  );

  function roundVal(num: number) {
    return Math.round(num * 100) / 100;
  }

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-neutral-900/90 via-black/80 to-amber-950/20 backdrop-blur-xl border border-amber-500/20 shadow-2xl space-y-6">
      {/* Header & Mode Selectors */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <h3 className="text-xl font-bold text-white tracking-wide">Análisis Cruzado de Negocio & Conversiones</h3>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Cruce en tiempo real entre Pauta Publicitaria, Ventas y Embudo Transaccional
          </p>
        </div>

        {/* Series Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-black/60 rounded-xl border border-amber-500/10">
          <button
            onClick={() => setActiveSeries('sales_vs_ads')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSeries === 'sales_vs_ads'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold shadow-lg shadow-amber-500/20'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Ventas vs Pauta
          </button>
          <button
            onClick={() => setActiveSeries('users_vs_conversions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSeries === 'users_vs_conversions'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold shadow-lg shadow-amber-500/20'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Usuarios vs Registro
          </button>
          <button
            onClick={() => setActiveSeries('funnel')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSeries === 'funnel'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold shadow-lg shadow-amber-500/20'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Pagos Aprobados vs Fallidos
          </button>
        </div>
      </div>

      {/* Legend Badges */}
      <div className="flex items-center gap-4 text-xs font-medium border-b border-amber-500/10 pb-4">
        {activeSeries === 'sales_vs_ads' && (
          <>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50"></span>
              <span className="text-white">Ventas Brutas ($)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50"></span>
              <span className="text-neutral-300">Gasto Pauta ($)</span>
            </div>
          </>
        )}
        {activeSeries === 'users_vs_conversions' && (
          <>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50"></span>
              <span className="text-white">Nuevos Usuarios Registrados</span>
            </div>
          </>
        )}
        {activeSeries === 'funnel' && (
          <>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"></span>
              <span className="text-white">Pagos Aprobados</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"></span>
              <span className="text-neutral-300">Pagos Fallidos / Cancelados</span>
            </div>
          </>
        )}
      </div>

      {/* Interactive Visual Bar Chart */}
      <div className="h-64 flex items-end justify-between gap-1 sm:gap-2 pt-6 pb-2 px-2 bg-black/40 rounded-xl border border-white/5 relative">
        {data.map((item, idx) => {
          let height1 = 0;
          let height2 = 0;

          if (activeSeries === 'sales_vs_ads') {
            height1 = (item.total / maxVal) * 100;
            height2 = (estimatedDailyAdSpend / maxVal) * 100;
          } else if (activeSeries === 'users_vs_conversions') {
            height1 = (((item.new_users || 0) * 10) / maxVal) * 100;
          } else {
            height1 = ((item.successful_payments || 0) / maxVal) * 100;
            height2 = ((item.failed_payments || 0) / maxVal) * 100;
          }

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
              onMouseEnter={() => setHoveredItem(item)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              {/* Bars Group */}
              <div className="w-full flex items-end justify-center gap-0.5 h-full">
                {activeSeries === 'sales_vs_ads' && (
                  <>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(4, height1)}%` }}
                      className="w-1/2 bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-sm group-hover:brightness-125 transition-all shadow-md shadow-amber-500/10"
                    />
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(4, height2)}%` }}
                      className="w-1/2 bg-gradient-to-t from-purple-700 to-purple-400 rounded-t-sm group-hover:brightness-125 transition-all shadow-md shadow-purple-500/10"
                    />
                  </>
                )}
                {activeSeries === 'users_vs_conversions' && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(4, height1)}%` }}
                    className="w-full max-w-[14px] bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t-sm group-hover:brightness-125 transition-all shadow-md shadow-cyan-500/10"
                  />
                )}
                {activeSeries === 'funnel' && (
                  <>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(4, height1)}%` }}
                      className="w-1/2 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm group-hover:brightness-125 transition-all shadow-md shadow-emerald-500/10"
                    />
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(4, height2)}%` }}
                      className="w-1/2 bg-gradient-to-t from-rose-700 to-rose-500 rounded-t-sm group-hover:brightness-125 transition-all shadow-md shadow-rose-500/10"
                    />
                  </>
                )}
              </div>

              {/* Date Label */}
              <span className="text-[9px] text-neutral-500 mt-2 truncate w-full text-center group-hover:text-amber-400 transition-colors">
                {item.date}
              </span>
            </div>
          );
        })}
      </div>

      {/* Amber-Glass Enriched Tooltip Box */}
      {hoveredItem && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-xl bg-neutral-900/95 border border-amber-500/30 text-xs shadow-2xl flex items-center justify-between gap-6"
        >
          <div>
            <span className="text-amber-400 font-semibold">{hoveredItem.date}:</span>
            <span className="text-neutral-300 ml-2">Ventas: ${hoveredItem.total.toLocaleString()} MXN</span>
          </div>
          <div className="flex items-center gap-4 text-neutral-400">
            <span>Registros: <strong className="text-white">{hoveredItem.new_users || 0}</strong></span>
            <span>Aprobados: <strong className="text-emerald-400">{hoveredItem.successful_payments || 0}</strong></span>
            <span>Fallidos: <strong className="text-rose-400">{hoveredItem.failed_payments || 0}</strong></span>
          </div>
        </motion.div>
      )}
    </div>
  );
};
