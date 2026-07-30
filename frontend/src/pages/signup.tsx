import React, { useState } from 'react';
import api from '../lib/api';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Phone, Lock, Eye, EyeOff, ShieldAlert, CheckCircle, ArrowRight } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
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

    try {
      const res = await api.post('/users/register/', {
        email,
        username,
        phone: phone || null,
        password,
        password_confirm: passwordConfirm
      });

      // Save tokens and user info (automatic login)
      localStorage.setItem('token', res.data.tokens.access);
      localStorage.setItem('refresh_token', res.data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify({
        email: res.data.user.email,
        id: res.data.user.id,
        is_staff: res.data.user.is_staff,
        is_superuser: false
      }));

      setSuccess(true);

      setTimeout(() => {
        if (res.data.user.is_staff) {
          router.push('/admin');
        } else {
          router.push('/');
        }
      }, 1500);

    } catch (err: any) {
      console.error("Registration failed", err);
      const data = err.response?.data;
      if (data) {
        if (data.email) {
          setError(`Email: ${data.email[0]}`);
        } else if (data.username) {
          setError(`Usuario: ${data.username[0]}`);
        } else if (data.password) {
          setError(`Contraseña: ${data.password[0]}`);
        } else if (data.non_field_errors) {
          setError(data.non_field_errors[0]);
        } else {
          setError("Error de validación. Verifica los campos ingresados.");
        }
      } else {
        setError("Error de red al intentar registrarse. Intenta más tarde.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-[#F4F6F0] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-amber-honey/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] bg-amber-honey/[0.03] blur-[150px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full relative z-10 py-12"
      >
        {/* Logo Section */}
        <div className="text-center mb-8 flex flex-col items-center">
          <Link href="/" className="mb-4 inline-block">
            <img src="/logos/ms_ambar_monograma_b.png" alt="Ms Ambar" className="w-16 h-16 object-contain hover:scale-105 transition-transform duration-300" />
          </Link>
          <span className="text-[10px] text-amber-honey uppercase tracking-widest font-black flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-honey animate-ping" />
            CREA TU CREDENCIAL
          </span>
          <h1 className="text-3xl md:text-4xl font-black text-white uppercase italic tracking-tighter mt-2 font-serif">
            REGISTRO OFICIAL
          </h1>
          <p className="text-[#F4F6F0]/45 text-[10px] font-black uppercase tracking-widest mt-1.5 text-center">
            ÚNETE AL CLUB DE MS AMBAR
          </p>
        </div>

        {/* Form Container Card */}
        <div className="bg-[#0c0f0d]/95 backdrop-blur-xl p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl shadow-black border border-amber-honey/25">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-honey/40 to-transparent" />

          <AnimatePresence mode="wait">
            {!success ? (
              <motion.form
                key="signup-form"
                onSubmit={handleSubmit}
                className="space-y-5"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {/* Error Banner */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-red-950/40 border border-red-500/30 rounded-2xl flex items-start gap-3 text-red-200 text-xs font-bold uppercase"
                  >
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* Username Field */}
                <div className="space-y-1.5">
                  <label className="text-[9px] text-[#F4F6F0]/65 uppercase tracking-widest font-black block pl-1">Nombre de Usuario</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#F4F6F0]/25 group-focus-within:text-amber-honey transition-colors">
                      <User size={16} />
                    </div>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="tu_usuario"
                      className="w-full bg-[#080c0a] border border-white/5 focus:border-amber-honey/40 focus:ring-1 focus:ring-amber-honey/25 rounded-2xl pl-11 pr-4 py-3.5 text-xs font-semibold text-[#F4F6F0] placeholder-[#F4F6F0]/20 outline-none transition-all focus:shadow-[0_0_15px_rgba(229,169,59,0.02)]"
                    />
                  </div>
                </div>

                {/* Email Field */}
                <div className="space-y-1.5">
                  <label className="text-[9px] text-[#F4F6F0]/65 uppercase tracking-widest font-black block pl-1">Correo Electrónico</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#F4F6F0]/25 group-focus-within:text-amber-honey transition-colors">
                      <Mail size={16} />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nombre@ejemplo.com"
                      className="w-full bg-[#080c0a] border border-white/5 focus:border-amber-honey/40 focus:ring-1 focus:ring-amber-honey/25 rounded-2xl pl-11 pr-4 py-3.5 text-xs font-semibold text-[#F4F6F0] placeholder-[#F4F6F0]/20 outline-none transition-all focus:shadow-[0_0_15px_rgba(229,169,59,0.02)]"
                    />
                  </div>
                </div>

                {/* Phone Field */}
                <div className="space-y-1.5">
                  <label className="text-[9px] text-[#F4F6F0]/65 uppercase tracking-widest font-black block pl-1">Celular (Opcional)</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#F4F6F0]/25 group-focus-within:text-amber-honey transition-colors">
                      <Phone size={16} />
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+54 9 11 1234 5678"
                      className="w-full bg-[#080c0a] border border-white/5 focus:border-amber-honey/40 focus:ring-1 focus:ring-amber-honey/25 rounded-2xl pl-11 pr-4 py-3.5 text-xs font-semibold text-[#F4F6F0] placeholder-[#F4F6F0]/20 outline-none transition-all focus:shadow-[0_0_15px_rgba(229,169,59,0.02)]"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <label className="text-[9px] text-[#F4F6F0]/65 uppercase tracking-widest font-black block pl-1">Contraseña</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#F4F6F0]/25 group-focus-within:text-amber-honey transition-colors">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#080c0a] border border-white/5 focus:border-amber-honey/40 focus:ring-1 focus:ring-amber-honey/25 rounded-2xl pl-11 pr-12 py-3.5 text-xs font-semibold text-[#F4F6F0] placeholder-[#F4F6F0]/20 outline-none transition-all focus:shadow-[0_0_15px_rgba(229,169,59,0.02)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#F4F6F0]/25 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-1.5">
                  <label className="text-[9px] text-[#F4F6F0]/65 uppercase tracking-widest font-black block pl-1">Confirmar Contraseña</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#F4F6F0]/25 group-focus-within:text-amber-honey transition-colors">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#080c0a] border border-white/5 focus:border-amber-honey/40 focus:ring-1 focus:ring-amber-honey/25 rounded-2xl pl-11 pr-4 py-3.5 text-xs font-semibold text-[#F4F6F0] placeholder-[#F4F6F0]/20 outline-none transition-all focus:shadow-[0_0_15px_rgba(229,169,59,0.02)]"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber-honey text-[#080C0A] font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-amber-honey/95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-honey/5"
                >
                  {loading ? (
                    <div className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                  ) : (
                    <>
                      Completar Registro <ArrowRight size={14} />
                    </>
                  )}
                </motion.button>
              </motion.form>
            ) : (
              <motion.div
                key="success-screen"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-8 text-center flex flex-col items-center gap-4"
              >
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 animate-bounce">
                  <CheckCircle size={36} />
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-white">Registro Exitoso</h3>
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest">
                  Creando cuenta y preparando canal de acceso...
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Switch to Login */}
        <div className="text-center mt-6">
          <p className="text-xs text-[#F4F6F0]/40 font-semibold uppercase tracking-wider text-[10px]">
            ¿Ya tienes una cuenta registrada?{' '}
            <Link
              href="/login"
              className="text-amber-honey hover:text-amber-honey/80 font-black uppercase tracking-widest text-[10px] transition-colors ml-1"
            >
              INICIAR SESIÓN
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
