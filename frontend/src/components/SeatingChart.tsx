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
  sides?: number;
}

interface SeatingChartProps {
  seats: Seat[];
  onSeatSelect?: (seat: Seat) => void;
  theme?: 'light' | 'dark';
  elements?: MapElement[];
  isDesignMode?: boolean;
  onUpdate?: (seats: Seat[], elements: MapElement[]) => void;
  onSelect?: (ids: string[]) => void;
  selectedIds?: string[];
}

const SeatingChart: React.FC<SeatingChartProps> = ({ 
  seats: initialSeats, 
  onSeatSelect, 
  theme = 'dark', 
  elements: initialElements = [],
  isDesignMode = false,
  onUpdate,
  onSelect,
  selectedIds: externalSelectedIds = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [seats, setSeats] = useState<Seat[]>(initialSeats);
  const [elements, setElements] = useState<MapElement[]>(initialElements);
  const [selectedIds, setSelectedIds] = useState<string[]>(externalSelectedIds);
  const [selectionRect, setSelectionRect] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const [draggedItem, setDraggedItem] = useState<{
    type: 'seat' | 'element', 
    id: string | number,
    offsetX: number,
    offsetY: number,
    handle?: 'br',
    groupSnapshot?: Map<string, {x: number, y: number}>
  } | null>(null);

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.8 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => { setSeats(initialSeats); }, [initialSeats]);
  useEffect(() => { setElements(initialElements); }, [initialElements]);
  useEffect(() => { setSelectedIds(externalSelectedIds); }, [externalSelectedIds]);

  // --- Rendering Engine ---
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

      // 1. Draw Elements
      elements.forEach(el => {
        ctx.save();
        ctx.translate(el.x, el.y);
        ctx.rotate((el.angle || 0) * Math.PI / 180);
        const isSelected = selectedIds.includes(el.id);

        ctx.fillStyle = el.color || (theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)');
        ctx.strokeStyle = isSelected ? '#FFBF00' : (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)');
        ctx.lineWidth = isSelected ? 3 : 1;
        
        const sides = el.sides ?? 4;
        if (sides === 0) {
          ctx.beginPath(); ctx.arc(0, 0, el.w!/2, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        } else if (sides > 4) {
          ctx.beginPath();
          for(let i=0; i<sides; i++) {
            const ang = (i * (360/sides)) * Math.PI/180;
            ctx.lineTo(Math.cos(ang)*el.w!/2, Math.sin(ang)*el.w!/2);
          }
          ctx.closePath(); ctx.fill(); ctx.stroke();
        } else {
          // Rounded Rect
          const w = el.w!, h = el.h!, r = 8;
          ctx.beginPath();
          ctx.moveTo(-w/2+r, -h/2); ctx.arcTo(w/2, -h/2, w/2, h/2, r); ctx.arcTo(w/2, h/2, -w/2, h/2, r);
          ctx.arcTo(-w/2, h/2, -w/2, -h/2, r); ctx.arcTo(-w/2, -h/2, w/2, -h/2, r);
          ctx.fill(); ctx.stroke();
        }

        if (isSelected && isDesignMode) {
           ctx.strokeStyle = '#FFBF00'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
           ctx.strokeRect(-el.w!/2 - 4, -el.h!/2 - 4, el.w! + 8, el.h! + 8); ctx.setLineDash([]);
           ctx.fillStyle = '#FFBF00'; ctx.fillRect(el.w!/2 - 4, el.h!/2 - 4, 8, 8);
        }
        if (el.label) {
          ctx.font = '800 12px Outfit'; ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
          ctx.textAlign = 'center'; ctx.fillText(el.label.toUpperCase(), 0, 5);
        }
        ctx.restore();
      });

      // 2. Draw Seats
      seats.forEach(seat => {
        ctx.save();
        ctx.translate(seat.x, seat.y);
        ctx.rotate((seat.angle || 0) * Math.PI / 180);
        const isSelected = selectedIds.includes(seat.id.toString());
        
        let color = isSelected ? '#FFBF00' : (theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(28, 33, 48, 0.1)');
        let borderColor = isSelected ? '#FFBF00' : (theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(28, 33, 48, 0.3)');
        
        if (isSelected) { ctx.shadowBlur = 10; ctx.shadowColor = '#FFBF00'; }
        
        ctx.fillStyle = color; ctx.strokeStyle = borderColor; ctx.lineWidth = 1.5;
        // Simple Square for seat
        ctx.beginPath();
        const r = 4; const w = 18, h = 18;
        ctx.moveTo(-9+r, -9); ctx.arcTo(9, -9, 9, 9, r); ctx.arcTo(9, 9, -9, 9, r);
        ctx.arcTo(-9, 9, -9, -9, r); ctx.arcTo(-9, -9, 9, -9, r);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      });

      // 3. Selection Rect (Marquee)
      if (selectionRect) {
        ctx.fillStyle = 'rgba(255, 191, 0, 0.15)';
        ctx.strokeStyle = '#FFBF00';
        ctx.lineWidth = 1;
        ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
        ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
      }

      ctx.restore();
    };

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);
    render();
  }, [seats, elements, transform, theme, selectedIds, selectionRect]);

  // --- Interaction Logic ---
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - transform.x) / transform.scale;
    const y = (e.clientY - rect.top - transform.y) / transform.scale;

    if (isDesignMode) {
      // 1. Resize Handle
      if (selectedIds.length === 1) {
        const el = elements.find(e => e.id === selectedIds[0]);
        if (el && Math.abs(el.x + el.w!/2 - x) < 15 && Math.abs(el.y + el.h!/2 - y) < 15) {
          setDraggedItem({ type: 'element', id: el.id, offsetX: 0, offsetY: 0, handle: 'br' });
          return;
        }
      }

      // 2. Hit detection for objects
      const hitEl = [...elements].reverse().find(el => Math.abs(el.x - x) < (el.w || 20)/2 && Math.abs(el.y - y) < (el.h || 20)/2);
      const hitSeat = [...seats].reverse().find(s => Math.abs(s.x - x) < 15 && Math.abs(s.y - y) < 15);
      const hit = hitSeat || hitEl;

      if (hit) {
        const id = hit.id.toString();
        let newSelection = selectedIds;
        if (!selectedIds.includes(id)) {
          newSelection = e.shiftKey ? [...selectedIds, id] : [id];
          setSelectedIds(newSelection);
          onSelect?.(newSelection);
        }

        // Prepare Group Drag Snapshot
        const snapshot = new Map();
        newSelection.forEach(sid => {
          const s = seats.find(st => st.id.toString() === sid);
          const e = elements.find(el => el.id === sid);
          if (s) snapshot.set(sid, { x: s.x, y: s.y });
          if (e) snapshot.set(sid, { x: e.x, y: e.y });
        });

        setDraggedItem({ 
          type: hitSeat ? 'seat' : 'element', 
          id: id, 
          offsetX: hit.x - x, 
          offsetY: hit.y - y,
          groupSnapshot: snapshot
        });
        return;
      }

      // 3. Empty Area -> Start Marquee
      if (!e.shiftKey) { setSelectedIds([]); onSelect?.([]); }
      setSelectionRect({ x, y, w: 0, h: 0 });
      setLastMousePos({ x, y }); // Store start canvas pos
      return;
    }

    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - transform.x) / transform.scale;
    const y = (e.clientY - rect.top - transform.y) / transform.scale;

    if (selectionRect) {
      setSelectionRect(prev => ({ ...prev!, w: x - prev!.x, h: y - prev!.y }));
      return;
    }

    if (draggedItem) {
      if (draggedItem.handle === 'br') {
        setElements(prev => prev.map(el => el.id === draggedItem.id ? { ...el, w: Math.max(20, (x - el.x)*2), h: Math.max(20, (y - el.y)*2) } : el));
      } else if (draggedItem.groupSnapshot) {
        // Move entire group
        const dx = x - (draggedItem.groupSnapshot.get(draggedItem.id.toString())!.x - draggedItem.offsetX);
        const dy = y - (draggedItem.groupSnapshot.get(draggedItem.id.toString())!.y - draggedItem.offsetY);
        
        setSeats(prev => prev.map(s => {
          const snap = draggedItem.groupSnapshot!.get(s.id.toString());
          return snap ? { ...s, x: snap.x + dx, y: snap.y + dy } : s;
        }));
        setElements(prev => prev.map(el => {
          const snap = draggedItem.groupSnapshot!.get(el.id);
          return snap ? { ...el, x: snap.x + dx, y: snap.y + dy } : el;
        }));
      }
      return;
    }

    if (isDragging) {
      setTransform(prev => ({ ...prev, x: prev.x + (e.clientX - lastMousePos.x), y: prev.y + (e.clientY - lastMousePos.y) }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    if (selectionRect) {
      const x1 = Math.min(selectionRect.x, selectionRect.x + selectionRect.w);
      const x2 = Math.max(selectionRect.x, selectionRect.x + selectionRect.w);
      const y1 = Math.min(selectionRect.y, selectionRect.y + selectionRect.h);
      const y2 = Math.max(selectionRect.y, selectionRect.y + selectionRect.h);

      const inSeats = seats.filter(s => s.x >= x1 && s.x <= x2 && s.y >= y1 && s.y <= y2).map(s => s.id.toString());
      const inEls = elements.filter(el => el.x >= x1 && el.x <= x2 && el.y >= y1 && el.y <= y2).map(el => el.id);
      
      const newSelection = [...inSeats, ...inEls];
      setSelectedIds(newSelection);
      onSelect?.(newSelection);
      setSelectionRect(null);
    }
    setIsDragging(false);
    if (draggedItem && onUpdate) onUpdate(seats, elements);
    setDraggedItem(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({ ...prev, scale: Math.max(0.05, Math.min(prev.scale * factor, 5)) }));
  };

  return (
    <div ref={containerRef} className="w-full h-full relative cursor-crosshair bg-[#0b0d17] overflow-hidden">
      <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onWheel={handleWheel} className="w-full h-full block" />
      <div className="absolute bottom-6 right-6 px-4 py-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest opacity-50">Zoom: {Math.round(transform.scale * 100)}%</div>
    </div>
  );
};

export default SeatingChart;
