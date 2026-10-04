import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Camera,
  User,
  MapPin,
  Calendar,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  LogIn,
  Clock
} from 'lucide-react';
import api from '../../lib/api';

interface CheckInDetails {
  status: 'SUCCESS' | 'ALREADY_USED' | 'INVALID_QR' | 'FORBIDDEN' | 'ERROR';
  code?: string;
  message: string;
  event?: string;
  venue_name?: string;
  physical_location?: string;
  attendee?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  folio?: number;
  has_mg?: boolean;
  checked_in_at?: string;
  checked_in_by?: string;
}

export default function StaffScanLandingPage() {
  const router = useRouter();
  const { token, sig, ts } = router.query;

  const [authState, setAuthState] = useState<'checking' | 'authorized' | 'unauthorized' | 'forbidden'>('checking');
  const [operatorEmail, setOperatorEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [result, setResult] = useState<CheckInDetails | null>(null);

  // Prevenir doble ejecución en React 18/Strict Mode o recargas de página
  const hasProcessedRef = useRef<boolean>(false);

  // 1. Guardia de Autenticación de Staff
  useEffect(() => {
    if (!router.isReady) return;

    const jwtToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!jwtToken) {
      setAuthState('unauthorized');
      setLoading(false);
      // Redirigir a login preservando los parámetros completos del escaneo
      const currentUrl = router.asPath;
      router.replace(`/login?redirect=${encodeURIComponent(currentUrl)}`);
      return;
    }

    // Verificar perfil de usuario y flags de staff
    api.get('/users/profile/')
      .then((res) => {
        const profile = res.data;
        if (profile.is_staff || profile.is_superuser) {
          setAuthState('authorized');
          setOperatorEmail(profile.email || 'Staff');
        } else {
          setAuthState('forbidden');
          setLoading(false);
          setResult({
            status: 'FORBIDDEN',
            code: 'STAFF_REQUIRED',
            message: 'Acceso Restringido. Esta terminal de canje requiere credenciales autorizadas del staff de Ms. Ambar.'
          });
        }
      })
      .catch((err) => {
        console.error('Error validando credenciales de staff:', err);
        setAuthState('unauthorized');
        setLoading(false);
        const currentUrl = router.asPath;
        router.replace(`/login?redirect=${encodeURIComponent(currentUrl)}`);
      });
  }, [router.isReady, router.asPath]);

  // 2. Ejecutar Canje cuando el Staff esté Autorizado
  useEffect(() => {
    if (authState !== 'authorized' || !router.isReady) return;

    if (!token) {
      setLoading(false);
      setResult({
        status: 'INVALID_QR',
        code: 'TICKET_INVALID',
        message: 'No se detectó un identificador de boleto válido en la URL.'
      });
      return;
    }

    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    const redeemTicket = async () => {
      setLoading(true);
      const idempotencyKey = `native-scan-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      try {
        const fullUrl = typeof window !== 'undefined' ? window.location.href : '';
        const res = await api.post(
          '/tickets/tickets/redeem/',
          {
            qr_payload: fullUrl,
            token: String(token),
            sig: sig ? String(sig) : undefined,
            ts: ts ? String(ts) : undefined,
            scanner_device_id: 'native-mobile-camera',
            location: 'Acceso Puerta Móvil',
            idempotency_key: idempotencyKey
          },
          {
            headers: { 'X-Idempotency-Key': idempotencyKey }
          }
        );

        const data = res.data;
        setResult({
          status: 'SUCCESS',
          code: data.code || 'TICKET_SUCCESS',
          message: data.message || 'Acceso concedido exitosamente.',
          event: data.event?.title || 'Por definir',
          venue_name: data.event?.venue_name || 'Por definir',
          physical_location: data.physical_location || 'Entrada General',
          attendee: {
            email: data.attendee?.email,
            phone: data.attendee?.phone
          },
          folio: data.folio,
          has_mg: data.has_mg,
          checked_in_at: data.checked_in_at || new Date().toISOString()
        });

        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.([100]);
        }
      } catch (err: any) {
        const status = err.response?.status;
        const data = err.response?.data || {};

        if (status === 409 || data.code === 'TICKET_ALREADY_USED') {
          setResult({
            status: 'ALREADY_USED',
            code: 'TICKET_ALREADY_USED',
            message: data.message || 'Este boleto ya fue canjeado previamente.',
            event: data.event,
            physical_location: data.physical_location,
            attendee: {
              email: data.buyer
            },
            checked_in_at: data.checked_in_at,
            checked_in_by: data.checked_in_by
          });
          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate?.([200, 100, 200]);
          }
        } else if (status === 403 || status === 401) {
          setResult({
            status: 'FORBIDDEN',
            code: 'UNAUTHORIZED_OPERATOR',
            message: 'Tu sesión no cuenta con permisos de Staff para canjear boletos.'
          });
          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate?.([300]);
          }
        } else {
          setResult({
            status: 'INVALID_QR',
            code: data.code || 'TICKET_INVALID',
            message: data.message || 'Firma o código QR no válido. Boleto no reconocido.'
          });
          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate?.([400]);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    redeemTicket();
  }, [authState, router.isReady, token, sig, ts]);

  return (
    <>
      <Head>
        <title>Control de Acceso Staff | Ms. Ambar</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      <main className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 font-sans selection:bg-amber-500/30">
        {/* Header de Staff */}
        <header className="flex items-center justify-between py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span className="font-mono text-xs uppercase tracking-widest text-white/80">Ms. Ambar Gate Control</span>
          </div>
          <div className="flex items-center gap-2">
            {operatorEmail && (
              <span className="text-[11px] text-amber-300/80 font-mono hidden sm:inline">
                {operatorEmail}
              </span>
            )}
            <span className="text-[10px] bg-amber-400/10 border border-amber-400/30 px-2.5 py-0.5 rounded-full text-amber-300 font-mono uppercase tracking-wider">
              Staff Oficial
            </span>
          </div>
        </header>

        {/* Contenido Central / Card de Validación */}
        <div className="my-auto py-6 max-w-md w-full mx-auto">
          {loading || authState === 'checking' ? (
            <div className="bg-slate-900/90 border border-white/10 rounded-3xl p-8 text-center backdrop-blur-xl shadow-2xl animate-pulse">
              <RefreshCw className="w-12 h-12 text-amber-400 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-bold tracking-tight text-white mb-1">
                {authState === 'checking' ? 'Autenticando Operador...' : 'Validando Credencial...'}
              </h2>
              <p className="text-xs text-white/50 font-mono">
                {authState === 'checking' ? 'Verificando permisos de staff en sesión' : 'Procesando firma criptográfica HMAC-SHA256'}
              </p>
            </div>
          ) : result?.status === 'FORBIDDEN' ? (
            <div className="bg-rose-950/40 border-2 border-rose-500 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_0_50px_rgba(244,63,94,0.25)] text-center animate-in zoom-in-95 duration-200">
              <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-400 flex items-center justify-center mx-auto mb-4 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.4)]">
                <ShieldAlert className="w-12 h-12" />
              </div>
              <span className="inline-block px-3 py-1 bg-rose-500/20 text-rose-300 text-xs font-mono font-bold uppercase tracking-widest rounded-full mb-2">
                Acceso Restringido
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-2">
                Permisos Insuficientes
              </h1>
              <p className="text-sm text-rose-200/80 mb-6">{result.message}</p>
              <Link
                href={`/login?redirect=${encodeURIComponent(router.asPath)}`}
                className="w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-600/30"
              >
                <LogIn className="w-4 h-4" />
                Iniciar Sesión con Cuenta de Staff
              </Link>
            </div>
          ) : result?.status === 'SUCCESS' ? (
            <div className="bg-emerald-950/40 border-2 border-emerald-500 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_0_50px_rgba(16,185,129,0.25)] text-center animate-in zoom-in-95 duration-200">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <span className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold uppercase tracking-widest rounded-full mb-2">
                Boleto Válido · Acceso Concedido
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
                {result.physical_location || 'Entrada General'}
              </h1>

              {/* Badge Destacado Meet & Greet */}
              {result.has_mg ? (
                <div className="my-4 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/30 via-amber-400/20 to-amber-500/30 border-2 border-amber-400 rounded-2xl text-amber-200 font-black text-sm uppercase tracking-wider animate-pulse shadow-[0_0_25px_rgba(251,191,36,0.3)]">
                  <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>⭐ ACCESO MEET & GREET - ENTREGAR PULSERA</span>
                </div>
              ) : (
                <div className="mb-4 text-xs font-mono text-white/50">
                  Acceso Concierto Regular
                </div>
              )}

              {/* Tarjeta de Metadatos del Comprador y Asiento */}
              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-left space-y-2.5 mb-6 text-sm">
                {result.attendee?.email && (
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-white/50 text-xs flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-400" />
                      Comprador:
                    </span>
                    <span className="font-semibold text-white truncate max-w-[200px]">
                      {result.attendee.email}
                    </span>
                  </div>
                )}
                {result.attendee?.phone && (
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-white/50 text-xs">Teléfono:</span>
                    <span className="font-mono text-white/80">{result.attendee.phone}</span>
                  </div>
                )}
                {result.folio && (
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-white/50 text-xs">Folio Boleto:</span>
                    <span className="font-mono font-bold text-amber-400">#{result.folio}</span>
                  </div>
                )}
                {result.event && (
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-white/50 text-xs flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400/80" />
                      Evento:
                    </span>
                    <span className="text-white/80 text-xs truncate max-w-[180px]">{result.event}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-white/40">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-white/40" /> Canjeado:
                  </span>
                  <span>{new Date(result.checked_in_at || Date.now()).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          ) : result?.status === 'ALREADY_USED' ? (
            <div className="bg-amber-950/40 border-2 border-amber-500 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_0_50px_rgba(245,158,11,0.25)] text-center animate-in zoom-in-95 duration-200">
              <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mx-auto mb-4 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                <AlertTriangle className="w-12 h-12" />
              </div>
              <span className="inline-block px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-mono font-bold uppercase tracking-widest rounded-full mb-2">
                Boleto Ya Canjeado
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-2">
                Entrada Duplicada
              </h1>
              <p className="text-sm text-amber-200/80 mb-6">{result.message}</p>

              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-left space-y-2 mb-6 text-xs text-white/80">
                {result.attendee?.email && (
                  <div className="flex justify-between border-b border-white/5 pb-1.5">
                    <span className="text-white/50">Comprador:</span>
                    <span className="font-semibold text-white">{result.attendee.email}</span>
                  </div>
                )}
                {result.physical_location && (
                  <div className="flex justify-between border-b border-white/5 pb-1.5">
                    <span className="text-white/50">Ubicación:</span>
                    <span className="font-medium text-white">{result.physical_location}</span>
                  </div>
                )}
                {result.checked_in_at && (
                  <div className="flex justify-between border-b border-white/5 pb-1.5 text-amber-300">
                    <span>Primer canje:</span>
                    <span className="font-mono">{new Date(result.checked_in_at).toLocaleTimeString()}</span>
                  </div>
                )}
                {result.checked_in_by && (
                  <div className="flex justify-between text-white/50">
                    <span>Operador original:</span>
                    <span className="font-mono text-white/80">{result.checked_in_by}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-red-950/40 border-2 border-red-500 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_0_50px_rgba(239,68,68,0.25)] text-center animate-in zoom-in-95 duration-200">
              <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-400 flex items-center justify-center mx-auto mb-4 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                <XCircle className="w-12 h-12" />
              </div>
              <span className="inline-block px-3 py-1 bg-red-500/20 text-red-300 text-xs font-mono font-bold uppercase tracking-widest rounded-full mb-2">
                Firma Inválida · Boleto Falso
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-2">
                Acceso Denegado
              </h1>
              <p className="text-sm text-red-200/80 mb-6">{result?.message}</p>
            </div>
          )}
        </div>

        {/* Acciones de Navegación de Puerta */}
        <footer className="w-full max-w-md mx-auto space-y-3 pt-4">
          <Link
            href="/dashboard/scan-tickets"
            className="w-full py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] transition-all text-slate-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <Camera className="w-5 h-5" />
            Escanear Siguiente Boleto
            <ArrowRight className="w-4 h-4 ml-auto" />
          </Link>

          <p className="text-center text-[11px] text-white/40 font-mono">
            SRE Gate Node · Encriptación HMAC-SHA256 Activa
          </p>
        </footer>
      </main>
    </>
  );
}
