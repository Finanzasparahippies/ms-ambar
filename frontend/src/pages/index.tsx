import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ticket, ArrowRight, Sparkles, ChevronRight, Play, Check, Sliders, Volume2, Layers, VolumeX, Activity
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// ─── PARTICLE BACKGROUND COMPONENT ───
const CanvasParticles = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
    }> = [];

    const numParticles = 75;

    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2.5 + 1,
      });
    }

    const mouse = { x: -1000, y: -1000, active: false };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handleMouseEnter = () => {
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.x = -1000;
      mouse.y = -1000;
    };

    const parent = canvas.parentElement;
    if (parent) {
      parent.addEventListener('mousemove', handleMouseMove);
      parent.addEventListener('mouseenter', handleMouseEnter);
      parent.addEventListener('mouseleave', handleMouseLeave);
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw lines & particles
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];

        p1.x += p1.vx;
        p1.y += p1.vy;

        if (p1.x < 0 || p1.x > width) p1.vx *= -1;
        if (p1.y < 0 || p1.y > height) p1.vy *= -1;

        if (mouse.active) {
          const dx = mouse.x - p1.x;
          const dy = mouse.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180) {
            p1.x += (dx / dist) * 0.35;
            p1.y += (dy / dist) * 0.35;
          }
        }

        ctx.beginPath();
        ctx.arc(p1.x, p1.y, p1.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 191, 0, 0.45)'; // Amber
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            const alpha = (1 - dist / 120) * 0.15;
            ctx.strokeStyle = `rgba(255, 191, 0, ${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (parent) {
        parent.removeEventListener('mousemove', handleMouseMove);
        parent.removeEventListener('mouseenter', handleMouseEnter);
        parent.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
};

const Home = () => {
  const [isMounted, setIsMounted] = useState(false);
  
  // Newsletter Form States
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [newsletterErrorMessage, setNewsletterErrorMessage] = useState('');

  // Interactive Frequency Modulator States
  const [acousticHz, setAcousticHz] = useState(432); // 220 to 880 Hz
  const [lightLumen, setLightLumen] = useState(75); // 0 to 100
  const [ledPattern, setLedPattern] = useState<'sine' | 'matrix' | 'orbital'>('sine');
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [phase, setPhase] = useState(0);

  // Decibel fluctuating HUD state
  const [hudDecibels, setHudDecibels] = useState(-12.4);

  // Refs for Web Audio API
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);

  // Refs for highlighting sliders on click
  const acousticSliderRef = useRef<HTMLInputElement>(null);
  const lightSliderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
    
    // Telemetry noise update
    const dbInterval = setInterval(() => {
      setHudDecibels(prev => {
        const delta = (Math.random() - 0.5) * 1.8;
        const next = prev + delta;
        return Number(Math.max(-24, Math.min(-6, next)).toFixed(1));
      });
    }, 400);

    return () => clearInterval(dbInterval);
  }, []);

  // Animation loop for wave phase
  useEffect(() => {
    let animId: number;
    const update = () => {
      // Speed up animation based on acoustic frequency
      const speed = 0.03 + (acousticHz / 880) * 0.05;
      setPhase(prev => (prev + speed) % (Math.PI * 2));
      animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [acousticHz]);

  // Audio Context handling
  const startAudio = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Soft triangle waveform
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(acousticHz, ctx.currentTime);

      // Lowpass filter for smooth warmth
      filter.type = 'lowpass';
      const filterFreq = 300 + (lightLumen / 100) * 1200;
      filter.frequency.setValueAtTime(filterFreq, ctx.currentTime);

      // Smooth gain ramp-up to prevent click/pop
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.15);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();

      oscillatorRef.current = osc;
      gainNodeRef.current = gain;
      filterNodeRef.current = filter;
      setIsAudioActive(true);
    } catch (err) {
      console.error('AudioContext initialisation failed:', err);
    }
  };

  const stopAudio = () => {
    const ctx = audioCtxRef.current;
    const osc = oscillatorRef.current;
    const gain = gainNodeRef.current;

    if (ctx && osc && gain) {
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      setTimeout(() => {
        try {
          osc.stop();
          ctx.close();
        } catch (e) {}
        audioCtxRef.current = null;
        oscillatorRef.current = null;
        gainNodeRef.current = null;
        filterNodeRef.current = null;
      }, 180);
    }
    setIsAudioActive(false);
  };

  // Sync pitch dynamically when slider moves
  useEffect(() => {
    if (oscillatorRef.current && audioCtxRef.current) {
      oscillatorRef.current.frequency.setValueAtTime(acousticHz, audioCtxRef.current.currentTime);
    }
  }, [acousticHz]);

  // Sync filter cutoff dynamically when light intensity moves
  useEffect(() => {
    if (filterNodeRef.current && audioCtxRef.current) {
      const filterFreq = 300 + (lightLumen / 100) * 1200;
      filterNodeRef.current.frequency.setValueAtTime(filterFreq, audioCtxRef.current.currentTime);
    }
  }, [lightLumen]);

  // Clean up Audio on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        try {
          oscillatorRef.current?.stop();
          audioCtxRef.current.close();
        } catch (e) {}
      }
    };
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterStatus('submitting');
    setNewsletterErrorMessage('');

    try {
      await axios.post(`${API_URL}/blog/subscribers/`, { email: newsletterEmail });
      setNewsletterStatus('success');
      setNewsletterEmail('');
      setTimeout(() => setNewsletterStatus('idle'), 6000);
    } catch (err: any) {
      console.error(err);
      setNewsletterStatus('error');
      const backendErr = err.response?.data?.email?.[0] || '';
      if (backendErr.includes('exists') || backendErr.includes('already exists') || backendErr.includes('existe')) {
        setNewsletterErrorMessage('Este correo electrónico ya está registrado en nuestro círculo.');
      } else if (err.response?.data?.email) {
        setNewsletterErrorMessage('Por favor, ingresa un correo electrónico válido.');
      } else {
        setNewsletterErrorMessage('Hubo un error al procesar tu registro. Por favor, intenta de nuevo.');
      }
    }
  };

  // Scroll smoothly to Modulator and highlight corresponding control
  const handleConceptClick = (controlType: 'acoustic' | 'light' | 'led') => {
    const target = document.getElementById('modulator');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }

    setTimeout(() => {
      if (controlType === 'acoustic' && acousticSliderRef.current) {
        acousticSliderRef.current.focus();
        acousticSliderRef.current.classList.add('ring-2', 'ring-amber-honey/50');
        setTimeout(() => acousticSliderRef.current?.classList.remove('ring-2', 'ring-amber-honey/50'), 1500);
      } else if (controlType === 'light' && lightSliderRef.current) {
        lightSliderRef.current.focus();
        lightSliderRef.current.classList.add('ring-2', 'ring-amber-honey/50');
        setTimeout(() => lightSliderRef.current?.classList.remove('ring-2', 'ring-amber-honey/50'), 1500);
      } else if (controlType === 'led') {
        setLedPattern(prev => (prev === 'sine' ? 'matrix' : prev === 'matrix' ? 'orbital' : 'sine'));
      }
    }, 800);
  };

  // SVG render functions based on pattern selected
  const renderVisualizerContent = () => {
    if (ledPattern === 'sine') {
      const points1 = [];
      const points2 = [];
      const width = 600;
      const height = 300;
      const midY = height / 2;
      const freqMultiplier = (acousticHz / 440) * 6;
      const ampMultiplier = (lightLumen / 100) * 70;

      for (let x = 0; x <= width; x += 6) {
        const angle1 = (x / width) * Math.PI * 2 * freqMultiplier + phase;
        const y1 = midY + Math.sin(angle1) * ampMultiplier;
        points1.push(`${x},${y1}`);

        const angle2 = (x / width) * Math.PI * 2 * freqMultiplier - phase + Math.PI;
        const y2 = midY + Math.sin(angle2) * (ampMultiplier * 0.6);
        points2.push(`${x},${y2}`);
      }

      return (
        <>
          <path
            d={`M ${points1.join(' L ')}`}
            fill="none"
            stroke="url(#amber-primary-grad)"
            strokeWidth={3}
            className="filter drop-shadow-[0_0_12px_rgba(255,191,0,0.8)]"
          />
          <path
            d={`M ${points2.join(' L ')}`}
            fill="none"
            stroke="url(#amber-cognac-grad)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            className="opacity-70"
          />
        </>
      );
    }

    if (ledPattern === 'matrix') {
      const dots = [];
      const cols = 14;
      const rows = 7;
      const spacingX = 600 / (cols + 1);
      const spacingY = 300 / (rows + 1);

      for (let c = 1; c <= cols; c++) {
        for (let r = 1; r <= rows; r++) {
          const x = c * spacingX;
          const y = r * spacingY;
          const dist = Math.sqrt((x - 300) ** 2 + (y - 150) ** 2);
          const scale = Math.sin(phase * 1.5 - dist * 0.015) * 0.5 + 0.5;
          const radius = (1.5 + scale * 4.5) * (lightLumen / 100 * 0.9 + 0.3);
          dots.push(
            <circle
              key={`${c}-${r}`}
              cx={x}
              cy={y}
              r={radius}
              fill={c % 2 === 0 ? 'rgba(255, 191, 0, ' + (0.15 + scale * 0.6) + ')' : 'rgba(244, 208, 63, ' + (0.1 + scale * 0.4) + ')'}
              className="transition-all duration-300"
            />
          );
        }
      }
      return <>{dots}</>;
    }

    if (ledPattern === 'orbital') {
      const circles = [];
      const numCircles = 6;
      const maxRadius = 170;

      for (let i = 0; i < numCircles; i++) {
        const offset = (i / numCircles) * maxRadius;
        const r = ((phase * 10 + offset) % maxRadius) * (0.5 + (acousticHz / 432) * 0.5);
        const opacity = Math.max(0, 1 - r / maxRadius) * (lightLumen / 100);
        circles.push(
          <circle
            key={i}
            cx={300}
            cy={150}
            r={r}
            fill="none"
            stroke={i % 2 === 0 ? 'url(#amber-primary-grad)' : 'url(#amber-cognac-grad)'}
            strokeWidth={1.5 + (1 - r / maxRadius) * 2.5}
            strokeOpacity={opacity}
          />
        );
      }
      return <>{circles}</>;
    }
  };

  if (!isMounted) return null;

  return (
    <div className="selection:bg-amber-honey/30 overflow-x-hidden font-outfit text-white">
      <Head>
        <title>MS AMBAR | Esencia Artística y Experiencia de Sonidos</title>
        <meta name="description" content="MS Ambar - Una fusión vanguardista de música, arte digital y escenografía de alta gama. Adquiere boletos oficiales y reserva experiencias exclusivas." />
      </Head>

      {/* ─── HERO SECTION (NECTAR LABS STYLE) ─── */}
      <section className="relative min-h-[95vh] flex flex-col justify-center items-center px-6 overflow-hidden">
        {/* Interactive canvas background */}
        <CanvasParticles />

        {/* Glow Spheres */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-amber-honey/10 rounded-full blur-[140px] pointer-events-none animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-600/5 rounded-full blur-[120px] pointer-events-none" />

        {/* Ambient Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="max-w-4xl text-center space-y-8 z-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex items-center justify-center gap-2 bg-amber-honey/10 border border-amber-honey/20 px-4 py-2 rounded-full w-fit mx-auto mb-4"
          >
            <Sparkles size={12} className="text-amber-honey animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-honey">Tour Oficial 2026 • Próximo Show Oct 24</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-6xl md:text-9xl font-black tracking-tight leading-none uppercase italic text-glow"
          >
            MS <span className="text-gradient bg-gradient-to-r from-amber-300 via-amber-honey to-amber-600 bg-clip-text text-transparent">AMBAR</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-white/60 text-xs md:text-sm uppercase tracking-[0.4em] max-w-2xl mx-auto leading-relaxed"
          >
            La fusión vanguardista de arte lumínico, diseño acústico premium y expresión escénica digital.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6"
          >
            <Link
              href="/tour"
              className="px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] bg-amber-honey text-[#06070b] shadow-lg shadow-amber-honey/20 hover:scale-105 hover:shadow-amber-honey/40 transition-all flex items-center gap-3"
            >
              <Ticket size={14} /> Adquirir Boletos
            </Link>
            <Link
              href="/contact"
              className="px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] border border-white/10 hover:border-amber-honey/40 hover:bg-amber-honey/5 transition-all flex items-center gap-3"
            >
              Proponer Booking <ArrowRight size={14} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ─── CONCEPT GRID SECTION ─── */}
      <section className="py-32 relative bg-black/10 border-t border-white/5">
        <div className="max-w-[1600px] mx-auto px-6 md:px-10">
          <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-honey">El Concepto</span>
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight">Experiencia Inmersiva</h2>
            <p className="text-white/40 text-xs md:text-sm">
              Una simbiosis perfecta de ingeniería y arte digital diseñada para disolver los límites entre el artista y el espectador.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Volume2 className="text-amber-honey" size={24} />,
                title: "Diseño Acústico Premium",
                desc: "Sistemas de audio multicanal afinados para proyectar sonido tridimensional de alta resolución en cualquier espacio.",
                key: "acoustic" as const
              },
              {
                icon: <Sliders className="text-amber-honey" size={24} />,
                title: "Arte Lumínico Reactivo",
                desc: "Arreglos de luces analógicas y digitales programadas para sincronizarse en tiempo real con las frecuencias armónicas de la música.",
                key: "light" as const
              },
              {
                icon: <Layers className="text-amber-honey" size={24} />,
                title: "Escenografía Modular",
                desc: "Estructuras traslúcidas de LED que crean profundidad espacial y proyecciones holográficas vanguardistas.",
                key: "led" as const
              }
            ].map((concept, i) => (
              <button
                key={i}
                onClick={() => handleConceptClick(concept.key)}
                className="group relative rounded-[2.5rem] border border-white/5 bg-white/[0.01] p-10 hover:border-amber-honey/20 transition-all flex flex-col justify-between text-left min-h-[300px] overflow-hidden focus:outline-none"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-honey/5 rounded-bl-[5rem] group-hover:bg-amber-honey/10 transition-colors pointer-events-none" />
                <div className="space-y-6">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {concept.icon}
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-white group-hover:text-amber-honey transition-colors">{concept.title}</h3>
                  <p className="text-xs text-white/50 leading-relaxed">{concept.desc}</p>
                </div>
                <div className="pt-6 border-t border-white/5 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/30 group-hover:text-amber-honey transition-colors mt-6 w-full">
                  Experimentar Modulador <ChevronRight size={10} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── INTERACTIVE FREQUENCY MODULATOR (PUNCH MÁGICO) ─── */}
      <section id="modulator" className="py-32 border-t border-white/5 bg-black/15 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/4 w-[450px] h-[450px] bg-amber-honey/5 rounded-full blur-[140px] pointer-events-none" />
        
        <div className="max-w-[1600px] mx-auto px-6 md:px-10">
          <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-honey">Simulador Interactivo</span>
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight">ÁMBAR CONTROL</h2>
            <p className="text-white/40 text-xs md:text-sm">
              Toma el mando del show. Modula las frecuencias del sonido, regula la potencia lumínica y altera la arquitectura de la escenografía LED.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Controls Panel */}
            <div className="lg:col-span-5 space-y-8 bg-white/[0.01] border border-white/5 p-8 md:p-10 rounded-[2.5rem] backdrop-blur-md relative">
              <div className="absolute top-4 right-6 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-honey animate-ping" />
                <span className="text-[8px] font-black uppercase tracking-widest text-amber-honey/60">Consola Activa</span>
              </div>

              {/* Audio Enable Control */}
              <div className="flex items-center justify-between pb-6 border-b border-white/5">
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">Audio Inmersivo</h4>
                  <p className="text-[10px] text-white/40">Activa sintetizador analógico de frecuencias</p>
                </div>
                <button
                  onClick={isAudioActive ? stopAudio : startAudio}
                  className={`p-4 rounded-2xl flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all ${
                    isAudioActive 
                      ? 'bg-amber-honey text-[#06070b] shadow-lg shadow-amber-honey/20' 
                      : 'border border-white/10 hover:border-amber-honey/30 hover:bg-amber-honey/5 text-white/60 hover:text-white'
                  }`}
                >
                  {isAudioActive ? <Volume2 size={14} className="animate-bounce" /> : <VolumeX size={14} />}
                  {isAudioActive ? 'Encendido' : 'Apagado'}
                </button>
              </div>

              {/* Slider 1: Acoustic Resonance */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest">
                  <span className="text-white/60">Resonancia Acústica</span>
                  <span className="text-amber-honey font-black text-glow">{acousticHz} Hz</span>
                </div>
                <input
                  ref={acousticSliderRef}
                  type="range"
                  min="220"
                  max="880"
                  step="1"
                  value={acousticHz}
                  onChange={e => setAcousticHz(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-honey focus:outline-none transition-all"
                />
                <div className="flex justify-between text-[8px] text-white/30 font-bold uppercase tracking-widest">
                  <span>220Hz (Bajo)</span>
                  <span>432Hz (Armónico)</span>
                  <span>880Hz (Agudo)</span>
                </div>
              </div>

              {/* Slider 2: Light Intensity */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest">
                  <span className="text-white/60">Intensidad Lumínica</span>
                  <span className="text-amber-honey font-black text-glow">{lightLumen}%</span>
                </div>
                <input
                  ref={lightSliderRef}
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={lightLumen}
                  onChange={e => setLightLumen(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-honey focus:outline-none transition-all"
                />
                <div className="flex justify-between text-[8px] text-white/30 font-bold uppercase tracking-widest">
                  <span>0% (Umbral)</span>
                  <span>50% (Equilibrio)</span>
                  <span>100% (Saturación)</span>
                </div>
              </div>

              {/* Pattern Toggles: Modular Scenography */}
              <div className="space-y-3">
                <label className="text-[10px] uppercase font-bold tracking-widest text-white/60 block">Escenografía Virtual (LED)</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'sine', label: 'Ondas Sine' },
                    { id: 'matrix', label: 'Matriz LED' },
                    { id: 'orbital', label: 'Órbitas' }
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => setLedPattern(p.id as any)}
                      className={`py-3 px-2 rounded-xl text-[9px] font-black uppercase tracking-wider text-center border transition-all ${
                        ledPattern === p.id 
                          ? 'border-amber-honey/50 bg-amber-honey/10 text-amber-honey shadow-sm shadow-amber-honey/10' 
                          : 'border-white/5 hover:border-white/20 text-white/40 hover:text-white bg-white/[0.005]'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Display Simulator Stage */}
            <div className="lg:col-span-7">
              <div className="bg-[#0c0d13]/70 border border-white/10 rounded-[2.5rem] relative aspect-video flex items-center justify-center overflow-hidden shadow-2xl backdrop-blur-md">
                
                {/* HUD Grid Background */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.008)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.008)_1px,transparent_1px)] bg-[size:2rem_2rem] pointer-events-none" />

                {/* Cyber HUD Overlay */}
                <div className="absolute top-6 left-6 text-[8px] font-mono uppercase tracking-[0.2em] text-white/30 space-y-1">
                  <div>SIM: SPECTRUM ANALYZER v1.02</div>
                  <div className="flex items-center gap-1.5 text-amber-honey">
                    <Activity size={10} className="animate-pulse" /> WAVEFORM PREVIEW
                  </div>
                </div>
                
                <div className="absolute top-6 right-6 text-[8px] font-mono text-white/30 text-right space-y-1">
                  <div>FREQ: <span className="text-amber-honey font-bold">{acousticHz} Hz</span></div>
                  <div>GAIN: <span className="text-white/60">{(lightLumen / 100 * 0.1).toFixed(3)}</span></div>
                </div>

                <div className="absolute bottom-6 left-6 text-[8px] font-mono text-white/30 space-y-1">
                  <div>DB: <span className={`${hudDecibels > -10 ? 'text-amber-500' : 'text-amber-honey'} font-bold`}>{hudDecibels} dB</span></div>
                  <div>PATTERN: <span className="text-white/60 uppercase">{ledPattern}</span></div>
                </div>

                <div className="absolute bottom-6 right-6 text-[8px] font-mono text-white/30 text-right space-y-1">
                  <div>STATUS: <span className="text-green-400 font-bold">ONLINE</span></div>
                  <div>SYNC: <span className="text-white/60">AUTOLOCK</span></div>
                </div>

                {/* SVG Visualizer Rendering */}
                <svg className="w-full h-full max-h-[70%] absolute inset-0 my-auto" viewBox="0 0 600 300">
                  <defs>
                    <linearGradient id="amber-primary-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#9F2B00" stopOpacity="0.4" />
                      <stop offset="50%" stopColor="#FFBF00" stopOpacity="1" />
                      <stop offset="100%" stopColor="#FFBF00" stopOpacity="0.4" />
                    </linearGradient>
                    <linearGradient id="amber-cognac-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#700101" stopOpacity="0.2" />
                      <stop offset="50%" stopColor="#9F2B00" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#FFBF00" stopOpacity="0.2" />
                    </linearGradient>
                  </defs>
                  
                  {renderVisualizerContent()}
                </svg>

                {/* Ambient glow in the center */}
                <div 
                  className="absolute w-[200px] h-[200px] rounded-full blur-[80px] pointer-events-none transition-all duration-300"
                  style={{
                    backgroundColor: ledPattern === 'sine' ? 'rgba(255, 191, 0, ' + (lightLumen / 300) + ')' : ledPattern === 'matrix' ? 'rgba(244, 208, 63, ' + (lightLumen / 400) + ')' : 'rgba(159, 43, 0, ' + (lightLumen / 350) + ')',
                    transform: `scale(${1 + (acousticHz / 880) * 0.3})`
                  }}
                />

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── LIVE MUSIC RELEASES SHOWCASE ─── */}
      <section className="py-32 border-y border-white/5 bg-black/20 relative">
        <div className="max-w-[1600px] mx-auto px-6 md:px-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-honey">Lanzamientos Recientes</span>
              <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tight mt-2">Música & Producción</h3>
            </div>
            <Link href="/music" className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-amber-honey transition-colors flex items-center gap-2 mt-4 md:mt-0">
              Escuchar Discografía Completa <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Eclipse', desc: 'LP Álbum de Estudio • 2026', img: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&q=80' },
              { title: 'Ambar Vision', desc: 'LP Álbum de Estudio • 2024', img: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&q=80' },
              { title: 'Desierto de Cristal', desc: 'LP Álbum de Estudio • 2023', img: 'https://images.unsplash.com/photo-1514525253361-bee8a48790c3?w=500&q=80' }
            ].map((track, i) => (
              <div key={i} className="group relative rounded-[2.5rem] border border-white/5 bg-white/[0.02] overflow-hidden p-4 hover:border-amber-honey/20 transition-all">
                <div className="relative aspect-square rounded-[2rem] overflow-hidden mb-6 border border-white/5">
                  <img src={track.img} alt={track.title} className="object-cover w-full h-full grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Link href="/music" className="w-16 h-16 rounded-full bg-amber-honey text-black flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                      <Play size={24} className="fill-current ml-1" />
                    </Link>
                  </div>
                </div>
                <div className="px-2 space-y-1">
                  <h4 className="font-black uppercase text-sm text-white group-hover:text-amber-honey transition-colors">{track.title}</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{track.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── NEWSLETTER / CLUB SHOWCASE ─── */}
      <section className="py-32 border-t border-white/5 bg-black/40 relative overflow-hidden">
        {/* Glow behind newsletter */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-amber-honey/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8 relative z-10">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-honey">Boletín Oficial</span>
          <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tight">Únete al Círculo</h3>
          <p className="text-white/60 text-xs md:text-sm max-w-xl mx-auto leading-relaxed">
            Recibe crónicas exclusivas del tour, invitaciones a ensayos generales y avisos tempranos de preventas de boletos directamente en tu correo.
          </p>
          
          <div className="pt-6 max-w-md mx-auto">
            <AnimatePresence mode="wait">
              {newsletterStatus === 'success' ? (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="flex flex-col items-center justify-center gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-8 rounded-[2rem] text-center"
                >
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
                    <Check size={20} />
                  </div>
                  <h4 className="font-black uppercase tracking-wider text-[11px] mt-2">¡Suscripción Completada!</h4>
                  <p className="text-[10px] text-emerald-400/80 leading-relaxed">
                    Bienvenido a MS AMBAR. Te hemos enviado un correo de bienvenida. Confirma tu suscripción en tu bandeja de entrada.
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <motion.form 
                    key="form"
                    onSubmit={handleSubscribe} 
                    className="flex flex-col sm:flex-row gap-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <input
                      type="email"
                      placeholder="Ingresa tu correo electrónico..."
                      value={newsletterEmail}
                      onChange={e => {
                        setNewsletterEmail(e.target.value);
                        if (newsletterStatus === 'error') setNewsletterStatus('idle');
                      }}
                      required
                      className="flex-grow bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 focus:border-amber-honey/40 rounded-2xl px-6 py-5 text-xs font-medium focus:outline-none transition-colors placeholder:text-white/20 text-white"
                      disabled={newsletterStatus === 'submitting'}
                    />
                    <button
                      type="submit"
                      className="bg-amber-honey text-[#06070b] font-black text-[10px] uppercase tracking-[0.2em] px-8 py-5 rounded-2xl hover:scale-105 transition-all shadow-lg shadow-amber-honey/10 hover:shadow-amber-honey/20 whitespace-nowrap"
                      disabled={newsletterStatus === 'submitting'}
                    >
                      {newsletterStatus === 'submitting' ? 'Procesando...' : 'Suscribirse'}
                    </button>
                  </motion.form>

                  {newsletterStatus === 'error' && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-amber-500 text-[9px] font-bold uppercase tracking-widest text-center"
                    >
                      ⚠️ {newsletterErrorMessage}
                    </motion.div>
                  )}
                </div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="pt-4">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/30 hover:text-amber-honey transition-colors"
            >
              Visitar Bitácora de MS Ambar <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
