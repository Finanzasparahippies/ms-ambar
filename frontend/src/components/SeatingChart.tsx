import React, { useRef, useEffect, useState, useMemo } from 'react';
import { cn } from '../lib/utils';

interface Seat {
  id: number;
  row: string;
  number: number;
  status: 'available' | 'occupied' | 'selected';
  category: string;
  section: string;
  x: number;
  y: number;
  angle: number;
}

interface SeatingChartProps {
  seats: Seat[];
  onSeatSelect: (seat: Seat) => void;
  theme?: 'light' | 'dark';
}

const SeatingChart: React.FC<SeatingChartProps> = ({ seats, onSeatSelect, theme = 'dark' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Transform state (Pan & Zoom)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [hoveredSeatId, setHoveredSeatId] = useState<number | null>(null);

  // Initialize view to center seats
  useEffect(() => {
    if (seats.length > 0 && containerRef.current) {
      const allX = seats.map(s => s.x);
      const allY = seats.map(s => s.y);
      const minX = Math.min(...allX);
      const maxX = Math.max(...allX);
      const minY = Math.min(...allY);
      const maxY = Math.max(...allY);
      
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      
      const width = maxX - minX + 200;
      const height = maxY - minY + 200;
      
      const container = containerRef.current;
      const scale = Math.min(container.clientWidth / width, container.clientHeight / height, 1);
      
      setTransform({
        x: container.clientWidth / 2 - centerX * scale,
        y: container.clientHeight / 2 - centerY * scale,
        scale: scale
      });
    }
  }, [seats.length]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Prevent default scroll when zooming
    const preventDefault = (e: WheelEvent) => {
      e.preventDefault();
    };
    canvas.addEventListener('wheel', preventDefault, { passive: false });

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle High DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.scale, transform.scale);

      // 1. Draw Stage (Static Position)
      drawStage(ctx);

      // 2. Draw Seats
      seats.forEach(seat => {
        drawSeat(ctx, seat, hoveredSeatId === seat.id);
      });

      ctx.restore();
    };

    render();

    return () => {
      canvas.removeEventListener('wheel', preventDefault);
    };
  }, [seats, transform, hoveredSeatId]);

  const drawStage = (ctx: CanvasRenderingContext2D) => {
    const stageWidth = 600;
    const stageHeight = 12;
    ctx.save();
    
    // Stage Glow - Amber Honey
    const gradient = ctx.createLinearGradient(500 - stageWidth/2, 0, 500 + stageWidth/2, 0);
    gradient.addColorStop(0, 'rgba(255, 191, 0, 0)');
    gradient.addColorStop(0.5, 'rgba(255, 191, 0, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 191, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#FFBF00';
    ctx.fillRect(500 - stageWidth/2, 50, stageWidth, stageHeight);
    
    ctx.font = '800 14px Outfit';
    ctx.fillStyle = theme === 'dark' ? 'rgba(255, 191, 0, 0.4)' : 'rgba(28, 33, 48, 0.4)';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '4px';
    ctx.fillText('ESCENARIO PRINCIPAL', 500, 35);
    ctx.restore();
  };

  const drawSeat = (ctx: CanvasRenderingContext2D, seat: Seat, isHovered: boolean) => {
    const size = 18;
    ctx.save();
    ctx.translate(seat.x, seat.y);
    ctx.rotate((seat.angle * Math.PI) / 180);

    // Styling based on status - Using new palette
    let color = theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(28, 33, 48, 0.1)'; 
    let borderColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(28, 33, 48, 0.3)';
    let textColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(28, 33, 48, 0.7)';

    if (seat.status === 'occupied') {
       color = theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(28, 33, 48, 0.05)';
       borderColor = 'transparent';
       ctx.globalAlpha = 0.3;
    } else if (seat.status === 'selected') {
       color = '#FFBF00';
       borderColor = '#FFBF00';
       textColor = '#0B0D17';
    } else {
       // Category-based colors (Earthy & Nature)
       if (seat.category === 'vip') {
          color = 'rgba(255, 191, 0, 0.1)'; // Subtle Amber
          borderColor = 'rgba(255, 191, 0, 0.5)';
          textColor = theme === 'dark' ? '#FFBF00' : '#B8860B';
       } else if (seat.category === 'general_a') {
          color = 'rgba(34, 166, 179, 0.1)'; // Sky
          borderColor = 'rgba(34, 166, 179, 0.5)';
          textColor = '#22A6B3';
       } else if (seat.category === 'general_b') {
          color = 'rgba(139, 69, 19, 0.08)'; // Earth/Brown
          borderColor = 'rgba(139, 69, 19, 0.4)';
          textColor = '#8B4513';
       }
    }

    if (isHovered && seat.status !== 'occupied') {
       ctx.scale(1.25, 1.25);
       if (seat.status !== 'selected') {
         borderColor = '#FFBF00';
         ctx.shadowBlur = 15;
         ctx.shadowColor = '#FFBF00';
       }
    }

    // Draw Seat Rect
    ctx.fillStyle = color;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    
    const r = 5;
    ctx.beginPath();
    ctx.roundRect(-size/2, -size/2, size, size, r);
    ctx.fill();
    ctx.stroke();

    // Seat Number
    ctx.font = 'bold 9px Outfit';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(seat.number.toString(), 0, 0);

    ctx.restore();
  };

  // Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }

    // Hit Testing for hover
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = (e.clientX - rect.left - transform.x) / transform.scale;
    const mouseY = (e.clientY - rect.top - transform.y) / transform.scale;
    
    const hitSeat = seats.find(s => {
      const dx = s.x - mouseX;
      const dy = s.y - mouseY;
      return Math.sqrt(dx*dx + dy*dy) < 12; // 12px radius hit test
    });

    setHoveredSeatId(hitSeat?.id || null);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);
    
    // Handle Click (only if not dragging much)
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = (e.clientX - rect.left - transform.x) / transform.scale;
    const mouseY = (e.clientY - rect.top - transform.y) / transform.scale;
    
    const hitSeat = seats.find(s => {
      const dx = s.x - mouseX;
      const dy = s.y - mouseY;
      return Math.sqrt(dx*dx + dy*dy) < 12;
    });

    if (hitSeat && hitSeat.status !== 'occupied') {
      onSeatSelect(hitSeat);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.1, Math.min(transform.scale * factor, 5));
    
    // Zoom toward mouse position
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
    const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale);

    setTransform({ x: newX, y: newY, scale: newScale });
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-[750px] amber-glass rounded-[4rem] relative overflow-hidden group cursor-grab active:cursor-grabbing border-2"
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full"
      />

      {/* UI Overlays */}
      <div className="absolute bottom-10 right-10 flex flex-col gap-4">
        <div className="bg-white/5 backdrop-blur-xl px-8 py-5 rounded-[2rem] border border-white/10 flex gap-10 items-center shadow-2xl">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-black text-amber-honey">{Math.round(transform.scale * 100)}%</span>
              <span className="text-[8px] font-bold opacity-40 uppercase tracking-widest">Zoom</span>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-black text-amber-honey">{seats.length.toLocaleString()}</span>
              <span className="text-[8px] font-bold opacity-40 uppercase tracking-widest">Butacas</span>
            </div>
        </div>
      </div>

      <div className="absolute top-10 left-10 pointer-events-none">
        <div className="px-6 py-3 bg-amber-honey text-nature-night rounded-2xl shadow-xl shadow-amber-honey/20">
           <p className="text-[10px] font-black uppercase tracking-[0.2em]">Selección Interactiva</p>
        </div>
      </div>
    </div>
  );
};

export default SeatingChart;
