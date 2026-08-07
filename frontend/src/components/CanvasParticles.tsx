import React, { useEffect, useRef } from 'react';
import { useEventTheme } from '../context/EventThemeContext';

interface CanvasParticlesProps {
  morphTarget?: string;
  className?: string;
}

export const CanvasParticles: React.FC<CanvasParticlesProps> = ({
  morphTarget = 'none',
  className = 'absolute inset-0 w-full h-full pointer-events-none'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useEventTheme();
  const activeTarget = morphTarget !== 'none' ? morphTarget : (theme.particleShape || 'moon');
  const morphTargetRef = useRef(activeTarget);
  const themeRef = useRef(theme);

  useEffect(() => {
    morphTargetRef.current = activeTarget;
    themeRef.current = theme;
  }, [activeTarget, theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number = 0;
    let width = canvas.offsetWidth || window.innerWidth;
    let height = canvas.offsetHeight || window.innerHeight;

    const isTouchDevice = typeof window !== 'undefined' && (
      'ontouchstart' in window || navigator.maxTouchPoints > 0
    );
    const isMobile = width < 768 || isTouchDevice;

    // Device Pixel Ratio capped at 1.25 for mobile/touch, 2 for desktop
    const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const dpr = Math.min(rawDpr, isMobile ? 1.25 : 2);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
    }> = [];

    const baseDensity = theme.particleDensity ?? 65;
    const numParticles = isMobile ? Math.max(10, Math.round(baseDensity * 0.35)) : baseDensity;

    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2.2 + 1,
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
        spiral: [],
        triangle: [],
        polygon: []
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
      const numTrunk = Math.floor(numParticles * 0.45);
      for (let i = 0; i < numTrunk; i++) {
        const pct = i / Math.max(1, numTrunk - 1);
        shapes.cactus.push({
          x: cx,
          y: cy + trunkH * 0.5 - pct * trunkH
        });
      }
      const numLeft = Math.floor(numParticles * 0.27);
      for (let i = 0; i < numLeft; i++) {
        const pct = i / Math.max(1, numLeft - 1);
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
      const numRight = numParticles - numTrunk - numLeft;
      for (let i = 0; i < numRight; i++) {
        const pct = i / Math.max(1, numRight - 1);
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

      // 8. Sun (Sol de Sonora)
      const sunRadius = radius * 0.72;
      const centerCount = Math.floor(numParticles * 0.6);
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
          const rayDist = sunRadius + ((p + 1) / Math.max(1, numPtsInRay)) * (radius * 0.55);
          shapes.sun.push({
            x: cx + Math.cos(angle) * rayDist,
            y: cy + Math.sin(angle) * rayDist
          });
        }
      }

      // 9. Eclipse
      const ringCount = Math.floor(numParticles * 0.6);
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
        const angle = -Math.PI / 2 + (i / Math.max(1, moonCount)) * Math.PI;
        if (i < moonCount * 0.6) {
          shapes.eclipse.push({
            x: cx - shadowOffset + Math.cos(angle) * ringRadius,
            y: cy + Math.sin(angle) * ringRadius
          });
        } else {
          const pct = (i - moonCount * 0.6) / Math.max(1, moonCount * 0.4);
          const innerAngle = -Math.PI / 2 + pct * Math.PI;
          shapes.eclipse.push({
            x: cx - shadowOffset + Math.cos(innerAngle) * (ringRadius * 0.75) + (ringRadius * 0.25),
            y: cy + Math.sin(innerAngle) * (ringRadius * 0.75)
          });
        }
      }

      // 10. Music
      const nHead1X = cx - radius * 0.35;
      const nHead1Y = cy + radius * 0.35;
      const nHead2X = cx + radius * 0.3;
      const nHead2Y = cy + radius * 0.15;
      const stem1TopY = cy - radius * 0.5;
      const stem2TopY = cy - radius * 0.7;
      const beamStartX = nHead1X + radius * 0.15;
      const beamEndX = nHead2X + radius * 0.15;

      const ptsPerPart = Math.max(2, Math.floor(numParticles / 4));
      for (let i = 0; i < ptsPerPart; i++) {
        const angle = (i / ptsPerPart) * Math.PI * 2;
        shapes.music.push({
          x: nHead1X + Math.cos(angle) * (radius * 0.18),
          y: nHead1Y + Math.sin(angle) * (radius * 0.13)
        });
      }
      for (let i = 0; i < ptsPerPart; i++) {
        const angle = (i / ptsPerPart) * Math.PI * 2;
        shapes.music.push({
          x: nHead2X + Math.cos(angle) * (radius * 0.18),
          y: nHead2Y + Math.sin(angle) * (radius * 0.13)
        });
      }
      for (let i = 0; i < ptsPerPart; i++) {
        const pct = i / Math.max(1, ptsPerPart - 1);
        shapes.music.push({
          x: nHead1X + radius * 0.15,
          y: nHead1Y - pct * (nHead1Y - stem1TopY)
        });
      }
      for (let i = 0; shapes.music.length < numParticles; i++) {
        const pct = (i / Math.max(1, ptsPerPart - 1)) % 1;
        shapes.music.push({
          x: beamStartX + pct * (beamEndX - beamStartX),
          y: stem1TopY + pct * (stem2TopY - stem1TopY)
        });
      }

      // 11. Bee
      const bodyRadiusX = radius * 0.22;
      const bodyRadiusY = radius * 0.38;

      for (let i = 0; i < numParticles; i++) {
        const angle = (i / numParticles) * Math.PI * 2;
        shapes.bee.push({
          x: cx + Math.cos(angle) * bodyRadiusX,
          y: cy + Math.sin(angle) * bodyRadiusY
        });
      }

      // 12. Eye
      for (let i = 0; i < numParticles; i++) {
        const t = (i / numParticles) * Math.PI * 2;
        shapes.eye.push({
          x: cx + Math.cos(t) * radius * 0.8,
          y: cy + Math.sin(t) * radius * 0.4
        });
      }

      // 13. Wave
      const waveW = radius * 2.6;
      for (let i = 0; i < numParticles; i++) {
        const pct = i / Math.max(1, numParticles - 1);
        const xVal = cx - waveW * 0.5 + pct * waveW;
        const angle = pct * Math.PI * 4;
        shapes.wave.push({ x: xVal, y: cy + Math.sin(angle) * (radius * 0.25) });
      }

      // 14. Spiral
      for (let i = 0; i < numParticles; i++) {
        const t = (i / Math.max(1, numParticles - 1)) * Math.PI * 5;
        const r = (i / Math.max(1, numParticles - 1)) * radius * 1.25;
        shapes.spiral.push({
          x: cx + Math.cos(t) * r,
          y: cy + Math.sin(t) * r
        });
      }

      // 15. Triangle
      const ptsTri: Array<{ x: number; y: number }> = [];
      for (let k = 0; k < 3; k++) {
        const angle = (k * Math.PI * 2) / 3 - Math.PI / 2;
        ptsTri.push({
          x: cx + Math.cos(angle) * radius * 1.15,
          y: cy + Math.sin(angle) * radius * 1.15
        });
      }
      for (let i = 0; i < numParticles; i++) {
        const side = Math.floor((i / numParticles) * 3) % 3;
        const nextSide = (side + 1) % 3;
        const pct = ((i / numParticles) * 3) % 1;
        shapes.triangle.push({
          x: ptsTri[side].x + (ptsTri[nextSide].x - ptsTri[side].x) * pct,
          y: ptsTri[side].y + (ptsTri[nextSide].y - ptsTri[side].y) * pct
        });
      }

      // 16. Polygon (Pentágono)
      const ptsPoly: Array<{ x: number; y: number }> = [];
      for (let k = 0; k < 5; k++) {
        const angle = (k * Math.PI * 2) / 5 - Math.PI / 2;
        ptsPoly.push({
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius
        });
      }
      for (let i = 0; i < numParticles; i++) {
        const side = Math.floor((i / numParticles) * 5) % 5;
        const nextSide = (side + 1) % 5;
        const pct = ((i / numParticles) * 5) % 1;
        shapes.polygon.push({
          x: ptsPoly[side].x + (ptsPoly[nextSide].x - ptsPoly[side].x) * pct,
          y: ptsPoly[side].y + (ptsPoly[nextSide].y - ptsPoly[side].y) * pct
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

    const handleMouseEnter = () => { mouse.active = true; };
    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.x = -1000;
      mouse.y = -1000;
    };

    const parent = canvas.parentElement;
    if (parent && !isTouchDevice) {
      parent.addEventListener('mousemove', handleMouseMove, { passive: true });
      parent.addEventListener('mouseenter', handleMouseEnter, { passive: true });
      parent.addEventListener('mouseleave', handleMouseLeave, { passive: true });
    }

    let resizeTimeout: any = null;
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (!canvas) return;
        width = canvas.offsetWidth || window.innerWidth;
        height = canvas.offsetHeight || window.innerHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        calculateShapes();
      }, 200);
    };
    window.addEventListener('resize', handleResize, { passive: true });

    let isCanvasVisible = true;
    const observer = new IntersectionObserver(([entry]) => {
      isCanvasVisible = entry.isIntersecting;
      if (isCanvasVisible && !animationFrameId) {
        animationFrameId = requestAnimationFrame(draw);
      }
    }, { threshold: 0.01 });

    observer.observe(canvas);

    const parseRgbNums = (hex: string): [number, number, number] => {
      if (!hex) return [229, 169, 59];
      let clean = hex.replace('#', '');
      if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
      if (clean.length !== 6) return [229, 169, 59];
      const num = parseInt(clean, 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    };

    // Frame rate control: 30 FPS on mobile/touch devices, 60 FPS on desktop
    const targetFps = isMobile ? 30 : 60;
    const frameInterval = 1000 / targetFps;
    let lastFrameTime = performance.now();

    const draw = (currentTime: number = performance.now()) => {
      if (!isCanvasVisible || (typeof document !== 'undefined' && document.hidden)) {
        animationFrameId = 0;
        return;
      }

      animationFrameId = requestAnimationFrame(draw);

      const elapsed = currentTime - lastFrameTime;
      if (elapsed < frameInterval) return;
      lastFrameTime = currentTime - (elapsed % frameInterval);

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const targetMode = morphTargetRef.current;
      const targetShape = targetMode && targetMode !== 'none' ? shapes[targetMode] : null;

      const activeTheme = themeRef.current;
      const particleColorHex = activeTheme.particleColor || activeTheme.primaryColor || '#E5A93B';
      const speedMult = activeTheme.particleSpeed ?? 1.0;

      const [pR, pG, pB] = parseRgbNums(particleColorHex);
      const [sR, sG, sB] = parseRgbNums(activeTheme.secondaryColor || '#22A6B7');

      const fillPrimary = `rgba(${pR}, ${pG}, ${pB}, ${targetShape ? 0.85 : 0.6})`;
      const fillSecondary = `rgba(${sR}, ${sG}, ${sB}, ${targetShape ? 0.85 : 0.5})`;

      // 1. Update positions
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        if (targetShape && targetShape[i]) {
          const target = targetShape[i];
          const jitter = (targetMode === 'hexagon' || targetMode === 'bee') ? (Math.random() - 0.5) * 1.5 : 0;
          p1.x += (target.x + jitter - p1.x) * 0.08 * speedMult;
          p1.y += (target.y + jitter - p1.y) * 0.08 * speedMult;
        } else {
          p1.x += p1.vx * speedMult;
          p1.y += p1.vy * speedMult;
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
      }

      // 2. Optimized Path Batching: Draw primary particles in 1 batch
      ctx.fillStyle = fillPrimary;
      ctx.beginPath();
      for (let i = 0; i < particles.length; i += 2) {
        const p = particles[i];
        ctx.moveTo(p.x + p.size, p.y);
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      }
      ctx.fill();

      // 3. Draw secondary particles in 1 batch
      ctx.fillStyle = fillSecondary;
      ctx.beginPath();
      for (let i = 1; i < particles.length; i += 2) {
        const p = particles[i];
        ctx.moveTo(p.x + p.size, p.y);
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      }
      ctx.fill();

      // 4. Connecting lines (Desktop only)
      if (!isMobile) {
        for (let i = 0; i < particles.length; i++) {
          const p1 = particles[i];
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < 14400) { // 120 * 120
              const dist = Math.sqrt(distSq);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              const baseAlpha = targetShape ? 0.35 : 0.18;
              const alpha = (1 - dist / 120) * baseAlpha;
              ctx.strokeStyle = i % 2 === 0 ? `rgba(${pR}, ${pG}, ${pB}, ${alpha})` : `rgba(${sR}, ${sG}, ${sB}, ${alpha})`;
              ctx.lineWidth = targetShape ? 1.1 : 0.7;
              ctx.stroke();
            }
          }
        }
      }

      ctx.restore();
    };

    draw();

    return () => {
      observer.disconnect();
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = 0;
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      if (parent && !isTouchDevice) {
        parent.removeEventListener('mousemove', handleMouseMove);
        parent.removeEventListener('mouseenter', handleMouseEnter);
        parent.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [theme.particleDensity]);

  return <canvas ref={canvasRef} className={className} />;
};

export default CanvasParticles;
