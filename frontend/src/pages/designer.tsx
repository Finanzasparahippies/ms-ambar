import * as React from 'react';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import SeatingChart from '../components/SeatingChart';
import { Save, Plus, Square, Maximize, MousePointer2, ChevronDown, CheckCircle2, AlertCircle, Trash2, Moon, Sun, Layout as LayoutIcon } from 'lucide-react';
import { cn } from '../lib/utils';

export default function DesignerPage() {
  const [theaters, setTheaters] = useState<any[]>([]);
  const [selectedTheaterId, setSelectedTheaterId] = useState<number | string>('');
  const [seats, setSeats] = useState<any[]>([]);
  const [elements, setElements] = useState<any[]>([]);
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
      id: `new-${Date.now()}`,
      x: 500, y: 500,
      row: "NEW", number: seats.length + 1,
      status: 'available', category: 'standard', angle: 0
    };
    setSeats([...seats, newSeat]);
  };

  const addZone = () => {
    const newZone = {
      id: `zone-${Date.now()}`,
      type: 'rect', x: 500, y: 500, w: 300, h: 150,
      label: "NUEVA ZONA EXPLANADA", color: "rgba(34,166,179,0.15)"
    };
    setElements([...elements, newZone]);
  };

  const addStage = () => {
    const newStage = {
      id: `stage-${Date.now()}`,
      type: 'rect', x: 500, y: 100, w: 400, h: 120,
      label: "ESCENARIO", color: "rgba(255,191,0,0.15)"
    };
    setElements([...elements, newStage]);
  };

  return (
    <div className="h-screen w-screen bg-[#0b0d17] overflow-hidden flex flex-col font-sans selection:bg-amber-honey/30">
      <Head>
        <title>Nectar Studio | Designer</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"/> 
      </Head>

      {/* Ultra-Minimalist Header */}
      <header className="h-16 px-6 border-b border-white/5 bg-black/40 backdrop-blur-2xl flex items-center justify-between z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-honey rounded-lg flex items-center justify-center">
              <LayoutIcon size={18} className="text-nature-night" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.3em] text-white hidden lg:block">Nectar Studio</span>
          </div>

          <div className="h-4 w-px bg-white/10 mx-2" />

          {/* Theater Selector */}
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 group hover:border-amber-honey/30 transition-all">
            <select 
              value={selectedTheaterId} 
              onChange={handleTheaterChange}
              className="bg-transparent text-[10px] font-bold text-white/70 outline-none cursor-pointer appearance-none pr-4"
            >
              {theaters.map(t => (
                <option key={t.id} value={t.id} className="bg-nature-night">{t.name}</option>
              ))}
            </select>
            <ChevronDown size={10} className="text-white/30 -ml-3 pointer-events-none" />
          </div>
        </div>

        {/* Toolbar Center */}
        <div className="absolute left-1/2 -translate-x-1/2 flex bg-white/5 p-1 rounded-xl border border-white/5 backdrop-blur-xl">
          {[
            { id: 'select', icon: MousePointer2, label: 'Cursor' },
            { id: 'seat', icon: Plus, label: 'Asiento', action: addSeat },
            { id: 'zone', icon: Square, label: 'Zona', action: addZone },
            { id: 'stage', icon: Maximize, label: 'Escenario', action: addStage },
          ].map((tool) => (
            <button
              key={tool.id}
              onClick={() => { setActiveTool(tool.id); if (tool.action) tool.action(); }}
              className={cn(
                "w-10 h-10 rounded-lg flex flex-col items-center justify-center transition-all relative group",
                activeTool === tool.id ? "bg-amber-honey text-nature-night shadow-[0_0_20px_rgba(255,191,0,0.3)]" : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              <tool.icon size={18} />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-[8px] font-bold uppercase rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {tool.label}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-all"
          >
            {theme === 'dark' ? <Moon size={16} className="text-white/60" /> : <Sun size={16} className="text-amber-honey" />}
          </button>

          <button 
            onClick={saveToDB}
            disabled={isSaving}
            className={cn(
              "h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
              saveStatus === 'success' ? "bg-green-500 text-white" : 
              saveStatus === 'error' ? "bg-red-500 text-white" : 
              "bg-amber-honey text-nature-night hover:scale-105 active:scale-95 shadow-lg shadow-amber-honey/20"
            )}
          >
            {isSaving ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : 
             saveStatus === 'success' ? <CheckCircle2 size={14} /> : 
             saveStatus === 'error' ? <AlertCircle size={14} /> : <Save size={14} />}
            {isSaving ? 'Saving' : saveStatus === 'success' ? 'Saved' : 'Push to Production'}
          </button>
        </div>
      </header>

      {/* Full-Screen Workspace */}
      <main className="flex-1 relative overflow-hidden bg-dot-pattern">
        <SeatingChart 
          seats={seats} 
          elements={elements} 
          isDesignMode={true}
          theme={theme}
          onUpdate={handleUpdate}
        />

        {/* Floating Help Card */}
        <div className="absolute bottom-8 left-8 p-6 amber-glass rounded-[2rem] max-w-xs border border-white/5 shadow-2xl pointer-events-none">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-amber-honey animate-pulse" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-honey">Nectar Studio Live</h4>
          </div>
          <p className="text-[10px] text-white/50 font-medium leading-relaxed">
            Arrastra elementos para posicionarlos. Usa la rueda del mouse para zoom. Guarda cambios directamente en el servidor MS Ambar.
          </p>
        </div>
      </main>

      <style jsx global>{`
        body { overflow: hidden !important; }
        .bg-dot-pattern {
          background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 30px 30px;
        }
      `}</style>
    </div>
  );
}
