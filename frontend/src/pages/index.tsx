import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ticket, ArrowRight, Sparkles, ChevronRight, Play, Check
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
          const upcoming = res.data
            .filter((e: any) => e.is_active !== false)
            .map((e: any) => ({ ...e, dateObj: new Date(e.date) }))
            .filter((e: any) => e.dateObj >= now)
            .sort((a: any, b: any) => a.dateObj.getTime() - b.dateObj.getTime());

          if (upcoming.length > 0) {
            setNextEvent(upcoming[0]);
          } else {
            const activeEvents = res.data.filter((e: any) => e.is_active !== false);
            if (activeEvents.length > 0) {
              setNextEvent(activeEvents[0]);
            }
          }
        }
      })
      .catch(err => console.error("Error fetching next event:", err));
  }, []);

  const getFormattedEventDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      const formatted = d.toLocaleDateString('es-MX', options);
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return "Oct 24";
    }
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
    <div className="selection:bg-amber-honey/30 overflow-x-hidden font-outfit text-nature-night">
      <Head>
        <title>Ms Ambar | Esencia Artística y Experiencia de Sonidos</title>
        <meta name="description" content="MS Ambar - Una fusión vanguardista de música, arte digital y escenografía de alta gama. Adquiere boletos oficiales y reserva experiencias exclusivas." />
      </Head>

      {/* ─── HERO SECTION (NECTAR LABS STYLE) ─── */}
      <section className="relative min-h-[95vh] flex flex-col justify-center items-center px-6 py-24 md:py-32 overflow-hidden">
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
                ? `Tour Oficial 2026 • Próximo Show: ${nextEvent.title} (${getFormattedEventDate(nextEvent.date)})`
                : "Tour Oficial 2026 • Próximo Show Oct 24"
              }
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-6xl md:text-9xl font-black tracking-tight leading-tight italic text-glow px-4 md:px-8 py-2 md:py-4"
          >
            Ms <span className="text-gradient bg-gradient-to-r from-amber-300 via-amber-honey to-amber-600 bg-clip-text text-transparent px-2">Ambar</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-nature-night/70 text-xs md:text-sm uppercase tracking-[0.4em] max-w-2xl mx-auto leading-relaxed"
          >
            La fusión vanguardista de arte lumínico, diseño acústico premium y expresión escénica digital.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="text-nature-night/50 text-[10px] md:text-xs uppercase tracking-[0.2em] max-w-3xl mx-auto leading-relaxed"
          >
            Ms Ambar  desierto de Sonora. Frecuencias cósmicas, blues hipnótico, líricas del cosmos y activismo terrestre junto a Tierra Viva.
          </motion.p>

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
            <Link
              href="/contacto"
              className="px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] border border-nature-night/20 text-nature-night hover:border-amber-honey/40 hover:bg-amber-honey/5 transition-all flex items-center gap-3"
            >
              Contacto <ArrowRight size={14} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ─── LIVE MUSIC RELEASES SHOWCASE ─── */}
      <section className="py-32 border-y border-nature-night/10 bg-nature-night/[0.02] relative">
        <div className="max-w-[1600px] mx-auto px-6 md:px-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-honey">Lanzamientos Recientes</span>
              <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tight mt-2">Música & Producción</h3>
            </div>
            <Link href="/musica" className="text-xs font-bold uppercase tracking-widest text-nature-night/50 hover:text-amber-honey transition-colors flex items-center gap-2 mt-4 md:mt-0">
              Escuchar Discografía Completa <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Eclipse', desc: 'LP Álbum de Estudio • 2026', img: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&q=80' },
              { title: 'Ambar Vision', desc: 'LP Álbum de Estudio • 2024', img: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&q=80' },
              { title: 'Desierto de Cristal', desc: 'LP Álbum de Estudio • 2023', img: 'https://images.unsplash.com/photo-1514525253361-bee8a48790c3?w=500&q=80' }
            ].map((track, i) => (
              <div key={i} className="group relative rounded-[2.5rem] border border-nature-night/10 bg-nature-night/[0.01] hover:border-amber-honey/20 transition-all">
                <div className="relative aspect-square rounded-[2rem] overflow-hidden mb-6 border border-nature-night/10">
                  <img src={track.img} alt={track.title} className="object-cover w-full h-full grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Link href="/musica" className="w-16 h-16 rounded-full bg-amber-honey text-black flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                      <Play size={24} className="fill-current ml-1" />
                    </Link>
                  </div>
                </div>
                <div className="px-2 space-y-1">
                  <h4 className="font-black uppercase text-sm text-nature-night group-hover:text-amber-honey transition-colors">{track.title}</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-nature-night/50">{track.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── NEWSLETTER / CLUB SHOWCASE (Ambar te Escribe) ─── */}
      <section className="py-32 border-t border-nature-night/10 relative overflow-hidden bg-nature-night/[0.02]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-amber-honey/5 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-md mx-auto px-6 text-center space-y-8 relative z-10 bg-forest-green border border-amber-honey/10 p-12 md:p-14 rounded-[3rem] shadow-[0_0_50px_rgba(30,43,34,0.25)]">
          <div className="space-y-3">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-honey">Boletín Oficial</span>
            <h3 className="text-4xl md:text-5xl font-serif text-white tracking-tight italic font-normal leading-tight">Ambar te escribe</h3>
            <p className="text-white/60 text-xs max-w-sm mx-auto leading-relaxed">
              Regístrate con tu nombre y correo electrónico para recibir crónicas, novedades y preventas exclusivas.
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
                    <Check size={20} />
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
                        className="w-full bg-white text-black rounded-xl px-5 py-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-honey/50 transition-all border border-neutral-200 placeholder:text-neutral-400"
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
                        className="w-full bg-white text-black rounded-xl px-5 py-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-honey/50 transition-all border border-neutral-200 placeholder:text-neutral-400"
                        disabled={newsletterStatus === 'submitting'}
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-amber-honey via-amber-gold to-amber-500 hover:from-amber-gold hover:to-amber-500 active:scale-[0.98] text-[#1E2B22] font-black text-[10px] uppercase tracking-[0.25em] py-[18px] rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_35px_rgba(245,158,11,0.35)] whitespace-nowrap text-center flex items-center justify-center gap-2 hover:scale-[1.02]"
                      disabled={newsletterStatus === 'submitting'}
                    >
                      {newsletterStatus === 'submitting' ? (
                        <span className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 border-2 border-[#1E2B22]/20 border-t-[#1E2B22] rounded-full animate-spin" />
                          Procesando...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Suscribirse a las Cartas <Sparkles size={11} className="text-[#1E2B22] fill-current animate-pulse" />
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
              className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-nature-night/50 hover:text-amber-honey transition-colors"
            >
              Leer las Cartas <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
