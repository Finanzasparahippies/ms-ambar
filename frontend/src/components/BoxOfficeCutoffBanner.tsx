import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, MapPin, Ticket, Clock, CreditCard, Banknote, ShieldCheck } from 'lucide-react';

interface BoxOfficeCutoffBannerProps {
  venueName?: string;
  venueAddress?: string;
  doorsOpenTime?: string;
  paymentMethods?: string[];
}

export const BoxOfficeCutoffBanner: React.FC<BoxOfficeCutoffBannerProps> = ({
  venueName = 'London Pub',
  venueAddress = 'Hermosillo, Sonora',
  doorsOpenTime = '19:00 hrs',
  paymentMethods = ['Efectivo', 'Tarjetas Débito / Crédito']
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full relative overflow-hidden rounded-3xl border border-amber-500/40 bg-zinc-950/90 backdrop-blur-xl p-5 sm:p-6 shadow-[0_16px_50px_rgba(245,158,11,0.18)]"
    >
      {/* Decorative Amber Glow Elements */}
      <div className="absolute -top-16 -right-16 w-44 h-44 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-4">
        {/* Header with Icon and Badge */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/25 to-amber-600/15 border border-amber-500/50 flex items-center justify-center shrink-0 shadow-inner text-amber-400">
            <Ticket className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/35 text-[10px] font-black uppercase tracking-wider text-amber-300 w-fit">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Venta en Línea Concluida · Taquilla Física</span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-snug">
              Adquiere tus accesos directamente en taquilla
            </h3>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Las compras web para este evento han cerrado por preparación de sala y validación en accesos.
            </p>
          </div>
        </div>

        {/* Venue and Schedule Cards: Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/5 border border-white/10 text-xs">
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex flex-col min-w-0 text-left">
              <span className="text-[10px] uppercase font-bold text-slate-400">Taquilla Física</span>
              <span className="font-extrabold text-white truncate">{venueName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex flex-col min-w-0 text-left">
              <span className="text-[10px] uppercase font-bold text-amber-400/80">Apertura Puertas</span>
              <span className="font-extrabold text-amber-300 truncate">{doorsOpenTime}</span>
            </div>
          </div>
        </div>

        {/* Bottom Payment Methods */}
        <div className="pt-3 border-t border-white/10 flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[11px] font-bold">Cobro seguro en puerta del recinto:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-bold">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-slate-200">
              <Banknote className="w-3.5 h-3.5 text-emerald-400" />
              Efectivo MXN
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-slate-200">
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              Tarjetas Débito / Crédito
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default BoxOfficeCutoffBanner;
