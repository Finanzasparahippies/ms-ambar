import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, MapPin, Ticket, Clock } from 'lucide-react';

interface BoxOfficeCutoffBannerProps {
  venueName?: string;
  doorsOpenTime?: string;
}

export const BoxOfficeCutoffBanner: React.FC<BoxOfficeCutoffBannerProps> = ({
  venueName = 'London Pub',
  doorsOpenTime = '19:00 hrs'
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full relative overflow-hidden rounded-3xl border border-amber-500/40 bg-nature-night/80 dark:bg-[#0b0d14]/90 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_12px_40px_rgba(245,158,11,0.15)]"
    >
      {/* Decorative Amber Glow Elements */}
      <div className="absolute -top-16 -right-16 w-44 h-44 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-amber-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-5 justify-between">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center shrink-0 shadow-inner">
            <Ticket className="w-6 h-6 text-amber-400 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-[11px] font-black uppercase tracking-wider text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Día del Evento · Venta Web Cerrada</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-100 tracking-tight leading-snug">
              Venta en línea finalizada por inicio del evento.
            </h3>
            <p className="text-xs sm:text-sm text-slate-300/90 font-medium max-w-xl">
              Adquiere tus boletos directamente en la taquilla del recinto.
            </p>
          </div>
        </div>

        <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-white/10 shrink-0">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold text-slate-200">
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Taquilla: {venueName}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-300">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Puertas: {doorsOpenTime}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default BoxOfficeCutoffBanner;
