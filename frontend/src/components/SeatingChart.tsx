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
}

const SeatingChart: React.FC<SeatingChartProps> = ({ seats, onSeatSelect }) => {
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
  }, [seats, transform, hoveredSeatId]);

  const drawStage = (ctx: CanvasRenderingContext2D) => {
    const stageWidth = 600;
    const stageHeight = 10;
    ctx.save();
    
    // Stage Glow
    const gradient = ctx.createLinearGradient(500 - stageWidth/2, 0, 500 + stageWidth/2, 0);
    gradient.addColorStop(0, 'rgba(245, 158, 11, 0)');
    gradient.addColorStop(0.5, 'rgba(245, 158, 11, 0.8)');
    gradient.addColorStop(1, 'rgba(245, 158, 11, 0)');
    
    ctx.fillStyle = gradient;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#f59e0b';
    ctx.fillRect(500 - stageWidth/2, 50, stageWidth, stageHeight);
    
    ctx.font = 'bold 12px Inter';
    ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.textAlign = 'center';
    ctx.fillText('ESCENARIO PRINCIPAL', 500, 40);
    ctx.restore();
  };

  const drawSeat = (ctx: CanvasRenderingContext2D, seat: Seat, isHovered: boolean) => {
    const size = 18;
    ctx.save();
    ctx.translate(seat.x, seat.y);
    ctx.rotate((seat.angle * Math.PI) / 180);

    // Styling based on status
    let color = '#262626'; // Default (standard available)
    let borderColor = '#404040';
    let textColor = '#525252';

    if (seat.status === 'occupied') {
       color = '#171717';
       borderColor = '#262626';
       ctx.globalAlpha = 0.5;
    } else if (seat.status === 'selected') {
       color = '#ffffff';
       borderColor = '#ffffff';
       textColor = '#000000';
    } else if (seat.category === 'vip') {
       color = 'rgba(245, 158, 11, 0.1)';
       borderColor = 'rgba(245, 158, 11, 0.5)';
       textColor = '#f59e0b';
    }

    if (isHovered && seat.status !== 'occupied') {
       ctx.scale(1.2, 1.2);
       if (seat.status !== 'selected') borderColor = '#f59e0b';
    }

    // Draw Seat Rect
    ctx.fillStyle = color;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    
    // Rounded Rect Path
    const r = 4;
    ctx.beginPath();
    ctx.roundRect(-size/2, -size/2, size, size, r);
    ctx.fill();
    ctx.stroke();

    // Seat Number
    ctx.font = '9px Inter';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(seat.number.toString(), 0, 0);

    // VIP Dot
    if (seat.category === 'vip' && seat.status !== 'selected' && seat.status !== 'occupied') {
      ctx.beginPath();
      ctx.arc(0, size/2 - 3, 1, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
    }

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
    e.preventDefault();
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
      className="w-full h-[700px] bg-black rounded-[4rem] border border-neutral-900 relative overflow-hidden group cursor-grab active:cursor-grabbing"
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
      <div className="absolute bottom-8 right-8 flex flex-col gap-4">
        <div className="bg-neutral-900/80 backdrop-blur px-6 py-4 rounded-3xl border border-neutral-800 flex gap-8 items-center">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-black text-white">{Math.round(transform.scale * 100)}%</span>
              <span className="text-[8px] font-bold text-neutral-500">ZOOM</span>
            </div>
            <div className="h-8 w-px bg-neutral-800" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-black text-white">{seats.length.toLocaleString()}</span>
              <span className="text-[8px] font-bold text-neutral-500">ASIENTOS</span>
            </div>
        </div>
      </div>

      <div className="absolute top-8 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="px-6 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full backdrop-blur-sm">
           <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Vista de Estadio Activada</p>
        </div>
      </div>
    </div>
  );
};

export default SeatingChart;
