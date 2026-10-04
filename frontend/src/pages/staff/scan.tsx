import React, { useEffect, useState } from 'react';
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
  ArrowRight
} from 'lucide-react';
import api from '../../lib/api';

interface CheckInDetails {
  status: 'SUCCESS' | 'ALREADY_USED' | 'INVALID_QR' | 'ERROR';
  code?: string;
  message: string;
  event?: string;
  physical_location?: string;
  attendee?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  has_mg?: boolean;
  checked_in_at?: string;
}

export default function StaffScanLandingPage() {
  const router = useRouter();
  const { token, sig, ts } = router.query;

  const [loading, setLoading] = useState<boolean>(true);
  const [result, setResult] = useState<CheckInDetails | null>(null);

  useEffect(() => {
    if (!router.isReady) return;

    if (!token) {
      setLoading(false);
      setResult({
        status: 'INVALID_QR',
        code: 'TICKET_INVALID',
        message: 'No se detectó un token de boleto válido en la URL.'
      });
      return;
    }

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
            location: 'Acceso Universal Puerta',
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
          event: data.ticket?.event_name || 'Evento Oficial',
          physical_location: data.ticket?.seat_display || 'General',
          attendee: {
            email: data.ticket?.attendee_email,
            phone: data.ticket?.attendee_phone
          },
          has_mg: data.ticket?.has_mg,
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
            event: data.ticket?.event_name,
            physical_location: data.ticket?.seat_display,
            attendee: {
              email: data.ticket?.attendee_email
            },
            checked_in_at: data.checked_in_at
          });
          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate?.([200, 100, 200]);
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
  }, [router.isReady, token, sig, ts]);

  return (
    <>
      <Head>
        <title>Control de Acceso | Validación de Boleto</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      <main className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 font-sans">
        {/* Header de Staff */}
        <header className="flex items-center justify-between py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span className="font-mono text-xs uppercase tracking-widest text-white/70">Ms. Ambar Gate Control</span>
          </div>
          <span className="text-[11px] bg-white/10 px-2.5 py-0.5 rounded-full text-white/60 font-mono">
            Modo Puerta
          </span>
        </header>

        {/* Contenido Central / Card de Validación */}
        <div className="my-auto py-6 max-w-md w-full mx-auto">
          {loading ? (
            <div className="bg-slate-900/90 border border-white/10 rounded-3xl p-8 text-center backdrop-blur-xl shadow-2xl">
              <RefreshCw className="w-12 h-12 text-amber-400 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-bold tracking-tight text-white mb-1">Verificando Credencial...</h2>
              <p className="text-xs text-white/50 font-mono">Validando firma HMAC-SHA256 e idempotencia en servidor seguro</p>
            </div>
          ) : result?.status === 'SUCCESS' ? (
            <div className="bg-emerald-950/40 border-2 border-emerald-500 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_0_50px_rgba(16,185,129,0.25)] text-center animate-in zoom-in-95 duration-200">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <span className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold uppercase tracking-widest rounded-full mb-2">
                Boleto Válido · Acceso Concedido
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-4">
                {result.physical_location || 'Entrada General'}
              </h1>

              {result.has_mg && (
                <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400/20 border border-amber-400/50 rounded-xl text-amber-300 font-bold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Incluye Meet & Greet
                </div>
              )}

              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-left space-y-2 mb-6 text-sm">
                {result.attendee?.email && (
                  <div className="flex items-center gap-2 text-white/80">
                    <User className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">{result.attendee.email}</span>
                  </div>
                )}
                {result.event && (
                  <div className="flex items-center gap-2 text-white/60 text-xs">
                    <Calendar className="w-4 h-4 text-emerald-400/70 shrink-0" />
                    <span className="truncate">{result.event}</span>
                  </div>
                )}
                <div className="text-[11px] font-mono text-white/40 pt-2 border-t border-white/5">
                  Canjeado: {new Date(result.checked_in_at || Date.now()).toLocaleTimeString()}
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

              {result.physical_location && (
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-left space-y-1 mb-6 text-xs text-white/70">
                  <div className="font-semibold text-white">Ubicación asignada:</div>
                  <div>{result.physical_location}</div>
                  {result.checked_in_at && (
                    <div className="text-amber-400/80 font-mono pt-1">
                      Primer canje registrado: {new Date(result.checked_in_at).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              )}
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
            Abrir Escáner de Puerta Continuo
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
