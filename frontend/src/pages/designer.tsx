import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
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
  X, Info
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
  
  // New UI states
  const [batchPanel, setBatchPanel] = useState<{ type: 'grid' | 'arc', isOpen: boolean }>({ type: 'grid', isOpen: false });
  const [batchConfig, setBatchConfig] = useState({ count: 12, rowLabel: 'A', category: 'standard' });

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

  const confirmBatchSeats = () => {
    const { count, rowLabel, category } = batchConfig;
    const type = batchPanel.type;
    if (count <= 0) return;
    
    const newBatch = Array.from({ length: count }).map((_, i) => {
      const id = `seat-${crypto.randomUUID()}`;
      if (type === 'grid') return { id, x: 500 + i * 35, y: 500, row: rowLabel, number: seats.length + i + 1, status: 'available', category, angle: 0 };
      const ang = (-60 + i * (120/(count-1))) * Math.PI / 180;
      return { id, x: 500 + Math.sin(ang) * 350, y: 350 + Math.cos(ang) * 350, row: rowLabel, number: seats.length + i + 1, status: 'available', category, angle: -(-60 + i * (120/(count-1))) };
    });
    setSeats(prev => [...prev, ...newBatch]);
    setSelectedIds(newBatch.map(s => s.id));
    setBatchPanel({ ...batchPanel, isOpen: false });
  };

  const updateSelectedProperty = (prop: string, value: any) => {
    setSeats(prev => prev.map(s => selectedIds.includes(String(s.id)) ? { ...s, [prop]: value } : s));
    setElements(prev => prev.map(e => selectedIds.includes(e.id) ? { ...e, [prop]: value } : e));
  };

  const firstSelected = seats.find(s => selectedIds.includes(String(s.id))) || elements.find(e => selectedIds.includes(e.id));

  return (
    <div className="h-screen w-screen bg-[#06070b] overflow-hidden flex flex-col font-sans text-white">
      <Head><title>Nectar Studio Pro | Venue Architecture</title></Head>

      {/* --- Header --- */}
      <header className="h-20 px-8 border-b border-white/5 bg-black/40 backdrop-blur-3xl flex items-center justify-between z-50">
        <div className="flex items-center gap-8">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-3 group cursor-pointer" 
            onClick={() => setSelectedIds([])}
          >
            <div className="w-10 h-10 bg-amber-honey rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(255,191,0,0.3)]">
              <LayoutIcon size={22} className="text-nature-night" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase tracking-[0.4em] leading-none text-white/90">Nectar Studio</span>
              <span className="text-[8px] font-bold text-amber-honey/50 uppercase tracking-[0.2em] mt-1">Architecture Pro</span>
            </div>
          </motion.div>
          
          <div className="h-8 w-px bg-white/10 mx-2" />
          
          <div className="relative group">
            <select 
              value={selectedTheaterId} 
              onChange={handleTheaterChange} 
              className="bg-white/5 px-5 py-2.5 rounded-xl text-[11px] font-bold outline-none border border-white/10 hover:border-amber-honey/50 transition-all appearance-none cursor-pointer pr-10 min-w-[180px]"
            >
              {theaters.map(t => <option key={t.id} value={t.id} className="bg-[#0b0d17]">{t.name}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" size={14} />
          </div>
        </div>

        {/* --- Central Toolbar --- */}
        <div className="absolute left-1/2 -translate-x-1/2 flex bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-3xl shadow-2xl">
          {[
            { id: 'select', icon: MousePointer2, label: 'Select' },
            { id: 'grid', icon: Grid3X3, label: 'Add Row', action: () => setBatchPanel({ type: 'grid', isOpen: true }) },
            { id: 'arc', icon: Compass, label: 'Add Arc', action: () => setBatchPanel({ type: 'arc', isOpen: true }) },
            { id: 'zone', icon: Square, label: 'Add Zone', action: () => addElement('rect', 'ZONA', 'rgba(34,166,179,0.1)') },
            { id: 'stage', icon: Maximize, label: 'Stage', action: () => addElement('rect', 'ESCENARIO', 'rgba(255,191,0,0.15)') },
          ].map((tool) => (
            <button 
              key={tool.id} 
              onClick={tool.action || (() => setActiveTool(tool.id))} 
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all relative group", 
                activeTool === tool.id ? "bg-amber-honey text-nature-night shadow-[0_0_15px_rgba(255,191,0,0.4)]" : "text-white/40 hover:text-white hover:bg-white/10"
              )}
            >
              <tool.icon size={20} />
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-black/90 text-[8px] font-black uppercase rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap tracking-widest z-50">
                {tool.label}
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
            className="w-11 h-11 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-white/60 hover:text-amber-honey"
          >
            {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={saveToDB} 
            disabled={isSaving} 
            className={cn(
              "h-12 px-8 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] transition-all flex items-center gap-3 shadow-glow", 
              saveStatus === 'success' ? "bg-green-500 text-white" : "bg-amber-honey text-nature-night"
            )}
          >
            {isSaving ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
            {isSaving ? 'Syncing...' : saveStatus === 'success' ? 'Deployed' : 'Push to Production'}
          </motion.button>
        </div>
      </header>

      {/* --- Main Content --- */}
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 relative">
          <SeatingChart 
            seats={seats} 
            elements={elements} 
            isDesignMode={true} 
            theme={theme} 
            selectedIds={selectedIds} 
            onUpdate={handleUpdate} 
            onSelect={setSelectedIds} 
          />
          
          {/* --- Tooltips / Overlays --- */}
          <div className="absolute top-6 left-6 flex flex-col gap-2 pointer-events-none">
            <div className="px-4 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-bold text-white/50 tracking-wider">LIVE EDITING MODE</span>
            </div>
          </div>

          {/* --- Batch Configuration Panel --- */}
          <AnimatePresence>
            {batchPanel.isOpen && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-black/80 backdrop-blur-3xl border border-white/10 p-8 rounded-[32px] shadow-[0_40px_100px_rgba(0,0,0,0.6)] z-[100]"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-honey/20 rounded-lg flex items-center justify-center text-amber-honey">
                      {batchPanel.type === 'grid' ? <Grid3X3 size={16}/> : <Compass size={16}/>}
                    </div>
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em]">Add {batchPanel.type}</h3>
                  </div>
                  <button onClick={() => setBatchPanel({ ...batchPanel, isOpen: false })} className="text-white/30 hover:text-white transition-colors"><X size={18}/></button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Quantity</label>
                    <input type="number" value={batchConfig.count} onChange={e => setBatchConfig({...batchConfig, count: parseInt(e.target.value)})} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm font-bold outline-none focus:border-amber-honey/50 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Row Label</label>
                    <input type="text" value={batchConfig.rowLabel} onChange={e => setBatchConfig({...batchConfig, rowLabel: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm font-bold outline-none focus:border-amber-honey/50 transition-all" />
                  </div>
                  <button onClick={confirmBatchSeats} className="w-full bg-amber-honey text-nature-night py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-glow">Generate Batch</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* --- Properties Sidebar --- */}
        <AnimatePresence>
          {selectedIds.length > 0 && (
            <motion.aside 
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-80 bg-[#0b0d17]/80 backdrop-blur-3xl border-l border-white/10 flex flex-col z-40 shadow-[-20px_0_50px_rgba(0,0,0,0.5)]"
            >
              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex flex-col">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-honey">Properties</h3>
                    <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest mt-1">{selectedIds.length} Object(s) Selected</span>
                  </div>
                  <button onClick={() => { setSeats(seats.filter(s => !selectedIds.includes(String(s.id)))); setElements(elements.filter(e => !selectedIds.includes(e.id))); setSelectedIds([]); }} className="w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button>
                </div>

                <div className="space-y-10">
                  {selectedIds.length > 1 && (
                    <div className="space-y-4">
                      <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
                        <AlignLeft size={12}/> Alignment
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { id: 'left', icon: AlignLeft },
                          { id: 'center', icon: AlignCenter },
                          { id: 'right', icon: AlignRight },
                          { id: 'top', icon: AlignLeft, rotate: 90 },
                        ].map(act => (
                          <button key={act.id} onClick={() => alignSelected(act.id as any)} className="h-12 bg-white/5 hover:bg-white/10 rounded-xl transition-all flex items-center justify-center">
                            <act.icon size={16} style={{ transform: act.rotate ? `rotate(${act.rotate}deg)` : '' }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedIds.length === 1 && elements.some(e => e.id === selectedIds[0]) && (
                    <div className="space-y-4">
                      <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
                        <Layers size={12}/> Hierarchy
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => moveLayer('up')} className="h-12 bg-white/5 hover:bg-white/10 rounded-xl transition-all flex items-center justify-center gap-2 text-[9px] font-black uppercase"><ChevronUp size={14}/> Forward</button>
                        <button onClick={() => moveLayer('down')} className="h-12 bg-white/5 hover:bg-white/10 rounded-xl transition-all flex items-center justify-center gap-2 text-[9px] font-black uppercase"><ChevronDownIcon size={14}/> Backward</button>
                      </div>
                    </div>
                  )}

                  {firstSelected && (
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Configuration</label>
                        <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-6">
                          <div className="space-y-2">
                            <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Label / Group</span>
                            <div className="flex items-center gap-3">
                              <Type size={14} className="text-amber-honey" />
                              <input 
                                type="text" 
                                value={selectedIds.length > 1 ? 'MULTIPLE' : (firstSelected.label || firstSelected.row || '')} 
                                onChange={(e) => updateSelectedProperty(firstSelected.row ? 'row' : 'label', e.target.value)} 
                                className="bg-transparent text-[11px] font-bold outline-none w-full"
                              />
                            </div>
                          </div>
                          
                          {!firstSelected.row && (
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                              <div className="space-y-1">
                                <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Width</span>
                                <input type="number" value={firstSelected.w || 0} onChange={(e) => updateSelectedProperty('w', parseInt(e.target.value))} className="bg-transparent text-[11px] font-bold outline-none w-full"/>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Height</span>
                                <input type="number" value={firstSelected.h || 0} onChange={(e) => updateSelectedProperty('h', parseInt(e.target.value))} className="bg-transparent text-[11px] font-bold outline-none w-full"/>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between px-1">
                          <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Orientation</label>
                          <span className="text-[9px] font-black text-amber-honey">{firstSelected.angle || 0}°</span>
                        </div>
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                          <input 
                            type="range" 
                            min="0" 
                            max="360" 
                            value={firstSelected.angle || 0} 
                            onChange={(e) => updateSelectedProperty('angle', parseInt(e.target.value))} 
                            className="w-full accent-amber-honey cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <style jsx global>{`
        body { overflow: hidden !important; }
        .shadow-glow { box-shadow: 0 0 25px rgba(255, 191, 0, 0.4); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        input[type='range'] {
          -webkit-appearance: none;
          background: rgba(255,255,255,0.05);
          height: 4px;
          border-radius: 2px;
        }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #FFBF00;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(255,191,0,0.5);
        }
      `}</style>
    </div>
  );
}
