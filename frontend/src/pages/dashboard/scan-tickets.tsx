import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Camera, ShieldCheck, AlertCircle, CheckCircle, ArrowLeft, RefreshCw, Smartphone, Keyboard, Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ScanTicketsPage() {
  const router = useRouter();
  const [isStaff, setIsStaff] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Scanner states
  const [scannerActive, setScannerActive] = useState(false);
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isManualCameraSelect, setIsManualCameraSelect] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Scan result HUD overlay states
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanStatusType, setScanStatusType] = useState<'success' | 'already_used' | 'error' | null>(null);

  const html5QrCodeRef = useRef<any>(null);
  const readerId = "qr-reader-container";

  const getApiUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== 'undefined' && window.location.origin.includes('github.dev')
        ? window.location.origin.replace(window.location.port, '8000') + '/api'
        : 'http://localhost:8000/api');
  };

  // 1. Auth check
  useEffect(() => {
    const jwtToken = localStorage.getItem('token');
    if (!jwtToken) {
      router.replace('/dashboard'); // Not logged in
      return;
    }
    const apiUrl = getApiUrl();
    fetch(`${apiUrl}/users/profile/`, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`
      }
    })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not authorized');
      })
      .then(data => {
        if (data.is_staff) {
          setIsStaff(true);
        } else {
          setIsStaff(false);
          router.replace('/dashboard'); // Non-staff
        }
      })
      .catch(err => {
        console.error("Auth check failed:", err);
        router.replace('/dashboard');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  // 2. Play Audio cues
  const playSound = (type: 'success' | 'warning' | 'error') => {
    if (!audioEnabled) return;
    try {
      let soundUrl = '';
      if (type === 'success') {
        soundUrl = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav'; // chime
      } else if (type === 'warning') {
        soundUrl = 'https://assets.mixkit.co/active_storage/sfx/911/911-84.wav'; // buzzer
      } else {
        soundUrl = 'https://assets.mixkit.co/active_storage/sfx/2565/2565-84.wav'; // deep error alert
      }
      const audio = new Audio(soundUrl);
      audio.volume = 0.4;
      audio.play();
    } catch (e) {
      console.warn("Sound play blocked by browser:", e);
    }
  };

  // 3. Initialize/Fetch cameras
  const startCameraScan = async () => {
    // Dynamic import to avoid SSR errors with html5-qrcode
    const { Html5Qrcode } = await import('html5-qrcode');

    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        const backCamera = devices.find(d =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('trasera') ||
          d.label.toLowerCase().includes('environment') ||
          d.label.toLowerCase().includes('entorno')
        );
        const defaultCamId = backCamera ? backCamera.id : devices[0].id;
        setSelectedCameraId(defaultCamId);
      }
      // Start with environment facingMode to force rear-facing camera autofocus
      initScannerInstance(Html5Qrcode, { facingMode: "environment" });
    } catch (e) {
      console.warn("Camera enumeration failed, fallback directly to facingMode:", e);
      try {
        initScannerInstance(Html5Qrcode, { facingMode: "environment" });
      } catch (err) {
        console.error("Camera access failed:", err);
        alert("Error al acceder a la cámara. Por favor concede permisos.");
      }
    }
  };

  const initScannerInstance = (Html5QrcodeClass: any, cameraConfig: any) => {
    stopScanner();

    const html5QrCode = new Html5QrcodeClass(readerId);
    html5QrCodeRef.current = html5QrCode;
    setScannerActive(true);

    const config = {
      fps: 15, // Higher frame rate for faster detection
      qrbox: (width: number, height: number) => {
        const minEdge = Math.min(width, height);
        const qrboxSize = Math.floor(minEdge * 0.7);
        return { width: qrboxSize, height: qrboxSize };
      },
      aspectRatio: 1.0,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true // Native hardware acceleration
      }
    };

    html5QrCode.start(
      cameraConfig,
      config,
      (decodedText: string) => {
        // Successfully scanned code
        handleQrDecoded(decodedText);
      },
      (errorMessage: string) => {
        // parse error (ignore common noisy logs)
      }
    ).catch((err: any) => {
      console.error("Scanner startup failed:", err);
      setScannerActive(false);
    });
  };

  const stopScanner = () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        html5QrCodeRef.current.stop().then(() => {
          console.log("Scanner stopped.");
        }).catch((e: any) => console.warn(e));
      } catch (err) {
        console.warn(err);
      }
    }
    setScannerActive(false);
  };

  const handleCameraChange = (cameraId: string) => {
    setSelectedCameraId(cameraId);
    setIsManualCameraSelect(true);
    if (scannerActive && html5QrCodeRef.current) {
      import('html5-qrcode').then(({ Html5Qrcode }) => {
        initScannerInstance(Html5Qrcode, cameraId);
      });
    }
  };

  // 4. Handle QR decoding and validation
  const handleQrDecoded = (decodedText: string) => {
    // If a result is already showing, ignore new scans
    if (scanResult || scanError || isValidating) return;

    let token = decodedText.trim();
    // Parse UUID if it is a full URL e.g. https://msambar.com/tickets/UUID
    if (token.includes('/tickets/')) {
      const parts = token.split('/tickets/');
      if (parts.length > 1) {
        // Grab the UUID token (removing query params if any)
        token = parts[1].split('?')[0].split('#')[0];
      }
    } else if (token.startsWith('{')) {
      // Handle JSON data format
      try {
        const obj = JSON.parse(token);
        if (obj.token) token = obj.token;
      } catch (e) {
        // ignore
      }
    }

    validateTicketToken(token);
  };

  const validateTicketToken = async (token: string) => {
    if (!token) return;
    setIsValidating(true);
    stopScanner(); // Pause camera reader during api validation

    const apiUrl = getApiUrl();
    const jwtToken = localStorage.getItem('token');

    try {
      const res = await fetch(`${apiUrl}/tickets/tickets/validate/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': jwtToken ? `Bearer ${jwtToken}` : ''
        },
        body: JSON.stringify({ token })
      });

      const data = await res.json();
      if (res.ok) {
        if (data.status === 'success') {
          playSound('success');
          setScanResult(data);
          setScanStatusType('success');
        } else {
          // Fallback if status exists but isn't success
          playSound('error');
          setScanError(data.message || 'Error de validación');
          setScanStatusType('error');
        }
      } else {
        if (data.status === 'already_used') {
          playSound('warning');
          setScanResult({
            event: data.event || 'Evento',
            seat: data.seat || 'Asiento',
            scanned_at: data.scanned_at
          });
          setScanError(data.message || 'Boleto ya utilizado anteriormente.');
          setScanStatusType('already_used');
        } else {
          playSound('error');
          setScanError(data.error || data.message || 'Boleto inválido, falsificado o cancelado.');
          setScanStatusType('error');
        }
      }
    } catch (err) {
      console.error(err);
      playSound('error');
      setScanError('Error de red al conectar con el servidor.');
      setScanStatusType('error');
    } finally {
      setIsValidating(false);
    }
  };

  const resetScannerHUD = () => {
    setScanResult(null);
    setScanError(null);
    setScanStatusType(null);
    setManualToken('');

    // Resume camera scanning using either manually overridden camera or facingMode environment
    import('html5-qrcode').then(({ Html5Qrcode }) => {
      initScannerInstance(Html5Qrcode, isManualCameraSelect && selectedCameraId ? selectedCameraId : { facingMode: "environment" });
    });
  };

  if (isLoading || isStaff === null) {
    return (
      <div className="min-h-screen bg-[#07080a] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-10 h-10 border-2 border-t-amber-honey border-white/5 rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest text-[#F4F6F0]/40 font-mono">Verificando credenciales del staff...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080a] text-[#F4F6F0] flex flex-col p-6 font-sans relative overflow-x-hidden select-none selection:bg-amber-honey/20">
      <Head>
        <title>Escáner de Boletos | Ms Ambar</title>
        <style dangerouslySetInnerHTML={{
          __html: `
          #qr-reader-container {
            width: 100% !important;
            height: 100% !important;
            border: none !important;
          }
          #qr-reader-container video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            border-radius: 1.8rem !important;
          }
          #qr-reader-container__header_message {
            display: none !important;
          }
          #qr-reader-container__scan_region {
            border: none !important;
          }
        `}} />
      </Head>

      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-honey/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-600/5 blur-[120px] pointer-events-none" />

      {/* Top navigation */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between mb-8 z-10">
        <Link
          href="/dashboard"
          onClick={stopScanner}
          className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-[#F4F6F0]/50 hover:text-amber-honey transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Volver al Dashboard</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`p-2.5 rounded-xl border transition-all ${audioEnabled
              ? 'bg-amber-honey/10 border-amber-honey/20 text-amber-honey'
              : 'bg-white/5 border-white/10 text-white/30'
              }`}
            title={audioEnabled ? "Silenciar alertas de audio" : "Activar alertas de audio"}
          >
            <Volume2 size={14} />
          </button>
          <span className="flex items-center gap-1.5 bg-[#122017]/40 border border-[#2e4d38]/50 px-3 py-1.5 rounded-full text-[#82c99b] text-[8px] font-black uppercase tracking-wider">
            <ShieldCheck size={11} className="text-[#82c99b]" />
            Staff Autorizado
          </span>
        </div>
      </header>

      {/* Main scanner panel */}
      <main className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center z-10">
        <div className="amber-glass rounded-[2.5rem] p-6 border border-white/5 space-y-6 shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-honey/30 to-transparent" />

          <div className="text-center">
            <h2 className="text-2xl font-black uppercase tracking-tight italic text-[#F4F6F0]">Control de Accesos</h2>
            <p className="text-[9px] text-[#F4F6F0]/50 uppercase tracking-widest font-black mt-1">Escaneo de códigos QR oficiales</p>
          </div>

          {/* Camera Scan Display */}
          <div className="relative aspect-square w-full rounded-[2rem] overflow-hidden border border-white/10 bg-black flex flex-col items-center justify-center group">
            {/* Target Reticle overlay inside scan reader */}
            {scannerActive && !scanResult && !scanError && (
              <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                <div className="w-56 h-56 border-2 border-dashed border-amber-honey/50 rounded-[1.8rem] relative animate-pulse flex items-center justify-center">
                  <div className="absolute -top-1.5 -left-1.5 w-6 h-6 border-t-4 border-l-4 border-amber-honey rounded-tl-xl" />
                  <div className="absolute -top-1.5 -right-1.5 w-6 h-6 border-t-4 border-r-4 border-amber-honey rounded-tr-xl" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-4 border-l-4 border-amber-honey rounded-bl-xl" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-4 border-r-4 border-amber-honey rounded-br-xl" />
                  <span className="text-[8px] font-mono tracking-widest text-amber-honey/40 uppercase absolute bottom-4">Enfoque QR</span>
                </div>
              </div>
            )}

            {/* Container for html5-qrcode reader */}
            <div id={readerId} className="w-full h-full object-cover [&>video]:object-cover" />

            {!scannerActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-neutral-950/70 backdrop-blur-sm">
                <div className="w-16 h-16 rounded-full bg-amber-honey/10 border border-amber-honey/20 flex items-center justify-center text-amber-honey mb-2">
                  <Camera size={28} />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-[#F4F6F0]">Cámara Desactivada</h4>
                  <p className="text-[9px] text-[#F4F6F0]/40 uppercase tracking-widest leading-relaxed mt-1">Inicia la cámara del dispositivo para comenzar a escanear entradas.</p>
                </div>
                <button
                  onClick={startCameraScan}
                  className="px-6 py-3 bg-gradient-to-r from-amber-400 via-amber-honey to-amber-600 text-neutral-950 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-amber-honey/25 transition-all hover:scale-102"
                >
                  Activar Cámara Trasera
                </button>
              </div>
            )}
          </div>

          {/* Camera selectors */}
          {scannerActive && cameras.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-[8px] text-[#F4F6F0]/50 uppercase tracking-widest font-black flex items-center gap-1">
                <RefreshCw size={10} className="animate-spin" /> Seleccionar Cámara
              </label>
              <select
                value={selectedCameraId}
                onChange={e => handleCameraChange(e.target.value)}
                className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:border-amber-honey transition-all"
              >
                {cameras.map(cam => (
                  <option key={cam.id} value={cam.id} className="bg-[#0c0d13] text-[#F4F6F0]">
                    {cam.label || `Cámara ${cam.id.substring(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Toggle controls */}
          {scannerActive && (
            <button
              onClick={stopScanner}
              className="w-full py-3 bg-neutral-900 border border-white/10 hover:bg-neutral-800 text-[#F4F6F0]/80 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all"
            >
              Apagar Cámara
            </button>
          )}

          {/* Manual input validation */}
          <div className="border-t border-white/10 pt-5 space-y-3">
            <div className="text-center mb-1">
              <span className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-[0.25em] font-black">¿La cámara no lee el código?</span>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                validateTicketToken(manualToken.trim());
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Keyboard size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#F4F6F0]/30" />
                <input
                  type="text"
                  value={manualToken}
                  onChange={e => setManualToken(e.target.value)}
                  placeholder="UUID / Token de Entrada..."
                  required
                  className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl pl-9 pr-4 py-3 text-xs font-semibold focus:outline-none focus:border-amber-honey transition-all placeholder:text-[#F4F6F0]/30"
                />
              </div>
              <button
                type="submit"
                disabled={isValidating || !manualToken.trim()}
                className="px-5 bg-amber-honey hover:bg-amber-600 disabled:bg-neutral-800 disabled:text-white/20 text-neutral-950 font-black text-[9px] uppercase tracking-wider rounded-xl transition-all"
              >
                Validar
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Validation Result Modal HUD (Fullscreen Overlay) */}
      <AnimatePresence>
        {scanStatusType && (
          <div className="fixed inset-0 z-[120] bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="w-full max-w-sm rounded-[2.5rem] overflow-hidden border shadow-2xl text-center flex flex-col relative bg-neutral-900 border-white/5"
            >
              {/* Colored status bar */}
              <div className={`h-2.5 w-full ${scanStatusType === 'success' ? 'bg-emerald-500' :
                scanStatusType === 'already_used' ? 'bg-orange-500' : 'bg-red-600'
                }`} />

              <div className="p-8 space-y-6">
                {/* Result icon & title */}
                <div className="space-y-3">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${scanStatusType === 'success' ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400' :
                    scanStatusType === 'already_used' ? 'bg-orange-500/10 border border-orange-500/25 text-orange-400' :
                      'bg-red-500/10 border border-red-500/25 text-red-500'
                    }`}>
                    {scanStatusType === 'success' ? <CheckCircle size={32} /> :
                      scanStatusType === 'already_used' ? <AlertCircle size={32} /> :
                        <AlertCircle size={32} />}
                  </div>

                  <h3 className={`text-xl font-black uppercase tracking-tight italic ${scanStatusType === 'success' ? 'text-emerald-400' :
                    scanStatusType === 'already_used' ? 'text-orange-400' : 'text-red-500'
                    }`}>
                    {scanStatusType === 'success' ? 'Acceso Autorizado' :
                      scanStatusType === 'already_used' ? 'Acceso Denegado' : 'Boleto Inválido'}
                  </h3>

                  <p className="text-[10px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold font-mono">
                    {scanStatusType === 'success' ? 'Boleto Validado Correctamente' :
                      scanStatusType === 'already_used' ? 'Boleto ya Utilizado' : 'Error de Autenticidad'}
                  </p>
                </div>

                {/* Ticket Details Panel */}
                {scanResult && (
                  <div className="bg-[#07080a] border border-white/5 rounded-2xl p-5 text-left space-y-3 font-mono">
                    <div>
                      <span className="text-[8px] uppercase text-neutral-500 tracking-wider block">Evento</span>
                      <span className="text-xs font-bold text-neutral-200 block break-words leading-tight">{scanResult.event}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[8px] uppercase text-neutral-500 tracking-wider block">Ubicación</span>
                        <span className="text-xs font-black text-amber-honey block uppercase">{scanResult.seat}</span>
                      </div>
                      {scanResult.scanned_at && (
                        <div>
                          <span className="text-[8px] uppercase text-neutral-500 tracking-wider block">Hora Escaneo</span>
                          <span className="text-[10px] text-neutral-400 block">
                            {new Date(scanResult.scanned_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Error text */}
                {scanError && (
                  <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-2xl">
                    <p className="text-xs text-red-400/90 leading-relaxed font-mono">{scanError}</p>
                  </div>
                )}

                {/* Action button */}
                <button
                  onClick={resetScannerHUD}
                  className={`w-full py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.25em] font-mono transition-transform duration-200 hover:scale-102 shadow-lg ${scanStatusType === 'success' ? 'bg-emerald-500 text-neutral-950 shadow-emerald-500/20' :
                    scanStatusType === 'already_used' ? 'bg-orange-500 text-neutral-950 shadow-orange-500/20' :
                      'bg-red-600 text-neutral-200 shadow-red-600/20'
                    }`}
                >
                  Siguiente Boleto
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
