import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ticket, ArrowRight, Sparkles, ChevronRight, Play, CheckCircle
} from 'lucide-react';
import axios from 'axios';

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

      // 1. Circle (Mundo)
      for (let i = 0; i < numParticles; i++) {
        const angle = (i / numParticles) * Math.PI * 2;
        shapes.circle.push({
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius
        });
      }

      // 2. Moon (Sacerdotisa / Loco / Luna)
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

      // 3. Cactus (Ermitaño / Fuerza / Hierofante)
      const trunkH = Math.min(width, height) * 0.28;
      const numTrunk = 35;
      for (let i = 0; i < numTrunk; i++) {
        const pct = i / (numTrunk - 1);
        shapes.cactus.push({
          x: cx,
          y: cy + trunkH * 0.5 - pct * trunkH
        });
      }
      const numLeft = 20;
      for (let i = 0; i < numLeft; i++) {
        const pct = i / (numLeft - 1);
        let ax = cx;
        let ay = cy + trunkH * 0.1;
        if (pct < 0.4) {
          ax = cx - (pct / 0.4) * (trunkH * 0.3);
        } else {
          ax = cx - trunkH * 0.3;
          ay = cy + trunkH * 0.1 - ((pct - 0.4) / 0.6) * (trunkH * 0.45);
        }
        shapes.cactus.push({ x: ax, y: ay });
      }
      const numRight = 20;
      for (let i = 0; i < numRight; i++) {
        const pct = i / (numRight - 1);
        let ax = cx;
        let ay = cy - trunkH * 0.1;
        if (pct < 0.4) {
          ax = cx + (pct / 0.4) * (trunkH * 0.3);
        } else {
          ax = cx + trunkH * 0.3;
          ay = cy - trunkH * 0.1 - ((pct - 0.4) / 0.6) * (trunkH * 0.5);
        }
        shapes.cactus.push({ x: ax, y: ay });
      }

      // 4. Star (Estrella / Templanza / Siete)
      const ptsStar: Array<{ x: number; y: number }> = [];
      for (let k = 0; k < 10; k++) {
        const angle = (k * Math.PI) / 5 - Math.PI / 2;
        const r = k % 2 === 0 ? radius * 1.15 : radius * 0.45;
        ptsStar.push({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r
        });
      }
      for (let i = 0; i < numParticles; i++) {
        const seg = Math.floor((i / numParticles) * 10) % 10;
        const nextSeg = (seg + 1) % 10;
        const pct = ((i / numParticles) * 10) % 1;
        shapes.star.push({
          x: ptsStar[seg].x + (ptsStar[nextSeg].x - ptsStar[seg].x) * pct,
          y: ptsStar[seg].y + (ptsStar[nextSeg].y - ptsStar[seg].y) * pct
        });
      }

      // 5. Infinity (Rueda / Carro / Locomotora)
      const infRadius = radius * 1.35;
      for (let i = 0; i < numParticles; i++) {
        const t = (i / numParticles) * Math.PI * 2;
        const denom = 1 + Math.sin(t) * Math.sin(t);
        shapes.infinity.push({
          x: cx + (infRadius * Math.cos(t)) / denom,
          y: cy + (infRadius * Math.sin(t) * Math.cos(t)) / denom
        });
      }

      // 6. Hexagon (Justicia / Oasis)
      const ptsHex: Array<{ x: number; y: number }> = [];
      for (let k = 0; k < 6; k++) {
        const angle = (k * Math.PI) / 3;
        ptsHex.push({
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius
        });
      }
      for (let i = 0; i < numParticles; i++) {
        const side = Math.floor((i / numParticles) * 6) % 6;
        const nextSide = (side + 1) % 6;
        const pct = ((i / numParticles) * 6) % 1;
        shapes.hexagon.push({
          x: ptsHex[side].x + (ptsHex[nextSide].x - ptsHex[side].x) * pct,
          y: ptsHex[side].y + (ptsHex[nextSide].y - ptsHex[side].y) * pct
        });
      }

      // 7. Love (Enamorados / Emperatriz) - Parametric Heart
      const heartScale = radius * 0.075;
      for (let i = 0; i < numParticles; i++) {
        const t = (i / numParticles) * Math.PI * 2;
        const xVal = 16 * Math.pow(Math.sin(t), 3);
        const yVal = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        shapes.love.push({
          x: cx + xVal * heartScale,
          y: cy - yVal * heartScale
        });
      }

      // 8. Sun (Sol de Sonora) - Radiant Sun
      const sunRadius = radius * 0.72;
      const centerCount = 45;
      for (let i = 0; i < centerCount; i++) {
        const angle = (i / centerCount) * Math.PI * 2;
        shapes.sun.push({
          x: cx + Math.cos(angle) * sunRadius,
          y: cy + Math.sin(angle) * sunRadius
        });
      }
      const rayCount = numParticles - centerCount;
      const numRays = 8;
      for (let r = 0; r < numRays; r++) {
        const angle = (r / numRays) * Math.PI * 2;
        const numPtsInRay = r === numRays - 1 ? numParticles - shapes.sun.length : Math.floor(rayCount / numRays);
        for (let p = 0; p < numPtsInRay; p++) {
          const rayDist = sunRadius + ((p + 1) / numPtsInRay) * (radius * 0.55);
          shapes.sun.push({
            x: cx + Math.cos(angle) * rayDist,
            y: cy + Math.sin(angle) * rayDist
          });
        }
      }

      // 9. Eclipse (Eclipse / Juicio)
      const ringCount = 45;
      const ringRadius = radius * 0.95;
      for (let i = 0; i < ringCount; i++) {
        const angle = (i / ringCount) * Math.PI * 2;
        shapes.eclipse.push({
          x: cx + Math.cos(angle) * ringRadius,
          y: cy + Math.sin(angle) * ringRadius
        });
      }
      const moonCount = numParticles - ringCount;
      const shadowOffset = radius * 0.22;
      for (let i = 0; i < moonCount; i++) {
        const angle = -Math.PI / 2 + (i / moonCount) * Math.PI;
        if (i < moonCount * 0.6) {
          shapes.eclipse.push({
            x: cx - shadowOffset + Math.cos(angle) * ringRadius,
            y: cy + Math.sin(angle) * ringRadius
          });
        } else {
          const pct = (i - moonCount * 0.6) / (moonCount * 0.4);
          const innerAngle = -Math.PI / 2 + pct * Math.PI;
          shapes.eclipse.push({
            x: cx - shadowOffset + Math.cos(innerAngle) * (ringRadius * 0.75) + (ringRadius * 0.25),
            y: cy + Math.sin(innerAngle) * (ringRadius * 0.75)
          });
        }
      }

      // 10. Music (Mago de las Frecuencias) - Stylized Eighth Note
      const nHead1X = cx - radius * 0.35;
      const nHead1Y = cy + radius * 0.35;
      const nHead2X = cx + radius * 0.3;
      const nHead2Y = cy + radius * 0.15;
      const stem1TopY = cy - radius * 0.5;
      const stem2TopY = cy - radius * 0.7;
      const beamStartX = nHead1X + radius * 0.15;
      const beamEndX = nHead2X + radius * 0.15;

      // Note Head 1
      for (let i = 0; i < 15; i++) {
        const angle = (i / 15) * Math.PI * 2;
        shapes.music.push({
          x: nHead1X + Math.cos(angle) * (radius * 0.18),
          y: nHead1Y + Math.sin(angle) * (radius * 0.13)
        });
      }
      // Note Head 2
      for (let i = 0; i < 15; i++) {
        const angle = (i / 15) * Math.PI * 2;
        shapes.music.push({
          x: nHead2X + Math.cos(angle) * (radius * 0.18),
          y: nHead2Y + Math.sin(angle) * (radius * 0.13)
        });
      }
      // Stem 1
      for (let i = 0; i < 15; i++) {
        const pct = i / 14;
        shapes.music.push({
          x: nHead1X + radius * 0.15,
          y: nHead1Y - pct * (nHead1Y - stem1TopY)
        });
      }
      // Stem 2
      for (let i = 0; i < 15; i++) {
        const pct = i / 14;
        shapes.music.push({
          x: nHead2X + radius * 0.15,
          y: nHead2Y - pct * (nHead2Y - stem2TopY)
        });
      }
      // Beam
      for (let i = 0; i < 15; i++) {
        const pct = i / 14;
        shapes.music.push({
          x: beamStartX + pct * (beamEndX - beamStartX),
          y: stem1TopY + pct * (stem2TopY - stem1TopY)
        });
      }

      // 11. Bee (Colmena Sagrada) - Stylized Bee
      const bodyRadiusX = radius * 0.22;
      const bodyRadiusY = radius * 0.38;
      const headY = cy - bodyRadiusY - radius * 0.12;

      // Body (30 particles)
      for (let i = 0; i < 30; i++) {
        const angle = (i / 30) * Math.PI * 2;
        shapes.bee.push({
          x: cx + Math.cos(angle) * bodyRadiusX,
          y: cy + Math.sin(angle) * bodyRadiusY
        });
      }
      // Left Wing (15 particles)
      for (let i = 0; i < 15; i++) {
        const angle = (i / 15) * Math.PI * 2;
        shapes.bee.push({
          x: cx - bodyRadiusX - radius * 0.18 + Math.cos(angle) * (radius * 0.22),
          y: cy - radius * 0.12 + Math.sin(angle) * (radius * 0.12)
        });
      }
      // Right Wing (15 particles)
      for (let i = 0; i < 15; i++) {
        const angle = (i / 15) * Math.PI * 2;
        shapes.bee.push({
          x: cx + bodyRadiusX + radius * 0.18 + Math.cos(angle) * (radius * 0.22),
          y: cy - radius * 0.12 + Math.sin(angle) * (radius * 0.12)
        });
      }
      // Head (10 particles)
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        shapes.bee.push({
          x: cx + Math.cos(angle) * (radius * 0.12),
          y: headY + Math.sin(angle) * (radius * 0.1)
        });
      }
      // Antennae & Filler (5 particles)
      shapes.bee.push({ x: cx - radius * 0.08, y: headY - radius * 0.1 });
      shapes.bee.push({ x: cx - radius * 0.15, y: headY - radius * 0.18 });
      shapes.bee.push({ x: cx + radius * 0.08, y: headY - radius * 0.1 });
      shapes.bee.push({ x: cx + radius * 0.15, y: headY - radius * 0.18 });
      shapes.bee.push({ x: cx, y: cy }); // Center point

      // 12. Eye (La Luna del Desierto - Ojo Místico)
      for (let i = 0; i < 25; i++) {
        const t = (i / 24) * Math.PI;
        shapes.eye.push({
          x: cx - Math.cos(t) * radius * 1.25,
          y: cy - Math.sin(t) * radius * 0.65
        });
      }
      for (let i = 0; i < 25; i++) {
        const t = (i / 24) * Math.PI;
        shapes.eye.push({
          x: cx - Math.cos(t) * radius * 1.25,
          y: cy + Math.sin(t) * radius * 0.65
        });
      }
      for (let i = 0; i < 25; i++) {
        const angle = (i / 25) * Math.PI * 2;
        shapes.eye.push({
          x: cx + Math.cos(angle) * radius * 0.28,
          y: cy + Math.sin(angle) * radius * 0.28
        });
      }

      // 13. Wave (El Oasis Oculto - Ondas de Agua/Frecuencia)
      const waveW = radius * 2.6;
      const numPerWave = 25;
      for (let w = 0; w < 3; w++) {
        const yOffset = (w - 1) * radius * 0.45;
        for (let i = 0; i < numPerWave; i++) {
          const pct = i / (numPerWave - 1);
          const xVal = cx - waveW * 0.5 + pct * waveW;
          const angle = pct * Math.PI * 4;
          const yVal = cy + yOffset + Math.sin(angle) * (radius * 0.22);
          shapes.wave.push({ x: xVal, y: yVal });
        }
      }

      // 14. Spiral (El Loco del Viento - Espiral/Viento Cósmico)
      for (let i = 0; i < numParticles; i++) {
        const t = (i / (numParticles - 1)) * Math.PI * 5;
        const r = (i / (numParticles - 1)) * radius * 1.25;
        shapes.spiral.push({
          x: cx + Math.cos(t) * r,
          y: cy + Math.sin(t) * r
        });
      }
    };

    calculateShapes();

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
      calculateShapes();
    };
    window.addEventListener('resize', handleResize);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const targetMode = morphTargetRef.current;
      const targetShape = targetMode && targetMode !== 'none' ? shapes[targetMode] : null;

      // Draw lines & particles
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];

        if (targetShape && targetShape[i]) {
          const target = targetShape[i];
          // Easing transition towards the target coordinates
          // If it's a beehive (hexagon) or bee, add a slight jitter for organic buzzing
          const jitter = (targetMode === 'hexagon' || targetMode === 'bee') ? (Math.random() - 0.5) * 1.8 : 0;
          p1.x += (target.x + jitter - p1.x) * 0.08;
          p1.y += (target.y + jitter - p1.y) * 0.08;
        } else {
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
        }

        ctx.beginPath();
        ctx.arc(p1.x, p1.y, p1.size, 0, Math.PI * 2);
        ctx.fillStyle = targetShape ? 'rgba(255, 191, 0, 0.75)' : 'rgba(255, 191, 0, 0.45)'; // Amber
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
            // Highlight connections if morphing is active
            const baseAlpha = targetShape ? 0.35 : 0.15;
            const alpha = (1 - dist / 120) * baseAlpha;
            ctx.strokeStyle = `rgba(255, 191, 0, ${alpha})`;
            ctx.lineWidth = targetShape ? 1.1 : 0.7;
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
    color: '#FFBF00', // Amber honey
    icon: '☀️',
    chordFreqs: [261.63, 329.63, 392.00, 493.88], // C maj 7
    waveType: 'triangle'
  },
  {
    id: 'sacerdotisa',
    name: 'La Sacerdotisa del Saguaro',
    vibe: 'Intuición, Silencio y Misterio Nocturno',
    song: 'Eclipse',
    description: 'El saber oculto bajo el manto de la noche sonorense. Escucha los susurros del viento y confía plenamente en tu sabiduría interior.',
    morphTarget: 'moon',
    color: '#22A6B3', // Nature sky
    icon: '🌙',
    chordFreqs: [220.00, 261.63, 329.63, 392.00, 493.88], // Am 7/9
    waveType: 'sine'
  },
  {
    id: 'ermitano',
    name: 'El Ermitaño de los Cerros',
    vibe: 'Introspección y la Nostalgia del Blues',
    song: 'Ámbar Vision',
    description: 'La búsqueda de la verdad en la soledad de la sierra. El blues profundo te enseña a encontrar la luz en tu propio camino de autodescubrimiento.',
    morphTarget: 'cactus',
    color: '#8B4513', // Nature earth/brown
    icon: '🌵',
    chordFreqs: [164.81, 207.65, 293.66, 392.00], // E 7
    waveType: 'triangle'
  },
  {
    id: 'estrella',
    name: 'La Estrella Cósmica',
    vibe: 'Esperanza, Guía y Conexión Universal',
    song: 'Camino Estelar',
    description: 'La alineación de tu ser con las vibras del cosmos. Un recordatorio de que somos polvo de estrellas fluyendo en perfecta armonía con el todo.',
    morphTarget: 'star',
    color: '#F5F6FA', // White star
    icon: '⭐',
    chordFreqs: [523.25, 659.25, 783.99, 987.77, 1046.50], // High C maj 9
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
    color: '#9F2B00', // Amber cognac
    icon: '♾️',
    chordFreqs: [130.81, 196.00, 261.63], // Sweep chord
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
    color: '#F4D03F', // Amber butterscotch
    icon: '🐝',
    chordFreqs: [220.00, 330.00, 440.00], // A Major with Tremolo
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
    color: '#4834d4', // Deep indigo
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
    description: 'La destreza para canalizar la energía del universo en ondas sonoras. Tienes todas las herramientas para manifestar y transformar tu realidad hoy.',
    morphTarget: 'music',
    color: '#e056fd', // Violet/magenta
    icon: '🔮',
    chordFreqs: [261.63, 329.63, 392.00, 493.88], // C maj 7
    waveType: 'triangle'
  },
  {
    id: 'emperatriz',
    name: 'La Emperatriz de la Tierra',
    vibe: 'Abundancia, Creatividad y Nutrición Vital',
    song: 'Madre Selva',
    description: 'El florecimiento y el renacimiento de la flora del desierto tras la lluvia. Tu fuerza creativa se nutre de tus raíces terrestres y florece con amor.',
    morphTarget: 'love',
    color: '#6ab04c', // Nature leaf green
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
    color: '#ff7979', // Warm coral
    icon: '🦁',
    chordFreqs: [164.81, 207.65, 293.66, 392.00], // E 7
    waveType: 'triangle'
  },
  {
    id: 'mundo',
    name: 'El Mundo Cósmico',
    vibe: 'Plenitud, Realización y Cierre de Ciclos',
    song: 'Universo Infinito',
    description: 'La realización total y la danza del cosmos en perfecta armonía. Has completado una etapa con éxito; celebra tus logros y abre tus alas.',
    morphTarget: 'circle',
    color: '#f9ca24', // Warm gold
    icon: '🌍',
    chordFreqs: [523.25, 659.25, 783.99, 987.77, 1046.50], // High notes
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
    color: '#ffbe76', // Soft peach
    icon: '⛺',
    chordFreqs: [220.00, 261.63, 329.63, 392.00, 493.88], // Am 7/9
    waveType: 'sine'
  },
  {
    id: 'carro',
    name: 'El Carro de las Dunas',
    vibe: 'Enfoque, Dirección y Movimiento Consciente',
    song: 'Viento en Marcha',
    description: 'El avance firme y triunfante sobre las dunas infinitas. Visualiza tu meta con claridad y avanza con la confianza de que el viento sopla a tu favor.',
    morphTarget: 'infinity',
    color: '#1abc9c', // Vibrant turquoise
    icon: '🧭',
    chordFreqs: [196.00, 246.94, 293.66, 392.00], // G major chord
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
    color: '#9b59b6', // Amethyst purple
    icon: '🔔',
    chordFreqs: [349.23, 440.00, 523.25, 698.46], // F major 7 high
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
    color: '#fd79a8', // Rose pink
    icon: '💖',
    chordFreqs: [164.81, 220.00, 261.63, 329.63, 415.30], // E maj 9
    waveType: 'sine'
  },
  {
    id: 'justicia',
    name: 'La Balanza de la Arena',
    vibe: 'Verdad, Equilibrio y Armonía Cósmica',
    song: 'Tierra Justa',
    description: 'La serenidad del desierto que equilibra el día y la noche. Actúa con integridad, paz y el universo alineará todas las cosas para tu mayor bien.',
    morphTarget: 'hexagon',
    color: '#74b9ff', // Air blue
    icon: '⚖️',
    chordFreqs: [146.83, 220.00, 293.66, 349.23], // D minor 7
    waveType: 'triangle'
  },
  {
    id: 'luna',
    name: 'La Luna del Desierto',
    vibe: 'Sueños, Subconsciente y Flujo Creativo Nocturno',
    song: 'Marea Cósmica',
    description: 'La luz plateada que alumbra las dunas de noche. Permite que tus sueños guíen tu arte y que tu intuición sea tu mayor faro en la oscuridad.',
    morphTarget: 'eye',
    color: '#a29bfe', // Lavender sky
    icon: '🌕',
    chordFreqs: [246.94, 293.66, 369.99, 440.00, 493.88], // B min 11 chord
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
    color: '#e67e22', // Warm orange
    icon: '🗝️',
    chordFreqs: [196.00, 246.94, 293.66, 349.23], // G7 chord
    waveType: 'triangle'
  },
  {
    id: 'locomotora',
    name: 'El Viaje del Tren',
    vibe: 'Aventura, Libertad de Espíritu y Nuevas Rutas',
    song: 'Blues del Camino',
    description: 'El silbato del tren cruzando el desierto de Sonora. Un llamado al viaje y a la exploración de nuevos horizontes sin mirar atrás y con un blues en el alma.',
    morphTarget: 'infinity',
    color: '#f39c12', // Golden honey
    icon: '🚂',
    chordFreqs: [146.83, 196.00, 220.00, 293.66], // G sus4
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
    color: '#2ecc71', // Emerald green
    icon: '🌴',
    chordFreqs: [220.00, 277.18, 329.63, 440.00], // A major lush chord
    waveType: 'triangle',
    useTremolo: true
  }
];

