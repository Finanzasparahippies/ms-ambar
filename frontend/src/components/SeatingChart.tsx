import React from 'react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Seat {
  id: number;
  row: string;
  number: number;
  status: 'available' | 'occupied' | 'selected';
  category: 'standard' | 'vip' | 'accessible';
}

interface SeatingChartProps {
  seats: Seat[];
  onSeatSelect: (seat: Seat) => void;
}

const SeatingChart: React.FC<SeatingChartProps> = ({ seats, onSeatSelect }) => {
  // Group seats by row
  const rows = seats.reduce((acc, seat) => {
    if (!acc[seat.row]) acc[seat.row] = [];
    acc[seat.row].push(seat);
    return acc;
  }, {} as Record<string, Seat[]>);

  const rowLabels = Object.keys(rows).sort();

  return (
    <div className="relative flex flex-col items-center py-20 px-10 bg-neutral-950 rounded-[4rem] border border-neutral-900 shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Stage Render */}
      <div className="w-full max-w-2xl mb-24 relative">
        <motion.div 
          initial={{ opacity: 0, scaleX: 0.8 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 1.5, ease: "circOut" }}
          className="relative h-2 w-full"
        >
          {/* Main Stage Line */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_20px_rgba(245,158,11,0.8)]" />
          
          {/* Stage Light Projection */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-full h-[300px] bg-gradient-to-b from-amber-500/10 via-transparent to-transparent mask-linear pointer-events-none" 
               style={{ clipPath: 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)' }} />
        </motion.div>
        
        <div className="text-center mt-6">
          <span className="text-[10px] text-amber-500 font-black tracking-[0.8em] uppercase opacity-40">Escenario Principal</span>
        </div>
      </div>

      {/* Seating Layout */}
      <div className="flex flex-col gap-6 items-center w-full">
        {rowLabels.map((rowLabel, rowIndex) => {
          const rowSeats = rows[rowLabel];
          // Calculate curve based on row index
          const rotationBase = rowIndex * 1.5;
          
          return (
            <div key={rowLabel} className="flex gap-3 items-center">
              <span className="w-6 text-[10px] font-bold text-neutral-600">{rowLabel}</span>
              
              <div className="flex gap-2.5">
                {rowSeats.map((seat, seatIndex) => {
                  // Calculate seat rotation for curved effect
                  const midPoint = (rowSeats.length - 1) / 2;
                  const offset = seatIndex - midPoint;
                  const rotation = offset * 2 + (rowIndex * 0.5);
                  
                  return (
                    <motion.button
                      key={seat.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (rowIndex * 0.1) + (seatIndex * 0.02) }}
                      whileHover={{ 
                        scale: 1.2, 
                        y: -5,
                        boxShadow: "0 10px 20px rgba(0,0,0,0.5)" 
                      }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => seat.status !== 'occupied' && onSeatSelect(seat)}
                      className={cn(
                        "w-9 h-10 rounded-lg transition-all duration-500 relative flex items-center justify-center group overflow-hidden",
                        seat.status === 'available' && "bg-neutral-800/50 text-neutral-500 hover:bg-neutral-700 hover:text-white",
                        seat.status === 'occupied' && "bg-neutral-900 text-neutral-800 cursor-not-allowed",
                        seat.status === 'selected' && "bg-amber-500 text-black shadow-[0_0_25px_rgba(245,158,11,0.4)]",
                        seat.category === 'vip' && seat.status === 'available' && "ring-1 ring-amber-500/20"
                      )}
                      style={{ 
                        transform: `rotate(${rotation}deg)`,
                        perspective: '1000px'
                      }}
                      disabled={seat.status === 'occupied'}
                    >
                      {/* Seat Back Shadow Effect */}
                      <div className="absolute inset-x-0 top-0 h-1/2 bg-white/5 group-hover:bg-white/10 transition-colors" />
                      
                      <span className="relative z-10 text-[9px] font-black tracking-tighter">
                        {seat.number}
                      </span>
                      
                      {/* VIP Indicator */}
                      {seat.category === 'vip' && seat.status === 'available' && (
                        <div className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-500/40" />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              <span className="w-6 text-[10px] font-bold text-neutral-600 text-right">{rowLabel}</span>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="mt-24 w-full flex justify-between items-center px-10">
        <div className="flex gap-8">
          <div className="flex items-center gap-3 group">
            <div className="w-4 h-4 bg-neutral-800 rounded-md border border-neutral-700" />
            <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-widest group-hover:text-neutral-300 transition-colors">Disponible</span>
          </div>
          <div className="flex items-center gap-3 group">
            <div className="w-4 h-4 bg-amber-500 rounded-md shadow-[0_0_10px_rgba(245,158,11,0.3)]" />
            <span className="text-[10px] uppercase font-bold text-neutral-300 tracking-widest">Seleccionado</span>
          </div>
          <div className="flex items-center gap-3 group">
            <div className="w-4 h-4 bg-neutral-900 rounded-md" />
            <span className="text-[10px] uppercase font-bold text-neutral-700 tracking-widest">Ocupado</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
          <span className="text-[10px] uppercase font-black text-amber-500/60 tracking-widest">Sección VIP Frontal</span>
        </div>
      </div>
    </div>
  );
};

export default SeatingChart;
