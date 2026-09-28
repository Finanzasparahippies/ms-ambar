import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { cn } from '../lib/utils';
import {
  calculateLayoutBounds,
  calculateFitTransform,
  clampTransform,
  LayoutBounds
} from '../utils/seatingBounds';

export interface Seat {
  id: string | number;
  x: number;
  y: number;
  row: string;
  row_label?: string;
  row_id?: string;
  number: number;
  status: 'available' | 'occupied' | 'selected' | 'reserved';
  category: string;
  angle: number;
  color?: string;
  base_price?: number | string;
  table_id?: string | number;
  tableId?: string | number;
  section?: string;
  is_complimentary_eligible?: boolean;
  is_complimentary_tier?: boolean;
  complimentary_priority?: number;
}

export interface MapElement {
  id: string;
  type?: 'rect' | 'icon' | 'text' | 'circle' | 'table' | 'rounded' | string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  label?: string;
  name?: string;
  tableNumber?: number | string;
  row?: string;
  row_label?: string;
  row_id?: string;
  is_complimentary_tier?: boolean;
  complimentary_priority?: number;
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

export interface SeatingChartProps {
  seats: Seat[];
  theme?: 'light' | 'dark' | any;
  elements?: MapElement[];
  occupancy?: { [key: string]: number };
  isDesignMode?: boolean;
  onUpdate?: (seats: Seat[], elements: MapElement[]) => void;
  onSelect?: (ids: string[]) => void;
  onChartClick?: (x: number, y: number) => void;
  selectedIds?: string[];
  activeTool?: string;
  allowZoom?: boolean;
  restrictedRows?: string[];
  onInvalidSelectionAttempt?: (seat: Seat, activeRows: string[]) => void;
  orphanSeatIds?: (string | number)[];
  highlightPulseTrigger?: number;
  showRowLabels?: boolean;
}

/**
 * Concordancia flexible para determinar si una mesa o elemento forma parte de las filas/mesas prioritarias de cortesía.
 */
export const isElementAllowedByRestriction = (
  el: MapElement,
  allowedRows: string[],
  normalizedAllowedSet: Set<string>,
  seats: Seat[]
): boolean => {
  if (!allowedRows || allowedRows.length === 0) return true;

  // 1. Concordancia directa sobre atributos de la mesa (label, row, name, id)
  const candidateTexts = [el.label, el.row, el.name, el.id].filter(Boolean) as string[];
  for (const text of candidateTexts) {
    const clean = text.trim().toLowerCase();
    const cleanNoFila = clean.replace(/^fila\s+/i, '').trim();
    const cleanNoMesa = clean.replace(/^mesa\s+/i, '').trim();

    if (normalizedAllowedSet.has(clean) || normalizedAllowedSet.has(cleanNoFila) || normalizedAllowedSet.has(cleanNoMesa)) {
      return true;
    }

    for (const raw of allowedRows) {
      const rawClean = raw.trim().toLowerCase();
      const rawNoFila = rawClean.replace(/^fila\s+/i, '').trim();
      const rawNoMesa = rawClean.replace(/^mesa\s+/i, '').trim();
      if (clean === rawClean || cleanNoFila === rawNoFila || cleanNoMesa === rawNoMesa) return true;
      if (clean.includes(rawClean) || rawClean.includes(clean)) return true;
    }
  }

  // 2. Concordancia por asientos hijos pertenecientes a esta mesa
  const childSeats = seats.filter(s => s.tableId === el.id || (el.label && s.row === el.label));
  if (childSeats.length > 0) {
    return childSeats.some(s => {
      if (s.is_complimentary_eligible) return true;
      const sRow = String(s.row || '').trim().toLowerCase();
      const sRowNoFila = sRow.replace(/^fila\s+/i, '').trim();
      const sRowNoMesa = sRow.replace(/^mesa\s+/i, '').trim();

      if (normalizedAllowedSet.has(sRow) || normalizedAllowedSet.has(sRowNoFila) || normalizedAllowedSet.has(sRowNoMesa)) {
        return true;
      }
      for (const raw of allowedRows) {
        const rawClean = raw.trim().toLowerCase();
        const rawNoFila = rawClean.replace(/^fila\s+/i, '').trim();
        const rawNoMesa = rawClean.replace(/^mesa\s+/i, '').trim();
        if (sRow === rawClean || sRowNoFila === rawNoFila || sRowNoMesa === rawNoMesa) return true;
        if (sRow.includes(rawClean) || rawClean.includes(sRow)) return true;
      }
      return false;
    });
  }

  return false;
};

/**
 * Concordancia flexible para determinar si un asiento individual es elegible por la restricción de cortesía.
 */
export const isSeatAllowedByRestriction = (
  seat: Seat,
  allowedRows: string[],
  normalizedAllowedSet: Set<string>,
  elements: MapElement[]
): boolean => {
  if (!allowedRows || allowedRows.length === 0) return true;
  if (seat.is_complimentary_eligible) return true;

  // Validación directa sobre seat.row_letter limpia (ej. 'F')
  const cleanRowLetter = String((seat as any).row_letter || '').replace(/^fila\s*/i, '').trim().toLowerCase();
  if (cleanRowLetter) {
    if (normalizedAllowedSet.has(cleanRowLetter) || normalizedAllowedSet.has(`fila ${cleanRowLetter}`)) {
      return true;
    }
    for (const raw of allowedRows) {
      const rawClean = raw.trim().toLowerCase().replace(/^fila\s*/i, '').trim();
      if (cleanRowLetter === rawClean) return true;
    }
  }

  const candidateTexts = [seat.row, seat.section].filter(Boolean) as string[];
  for (const text of candidateTexts) {
    const clean = String(text).trim().toLowerCase();
    const cleanNoFila = clean.replace(/^fila\s+/i, '').trim();
    const cleanNoMesa = clean.replace(/^mesa\s+/i, '').trim();

    if (normalizedAllowedSet.has(clean) || normalizedAllowedSet.has(cleanNoFila) || normalizedAllowedSet.has(cleanNoMesa)) {
      return true;
    }

    for (const raw of allowedRows) {
      const rawClean = raw.trim().toLowerCase();
      const rawNoFila = rawClean.replace(/^fila\s+/i, '').trim();
      const rawNoMesa = rawClean.replace(/^mesa\s+/i, '').trim();
      if (clean === rawClean || cleanNoFila === rawNoFila || cleanNoMesa === rawNoMesa) return true;
      if (clean.includes(rawClean) || rawClean.includes(clean)) return true;
    }
  }

  // 3. Si el asiento tiene tableId, verificar la mesa padre
  if (seat.tableId) {
    const parentTable = elements.find(el => el.id === seat.tableId);
    if (parentTable) {
      const tableTexts = [parentTable.label, parentTable.row, parentTable.name].filter(Boolean) as string[];
      for (const text of tableTexts) {
        const clean = String(text).trim().toLowerCase();
        const cleanNoFila = clean.replace(/^fila\s+/i, '').trim();
        const cleanNoMesa = clean.replace(/^mesa\s+/i, '').trim();

        if (normalizedAllowedSet.has(clean) || normalizedAllowedSet.has(cleanNoFila) || normalizedAllowedSet.has(cleanNoMesa)) {
          return true;
        }

        for (const raw of allowedRows) {
          const rawClean = raw.trim().toLowerCase();
          const rawNoFila = rawClean.replace(/^fila\s+/i, '').trim();
          const rawNoMesa = rawClean.replace(/^mesa\s+/i, '').trim();
          if (clean === rawClean || cleanNoFila === rawNoFila || cleanNoMesa === rawNoMesa) return true;
          if (clean.includes(rawClean) || rawClean.includes(clean)) return true;
        }
      }
    }
  }

  return false;
};

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
  allowZoom = true,
  restrictedRows = [],
  onInvalidSelectionAttempt,
  orphanSeatIds = [],
  highlightPulseTrigger = 0,
  showRowLabels = true,
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
  const pulseEndTimeRef = useRef<number>(0);

