import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, ShieldAlert, CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { uid, token, email } = router.query;

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== passwordConfirm) {
      setError("Las contraseñas ingresadas no coinciden.");
      setLoading(false);
      return;
    }

    if (!uid || !token) {
      setError("Faltan parámetros de seguridad en la URL (uid/token). Por favor, solicita un nuevo enlace.");
      setLoading(false);
      return;
    }

    try {
      await axios.post(`${API_URL}/users/password-reset-confirm/`, {
        uid,
        token,
        email,
        password,
        password_confirm: passwordConfirm
      });

      setSuccess(true);

      setTimeout(() => {
        router.push('/login');
      }, 2500);

    } catch (err: any) {
      console.error("Password reset confirmation failed", err);
      const data = err.response?.data;
      if (data) {
        if (data.password) {
          setError(`Contraseña: ${data.password[0]}`);
        } else if (data.error) {
          setError(data.error);
        } else {
          setError("El enlace de restablecimiento ha expirado, es inválido o ya ha sido utilizado.");
        }
      } else {
        setError("Error de comunicación con el servidor. Intenta de nuevo.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-[#F4F6F0] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-amber-honey/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] bg-nature-sky/5 blur-[150px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full relative z-10"
      >
        {/* Logo Section */}
        <div className="text-center mb-8 flex flex-col items-center">
          <Link href="/" className="mb-4 inline-block">
            <img src="/logos/ms_ambar_monograma_b.png" alt="Ms Ambar" className="w-16 h-16 object-contain hover:scale-105 transition-transform duration-300" />
          </Link>
          <span className="text-[10px] text-amber-honey uppercase tracking-widest font-black flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-honey animate-ping" />
            Reinicializar Acceso
          </span>
          <h1 className="text-3xl md:text-4xl font-black text-[#F4F6F0] uppercase italic tracking-tighter mt-2">
            Nueva Contraseña
          </h1>
          <p className="text-[#F4F6F0]/50 text-xs font-bold uppercase tracking-wider mt-1 text-center">
            {email ? `Restableciendo para: ${email}` : 'Establece tu nueva contraseña de ingreso'}
          </p>
        </div>

        {/* Form Container Card */}
        <div className="amber-glass p-8 rounded-[2.5rem] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-amber-honey to-transparent opacity-60" />

          <AnimatePresence mode="wait">
            {!success ? (
              <motion.form
                key="confirm-form"
                onSubmit={handleSubmit}
                className="space-y-6"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {/* Error Banner */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-400 text-xs font-bold uppercase"
                  >
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* Password Field */}
                <div className="space-y-2">
                  <label className="text-[10px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Nueva Contraseña</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/30 group-focus-within:text-amber-honey transition-colors">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Nueva contraseña"
                      className="w-full bg-white/5 border border-white/10 focus:border-amber-honey rounded-2xl pl-11 pr-12 py-4 text-sm font-semibold text-white placeholder-white/30 outline-none transition-all focus:shadow-[0_0_15px_rgba(229,169,59,0.1)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-2">
                  <label className="text-[10px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Confirmar Nueva Contraseña</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/30 group-focus-within:text-amber-honey transition-colors">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="Confirmar contraseña"
                      className="w-full bg-white/5 border border-white/10 focus:border-amber-honey rounded-2xl pl-11 pr-4 py-4 text-sm font-semibold text-white placeholder-white/30 outline-none transition-all focus:shadow-[0_0_15px_rgba(229,169,59,0.1)]"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-honey to-amber-500 hover:from-amber-500 hover:to-amber-600 text-[#1E2B22] font-black uppercase tracking-widest text-xs py-4 rounded-2xl transition-all shadow-[0_4px_30px_rgba(229,169,59,0.2)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                  ) : (
                    <>
                      Restablecer Contraseña <ArrowRight size={14} />
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
                <h3 className="text-xl font-black uppercase italic tracking-tight text-[#F4F6F0]">Contraseña Cambiada</h3>
                <p className="text-[#F4F6F0]/70 text-xs font-semibold leading-relaxed px-4">
                  Tu clave ha sido actualizada con éxito en el club de Ms Ambar. Redirigiéndote al inicio de sesión...
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Return to Forgot Link if missing uid/token */}
        {(!uid || !token) && (
          <div className="text-center mt-6">
            <Link
              href="/forgot-password"
              className="inline-flex items-center gap-2 text-xs text-amber-honey hover:text-amber-honey/80 font-black uppercase tracking-widest text-[9px] transition-colors"
            >
              <ArrowLeft size={12} /> Solicitar Nuevo Token de Recuperación
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
