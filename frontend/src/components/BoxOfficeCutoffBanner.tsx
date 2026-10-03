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
  paymentMethods = ['Efectivo', 'Tarjeta Visa / Mastercard', 'Terminal Contactless']
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full relative overflow-hidden rounded-3xl border border-amber-500/40 bg-zinc-950/80 backdrop-blur-xl p-5 sm:p-7 shadow-[0_16px_50px_rgba(245,158,11,0.18)]"
    >
      {/* Decorative Amber Glow Flares */}
      <div className="absolute -top-20 -right-20 w-52 h-52 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-52 h-52 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-4">
        {/* Top Notification Row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/25 to-amber-600/15 border border-amber-500/50 flex items-center justify-center shrink-0 shadow-inner text-amber-400">
              <Ticket className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-[11px] font-black uppercase tracking-wider text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Venta en Línea Finalizada · Taquilla Física Habilitada</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-snug">
                Adquiere tus accesos directamente en las taquillas del recinto
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                Las compras web para este evento han cerrado por preparación de sala y validación en accesos.
              </p>
            </div>
          </div>

          {/* Quick Schedule Badges */}
          <div className="w-full md:w-auto flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold text-slate-200">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-[10px] uppercase font-bold text-slate-400">Lugar</span>
                <span className="font-extrabold">{venueName}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-300">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-[10px] uppercase font-bold text-amber-400/80">Puertas</span>
                <span className="font-extrabold">{doorsOpenTime}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Payment Methods Guidance */}
        <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2 text-slate-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Métodos aceptados en taquilla:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-bold">
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
