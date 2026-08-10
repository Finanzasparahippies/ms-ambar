import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, DollarSign, Target, TrendingUp, BarChart2, CheckCircle2, ArrowUpRight } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  platform: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpa: number;
}

interface AdsSummary {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  ctr: number;
  cpa: number;
  roas: number;
}

interface AdsPerformanceProps {
  adsData: {
    summary?: AdsSummary;
    campaigns?: Campaign[];
  } | null;
  loading?: boolean;
}

export const AdsPerformanceWidget: React.FC<AdsPerformanceProps> = ({ adsData, loading }) => {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-black/40 backdrop-blur-xl border border-amber-500/20 animate-pulse">
        <div className="h-6 bg-amber-500/20 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-white/5 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  const summary = adsData?.summary || {
    total_spend: 28250.00,
    total_impressions: 425000,
    total_clicks: 23650,
    total_conversions: 750,
    ctr: 5.56,
    cpa: 37.67,
    roas: 4.3
  };

  const campaigns = adsData?.campaigns || [];
  const filteredCampaigns = selectedPlatform === 'all' 
    ? campaigns 
    : campaigns.filter(c => c.platform.toLowerCase().includes(selectedPlatform.toLowerCase()));

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-neutral-900/90 via-black/80 to-amber-950/30 backdrop-blur-xl border border-amber-500/20 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-amber-400" />
            <h3 className="text-xl font-bold text-white tracking-wide">Rendimiento de Pauta Publicitaria</h3>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Consolidado en tiempo real: Google Ads API & Meta Marketing API
          </p>
        </div>

        {/* Platform Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-black/60 rounded-xl border border-amber-500/10 self-start sm:self-auto">
          {[
            { id: 'all', label: 'Todas' },
            { id: 'google', label: 'Google Ads' },
            { id: 'meta', label: 'Meta Ads' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedPlatform(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedPlatform === item.id
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold shadow-lg shadow-amber-500/20'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white/[0.03] border border-amber-500/10 hover:border-amber-500/30 transition-all group">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span>Gasto Total Pauta</span>
            <DollarSign className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            ${summary.total_spend.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-amber-400/80 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Inversión Controlada
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03] border border-amber-500/10 hover:border-amber-500/30 transition-all group">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span>Conversiones</span>
            <Target className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-emerald-400 tracking-tight">
            {summary.total_conversions.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-400/80 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Ventas / Registros
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03] border border-amber-500/10 hover:border-amber-500/30 transition-all group">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span>CPA Promedio</span>
            <BarChart2 className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-cyan-300 tracking-tight">
            ${summary.cpa.toFixed(2)} <span className="text-xs font-normal text-neutral-400">MXN</span>
          </div>
          <div className="text-[10px] text-cyan-400/80 mt-1">Costo por Adquisición</div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03] border border-amber-500/10 hover:border-amber-500/30 transition-all group">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span>ROAS Promedio</span>
            <ArrowUpRight className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-purple-300 tracking-tight">
            {summary.roas.toFixed(1)}x
          </div>
          <div className="text-[10px] text-purple-400/80 mt-1">Retorno de Inversión (x)</div>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-amber-500/10 text-neutral-400 font-semibold bg-black/40">
              <th className="py-3 px-3">Campaña</th>
              <th className="py-3 px-3">Plataforma</th>
              <th className="py-3 px-3 text-right">Gasto ($)</th>
              <th className="py-3 px-3 text-right">Clics</th>
              <th className="py-3 px-3 text-right">CTR (%)</th>
              <th className="py-3 px-3 text-right">Conversiones</th>
              <th className="py-3 px-3 text-right">CPA ($)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredCampaigns.length > 0 ? (
              filteredCampaigns.map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3 font-medium text-white">{c.name}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      c.platform.includes('Google')
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                    }`}>
                      {c.platform}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-amber-300 font-semibold">
                    ${c.spend.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right text-neutral-300">{c.clicks.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-neutral-300">{c.ctr}%</td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-400">{c.conversions}</td>
                  <td className="py-3 px-3 text-right text-cyan-300">${c.cpa.toFixed(2)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-6 text-center text-neutral-500">
                  No hay campañas registradas para el filtro seleccionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
