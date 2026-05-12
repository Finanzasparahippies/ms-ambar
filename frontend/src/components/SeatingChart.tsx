import * as React from 'react';
import { useRef, useEffect, useState, useCallback } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  
  const [seats, setSeats] = useState<Seat[]>(initialSeats);
  const [elements, setElements] = useState<MapElement[]>(initialElements);
  const [selectedIds, setSelectedIds] = useState<string[]>(externalSelectedIds);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
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

  // --- Premium Rendering Engine ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset and clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid Background (Professional Dot Pattern)
    const dpr = window.devicePixelRatio || 1;
    const gridScale = transform.scale * dpr;
    const dotSpacing = 40 * gridScale;
    const offsetX = (transform.x * dpr) % dotSpacing;
    const offsetY = (transform.y * dpr) % dotSpacing;

    ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
    for (let x = offsetX; x < canvas.width; x += dotSpacing) {
      for (let y = offsetY; y < canvas.height; y += dotSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.save();
    ctx.translate(transform.x * dpr, transform.y * dpr);
    ctx.scale(gridScale, gridScale);

    // Render Elements
    elements.forEach(el => {
      ctx.save();
      ctx.translate(el.x, el.y);
      ctx.rotate((el.angle || 0) * Math.PI / 180);
      
      const isSelected = selectedIds.includes(el.id);
      const isHovered = hoveredId === el.id;
      
      // Glow effect for selected
      if (isSelected) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#FFBF00';
      } else if (isHovered) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(255,255,255,0.2)';
      }

      ctx.fillStyle = el.color || (theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)');
      ctx.strokeStyle = isSelected ? '#FFBF00' : isHovered ? 'rgba(255,255,255,0.4)' : (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)');
      ctx.lineWidth = isSelected ? 3 : 1.5;

      const sides = el.sides ?? 4;
      const w = el.w || 100;
      const h = el.h || 100;

      if (sides === 0) {
        ctx.beginPath(); ctx.arc(0, 0, w/2, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      } else {
        ctx.beginPath();
        for(let i=0; i<sides; i++) {
          const ang = (i * (360/sides)) * Math.PI/180;
          ctx.lineTo(Math.cos(ang) * w/2, Math.sin(ang) * h/2);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }

      // Reset shadow for text
      ctx.shadowBlur = 0;

      if (el.label) {
        ctx.font = '800 12px Outfit';
        ctx.fillStyle = isSelected ? '#000' : (theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(el.label.toUpperCase(), 0, 0);
      }

      // Resize handle
      if (isSelected && isDesignMode) {
        ctx.fillStyle = '#FFBF00';
        ctx.beginPath();
        ctx.roundRect(w/2 - 6, h/2 - 6, 12, 12, 3);
        ctx.fill();
      }
      
      ctx.restore();
    });

    // Render Seats
    seats.forEach(seat => {
      ctx.save();
      ctx.translate(seat.x, seat.y);
      ctx.rotate((seat.angle || 0) * Math.PI / 180);
      
      const isSelected = selectedIds.includes(String(seat.id));
      const isHovered = hoveredId === String(seat.id);

      if (isSelected) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#FFBF00';
      }

      ctx.fillStyle = isSelected ? '#FFBF00' : isHovered ? 'rgba(255,255,255,0.2)' : (theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)');
      ctx.strokeStyle = isSelected ? '#FFBF00' : isHovered ? 'rgba(255,255,255,0.4)' : (theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.3)');
      ctx.lineWidth = isSelected ? 2 : 1;

      ctx.beginPath();
      ctx.roundRect(-9, -9, 18, 18, 5);
      ctx.fill();
      ctx.stroke();
      
      ctx.restore();
    });

    // Selection Marquee
    if (selectionRect) {
      ctx.fillStyle = 'rgba(255, 191, 0, 0.15)';
      ctx.strokeStyle = '#FFBF00';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
      ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [seats, elements, transform, theme, selectedIds, hoveredId, selectionRect, isDesignMode]);

  const animate = useCallback(() => {
    draw();
    requestRef.current = requestAnimationFrame(animate);
  }, [draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [animate]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    if (!isDesignMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);
      if (isTyping) return;

      if (selectedIds.length === 0) return;
      const step = e.shiftKey ? 10 : 1;
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const newSeats = seats.filter(s => !selectedIds.includes(String(s.id)));
        const newElements = elements.filter(el => !selectedIds.includes(String(el.id)));
        setSeats(newSeats); setElements(newElements); setSelectedIds([]);
        onUpdate?.(newSeats, newElements);
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        
        const newSeats = seats.map(s => selectedIds.includes(String(s.id)) ? { ...s, x: s.x + dx, y: s.y + dy } : s);
        const newEls = elements.map(el => selectedIds.includes(String(el.id)) ? { ...el, x: el.x + dx, y: el.y + dy } : el);
        setSeats(newSeats); setElements(newEls);
        onUpdate?.(newSeats, newEls);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, seats, elements, isDesignMode, onUpdate]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - transform.x) / transform.scale;
    const y = (e.clientY - rect.top - transform.y) / transform.scale;

    if (e.button === 1 || e.button === 2) {
      setIsPanning(true); setLastMousePos({ x: e.clientX, y: e.clientY }); return;
    }

    if (isDesignMode && e.button === 0) {
      const hitEl = [...elements].reverse().find(el => Math.abs(el.x - x) < (el.w || 20)/2 && Math.abs(el.y - y) < (el.h || 20)/2);
      const hitSeat = [...seats].reverse().find(s => Math.abs(s.x - x) < 15 && Math.abs(s.y - y) < 15);
      const hit = hitSeat || hitEl;

      if (hit) {
        const id = String(hit.id);
        let newSelection = selectedIds;
        if (!selectedIds.includes(id)) {
          newSelection = e.shiftKey ? [...selectedIds, id] : [id];
          setSelectedIds(newSelection); onSelect?.(newSelection);
        }
        const snapshot = new Map();
        newSelection.forEach(sid => {
          const s = seats.find(st => String(st.id) === sid);
          const el = elements.find(el => el.id === sid);
          if (s) snapshot.set(sid, { x: s.x, y: s.y }); else if (el) snapshot.set(sid, { x: el.x, y: el.y });
        });
        setDraggedItem({ type: hitSeat ? 'seat' : 'element', id, offsetX: hit.x - x, offsetY: hit.y - y, 
          handle: (hitEl && Math.abs(hitEl.x + hitEl.w!/2 - x) < 15 && Math.abs(hitEl.y + hitEl.h!/2 - y) < 15) ? 'br' : undefined,
          groupSnapshot: snapshot 
        });
        return;
      }
      if (!e.shiftKey) { setSelectedIds([]); onSelect?.([]); }
      setSelectionRect({ x, y, w: 0, h: 0 }); return;
    }
    setIsPanning(true); setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - transform.x) / transform.scale;
    const y = (e.clientY - rect.top - transform.y) / transform.scale;

    // Hover detection
    const hitEl = [...elements].reverse().find(el => Math.abs(el.x - x) < (el.w || 20)/2 && Math.abs(el.y - y) < (el.h || 20)/2);
    const hitSeat = [...seats].reverse().find(s => Math.abs(s.x - x) < 15 && Math.abs(s.y - y) < 15);
    const hit = hitSeat || hitEl;
    setHoveredId(hit ? String(hit.id) : null);

    if (selectionRect) { setSelectionRect(prev => ({ ...prev!, w: x - prev!.x, h: y - prev!.y })); return; }

    if (draggedItem) {
      if (draggedItem.handle === 'br') {
        setElements(prev => prev.map(el => el.id === draggedItem.id ? { ...el, w: Math.max(20, (x - el.x)*2), h: Math.max(20, (y - el.y)*2) } : el));
      } else if (draggedItem.groupSnapshot) {
        const snap = draggedItem.groupSnapshot.get(draggedItem.id);
        if (snap) {
          const dx = x - (snap.x - draggedItem.offsetX);
          const dy = y - (snap.y - draggedItem.offsetY);
          setSeats(prev => prev.map(s => {
            const sSnap = draggedItem.groupSnapshot!.get(String(s.id));
            return sSnap ? { ...s, x: sSnap.x + dx, y: sSnap.y + dy } : s;
          }));
          setElements(prev => prev.map(el => {
            const eSnap = draggedItem.groupSnapshot!.get(el.id);
            return eSnap ? { ...el, x: eSnap.x + dx, y: eSnap.y + dy } : el;
          }));
        }
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
    setIsPanning(false); if (draggedItem && onUpdate) onUpdate(seats, elements); setDraggedItem(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({ ...prev, scale: Math.max(0.05, Math.min(prev.scale * delta, 5)) }));
  };

  return (
    <div className="w-full h-full relative cursor-crosshair bg-[#0b0d17] overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
      <canvas 
        ref={canvasRef} 
        onMouseDown={handleMouseDown} 
        onMouseMove={handleMouseMove} 
        onMouseUp={handleMouseUp} 
        onWheel={handleWheel}
        className="w-full h-full block outline-none" 
        tabIndex={0} 
      />
      <div className="absolute bottom-6 left-6 flex gap-2">
        <div className="px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full text-[9px] font-black opacity-60 uppercase tracking-widest text-white/50">Del: Borrar | Shift+Drag: Multi | Arrows: Precision</div>
      </div>
      <div className="absolute bottom-6 right-6 px-4 py-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full text-[10px] font-black opacity-50 uppercase tracking-widest">Zoom: {Math.round(transform.scale * 100)}%</div>
    </div>
  );
};

export default SeatingChart;
