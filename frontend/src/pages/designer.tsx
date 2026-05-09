import * as React from 'react';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import SeatingChart from '../components/SeatingChart';
import { motion } from 'framer-motion';
import { Save, Download, Plus, Square, Maximize, MousePointer2, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function DesignerPage() {
  const [theaters, setTheaters] = useState<any[]>([]);
  const [selectedTheaterId, setSelectedTheaterId] = useState<number | string>('');
  const [seats, setSeats] = useState<any[]>([]);
  const [elements, setElements] = useState<any[]>([]);
  const [activeTool, setActiveTool] = useState('select');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [canvasHeight, setCanvasHeight] = useState(900);
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
    setSaveStatus('idle');

    try {
      const response = await fetch(`${apiUrl}/tickets/theaters/${selectedTheaterId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layout: {
            map_elements: elements,
            seats: seats
          }
        })
      });

      if (response.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const addSeat = () => {
    const newSeat = {
      id: `new-${Date.now()}`,
      x: 500,
      y: 500,
      row: "NEW",
      number: seats.length + 1,
      status: 'available',
      category: 'standard',
      angle: 0
    };
    setSeats([...seats, newSeat]);
  };

  const addZone = () => {
    const newZone = {
      id: `zone-${Date.now()}`,
      type: 'rect',
      x: 500,
      y: 500,
      w: 300,
      h: 150,
      label: "NUEVA ZONA EXPLANADA",
      color: "rgba(34,166,179,0.1)"
    };
    setElements([...elements, newZone]);
  };

  const addStage = () => {
    const newStage = {
      id: `stage-${Date.now()}`,
      type: 'rect',
      x: 500,
      y: 100,
      w: 400,
      h: 120,
      label: "ESCENARIO",
      color: "rgba(255,191,0,0.15)"
    };
    setElements([...elements, newStage]);
  };

  return (
    <Layout>
      <Head>
        <title>Nectar Designer | MS Ambar</title>
      </Head>

      <div className="min-h-screen pt-20 flex flex-col bg-[#0b0d17]">
        {/* Toolbar Header */}
        <div className="px-8 py-4 amber-glass border-x-0 flex items-center justify-between z-50">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-black uppercase tracking-[0.2em] text-amber-honey">Nectar Designer</h1>
            
            <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Recinto:</span>
              <select 
                value={selectedTheaterId} 
                onChange={handleTheaterChange}
                className="bg-transparent text-[10px] font-bold text-white outline-none cursor-pointer"
              >
                {theaters.map(t => (
                  <option key={t.id} value={t.id} className="bg-nature-night">{t.name}</option>
                ))}
              </select>
              <ChevronDown size={12} className="text-white/40" />
            </div>

            <div className="flex bg-black/20 p-1 rounded-xl">
              {[
                { id: 'select', icon: MousePointer2, label: 'Seleccionar' },
                { id: 'seat', icon: Plus, label: 'Asiento', action: addSeat },
                { id: 'zone', icon: Square, label: 'Zona', action: addZone },
                { id: 'stage', icon: Maximize, label: 'Escenario', action: addStage },
              ].map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => {
                    setActiveTool(tool.id);
                    if (tool.action) tool.action();
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase transition-all",
                    activeTool === tool.id ? "bg-amber-honey text-nature-night shadow-lg" : "text-white/40 hover:text-white"
                  )}
                >
                  <tool.icon size={14} />
                  {tool.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 bg-black/20 px-4 py-2 rounded-xl mr-4">
              <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Altura:</label>
              <input 
                type="range" min="600" max="3000" step="100" 
                value={canvasHeight} 
                onChange={(e) => setCanvasHeight(parseInt(e.target.value))}
                className="w-24 accent-amber-honey"
              />
            </div>

            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
            >
              {theme === 'dark' ? 'Noche' : 'Día'}
            </button>

            <button 
              onClick={saveToDB}
              disabled={isSaving}
              className={cn(
                "btn-amber flex items-center gap-2 !py-2 !px-6 transition-all",
                isSaving && "opacity-50 cursor-wait",
                saveStatus === 'success' && "bg-green-500 hover:bg-green-600 text-white border-green-500",
                saveStatus === 'error' && "bg-red-500 hover:bg-red-600 text-white border-red-500"
              )}
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-nature-night/30 border-t-nature-night rounded-full animate-spin" />
              ) : saveStatus === 'success' ? (
                <CheckCircle2 size={16} />
              ) : saveStatus === 'error' ? (
                <AlertCircle size={16} />
              ) : (
                <Save size={16} />
              )}
              {isSaving ? 'Sincronizando...' : saveStatus === 'success' ? 'Guardado' : saveStatus === 'error' ? 'Error' : 'Guardar en BD'}
            </button>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 p-8 bg-[#0b0d17] relative flex justify-center overflow-auto custom-scrollbar">
          <div style={{ height: canvasHeight }} className="w-full max-w-6xl transition-all duration-500">
            <SeatingChart 
              seats={seats} 
              elements={elements} 
              isDesignMode={true}
              theme={theme}
              onUpdate={handleUpdate}
            />
          </div>
          
          {/* Instructions Overlay */}
          <div className="absolute bottom-12 left-12 pointer-events-none">
            <div className="bg-nature-night/80 backdrop-blur-md p-6 rounded-3xl border border-white/5 max-w-xs shadow-2xl">
              <h3 className="text-xs font-bold text-amber-honey uppercase tracking-widest mb-2">Diseño Directo</h3>
              <ul className="text-[10px] text-white/40 space-y-2 font-medium">
                <li>• Selecciona el recinto arriba para cargar su layout.</li>
                <li>• Arrastra elementos para reposicionarlos.</li>
                <li>• El escenario es el punto de referencia superior.</li>
                <li>• Al guardar, los cambios se aplican al instante.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
