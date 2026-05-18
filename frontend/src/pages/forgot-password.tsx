import React, { useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, CheckCircle, ShieldAlert, ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDevResetUrl(null);

    try {
      const res = await axios.post(`${API_URL}/users/password-reset/`, { email });
      setSuccess(true);
      
      // Capture the developer convenience link if returned by Django in DEBUG mode
      if (res.data._dev_reset_url) {
        setDevResetUrl(res.data._dev_reset_url);
      }
    } catch (err: any) {
      console.error("Password reset request failed", err);
      setError("Ocurrió un error al procesar tu solicitud. Verifica tu conexión de red.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-amber-500/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] bg-amber-700/5 blur-[150px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full relative z-10"
      >
        {/* Logo Section */}
        <div className="text-center mb-8">
          <span className="text-[10px] text-amber-500 uppercase tracking-widest font-black flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            Recuperación de Cuenta
          </span>
          <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-amber-100 via-amber-300 to-amber-500 bg-clip-text text-transparent uppercase italic tracking-tighter mt-2">
            Restablecer Clave
          </h1>
          <p className="text-white/40 text-xs font-bold uppercase tracking-wider mt-1">
            Recupera tu acceso a la Bóveda de MS AMBAR
          </p>
        </div>

        {/* Form Container Card */}
        <div className="bg-white/[0.02] border border-white/10 p-8 rounded-[2.5rem] backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-60" />

          <AnimatePresence mode="wait">
            {!success ? (
              <motion.form
                key="request-form"
                onSubmit={handleSubmit}
                className="space-y-6"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {/* Info Text */}
                <p className="text-xs text-white/50 leading-relaxed text-center px-2">
                  Introduce tu correo electrónico registrado y te enviaremos las instrucciones de restablecimiento de contraseña de inmediato.
                </p>

                {/* Error Banner */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3 text-red-400 text-xs font-bold uppercase"
                  >
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* Email Field */}
                <div className="space-y-2">
                  <label className="text-[10px] text-white/50 uppercase tracking-widest font-black block pl-1">Correo Electrónico</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/30 group-focus-within:text-amber-500 transition-colors">
                      <Mail size={16} />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nombre@ejemplo.com"
                      className="w-full bg-white/[0.03] border border-white/10 focus:border-amber-500/60 rounded-2xl pl-11 pr-4 py-4 text-sm font-semibold placeholder-white/20 outline-none transition-all focus:shadow-[0_0_15px_rgba(245,158,11,0.1)] focus:bg-white/[0.05]"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-xs py-4 rounded-2xl transition-all shadow-[0_4px_30px_rgba(245,158,11,0.2)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                  ) : (
                    <>
                      Solicitar Enlace <ArrowRight size={14} />
                    </>
                  )}
                </motion.button>
              </motion.form>
            ) : (
              <motion.div
                key="success-screen"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-6 text-center flex flex-col items-center gap-5"
              >
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-full text-green-400">
                  <CheckCircle size={36} className="animate-pulse" />
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight">Solicitud Enviada</h3>
                <p className="text-white/60 text-xs font-semibold leading-relaxed px-4">
                  Si la dirección <span className="text-amber-400 font-bold">{email}</span> se encuentra registrada, recibirás un correo con las instrucciones de recuperación.
                </p>

                {/* Developer debug helper link */}
                {devResetUrl && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="w-full mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-left"
                  >
                    <span className="text-[9px] text-amber-400 uppercase tracking-wider font-black flex items-center gap-1.5 mb-2">
                      ⚡ Modo Desarrollo Nectar Labs
                    </span>
                    <p className="text-[10px] text-white/50 leading-relaxed mb-3">
                      Enlace de recuperación generado en el servidor Django (DEBUG=True):
                    </p>
                    <a
                      href={devResetUrl}
                      className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-black uppercase tracking-wider text-[10px] px-4 py-3 rounded-xl transition-all shadow-[0_2px_15px_rgba(245,158,11,0.15)]"
                    >
                      Restablecer Ahora <ExternalLink size={12} />
                    </a>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Return to Login */}
        <div className="text-center mt-6">
          <Link 
            href="/login" 
            className="inline-flex items-center gap-2 text-xs text-white/40 hover:text-white/60 font-semibold transition-colors"
          >
            <ArrowLeft size={12} /> Volver al Inicio de Sesión
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
