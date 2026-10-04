import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { CheckCircle2, XCircle, AlertCircle, Camera, RefreshCw, Volume2, ShieldCheck } from 'lucide-react';
import api from '../lib/api';

type ScannerState = 'IDLE' | 'STARTING' | 'SCANNING' | 'VALIDATING' | 'SUCCESS' | 'CONFLICT' | 'ERROR';

interface CheckInResponse {
  status: 'SUCCESS' | 'ALREADY_USED' | 'INVALID_QR' | 'NOT_ACTIVE' | 'WRONG_EVENT';
  message: string;
  physical_location?: string;
  checked_in_at?: string;
  attendee?: { email: string; phone: string };
  folio?: number;
}

export const GateScanner: React.FC<{ eventId?: string | number; deviceId?: string }> = ({
  eventId,
  deviceId = 'gate-handheld-01'
}) => {
  const [fsmState, setFsmState] = useState<ScannerState>('IDLE');
  const [scanResult, setScanResult] = useState<CheckInResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const containerId = 'qr-reader-gate-viewport';

  // Haptic feedback & Web Audio API fallback
  const triggerSensoryFeedback = (type: 'success' | 'conflict' | 'error') => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      if (type === 'success') navigator.vibrate?.([80]);
      if (type === 'conflict') navigator.vibrate?.([200, 100, 200]);
      if (type === 'error') navigator.vibrate?.([400]);
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // AudioContext policy suppression fallback
    }
  };

  const handleQrDecoded = useCallback(async (rawPayload: string) => {
    const now = Date.now();
    if (now - lastScanTimeRef.current < 300) return;
    lastScanTimeRef.current = now;

    if (fsmState === 'VALIDATING') return;

    if (scannerRef.current) {
      try {
        await scannerRef.current.pause(true);
      } catch (e) {
        console.warn('[Scanner] Pause warning:', e);
      }
    }

    setFsmState('VALIDATING');
    const idempotencyKey = `${deviceId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Parse token/sig if formatted as verification URL
    let token = rawPayload.trim();
    let sig: string | undefined;
    let ts: string | undefined;
    if (rawPayload.includes('?')) {
      try {
        const urlObj = new URL(rawPayload.trim(), typeof window !== 'undefined' ? window.location.origin : 'https://msambar.com');
        token = urlObj.searchParams.get('token') || token;
        sig = urlObj.searchParams.get('sig') || undefined;
        ts = urlObj.searchParams.get('ts') || undefined;
      } catch {
        // fallback to raw
      }
    }

    try {
      const response = await api.post(
        '/tickets/scanner/check-in/',
        {
          qr_payload: rawPayload.trim(),
          token: token,
          sig: sig,
          ts: ts,
          scanner_device_id: deviceId,
          location: 'Acceso Taquilla Principal',
          idempotency_key: idempotencyKey,
          event_id: eventId ? Number(eventId) : undefined
        },
        {
          headers: {
            'X-Idempotency-Key': idempotencyKey
          },
          timeout: 5000
        }
      );

      const data: CheckInResponse = response.data;
      setScanResult(data);
      setFsmState('SUCCESS');
      triggerSensoryFeedback('success');
    } catch (err: any) {
      const status = err?.response?.status;
      const data: CheckInResponse = err?.response?.data || {};

      if (status === 409) {
        setScanResult(data);
        setErrorMessage(data.message || 'Boleto ya utilizado anteriormente.');
        setFsmState('CONFLICT');
        triggerSensoryFeedback('conflict');
      } else {
        setErrorMessage(data.message || err.message || 'Código QR no válido o error de red.');
        setFsmState('ERROR');
        triggerSensoryFeedback('error');
      }
    }
  }, [deviceId, eventId, fsmState]);

  const startScanner = useCallback(async () => {
    setErrorMessage('');
    setScanResult(null);
    setFsmState('STARTING');

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false
        });
      }

      await scannerRef.current.start(
        { facingMode: { ideal: 'environment' } },
        { fps: 15, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 },
        handleQrDecoded,
        () => { /* Ignorar frames sin QR */ }
      );
      setFsmState('SCANNING');
    } catch (err: any) {
      console.error('[Scanner] Failed camera start:', err);
      setErrorMessage(
        err?.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Habilita el acceso en tu navegador.'
          : 'No se pudo iniciar la cámara trasera en este dispositivo.'
      );
      setFsmState('ERROR');
    }
  }, [handleQrDecoded]);

  const resumeScanner = () => {
    setScanResult(null);
    setErrorMessage('');
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.resume();
      setFsmState('SCANNING');
    } else {
      startScanner();
    }
  };

  useEffect(() => {
    startScanner();
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(e => console.warn('[Scanner] Stop cleanup:', e));
      }
    };
  }, [startScanner]);

  return (
    <div className="w-full max-w-md mx-auto rounded-3xl overflow-hidden bg-[#0c0f17] border border-white/10 shadow-2xl p-4 flex flex-col items-center">
      {/* Viewport de Escaneo */}
      <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black flex items-center justify-center">
        <div id={containerId} className="w-full h-full" />

        {fsmState === 'SCANNING' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-64 h-64 border-2 border-dashed border-amber-400/80 rounded-2xl animate-pulse" />
          </div>
        )}

        {fsmState === 'VALIDATING' && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs uppercase font-black tracking-widest text-amber-400">Verificando en Base de Datos...</span>
          </div>
        )}
      </div>

      {/* Panel de Retroalimentación de Alto Contraste */}
      <div className="w-full mt-4">
        {fsmState === 'SUCCESS' && scanResult && (
          <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex flex-col gap-2 animate-in fade-in">
            <div className="flex items-center gap-2 text-emerald-400 font-black text-sm uppercase">
              <CheckCircle2 className="w-5 h-5" />
              <span>Acceso Permitido · Folio #{scanResult.folio}</span>
            </div>
            <div className="text-2xl font-black text-white">{scanResult.physical_location}</div>
            <div className="text-xs text-emerald-200/80 font-mono">{scanResult.attendee?.email}</div>
            <button
              onClick={resumeScanner}
              className="mt-2 w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase tracking-widest transition-colors cursor-pointer"
            >
              Escanear Siguiente
            </button>
          </div>
        )}

        {fsmState === 'CONFLICT' && (
          <div className="p-4 rounded-2xl bg-rose-500/20 border border-rose-500/60 flex flex-col gap-2 animate-in shake">
            <div className="flex items-center gap-2 text-rose-400 font-black text-sm uppercase">
              <XCircle className="w-5 h-5" />
              <span>Boleto Ya Utilizado (Conflicto 409)</span>
            </div>
            <p className="text-xs text-rose-200 leading-relaxed">{errorMessage}</p>
            {scanResult?.checked_in_at && (
              <div className="text-[11px] font-mono text-rose-300">
                Primer ingreso: {new Date(scanResult.checked_in_at).toLocaleTimeString('es-MX')}
              </div>
            )}
            <button
              onClick={resumeScanner}
              className="mt-2 w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-widest transition-colors cursor-pointer"
            >
              Reintentar / Siguiente
            </button>
          </div>
        )}

        {fsmState === 'ERROR' && (
          <div className="p-4 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-amber-400 font-black text-sm uppercase">
              <AlertCircle className="w-5 h-5" />
              <span>Error de Validación</span>
            </div>
            <p className="text-xs text-amber-200">{errorMessage}</p>
            <button
              onClick={resumeScanner}
              className="mt-2 w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-widest transition-colors cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GateScanner;