  useEffect(() => {
    if (highlightPulseTrigger) {
      pulseEndTimeRef.current = Date.now() + 2500;
    }
  }, [highlightPulseTrigger]);

  const orphanSeatSet = useMemo(() => new Set((orphanSeatIds || []).map(id => String(id))), [orphanSeatIds]);

  const hasRowRestriction = useMemo(() => Array.isArray(restrictedRows) && restrictedRows.length > 0, [restrictedRows]);
  const normalizedRestrictedRows = useMemo(() => new Set(
    hasRowRestriction
      ? restrictedRows.map(r => String(r || '').toLowerCase().replace(/^fila\s+/i, '').trim())
      : []
  ), [hasRowRestriction, restrictedRows]);

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

  const getSeatTooltipDetails = useCallback((seat: Seat) => {
    const tableId = (seat as any).tableId || (seat as any).table_id;
    let tableEl: MapElement | undefined;
    if (tableId) {
      tableEl = elements.find(el => String(el.id) === String(tableId));
    }
    if (!tableEl && seat.x !== undefined && seat.y !== undefined) {
      tableEl = elements.find(el => (el.type === 'table' || el.tableShape) && Math.hypot(el.x - seat.x, el.y - seat.y) <= 80);
    }
    if (!tableEl && seat.row) {
      const rowLower = String(seat.row).toLowerCase();
      tableEl = elements.find(el => el.type === 'table' && el.label && String(el.label).toLowerCase() === rowLower);
    }

    // Fila limpia (row_letter)
    let rowLetter = (seat as any).row_letter;
    if (!rowLetter) {
      const cand = (tableEl && (tableEl.row || tableEl.row_label)) || seat.row || '';
      const cleanCand = String(cand).replace(/^fila\s*/i, '').trim();
      if (cleanCand && !cleanCand.toLowerCase().startsWith('mesa')) {
        rowLetter = cleanCand.toUpperCase();
      }
    } else {
      rowLetter = String(rowLetter).replace(/^fila\s*/i, '').trim().toUpperCase();
    }

    // Mesa limpia (table_number)
    let tableNum = (seat as any).table_number;
    if (tableNum === undefined && tableEl?.label) {
      const match = String(tableEl.label).match(/\d+/);
      if (match) tableNum = match[0];
    }
    if (tableNum === undefined && seat.row && String(seat.row).toLowerCase().includes('mesa')) {
      const match = String(seat.row).match(/\d+/);
      if (match) tableNum = match[0];
    }

    // Título estructurado: Fila F · Mesa 5 (o Fila F o Mesa 5)
    const titleParts: string[] = [];
    if (rowLetter) titleParts.push(`Fila ${rowLetter}`);
    if (tableNum !== undefined && String(tableNum).trim() !== '') titleParts.push(`Mesa ${tableNum}`);
    const title = titleParts.length > 0 ? titleParts.join(' · ') : (seat.section || 'General');

    // Subtítulo estructurado: Asiento #13
    const subtitle = `Asiento #${seat.number}`;

    // Estado / Precio: $500.00 MXN o estado ocupado
    const isOccupied = seat.status === 'occupied' || seat.status === 'reserved';
    const priceText = isOccupied
      ? 'OCUPADO'
      : (seat.base_price ? `$${Number(seat.base_price).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN` : '$500.00 MXN');

    return {
      title,
      subtitle,
      priceText,
      isOccupied
    };
  }, [elements]);

