import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Sliders, Volume2, Layers, VolumeX, Activity, ChevronRight, ArrowRight
} from 'lucide-react';
import axios from 'axios';
import ThemedSection from '../components/ThemedSection';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// ─── PARTICLE BACKGROUND COMPONENT (WITH MORPHING) ───
const CanvasParticles = ({ morphTarget = 'none' }: { morphTarget?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const morphTargetRef = useRef(morphTarget);

  useEffect(() => {
    morphTargetRef.current = morphTarget;
  }, [morphTarget]);

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

    let shapes: Record<string, Array<{ x: number; y: number }>> = {};

    const calculateShapes = () => {
      shapes = {
        circle: [],
        moon: [],
        cactus: [],
        star: [],
        infinity: [],
        hexagon: [],
        love: [],
        sun: [],
        eclipse: [],
        music: [],
        bee: [],
        eye: [],
        wave: [],
        spiral: []
      };

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.22;

      // 1. Circle
      for (let i = 0; i < numParticles; i++) {
        const angle = (i / numParticles) * Math.PI * 2;
        shapes.circle.push({
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius
        });
      }

      // 2. Moon
      for (let i = 0; i < numParticles; i++) {
        const angle = -Math.PI / 2 + (i / numParticles) * Math.PI;
        if (i < numParticles * 0.6) {
          shapes.moon.push({
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius
          });
        } else {
          const pct = (i - numParticles * 0.6) / (numParticles * 0.4);
          const innerAngle = -Math.PI / 2 + pct * Math.PI;
          shapes.moon.push({
            x: cx + Math.cos(innerAngle) * (radius * 0.75) + (radius * 0.25),
            y: cy + Math.sin(innerAngle) * (radius * 0.75)
          });
        }
      }

      // 3. Cactus
      for (let i = 0; i < numParticles; i++) {
        const pct = i / numParticles;
        if (pct < 0.4) {
          const sectionPct = pct / 0.4;
          shapes.cactus.push({
            x: cx,
            y: cy + radius - sectionPct * (radius * 2)
          });
        } else if (pct < 0.7) {
          const sectionPct = (pct - 0.4) / 0.3;
          const branchY = cy - radius * 0.2;
          const uPct = sectionPct * Math.PI;
          shapes.cactus.push({
            x: cx - Math.sin(uPct) * (radius * 0.4),
            y: branchY - Math.cos(uPct) * (radius * 0.3)
          });
        } else {
          const sectionPct = (pct - 0.7) / 0.3;
          const branchY = cy + radius * 0.2;
          const uPct = sectionPct * Math.PI;
          shapes.cactus.push({
            x: cx + Math.sin(uPct) * (radius * 0.4),
            y: branchY - Math.cos(uPct) * (radius * 0.3)
          });
        }
      }

      // 4. Star
      for (let i = 0; i < numParticles; i++) {
        const angle = (i / numParticles) * Math.PI * 2;
        const isSpoke = i % 2 === 0;
        const r = isSpoke ? radius : radius * 0.4;
        shapes.star.push({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r
        });
      }

      // 5. Infinity
      for (let i = 0; i < numParticles; i++) {
        const t = (i / numParticles) * Math.PI * 2;
        const scale = 2 / (3 - Math.cos(2 * t));
        shapes.infinity.push({
          x: cx + scale * Math.cos(t) * radius * 1.2,
          y: cy + scale * Math.sin(2 * t) * radius * 0.6
        });
      }

      // 6. Hexagon
      for (let i = 0; i < numParticles; i++) {
        const side = Math.floor((i / numParticles) * 6);
        const nextSide = (side + 1) % 6;
        const pct = ((i / numParticles) * 6) % 1;
        const angle1 = (side / 6) * Math.PI * 2;
        const angle2 = (nextSide / 6) * Math.PI * 2;
        const x1 = cx + Math.cos(angle1) * radius;
        const y1 = cy + Math.sin(angle1) * radius;
        const x2 = cx + Math.cos(angle2) * radius;
        const y2 = cy + Math.sin(angle2) * radius;
        shapes.hexagon.push({
          x: x1 + (x2 - x1) * pct,
          y: y1 + (y2 - y1) * pct
        });
      }

      // 7. Love
      for (let i = 0; i < numParticles; i++) {
        const t = (i / numParticles) * Math.PI * 2;
        const x = 16 * Math.sin(t) ** 3;
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        shapes.love.push({
          x: cx + x * (radius / 16) * 0.95,
          y: cy - y * (radius / 16) * 0.95
        });
      }

      // 8. Sun
      for (let i = 0; i < numParticles; i++) {
        const angle = (i / numParticles) * Math.PI * 2;
        const isRay = i % 3 === 0;
        const r = isRay ? radius * 1.3 : radius * 0.8;
        shapes.sun.push({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r
        });
      }

      // 9. Eclipse
      for (let i = 0; i < numParticles; i++) {
        const angle = (i / numParticles) * Math.PI * 2;
        if (i < numParticles * 0.5) {
          shapes.eclipse.push({
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius
          });
        } else {
          shapes.eclipse.push({
            x: cx + (radius * 0.3) + Math.cos(angle) * (radius * 0.9),
            y: cy + Math.sin(angle) * (radius * 0.9)
          });
        }
      }

      // 10. Music
      for (let i = 0; i < numParticles; i++) {
        const pct = i / numParticles;
        if (pct < 0.4) {
          const sectionPct = pct / 0.4;
          shapes.music.push({
            x: cx - radius * 0.4 + sectionPct * (radius * 0.8),
            y: cy - radius * 0.6
          });
        } else if (pct < 0.7) {
          const sectionPct = (pct - 0.4) / 0.3;
          shapes.music.push({
            x: cx - radius * 0.4,
            y: cy - radius * 0.6 + sectionPct * (radius * 1.2)
          });
        } else {
          const sectionPct = (pct - 0.7) / 0.3;
          shapes.music.push({
            x: cx + radius * 0.4,
            y: cy - radius * 0.6 + sectionPct * (radius * 1.2)
          });
        }
      }

      // 11. Bee
      for (let i = 0; i < numParticles; i++) {
        const angle = (i / numParticles) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius * 0.6;
        shapes.bee.push({
          x: cx + x,
          y: cy + y
        });
      }

      // 12. Eye
      for (let i = 0; i < numParticles; i++) {
        const angle = (i / numParticles) * Math.PI * 2;
        const r = i % 2 === 0 ? radius : radius * 0.3;
        shapes.eye.push({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r * 0.6
        });
      }

      // 13. Wave
      for (let i = 0; i < numParticles; i++) {
        const x = (i / numParticles) * width;
        const y = cy + Math.sin((x / width) * Math.PI * 4) * (radius * 0.5);
        shapes.wave.push({ x, y });
      }

      // 14. Spiral
      for (let i = 0; i < numParticles; i++) {
        const theta = (i / numParticles) * Math.PI * 8;
        const r = (theta / (Math.PI * 8)) * radius * 1.2;
        shapes.spiral.push({
          x: cx + Math.cos(theta) * r,
          y: cy + Math.sin(theta) * r
        });
      }
    };

    calculateShapes();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        width = canvas.width = entry.contentRect.width;
        height = canvas.height = entry.contentRect.height;
        calculateShapes();
      }
    });
    resizeObserver.observe(canvas);

    let isCanvasVisible = true;
    const observer = new IntersectionObserver(([entry]) => {
      isCanvasVisible = entry.isIntersecting;
      if (isCanvasVisible && !animationFrameId) {
        animationFrameId = requestAnimationFrame(animate);
      }
    }, { threshold: 0.01 });
    observer.observe(canvas);

    const animate = () => {
      if (!isCanvasVisible || typeof document !== 'undefined' && document.hidden) {
        animationFrameId = 0;
        return;
      }

      ctx.fillStyle = 'rgba(6, 7, 11, 0.2)';
      ctx.fillRect(0, 0, width, height);

      const targetShape = morphTargetRef.current;
      const targetPoints = shapes[targetShape];

      particles.forEach((p, idx) => {
        if (targetPoints && targetPoints[idx]) {
          const target = targetPoints[idx];
          const dx = target.x - p.x;
          const dy = target.y - p.y;
          p.x += dx * 0.08;
          p.y += dy * 0.08;
          ctx.fillStyle = 'rgba(var(--amber-primary, 229, 169, 59), 0.85)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      observer.disconnect();
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
};

interface TarotCard {
  id: string;
  name: string;
  vibe: string;
  song: string;
  description: string;
  morphTarget: 'circle' | 'moon' | 'cactus' | 'star' | 'infinity' | 'hexagon' | 'love' | 'sun' | 'eclipse' | 'music' | 'bee' | 'eye' | 'wave' | 'spiral';
  color: string;
  icon: string;
  chordFreqs: number[];
  waveType: OscillatorType;
  useTremolo?: boolean;
  useArpeggio?: boolean;
  useSweep?: boolean;
}

const TAROT_CARDS: TarotCard[] = [
  {
    id: 'sol',
    name: 'El Sol de Sonora',
    vibe: 'Fuerza, Vitalidad y Calor del Desierto',
    song: 'Desierto de Cristal',
    description: 'La energía radiante del desierto que impulsa la creación y disipa las sombras. Te invita a brillar con luz propia y contagiar tu alegría.',
    morphTarget: 'sun',
    color: '#FFBF00',
    icon: '☀️',
    chordFreqs: [261.63, 329.63, 392.00, 493.88],
    waveType: 'triangle'
  },
  {
    id: 'sacerdotisa',
    name: 'La Sacerdotisa del Saguaro',
    vibe: 'Intuición, Silencio y Misterio Nocturno',
    song: 'Eclipse',
    description: 'El saber oculto bajo el manto de la noche sonorense. Escucha los susurros del viento y confía plenamente en tu sabiduría interior.',
    morphTarget: 'moon',
    color: '#22A6B3',
    icon: '🌙',
    chordFreqs: [220.00, 261.63, 329.63, 392.00, 493.88],
    waveType: 'sine'
  },
  {
    id: 'ermitano',
    name: 'El Ermitaño de los Cerros',
    vibe: 'Introspección y la Nostalgia del Blues',
    song: 'Ámbar Vision',
    description: 'La búsqueda de la verdad en la soledad de la sierra. El blues profundo te enseña a encontrar la luz en tu propio camino de autodescubrimiento.',
    morphTarget: 'cactus',
    color: '#8B4513',
    icon: '🌵',
    chordFreqs: [164.81, 207.65, 293.66, 392.00],
    waveType: 'triangle'
  },
  {
    id: 'estrella',
    name: 'La Estrella Cósmica',
    vibe: 'Esperanza, Guía y Conexión Universal',
    song: 'Camino Estelar',
    description: 'La alineación de tu ser con las vibras del cosmos. Un recordatorio de que somos polvo de estrellas fluyendo en perfecta armonía con el todo.',
    morphTarget: 'star',
    color: '#F5F6FA',
    icon: '⭐',
    chordFreqs: [523.25, 659.25, 783.99, 987.77, 1046.50],
    waveType: 'sine',
    useArpeggio: true
  },
  {
    id: 'rueda',
    name: 'La Rueda de la Arena',
    vibe: 'Ciclos de la Vida y Ritmos Ancestrales',
    song: 'Ritmos Ancestrales',
    description: 'El movimiento eterno del viento que redefine las dunas. Acepta el cambio con alegría y fluye con el compás de los ciclos del universo.',
    morphTarget: 'infinity',
    color: '#9F2B00',
    icon: '♾️',
    chordFreqs: [130.81, 196.00, 261.63],
    waveType: 'sawtooth',
    useSweep: true
  },
  {
    id: 'colmena',
    name: 'La Colmena Sagrada',
    vibe: 'Colectividad, Dulzura y Polinización Terrestre',
    song: 'Tierra Viva',
    description: 'La magia de la colmena trabajando en armonía. Representa la labor de rescate de abejas con Tierra Viva, sanando la Madre Tierra en comunidad.',
    morphTarget: 'bee',
    color: '#F4D03F',
    icon: '🐝',
    chordFreqs: [220.00, 330.00, 440.00],
    waveType: 'triangle',
    useTremolo: true
  },
  {
    id: 'templanza',
    name: 'La Templanza del Manantial',
    vibe: 'Armonía, Paciencia y Fluidez Emocional',
    song: 'Agua Calma',
    description: 'El fluir constante del agua limpia en el oasis. Te recuerda que todo llega a su debido tiempo si mantienes la paz y la fluidez en tu andar.',
    morphTarget: 'hexagon',
    color: '#4834d4',
    icon: '🏺',
    chordFreqs: [130.81, 196.00, 261.63],
    waveType: 'sawtooth',
    useSweep: true
  },
  {
    id: 'mago',
    name: 'El Mago de las Frecuencias',
    vibe: 'Manifestación, Poder Creador y Alquimia',
    song: 'Frecuencia Alquimia',
    description: 'La destreza para canalizar la energía del universo en ondas sonoras. Tienes todas las herramientas para manifestar y transformar tu reality hoy.',
    morphTarget: 'music',
    color: '#e056fd',
    icon: '🔮',
    chordFreqs: [261.63, 329.63, 392.00, 493.88],
    waveType: 'triangle'
  },
  {
    id: 'emperatriz',
    name: 'La Emperatriz de la Tierra',
    vibe: 'Abundancia, Creatividad y Nutrición Vital',
    song: 'Madre Selva',
    description: 'El florecimiento y el renacimiento de la flora del desierto tras la lluvia. Tu fuerza creativa se nutre de tus raíces terrestres y florece con amor.',
    morphTarget: 'love',
    color: '#6ab04c',
    icon: '🌿',
    chordFreqs: [220.00, 330.00, 440.00],
    waveType: 'triangle',
    useTremolo: true
  },
  {
    id: 'fuerza',
    name: 'La Fuerza del Saguaro',
    vibe: 'Coraje, Valentía y Resiliencia Orgánica',
    song: 'Raíces Fuertes',
    description: 'Como el saguaro centenario que resiste de pie en el desierto. Tu verdadera fuerza reside en la perseverancia, la templanza y la paz interna.',
    morphTarget: 'cactus',
    color: '#ff7979',
    icon: '🦁',
    chordFreqs: [164.81, 207.65, 293.66, 392.00],
    waveType: 'triangle'
  },
  {
    id: 'mundo',
    name: 'El Mundo Cósmico',
    vibe: 'Plenitud, Realización y Cierre de Ciclos',
    song: 'Universo Infinito',
    description: 'La realización total y la danza del cosmos en perfecta armonía. Has completado una etapa con éxito; celebra tus logros y abre tus alas.',
    morphTarget: 'circle',
    color: '#f9ca24',
    icon: '🌍',
    chordFreqs: [523.25, 659.25, 783.99, 987.77, 1046.50],
    waveType: 'sine',
    useArpeggio: true
  },
  {
    id: 'loco',
    name: 'El Loco del Viento',
    vibe: 'Libertad, Nuevos Inicios y Confianza Pura',
    song: 'Ruta Libre',
    description: 'El paso sin miedo hacia lo desconocido bajo la noche estrellada. Confía en el salto de fe y déjate guiar por tu instinto de libertad y alegría.',
    morphTarget: 'spiral',
    color: '#ffbe76',
    icon: '⛺',
    chordFreqs: [220.00, 261.63, 329.63, 392.00, 493.88],
    waveType: 'sine'
  },
  {
    id: 'carro',
    name: 'El Carro de las Dunas',
    vibe: 'Enfoque, Dirección y Movimiento Consciente',
    song: 'Viento en Marcha',
    description: 'El avance firme y triunfante sobre las dunas infinitas. Visualiza tu meta con claridad y avanza con la confianza de que el viento sopla a tu favor.',
    morphTarget: 'infinity',
    color: '#1abc9c',
    icon: '🧭',
    chordFreqs: [196.00, 246.94, 293.66, 392.00],
    waveType: 'sawtooth',
    useSweep: true
  },
  {
    id: 'juicio',
    name: 'El Despertar del Eco',
    vibe: 'Claridad, Despertar y Propósito de Luz',
    song: 'Frecuencia Despierta',
    description: 'El eco de la montaña que te llama a despertar tu potencial más puro. Es el momento de liberar viejos temores y abrazar tu vocación cósmica.',
    morphTarget: 'eclipse',
    color: '#9b59b6',
    icon: '🔔',
    chordFreqs: [349.23, 440.00, 523.25, 698.46],
    waveType: 'sine',
    useArpeggio: true
  },
  {
    id: 'enamorados',
    name: 'Los Enamorados del Cosmos',
    vibe: 'Unión, Resonancia y Decisiones del Corazón',
    song: 'Alquimia Dual',
    description: 'La perfecta armonía entre el cielo y la tierra. El amor propio y la conexión genuina con los demás amplifican tu vibración y atraen bendiciones.',
    morphTarget: 'love',
    color: '#fd79a8',
    icon: '💖',
    chordFreqs: [164.81, 220.00, 261.63, 329.63, 415.30],
    waveType: 'sine'
  },
  {
    id: 'justicia',
    name: 'La Balanza de la Arena',
    vibe: 'Verdad, Equilibrio y Armonía Cósmica',
    song: 'Tierra Justa',
    description: 'La serenidad del desierto que equilibra el día y la noche. Actúa con integridad, paz y el universo alineará todas las cosas para tu mayor bien.',
    morphTarget: 'hexagon',
    color: '#74b9ff',
    icon: '⚖️',
    chordFreqs: [146.83, 220.00, 293.66, 349.23],
    waveType: 'triangle'
  },
  {
    id: 'luna',
    name: 'La Luna del Desierto',
    vibe: 'Sueños, Subconsciente y Flujo Creativo Nocturno',
    song: 'Marea Cósmica',
    description: 'La luz plateada que alumbra las dunas de noche. Permite que tus sueños guíen tu arte y que tu intuición sea tu mayor faro en la oscuridad.',
    morphTarget: 'eye',
    color: '#a29bfe',
    icon: '🌕',
    chordFreqs: [246.94, 293.66, 369.99, 440.00, 493.88],
    waveType: 'sine',
    useArpeggio: true
  },
  {
    id: 'hierofante',
    name: 'El Guía Cósmico',
    vibe: 'Sabiduría Ancestral, Rituales y Enseñanzas',
    song: 'Eco de Ancestros',
    description: 'Los rituales y la sabiduría transmitida por las estrellas. Hay conocimiento profundo esperándote; sé receptivo a las sabias enseñanzas de la naturaleza.',
    morphTarget: 'cactus',
    color: '#e67e22',
    icon: '🗝️',
    chordFreqs: [196.00, 246.94, 293.66, 349.23],
    waveType: 'triangle'
  },
  {
    id: 'locomotora',
    name: 'El Viaje del Tren',
    vibe: 'Aventura, Libertad de Espíritu y Nuevas Rutas',
    song: 'Blues del Camino',
    description: 'El silbato del tren cruzando el desierto de Sonora. Un llamado al viaje y a la exploración de nuevos horizontes sin mirar atrás y con un blues en el alma.',
    morphTarget: 'infinity',
    color: '#f39c12',
    icon: '🚂',
    chordFreqs: [146.83, 196.00, 220.00, 293.66],
    waveType: 'sawtooth',
    useSweep: true
  },
  {
    id: 'oasis',
    name: 'El Oasis Oculto',
    vibe: 'Renovación, Abundancia y Paz Interior',
    song: 'Agua de Luz',
    description: 'Un santuario de agua cristalina rodeado de palmeras. Recuerda que siempre hay un refugio de paz dentro de ti para refrescar y nutrir tu espíritu.',
    morphTarget: 'wave',
    color: '#2ecc71',
    icon: '🌴',
    chordFreqs: [220.00, 277.18, 329.63, 440.00],
    waveType: 'triangle',
    useTremolo: true
  }
];

const Entretenimiento = () => {
  const [isMounted, setIsMounted] = useState(false);
  const [readingCode, setReadingCode] = useState<string>('');
  const [synergyMessage, setSynergyMessage] = useState<string>('');

  // Interactive Frequency Modulator States
  const [acousticHz, setAcousticHz] = useState(432);
  const [lightLumen, setLightLumen] = useState(75);
  const [ledPattern, setLedPattern] = useState<'sine' | 'matrix' | 'orbital'>('sine');
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [phase, setPhase] = useState(0);

  // Decibel fluctuating HUD state
  const [hudDecibels, setHudDecibels] = useState(-12.4);

  // Tarot and Constellation states
  const [morphTarget, setMorphTarget] = useState<string>('none');
  const [drawnCards, setDrawnCards] = useState<Record<number, TarotCard | null>>({ 0: null, 1: null, 2: null });
  const [flippedSlots, setFlippedSlots] = useState<Record<number, boolean>>({ 0: false, 1: false, 2: false });
  const [isShuffling, setIsShuffling] = useState(false);

  // Refs for Web Audio API
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);

  // Refs for highlighting sliders on click
  const acousticSliderRef = useRef<HTMLInputElement>(null);
  const lightSliderRef = useRef<HTMLInputElement>(null);

  // Ref to track morphing constellation timeout
  const morphTimeoutRef = useRef<any>(null);

  const generateUniqueSynergy = (c0: TarotCard, c1: TarotCard, c2: TarotCard) => {
    const intros = [
      "La vibración del desierto de Sonora y las frecuencias cósmicas se entrelazan hoy para revelar tu sintonía trina. ",
      "Bajo la luz del oráculo y la resonancia acústica de MS Ambar, tu portal energético se ha abierto. ",
      "Tus tres arcanos del desierto se alinean en una constelación de luz única, manifestando tu lectura trina. ",
      "El viento cálido de la sierra y la sabiduría de la tierra revelan una frecuencia de viaje sumamente especial. "
    ];

    const roots = [
      `Como punto de partida, ${c0.name} (${c0.vibe.toLowerCase()}) actúa como tu cimiento primordial. Te invita a conectar con la esencia de "${c0.song}", recordándote que la fuerza reside en tus raíces y que tu origen sostiene todo tu ser. `,
      `Tu energía nace y se ancla con ${c0.name} (${c0.vibe.toLowerCase()}). Esta carta siembra una semilla de poder y resiliencia en tu interior, alineada con la melodía de "${c0.song}" para darte fuerza. `,
      `La raíz de tu lectura está cimentada en ${c0.name} (${c0.vibe.toLowerCase()}), trayendo la esencia espiritual de "${c0.song}". Esto te recuerda honrar tu camino recorrido para nutrir con sabiduría tu presente. `
    ];

    const paths = [
      `En el presente, tu andar es guiado por ${c1.name}. Su sintonía te impulsa a vibrar con "${c1.song}" para fluir con los ritmos y cambios del desierto, despertando tu intuición en cada paso. `,
      `El camino que transitas ahora se sincroniza con ${c1.name}, recordándote fluir con la melodía de "${c1.song}". Es un llamado activo a expresar tu verdad y mantener una vibración alta en tus decisiones. `,
      `Actualmente, la frecuencia de ${c1.name} ilumina tu presente con la vibración de "${c1.song}". Aprovecha este flujo energético para expandir tu consciencia creativa y tu conexión con el entorno. `
    ];

    const cosmos = [
      `Finalmente, tu destino se proyecta hacia la inmensidad de ${c2.name}. Su luz abre un portal de manifestación donde la música y la tierra conspiran para guiar tu viaje hacia la plenitud. `,
      `Hacia el porvenir, ${c2.name} dibuja una ruta estelar prometedora. Se alinea con "${c2.song}" para brindarte abundancia, renovación espiritual y una profunda paz interior. `,
      `Tu energía futura encuentra su resonancia en ${c2.name}, indicando un desenlace lleno de realizaciones. Se proyecta como un portal de abundancia, luz y sintonía cósmica total con el todo. `
    ];

    const conclusions = [
      "Camina con confianza; la música del desierto de Sonora y la sintonía del universo están en perfecta armonía con tu ser.",
      "Confía en la sabiduría del saguaro y en el vuelo de la colmena. Tu viaje terrestre y espiritual está bendecido.",
      "Mantén tu vibración elevada y permite que esta sintonía trina guíe tus pasos. Abre tu corazón al flujo infinito del amor.",
      "El cosmos y la tierra se han alíneado para apoyar tus intenciones más puras. Eres parte de esta gran sinergia universal y musical."
    ];

    const rIntro = intros[Math.floor(Math.random() * intros.length)];
    const rRoot = roots[Math.floor(Math.random() * roots.length)];
    const rPath = paths[Math.floor(Math.random() * paths.length)];
    const rCosmos = cosmos[Math.floor(Math.random() * cosmos.length)];
    const rConclusion = conclusions[Math.floor(Math.random() * conclusions.length)];

    return `${rIntro}${rRoot}${rPath}${rCosmos}${rConclusion}`;
  };

  const playTarotChord = (card: TarotCard) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.1);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.5);
      masterGain.connect(ctx.destination);

      const { chordFreqs, waveType, useTremolo, useArpeggio, useSweep } = card;

      chordFreqs.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        osc.type = waveType;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        if (useSweep) {
          osc.frequency.exponentialRampToValueAtTime(freq * 3, ctx.currentTime + 1.8);
        }

        if (useArpeggio) {
          const noteGain = ctx.createGain();
          noteGain.gain.setValueAtTime(0, ctx.currentTime);
          noteGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + index * 0.15 + 0.05);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + index * 0.15 + 1.2);

          osc.connect(noteGain);
          noteGain.connect(masterGain);

          osc.start(ctx.currentTime + index * 0.15);
          osc.stop(ctx.currentTime + 2.5);
        } else if (useTremolo) {
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 14;
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = 0.45;

          const tremoloGain = ctx.createGain();
          tremoloGain.gain.value = 0.55;

          lfo.connect(lfoGain);
          lfoGain.connect(tremoloGain.gain);

          osc.connect(tremoloGain);
          tremoloGain.connect(masterGain);

          lfo.start();
          osc.start();

          lfo.stop(ctx.currentTime + 2.5);
          osc.stop(ctx.currentTime + 2.5);
        } else {
          osc.connect(masterGain);
          osc.start();
          osc.stop(ctx.currentTime + 2.5);
        }
      });

      setTimeout(() => {
        try {
          ctx.close();
        } catch (e) { }
      }, 2800);

    } catch (err) {
      console.error('Local AudioContext chord play failed:', err);
    }
  };

  const drawTarotCard = (slotIndex: number) => {
    if (flippedSlots[slotIndex] || isShuffling) return;

    const drawnIds = Object.values(drawnCards)
      .filter((c): c is TarotCard => c !== null)
      .map(c => c.id);

    const availableCards = TAROT_CARDS.filter(c => !drawnIds.includes(c.id));
    if (availableCards.length === 0) return;

    const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];

    const nextDrawnCards = { ...drawnCards, [slotIndex]: randomCard };
    setDrawnCards(nextDrawnCards);
    setFlippedSlots(prev => ({ ...prev, [slotIndex]: true }));
    setMorphTarget(randomCard.morphTarget);
    playTarotChord(randomCard);

    if (nextDrawnCards[0] && nextDrawnCards[1] && nextDrawnCards[2]) {
      const randomHex = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1).toUpperCase();
      const code = `AMBAR-${randomHex()}-${randomHex()}`;
      setReadingCode(code);
      setSynergyMessage(generateUniqueSynergy(nextDrawnCards[0], nextDrawnCards[1], nextDrawnCards[2]));
    }

    if (morphTimeoutRef.current) {
      clearTimeout(morphTimeoutRef.current);
    }
    morphTimeoutRef.current = setTimeout(() => {
      setMorphTarget('none');
    }, 4000);
  };

  const resetTarot = () => {
    setIsShuffling(true);
    setMorphTarget('none');
    setFlippedSlots({ 0: false, 1: false, 2: false });

    if (morphTimeoutRef.current) {
      clearTimeout(morphTimeoutRef.current);
    }

    setTimeout(() => {
      setDrawnCards({ 0: null, 1: null, 2: null });
      setReadingCode('');
      setSynergyMessage('');
    }, 800);

    setTimeout(() => {
      setIsShuffling(false);
    }, 1000);
  };

  useEffect(() => {
    setIsMounted(true);

    const dbInterval = setInterval(() => {
      setHudDecibels(prev => {
        const delta = (Math.random() - 0.5) * 1.8;
        const next = prev + delta;
        return Number(Math.max(-24, Math.min(-6, next)).toFixed(1));
      });
    }, 400);

    return () => clearInterval(dbInterval);
  }, []);

  useEffect(() => {
    let animId: number;
    const update = () => {
      const speed = 0.03 + (acousticHz / 880) * 0.05;
      setPhase(prev => (prev + speed) % (Math.PI * 2));
      animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [acousticHz]);

  const startAudio = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(acousticHz, ctx.currentTime);

      filter.type = 'lowpass';
      const filterFreq = 300 + (lightLumen / 100) * 1200;
      filter.frequency.setValueAtTime(filterFreq, ctx.currentTime);

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
        } catch (e) { }
        audioCtxRef.current = null;
        oscillatorRef.current = null;
        gainNodeRef.current = null;
        filterNodeRef.current = null;
      }, 180);
    }
    setIsAudioActive(false);
  };

  useEffect(() => {
    if (oscillatorRef.current && audioCtxRef.current) {
      oscillatorRef.current.frequency.setValueAtTime(acousticHz, audioCtxRef.current.currentTime);
    }
  }, [acousticHz]);

  useEffect(() => {
    if (filterNodeRef.current && audioCtxRef.current) {
      const filterFreq = 300 + (lightLumen / 100) * 1200;
      filterNodeRef.current.frequency.setValueAtTime(filterFreq, audioCtxRef.current.currentTime);
    }
  }, [lightLumen]);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        try {
          oscillatorRef.current?.stop();
          audioCtxRef.current.close();
        } catch (e) { }
      }
      if (morphTimeoutRef.current) {
        clearTimeout(morphTimeoutRef.current);
      }
    };
  }, []);

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
    <ThemedSection sectionKey="entretenimiento" className="selection:bg-amber-honey/30 overflow-x-hidden font-outfit min-h-screen relative">
      <Head>
        <title>Ms Ambar | Entretenimiento & Oráculo Sensorial</title>
        <meta name="description" content="Oráculo Interactivo y Consola de Frecuencias de MS Ambar. Sintoniza tus arcanos y modula la energía de nuestra escenografía virtual." />
      </Head>

      {/* Interactive canvas background */}
      <div className="fixed inset-0 z-0">
        <CanvasParticles morphTarget={morphTarget} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-nature-night/85 to-nature-night" />
      </div>

      <div className="relative z-10">
        {/* ─── HEADER / HERO SECTION ─── */}
        <section className="pt-32 pb-16 max-w-[1600px] mx-auto px-6 md:px-10 text-center relative overflow-hidden">
          <div className="absolute top-[-10%] left-[-15%] w-[45%] h-[45%] bg-amber-honey/5 blur-[120px] rounded-full pointer-events-none animate-pulse" />
          <div className="max-w-4xl mx-auto space-y-6">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 bg-amber-honey/10 border border-amber-honey/20 px-4 py-2 rounded-full w-fit mx-auto"
            >
              <Sparkles size={12} className="text-amber-honey animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-honey">Portal Multidisciplinario</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic leading-tight"
            >
              ENTRETENIMIENTO <span className="text-glow text-gradient-theme px-2">SENSORIAL</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-white/60 text-xs md:text-sm uppercase tracking-[0.4em] max-w-2xl mx-auto leading-relaxed"
            >
              Explora el oráculo del desierto y modula el sintetizador cósmico en tiempo real.
            </motion.p>
          </div>
        </section>

        {/* ─── TAROT CARDS DECK SECTION ─── */}
        <section className="py-16 max-w-[1600px] mx-auto px-6 md:px-10">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-6">
            <div className="flex items-center justify-center gap-2 bg-amber-honey/5 border border-amber-honey/20 px-4 py-2 rounded-full w-fit mx-auto">
              <Sparkles size={10} className="text-amber-honey animate-pulse" />
              <span className="text-[8px] font-black uppercase tracking-[0.25em] text-amber-honey">Sintonización Diaria & Oráculo Sensorial</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-glow text-gradient-theme">
              LECTOR DE ARCANOS DEL DESIERTO
            </h2>
            <p className="text-white/60 text-xs md:text-sm max-w-2xl mx-auto leading-relaxed">
              El tarot del desierto es una brújula intuitiva inspirada en el cosmos, la naturaleza sonorense y la mística del viaje de MS Ámbar.
              Selecciona tres arcanos para sintonizar tu día: cada carta elegida revela un mensaje de luz y buena vibra, proyecta su constelación en el cielo de partículas y resuena en un acorde acústico único sintetizado en tiempo real.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl justify-items-center">
              {[0, 1, 2].map((slotIndex) => {
                const card = drawnCards[slotIndex];
                const isFlipped = flippedSlots[slotIndex];
                const slotLabels = [
                  'I. Raíz (Origen)',
                  'II. Camino (Presente)',
                  'III. Cosmos (Destino)'
                ];

                return (
                  <div key={slotIndex} className="flex flex-col items-center gap-4 animate-fadeIn">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-honey/70 bg-amber-honey/5 border border-amber-honey/10 px-3 py-1 rounded-full backdrop-blur-sm">
                      {slotLabels[slotIndex]}
                    </div>
                    <div
                      onClick={() => drawTarotCard(slotIndex)}
                      className="tarot-perspective w-[260px] h-[390px] cursor-pointer group"
                    >
                      <motion.div
                        animate={isShuffling ? {
                          x: [0, -15, 15, -10, 10, 0],
                          y: [0, 5, -5, 3, -3, 0],
                          rotate: [0, -2, 2, -1, 1, 0]
                        } : {}}
                        transition={{ duration: 0.6 }}
                        className="w-full h-full"
                      >
                        <div className={`tarot-card-inner h-full w-full ${isFlipped ? 'tarot-card-flipped' : ''}`}>
                          {/* Back Side */}
                          <div className="tarot-card-back bg-nature-night border border-amber-honey/20 flex flex-col items-center justify-center p-6 shadow-2xl hover:border-amber-honey/50 transition-colors">
                            <svg className="absolute inset-0 w-full h-full p-2 pointer-events-none opacity-85" viewBox="0 0 240 370" fill="none">
                              <rect x="6" y="6" width="228" height="358" rx="24" stroke="#FFBF00" strokeWidth="1.5" strokeDasharray="3 3" />
                              <rect x="12" y="12" width="216" height="346" rx="18" stroke="#FFBF00" strokeWidth="0.75" />

                              <path d="M12 28 L28 12 M228 28 L212 12 M12 342 L28 358 M228 342 L212 358" stroke="#FFBF00" strokeWidth="1" />
                              <circle cx="28" cy="28" r="2" fill="#FFBF00" />
                              <circle cx="212" cy="28" r="2" fill="#FFBF00" />
                              <circle cx="28" cy="342" r="2" fill="#FFBF00" />
                              <circle cx="212" cy="342" r="2" fill="#FFBF00" />

                              <path d="M120 135 L150 152 L150 188 L120 205 L90 188 L90 152 Z" stroke="#FFBF00" strokeWidth="1" strokeOpacity="0.5" />
                              <path d="M120 142 L143 155 L143 182 L120 195 L97 182 L97 155 Z" stroke="#FFBF00" strokeWidth="0.75" strokeOpacity="0.3" />

                              <path d="M150 152 L180 135 L180 99 L150 82 L120 99 L120 135" stroke="#FFBF00" strokeWidth="0.5" strokeOpacity="0.25" />
                              <path d="M90 152 L60 135 L60 99 L90 82 L120 99 L120 135" stroke="#FFBF00" strokeWidth="0.5" strokeOpacity="0.25" />
                              <path d="M150 188 L180 205 L180 241 L150 258 L120 241 L120 188" stroke="#FFBF00" strokeWidth="0.5" strokeOpacity="0.25" />
                              <path d="M90 188 L60 205 L60 241 L90 258 L120 241 L120 188" stroke="#FFBF00" strokeWidth="0.5" strokeOpacity="0.25" />

                              <path d="M120 215 L120 148 M120 185 Q135 185 135 170 L135 158 M120 195 Q105 195 105 180 L105 168" stroke="#FFBF00" strokeWidth="1.5" className="filter drop-shadow-[0_0_4px_rgba(255,191,0,0.6)]" />

                              <circle cx="120" cy="50" r="1.5" fill="#FFBF00" />
                              <circle cx="65" cy="65" r="1.5" fill="#FFBF00" />
                              <circle cx="175" cy="65" r="1.5" fill="#FFBF00" />
                              <circle cx="50" cy="300" r="1.5" fill="#FFBF00" />
                              <circle cx="190" cy="300" r="1.5" fill="#FFBF00" />
                              <circle cx="120" cy="320" r="2.5" fill="#FFBF00" className="animate-ping" style={{ animationDuration: '3s' }} />
                              <circle cx="120" cy="320" r="1.5" fill="#FFBF00" />

                              <line x1="120" y1="50" x2="65" y2="65" stroke="#FFBF00" strokeWidth="0.5" strokeOpacity="0.2" />
                              <line x1="120" y1="50" x2="175" y2="65" stroke="#FFBF00" strokeWidth="0.5" strokeOpacity="0.2" />
                              <line x1="65" y1="65" x2="60" y2="99" stroke="#FFBF00" strokeWidth="0.5" strokeOpacity="0.15" />
                              <line x1="175" y1="65" x2="180" y2="99" stroke="#FFBF00" strokeWidth="0.5" strokeOpacity="0.15" />
                            </svg>

                            <div className="z-10 text-center space-y-4 select-none">
                              <div className="w-16 h-16 rounded-full border border-amber-honey/20 bg-amber-honey/5 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-500 group-hover:border-amber-honey/40">
                                <Sparkles className="text-amber-honey/60 group-hover:text-amber-honey transition-colors" size={24} />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-honey/60 group-hover:text-amber-honey transition-colors">Revelar</h4>
                                <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Arcano {slotIndex + 1}</p>
                              </div>
                            </div>
                          </div>

                          {/* Front Side */}
                          <div className="tarot-card-front bg-gradient-to-b from-nature-night to-black border border-amber-honey/30 p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                            <div
                              className="absolute w-[150px] h-[150px] rounded-full blur-[60px] opacity-25 pointer-events-none -top-10 -right-10"
                              style={{ backgroundColor: card?.color || '#FFBF00' }}
                            />

                            <div className="space-y-4 z-10">
                              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                <span className="text-[9px] font-black uppercase tracking-widest text-amber-honey/80">Arcano Revelado</span>
                                <span className="text-sm filter drop-shadow-[0_0_4px_rgba(255,191,0,0.6)]">{card?.icon}</span>
                              </div>

                              <div className="h-32 w-full rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center relative overflow-hidden my-2 group-hover:bg-white/[0.04] transition-colors">
                                <div className="absolute w-24 h-24 rounded-full border border-white/5 animate-spin" style={{ animationDuration: '20s' }} />
                                <div className="absolute w-20 h-20 rounded-full border border-amber-honey/10 animate-spin" style={{ animationDuration: '15s', animationDirection: 'reverse' }} />
                                <span className="text-4xl filter drop-shadow-[0_0_12px_rgba(255,191,0,0.5)] z-10 transition-transform duration-500 group-hover:scale-110">
                                  {card?.icon}
                                </span>
                              </div>

                              <div className="space-y-1.5 text-center">
                                <h3 className="text-sm font-black uppercase tracking-wider text-white group-hover:text-amber-honey transition-colors">
                                  {card?.name}
                                </h3>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-amber-honey/80 font-mono leading-none">
                                  {card?.vibe}
                                </p>
                              </div>

                              <p className="text-[10px] text-white/50 leading-relaxed text-center italic px-1 line-clamp-3">
                                "{card?.description}"
                              </p>
                            </div>

                            <div className="z-10 pt-4 border-t border-white/5 flex flex-col items-center gap-2">
                              <div className="flex items-center gap-1.5 bg-amber-honey/10 border border-amber-honey/20 px-3 py-1.5 rounded-full w-full justify-center">
                                <Volume2 size={10} className="text-amber-honey animate-pulse" />
                                <span className="text-[8px] font-bold uppercase tracking-wider text-amber-honey">
                                  {card?.song}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Interpretive Reading Panel */}
            {(() => {
              const hasDrawnAny = drawnCards[0] !== null || drawnCards[1] !== null || drawnCards[2] !== null;
              if (!hasDrawnAny) return null;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-4xl bg-nature-night/60 border border-white/5 rounded-[2rem] p-8 md:p-10 backdrop-blur-md space-y-6 relative overflow-hidden mt-6"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-honey/5 rounded-bl-[8rem] pointer-events-none" />

                  <div className="text-center space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-honey">Sintonía de tu Lectura Trina</span>
                    <h3 className="text-xl font-black uppercase tracking-tight text-white">El Eco de tu Destino</h3>
                  </div>

                  {/* Slots breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-white/5">
                    {[0, 1, 2].map((slotIndex) => {
                      const card = drawnCards[slotIndex];
                      const slotLabels = ['I. Raíz (Origen)', 'II. Camino (Presente)', 'III. Cosmos (Destino)'];

                      return (
                        <div key={slotIndex} className="space-y-2">
                          <div className="text-[9px] font-black uppercase tracking-widest text-amber-honey/60">{slotLabels[slotIndex]}</div>
                          {card ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{card.icon}</span>
                                <h4 className="text-xs font-black uppercase tracking-wider text-white">{card.name}</h4>
                              </div>
                              <p className="text-[8px] font-bold uppercase text-amber-honey/85 tracking-widest leading-none">{card.vibe}</p>
                              <p className="text-[10px] text-white/50 leading-relaxed italic">"{card.description}"</p>
                            </div>
                          ) : (
                            <div className="h-16 flex items-center justify-center border border-dashed border-white/10 rounded-xl bg-white/[0.005]">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-white/20">Esperando carta...</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Synergy Message */}
                  {drawnCards[0] && drawnCards[1] && drawnCards[2] && synergyMessage && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 }}
                      className="mt-6 p-6 rounded-2xl bg-amber-honey/[0.03] border border-amber-honey/20 space-y-3"
                    >
                      <div className="flex items-center justify-between text-amber-honey border-b border-amber-honey/10 pb-3 mb-2">
                        <div className="flex items-center gap-2">
                          <Sparkles size={14} className="animate-pulse" />
                          <h4 className="text-xs font-black uppercase tracking-[0.2em]">Sintonía de Viaje Sincronizada</h4>
                        </div>
                        {readingCode && (
                          <span className="text-[9px] font-mono font-bold tracking-widest bg-amber-honey/10 px-2 py-0.5 rounded border border-amber-honey/20">
                            {readingCode}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] md:text-xs text-white/80 leading-relaxed">
                        {synergyMessage}
                      </p>
                    </motion.div>
                  )}
                </motion.div>
              );
            })()}

            {/* Reset / Shuffle Button */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={resetTarot}
                disabled={isShuffling}
                className="px-8 py-4 rounded-2xl text-[9px] font-black uppercase tracking-[0.25em] bg-white/[0.02] border border-white/10 hover:border-amber-honey/40 hover:bg-amber-honey/5 transition-all text-white/80 hover:text-white flex items-center gap-2 disabled:opacity-40"
              >
                <Sparkles size={12} className={isShuffling ? 'animate-spin' : ''} />
                {isShuffling ? 'Mezclando...' : 'Mezclar & Reiniciar'}
              </button>
              <p className="text-[8px] text-white/30 font-bold uppercase tracking-widest">
                Cada carta activa una constelación y resuena en un acorde analógico
              </p>
            </div>
          </div>
        </section>

        {/* ─── CONCEPT GRID SECTION ─── */}
        <section className="py-16 relative">
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
                  title: "Blues & Hip-Hop del Desierto",
                  desc: "La crudeza acústica del blues del desierto fusionada con beatmaking y líricas hip-hop de la calle y el cosmos.",
                  key: "acoustic" as const
                },
                {
                  icon: <Sliders className="text-amber-honey" size={24} />,
                  title: "Alineación Cósmica",
                  desc: "Sintonía visual donde las constelaciones se entrelazan con la música, proyectando frecuencias estelares reactivas a la audiencia.",
                  key: "light" as const
                },
                {
                  icon: <Layers className="text-amber-honey" size={24} />,
                  title: "Altar Terrestre y Polinización",
                  desc: "Activismo vivo para rescatar abejas con Tierra Viva, integrado en escenografías construidas con materiales orgánicos y geometría hexagonal.",
                  key: "led" as const
                }
              ].map((concept, i) => (
                <button
                  key={i}
                  onClick={() => handleConceptClick(concept.key)}
                  className="group relative rounded-[2.5rem] border border-white/5 bg-white/[0.01] p-10 hover:border-amber-honey/20 transition-all flex flex-col justify-between text-left min-h-[300px] overflow-hidden focus:outline-none backdrop-blur-sm"
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

        {/* ─── INTERACTIVE FREQUENCY MODULATOR ─── */}
        <section id="modulator" className="py-20 relative overflow-hidden">
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
              <div className="lg:col-span-5 space-y-8 bg-nature-night/60 border border-white/5 p-8 md:p-10 rounded-[2.5rem] backdrop-blur-md relative">
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
                    className={`p-4 rounded-2xl flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all ${isAudioActive
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
                      { id: 'sine', label: 'Vientos del Desierto' },
                      { id: 'matrix', label: 'Cúmulos Estelares' },
                      { id: 'orbital', label: 'Alineación de Arcanos' }
                    ].map(p => (
                      <button
                        key={p.id}
                        onClick={() => setLedPattern(p.id as any)}
                        className={`py-3 px-2 rounded-xl text-[9px] font-black uppercase tracking-wider text-center border transition-all ${ledPattern === p.id
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
                    <div>SIM: FRECUENCIAS DEL DESIERTO v1.02</div>
                    <div className="flex items-center gap-1.5 text-amber-honey">
                      <Activity size={10} className="animate-pulse" /> MONITOREO VIBRACIONAL
                    </div>
                  </div>

                  <div className="absolute top-6 right-6 text-[8px] font-mono text-white/30 text-right space-y-1">
                    <div>VIBE: <span className="text-amber-honey font-bold">{acousticHz} Hz</span></div>
                    <div>BRILLO: <span className="text-white/60">{(lightLumen / 100 * 0.1).toFixed(3)}</span></div>
                  </div>

                  <div className="absolute bottom-6 left-6 text-[8px] font-mono text-white/30 space-y-1">
                    <div>PRESENCIA: <span className={`${hudDecibels > -10 ? 'text-amber-500' : 'text-amber-honey'} font-bold`}>{hudDecibels} dB</span></div>
                    <div>ELEMENTO: <span className="text-white/60 uppercase">{ledPattern === 'sine' ? 'VIENTOS DEL DESIERTO' : ledPattern === 'matrix' ? 'CÚMULOS ESTELARES' : 'ALINEACIÓN DE ARCANOS'}</span></div>
                  </div>

                  <div className="absolute bottom-6 right-6 text-[8px] font-mono text-white/30 text-right space-y-1">
                    <div>SINTONÍA: <span className="text-green-400 font-bold">ACTIVA</span></div>
                    <div>FUSIÓN: <span className="text-white/60">SINCRONIZADA</span></div>
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
      </div>
    </ThemedSection>
  );
};

export default Entretenimiento;
