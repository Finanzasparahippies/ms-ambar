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
  Coffee, Trees, Zap
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
        if (data.length > 0) {
          setSelectedTheaterId(data[0].id);
          loadTheater(data[0]);
        }
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

  const handleSelect = (ids: string[]) => setSelectedIds(ids);

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

  const addElement = (type: string, label: string, color: string) => {
    const newEl = { id: `el-${crypto.randomUUID()}`, type: 'rect', x: 500, y: 500, w: 150, h: 100, label, color, angle: 0, sides: 4 };
    setElements(prev => [...prev, newEl]);
    setSelectedIds([newEl.id]);
  };

  const addBatchSeats = (type: 'grid' | 'arc') => {
    const input = window.prompt(`¿Cuántos asientos en el ${type === 'grid' ? 'bloque' : 'arco'}?`, "10");
    const count = parseInt(input || "0");
    if (count <= 0) return;
    const center = { x: 500, y: 500 };
    let newBatch: any[] = [];
    if (type === 'grid') {
      newBatch = Array.from({ length: count }).map((_, i) => ({
        id: `seat-${crypto.randomUUID()}`, x: center.x + i * 35, y: center.y, row: "A", number: seats.length + i + 1, status: 'available', category: 'standard', angle: 0
      }));
    } else {
      const radius = 350, startAngle = -60, angleStep = 120 / (count - 1 || 1);
      newBatch = Array.from({ length: count }).map((_, i) => {
        const ang = (startAngle + i * angleStep) * Math.PI / 180;
        return { id: `seat-${crypto.randomUUID()}`, x: 500 + Math.sin(ang) * radius, y: 350 + Math.cos(ang) * radius, row: "ARC", number: seats.length + i + 1, status: 'available', category: 'vip', angle: -(startAngle + i * angleStep) };
      });
    }
    setSeats(prev => [...prev, ...newBatch]);
    setSelectedIds(newBatch.map(s => s.id));
  };

  const deleteSelected = () => {
    setSeats(prev => prev.filter(s => !selectedIds.includes(s.id.toString())));
    setElements(prev => prev.filter(e => !selectedIds.includes(e.id)));
    setSelectedIds([]);
  };

  const updateSelectedProperty = (prop: string, value: any) => {
    setSeats(prev => prev.map(s => selectedIds.includes(s.id.toString()) ? { ...s, [prop]: value } : s));
    setElements(prev => prev.map(e => selectedIds.includes(e.id) ? { ...e, [prop]: value } : e));
  };

  const isMultiSelect = selectedIds.length > 1;
  const firstSelectedItem = seats.find(s => s.id.toString() === selectedIds[0]) || elements.find(e => e.id === selectedIds[0]);

  return (
    <div className="h-screen w-screen bg-[#0b0d17] overflow-hidden flex flex-col font-sans selection:bg-amber-honey/30 text-white">
      <Head><title>Nectar Studio Pro | Engineering Suite</title></Head>

      <header className="h-16 px-6 border-b border-white/5 bg-black/60 backdrop-blur-3xl flex items-center justify-between z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setSelectedIds([])}>
            <div className="w-9 h-9 bg-amber-honey rounded-xl flex items-center justify-center shadow-glow transition-transform group-hover:scale-110">
              <LayoutIcon size={20} className="text-nature-night" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] leading-none">Nectar Studio</span>
              <span className="text-[8px] font-bold opacity-30 uppercase tracking-[0.2em]">Engineering Suite</span>
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
          <SeatingChart seats={seats} elements={elements} isDesignMode={true} theme={theme} selectedIds={selectedIds} onUpdate={handleUpdate} onSelect={handleSelect} />
        </main>

        <aside className={cn("w-80 bg-black/40 backdrop-blur-3xl border-l border-white/10 flex flex-col transition-all duration-500", selectedIds.length === 0 && "translate-x-full w-0 opacity-0")}>
          <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <Settings2 size={14} className="text-amber-honey" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/80">{isMultiSelect ? `Lote (${selectedIds.length})` : 'Propiedades'}</h3>
              </div>
              <button onClick={deleteSelected} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"><Trash2 size={14} /></button>
            </div>

            {firstSelectedItem && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Identificación {isMultiSelect && '(Múltiple)'}</label>
                  <div className="flex items-center gap-2 bg-white/5 p-3 rounded-xl border border-white/5">
                    <Type size={14} className="text-white/20" />
                    <input type="text" value={isMultiSelect ? 'SELECCIÓN MÚLTIPLE' : (firstSelectedItem.label || firstSelectedItem.row || '')} onChange={(e) => updateSelectedProperty(firstSelectedItem.row ? 'row' : 'label', e.target.value)} disabled={isMultiSelect} className="bg-transparent text-xs font-bold outline-none w-full"/>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Geometría {isMultiSelect && '(Batch)'}</label>
                  {!firstSelectedItem.row && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="text-[8px] font-bold block opacity-30 mb-1">Ancho</span>
                        <input type="number" value={firstSelectedItem.w || 0} onChange={(e) => updateSelectedProperty('w', parseInt(e.target.value))} className="bg-transparent text-xs font-bold outline-none w-full"/>
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="text-[8px] font-bold block opacity-30 mb-1">Alto</span>
                        <input type="number" value={firstSelectedItem.h || 0} onChange={(e) => updateSelectedProperty('h', parseInt(e.target.value))} className="bg-transparent text-xs font-bold outline-none w-full"/>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex justify-between px-1"><span className="text-[8px] font-bold uppercase opacity-30">Rotación Lote</span><span className="text-[8px] font-bold text-amber-honey">{firstSelectedItem.angle || 0}°</span></div>
                    <input type="range" min="0" max="360" value={firstSelectedItem.angle || 0} onChange={(e) => updateSelectedProperty('angle', parseInt(e.target.value))} className="w-full accent-amber-honey"/>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Material {isMultiSelect && '(Global)'}</label>
                  <select onChange={(e) => updateSelectedProperty('category', e.target.value)} className="w-full bg-white/5 border border-white/5 p-3 rounded-xl text-[10px] font-bold uppercase outline-none">
                    <option value="standard" className="bg-nature-night">Standard</option>
                    <option value="vip" className="bg-nature-night">VIP Gold</option>
                    <option value="platinum" className="bg-nature-night">Platinum Elite</option>
                    <option value="accessible" className="bg-nature-night">Accessible</option>
                  </select>
                </div>
              </div>
            )}
          </div>
          <div className="p-6 border-t border-white/5 bg-white/5"><p className="text-[9px] text-white/30 italic">Modificaciones aplicadas al lote seleccionado.</p></div>
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
