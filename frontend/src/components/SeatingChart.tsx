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
  category: 'standard' | 'vip' | 'general_a' | 'general_b' | 'accessible';
  section: string;
  position: 'front' | 'side_left' | 'side_right' | 'back';
}

interface SeatingChartProps {
  seats: Seat[];
  onSeatSelect: (seat: Seat) => void;
}

const SeatingChart: React.FC<SeatingChartProps> = ({ seats, onSeatSelect }) => {
  // Group seats by section
  const sections = seats.reduce((acc, seat) => {
    if (!acc[seat.section]) acc[seat.section] = {
      name: seat.section,
      position: seat.position,
      seats: []
    };
    acc[seat.section].seats.push(seat);
    return acc;
  }, {} as Record<string, { name: string, position: string, seats: Seat[] }>);

  const sectionKeys = Object.keys(sections);

  return (
    <div className="relative flex flex-col items-center py-20 px-4 md:px-10 bg-neutral-950 rounded-[4rem] border border-neutral-900 shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[400px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Stage Render */}
      <div className="w-full max-w-2xl mb-24 relative">
        <motion.div 
          initial={{ opacity: 0, scaleX: 0.8 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 1.5, ease: "circOut" }}
          className="relative h-2 w-full"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_20px_rgba(245,158,11,0.8)]" />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-full h-[300px] bg-gradient-to-b from-amber-500/10 via-transparent to-transparent mask-linear pointer-events-none" 
               style={{ clipPath: 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)' }} />
        </motion.div>
        
        <div className="text-center mt-6">
          <span className="text-[10px] text-amber-500 font-black tracking-[0.8em] uppercase opacity-40">Escenario Principal</span>
        </div>
      </div>

      {/* Sections Layout */}
      <div className="flex flex-wrap justify-center gap-16 w-full">
        {sectionKeys.map((sectionKey) => {
          const section = sections[sectionKey];
          // Group seats in this section by row
          const rows = section.seats.reduce((acc, seat) => {
            if (!acc[seat.row]) acc[seat.row] = [];
            acc[seat.row].push(seat);
            return acc;
          }, {} as Record<string, Seat[]>);
          
          const rowLabels = Object.keys(rows).sort();

          return (
            <div 
              key={sectionKey} 
              className={cn(
                "flex flex-col items-center gap-4 transition-all duration-700",
                section.position === 'side_left' && "rotate-[15deg] translate-y-10",
                section.position === 'side_right' && "-rotate-[15deg] translate-y-10",
                section.position === 'back' && "mt-20 opacity-40 grayscale"
              )}
            >
              <h3 className="text-[10px] font-black text-amber-500/60 uppercase tracking-[0.4em] mb-4">
                {section.name}
              </h3>

              <div className="flex flex-col gap-3">
                {rowLabels.map((rowLabel, rowIndex) => {
                  const rowSeats = rows[rowLabel];
                  return (
                    <div key={rowLabel} className="flex gap-2 items-center">
                      <span className="w-4 text-[8px] font-bold text-neutral-700">{rowLabel}</span>
                      <div className="flex gap-1.5">
                        {rowSeats.map((seat, seatIndex) => {
                          const midPoint = (rowSeats.length - 1) / 2;
                          const offset = seatIndex - midPoint;
                          const rotation = offset * 1.5;

                          return (
                            <motion.button
                              key={seat.id}
                              whileHover={{ scale: 1.3, zIndex: 50, y: -4 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => seat.status !== 'occupied' && onSeatSelect(seat)}
                              className={cn(
                                "w-7 h-8 rounded-md transition-all duration-300 flex items-center justify-center relative group",
                                seat.status === 'available' && "bg-neutral-800/40 text-neutral-600 hover:bg-neutral-700 hover:text-white",
                                seat.status === 'occupied' && "bg-neutral-900 text-neutral-800 cursor-not-allowed",
                                seat.status === 'selected' && "bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)]",
                                seat.category === 'vip' && seat.status === 'available' && "ring-1 ring-amber-500/30"
                              )}
                              style={{ transform: `rotate(${rotation}deg)` }}
                              disabled={seat.status === 'occupied'}
                            >
                              <span className="text-[8px] font-black">{seat.number}</span>
                              {seat.category === 'vip' && seat.status === 'available' && (
                                <div className="absolute bottom-0.5 w-0.5 h-0.5 rounded-full bg-amber-500" />
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-20 flex flex-wrap justify-center gap-10 px-6">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-neutral-800 rounded shadow-inner" />
          <span className="text-[9px] uppercase font-bold text-neutral-500 tracking-widest">Disponible</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-amber-500 rounded shadow-[0_0_10px_rgba(245,158,11,0.4)]" />
          <span className="text-[9px] uppercase font-bold text-neutral-300 tracking-widest">Seleccionado</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-amber-500/20 ring-1 ring-amber-500/40 rounded" />
          <span className="text-[9px] uppercase font-bold text-amber-500/60 tracking-widest">Sección VIP</span>
        </div>
      </div>
    </div>
  );
};

export default SeatingChart;
