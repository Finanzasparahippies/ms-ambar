import React, { useState } from 'react';
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
  return (
    <div className="flex flex-col items-center p-8 bg-neutral-950 rounded-3xl border border-neutral-800 shadow-2xl">
      {/* Stage Render */}
      <div className="w-full mb-16 relative">
        <div className="h-2 w-3/4 mx-auto bg-gradient-to-r from-transparent via-amber-500 to-transparent blur-sm" />
        <div className="h-12 w-full bg-gradient-to-b from-amber-500/20 to-transparent rounded-t-[100px] flex items-center justify-center">
          <span className="text-amber-500/50 text-xs font-bold tracking-[0.5em] uppercase">Escenario</span>
        </div>
      </div>

      {/* Seats Grid */}
      <div className="grid grid-cols-10 gap-3">
        {seats.map((seat) => (
          <motion.button
            key={seat.id}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => seat.status !== 'occupied' && onSeatSelect(seat)}
            className={cn(
              "w-8 h-8 rounded-md transition-all duration-300 flex items-center justify-center text-[10px] font-bold",
              seat.status === 'available' && "bg-neutral-800 text-neutral-400 hover:bg-neutral-700",
              seat.status === 'occupied' && "bg-neutral-900 text-neutral-700 cursor-not-allowed",
              seat.status === 'selected' && "bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)]",
              seat.category === 'vip' && seat.status === 'available' && "border border-amber-500/30"
            )}
            disabled={seat.status === 'occupied'}
          >
            {seat.number}
          </motion.button>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-12 flex gap-6 text-xs text-neutral-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-neutral-800 rounded-sm" />
          <span>Disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-amber-500 rounded-sm" />
          <span>Seleccionado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-neutral-900 rounded-sm" />
          <span>Ocupado</span>
        </div>
      </div>
    </div>
  );
};

export default SeatingChart;
