import * as React from 'react';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, AlertCircle, X, Mail } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export default function Suscribirse() {
  const [newsletterName, setNewsletterName] = useState('');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Check if already subscribed in this browser
  useEffect(() => {
    const storedEmail = localStorage.getItem('ms_ambar_subscriber_email');
    if (storedEmail) {
      setNewsletterSuccess(true);
    }
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterSubmitting(true);
    try {
      await axios.post(`${API_URL}/blog/subscribers/`, {
        email: newsletterEmail,
        name: newsletterName
      });
      localStorage.setItem('ms_ambar_subscriber_email', newsletterEmail);
      setNewsletterSuccess(true);
      setNewsletterEmail('');
      setNewsletterName('');
      showToast('Te has suscrito con éxito al Newsletter de Ms Ambar.', 'success');
    } catch (err: any) {
      console.error(err);
      const isAlreadySubbed = err.response?.data?.email?.[0]?.includes('exists') ||
        err.response?.data?.email?.[0]?.includes('ya existe') ||
        err.response?.status === 400;

      if (isAlreadySubbed) {
        localStorage.setItem('ms_ambar_subscriber_email', newsletterEmail);
        setNewsletterSuccess(true);
        setNewsletterEmail('');
        setNewsletterName('');
        showToast('Suscripción confirmada. Acceso concedido.', 'success');
      } else {
        const msg = err.response?.data?.email?.[0] || 'Error al suscribirse. Inténtalo de nuevo.';
        showToast(msg, 'error');
      }
    } finally {
      setNewsletterSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen text-[#F4F6F0] flex items-center justify-center px-6 py-20 relative overflow-hidden font-sans selection:bg-amber-honey/30">
      <Head>
        <title>Solo para reales | Ms Ambar</title>
        <meta name="description" content="Deja tu correo aquí y recibe el newsletter escrito por Ms. Ambar, en donde te contará ideas hechas canciones, fechas próximas de presentaciones o noticias exclusivas" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Decorative background ambient glows */}
      <div className="absolute top-[-15%] left-[-15%] w-[60%] h-[60%] bg-amber-honey/5 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[50%] h-[50%] bg-nature-sky/5 blur-[120px] rounded-full pointer-events-none" />

      <AnimatePresence mode="wait">
        {!newsletterSuccess ? (
          /* REGISTRATION FORM */
          <motion.div
            key="subscribe-form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4 }}
            className="max-w-md w-full amber-glass p-8 md:p-12 rounded-[3.5rem] text-center relative z-10"
          >
            <div className="w-16 h-16 rounded-full bg-amber-honey/10 border border-amber-honey/30 flex items-center justify-center mx-auto mb-8 text-amber-honey shadow-[0_0_20px_rgba(245,158,11,0.1)]">
              <Mail size={24} className="animate-pulse" />
            </div>

            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-honey block mb-2">Newsletter Oficial</span>
            <h2 className="text-3xl font-serif text-[#F4F6F0] mb-4 tracking-tight italic font-normal">Ambar te escribe</h2>
            <p className="text-[#F4F6F0]/70 mb-10 text-xs leading-relaxed max-w-sm mx-auto">
              Deja tu correo aquí y recibe el newsletter escrito por Ms. Ambar, en donde te contará ideas hechas canciones, fechas próximas de presentaciones o noticias exclusivas.
            </p>

            <form className="flex flex-col gap-3 text-left" onSubmit={handleSubscribe}>
              <input
                type="text"
                required
                value={newsletterName}
                onChange={e => setNewsletterName(e.target.value)}
                placeholder="Tu Nombre"
                className="w-full bg-white/5 text-white rounded-xl px-5 py-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-honey/20 transition-all border border-white/10 placeholder:text-white/30"
                disabled={newsletterSubmitting}
              />
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={e => setNewsletterEmail(e.target.value)}
                placeholder="Tu Correo Electrónico"
                className="w-full bg-white/5 text-white rounded-xl px-5 py-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-honey/20 transition-all border border-[#ffffff]/10 placeholder:text-white/30"
                disabled={newsletterSubmitting}
              />
              <button
                type="submit"
                disabled={newsletterSubmitting}
                className="w-full bg-gradient-to-r from-amber-honey via-amber-gold to-amber-500 hover:from-amber-gold hover:to-amber-500 active:scale-[0.98] text-[#1E2B22] font-black text-[10px] uppercase tracking-[0.25em] py-[18px] rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_35px_rgba(245,158,11,0.35)] whitespace-nowrap text-center flex items-center justify-center gap-2 hover:scale-[1.02] mt-2"
              >
                {newsletterSubmitting ? (
                  <span className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-[#1E2B22]/20 border-t-[#1E2B22] rounded-full animate-spin" />
                    Sintonizando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Suscribirse <Sparkles size={11} className="text-[#1E2B22] fill-current animate-pulse" />
                  </span>
                )}
              </button>
            </form>
          </motion.div>
        ) : (
          /* SUCCESS VIEW */
          <motion.div
            key="subscribe-success"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4 }}
            className="max-w-md w-full amber-glass p-8 md:p-12 rounded-[3.5rem] text-center relative z-10"
          >
            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-8 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.1)]">
              <Check size={28} className="animate-bounce" />
            </div>

            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-green-400 block mb-2">¡Suscripción Completa!</span>
            <h2 className="text-3xl font-serif text-[#F4F6F0] mb-4 tracking-tight italic font-normal">Frecuencia Sintonizada</h2>
            <p className="text-[#F4F6F0]/70 mb-10 text-xs leading-relaxed max-w-sm mx-auto">
              Gracias por sumarte. Hemos guardado tu suscripción correctamente. Muy pronto recibirás poemas y crónicas íntimas directo en tu bandeja de entrada.
            </p>

            <Link
              href="/"
              className="w-full bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 text-[#F4F6F0] font-black text-[10px] uppercase tracking-[0.25em] py-[18px] rounded-xl transition-all duration-300 whitespace-nowrap text-center block hover:scale-[1.02]"
            >
              Explorar Ms Ambar
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notifications Container */}
      <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`pointer-events-auto p-4 rounded-2xl border flex items-start gap-3 shadow-xl backdrop-blur-md ${toast.type === 'success'
                ? 'bg-[#0B0F0D] border-amber-honey/30 text-[#F4F6F0]'
                : 'bg-[#0B0F0D] border-red-500/30 text-red-400'
                }`}
            >
              <div className={`p-1.5 rounded-lg ${toast.type === 'success' ? 'bg-amber-honey/10 text-amber-honey animate-pulse' : 'bg-red-500/10 text-red-400'}`}>
                {toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
              </div>
              <div className="flex-1 space-y-1">
                <h4 className={`text-[10px] font-black uppercase tracking-widest ${toast.type === 'success' ? 'text-amber-honey' : 'text-red-400'}`}>
                  {toast.type === 'success' ? 'SINTONIZACIÓN' : 'FRECUENCIA INCOMPATIBLE'}
                </h4>
                <p className="text-[11px] font-medium leading-relaxed opacity-85">{toast.message}</p>
              </div>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-[#F4F6F0]/30 hover:text-[#F4F6F0] transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
Suscribirse.getLayout = function getLayout(page: React.ReactNode) {
  return page;
};