const formatoHoraOficial = (fechaString: string) => {
  if (!fechaString) return "--:--";
  try {
    const fecha = new Date(fechaString);
    return fecha.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Mexico_City' // 🌟 Forzamos la zona horaria del DF en el render del cliente
    });
  } catch (e) {
    return "--:--";
  }
};

const Home = () => {
  const [isMounted, setIsMounted] = useState(false);
  const [newsletterName, setNewsletterName] = useState('');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [newsletterErrorMessage, setNewsletterErrorMessage] = useState('');
  const [nextEvent, setNextEvent] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
    axios.get(`${API_URL}/tickets/events/`)
      .then(res => {
        if (res.data && res.data.length > 0) {
          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const upcoming = res.data
            .filter((e: any) => e.is_active !== false)
            .map((e: any) => ({ ...e, dateObj: new Date(e.date) }))
            .filter((e: any) => e.dateObj >= startOfToday)
            .sort((a: any, b: any) => a.dateObj.getTime() - b.dateObj.getTime());

          if (upcoming.length > 0) {
            setNextEvent(upcoming[0]);
          } else {
            setNextEvent(null);
          }
          console.log("Upcoming events:", upcoming);
        }
      })
      .catch(err => console.error("Error fetching next event:", err));
  }, []);

  const getFormattedEventDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
      const formatted = d.toLocaleDateString('es-MX', options);
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return "Oct 24";
    }
  };

  const getDynamicPrice = (event: any, baseAmount: number) => {
    if (!event || !event.date) return baseAmount;
    if (event.enable_dynamic_pricing === false) return baseAmount;
    const eventDate = new Date(event.date);
    const now = new Date();
    const eventMonthIdx = eventDate.getFullYear() * 12 + eventDate.getMonth();
    const currMonthIdx = now.getFullYear() * 12 + now.getMonth();
    const monthsDiff = Math.max(0, eventMonthIdx - currMonthIdx);
    const increment = Number(event.monthly_price_increment ?? 50);
    return Math.max(0, baseAmount - (monthsDiff * increment));
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterStatus('submitting');
    setNewsletterErrorMessage('');

    try {
      await axios.post(`${API_URL}/blog/subscribers/`, {
        email: newsletterEmail,
        name: newsletterName
      });
      setNewsletterStatus('success');
      setNewsletterEmail('');
      setNewsletterName('');
      setTimeout(() => setNewsletterStatus('idle'), 6000);
    } catch (err: any) {
      console.error(err);
      setNewsletterStatus('error');
      const backendErr = err.response?.data?.email?.[0] || '';
      if (backendErr.includes('exists') || backendErr.includes('already exists') || backendErr.includes('existe')) {
        setNewsletterErrorMessage('Este correo electrónico ya está registrado a las cartas.');
      } else if (err.response?.data?.email) {
        setNewsletterErrorMessage('Por favor, ingresa un correo electrónico válido.');
      } else {
        setNewsletterErrorMessage('Hubo un error al procesar tu registro. Por favor, intenta de nuevo.');
      }
    }
  };

  if (!isMounted) return null;

  return (
    <div className="selection:bg-amber-honey/30 overflow-x-hidden font-outfit text-[#F4F6F0] bg-[#06070b] min-h-screen">
      <Head>
        <title>Ms Ambar | Cantautora Mexicana</title>
        <meta name="description" content="Ms Ambar - Desde Sonora para el mundo, adquiere tus boletos y acompáñame en este camino por la música y los escenarios." />
      </Head>

      {/* ─── HERO SECTION (NECTAR LABS STYLE) ─── */}
      <section className="relative min-h-[50vh] flex flex-col justify-center items-center px-6 pt-32 pb-8 md:pt-40 md:pb-12 overflow-hidden">
        {/* Interactive canvas background */}
        <CanvasParticles morphTarget="none" />

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
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-honey">
              {nextEvent
                ? `Mi próximo evento es solo para reales, nos vemos en ${nextEvent.venue_name} el ${getFormattedEventDate(nextEvent.date)} desde $${nextEvent.price_with_fee ? Math.ceil(nextEvent.price_with_fee.total) : nextEvent.base_price} MXN.`
                : "¡Próximamente nuevo evento solo para reales!"
              }
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="flex justify-center items-center py-6"
          >
            <img
              src="/logos/ms_ambar_logo_b.png"
              alt="Ms Ambar"
              className="h-20 md:h-32 w-auto object-contain hover:scale-[1.02] transition-transform duration-500"
              style={{ filter: 'drop-shadow(0 0 35px rgba(229,169,59,0.25))' }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6"
          >
            <Link
              href="/comprar-boletos"
              className="px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] bg-amber-honey text-[#06070b] shadow-lg shadow-amber-honey/20 hover:scale-105 hover:shadow-amber-honey/40 transition-all flex items-center gap-3"
            >
              <Ticket size={14} /> Adquirir Boletos
            </Link>
            {/*<Link
              href="/contacto"
              className="px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] border border-white/20 text-[#F4F6F0] hover:border-amber-honey/40 hover:bg-amber-honey/5 transition-all flex items-center gap-3"
            >
              Contacto <ArrowRight size={14} />
            </Link>*/}
          </motion.div>
        </div>
      </section>

      {/* ─── PRÓXIMO EVENTO FLYER SECTION ─── */}
      {nextEvent?.flyer_url && (
        <section className="pb-16 md:pb-24 bg-[#06070b]">
          <div className="max-w-[1400px] mx-auto px-6 md:px-10">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="relative bg-gradient-to-br from-[#0d0e12] to-[#07080c] rounded-[2.5rem] overflow-hidden border border-amber-honey/10 group shadow-[0_0_50px_rgba(6,7,11,0.8)] grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 p-8 md:p-14 items-center"
            >
              {/* Left Column: Content */}
              <div className="space-y-6 order-2 lg:order-1 lg:col-span-7 z-20 flex flex-col items-center lg:items-start text-center lg:text-left justify-center h-full w-full">
                <div className="flex flex-wrap items-center gap-3 justify-center lg:justify-start">
                  <div className="inline-flex items-center gap-2 bg-amber-honey/5 border border-amber-honey/20 px-3 py-1.5 rounded-full w-fit backdrop-blur-sm">
                    <Sparkles size={12} className="text-amber-honey animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-honey/90">
                      Próximo Evento
                    </span>
                  </div>

                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-[0.25em] backdrop-blur-sm ${nextEvent.event_type === 'meet_greet'
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                    : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    }`}>
                    {nextEvent.event_type === 'meet_greet' ? '🤝 Convivencia M&G' : '🎸 En Vivo / Concert'}
                  </div>
                </div>

                <div className="space-y-1 flex flex-col items-center lg:items-start">
                  <h2 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase italic tracking-tighter text-white leading-[0.95] max-w-md lg:max-w-xl group-hover:text-amber-honey/90 transition-colors duration-500">
                    {nextEvent.title}
                  </h2>
                  <p className="text-amber-honey/60 font-serif italic text-lg tracking-wide md:text-xl pt-1">
                    por {nextEvent.artist}
                  </p>
                </div>

                <div className="w-12 h-[2px] bg-gradient-to-r from-transparent via-amber-honey/40 to-transparent lg:from-amber-honey/40 lg:to-transparent" />

                <div className="space-y-4 w-full max-w-md lg:max-w-lg flex flex-col items-center lg:items-start">
                  <div className="text-sm md:text-base text-white/90 font-bold tracking-tight space-y-2 w-full text-center lg:text-left">
                    <p>{getFormattedEventDate(nextEvent.date)}</p>

                    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 text-xs font-medium text-[#F4F6F0]/60 pt-0.5">
                      {nextEvent.doors_open && (
                        <span className="bg-white/5 border border-white/5 px-2.5 py-1 rounded-md">
                          🚪 Puertas: <strong className="text-white">{formatoHoraOficial(nextEvent.doors_open)} hrs</strong>
                        </span>
                      )}
                      {/* LOGICA DE CIERRE DINÁMICO CORREGIDA CON TIMEZONE */}
                      {nextEvent.date && (nextEvent.duration_minutes || nextEvent.end_date) && (
                        <span className="bg-white/5 border border-white/5 px-2.5 py-1 rounded-md">
                          ✨ Cierre: <strong className="text-white">
                            {(() => {
                              if (nextEvent.end_date) {
                                return formatoHoraOficial(nextEvent.end_date);
                              }
                              const startDate = new Date(nextEvent.date);
                              const calculatedEndDate = new Date(startDate.getTime() + (Number(nextEvent.duration_minutes || 120) * 60 * 1000));
                              return formatoHoraOficial(calculatedEndDate.toISOString());
                            })()} hrs
                          </strong>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#F4F6F0]/50 font-normal tracking-normal pt-1">
                      📍 {nextEvent.venue_name || nextEvent.theater_name} — <span className="italic">{nextEvent.venue_address || nextEvent.theater_location}</span>
                    </p>
                  </div>

                  {nextEvent && (
                    <div className="text-xs md:text-sm text-[#F4F6F0]/80 font-medium leading-relaxed bg-[#0d0e12]/60 p-5 rounded-2xl border border-amber-honey/20 backdrop-blur-sm w-full text-center lg:text-left space-y-3 shadow-lg">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                        <span className="text-amber-honey font-black text-xs uppercase tracking-wider">Tarifas del Evento</span>
                        {nextEvent.enable_dynamic_pricing !== false && (
                          <span className="text-[10px] bg-amber-honey/10 text-amber-honey px-2.5 py-0.5 rounded-full border border-amber-honey/30 font-semibold">
                            Precio Dinámico por Mes
                          </span>
                        )}
                      </div>

                      {nextEvent.event_type === 'meet_greet' ? (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/80 font-medium">🎟️ Acceso Convivencia M&G</span>
                          <span className="text-white font-black text-base">${Math.round(Number(nextEvent.mg_price || 0)).toLocaleString('es-MX')} MXN</span>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {/* Boleto General (Sin Asiento) */}
                          <div className="flex items-center justify-between text-xs md:text-sm bg-white/[0.03] p-2.5 rounded-xl border border-white/5">
                            <div className="flex flex-col text-left">
                              <span className="text-white font-bold">🎟️ Entrada General (Sin Asiento)</span>
                              <span className="text-[10px] text-white/50">Acceso preferencial de pie</span>
                            </div>
                            <span className="text-amber-honey font-black text-sm md:text-base">
                              ${Math.round(nextEvent.effective_seatless_ticket_price
                                ? Number(nextEvent.effective_seatless_ticket_price)
                                : getDynamicPrice(nextEvent, Number(nextEvent.seatless_ticket_price || 300))
                              ).toLocaleString('es-MX')} MXN
                            </span>
                          </div>

                          {/* Boleto Numerado (Asiento de Mesa) */}
                          <div className="flex items-center justify-between text-xs md:text-sm bg-white/[0.03] p-2.5 rounded-xl border border-white/5">
                            <div className="flex flex-col text-left">
                              <span className="text-white font-bold">🪑 Asiento Numerado (Mesas)</span>
                              <span className="text-[10px] text-white/50">Lugar reservado en 42 mesas x 4 butacas</span>
                            </div>
                            <span className="text-amber-honey font-black text-sm md:text-base">
                              ${Math.round(getDynamicPrice(nextEvent, Number(nextEvent.base_price || 400))).toLocaleString('es-MX')} MXN
                            </span>
                          </div>

                          {/* Meet & Greet Adicional (Opcional) */}
                          {nextEvent.mg_limit > 0 && (
                            <div className="flex items-center justify-between text-xs bg-purple-500/10 p-2.5 rounded-xl border border-purple-500/20 text-purple-300">
                              <span className="font-semibold">🤝 Pase Opcional Meet & Greet</span>
                              <span className="font-black text-white">+${Math.round(Number(nextEvent.mg_price || 0)).toLocaleString('es-MX')} MXN</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* MÓDULO DE CUPO DEL EVENTO */}
                      {nextEvent.event_type !== 'meet_greet' && nextEvent.mg_limit > 0 && (
                        <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${nextEvent.mg_available > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="text-[#F4F6F0]/40">Cupo M&G disponible:</span>
                          </div>
                          <span className={`font-black uppercase tracking-wider ${nextEvent.mg_available <= 5 && nextEvent.mg_available > 0 ? 'text-red-400 animate-bounce' : 'text-white'}`}>
                            {nextEvent.mg_available > 0 ? `${nextEvent.mg_available} pases disponibles` : 'Agotado'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 w-full lg:w-auto">
                  <Link
                    href="/comprar-boletos"
                    className={`inline-flex items-center justify-center gap-3 w-[90%] mx-auto sm:mx-0 sm:w-fit px-24 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.25em] transition-all duration-300 ${nextEvent.event_type === 'meet_greet' && nextEvent.mg_available === 0
                      ? 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed pointer-events-none'
                      : 'bg-amber-honey text-[#06070b] shadow-xl shadow-amber-honey/20 hover:bg-white hover:text-black hover:scale-[1.03] hover:shadow-white/10'
                      }`}
                  >
                    <Ticket size={14} />
                    {nextEvent.event_type === 'meet_greet' && nextEvent.mg_available === 0 ? 'Cupos Agotados' : 'Adquirir Accesos'}
                  </Link>
                </div>
              </div>

              {/* Right Column: Flyer Container */}
              <div className="w-full h-80 sm:h-[400px] lg:h-[460px] overflow-hidden rounded-2xl order-1 lg:order-2 lg:col-span-5 z-20 flex justify-center lg:justify-end">
                <div className="relative w-full h-full max-w-[340px] lg:max-w-none rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5">
                  <img
                    src={nextEvent.flyer_url}
                    alt={`Flyer: ${nextEvent.title}`}
                    className="w-full h-full object-contain object-center lg:object-right group-hover:scale-[1.04] transition-transform duration-1000 ease-out"
                  />
                </div>
              </div>

              {/* El Aura Amber Glow Ultra-premium */}
              <div className="absolute top-1/2 -right-20 -translate-y-1/2 w-80 h-80 bg-amber-honey/10 rounded-full blur-[120px] pointer-events-none z-10 group-hover:bg-amber-honey/15 transition-colors duration-1000" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#06070b]/20 via-transparent to-transparent pointer-events-none z-10" />
            </motion.div>
          </div>
        </section>
      )}

      {/* ─── BIOGRAPHY SECTION ─── */}
      <section className="pt-8 pb-16 md:pt-12 md:pb-24 relative overflow-hidden bg-[#06070b]">
        <div className="absolute top-1/2 left-[-10%] w-[35%] h-[35%] bg-amber-honey/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-[1600px] mx-auto px-6 md:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">
            {/* Left Column: Image with premium frame */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="lg:col-span-5 relative group max-w-md mx-auto lg:max-w-none w-full"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-honey/20 to-transparent rounded-[3rem] blur-2xl opacity-30 group-hover:opacity-60 transition-opacity duration-700 pointer-events-none" />

              <div className="relative rounded-[3rem] overflow-hidden border border-white/10 p-3 bg-white/[0.02] backdrop-blur-md transition-all duration-500 group-hover:border-amber-honey/30 shadow-2xl">
                <div className="relative aspect-[3/4] rounded-[2.5rem] overflow-hidden">
                  <img
                    src="/Images/Inicio_Biografia.jpg"
                    alt="Ms. Ámbar"
                    className="object-cover w-full h-full grayscale group-hover:grayscale-0 scale-100 group-hover:scale-105 transition-all duration-700 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#06070b]/60 via-transparent to-transparent opacity-60" />
                </div>
              </div>

              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-amber-honey/30 group-hover:border-amber-honey transition-colors duration-500 rounded-tl-[2rem]" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-amber-honey/30 group-hover:border-amber-honey transition-colors duration-500 rounded-br-[2rem]" />
            </motion.div>

            {/* Right Column: Typography & Story */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="lg:col-span-7 space-y-8"
            >
              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-honey flex items-center gap-2">
                  <Sparkles size={10} className="animate-pulse" /> La Cantautora
                </span>
                <h3 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-[#F4F6F0]">
                  Ms. Ambar
                </h3>
                <div className="w-16 h-[2px] bg-gradient-to-r from-amber-honey to-transparent" />
              </div>

              <div className="space-y-6 text-[#F4F6F0]/85 text-sm md:text-base font-medium leading-relaxed font-sans">
                <p>
                  Ms. Ambar, nombre artístico de la cantautora originaria de Hermosillo, Sonora, es una figura destacada en la música latina por su fusión de géneros como <span className="text-[#F4F6F0] font-bold">R&B, soul, regional mexicano y bachata</span>. Su carrera profesional comenzó en 2017 con la banda <span className="text-white/90">"Moonset"</span>, pero consolidó su relevancia al unirse a la gira del rapero mexicano <span className="text-amber-honey font-bold">Charles Ans</span> en 2019, actuando como telonera en grandes escenarios como el <span className="text-white/90">Auditorio Nacional</span>.
                </p>
                <p>
                  Su primer álbum formal, <span className="text-amber-honey font-semibold font-serif italic text-base">"14•28"</span>, fue lanzado en octubre de 2024; el título hace referencia a la numerología y a fechas significativas, como el 14 de junio, día en que falleció su padre cuando ella tenía cinco años. A través de su música, busca conectar emocionalmente con el público compartiendo historias autobiográficas y reflexiones sobre la vida, la muerte y las memorias.
                </p>
                <p>
                  Un hito reciente en su trayectoria fue su selección para representar a México en la categoría folclórica del <span className="text-[#F4F6F0] font-bold">Festival de Viña del Mar 2025</span>, con la canción <span className="text-amber-honey font-bold">"No te voy a llorar"</span>, consolidándose como una de las artistas más prometedoras de la nueva generación musical mexicana.
                </p>
              </div>

              <div className="pt-4 flex flex-wrap gap-6 items-center">
                <Link
                  href="/tour"
                  className="px-6 py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.25em] bg-white/5 border border-white/10 hover:border-amber-honey/40 hover:bg-amber-honey/5 hover:text-amber-honey transition-all flex items-center gap-2 text-[#F4F6F0]"
                >
                  Ver Próximos Eventos <ArrowRight size={12} />
                </Link>
                <span className="text-[9px] uppercase tracking-widest text-[#F4F6F0]/40 font-bold">
                  Hermosillo • México
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── NEWSLETTER / CLUB SHOWCASE (Ambar te Escribe) ─── */}
      <section className="py-16 md:py-24 border-t border-white/10 relative overflow-hidden bg-white/[0.02]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-amber-honey/5 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-md mx-auto px-6 text-center space-y-8 relative z-10 bg-[#0c140f] border border-amber-honey/10 p-12 md:p-14 rounded-[3rem] shadow-[0_0_50px_rgba(30,43,34,0.25)]">
          <div className="space-y-3">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-honey">Esto es solo para los reales</span>
            <h3 className="text-4xl md:text-5xl font-serif text-white tracking-tight italic font-normal leading-tight">Ambar te escribe</h3>
            <p className="text-white/60 text-xs max-w-sm mx-auto leading-relaxed">
              Deja tu nombre y correo aquí para recibir el newsletter escrito por Ms. Ambar, en donde te contará ideas hechas canciones, fechas próximas de presentaciones o noticias exclusivas.
            </p>
          </div>

          <div className="pt-2">
            <AnimatePresence mode="wait">
              {newsletterStatus === 'success' ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center gap-3 bg-amber-honey/10 border border-amber-honey/20 text-amber-honey p-8 rounded-[2rem] text-center"
                >
                  <div className="w-12 h-12 bg-amber-honey/20 rounded-full flex items-center justify-center text-amber-honey">
                    <CheckCircle size={20} />
                  </div>
                  <h4 className="font-bold uppercase tracking-wider text-[11px] mt-2">¡Suscripción Completada!</h4>
                  <p className="text-[10px] text-white/80 leading-relaxed">
                    Te has unido con éxito a las cartas de Ms Ambar.
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <motion.form
                    key="form"
                    onSubmit={handleSubscribe}
                    className="flex flex-col gap-3 text-left"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Nombre"
                        value={newsletterName}
                        onChange={e => setNewsletterName(e.target.value)}
                        required
                        className="w-full bg-white/5 text-white rounded-xl px-5 py-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-honey/50 transition-all border border-white/10 placeholder:text-white/30"
                        disabled={newsletterStatus === 'submitting'}
                      />
                      <input
                        type="email"
                        placeholder="Dirección de correo electrónico"
                        value={newsletterEmail}
                        onChange={e => {
                          setNewsletterEmail(e.target.value);
                          if (newsletterStatus === 'error') setNewsletterStatus('idle');
                        }}
                        required
                        className="w-full bg-white/5 text-white rounded-xl px-5 py-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-honey/50 transition-all border border-white/10 placeholder:text-white/30"
                        disabled={newsletterStatus === 'submitting'}
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-amber-honey via-amber-gold to-amber-500 hover:from-amber-gold hover:to-amber-500 active:scale-[0.98] text-[#06070b] font-black text-[10px] uppercase tracking-[0.25em] py-[18px] rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_35px_rgba(245,158,11,0.35)] whitespace-nowrap text-center flex items-center justify-center gap-2 hover:scale-[1.02]"
                      disabled={newsletterStatus === 'submitting'}
                    >
                      {newsletterStatus === 'submitting' ? (
                        <span className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                          Procesando...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Suscribirse al Club <Sparkles size={11} className="text-[#06070b] fill-current animate-pulse" />
                        </span>
                      )}
                    </button>

                    <p className="text-[9px] text-white/40 tracking-wider text-center pt-2">
                      Respetamos tu privacidad.
                    </p>
                  </motion.form>

                  {newsletterStatus === 'error' && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-amber-honey text-[9px] font-bold uppercase tracking-widest text-center"
                    >
                      ⚠️ {newsletterErrorMessage}
                    </motion.div>
                  )}
                </div>
              )}
            </AnimatePresence>
          </div>

          <div className="pt-2">
            <Link
              href="/ambar-te-escribe"
              className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F4F6F0]/50 hover:text-amber-honey transition-colors"
            >
              Acceder al club<ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;