  const getSeatTooltipLabel = useCallback((seat: Seat) => {
    const details = getSeatTooltipDetails(seat);
    return `${details.title} • ${details.subtitle}`;
  }, [getSeatTooltipDetails]);

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

    // ─── Render Row Bands & Guides (when showRowLabels is true) ───
    if (showRowLabels) {
      interface RowGuideEntry {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        tablesTotalY: number;
        tablesCount: number;
        standaloneTotalY: number;
        standaloneCount: number;
        isVIP: boolean;
        priority?: number;
        count: number;
      }
      const rowBoundsMap = new Map<string, RowGuideEntry>();

      // 1. Recorrer elementos (mesas y bloques principales) agrupados por fila
      elements.forEach(el => {
        const rowKey = String(el.row || '').trim();
        if (!rowKey) return;
        const halfW = (el.w || 100) / 2 + 25;
        const halfH = (el.h || 100) / 2 + 25;
        const entry = rowBoundsMap.get(rowKey) || {
          minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity,
          tablesTotalY: 0, tablesCount: 0,
          standaloneTotalY: 0, standaloneCount: 0,
          isVIP: !!el.is_complimentary_tier, priority: el.complimentary_priority,
          count: 0
        };
        entry.minX = Math.min(entry.minX, el.x - halfW);
        entry.maxX = Math.max(entry.maxX, el.x + halfW);
        entry.minY = Math.min(entry.minY, el.y - halfH);
        entry.maxY = Math.max(entry.maxY, el.y + halfH);
        entry.tablesTotalY += el.y;
        entry.tablesCount++;
        entry.count++;
        if (el.is_complimentary_tier) entry.isVIP = true;
        if (el.complimentary_priority && (!entry.priority || el.complimentary_priority < entry.priority)) {
          entry.priority = el.complimentary_priority;
        }
        rowBoundsMap.set(rowKey, entry);
      });

      // 2. Recorrer ÚNICAMENTE asientos verdaderamente independientes (standalone)
      // Los asientos vinculados a mesas están delimitados por sus mesas para evitar que asientos con row stale desalineen la fila
      const knownTableIds = new Set(elements.map(e => String(e.id)));
      seats.forEach(s => {
        const rowKey = String(s.row || '').trim();
        if (!rowKey || rowKey.toLowerCase().startsWith('mesa')) return;

        const tid = s.tableId || s.table_id;
        const isChildOfTable = (tid && knownTableIds.has(String(tid))) ||
          elements.some(el => (el.type === 'table' || el.tableShape) && Math.hypot(el.x - s.x, el.y - s.y) <= 75);

        if (isChildOfTable) return;

        const entry = rowBoundsMap.get(rowKey) || {
          minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity,
          tablesTotalY: 0, tablesCount: 0,
          standaloneTotalY: 0, standaloneCount: 0,
          isVIP: !!s.is_complimentary_tier, priority: s.complimentary_priority,
          count: 0
        };
        entry.minX = Math.min(entry.minX, s.x - 20);
        entry.maxX = Math.max(entry.maxX, s.x + 20);
        entry.minY = Math.min(entry.minY, s.y - 20);
        entry.maxY = Math.max(entry.maxY, s.y + 20);
        entry.standaloneTotalY += s.y;
        entry.standaloneCount++;
        entry.count++;
        if (s.is_complimentary_tier) entry.isVIP = true;
        rowBoundsMap.set(rowKey, entry);
      });

      // Draw Row Guides & Badges
      rowBoundsMap.forEach((bounds, rowName) => {
        if (bounds.minX === Infinity) return;
        // Si la fila tiene mesas, la altura de la guía es el promedio exacto de las mesas
        const centerY = bounds.tablesCount > 0
          ? (bounds.tablesTotalY / bounds.tablesCount)
          : bounds.standaloneCount > 0
            ? (bounds.standaloneTotalY / bounds.standaloneCount)
            : (bounds.minY + bounds.maxY) / 2;

        const leftX = bounds.minX - 65;
        const rightX = bounds.maxX + 65;

        ctx.save();
        // Dashed horizontal guideline
        ctx.setLineDash([5, 8]);
        ctx.strokeStyle = bounds.isVIP
          ? 'rgba(245, 158, 11, 0.4)'
          : (theme === 'dark' ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.09)');
        ctx.lineWidth = bounds.isVIP ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(leftX + 45, centerY);
        ctx.lineTo(rightX - 45, centerY);
        ctx.stroke();

        // Badge parameters
        ctx.setLineDash([]);
        const displayLabel = rowName.toUpperCase();
        ctx.font = '900 10.5px Outfit, sans-serif';
        const labelWidth = ctx.measureText(displayLabel).width;
        const badgeW = Math.max(68, labelWidth + 24);
        const badgeH = 24;

        // Left Badge Pill
        ctx.fillStyle = bounds.isVIP
          ? (theme === 'dark' ? 'rgba(245, 158, 11, 0.18)' : 'rgba(245, 158, 11, 0.15)')
          : (theme === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(241, 245, 249, 0.95)');
        ctx.strokeStyle = bounds.isVIP ? '#F59E0B' : (theme === 'dark' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.22)');
        ctx.lineWidth = bounds.isVIP ? 2 : 1;

        if (bounds.isVIP) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#F59E0B';
        }

        ctx.beginPath();
        ctx.roundRect(leftX - badgeW / 2, centerY - badgeH / 2, badgeW, badgeH, 12);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = bounds.isVIP ? '#F59E0B' : (theme === 'dark' ? '#F8FAFC' : '#0F172A');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayLabel, leftX, centerY);

        if (bounds.isVIP) {
          ctx.font = '800 7.5px Outfit, sans-serif';
          ctx.fillStyle = '#FEF08A';
          ctx.fillText(`VIP • P${bounds.priority || 1}`, leftX, centerY - 16);
        }

        // Right Badge Pill
        ctx.fillStyle = bounds.isVIP
          ? (theme === 'dark' ? 'rgba(245, 158, 11, 0.18)' : 'rgba(245, 158, 11, 0.15)')
          : (theme === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(241, 245, 249, 0.95)');
        ctx.strokeStyle = bounds.isVIP ? '#F59E0B' : (theme === 'dark' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.22)');
        ctx.lineWidth = bounds.isVIP ? 2 : 1;
        if (bounds.isVIP) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#F59E0B';
        }

        ctx.font = '900 10.5px Outfit, sans-serif';
        ctx.beginPath();
        ctx.roundRect(rightX - badgeW / 2, centerY - badgeH / 2, badgeW, badgeH, 12);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = bounds.isVIP ? '#F59E0B' : (theme === 'dark' ? '#F8FAFC' : '#0F172A');
        ctx.fillText(displayLabel, rightX, centerY);

        if (bounds.isVIP) {
          ctx.font = '800 7.5px Outfit, sans-serif';
          ctx.fillStyle = '#FEF08A';
          ctx.fillText(`VIP • P${bounds.priority || 1}`, rightX, centerY - 16);
        }

        ctx.restore();
      });
    }

    // Render Elements
    elements.forEach(el => {
      ctx.save(); ctx.translate(el.x, el.y); ctx.rotate((el.angle || 0) * Math.PI / 180);
      const isSelected = selectedSet.has(el.id);
      const isHovered = hoveredId === el.id;
      const sides = el.sides ?? (el.type === 'circle' ? 0 : 4), w = el.w || 100, h = el.h || 100;
      const shapeType = el.type || 'rect';
      const isTable = shapeType === 'table' || !!el.tableShape || !!el.table_shape;
      const isAllowedTable = !hasRowRestriction || isElementAllowedByRestriction(el, restrictedRows, normalizedRestrictedRows, seats);

      if (hasRowRestriction && isTable && !isAllowedTable) {
        ctx.globalAlpha = 0.25;
      }

      const now = Date.now();
      const isHighPulse = pulseEndTimeRef.current > now;
      const pulseNorm = 0.5 + 0.5 * Math.sin(now / (isHighPulse ? 140 : 320));

      if (isSelected) {
        ctx.shadowBlur = 15; ctx.shadowColor = '#FFBF00';
      } else if (hasRowRestriction && isTable && isAllowedTable) {
        const haloBlur = isHighPulse ? (24 + pulseNorm * 16) : (14 + pulseNorm * 8);
        ctx.shadowBlur = haloBlur;
        ctx.shadowColor = '#F59E0B';
      } else if (isHovered) {
        ctx.shadowBlur = 10; ctx.shadowColor = theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
      }

      if (el.isGA) {
        ctx.setLineDash([5, 5]);
        ctx.fillStyle = el.color || (theme === 'dark' ? 'rgba(255,191,0,0.05)' : 'rgba(255,191,0,0.05)');
      } else {
        ctx.setLineDash([]);
        ctx.fillStyle = el.color || (theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)');
      }

      if (isSelected) {
        ctx.strokeStyle = '#FFBF00';
        ctx.lineWidth = 3;
      } else if (hasRowRestriction && isTable && isAllowedTable) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
      } else if (isHovered) {
        ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1.5;
      }

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
      const tableLabel = el.label || el.name || (el.tableNumber ? `Mesa ${el.tableNumber}` : (isTable ? 'Mesa' : ''));
      if (tableLabel) {
        const themeObj = typeof theme === 'object' ? (theme as any) : null;
        const headingColor = (hasRowRestriction && isAllowedTable && isTable)
          ? '#F59E0B'
          : (themeObj?.headingColor || themeObj?.primaryColor || (theme === 'dark' ? '#E5A93B' : '#000'));
        const textColor = themeObj?.textColor || (theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)');

        const hasRowSubtitle = (!!el.row && !el.isGA) || (hasRowRestriction && isAllowedTable && isTable);
        ctx.font = '800 12px Outfit';
        ctx.fillStyle = isSelected ? '#000' : headingColor;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(tableLabel.toUpperCase(), 0, (el.isGA && el.capacity) ? -8 : (hasRowSubtitle ? -7 : 0));

        if (hasRowSubtitle) {
          ctx.font = '800 8px Outfit';
          ctx.fillStyle = isSelected
            ? 'rgba(0,0,0,0.7)'
            : ((hasRowRestriction && isAllowedTable && isTable)
                ? '#F59E0B'
                : (el.is_complimentary_tier ? '#F59E0B' : (theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)')));
          const subText = (hasRowRestriction && isAllowedTable && isTable) ? '⭐ CORTESÍA' : String(el.row || '').toUpperCase();
          ctx.fillText(subText, 0, 9);
        }

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

      // Verificar si el asiento pertenece a la fila o mesa permitida por cortesía
      const isAllowedByRestriction = isSeatAllowedByRestriction(seat, restrictedRows, normalizedRestrictedRows, elements);

      if (hasRowRestriction && !isAllowedByRestriction) {
        ctx.globalAlpha = 0.25;
      }
      
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

      // Halo / Resplandor Ámbar Pulsante para fila designada de cortesía activa
      const now = Date.now();
      const isHighPulse = pulseEndTimeRef.current > now;
      const pulseNorm = 0.5 + 0.5 * Math.sin(now / (isHighPulse ? 140 : 320));

      if (hasRowRestriction && isAllowedByRestriction && !isOccupied && !isSelected) {
        ctx.save();
        const haloSize = 22 + pulseNorm * (isHighPulse ? 10 : 5);
        const haloBlur = isHighPulse ? (18 + pulseNorm * 14) : (10 + pulseNorm * 6);
        ctx.shadowBlur = haloBlur;
        ctx.shadowColor = '#F59E0B';
        ctx.strokeStyle = isHighPulse ? '#FEF08A' : '#F59E0B';
        ctx.lineWidth = isHighPulse ? 3 : 2;
        ctx.beginPath();
        ctx.roundRect(-haloSize / 2, -haloSize / 2, haloSize, haloSize, 7);
        ctx.stroke();

        if (isHighPulse) {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
          ctx.lineWidth = 1.5;
          const outerSize = haloSize + 8;
          ctx.beginPath();
          ctx.roundRect(-outerSize / 2, -outerSize / 2, outerSize, outerSize, 9);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Regla Anti-Asiento Huérfano: Resaltar en ámbar preventivo si este asiento quedaría aislado
      const isOrphanSeat = orphanSeatSet.has(String(seat.id));
      if (isOrphanSeat && !isSelected) {
        ctx.save();
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#D97706';
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.roundRect(-14, -14, 28, 28, 8);
        ctx.stroke();
        ctx.restore();
      }

      if (isSelected) {
        fillColor = '#2563EB';
        strokeColor = '#ffffff';
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#2563EB';
      } else if (isHovered && !isOccupied && isAllowedByRestriction) {
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
          const isAllowed = isSeatAllowedByRestriction(hitSeat, restrictedRows, normalizedRestrictedRows, elements);
          if (hasRowRestriction && !isAllowed) {
            pulseEndTimeRef.current = Date.now() + 2500;
            onInvalidSelectionAttempt?.(hitSeat, restrictedRows || []);
            return;
          }
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
          const isAllowed = isSeatAllowedByRestriction(hitSeat, restrictedRows, normalizedRestrictedRows, elements);
          if (hasRowRestriction && !isAllowed) {
            pulseEndTimeRef.current = Date.now() + 2500;
            onInvalidSelectionAttempt?.(hitSeat, restrictedRows || []);
            return;
          }
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
      {hoveredSeat && (() => {
        const details = getSeatTooltipDetails(hoveredSeat);
        return (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-[#0d1017]/90 backdrop-blur-2xl border border-amber-500/30 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex items-center gap-3.5 text-white z-20 pointer-events-none transition-all duration-200">
            <span className={cn(
              "w-2.5 h-2.5 rounded-full shrink-0 animate-pulse",
              details.isOccupied
                ? "bg-red-500 shadow-[0_0_8px_#ef4444]"
                : String(hoveredSeat.category).toLowerCase() === 'vip'
                  ? "bg-amber-400 shadow-[0_0_8px_#f59e0b]"
                  : "bg-[#22a6b3] shadow-[0_0_8px_#22a6b3]"
            )} />
            <div className="flex flex-col text-left">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                {details.title}
              </span>
              <span className="text-[11px] font-bold text-white/90">
                {details.subtitle}
              </span>
            </div>
            <div className="h-6 w-[1px] bg-white/15" />
            <span className={cn(
              "text-xs font-black font-mono tracking-tight",
              details.isOccupied ? "text-red-400" : "text-amber-400"
            )}>
              {details.priceText}
            </span>
          </div>
        );
      })()}
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
