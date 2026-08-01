import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { cn } from '../lib/utils';
import {
  calculateLayoutBounds,
  calculateFitTransform,
  clampTransform,
  LayoutBounds
} from '../utils/seatingBounds';

interface Seat {
  id: string | number;
  x: number;
  y: number;
  row: string;
  number: number;
  status: 'available' | 'occupied' | 'selected' | 'reserved';
  category: string;
  angle: number;
  color?: string;
  base_price?: number | string;
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
  allowZoom?: boolean;
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
  activeTool = 'select',
  allowZoom = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const hasAutoFittedRef = useRef<boolean>(false);
  const [userZoomPreference, setUserZoomPreference] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user_allow_canvas_zoom');
      if (stored !== null) {
        setUserZoomPreference(stored === 'true');
      }
    } catch (e) {}
  }, []);

  const effectiveAllowZoom = userZoomPreference !== null ? userZoomPreference : allowZoom;

  const allowZoomRef = useRef<boolean>(effectiveAllowZoom);
  useEffect(() => { allowZoomRef.current = effectiveAllowZoom; }, [effectiveAllowZoom]);

  const toggleUserZoomPreference = () => {
    const nextVal = !effectiveAllowZoom;
    setUserZoomPreference(nextVal);
    try {
      localStorage.setItem('user_allow_canvas_zoom', String(nextVal));
    } catch (e) {}
  };

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

  // Compute Layout Bounds
  const bounds: LayoutBounds = useMemo(() => {
    return calculateLayoutBounds(seats, elements);
  }, [seats, elements]);

  const boundsRef = useRef<LayoutBounds>(bounds);
  useEffect(() => { boundsRef.current = bounds; }, [bounds]);

  // Handler to fit view cleanly on screen
  const handleFitToView = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;
    const fit = calculateFitTransform(boundsRef.current, w, h);
    setTransform(fit);
    hasAutoFittedRef.current = true;
  }, []);

  // Auto-fit on layout load or size change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !container) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;

      if (!hasAutoFittedRef.current && w > 0 && h > 0) {
        const fit = calculateFitTransform(boundsRef.current, w, h);
        setTransform(fit);
        hasAutoFittedRef.current = true;
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(container);
    handleResize();

    return () => observer.disconnect();
  }, []);

  // Re-fit when initial seats/elements load or if zoom is disabled
  useEffect(() => {
    if ((seats.length > 0 || elements.length > 0) && (!hasAutoFittedRef.current || !allowZoom)) {
      handleFitToView();
    }
  }, [seats.length, elements.length, allowZoom, handleFitToView]);

  // Non-passive native wheel listener with constrained zoom/pan bounds
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const container = containerRef.current;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const containerW = container?.clientWidth || rect.width || 800;
      const containerH = container?.clientHeight || rect.height || 600;

      setTransform(prev => {
        const currentBounds = boundsRef.current;
        const fitScale = calculateFitTransform(currentBounds, containerW, containerH).scale;

        // If zoom is disabled by admin setting, lock scale at fitScale
        if (!allowZoomRef.current) {
          return clampTransform({ x: prev.x, y: prev.y, scale: fitScale }, currentBounds, containerW, containerH, fitScale);
        }

        const zoomFactor = e.deltaY > 0 ? 0.88 : 1.14;
        const rawScale = prev.scale * zoomFactor;
        const newX = mouseX - (mouseX - prev.x) * (rawScale / prev.scale);
        const newY = mouseY - (mouseY - prev.y) * (rawScale / prev.scale);

        return clampTransform({ x: newX, y: newY, scale: rawScale }, currentBounds, containerW, containerH, fitScale);
      });
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Incremental button zoom handler
  const handleStepZoom = useCallback((factor: number) => {
    if (!allowZoom) return;
    const container = containerRef.current;
    const cW = container?.clientWidth || 800;
    const cH = container?.clientHeight || 600;
    const centerX = cW / 2;
    const centerY = cH / 2;

    setTransform(prev => {
      const rawScale = prev.scale * factor;
      const newX = centerX - (centerX - prev.x) * (rawScale / prev.scale);
      const newY = centerY - (centerY - prev.y) * (rawScale / prev.scale);
      const fitScale = calculateFitTransform(bounds, cW, cH).scale;
      return clampTransform({ x: newX, y: newY, scale: rawScale }, bounds, cW, cH, fitScale);
    });
  }, [bounds, allowZoom]);

  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);
  const hoveredSeat = useMemo(() => {
    if (!hoveredId) return null;
    return seats.find(s => String(s.id) === hoveredId) || null;
  }, [seats, hoveredId]);

  const getSeatTooltipLabel = useCallback((seat: Seat) => {
    const tableId = (seat as any).tableId || (seat as any).table_id;
    let tableEl: MapElement | undefined;
    if (tableId) {
      tableEl = elements.find(el => String(el.id) === String(tableId));
    }
    if (!tableEl && seat.row) {
      const rowLower = String(seat.row).toLowerCase();
      tableEl = elements.find(el => el.type === 'table' && el.label && String(el.label).toLowerCase() === rowLower);
    }

    const rawTableName = tableEl?.label || seat.row;
    const isTable = !!tableEl || !!tableId || String(seat.row || '').toLowerCase().includes('mesa') || String(seat.row || '').toLowerCase().includes('table');

    if (isTable) {
      const nameStr = String(rawTableName || 'Mesa').trim();
      const formattedName = (nameStr.toLowerCase().startsWith('mesa') || nameStr.toLowerCase().startsWith('table'))
        ? nameStr
        : `Mesa ${nameStr}`;
      return `${formattedName} • Asiento ${seat.number}`;
    }

    const rowStr = String(seat.row || '').trim();
    const formattedRow = rowStr.toLowerCase().startsWith('fila') ? rowStr : `Fila ${rowStr}`;
    return `${formattedRow} • Asiento ${seat.number}`;
  }, [elements]);

  // --- Premium Rendering Engine ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
        const themeObj = typeof theme === 'object' ? (theme as any) : null;
        const headingColor = themeObj?.headingColor || themeObj?.primaryColor || (theme === 'dark' ? '#E5A93B' : '#000');
        const textColor = themeObj?.textColor || (theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)');

        ctx.font = '800 12px Outfit';
        ctx.fillStyle = isSelected ? '#000' : headingColor;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(el.label.toUpperCase(), 0, (el.isGA && el.capacity) ? -8 : 0);

        if (el.isGA && el.capacity) {
          const sold = occupancy[el.id] || 0;
          const ratio = sold / el.capacity;
          ctx.font = '800 9px Outfit';
          ctx.fillStyle = isSelected ? '#000' : textColor;
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
      const isOccupied = seat.status === 'occupied' || seat.status === 'reserved';
      
      let fillColor: string;
      let strokeColor: string;

      if (isOccupied) {
        fillColor = theme === 'dark' ? 'rgba(30, 41, 59, 0.75)' : 'rgba(226, 232, 240, 0.85)';
        strokeColor = theme === 'dark' ? 'rgba(239, 68, 68, 0.45)' : 'rgba(239, 68, 68, 0.35)';
      } else {
        if (seat.color && typeof seat.color === 'string' && seat.color.trim() !== '') {
          fillColor = seat.color;
          strokeColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)';
        } else {
          const cat = String(seat.category || '').toLowerCase();
          if (cat === 'vip') {
            fillColor = 'rgba(245, 158, 11, 0.85)';
            strokeColor = '#d97706';
          } else if (cat === 'premium') {
            fillColor = 'rgba(139, 92, 246, 0.85)';
            strokeColor = '#7c3aed';
          } else if (cat === 'disabled') {
            fillColor = 'rgba(34, 197, 94, 0.85)';
            strokeColor = '#16a34a';
          } else {
            fillColor = 'rgba(34, 166, 179, 0.85)';
            strokeColor = '#008b9b';
          }
        }
      }

      if (isSelected) {
        fillColor = '#2563EB';
        strokeColor = '#ffffff';
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#2563EB';
      } else if (isHovered && !isOccupied) {
        fillColor = '#38bdf8';
        strokeColor = '#ffffff';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#38bdf8';
      }

      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect(-10, -10, 20, 20, 5);
      ctx.fill();
      ctx.stroke();

      if (isSelected) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-4, 0);
        ctx.lineTo(-1, 3);
        ctx.lineTo(5, -3);
        ctx.stroke();
      }

      if (isOccupied && !isSelected) {
        ctx.strokeStyle = theme === 'dark' ? 'rgba(239, 68, 68, 0.65)' : 'rgba(220, 38, 38, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-4, -4); ctx.lineTo(4, 4);
        ctx.moveTo(4, -4); ctx.lineTo(-4, 4);
        ctx.stroke();
      }

      if (transform.scale >= 0.45) {
        ctx.font = '900 8px Outfit, sans-serif';
        ctx.fillStyle = isSelected ? '#000000' : (isOccupied ? (theme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)') : '#ffffff');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(seat.number), 0, 0);
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

  const getHitSeat = useCallback((x: number, y: number) => {
    const maxRadius = Math.max(12, Math.min(24, 18 / transform.scale));
    let closestSeat: Seat | null = null;
    let minDist = Infinity;

    for (let i = seats.length - 1; i >= 0; i--) {
      const s = seats[i];
      const dx = s.x - x;
      const dy = s.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist <= maxRadius && dist < minDist) {
        minDist = dist;
        closestSeat = s;
      }
    }
    return closestSeat;
  }, [seats, transform.scale]);

  const getHitElement = useCallback((x: number, y: number) => {
    const slop = Math.max(5, 12 / transform.scale);
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      const w = el.w || 100;
      const h = el.h || 100;
      let px = x - el.x;
      let py = y - el.y;
      if (el.angle) {
        const rad = (-el.angle * Math.PI) / 180;
        const rx = px * Math.cos(rad) - py * Math.sin(rad);
        const ry = px * Math.sin(rad) + py * Math.cos(rad);
        px = rx;
        py = ry;
      }
      if (Math.abs(px) <= w / 2 + slop && Math.abs(py) <= h / 2 + slop) {
        return el;
      }
    }
    return null;
  }, [elements, transform.scale]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const { x, y } = getTouchCoords(e);
      setLastMousePos({ x: touch.clientX, y: touch.clientY });

      const hitSeat = getHitSeat(x, y);
      const hitEl = getHitElement(x, y);

      if (isDesignMode) {
        if (activeTool !== 'select') { onChartClick?.(x, y); return; }
        const hit = hitSeat || hitEl;
        if (hit) {
          const id = String(hit.id); let newSelection = selectedIds;
          if (!selectedIds.includes(id)) { newSelection = [id]; setSelectedIds(newSelection); onSelect?.(newSelection); }
          const snapshot = new Map();
          newSelection.forEach(sid => {
            const s = seats.find(st => String(st.id) === sid), el = elements.find(elObj => String(elObj.id) === sid);
            if (s) snapshot.set(sid, { x: s.x, y: s.y }); else if (el) snapshot.set(sid, { x: el.x, y: el.y });
          });
          const hitSlop = 20 / transform.scale;
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
    const container = containerRef.current;
    const cW = container?.clientWidth || 800;
    const cH = container?.clientHeight || 600;

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
        setTransform(prev => {
          const nextX = prev.x + (touch.clientX - lastMousePos.x);
          const nextY = prev.y + (touch.clientY - lastMousePos.y);
          const fitScale = calculateFitTransform(bounds, cW, cH).scale;
          return clampTransform({ x: nextX, y: nextY, scale: prev.scale }, bounds, cW, cH, fitScale);
        });
        setLastMousePos({ x: touch.clientX, y: touch.clientY });
      }
    } else if (e.touches.length === 2 && lastTouchDistRef.current !== null && allowZoom) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const factor = dist / lastTouchDistRef.current;
      if (factor > 0.5 && factor < 2.0) {
        setTransform(prev => {
          const nextScale = prev.scale * factor;
          const fitScale = calculateFitTransform(bounds, cW, cH).scale;
          return clampTransform({ x: prev.x, y: prev.y, scale: nextScale }, bounds, cW, cH, fitScale);
        });
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
      const hitSeat = getHitSeat(x, y);
      const hitEl = getHitElement(x, y);

      if (isDesignMode) {
        if (activeTool !== 'select') { onChartClick?.(x, y); return; }
        const hit = hitSeat || hitEl;
        if (hit) {
          const id = String(hit.id); let newSelection = selectedIds;
          if (!selectedIds.includes(id)) { newSelection = e.shiftKey ? [...selectedIds, id] : [id]; setSelectedIds(newSelection); onSelect?.(newSelection); }
          const snapshot = new Map();
          newSelection.forEach(sid => {
            const s = seats.find(st => String(st.id) === sid), el = elements.find(e => String(e.id) === sid);
            if (s) snapshot.set(sid, { x: s.x, y: s.y }); else if (el) snapshot.set(sid, { x: el.x, y: el.y });
          });
          const hitSlop = 20 / transform.scale;
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

    const hitSeat = getHitSeat(x, y);
    const hitEl = getHitElement(x, y);
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
    if (isPanning) {
      setTransform(prev => {
        const nextX = prev.x + (e.clientX - lastMousePos.x);
        const nextY = prev.y + (e.clientY - lastMousePos.y);
        const container = containerRef.current;
        const cW = container?.clientWidth || 800;
        const cH = container?.clientHeight || 600;
        const fitScale = calculateFitTransform(bounds, cW, cH).scale;
        return clampTransform({ x: nextX, y: nextY, scale: prev.scale }, bounds, cW, cH, fitScale);
      });
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
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
      {hoveredSeat && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-black/85 backdrop-blur-xl border border-white/20 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center gap-3 text-white text-[11px] font-black uppercase tracking-wider z-20 pointer-events-none transition-all duration-200">
          <span className={cn(
            "w-2.5 h-2.5 rounded-full shrink-0 animate-pulse",
            hoveredSeat.status === 'occupied' || hoveredSeat.status === 'reserved'
              ? "bg-red-500 shadow-[0_0_8px_#ef4444]"
              : String(hoveredSeat.category).toLowerCase() === 'vip'
                ? "bg-amber-400 shadow-[0_0_8px_#f59e0b]"
                : "bg-[#22a6b3] shadow-[0_0_8px_#22a6b3]"
          )} />
          <span>{getSeatTooltipLabel(hoveredSeat)}</span>
          <span className="text-white/30">|</span>
          <span className="text-amber-400 font-extrabold">
            {hoveredSeat.status === 'occupied' || hoveredSeat.status === 'reserved'
              ? 'OCUPADO / RESERVADO'
              : (hoveredSeat.base_price ? `$${Math.round(Number(hoveredSeat.base_price)).toLocaleString('es-MX')} MXN` : 'DISPONIBLE')}
          </span>
        </div>
      )}
      <div className="absolute bottom-6 left-6 flex gap-2 z-10 pointer-events-none">
        <div className="px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full text-[9px] font-black opacity-60 uppercase tracking-widest text-white/50 hidden sm:block">
          Del: Borrar | Shift+Drag: Multi | {effectiveAllowZoom ? 'Scroll: Zoom | ' : ''}Arrastrar: Paneo
        </div>
      </div>
      
      {/* Interactive Zoom Controls & User Preference Toggle */}
      <div className="absolute bottom-6 right-6 flex items-center gap-2 z-20">
        <button
          onClick={toggleUserZoomPreference}
          title={effectiveAllowZoom ? "Guardar preferencia: Fijar zoom" : "Guardar preferencia: Permitir zoom interactivo"}
          className="px-3 py-1.5 bg-black/70 hover:bg-black/90 backdrop-blur-xl border border-white/15 hover:border-amber-400/40 rounded-full text-[10px] font-black text-white/90 uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 shadow-lg pointer-events-auto"
        >
          {effectiveAllowZoom ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Zoom On</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Zoom Fijo</span>
            </>
          )}
        </button>

        {effectiveAllowZoom ? (
          <>
            <button
              onClick={() => handleStepZoom(0.8)}
              title="Alejar Zoom"
              className="w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 text-white/80 border border-white/15 backdrop-blur-xl flex items-center justify-center font-bold text-sm transition-all hover:scale-105 active:scale-95"
            >
              -
            </button>

            <button
              onClick={handleFitToView}
              title="Ajustar mapa a pantalla (Recentrar)"
              className="px-3.5 py-1.5 bg-black/70 hover:bg-black/90 backdrop-blur-xl border border-white/15 hover:border-amber-400/40 rounded-full text-[10px] font-black text-white/90 uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 shadow-lg"
            >
              <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              <span>{Math.round(transform.scale * 100)}%</span>
            </button>

            <button
              onClick={() => handleStepZoom(1.25)}
              title="Acercar Zoom"
              className="w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 text-white/80 border border-white/15 backdrop-blur-xl flex items-center justify-center font-bold text-sm transition-all hover:scale-105 active:scale-95"
            >
              +
            </button>
          </>
        ) : (
          <button
            onClick={handleFitToView}
            title="Ajustar a pantalla"
            className="px-3.5 py-1.5 bg-amber-500/20 backdrop-blur-xl border border-amber-400/30 rounded-full text-[10px] font-black text-amber-300 uppercase tracking-widest flex items-center gap-1.5 shadow-lg pointer-events-auto"
          >
            <span>{Math.round(transform.scale * 100)}%</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default SeatingChart;
