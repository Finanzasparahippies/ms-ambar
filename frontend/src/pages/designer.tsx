import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import SeatingChart from '../components/SeatingChart';
import { 
  Save, Plus, Square, Maximize, MousePointer2, 
  ChevronDown, CheckCircle2, AlertCircle, 
  Moon, Sun, Layout as LayoutIcon, 
  Settings2, Layers, Grid3X3, Trash2, 
  Copy, Type, Palette, Compass, RotateCw, 
  Coffee, Trees, Zap, AlignLeft, AlignCenter, 
  AlignRight, AlignVerticalJustifyCenter, 
  ChevronUp, ChevronDown as ChevronDownIcon,
  X, Info, Circle as CircleIcon, Triangle, Hexagon, Octagon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function DesignerPage() {
  const [theaters, setTheaters] = useState<any[]>([]);
  const [selectedTheaterId, setSelectedTheaterId] = useState<number | string>('');
  const [seats, setSeats] = useState<any[]>([]);
  const [elements, setElements] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState('select');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [occupancySim, setOccupancySim] = useState<any>({});
  
  // History System (Undo/Redo)
  const [history, setHistory] = useState<{ seats: any[], elements: any[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Advanced UI states
  const [batchPanel, setBatchPanel] = useState<{ type: 'grid' | 'arc' | 'stadium', isOpen: boolean }>({ type: 'grid', isOpen: false });
  const [batchConfig, setBatchConfig] = useState({ 
    count: 12, 
    rowLabel: 'A', 
    category: 'standard', 
    rowsCount: 1, 
    rowSpacing: 35,
    aisleCount: 0,
    arcAngle: 120,
    uniformDensity: true
  });
  const [clipboard, setClipboard] = useState<{ seats: any[], elements: any[] } | null>(null);
  const rotationRef = useRef<{ centroid: { x: number, y: number }, initialStates: Map<string, any> } | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 
    (typeof window !== 'undefined' && window.location.origin.includes('github.dev') 
      ? window.location.origin.replace(window.location.port, '8000') + '/api' 
      : 'http://localhost:8000/api');

  useEffect(() => {
    const fetchTheaters = async () => {
      try {
        const res = await fetch(`${apiUrl}/tickets/theaters/`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setTheaters(data);
        if (data.length > 0) {
          setSelectedTheaterId(data[0].id);
          loadTheater(data[0]);
        }
      } catch (error) {
        console.error("Failed to fetch theaters:", error);
      }
    };
    fetchTheaters();
  }, []);

  const addToHistory = (s: any[], e: any[]) => {
    const newState = { seats: s, elements: e };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setSeats(prevState.seats); setElements(prevState.elements);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setSeats(nextState.seats); setElements(nextState.elements);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const handleCopy = () => {
    if (selectedIds.length === 0) return;
    const copiedSeats = seats.filter(s => selectedIds.includes(String(s.id)));
    const copiedEls = elements.filter(e => selectedIds.includes(String(e.id)));
    setClipboard({ seats: copiedSeats, elements: copiedEls });
  };

  const handlePaste = () => {
    if (!clipboard) return;
    const offset = 30;
    const newSeats = clipboard.seats.map(s => ({ ...s, id: `seat-${crypto.randomUUID()}`, x: s.x + offset, y: s.y + offset }));
    const newEls = clipboard.elements.map(e => ({ ...e, id: `el-${crypto.randomUUID()}`, x: e.x + offset, y: e.y + offset }));
    const updatedSeats = [...seats, ...newSeats];
    const updatedEls = [...elements, ...newEls];
    setSeats(updatedSeats); setElements(updatedEls);
    setSelectedIds([...newSeats.map(s => s.id), ...newEls.map(e => e.id)]);
    addToHistory(updatedSeats, updatedEls);
  };

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'c') { handleCopy(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'v') { handlePaste(); }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [historyIndex, history, selectedIds, clipboard, seats, elements]);

  const getNextRowLabel = (label: string) => {
    let res = ""; let i = label.length - 1; let carry = true;
    while (i >= 0 || carry) {
      let char = i >= 0 ? label.charCodeAt(i) : 64;
      if (carry) { char++; if (char > 90) { char = 65; carry = true; } else { carry = false; } }
      res = String.fromCharCode(char) + res; i--;
    }
    return res;
  };

  const loadTheater = (theater: any) => {
    const layout = theater.layout || {};
    const s = (layout.seats || []).map((seat: any, idx: number) => ({ ...seat, id: seat.id ?? `seat-init-${idx}-${crypto.randomUUID()}` }));
    const e = (layout.map_elements || []).map((el: any, idx: number) => ({ ...el, id: el.id ?? `el-init-${idx}-${crypto.randomUUID()}` }));
    setSeats(s); setElements(e); setHistory([{ seats: s, elements: e }]); setHistoryIndex(0);
    const sim: any = {}; e.forEach((el: any) => { if (el.isGA && el.capacity) sim[el.id] = Math.floor(el.capacity * 0.4); });
    setOccupancySim(sim);
  };

  const handleTheaterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value; setSelectedTheaterId(id);
    const theater = theaters.find(t => t.id.toString() === id.toString());
    if (theater) loadTheater(theater);
  };

  const handleUpdate = (updatedSeats: any[], updatedElements: any[]) => {
    setSeats(updatedSeats); setElements(updatedElements);
    addToHistory(updatedSeats, updatedElements);
  };

  const saveToDB = async () => {
    if (!selectedTheaterId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`${apiUrl}/tickets/theaters/${selectedTheaterId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: { map_elements: elements, seats: seats } })
      });
      if (response.ok) { setSaveStatus('success'); setTimeout(() => setSaveStatus('idle'), 3000); } else { setSaveStatus('error'); }
    } catch (error) { setSaveStatus('error'); } finally { setIsSaving(false); }
  };

  const alignSelected = (type: string) => {
    if (selectedIds.length < 2) return;
    const selectedSeats = seats.filter(s => selectedIds.includes(String(s.id)));
    const selectedEls = elements.filter(e => selectedIds.includes(e.id));
    const all = [...selectedSeats, ...selectedEls];
    let newSeats = [...seats]; let newEls = [...elements];
    if (type === 'left') {
      const minX = Math.min(...all.map(i => i.x));
      newSeats = seats.map(s => selectedIds.includes(String(s.id)) ? { ...s, x: minX } : s);
      newEls = elements.map(e => selectedIds.includes(e.id) ? { ...e, x: minX } : e);
    } else if (type === 'top') {
      const minY = Math.min(...all.map(i => i.y));
      newSeats = seats.map(s => selectedIds.includes(String(s.id)) ? { ...s, y: minY } : s);
      newEls = elements.map(e => selectedIds.includes(e.id) ? { ...e, y: minY } : e);
    }
    setSeats(newSeats); setElements(newEls); addToHistory(newSeats, newEls);
  };

  const moveLayer = (direction: 'up' | 'down') => {
    if (selectedIds.length !== 1) return;
    const id = selectedIds[0]; const isEl = elements.some(e => e.id === id);
    if (!isEl) return;
    const idx = elements.findIndex(e => e.id === id); const newEls = [...elements];
    if (direction === 'up' && idx < elements.length - 1) [newEls[idx], newEls[idx+1]] = [newEls[idx+1], newEls[idx]];
    else if (direction === 'down' && idx > 0) [newEls[idx], newEls[idx-1]] = [newEls[idx-1], newEls[idx]];
    setElements(newEls); addToHistory(seats, newEls);
  };

  const addElement = (type: string, label: string, color: string, x: number = 500, y: number = 500) => {
    const newEl = { id: `el-${crypto.randomUUID()}`, type: 'rect', x, y, w: 150, h: 100, label, color, angle: 0, sides: 4 };
    const newEls = [...elements, newEl]; setElements(newEls); setSelectedIds([newEl.id]); addToHistory(seats, newEls); setActiveTool('select');
  };

  const confirmBatchSeats = (x: number = 500, y: number = 500) => {
    const { rowLabel, category, rowsCount, rowSpacing, aisleCount, arcAngle } = batchConfig;
    const type = batchPanel.type;
    let allNewSeats: any[] = [];
    let currentRowLabel = rowLabel;
    const baseRadius = 350;
    const seatSpacing = 35;
    const aisleWidth = 70;

    for (let r = 0; r < rowsCount; r++) {
      const currentRadius = baseRadius + (r * rowSpacing);
      const straightLen = 400;
      const semiPerim = Math.PI * currentRadius;
      const arcLen = currentRadius * (arcAngle * Math.PI / 180);

      // Define Geometric Phases with global start/end boundaries
      const phases: { type: 'straight' | 'arc', len: number, startAngle?: number, startDist: number, endDist: number }[] = [];
      let accumulatedDist = 0;

      if (type === 'grid') {
        phases.push({ type: 'straight', len: 800, startDist: 0, endDist: 800 });
      } else if (type === 'arc') {
        phases.push({ type: 'arc', len: arcLen, startAngle: -(arcAngle / 2), startDist: 0, endDist: arcLen });
      } else if (type === 'stadium') {
        const pLen = [straightLen, semiPerim, straightLen, semiPerim];
        const pStartAng = [0, -90, 0, 90];
        pLen.forEach((len, i) => {
          phases.push({ type: i % 2 === 0 ? 'straight' : 'arc', len, startAngle: pStartAng[i], startDist: accumulatedDist, endDist: accumulatedDist + len });
          accumulatedDist += len;
        });
      }

      const totalPerimeter = phases[phases.length - 1].endDist;
      
      // Define Aisle Anchors per phase to ensure vertical/radial alignment
      const getIsInAisle = (pIdx: number, dInPhase: number, pLen: number) => {
        if (aisleCount <= 0) return false;
        // Distribute aisle count across phases
        const aislesPerPhase = Math.max(1, Math.floor(aisleCount / phases.length));
        for (let i = 1; i <= aislesPerPhase; i++) {
          const targetDist = (i / (aislesPerPhase + 1)) * pLen;
          if (Math.abs(dInPhase - targetDist) < (aisleWidth / 2)) return true;
        }
        return false;
      };

      let currentGlobalDist = 0;
      let seatNumberInRow = 1;

      while (currentGlobalDist < totalPerimeter) {
        // 1. Find Current Phase
        const phaseIdx = phases.findIndex(p => currentGlobalDist >= p.startDist && currentGlobalDist < p.endDist);
        if (phaseIdx === -1) break;
        const phase = phases[phaseIdx];
        const distInPhase = currentGlobalDist - phase.startDist;
        const globalNorm = currentGlobalDist / totalPerimeter;

        // 2. Aisle Check (Using Per-Phase distance for absolute alignment)
        const isInAisle = getIsInAisle(phaseIdx, distInPhase, phase.len);

        if (isInAisle) {
          currentGlobalDist += aisleWidth;
          continue;
        }

        const id = `seat-${crypto.randomUUID()}`;
        let seatPos = { x: 0, y: 0, angle: 0 };

        if (type === 'grid') {
          seatPos = { x: x + currentGlobalDist, y: y + r * rowSpacing, angle: 0 };
        } else if (type === 'arc') {
          const angDeg = phase.startAngle! + (distInPhase / currentRadius) * (180 / Math.PI);
          const angRad = angDeg * Math.PI / 180;
          seatPos = { x: x + Math.sin(angRad) * currentRadius, y: y + Math.cos(angRad) * currentRadius, angle: -angDeg };
        } else if (type === 'stadium') {
          if (phaseIdx === 0) { // Bottom
            seatPos = { x: x - straightLen / 2 + distInPhase, y: y + currentRadius, angle: 0 };
          } else if (phaseIdx === 1) { // Right Arc (Clockwise from Bottom to Top)
            const ang = (Math.PI / 2) - (distInPhase / currentRadius);
            seatPos = { x: x + straightLen / 2 + Math.cos(ang) * currentRadius, y: y + Math.sin(ang) * currentRadius, angle: -(ang * 180 / Math.PI) - 90 };
          } else if (phaseIdx === 2) { // Top
            seatPos = { x: x + straightLen / 2 - distInPhase, y: y - currentRadius, angle: 180 };
          } else if (phaseIdx === 3) { // Left Arc (Clockwise from Top to Bottom)
            const ang = (3 * Math.PI / 2) - (distInPhase / currentRadius);
            seatPos = { x: x - straightLen / 2 + Math.cos(ang) * currentRadius, y: y + Math.sin(ang) * currentRadius, angle: -(ang * 180 / Math.PI) - 90 };
          }
        }
      
        allNewSeats.push({ id, ...seatPos, row: currentRowLabel, number: seatNumberInRow++, status: 'available', category });
        currentGlobalDist += seatSpacing;
      }
      currentRowLabel = getNextRowLabel(currentRowLabel);
    }

    const updatedSeats = [...seats, ...allNewSeats];
    setSeats(updatedSeats);
    setSelectedIds(allNewSeats.map(s => s.id));
    setBatchPanel({ ...batchPanel, isOpen: false });
    addToHistory(updatedSeats, elements);
    setActiveTool('select');
  };

  const handleChartClick = (x: number, y: number) => {
    if (activeTool === 'zone') addElement('rect', 'ZONA', 'rgba(34,166,179,0.1)', x, y);
    else if (activeTool === 'stage') addElement('rect', 'ESCENARIO', 'rgba(255,191,0,0.15)', x, y);
    else if (['grid', 'arc', 'stadium'].includes(activeTool)) confirmBatchSeats(x, y);
  };

  const updateSelectedProperty = (key: string, value: any) => {
    if (key === 'angle' && selectedIds.length > 1) {
      if (!rotationRef.current) {
        const selectedSeats = seats.filter(s => selectedIds.includes(String(s.id)));
        const selectedEls = elements.filter(e => selectedIds.includes(String(e.id)));
        const all = [...selectedSeats, ...selectedEls];
        const cx = all.reduce((acc, i) => acc + i.x, 0) / all.length;
        const cy = all.reduce((acc, i) => acc + i.y, 0) / all.length;
        const states = new Map();
        all.forEach(item => {
          states.set(String(item.id), { x: item.x, y: item.y, angle: item.angle || 0 });
        });
        rotationRef.current = { centroid: { x: cx, y: cy }, initialStates: states };
      }
      const { centroid, initialStates } = rotationRef.current;
      const firstId = selectedIds[0];
      const initialStateFirst = initialStates.get(firstId);
      if (!initialStateFirst) return;
      const deltaAngle = (value - initialStateFirst.angle) * Math.PI / 180;
      const cos = Math.cos(deltaAngle);
      const sin = Math.sin(deltaAngle);
      const newSeats = seats.map(s => {
        if (!selectedIds.includes(String(s.id))) return s;
        const state = initialStates.get(String(s.id));
        if (!state) return s;
        const dx = state.x - centroid.x;
        const dy = state.y - centroid.y;
        return {
          ...s,
          x: centroid.x + dx * cos - dy * sin,
          y: centroid.y + dx * sin + dy * cos,
          angle: (state.angle + (value - initialStateFirst.angle)) % 360
        };
      });
      const newEls = elements.map(el => {
        if (!selectedIds.includes(String(el.id))) return el;
        const state = initialStates.get(String(el.id));
        if (!state) return el;
        const dx = state.x - centroid.x;
        const dy = state.y - centroid.y;
        return {
          ...el,
          x: centroid.x + dx * cos - dy * sin,
          y: centroid.y + dx * sin + dy * cos,
          angle: (state.angle + (value - initialStateFirst.angle)) % 360
        };
      });
      setSeats(newSeats);
      setElements(newEls);
      return;
    }
    const newSeats = seats.map(s => selectedIds.includes(String(s.id)) ? { ...s, [key]: value } : s);
    const newEls = elements.map(el => selectedIds.includes(String(el.id)) ? { ...el, [key]: value } : el);
    setSeats(newSeats);
    setElements(newEls);
  };

  const commitPropertyChange = () => {
    rotationRef.current = null;
    addToHistory(seats, elements);
  };
  const firstSelected = seats.find(s => selectedIds.includes(String(s.id))) || elements.find(e => selectedIds.includes(String(e.id)));
  const isDark = theme === 'dark';

  return (
    <div className={cn("h-screen w-screen overflow-hidden flex flex-col font-sans transition-colors duration-500", isDark ? "bg-[#06070b] text-white" : "bg-slate-50 text-slate-900")}>
      <Head><title>Nectar Studio Pro | Venue Architecture</title></Head>

      <header className={cn("h-20 px-8 border-b flex items-center justify-between z-50 backdrop-blur-3xl transition-all", isDark ? "border-white/5 bg-black/40" : "border-slate-200 bg-white/70")}>
        <div className="flex items-center gap-8">
          <motion.div whileHover={{ scale: 1.05 }} className="flex items-center gap-3 group cursor-pointer" onClick={() => setSelectedIds([])}>
            <div className="w-10 h-10 bg-amber-honey rounded-xl flex items-center justify-center shadow-glow"><LayoutIcon size={22} className="text-nature-night" /></div>
            <div className="flex flex-col"><span className={cn("text-[11px] font-black uppercase tracking-[0.4em] leading-none", isDark ? "text-white/90" : "text-slate-900")}>Nectar Studio</span><span className="text-[8px] font-bold text-amber-honey/50 uppercase tracking-[0.2em] mt-1">Architecture Pro</span></div>
          </motion.div>
          <div className={cn("h-8 w-px mx-2", isDark ? "bg-white/10" : "bg-slate-200")} />
          <div className="relative group">
            <select value={selectedTheaterId} onChange={handleTheaterChange} className={cn("px-5 py-2.5 rounded-xl text-[11px] font-bold outline-none border transition-all appearance-none cursor-pointer pr-10 min-w-[180px]", isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-100 border-slate-200 text-slate-900")}>
              {theaters.map(t => <option key={t.id} value={t.id} className={isDark ? "bg-[#0b0d17]" : "bg-white"}>{t.name}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-honey/50 pointer-events-none" size={14} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={undo} disabled={historyIndex <= 0} className={cn("p-2.5 rounded-lg border transition-all", isDark ? "bg-white/5 border-white/5 hover:bg-white/10" : "bg-slate-100 border-slate-200 hover:bg-slate-200")}><RotateCw size={14} className="-scale-x-100"/></button>
            <button onClick={redo} disabled={historyIndex >= history.length - 1} className={cn("p-2.5 rounded-lg border transition-all", isDark ? "bg-white/5 border-white/5 hover:bg-white/10" : "bg-slate-100 border-slate-200 hover:bg-slate-200")}><RotateCw size={14}/></button>
          </div>
        </div>

        <div className={cn("absolute left-1/2 -translate-x-1/2 flex p-1.5 rounded-2xl border backdrop-blur-3xl shadow-2xl transition-all", isDark ? "bg-white/5 border-white/10" : "bg-white/80 border-slate-200")}>
          {[
            { id: 'select', icon: MousePointer2, label: 'Select' },
            { id: 'grid', icon: Grid3X3, label: 'Add Row', action: () => { setBatchPanel({ type: 'grid', isOpen: true }); setActiveTool('grid'); } },
            { id: 'arc', icon: Compass, label: 'Add Arc', action: () => { setBatchPanel({ type: 'arc', isOpen: true }); setActiveTool('arc'); } },
            { id: 'stadium', icon: Zap, label: 'Stadium', action: () => { setBatchPanel({ type: 'stadium', isOpen: true }); setActiveTool('stadium'); } },
            { id: 'zone', icon: Square, label: 'Zone', action: () => setActiveTool('zone') },
            { id: 'stage', icon: Maximize, label: 'Stage', action: () => setActiveTool('stage') },
          ].map(tool => (
            <button key={tool.id} onClick={tool.action || (() => setActiveTool(tool.id))} className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-all relative group", activeTool === tool.id ? "bg-amber-honey text-nature-night shadow-glow" : isDark ? "text-white/40 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-slate-900 hover:bg-slate-100")}>
              <tool.icon size={20} /><div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-black/90 text-[8px] font-black uppercase rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap tracking-widest z-50">{tool.label}</div>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={cn("w-11 h-11 flex items-center justify-center rounded-xl border transition-all", isDark ? "bg-white/5 border-white/10 text-white/60" : "bg-slate-100 border-slate-200 text-slate-500")}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={saveToDB} disabled={isSaving} className={cn("h-12 px-8 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] transition-all flex items-center gap-3 shadow-glow", saveStatus === 'success' ? "bg-green-500 text-white" : "bg-amber-honey text-nature-night")}>
            {isSaving ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
            {isSaving ? 'Syncing...' : saveStatus === 'success' ? 'Deployed' : 'Push to Production'}
          </motion.button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 relative">
          <SeatingChart seats={seats} elements={elements} isDesignMode={true} theme={theme} selectedIds={selectedIds} activeTool={activeTool} occupancy={occupancySim} onUpdate={handleUpdate} onSelect={setSelectedIds} onChartClick={handleChartClick} />
          
          <div className="absolute top-6 left-6 flex flex-col gap-3 pointer-events-none">
            <div className={cn("px-4 py-2 backdrop-blur-xl border rounded-2xl flex items-center gap-3 shadow-lg w-fit", isDark ? "bg-black/40 border-white/10" : "bg-white/80 border-slate-200")}><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /><span className={cn("text-[10px] font-bold tracking-wider", isDark ? "text-white/50" : "text-slate-500")}>LIVE EDITING MODE</span></div>
            <div className={cn("p-5 backdrop-blur-3xl border rounded-[24px] shadow-2xl flex flex-col gap-4 min-w-[200px]", isDark ? "bg-black/60 border-white/10" : "bg-white/90 border-slate-200")}>
              <div className="flex flex-col gap-1"><span className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-honey">Venue Statistics</span><span className={cn("text-[14px] font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>{seats.length + elements.reduce((acc, el) => acc + (el.isGA ? (el.capacity || 0) : 0), 0)} Total Capacity</span></div>
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400" /><span className={cn("text-[9px] font-bold uppercase tracking-wider", isDark ? "text-white/40" : "text-slate-500")}>Available Seats</span></div><span className={cn("text-[10px] font-black", isDark ? "text-white" : "text-slate-900")}>{seats.filter(s => s.status === 'available').length} / {seats.length}</span></div>
                <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-red-500" /><span className={cn("text-[9px] font-bold uppercase tracking-wider", isDark ? "text-white/40" : "text-slate-500")}>Reserved/Sold</span></div><span className={cn("text-[10px] font-black", isDark ? "text-white" : "text-slate-900")}>{seats.filter(s => s.status !== 'available').length}</span></div>
                <div className="h-px bg-white/5 my-1" />
                <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-honey" /><span className={cn("text-[9px] font-bold uppercase tracking-wider", isDark ? "text-white/40" : "text-slate-500")}>GA Capacity</span></div><span className={cn("text-[10px] font-black", isDark ? "text-white" : "text-slate-900")}>{elements.reduce((acc, el) => acc + (el.isGA ? (el.capacity || 0) : 0), 0)}</span></div>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {batchPanel.isOpen && (
              <motion.div drag dragMomentum={false} initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className={cn("absolute top-1/3 left-1/3 w-80 backdrop-blur-3xl border p-8 rounded-[32px] shadow-2xl z-[100] cursor-move", isDark ? "bg-black/80 border-white/10" : "bg-white/90 border-slate-200")}>
                <div className="flex items-center justify-between mb-8 pointer-events-none">
                  <div className="flex items-center gap-3"><div className="w-8 h-8 bg-amber-honey/20 rounded-lg flex items-center justify-center text-amber-honey">{batchPanel.type === 'grid' ? <Grid3X3 size={16}/> : batchPanel.type === 'arc' ? <Compass size={16}/> : <Zap size={16}/>}</div><h3 className={cn("text-[11px] font-black uppercase tracking-[0.2em]", isDark ? "text-white" : "text-slate-900")}>Add {batchPanel.type}</h3></div>
                  <button onClick={() => setBatchPanel({ ...batchPanel, isOpen: false })} className="text-white/30 hover:text-white transition-colors pointer-events-auto"><X size={18}/></button>
                </div>
                <div className="space-y-5 cursor-default">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Density (Seats/Row)</label><input type="number" value={batchConfig.count} onChange={e => setBatchConfig({...batchConfig, count: parseInt(e.target.value)})} className={cn("w-full border p-3 rounded-xl text-xs font-bold outline-none", isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900")} /></div>
                    <div className="space-y-2"><label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Starting Row</label><input type="text" value={batchConfig.rowLabel} onChange={e => setBatchConfig({...batchConfig, rowLabel: e.target.value})} className={cn("w-full border p-3 rounded-xl text-xs font-bold outline-none", isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900")} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Total Rows</label><input type="number" value={batchConfig.rowsCount} onChange={e => setBatchConfig({...batchConfig, rowsCount: parseInt(e.target.value)})} className={cn("w-full border p-3 rounded-xl text-xs font-bold outline-none", isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900")} /></div>
                    <div className="space-y-2"><label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Row Spacing</label><input type="number" value={batchConfig.rowSpacing} onChange={e => setBatchConfig({...batchConfig, rowSpacing: parseInt(e.target.value)})} className={cn("w-full border p-3 rounded-xl text-xs font-bold outline-none", isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900")} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Aisle Count</label><input type="number" value={batchConfig.aisleCount} onChange={e => setBatchConfig({...batchConfig, aisleCount: parseInt(e.target.value)})} className={cn("w-full border p-3 rounded-xl text-xs font-bold outline-none", isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900")} /></div>
                    {batchPanel.type === 'arc' && (
                      <div className="space-y-2"><label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Arc Angle ({batchConfig.arcAngle}°)</label><input type="range" min="30" max="180" step="10" value={batchConfig.arcAngle} onChange={e => setBatchConfig({...batchConfig, arcAngle: parseInt(e.target.value)})} className="w-full accent-amber-honey" /></div>
                    )}
                  </div>
                  {batchPanel.type === 'arc' && (
                    <div className="flex items-center justify-between px-1"><label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Uniform Density</label><button onClick={() => setBatchConfig({...batchConfig, uniformDensity: !batchConfig.uniformDensity})} className={cn("w-10 h-5 rounded-full relative transition-all", batchConfig.uniformDensity ? "bg-amber-honey" : "bg-white/10")}><div className={cn("absolute top-1 w-3 h-3 rounded-full transition-all", batchConfig.uniformDensity ? "right-1 bg-nature-night" : "left-1 bg-white")} /></button></div>
                  )}
                  <button onClick={() => setBatchPanel({ ...batchPanel, isOpen: false })} className="w-full bg-amber-honey text-nature-night py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-glow">Ready to Place</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <AnimatePresence>
          {selectedIds.length > 0 && (
            <motion.aside initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }} className={cn("w-80 backdrop-blur-3xl border-l flex flex-col z-40 shadow-2xl", isDark ? "bg-[#0b0d17]/80 border-white/10" : "bg-white/90 border-slate-200")}>
              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-10"><div className="flex flex-col"><h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-honey">Properties</h3><span className={cn("text-[8px] font-bold uppercase tracking-widest mt-1", isDark ? "text-white/20" : "text-slate-400")}>{selectedIds.length} Object(s) Selected</span></div><button onClick={() => { const ns = seats.filter(s => !selectedIds.includes(String(s.id))); const ne = elements.filter(e => !selectedIds.includes(String(e.id))); setSeats(ns); setElements(ne); setSelectedIds([]); addToHistory(ns, ne); }} className="w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button></div>
                <div className="space-y-10">
                  {selectedIds.length > 1 && (
                    <div className="space-y-4"><label className="text-[9px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 text-white/30"><AlignLeft size={12}/> Alignment</label><div className="grid grid-cols-4 gap-2">{['left', 'center', 'right', 'top'].map(act => (<button key={act} onClick={() => alignSelected(act)} className={cn("h-12 rounded-xl transition-all flex items-center justify-center", isDark ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200")}><AlignLeft size={16} style={{ transform: act === 'top' ? 'rotate(90deg)' : '' }} /></button>))}</div></div>
                  )}
                  {firstSelected && (
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Style & Appearance</label>
                        <div className="grid grid-cols-6 gap-2">{['#FFBF00', '#22a6b3', '#eb4d4b', '#6ab04c', '#4834d4', '#ffffff'].map(color => (<button key={color} onClick={() => updateSelectedProperty('color', color)} className="h-8 rounded-full border-2 transition-transform hover:scale-110" style={{ backgroundColor: color, borderColor: firstSelected.color === color ? '#FFBF00' : 'rgba(255,255,255,0.1)' }} />))}</div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Category</label>
                        <div className="grid grid-cols-2 gap-2">{['standard', 'vip', 'premium', 'disabled'].map(cat => (<button key={cat} onClick={() => updateSelectedProperty('category', cat)} className={cn("py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all", (firstSelected as any).category === cat ? "bg-amber-honey text-nature-night border-amber-honey" : "bg-white/5 border-white/10 text-white/40")}>{cat}</button>))}</div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Configuration</label>
                        <div className={cn("p-5 rounded-2xl border space-y-6", isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-200")}>
                          <div className="space-y-2"><span className="text-[8px] font-bold uppercase tracking-widest text-white/20">Label / Group</span><div className="flex items-center gap-3"><Type size={14} className="text-amber-honey" /><input type="text" value={selectedIds.length > 1 ? 'MULTIPLE' : (firstSelected.label || firstSelected.row || '')} onChange={(e) => updateSelectedProperty(firstSelected.row ? 'row' : 'label', e.target.value)} onBlur={commitPropertyChange} className={cn("bg-transparent text-[11px] font-bold outline-none w-full", isDark ? "text-white" : "text-slate-900")}/></div></div>
                          {!(firstSelected as any).row && (
                            <div className="flex items-center justify-between"><span className="text-[8px] font-bold uppercase tracking-widest text-white/20">General Admission</span><button onClick={() => { updateSelectedProperty('isGA', !(firstSelected as any).isGA); commitPropertyChange(); }} className={cn("w-10 h-5 rounded-full relative transition-all", (firstSelected as any).isGA ? "bg-amber-honey" : "bg-white/10")}><div className={cn("absolute top-1 w-3 h-3 rounded-full transition-all", (firstSelected as any).isGA ? "right-1 bg-nature-night" : "left-1 bg-white")} /></button></div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between px-1"><label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Orientation</label><span className="text-[9px] font-black text-amber-honey">{firstSelected.angle || 0}°</span></div>
                        <div className={cn("p-6 rounded-2xl border", isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-200")}><input type="range" min="0" max="360" value={firstSelected.angle || 0} onChange={(e) => updateSelectedProperty('angle', parseInt(e.target.value))} onMouseUp={commitPropertyChange} className="w-full accent-amber-honey cursor-pointer"/></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        body { overflow: hidden !important; }
        .shadow-glow { box-shadow: 0 0 25px rgba(255, 191, 0, 0.4); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        input[type='range'] { -webkit-appearance: none; background: rgba(255,255,255,0.05); height: 4px; border-radius: 2px; }
        input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%; background: #FFBF00; cursor: pointer; box-shadow: 0 0 10px rgba(255,191,0,0.5); }
      `}} />
    </div>
  );
}
