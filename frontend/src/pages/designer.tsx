import * as React from 'react';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import SeatingChart from '../components/SeatingChart';
import { 
  Save, Plus, Square, Maximize, MousePointer2, 
  ChevronDown, CheckCircle2, AlertCircle, 
  Moon, Sun, Layout as LayoutIcon, 
  Settings2, Layers, Grid3X3, Trash2, 
  Copy, Type, Palette
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function DesignerPage() {
  const [theaters, setTheaters] = useState<any[]>([]);
  const [selectedTheaterId, setSelectedTheaterId] = useState<number | string>('');
  const [seats, setSeats] = useState<any[]>([]);
  const [elements, setElements] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const handleSelect = (id: string | null) => {
    setSelectedId(id);
  };

  const saveToDB = async () => {
    if (!selectedTheaterId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`${apiUrl}/tickets/theaters/${selectedTheaterId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layout: { map_elements: elements, seats: seats }
        })
      });
      if (response.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else { setSaveStatus('error'); }
    } catch (error) { setSaveStatus('error'); }
    finally { setIsSaving(false); }
  };

  const addSeat = () => {
    const newSeat = {
      id: `seat-${Date.now()}`,
      x: 500, y: 500,
      row: "1", number: seats.length + 1,
      status: 'available', category: 'standard', angle: 0
    };
    setSeats([...seats, newSeat]);
    setSelectedId(newSeat.id);
  };

  const addBatchSeats = (count: number) => {
    const lastSeat = seats[seats.length - 1] || { x: 400, y: 500 };
    const newBatch = Array.from({ length: count }).map((_, i) => ({
      id: `seat-${Date.now()}-${i}`,
      x: lastSeat.x + (i + 1) * 30,
      y: lastSeat.y,
      row: lastSeat.row || "1",
      number: seats.length + i + 1,
      status: 'available',
      category: 'standard',
      angle: 0
    }));
    setSeats([...seats, ...newBatch]);
  };

  const addZone = () => {
    const newZone = {
      id: `zone-${Date.now()}`,
      type: 'rect', x: 500, y: 500, w: 300, h: 150,
      label: "ZONA NUEVA", color: "rgba(34,166,179,0.15)"
    };
    setElements([...elements, newZone]);
    setSelectedId(newZone.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setSeats(seats.filter(s => s.id !== selectedId));
    setElements(elements.filter(e => e.id !== selectedId));
    setSelectedId(null);
  };

  const updateSelectedProperty = (prop: string, value: any) => {
    if (!selectedId) return;
    const isSeat = seats.some(s => s.id === selectedId);
    if (isSeat) {
      setSeats(seats.map(s => s.id === selectedId ? { ...s, [prop]: value } : s));
    } else {
      setElements(elements.map(e => e.id === selectedId ? { ...e, [prop]: value } : e));
    }
  };

  const selectedItem = seats.find(s => s.id === selectedId) || elements.find(e => e.id === selectedId);

  return (
    <div className="h-screen w-screen bg-[#0b0d17] overflow-hidden flex flex-col font-sans selection:bg-amber-honey/30 text-white">
      <Head>
        <title>Nectar Studio Pro | MS Ambar</title>
      </Head>

      {/* Modern Header */}
      <header className="h-16 px-6 border-b border-white/5 bg-black/60 backdrop-blur-3xl flex items-center justify-between z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="w-9 h-9 bg-amber-honey rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(255,191,0,0.2)] transition-transform group-hover:scale-110">
              <LayoutIcon size={20} className="text-nature-night" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] leading-none">Nectar Studio</span>
              <span className="text-[8px] font-bold opacity-30 uppercase tracking-[0.2em]">Engineering Suite</span>
            </div>
          </div>

          <div className="h-6 w-px bg-white/10 mx-2" />

          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/5 hover:border-amber-honey/30 transition-all">
            <select 
              value={selectedTheaterId} 
              onChange={handleTheaterChange}
              className="bg-transparent text-[11px] font-bold outline-none cursor-pointer appearance-none pr-6"
            >
              {theaters.map(t => (
                <option key={t.id} value={t.id} className="bg-nature-night">{t.name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="text-white/20 -ml-4 pointer-events-none" />
          </div>
        </div>

        {/* Floating Tools */}
        <div className="absolute left-1/2 -translate-x-1/2 flex bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-2xl shadow-2xl">
          {[
            { id: 'select', icon: MousePointer2, label: 'Selección' },
            { id: 'seat', icon: Plus, label: 'Asiento', action: addSeat },
            { id: 'batch', icon: Grid3X3, label: 'Fila (x10)', action: () => addBatchSeats(10) },
            { id: 'zone', icon: Square, label: 'Zona', action: addZone },
          ].map((tool) => (
            <button
              key={tool.id}
              onClick={() => { setActiveTool(tool.id); if (tool.action) tool.action(); }}
              className={cn(
                "w-11 h-11 rounded-xl flex flex-col items-center justify-center transition-all relative group",
                activeTool === tool.id ? "bg-amber-honey text-nature-night shadow-glow" : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              <tool.icon size={20} />
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-nature-night text-[8px] font-black uppercase rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap">
                {tool.label}
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5"
          >
            {theme === 'dark' ? <Moon size={16} className="text-white/60" /> : <Sun size={16} className="text-amber-honey" />}
          </button>

          <button 
            onClick={saveToDB}
            disabled={isSaving}
            className={cn(
              "h-11 px-8 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3",
              saveStatus === 'success' ? "bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]" : 
              saveStatus === 'error' ? "bg-red-500 text-white" : 
              "bg-amber-honey text-nature-night hover:scale-105 active:scale-95 shadow-glow"
            )}
          >
            {isSaving ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : 
             saveStatus === 'success' ? <CheckCircle2 size={16} /> : 
             saveStatus === 'error' ? <AlertCircle size={16} /> : <Save size={16} />}
            {isSaving ? 'Syncing...' : saveStatus === 'success' ? 'Deployed' : 'Push to Production'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Workspace */}
        <main className="flex-1 relative bg-dot-pattern">
          <SeatingChart 
            seats={seats} 
            elements={elements} 
            isDesignMode={true}
            theme={theme}
            selectedId={selectedId}
            onUpdate={handleUpdate}
            onSelect={handleSelect}
          />
        </main>

        {/* Right Properties Panel */}
        <aside className={cn(
          "w-80 bg-black/40 backdrop-blur-3xl border-l border-white/10 flex flex-col transition-all duration-500",
          !selectedId && "translate-x-full w-0 opacity-0"
        )}>
          <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <Settings2 size={14} className="text-amber-honey" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/80">Propiedades</h3>
              </div>
              <button onClick={deleteSelected} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all">
                <Trash2 size={14} />
              </button>
            </div>

            {selectedItem && (
              <div className="space-y-6">
                {/* Identification */}
                <div className="space-y-3">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Identificación</label>
                  <div className="flex items-center gap-2 bg-white/5 p-3 rounded-xl border border-white/5">
                    <Type size={14} className="text-white/20" />
                    <input 
                      type="text" 
                      value={selectedItem.label || selectedItem.row || ''} 
                      onChange={(e) => updateSelectedProperty(selectedItem.row ? 'row' : 'label', e.target.value)}
                      className="bg-transparent text-xs font-bold outline-none w-full"
                      placeholder="Nombre o Fila"
                    />
                  </div>
                </div>

                {/* Geometry (Only for Zones) */}
                {!selectedItem.row && (
                  <div className="space-y-3">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Dimensiones (px)</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="text-[8px] font-bold block opacity-30 mb-1">Ancho</span>
                        <input 
                          type="number" 
                          value={selectedItem.w || 0} 
                          onChange={(e) => updateSelectedProperty('w', parseInt(e.target.value))}
                          className="bg-transparent text-xs font-bold outline-none w-full"
                        />
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="text-[8px] font-bold block opacity-30 mb-1">Alto</span>
                        <input 
                          type="number" 
                          value={selectedItem.h || 0} 
                          onChange={(e) => updateSelectedProperty('h', parseInt(e.target.value))}
                          className="bg-transparent text-xs font-bold outline-none w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Styling */}
                <div className="space-y-3">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Estilo Visual</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => updateSelectedProperty('color', 'rgba(255,191,0,0.1)')}
                      className="p-3 bg-white/5 rounded-xl border border-white/5 text-[9px] font-bold uppercase hover:border-amber-honey transition-all"
                    >
                      Amber Glass
                    </button>
                    <button 
                      onClick={() => updateSelectedProperty('color', 'rgba(34,166,179,0.1)')}
                      className="p-3 bg-white/5 rounded-xl border border-white/5 text-[9px] font-bold uppercase hover:border-nature-sky transition-all"
                    >
                      Ocean Frost
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-white/5 bg-white/5">
            <p className="text-[9px] text-white/30 italic">Presiona 'Push to Production' para guardar estos cambios en el servidor.</p>
          </div>
        </aside>
      </div>

      <style jsx global>{`
        body { overflow: hidden !important; }
        .bg-dot-pattern {
          background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .shadow-glow {
          box-shadow: 0 0 25px rgba(255, 191, 0, 0.4);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}
