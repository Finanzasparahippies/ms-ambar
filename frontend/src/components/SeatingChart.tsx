import * as React from 'react';
import { useRef, useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { Settings, Plus, Square, Map as MapIcon, RotateCw, Trash2, Download } from 'lucide-react';

interface Seat {
  id: string | number;
  x: number;
  y: number;
  row: string;
  number: number;
  status: 'available' | 'occupied' | 'selected' | 'reserved';
  category: string;
  angle: number;
}

interface MapElement {
  id: string;
  type: 'rect' | 'icon' | 'text';
  x: number;
  y: number;
  w?: number;
  h?: number;
  label?: string;
  icon?: 'stairs' | 'wc' | 'bar' | 'exit';
  color?: string;
  angle?: number;
}

interface SeatingChartProps {
  seats: Seat[];
  onSeatSelect?: (seat: Seat) => void;
  theme?: 'light' | 'dark';
  elements?: MapElement[];
  isDesignMode?: boolean;
  onUpdate?: (seats: Seat[], elements: MapElement[]) => void;
  onSelect?: (id: string | null) => void;
  selectedId?: string | null;
}

const SeatingChart: React.FC<SeatingChartProps> = ({ 
  seats: initialSeats, 
  onSeatSelect, 
  theme = 'dark', 
  elements: initialElements = [],
  isDesignMode = false,
  onUpdate,
  onSelect,
  selectedId: externalSelectedId
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [seats, setSeats] = useState<Seat[]>(initialSeats);
  const [elements, setElements] = useState<MapElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  
  // Sync internal selectedId with external if provided
  useEffect(() => {
    if (externalSelectedId !== undefined) {
      setSelectedId(externalSelectedId || null);
    }
  }, [externalSelectedId]);

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.8 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [draggedItem, setDraggedItem] = useState<{
    type: 'seat' | 'element', 
    id: string | number,
    offsetX: number,
    offsetY: number,
    handle?: 'br' // Bottom-right resize handle
  } | null>(null);

  useEffect(() => {
    setSeats(initialSeats);
  }, [initialSeats]);

  useEffect(() => {
    setElements(initialElements);
  }, [initialElements]);

  // Canvas Setup & Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.scale, transform.scale);

      // Draw Elements
      elements.forEach(el => drawElement(ctx, el));
      
      // Draw Seats
      seats.forEach(seat => drawSeat(ctx, seat, selectedId === seat.id));

      ctx.restore();
    };

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    render();
  }, [seats, elements, transform, selectedId, theme]);

    const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + width, y, x + width, y + height, radius);
      ctx.arcTo(x + width, y + height, x, y + height, radius);
      ctx.arcTo(x, y + height, x, y, radius);
      ctx.arcTo(x, y, x + width, y, radius);
      ctx.closePath();
    };

    const drawElement = (ctx: CanvasRenderingContext2D, el: MapElement) => {
      ctx.save();
      ctx.translate(el.x, el.y);
      ctx.rotate((el.angle || 0) * Math.PI / 180);
      const isSelected = selectedId === el.id;

      if (el.type === 'rect') {
        ctx.fillStyle = el.color || (theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)');
        ctx.strokeStyle = isSelected ? '#FFBF00' : (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)');
        ctx.lineWidth = isSelected ? 2 : 1;
        
        if (el.label?.toLowerCase().includes('mesa')) {
          // Circular Table
          ctx.beginPath();
          ctx.arc(0, 0, el.w!/2, 0, Math.PI*2);
          ctx.fill();
          ctx.stroke();
        } else if (el.label?.toLowerCase().includes('arbol')) {
          // Organic Tree Shape
          ctx.fillStyle = 'rgba(46, 204, 113, 0.15)';
          ctx.strokeStyle = 'rgba(46, 204, 113, 0.5)';
          ctx.beginPath();
          for(let i=0; i<6; i++) {
            const ang = (i * 60) * Math.PI/180;
            const r = (el.w!/2) * (0.8 + Math.random()*0.4);
            ctx.lineTo(Math.cos(ang)*r, Math.sin(ang)*r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          drawRoundedRect(ctx, -el.w!/2, -el.h!/2, el.w!, el.h!, 8);
          ctx.fill();
          ctx.stroke();
        }

        // Patterns for Esplanades/Gardens
        if (el.label?.toLowerCase().includes('explanada') || el.label?.toLowerCase().includes('jardin')) {
          ctx.save();
          ctx.clip();
          ctx.strokeStyle = el.label.includes('jardin') ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255,255,255,0.03)';
          for(let i=-1000; i<1000; i+=20) {
            ctx.moveTo(i, -1000); ctx.lineTo(i-200, 1000);
          }
          ctx.stroke();
          ctx.restore();
        }

        // Draw Selection Handles
        if (isSelected && isDesignMode) {
           ctx.strokeStyle = '#FFBF00';
           ctx.lineWidth = 1;
           ctx.setLineDash([5, 5]);
           ctx.strokeRect(-el.w!/2 - 4, -el.h!/2 - 4, el.w! + 8, el.h! + 8);
           ctx.setLineDash([]);
           
           // Resize Handle (Bottom-Right)
           ctx.fillStyle = '#FFBF00';
           ctx.fillRect(el.w!/2 - 4, el.h!/2 - 4, 8, 8);
        }
      if (el.label) {
        ctx.font = '800 12px Outfit';
        ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
        ctx.textAlign = 'center';
        ctx.fillText(el.label.toUpperCase(), 0, 5);
      }
    } else if (el.type === 'icon') {
      ctx.strokeStyle = isSelected ? '#FFBF00' : (theme === 'dark' ? '#FFBF00' : '#B8860B');
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (el.icon === 'stairs') {
        for(let i=0; i<3; i++) { ctx.moveTo(-10, 10 - i*8); ctx.lineTo(-10 + i*8, 10 - i*8); ctx.lineTo(-10 + i*8, 10 - (i+1)*8); }
      } else if (el.icon === 'wc') {
        ctx.arc(-5, -5, 5, 0, Math.PI*2); ctx.moveTo(-10, 12); ctx.lineTo(10, 12);
      } else if (el.icon === 'bar') {
        ctx.moveTo(-10, -10); ctx.lineTo(10, -10); ctx.lineTo(0, 10); ctx.closePath();
      }
      ctx.stroke();
      if (el.label) {
        ctx.font = '700 9px Outfit';
        ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.6)';
        ctx.textAlign = 'center';
        ctx.fillText(el.label.toUpperCase(), 0, 25);
      }
    }
    ctx.restore();
  };

  const drawSeat = (ctx: CanvasRenderingContext2D, seat: Seat, isSelected: boolean) => {
    ctx.save();
    ctx.translate(seat.x, seat.y);
    ctx.rotate((seat.angle || 0) * Math.PI / 180);
    
    let color = theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(28, 33, 48, 0.1)'; 
    let borderColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(28, 33, 48, 0.3)';
    
    if (seat.status === 'occupied') {
       color = theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(28, 33, 48, 0.05)';
       borderColor = 'transparent';
    } else if (seat.status === 'selected' || isSelected) {
       color = '#FFBF00';
       borderColor = '#FFBF00';
       if (isSelected) {
         ctx.shadowBlur = 15;
         ctx.shadowColor = '#FFBF00';
       }
    } else {
       const cat = seat.category.toLowerCase();
       if (cat.includes('vip')) { color = 'rgba(255, 191, 0, 0.15)'; borderColor = 'rgba(255, 191, 0, 0.6)'; }
       else if (cat.includes('general_a')) { color = 'rgba(34, 166, 179, 0.15)'; borderColor = 'rgba(34, 166, 179, 0.6)'; }
       else if (cat.includes('general_b')) { color = 'rgba(139, 69, 19, 0.12)'; borderColor = 'rgba(139, 69, 19, 0.5)'; }
    }

    ctx.fillStyle = color;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, -9, -9, 18, 18, 4);
    ctx.fill();
    ctx.stroke();

    if (transform.scale > 1.2) {
      ctx.font = '600 7px Outfit';
      ctx.fillStyle = (seat.status === 'selected' || isSelected) ? '#0B0D17' : (theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.6)');
      ctx.textAlign = 'center';
      ctx.fillText(seat.number.toString(), 0, 3);
    }
    ctx.restore();
  };

  // Interaction Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - transform.x) / transform.scale;
    const y = (e.clientY - rect.top - transform.y) / transform.scale;

    if (isDesignMode) {
      // 1. Check for Resize Handles (only for selected element)
      if (selectedId) {
        const el = elements.find(e => e.id === selectedId);
        if (el && el.type === 'rect') {
          const hx = el.x + el.w!/2;
          const hy = el.y + el.h!/2;
          if (Math.abs(hx - x) < 15 && Math.abs(hy - y) < 15) {
            setDraggedItem({ type: 'element', id: el.id, offsetX: 0, offsetY: 0, handle: 'br' });
            return;
          }
        }
      }

      // 2. Hit detection for elements
      const hitEl = [...elements].reverse().find(el => Math.abs(el.x - x) < (el.w || 20)/2 && Math.abs(el.y - y) < (el.h || 20)/2);
      if (hitEl) {
        onSelect?.(hitEl.id);
        setDraggedItem({ type: 'element', id: hitEl.id, offsetX: hitEl.x - x, offsetY: hitEl.y - y });
        return;
      }
      // 3. Hit detection for seats
      const hitSeat = [...seats].reverse().find(s => Math.abs(s.x - x) < 15 && Math.abs(s.y - y) < 15);
      if (hitSeat) {
        onSelect?.(hitSeat.id);
        setDraggedItem({ type: 'seat', id: hitSeat.id, offsetX: hitSeat.x - x, offsetY: hitSeat.y - y });
        return;
      }
      onSelect?.(null);
    }

    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedItem) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left - transform.x) / transform.scale;
      const y = (e.clientY - rect.top - transform.y) / transform.scale;

      if (draggedItem.handle === 'br') {
        setElements(prev => prev.map(el => {
          if (el.id === draggedItem.id) {
            return { ...el, w: Math.max(20, (x - el.x)*2), h: Math.max(20, (y - el.y)*2) };
          }
          return el;
        }));
      } else if (draggedItem.type === 'seat') {
        setSeats(prev => prev.map(s => s.id === draggedItem.id ? { ...s, x: x + draggedItem.offsetX, y: y + draggedItem.offsetY } : s));
      } else {
        setElements(prev => prev.map(el => el.id === draggedItem.id ? { ...el, x: x + draggedItem.offsetX, y: y + draggedItem.offsetY } : el));
      }
      return;
    }

    if (isDragging) {
      setTransform(prev => ({
        ...prev,
        x: prev.x + (e.clientX - lastMousePos.x),
        y: prev.y + (e.clientY - lastMousePos.y)
      }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (draggedItem && onUpdate) onUpdate(seats, elements);
    setDraggedItem(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventDefault = (e: WheelEvent) => {
      e.preventDefault();
    };

    // Force non-passive wheel listener to allow preventDefault
    canvas.addEventListener('wheel', preventDefault, { passive: false });
    return () => canvas.removeEventListener('wheel', preventDefault);
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.05, Math.min(transform.scale * factor, 5));
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

  return (
    <div ref={containerRef} className="w-full h-full relative cursor-crosshair bg-nature-night/5 dark:bg-black/20 rounded-[3rem] overflow-hidden border border-white/5 shadow-inner">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full block"
      />

      <div className="absolute bottom-6 right-6 flex items-center gap-4">
        <div className="px-4 py-2 bg-nature-night/80 dark:bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-white/60">
          Zoom: {Math.round(transform.scale * 100)}%
        </div>
      </div>
    </div>
  );
};

export default SeatingChart;
