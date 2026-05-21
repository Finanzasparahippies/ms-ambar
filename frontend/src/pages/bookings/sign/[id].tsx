import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, FileText, Calendar, Phone, Award, Mail, ArrowLeft, RefreshCw, PenTool } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

/** Decodes a JWT payload client-side (no signature verification). */
function decodeJwt(token: string): Record<string, any> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

const BookingSignaturePage = () => {
  const router = useRouter();
  const { id } = router.query;

  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isManager, setIsManager] = useState(false);

  // Signature canvas state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  // Setup canvas settings
  useEffect(() => {
    if (!contract) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Match resolution to parent scale
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Custom MS Ambar golden ink
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Track if browser resizes to redraw/reset canvas
    const handleResize = () => {
      if (!canvas) return;
      const tempImage = canvas.toDataURL();
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = tempImage;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [contract]);

  // Check user role for manager privileges
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const payload = decodeJwt(token);
      if (payload && payload.is_staff && !(payload.exp && Date.now() / 1000 > payload.exp)) {
        setIsManager(true);
      }
    }
  }, []);

  // Fetch contract details
  useEffect(() => {
    if (!id) return;
    const fetchContract = async () => {
      try {
        const res = await axios.get(`${API_URL}/bookings/contracts/${id}/`);
        setContract(res.data);
      } catch (err: any) {
        console.error(err);
        setError('El contrato solicitado no existe o expiró la sesión.');
      } finally {
        setLoading(false);
      }
    };
    fetchContract();
  }, [id]);

  // Coordinate math for touch/mouse
  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: any) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setHasSigned(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const handleSignSubmit = async () => {
    if (!hasSigned) {
      alert('Por favor dibuja tu firma en el lienzo.');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base64Signature = canvas.toDataURL('image/png');
    
    setSaving(true);
    try {
      const endpoint = isManager 
        ? `${API_URL}/bookings/contracts/${id}/manager_sign/`
        : `${API_URL}/bookings/contracts/${id}/sign/`;
      
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await axios.post(endpoint, { signature: base64Signature }, { headers });
      setSuccess(true);
      setTimeout(() => {
        if (isManager) {
          router.push('/dashboard');
        } else {
          router.push('/contact');
        }
      }, 4000);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Error al enviar firma. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#06070b] text-white">
      <div className="w-12 h-12 border-4 border-amber-honey border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-amber-honey font-black text-[10px] uppercase tracking-widest animate-pulse">Cargando Contrato Artístico...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#06070b] text-white p-6 text-center space-y-6">
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-3xl max-w-md w-full flex flex-col items-center gap-3">
        <AlertTriangle size={32} />
        <p className="font-bold text-sm uppercase tracking-wide">{error}</p>
      </div>
      <Link href="/contact" className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-honey hover:underline flex items-center gap-2">
        <ArrowLeft size={12} /> Regresar a Solicitudes
      </Link>
    </div>
  );

  if (success) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#06070b] text-white p-6">
      <div className="w-24 h-24 bg-amber-honey/15 border border-amber-honey/30 rounded-full flex items-center justify-center mb-8 animate-pulse shadow-2xl shadow-amber-honey/25 text-amber-honey">
        <CheckCircle size={40} />
      </div>
      <h2 className="text-4xl font-black text-center mb-4 tracking-tighter uppercase">
        {isManager ? 'Contrato Certificado' : 'Firma Registrada'}
      </h2>
      <p className="text-white/60 text-xs font-bold text-center uppercase tracking-widest max-w-sm">
        {isManager 
          ? 'El acuerdo se ha cerrado. Se enviaron las copias finales certificadas por correo.'
          : 'Tu firma fue recibida con éxito. Representación técnica revisará y cerrará el acuerdo a la brevedad.'
        }
      </p>
      <p className="text-amber-honey font-black uppercase tracking-widest text-[9px] mt-8 animate-pulse">
        Redirigiendo...
      </p>
    </div>
  );

  const inquiry = contract.inquiry_detail;
  const dateStr = inquiry.date ? new Date(inquiry.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Pendiente';

  return (
    <div className="min-h-screen bg-[#06070b] text-white pt-32 pb-20 font-sans">
      <Head>
        <title>MS AMBAR | Visor de Contrato de Booking</title>
      </Head>

      <div className="max-w-4xl mx-auto px-6">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-16 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-honey/10 border border-amber-honey/20 flex items-center justify-center text-amber-honey">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
              Acuerdo de <span className="text-amber-honey italic">Presentación</span>
            </h1>
            <p className="text-white/40 text-[9px] uppercase tracking-[0.3em] font-black mt-2">
              MS AMBAR • Contrato de Booking #{contract.id}
            </p>
          </div>
        </div>

        {/* Contract Info Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] mb-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-honey/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-6 border-r border-white/5 pr-8">
            <h3 className="text-amber-honey font-black uppercase text-[10px] tracking-[0.2em]">Especificaciones</h3>
            
            <div className="space-y-1">
              <p className="text-[8px] text-white/40 uppercase font-black tracking-widest">Organizador / Empresa</p>
              <p className="text-lg font-black">{inquiry.name} {inquiry.company ? `(${inquiry.company})` : ''}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[8px] text-white/40 uppercase font-black tracking-widest">Foro / Venue</p>
              <p className="text-lg font-black text-amber-honey capitalize">{inquiry.venue_type === 'festival' ? 'Festival' : inquiry.venue_type === 'theater' ? 'Teatro' : inquiry.venue_type === 'club' ? 'Club' : inquiry.venue_type === 'private' ? 'Evento Privado' : 'Otro'}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[8px] text-white/40 uppercase font-black tracking-widest">Fecha Convenida</p>
              <p className="text-base font-bold flex items-center gap-2"><Calendar size={14} className="text-amber-honey" /> {dateStr}</p>
            </div>
          </div>

          <div className="space-y-6 flex flex-col justify-between">
            <div>
              <h3 className="text-amber-honey font-black uppercase text-[10px] tracking-[0.2em] mb-4">Honorarios Propuestos</h3>
              <p className="text-4xl font-black text-white">${parseFloat(contract.fee).toLocaleString('es-MX', { minimumFractionDigits: 2 })} <span className="text-xs text-white/40 font-bold">MXN</span></p>
              <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mt-2">Esquema 50/50 base (anticipo y liquidación)</p>
            </div>

            <div className="border-t border-white/5 pt-4">
              <p className="text-[8px] text-white/40 uppercase font-black tracking-widest mb-1">Contacto del Promotor</p>
              <p className="text-xs text-white/70 font-semibold">{inquiry.email}</p>
              <p className="text-xs text-white/70 font-semibold">{inquiry.phone}</p>
            </div>
          </div>
        </div>

        {/* Clauses Summary */}
        <div className="bg-white/[0.01] border border-white/5 rounded-[2.5rem] p-8 mb-12 space-y-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Cláusulas de Cumplimiento</h3>
          <ul className="space-y-4 text-xs text-white/60 leading-relaxed list-decimal pl-4">
            <li><strong>Show en Vivo:</strong> Presentación artística con set en vivo de 90 minutos de duración.</li>
            <li><strong>Rider Técnico:</strong> El promotor se obliga a suministrar el equipo de audio e iluminación según los requerimientos del rider.</li>
            <li><strong>Depósito de Garantía:</strong> Anticipo del 50% de los honorarios no reembolsable en caso de cancelación unilateral.</li>
            <li><strong>Hospitalidad:</strong> Suministro de catering básico en camerinos y transporte local si aplica.</li>
          </ul>
        </div>

        {/* Signature Pad */}
        <div className="space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-black uppercase tracking-tight">
              {isManager ? 'Firma de Management (MS AMBAR)' : 'Firma Digital de Aceptación'}
            </h2>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">
              {isManager 
                ? 'Estampa la firma digital autorizada para cerrar el contrato' 
                : 'Usa tu cursor, trackpad o pantalla táctil para dibujar tu firma sobre el lienzo'
              }
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
            <div className="h-64 relative">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-full cursor-crosshair relative z-10"
              />
              
              {/* Background Guide Line */}
              <div className="absolute left-10 right-10 bottom-16 border-b border-dashed border-white/10 pointer-events-none" />
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-widest opacity-25 flex items-center gap-1.5 pointer-events-none select-none">
                <PenTool size={10} /> Área de Firma
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 justify-center pt-4">
            <button
              onClick={clearCanvas}
              className="px-8 py-4 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95 flex items-center gap-2"
            >
              Limpiar Lienzo
            </button>
            <button
              onClick={handleSignSubmit}
              disabled={saving || !hasSigned}
              className="px-12 py-4 bg-amber-honey text-nature-night rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 disabled:hover:scale-100 flex items-center gap-2"
            >
              {saving ? 'Cerrando Contrato...' : isManager ? 'Cerrar y Certificar Contrato' : 'Firmar Contrato y Reservar'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default BookingSignaturePage;
