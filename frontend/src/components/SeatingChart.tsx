import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
  type?: 'rect' | 'icon' | 'text' | 'circle' | 'table' | 'rounded' | string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  label?: string;
  icon?: 'stairs' | 'wc' | 'bar' | 'exit';
  color?: string;
  category?: string;
  angle?: number;
  sides?: number;
  isGA?: boolean;
  capacity?: number;
  tableShape?: string;
  table_shape?: string;
  seatArrangement?: string;
  seat_arrangement?: string;
}

interface SeatingChartProps {
  seats: Seat[];
  theme?: 'light' | 'dark';
  elements?: MapElement[];
  occupancy?: { [key: string]: number };
  isDesignMode?: boolean;
  onUpdate?: (seats: Seat[], elements: MapElement[]) => void;
  onSelect?: (ids: string[]) => void;
  onChartClick?: (x: number, y: number) => void;
  selectedIds?: string[];
  activeTool?: string;
}

const SeatingChart: React.FC<SeatingChartProps> = ({
  seats: initialSeats,
  theme = 'dark',
  elements: initialElements = [],
  occupancy = {},
  isDesignMode = false,
  onUpdate,
  onSelect,
  onChartClick,
  selectedIds: externalSelectedIds = [],
  activeTool = 'select'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();

  const [seats, setSeats] = useState<Seat[]>(initialSeats);
  const [elements, setElements] = useState<MapElement[]>(initialElements);
  const [selectedIds, setSelectedIds] = useState<string[]>(externalSelectedIds);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [draggedItem, setDraggedItem] = useState<{
    type: 'seat' | 'element',
    id: string,
    offsetX: number,
    offsetY: number,
    handle?: 'br',
    groupSnapshot?: Map<string, { x: number, y: number }>
  } | null>(null);

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.8 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const lastTouchDistRef = useRef<number | null>(null);

  useEffect(() => { setSeats(initialSeats); }, [initialSeats]);
  useEffect(() => { setElements(initialElements); }, [initialElements]);
  useEffect(() => { setSelectedIds(externalSelectedIds); }, [externalSelectedIds]);

  // Non-passive native wheel listener to zoom canvas without scrolling outer web page
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setTransform(prev => ({
        ...prev,
        scale: Math.max(0.05, Math.min(prev.scale * (e.deltaY > 0 ? 0.9 : 1.1), 5))
      }));
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);
  
  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);

  // --- Premium Rendering Engine ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gridScale = transform.scale * dpr;
    const dotSpacing = 40 * gridScale;
    const offsetX = (transform.x * dpr) % dotSpacing;
    const offsetY = (transform.y * dpr) % dotSpacing;

    ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
    for (let x = offsetX - dotSpacing; x < canvas.width + dotSpacing; x += dotSpacing) {
      for (let y = offsetY - dotSpacing; y < canvas.height + dotSpacing; y += dotSpacing) {
        ctx.beginPath(); ctx.arc(x, y, 1 * dpr, 0, Math.PI * 2); ctx.fill();
      }
    }

    ctx.save();
    ctx.translate(transform.x * dpr, transform.y * dpr);
    ctx.scale(gridScale, gridScale);

    // Render Elements
    elements.forEach(el => {
      ctx.save(); ctx.translate(el.x, el.y); ctx.rotate((el.angle || 0) * Math.PI / 180);
      const isSelected = selectedSet.has(el.id);
      const isHovered = hoveredId === el.id;
      if (isSelected) { ctx.shadowBlur = 15; ctx.shadowColor = '#FFBF00'; }
      else if (isHovered) { ctx.shadowBlur = 10; ctx.shadowColor = theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'; }
      
      if (el.isGA) {
        ctx.setLineDash([5, 5]);
        ctx.fillStyle = el.color || (theme === 'dark' ? 'rgba(255,191,0,0.05)' : 'rgba(255,191,0,0.05)');
      } else {
        ctx.setLineDash([]);
        ctx.fillStyle = el.color || (theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)');
      }

      ctx.strokeStyle = isSelected ? '#FFBF00' : isHovered ? (theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)') : (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)');
      ctx.lineWidth = isSelected ? 3 : 1.5;
      const sides = el.sides ?? (el.type === 'circle' ? 0 : 4), w = el.w || 100, h = el.h || 100;
      const shapeType = el.type || 'rect';

      if (shapeType === 'table') {
        const tableShape = el.tableShape || el.table_shape || 'circle';
        if (tableShape === 'rect' || tableShape === 'square') {
          ctx.beginPath();
          ctx.roundRect(-w / 2, -h / 2, w, h, 8);
          ctx.fill(); ctx.stroke();
        } else if (tableShape === 'ellipse') {
          ctx.beginPath();
          ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        } else {
          const radius = Math.min(w, h) / 2;
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        }

        // Render seats ring around table
        const seatsCount = el.capacity || 4;
        ctx.fillStyle = isSelected ? '#FFBF00' : (theme === 'dark' ? 'rgba(255,191,0,0.7)' : 'rgba(217,119,6,0.8)');
        if (tableShape === 'rect' || tableShape === 'square') {
          const pad = 14;
          const arrangement = el.seatArrangement || el.seat_arrangement || '4_sides';
          let tc = 1, rc = 1, bc = 1, lc = 1;
          if (arrangement === '2_vs_2' || arrangement === 'opposite') {
            if (w >= h) {
              tc = Math.ceil(seatsCount / 2);
              bc = Math.floor(seatsCount / 2);
              lc = 0; rc = 0;
            } else {
              lc = Math.ceil(seatsCount / 2);
              rc = Math.floor(seatsCount / 2);
              tc = 0; bc = 0;
            }
          } else if (arrangement === '4_sides' && seatsCount === 4) {
            tc = 1; rc = 1; bc = 1; lc = 1;
          } else {
            if (seatsCount === 2) { tc = 0; bc = 0; lc = 1; rc = 1; }
            else if (seatsCount === 4) { tc = 1; rc = 1; bc = 1; lc = 1; }
            else if (seatsCount === 6) { tc = 2; bc = 2; lc = 1; rc = 1; }
            else if (seatsCount === 8) { tc = 2; rc = 2; bc = 2; lc = 2; }
            else if (seatsCount === 10) { tc = 3; bc = 3; lc = 2; rc = 2; }
            else if (seatsCount === 12) { tc = 4; bc = 4; lc = 2; rc = 2; }
            else {
              const base = Math.floor(seatsCount / 4);
              const rem = seatsCount % 4;
              tc = base + (rem >= 1 ? 1 : 0);
              bc = base + (rem >= 2 ? 1 : 0);
              lc = base + (rem >= 3 ? 1 : 0);
              rc = base;
            }
          }

          // Top
          for (let j = 0; j < tc; j++) {
            const sx = -w / 2 + (w / (tc + 1)) * (j + 1);
            const sy = -h / 2 - pad;
            ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
          }
          // Right
          for (let j = 0; j < rc; j++) {
            const sx = w / 2 + pad;
            const sy = -h / 2 + (h / (rc + 1)) * (j + 1);
            ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
          }
          // Bottom
          for (let j = 0; j < bc; j++) {
            const sx = w / 2 - (w / (bc + 1)) * (j + 1);
            const sy = h / 2 + pad;
            ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
          }
          // Left
          for (let j = 0; j < lc; j++) {
            const sx = -w / 2 - pad;
            const sy = h / 2 - (h / (lc + 1)) * (j + 1);
            ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
          }
        } else {
          const rx = (w / 2) + 14;
          const ry = (h / 2) + 14;
          for (let i = 0; i < seatsCount; i++) {
            const ang = (i * (360 / seatsCount) - 90) * Math.PI / 180;
            const sx = Math.cos(ang) * rx;
            const sy = Math.sin(ang) * ry;
            ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
          }
        }
      } else if (sides === 0 || shapeType === 'circle') {
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      } else if (shapeType === 'rounded') {
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 16);
        ctx.fill(); ctx.stroke();
      } else if (sides === 4 && shapeType === 'rect') {
        ctx.beginPath();
        ctx.rect(-w / 2, -h / 2, w, h);
        ctx.fill(); ctx.stroke();
      } else {
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const ang = (i * (360 / sides) - 90) * Math.PI / 180;
          const px = Math.cos(ang) * (w / 2);
          const py = Math.sin(ang) * (h / 2);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.shadowBlur = 0;
      if (el.label) {
        ctx.font = '800 12px Outfit';
        ctx.fillStyle = isSelected ? '#000' : (theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)');
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(el.label.toUpperCase(), 0, (el.isGA && el.capacity) ? -8 : 0);

        if (el.isGA && el.capacity) {
          const sold = occupancy[el.id] || 0;
          const ratio = sold / el.capacity;
          ctx.font = '800 9px Outfit';
          ctx.fillStyle = isSelected ? '#000' : (theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)');
          ctx.fillText(`${sold} / ${el.capacity}`, 0, 8);

          // Progress Bar
          const w = el.w || 100, h = el.h || 100;
          ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
          ctx.beginPath(); ctx.roundRect(-w/2 + 20, h/2 - 15, w - 40, 4, 2); ctx.fill();
          
          ctx.fillStyle = ratio > 0.9 ? '#eb4d4b' : '#6ab04c';
          ctx.beginPath(); ctx.roundRect(-w/2 + 20, h/2 - 15, (w - 40) * Math.min(1, ratio), 4, 2); ctx.fill();
        }
      }
      if (isSelected && isDesignMode) {
        ctx.fillStyle = '#FFBF00'; ctx.beginPath(); ctx.roundRect(w / 2 - 6, h / 2 - 6, 12, 12, 3); ctx.fill();
      }
      ctx.restore();
    });

    // Render Seats
    seats.forEach(seat => {
      ctx.save(); ctx.translate(seat.x, seat.y); ctx.rotate((seat.angle || 0) * Math.PI / 180);
      const isSelected = selectedSet.has(String(seat.id));
      const isHovered = hoveredId === String(seat.id);
      
      if (isSelected) { ctx.shadowBlur = 10; ctx.shadowColor = '#FFBF00'; }
      
      // Status & Category-based coloring
      let fillColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)';
      let strokeColor = theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.3)';
      
      if (seat.status === 'occupied' || seat.status === 'reserved') {
        fillColor = theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.05)';
        strokeColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)';
      } else {
        if (seat.category === 'vip') fillColor = 'rgba(255, 191, 0, 0.4)';
        else if (seat.category === 'premium') fillColor = 'rgba(34, 166, 179, 0.4)';
        else if (seat.category === 'disabled') fillColor = 'rgba(106, 176, 76, 0.4)';
      }
      
      ctx.fillStyle = isSelected ? '#FFBF00' : isHovered ? (theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') : fillColor;
      ctx.strokeStyle = isSelected ? '#FFBF00' : isHovered ? (theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)') : strokeColor;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.beginPath(); ctx.roundRect(-9, -9, 18, 18, 5); ctx.fill(); ctx.stroke();

      // Lock icon for reserved seats
      if ((seat.status === 'occupied' || seat.status === 'reserved') && !isSelected) {
        ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });

    // Ghost Preview
    if (activeTool !== 'select' && !isPanning && !draggedItem) {
      ctx.save(); ctx.translate(mousePos.x, mousePos.y); ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#FFBF00'; ctx.setLineDash([5, 5]);
      if (['zone', 'stage'].includes(activeTool)) {
        ctx.strokeRect(-75, -50, 150, 100);
      } else {
        ctx.strokeRect(-9, -9, 18, 18);
      }
      ctx.restore();
    }

    // Selection Marquee
    if (selectionRect) {
      ctx.fillStyle = 'rgba(255, 191, 0, 0.15)'; ctx.strokeStyle = '#FFBF00'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
      ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
      ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
    }
    ctx.restore();
  }, [seats, elements, transform, theme, selectedSet, hoveredId, selectionRect, isDesignMode, activeTool, mousePos, isPanning, draggedItem, occupancy]);

  const animate = useCallback(() => { draw(); requestRef.current = requestAnimationFrame(animate); }, [draw]);
  useEffect(() => { requestRef.current = requestAnimationFrame(animate); return () => cancelAnimationFrame(requestRef.current!); }, [animate]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      const canvas = canvasRef.current; const container = containerRef.current;
      if (!canvas || !container) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpr; canvas.height = container.clientHeight * dpr;
    });
    observer.observe(containerRef.current); return () => observer.disconnect();
  }, []);

  const getMouseCoords = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (e.clientX - rect.left - transform.x) / transform.scale, y: (e.clientY - rect.top - transform.y) / transform.scale };
  };

  const getTouchCoords = (e: React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || e.touches.length === 0) return { x: 0, y: 0 };
    const touch = e.touches[0];
    return {
      x: (touch.clientX - rect.left - transform.x) / transform.scale,
      y: (touch.clientY - rect.top - transform.y) / transform.scale
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const { x, y } = getTouchCoords(e);
      setLastMousePos({ x: touch.clientX, y: touch.clientY });

      const hitSlop = 20 / transform.scale;
      const hitSeat = [...seats].reverse().find(s => Math.abs(s.x - x) < hitSlop && Math.abs(s.y - y) < hitSlop);

      if (isDesignMode) {
        if (activeTool !== 'select') { onChartClick?.(x, y); return; }
        const hitEl = [...elements].reverse().find(el => {
          const w = el.w || 100, h = el.h || 100;
          return x >= el.x - w / 2 - hitSlop && x <= el.x + w / 2 + hitSlop &&
            y >= el.y - h / 2 - hitSlop && y <= el.y + h / 2 + hitSlop;
        });
        const hit = hitSeat || hitEl;
        if (hit) {
          const id = String(hit.id); let newSelection = selectedIds;
          if (!selectedIds.includes(id)) { newSelection = [id]; setSelectedIds(newSelection); onSelect?.(newSelection); }
          const snapshot = new Map();
          newSelection.forEach(sid => {
            const s = seats.find(st => String(st.id) === sid), el = elements.find(elObj => String(elObj.id) === sid);
            if (s) snapshot.set(sid, { x: s.x, y: s.y }); else if (el) snapshot.set(sid, { x: el.x, y: el.y });
          });
          setDraggedItem({ type: hitSeat ? 'seat' : 'element', id, offsetX: hit.x - x, offsetY: hit.y - y, handle: (hitEl && Math.abs(hitEl.x + hitEl.w! / 2 - x) < hitSlop && Math.abs(hitEl.y + hitEl.h! / 2 - y) < hitSlop) ? 'br' : undefined, groupSnapshot: snapshot });
          return;
        }
        setIsPanning(true);
      } else {
        if (hitSeat && hitSeat.status === 'available') {
          const id = String(hitSeat.id);
          const newSelection = selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id];
          setSelectedIds(newSelection); onSelect?.(newSelection);
        } else {
          setIsPanning(true);
        }
      }
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      lastTouchDistRef.current = dist;
      setIsPanning(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const { x, y } = getTouchCoords(e);
      setMousePos({ x, y });

      if (draggedItem) {
        if (draggedItem.handle === 'br') {
          setElements(prev => prev.map(el => el.id === draggedItem.id ? { ...el, w: Math.max(20, (x - el.x) * 2), h: Math.max(20, (y - el.y) * 2) } : el));
        } else if (draggedItem.groupSnapshot) {
          const snap = draggedItem.groupSnapshot.get(draggedItem.id);
          if (snap) {
            const dx = x - (snap.x - draggedItem.offsetX);
            const dy = y - (snap.y - draggedItem.offsetY);
            const updatedSeats = seats.map(s => {
              const sSnap = draggedItem.groupSnapshot!.get(String(s.id));
              return sSnap ? { ...s, x: sSnap.x + dx, y: sSnap.y + dy } : s;
            });
            const updatedEls = elements.map(el => {
              const eSnap = draggedItem.groupSnapshot!.get(el.id);
              return eSnap ? { ...el, x: eSnap.x + dx, y: eSnap.y + dy } : el;
            });
            setSeats(updatedSeats); setElements(updatedEls);
          }
        }
        return;
      }
      if (isPanning) {
        setTransform(prev => ({ ...prev, x: prev.x + (touch.clientX - lastMousePos.x), y: prev.y + (touch.clientY - lastMousePos.y) }));
        setLastMousePos({ x: touch.clientX, y: touch.clientY });
      }
    } else if (e.touches.length === 2 && lastTouchDistRef.current !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const factor = dist / lastTouchDistRef.current;
      if (factor > 0.5 && factor < 2.0) {
        setTransform(prev => ({ ...prev, scale: Math.max(0.05, Math.min(prev.scale * factor, 5)) }));
      }
      lastTouchDistRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
    if (draggedItem && onUpdate) onUpdate(seats, elements);
    setDraggedItem(null);
    lastTouchDistRef.current = null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getMouseCoords(e);
    if (e.button === 1 || e.button === 2) { setIsPanning(true); setLastMousePos({ x: e.clientX, y: e.clientY }); return; }

    if (e.button === 0) {
      const hitSlop = 20 / transform.scale;
      const hitSeat = [...seats].reverse().find(s => Math.abs(s.x - x) < hitSlop && Math.abs(s.y - y) < hitSlop);

      if (isDesignMode) {
        if (activeTool !== 'select') { onChartClick?.(x, y); return; }
        const hitEl = [...elements].reverse().find(el => {
          const w = el.w || 100, h = el.h || 100;
          return x >= el.x - w / 2 - hitSlop && x <= el.x + w / 2 + hitSlop &&
            y >= el.y - h / 2 - hitSlop && y <= el.y + h / 2 + hitSlop;
        });
        const hit = hitSeat || hitEl;
        if (hit) {
          const id = String(hit.id); let newSelection = selectedIds;
          if (!selectedIds.includes(id)) { newSelection = e.shiftKey ? [...selectedIds, id] : [id]; setSelectedIds(newSelection); onSelect?.(newSelection); }
          const snapshot = new Map();
          newSelection.forEach(sid => {
            const s = seats.find(st => String(st.id) === sid), el = elements.find(e => String(e.id) === sid);
            if (s) snapshot.set(sid, { x: s.x, y: s.y }); else if (el) snapshot.set(sid, { x: el.x, y: el.y });
          });
          setDraggedItem({ type: hitSeat ? 'seat' : 'element', id, offsetX: hit.x - x, offsetY: hit.y - y, handle: (hitEl && Math.abs(hitEl.x + hitEl.w! / 2 - x) < hitSlop && Math.abs(hitEl.y + hitEl.h! / 2 - y) < hitSlop) ? 'br' : undefined, groupSnapshot: snapshot });
          return;
        }
        if (!e.shiftKey) { setSelectedIds([]); onSelect?.([]); }
        setSelectionRect({ x, y, w: 0, h: 0 });
      } else {
        if (hitSeat && hitSeat.status === 'available') {
          const id = String(hitSeat.id);
          const newSelection = selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id];
          setSelectedIds(newSelection); onSelect?.(newSelection);
        }
      }
      return;
    }
    setIsPanning(true); setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = getMouseCoords(e); setMousePos({ x, y });

    const hitSlop = 20 / transform.scale;
    const hitSeat = [...seats].reverse().find(s => Math.abs(s.x - x) < hitSlop && Math.abs(s.y - y) < hitSlop);
    const hitEl = [...elements].reverse().find(el => {
      const w = el.w || 100, h = el.h || 100;
      return x >= el.x - w / 2 - hitSlop && x <= el.x + w / 2 + hitSlop &&
        y >= el.y - h / 2 - hitSlop && y <= el.y + h / 2 + hitSlop;
    });
    setHoveredId(hitSeat || hitEl ? String((hitSeat || hitEl)!.id) : null);

    if (selectionRect) { setSelectionRect(prev => ({ ...prev!, w: x - prev!.x, h: y - prev!.y })); return; }

    if (draggedItem) {
      if (draggedItem.handle === 'br') {
        const nextEls = elements.map(el => el.id === draggedItem.id ? { ...el, w: Math.max(20, Math.round((x - el.x) * 2)), h: Math.max(20, Math.round((y - el.y) * 2)) } : el);
        setElements(nextEls);
        if (onUpdate) onUpdate(seats, nextEls);
      } else if (draggedItem.groupSnapshot) {
        const snap = draggedItem.groupSnapshot.get(draggedItem.id);
        if (snap) {
          const dx = x - (snap.x - draggedItem.offsetX);
          const dy = y - (snap.y - draggedItem.offsetY);
          const updatedSeats = seats.map(s => {
            const sSnap = draggedItem.groupSnapshot!.get(String(s.id));
            return sSnap ? { ...s, x: sSnap.x + dx, y: sSnap.y + dy } : s;
          });
          const updatedEls = elements.map(el => {
            const eSnap = draggedItem.groupSnapshot!.get(el.id);
            return eSnap ? { ...el, x: eSnap.x + dx, y: eSnap.y + dy } : el;
          });
          setSeats(updatedSeats); setElements(updatedEls);
          if (onUpdate) onUpdate(updatedSeats, updatedEls);
        }
      }
      return;
    }
    if (isPanning) { setTransform(prev => ({ ...prev, x: prev.x + (e.clientX - lastMousePos.x), y: prev.y + (e.clientY - lastMousePos.y) })); setLastMousePos({ x: e.clientX, y: e.clientY }); }
  };

  const handleMouseUp = () => {
    if (selectionRect) {
      const x1 = Math.min(selectionRect.x, selectionRect.x + selectionRect.w), x2 = Math.max(selectionRect.x, selectionRect.x + selectionRect.w);
      const y1 = Math.min(selectionRect.y, selectionRect.y + selectionRect.h), y2 = Math.max(selectionRect.y, selectionRect.y + selectionRect.h);
      const inSeats = seats.filter(s => s.x >= x1 && s.x <= x2 && s.y >= y1 && s.y <= y2).map(s => String(s.id));
      const inEls = elements.filter(el => el.x >= x1 && el.x <= x2 && el.y >= y1 && el.y <= y2).map(el => el.id);
      const newSel = [...inSeats, ...inEls]; setSelectedIds(newSel); onSelect?.(newSel); setSelectionRect(null);
    }
    setIsPanning(false); if (draggedItem && onUpdate) onUpdate(seats, elements); setDraggedItem(null);
  };

  const cursorClass = isPanning ? 'cursor-grabbing' : (activeTool !== 'select' || hoveredId) ? 'cursor-pointer' : 'cursor-default';

  return (
    <div ref={containerRef} className={cn("w-full h-full relative overflow-hidden transition-colors duration-500", theme === 'dark' ? "bg-[#0b0d17]" : "bg-white", cursorClass)} onContextMenu={(e) => e.preventDefault()}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full h-full block outline-none touch-none"
        style={{ touchAction: 'none' }}
        tabIndex={0}
      />
      <div className="absolute bottom-6 left-6 flex gap-2">
        <div className="px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full text-[9px] font-black opacity-60 uppercase tracking-widest text-white/50 hidden sm:block">Del: Borrar | Shift+Drag: Multi | Arrows: Precision</div>
      </div>
      <div className="absolute bottom-6 right-6 px-4 py-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full text-[10px] font-black opacity-50 uppercase tracking-widest">Zoom: {Math.round(transform.scale * 100)}%</div>
    </div>
  );
};

export default SeatingChart;
