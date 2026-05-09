import * as React from 'react';
import { useState, useEffect } from 'react';
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
  ChevronUp, ChevronDown as ChevronDownIcon
} from 'lucide-react';
import { cn } from '../lib/utils';

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

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://potential-fishstick-ww95q4pq4vrc5q55-8000.app.github.dev/api';

  useEffect(() => {
    fetch(`${apiUrl}/tickets/theaters/`)
      .then(res => res.json())
      .then(data => {
        setTheaters(data);
        if (data.length > 0) { setSelectedTheaterId(data[0].id); loadTheater(data[0]); }
      });
  }, []);

  const loadTheater = (theater: any) => {
    const layout = theater.layout || {};
    setSeats(layout.seats || []);
    setElements(layout.map_elements || []);
  };

  const handleTheaterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedTheaterId(id);
    const theater = theaters.find(t => t.id.toString() === id.toString());
    if (theater) loadTheater(theater);
  };

  const handleUpdate = (updatedSeats: any[], updatedElements: any[]) => {
    setSeats(updatedSeats);
    setElements(updatedElements);
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
      if (response.ok) { setSaveStatus('success'); setTimeout(() => setSaveStatus('idle'), 3000); }
      else { setSaveStatus('error'); }
    } catch (error) { setSaveStatus('error'); }
    finally { setIsSaving(false); }
  };

  // --- Pro Actions ---
  const alignSelected = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (selectedIds.length < 2) return;
    const selectedSeats = seats.filter(s => selectedIds.includes(String(s.id)));
    const selectedEls = elements.filter(e => selectedIds.includes(e.id));
    const all = [...selectedSeats, ...selectedEls];
    
    if (type === 'left') {
      const minX = Math.min(...all.map(i => i.x));
      setSeats(seats.map(s => selectedIds.includes(String(s.id)) ? { ...s, x: minX } : s));
      setElements(elements.map(e => selectedIds.includes(e.id) ? { ...e, x: minX } : e));
    } else if (type === 'top') {
      const minY = Math.min(...all.map(i => i.y));
      setSeats(seats.map(s => selectedIds.includes(String(s.id)) ? { ...s, y: minY } : s));
      setElements(elements.map(e => selectedIds.includes(e.id) ? { ...e, y: minY } : e));
    }
  };

  const moveLayer = (direction: 'up' | 'down') => {
    if (selectedIds.length !== 1) return;
    const id = selectedIds[0];
    const isEl = elements.some(e => e.id === id);
    if (!isEl) return;
    
    const idx = elements.findIndex(e => e.id === id);
    const newEls = [...elements];
    if (direction === 'up' && idx < elements.length - 1) {
      [newEls[idx], newEls[idx+1]] = [newEls[idx+1], newEls[idx]];
    } else if (direction === 'down' && idx > 0) {
      [newEls[idx], newEls[idx-1]] = [newEls[idx-1], newEls[idx]];
    }
    setElements(newEls);
  };

  const addElement = (type: string, label: string, color: string) => {
    const newEl = { id: `el-${crypto.randomUUID()}`, type: 'rect', x: 500, y: 500, w: 150, h: 100, label, color, angle: 0, sides: 4 };
    setElements(prev => [...prev, newEl]);
    setSelectedIds([newEl.id]);
  };

  const addBatchSeats = (type: 'grid' | 'arc') => {
    const input = window.prompt(`¿Cuántos asientos?`, "12");
    const count = parseInt(input || "0");
    if (count <= 0) return;
    const newBatch = Array.from({ length: count }).map((_, i) => {
      const id = `seat-${crypto.randomUUID()}`;
      if (type === 'grid') return { id, x: 500 + i * 35, y: 500, row: "A", number: seats.length + i + 1, status: 'available', category: 'standard', angle: 0 };
      const ang = (-60 + i * (120/(count-1))) * Math.PI / 180;
      return { id, x: 500 + Math.sin(ang) * 350, y: 350 + Math.cos(ang) * 350, row: "ARC", number: seats.length + i + 1, status: 'available', category: 'vip', angle: -(-60 + i * (120/(count-1))) };
    });
    setSeats(prev => [...prev, ...newBatch]);
    setSelectedIds(newBatch.map(s => s.id));
  };

  const updateSelectedProperty = (prop: string, value: any) => {
    setSeats(prev => prev.map(s => selectedIds.includes(String(s.id)) ? { ...s, [prop]: value } : s));
    setElements(prev => prev.map(e => selectedIds.includes(e.id) ? { ...e, [prop]: value } : e));
  };

  const firstSelected = seats.find(s => selectedIds.includes(String(s.id))) || elements.find(e => selectedIds.includes(e.id));

  return (
    <div className="h-screen w-screen bg-[#0b0d17] overflow-hidden flex flex-col font-sans text-white">
      <Head><title>Nectar Studio Pro | Architecture Edition</title></Head>

      <header className="h-16 px-6 border-b border-white/5 bg-black/60 backdrop-blur-3xl flex items-center justify-between z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setSelectedIds([])}>
            <div className="w-9 h-9 bg-amber-honey rounded-xl flex items-center justify-center shadow-glow transition-transform group-hover:scale-110">
              <LayoutIcon size={20} className="text-nature-night" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] leading-none">Nectar Studio</span>
              <span className="text-[8px] font-bold opacity-30 uppercase tracking-[0.2em]">Architecture Edition</span>
            </div>
          </div>
          <div className="h-6 w-px bg-white/10 mx-2" />
          <select value={selectedTheaterId} onChange={handleTheaterChange} className="bg-white/5 px-4 py-2 rounded-xl text-[11px] font-bold outline-none border border-white/5 appearance-none cursor-pointer">
            {theaters.map(t => <option key={t.id} value={t.id} className="bg-nature-night">{t.name}</option>)}
          </select>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 flex bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-2xl shadow-2xl">
          {[
            { id: 'select', icon: MousePointer2, label: 'Selección' },
            { id: 'grid', icon: Grid3X3, label: 'Fila Pro', action: () => addBatchSeats('grid') },
            { id: 'arc', icon: Compass, label: 'Arco Pro', action: () => addBatchSeats('arc') },
            { id: 'zone', icon: Square, label: 'Zona', action: () => addElement('rect', 'ZONA', 'rgba(34,166,179,0.1)') },
            { id: 'stage', icon: Maximize, label: 'Stage', action: () => addElement('rect', 'ESCENARIO', 'rgba(255,191,0,0.15)') },
          ].map((tool) => (
            <button key={tool.id} onClick={tool.action} className={cn("w-11 h-11 rounded-xl flex items-center justify-center transition-all relative group", activeTool === tool.id ? "bg-amber-honey text-nature-night shadow-glow" : "text-white/40 hover:text-white hover:bg-white/5")}>
              <tool.icon size={18} />
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-nature-night text-[8px] font-black uppercase rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap">{tool.label}</div>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all">
            {theme === 'dark' ? <Moon size={16} className="text-white/60" /> : <Sun size={16} className="text-amber-honey" />}
          </button>
          <button onClick={saveToDB} disabled={isSaving} className={cn("h-11 px-8 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-glow", saveStatus === 'success' ? "bg-green-500 text-white" : "bg-amber-honey text-nature-night")}>
            {isSaving ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
            {isSaving ? 'Syncing...' : saveStatus === 'success' ? 'Deployed' : 'Push to Production'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 relative bg-dot-pattern">
          <SeatingChart seats={seats} elements={elements} isDesignMode={true} theme={theme} selectedIds={selectedIds} onUpdate={handleUpdate} onSelect={setSelectedIds} />
        </main>

        <aside className={cn("w-80 bg-black/40 backdrop-blur-3xl border-l border-white/10 flex flex-col transition-all duration-500", selectedIds.length === 0 && "translate-x-full w-0 opacity-0")}>
          <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/80">{selectedIds.length > 1 ? `Lote (${selectedIds.length})` : 'Propiedades'}</h3>
              <button onClick={() => { setSeats(seats.filter(s => !selectedIds.includes(String(s.id)))); setElements(elements.filter(e => !selectedIds.includes(e.id))); setSelectedIds([]); }} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"><Trash2 size={14} /></button>
            </div>

            {selectedIds.length > 1 && (
              <div className="mb-8 p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Alineación</label>
                <div className="flex gap-2">
                  <button onClick={() => alignSelected('left')} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all"><AlignLeft size={16}/></button>
                  <button onClick={() => alignSelected('top')} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all rotate-90"><AlignLeft size={16}/></button>
                </div>
              </div>
            )}

            {selectedIds.length === 1 && elements.some(e => e.id === selectedIds[0]) && (
              <div className="mb-8 p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Capa (Z-Index)</label>
                <div className="flex gap-2">
                  <button onClick={() => moveLayer('up')} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all flex items-center gap-2 text-[10px] font-bold"><ChevronUp size={16}/> Subir</button>
                  <button onClick={() => moveLayer('down')} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all flex items-center gap-2 text-[10px] font-bold"><ChevronDownIcon size={16}/> Bajar</button>
                </div>
              </div>
            )}

            {firstSelected && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Identificación</label>
                  <div className="flex items-center gap-2 bg-white/5 p-3 rounded-xl border border-white/5">
                    <Type size={14} className="text-white/20" />
                    <input type="text" value={selectedIds.length > 1 ? 'MÚLTIPLE' : (firstSelected.label || firstSelected.row || '')} onChange={(e) => updateSelectedProperty(firstSelected.row ? 'row' : 'label', e.target.value)} className="bg-transparent text-xs font-bold outline-none w-full"/>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Geometría</label>
                  {!firstSelected.row && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5"><span className="text-[8px] font-bold block opacity-30 mb-1">Ancho</span><input type="number" value={firstSelected.w || 0} onChange={(e) => updateSelectedProperty('w', parseInt(e.target.value))} className="bg-transparent text-xs font-bold outline-none w-full"/></div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5"><span className="text-[8px] font-bold block opacity-30 mb-1">Alto</span><input type="number" value={firstSelected.h || 0} onChange={(e) => updateSelectedProperty('h', parseInt(e.target.value))} className="bg-transparent text-xs font-bold outline-none w-full"/></div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex justify-between px-1"><span className="text-[8px] font-bold uppercase opacity-30">Rotación</span><span className="text-[8px] font-bold text-amber-honey">{firstSelected.angle || 0}°</span></div>
                    <input type="range" min="0" max="360" value={firstSelected.angle || 0} onChange={(e) => updateSelectedProperty('angle', parseInt(e.target.value))} className="w-full accent-amber-honey"/>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <style jsx global>{`
        body { overflow: hidden !important; }
        .bg-dot-pattern { background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 40px 40px; }
        .shadow-glow { box-shadow: 0 0 25px rgba(255, 191, 0, 0.4); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}
