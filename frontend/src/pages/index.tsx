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

  const getSynergyMessage = (c0: TarotCard, c1: TarotCard, c2: TarotCard) => {
    return `Tu lectura trina revela una sintonía profunda y de alta vibración para tu viaje. La raíz de tu camino parte de ${c0.name} (${c0.vibe.toLowerCase()}), sembrando una semilla de poder y sabiduría en tu ser. En el presente, ${c1.name} te invita a transitar con la energía de "${c1.song}", recordándote fluir con el compás de las frecuencias del desierto de Sonora. Finalmente, tu destino se proyecta hacia ${c2.name}, abriendo un portal de manifestación donde el universo y la energía terrestre conspiran a tu favor. Camina con confianza, la sintonía del cosmos está en perfecta armonía con tu ser.`;
  };
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

      const oscs = chordFreqs.map((freq, index) => {
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
          return osc;
        }

        if (useTremolo) {
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
        return osc;
      });

      setTimeout(() => {
        try {
          ctx.close();
        } catch (e) {}
      }, 2800);
      
    } catch (err) {
      console.error('Local AudioContext chord play failed:', err);
    }
  };

  const drawTarotCard = (slotIndex: number) => {
    if (flippedSlots[slotIndex] || isShuffling) return;

    // Get list of currently drawn card ids
    const drawnIds = Object.values(drawnCards)
      .filter((c): c is TarotCard => c !== null)
      .map(c => c.id);

    // Filter available cards
    const availableCards = TAROT_CARDS.filter(c => !drawnIds.includes(c.id));
    if (availableCards.length === 0) return;

    const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];

    setDrawnCards(prev => ({ ...prev, [slotIndex]: randomCard }));
    setFlippedSlots(prev => ({ ...prev, [slotIndex]: true }));
    setMorphTarget(randomCard.morphTarget);
    playTarotChord(randomCard);

    // Reset morph target back to 'none' after 4 seconds
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
    if (morphTimeoutRef.current) {
      clearTimeout(morphTimeoutRef.current);
    }
    
    setTimeout(() => {
      setFlippedSlots({ 0: false, 1: false, 2: false });
      setDrawnCards({ 0: null, 1: null, 2: null });
      setIsShuffling(false);
    }, 600);
  };
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
      if (morphTimeoutRef.current) {
        clearTimeout(morphTimeoutRef.current);
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
      <section className="relative min-h-[95vh] flex flex-col justify-center items-center px-6 py-24 md:py-32 overflow-hidden">
        {/* Interactive canvas background */}
        <CanvasParticles morphTarget={morphTarget} />

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

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="text-white/40 text-[10px] md:text-xs uppercase tracking-[0.2em] max-w-3xl mx-auto leading-relaxed"
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

        {/* Tarot Cards Deck Section nested directly in Hero below buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="w-full max-w-5xl mt-20 z-10 px-4"
        >
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-6">
            <div className="flex items-center justify-center gap-2 bg-amber-honey/5 border border-amber-honey/20 px-4 py-2 rounded-full w-fit mx-auto">
              <Sparkles size={10} className="text-amber-honey animate-pulse" />
              <span className="text-[8px] font-black uppercase tracking-[0.25em] text-amber-honey">Sintonización Diaria & Oráculo Sensorial</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-glow text-gradient bg-gradient-to-r from-amber-300 via-amber-honey to-amber-600 bg-clip-text text-transparent">
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
                  <div key={slotIndex} className="flex flex-col items-center gap-4">
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
                      className={`tarot-card-inner h-full w-full ${isFlipped ? 'tarot-card-flipped' : ''}`}
                    >
                      {/* Back Side */}
                      <div className="tarot-card-back bg-[#08090f] border border-amber-honey/20 flex flex-col items-center justify-center p-6 shadow-2xl hover:border-amber-honey/50 transition-colors">
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
                      <div className="tarot-card-front bg-gradient-to-b from-[#0b0d17] to-[#040509] border border-amber-honey/30 p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden">
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
                  className="w-full max-w-4xl bg-white/[0.01] border border-white/5 rounded-[2rem] p-8 md:p-10 backdrop-blur-md space-y-6 relative overflow-hidden mt-6"
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

                  {/* Synergy Message if all 3 cards are drawn */}
                  {drawnCards[0] && drawnCards[1] && drawnCards[2] && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 }}
                      className="mt-6 p-6 rounded-2xl bg-amber-honey/[0.03] border border-amber-honey/20 space-y-3"
                    >
                      <div className="flex items-center gap-2 text-amber-honey">
                        <Sparkles size={14} className="animate-pulse" />
                        <h4 className="text-xs font-black uppercase tracking-[0.2em]">Sintonía de Viaje Sincronizada</h4>
                      </div>
                      <p className="text-[11px] md:text-xs text-white/80 leading-relaxed">
                        {getSynergyMessage(drawnCards[0], drawnCards[1], drawnCards[2])}
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
        </motion.div>
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
                    { id: 'sine', label: 'Vientos del Desierto' },
                    { id: 'matrix', label: 'Cúmulos Estelares' },
                    { id: 'orbital', label: 'Alineación de Arcanos' }
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
