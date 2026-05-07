import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

interface Seat {
  id: number;
  row: string;
  number: number;
  status: 'available' | 'occupied' | 'selected';
  category: string;
  section: string;
  x: number;
  y: number;
  angle: number;
}

interface SeatingChartProps {
  seats: Seat[];
  onSeatSelect: (seat: Seat) => void;
}

const SeatingChart: React.FC<SeatingChartProps> = ({ seats, onSeatSelect }) => {
  if (!seats || seats.length === 0) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-neutral-900/20 rounded-[4rem] border border-neutral-800 border-dashed">
        <div className="text-neutral-600 font-black uppercase tracking-[0.5em] text-center px-10">
          No hay asientos configurados para este evento.<br/>
          <span className="text-[10px] mt-4 block opacity-50 font-bold">Genera los asientos desde el panel administrativo.</span>
        </div>
      </div>
    );
  }

  // Find the bounds of the map to center and scale it
  const allX = seats.map(s => s.x);
  const allY = seats.map(s => s.y);
  
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  const rawWidth = maxX - minX;
  const rawHeight = maxY - minY;
  
  // Adding padding
  const padding = 100;
  const width = rawWidth + padding * 2;
  const height = rawHeight + padding * 2;

  // Scaling to fit a reasonable container
  const containerWidth = 1000;
  const scale = containerWidth / width;
  const containerHeight = height * scale;

  return (
    <div className="w-full bg-neutral-900/40 rounded-[4rem] border border-neutral-800 p-10 overflow-hidden relative min-h-[600px] flex flex-col items-center select-none">
      
      {/* Legend Top */}
      <div className="w-full flex justify-between items-center mb-10 text-[8px] font-black uppercase tracking-widest text-neutral-500">
         <div className="flex gap-6">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500 rounded-sm" /> VIP</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-neutral-700 rounded-sm" /> General</div>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Recinto Sincronizado
         </div>
      </div>

      <div className="relative w-full overflow-auto scrollbar-hide py-20 flex justify-center">
        <div 
          className="relative" 
          style={{ 
            width: width * scale, 
            height: height * scale,
            minWidth: width * scale
          }}
        >
          {/* Stage Visualization (Fixed at top) */}
          <div className="absolute top-[-40px] left-1/2 -translate-x-1/2 w-[40%] h-1 bg-amber-500/50 blur-[2px] rounded-full" />
          <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-[0.8em] text-amber-500/20 whitespace-nowrap">
            Escenario
          </div>

          {seats.map((seat) => (
            <motion.div
              key={seat.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.4, zIndex: 100 }}
              onClick={() => seat.status !== 'occupied' && onSeatSelect(seat)}
              style={{
                position: 'absolute',
                // Map coordinates and center
                left: (seat.x - minX + padding) * scale,
                top: (seat.y - minY + padding) * scale,
                transform: `translate(-50%, -50%) rotate(${seat.angle}deg)`,
                width: 24 * scale,
                height: 24 * scale,
              }}
              className={cn(
                "rounded-md cursor-pointer flex items-center justify-center text-[10px] font-black transition-all border shadow-lg group",
                seat.status === 'occupied' && "bg-neutral-800 border-neutral-700 text-neutral-600 cursor-not-allowed opacity-40",
                seat.status === 'available' && seat.category === 'vip' && "bg-amber-500/10 border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-black",
                seat.status === 'available' && seat.category !== 'vip' && "bg-neutral-800/50 border-neutral-700 text-neutral-400 hover:border-amber-500/50 hover:text-white",
                seat.status === 'selected' && "bg-white border-white text-black scale-125 z-50 shadow-[0_0_20px_rgba(255,255,255,0.4)]"
              )}
            >
              <span style={{ transform: `scale(${scale})` }}>
                {seat.number}
              </span>

              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-black px-2 py-1 rounded text-[7px] font-black whitespace-nowrap z-[200] pointer-events-none shadow-xl">
                 {seat.section} • {seat.row}{seat.number}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="mt-10 text-[9px] font-medium text-neutral-600 italic">
        * Selecciona tus asientos haciendo clic sobre ellos. El precio se actualizará automáticamente.
      </div>
    </div>
  );
};

export default SeatingChart;
