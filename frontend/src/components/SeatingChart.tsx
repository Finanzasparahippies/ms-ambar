import * as React from 'react';
import { useRef, useEffect, useState } from 'react';
import { cn } from '../lib/utils';

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
  theme?: 'light' | 'dark';
  elements?: MapElement[];
  isDesignMode?: boolean;
  onUpdate?: (seats: Seat[], elements: MapElement[]) => void;
  onSelect?: (ids: string[]) => void;
  selectedIds?: string[];
}

const SeatingChart: React.FC<SeatingChartProps> = ({ 
  seats: initialSeats, 
  theme = 'dark', 
  elements: initialElements = [],
  isDesignMode = false,
  onUpdate,
  onSelect,
  selectedIds: externalSelectedIds = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [seats, setSeats] = useState<Seat[]>(initialSeats);
  const [elements, setElements] = useState<MapElement[]>(initialElements);
  const [selectedIds, setSelectedIds] = useState<string[]>(externalSelectedIds);
  const [selectionRect, setSelectionRect] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const [draggedItem, setDraggedItem] = useState<{
    type: 'seat' | 'element', 
    id: string,
    offsetX: number,
    offsetY: number,
    handle?: 'br',
    groupSnapshot?: Map<string, {x: number, y: number}>
  } | null>(null);

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.8 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => { setSeats(initialSeats); }, [initialSeats]);
  useEffect(() => { setElements(initialElements); }, [initialElements]);
  useEffect(() => { setSelectedIds(externalSelectedIds); }, [externalSelectedIds]);

  // Rendering
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
        } else {
          ctx.beginPath();
          for(let i=0; i<sides; i++) {
            const ang = (i * (360/sides)) * Math.PI/180;
            ctx.lineTo(Math.cos(ang)*el.w!/2, Math.sin(ang)*el.h!/2);
          }
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        if (isSelected && isDesignMode) {
          ctx.fillStyle = '#FFBF00'; ctx.fillRect(el.w!/2 - 4, el.h!/2 - 4, 8, 8);
        }
        if (el.label) {
          ctx.font = '800 12px Outfit'; ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
          ctx.textAlign = 'center'; ctx.fillText(el.label.toUpperCase(), 0, 5);
        }
        ctx.restore();
      });

      seats.forEach(seat => {
        ctx.save();
        ctx.translate(seat.x, seat.y);
        ctx.rotate((seat.angle || 0) * Math.PI / 180);
        const isSelected = selectedIds.includes(String(seat.id));
        ctx.fillStyle = isSelected ? '#FFBF00' : (theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)');
        ctx.strokeStyle = isSelected ? '#FFBF00' : (theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.3)');
        ctx.beginPath(); ctx.roundRect(-9, -9, 18, 18, 4); ctx.fill(); ctx.stroke();
        ctx.restore();
      });

      if (selectionRect) {
        ctx.fillStyle = 'rgba(255, 191, 0, 0.1)'; ctx.strokeStyle = '#FFBF00'; ctx.lineWidth = 1;
        ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
        ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
      }
      ctx.restore();
    };

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);
    render();
  }, [seats, elements, transform, theme, selectedIds, selectionRect]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - transform.x) / transform.scale;
    const y = (e.clientY - rect.top - transform.y) / transform.scale;

    // Pan with Right Click or Middle Click
    if (e.button === 1 || e.button === 2) {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (isDesignMode && e.button === 0) {
      if (selectedIds.length === 1) {
        const el = elements.find(e => e.id === selectedIds[0]);
        if (el && Math.abs(el.x + el.w!/2 - x) < 15 && Math.abs(el.y + el.h!/2 - y) < 15) {
          setDraggedItem({ type: 'element', id: el.id, offsetX: 0, offsetY: 0, handle: 'br' });
          return;
        }
      }

      const hitEl = [...elements].reverse().find(el => Math.abs(el.x - x) < (el.w || 20)/2 && Math.abs(el.y - y) < (el.h || 20)/2);
      const hitSeat = [...seats].reverse().find(s => Math.abs(s.x - x) < 15 && Math.abs(s.y - y) < 15);
      const hit = hitSeat || hitEl;

      if (hit) {
        const id = String(hit.id || '');
        let newSelection = selectedIds;
        if (!selectedIds.includes(id)) {
          newSelection = e.shiftKey ? [...selectedIds, id] : [id];
          setSelectedIds(newSelection);
          onSelect?.(newSelection);
        }
        const snapshot = new Map();
        newSelection.forEach(sid => {
          const s = seats.find(st => String(st.id) === sid);
          const el = elements.find(el => el.id === sid);
          if (s) snapshot.set(sid, { x: s.x, y: s.y });
          if (el) snapshot.set(sid, { x: el.x, y: el.y });
        });
        setDraggedItem({ type: hitSeat ? 'seat' : 'element', id, offsetX: hit.x - x, offsetY: hit.y - y, groupSnapshot: snapshot });
        return;
      }

      if (!e.shiftKey) { setSelectedIds([]); onSelect?.([]); }
      setSelectionRect({ x, y, w: 0, h: 0 });
      return;
    }

    setIsPanning(true);
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
        const dx = x - (draggedItem.groupSnapshot.get(draggedItem.id)!.x - draggedItem.offsetX);
        const dy = y - (draggedItem.groupSnapshot.get(draggedItem.id)!.y - draggedItem.offsetY);
        setSeats(prev => prev.map(s => {
          const snap = draggedItem.groupSnapshot!.get(String(s.id));
          return snap ? { ...s, x: snap.x + dx, y: snap.y + dy } : s;
        }));
        setElements(prev => prev.map(el => {
          const snap = draggedItem.groupSnapshot!.get(el.id);
          return snap ? { ...el, x: snap.x + dx, y: snap.y + dy } : el;
        }));
      }
      return;
    }

    if (isPanning) {
      setTransform(prev => ({ ...prev, x: prev.x + (e.clientX - lastMousePos.x), y: prev.y + (e.clientY - lastMousePos.y) }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    if (selectionRect) {
      const x1 = Math.min(selectionRect.x, selectionRect.x + selectionRect.w), x2 = Math.max(selectionRect.x, selectionRect.x + selectionRect.w);
      const y1 = Math.min(selectionRect.y, selectionRect.y + selectionRect.h), y2 = Math.max(selectionRect.y, selectionRect.y + selectionRect.h);
      const inSeats = seats.filter(s => s.x >= x1 && s.x <= x2 && s.y >= y1 && s.y <= y2).map(s => String(s.id));
      const inEls = elements.filter(el => el.x >= x1 && el.x <= x2 && el.y >= y1 && el.y <= y2).map(el => el.id);
      const newSel = [...inSeats, ...inEls]; setSelectedIds(newSel); onSelect?.(newSel);
      setSelectionRect(null);
    }
    setIsPanning(false);
    if (draggedItem && onUpdate) onUpdate(seats, elements);
    setDraggedItem(null);
  };

  return (
    <div className="w-full h-full relative cursor-crosshair bg-[#0b0d17] overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onWheel={(e) => setTransform(prev => ({ ...prev, scale: Math.max(0.05, Math.min(prev.scale * (e.deltaY > 0 ? 0.9 : 1.1), 5)) }))} className="w-full h-full block" />
      <div className="absolute bottom-6 right-6 px-4 py-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full text-[10px] font-black opacity-50 uppercase tracking-widest">Zoom: {Math.round(transform.scale * 100)}%</div>
    </div>
  );
};

export default SeatingChart;
