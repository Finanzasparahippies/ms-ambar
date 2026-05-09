import * as React from 'react';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import SeatingChart from '../components/SeatingChart';
import { motion } from 'framer-motion';
import { Save, Download, Plus, Square, Map as MapIcon, Layers, Maximize, MousePointer2 } from 'lucide-react';
import { cn } from '../lib/utils';

export default function DesignerPage() {
  const [seats, setSeats] = useState<any[]>([]);
  const [elements, setElements] = useState<any[]>([]);
  const [activeTool, setActiveTool] = useState('select');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  const handleUpdate = (updatedSeats: any[], updatedElements: any[]) => {
    setSeats(updatedSeats);
    setElements(updatedElements);
  };

  const copyJSON = () => {
    const layout = {
      map_elements: elements,
      seats: seats
    };
    navigator.clipboard.writeText(JSON.stringify(layout, null, 2));
    alert('JSON copiado al portapapeles. ¡Pégalo en el Admin!');
  };

  const addSeat = () => {
    const newSeat = {
      id: `new-${Date.now()}`,
      x: 500,
      y: 500,
      row: "1",
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
      w: 200,
      h: 100,
      label: "NUEVA ZONA",
      color: "rgba(255,191,0,0.1)"
    };
    setElements([...elements, newZone]);
  };

  return (
    <Layout>
      <Head>
        <title>Nectar Designer | MS Ambar</title>
      </Head>

      <div className="min-h-screen pt-20 flex flex-col">
        {/* Toolbar Header */}
        <div className="px-8 py-4 amber-glass border-x-0 flex items-center justify-between z-50">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-black uppercase tracking-[0.2em] text-amber-honey">Nectar Designer</h1>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex bg-black/20 p-1 rounded-xl">
              {[
                { id: 'select', icon: MousePointer2, label: 'Seleccionar' },
                { id: 'seat', icon: Plus, label: 'Asiento', action: addSeat },
                { id: 'zone', icon: Square, label: 'Zona', action: addZone },
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
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
            >
              Modo: {theme === 'dark' ? 'Noche' : 'Día'}
            </button>
            <button 
              onClick={copyJSON}
              className="btn-amber flex items-center gap-2 !py-2 !px-5"
            >
              <Download size={16} />
              Exportar JSON
            </button>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 p-8 bg-[#0b0d17] relative">
          <SeatingChart 
            seats={seats} 
            elements={elements} 
            isDesignMode={true}
            theme={theme}
            onUpdate={handleUpdate}
          />
          
          {/* Instructions Overlay */}
          <div className="absolute bottom-12 left-12 pointer-events-none">
            <div className="bg-nature-night/80 backdrop-blur-md p-6 rounded-3xl border border-white/5 max-w-xs">
              <h3 className="text-xs font-bold text-amber-honey uppercase tracking-widest mb-2">Instrucciones Nectar</h3>
              <ul className="text-[10px] text-white/40 space-y-2 font-medium">
                <li>• Arrastra cualquier elemento para posicionarlo.</li>
                <li>• Usa la rueda del mouse para hacer Zoom.</li>
                <li>• Selecciona y presiona el botón rojo para borrar.</li>
                <li>• El escenario está siempre al tope (y=0).</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
