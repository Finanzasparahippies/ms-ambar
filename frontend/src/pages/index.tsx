import React, { useState } from 'react';
import Head from 'next/head';
import SeatingChart from '../components/SeatingChart';
import { motion } from 'framer-motion';

const INITIAL_SEATS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  row: String.fromCharCode(65 + Math.floor(i / 10)),
  number: (i % 10) + 1,
  status: Math.random() > 0.8 ? 'occupied' : 'available',
  category: i < 20 ? 'vip' : 'standard',
}));

export default function Home() {
  const [seats, setSeats] = useState(INITIAL_SEATS);
  const [selectedSeats, setSelectedSeats] = useState([]);

  const handleSeatSelect = (seat) => {
    setSeats(prev => prev.map(s => {
      if (s.id === seat.id) {
        return { ...s, status: s.status === 'selected' ? 'available' : 'selected' };
      }
      return s;
    }));

    setSelectedSeats(prev => {
      const isSelected = prev.find(s => s.id === seat.id);
      if (isSelected) return prev.filter(s => s.id !== seat.id);
      return [...prev, seat];
    });
  };

  const totalPrice = selectedSeats.reduce((acc, seat) => acc + (seat.category === 'vip' ? 1200 : 600), 0);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-amber-500/30">
      <Head>
        <title>MS AMBAR | Boletos</title>
        <meta name="description" content="Compra tus boletos para la gira de MS AMBAR" />
      </Head>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <header className="mb-16 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl font-black tracking-tighter mb-4 bg-gradient-to-b from-white to-neutral-500 bg-clip-text text-transparent"
          >
            MS AMBAR
          </motion.h1>
          <p className="text-neutral-400 text-lg uppercase tracking-[0.3em]">Tour 2026 - Selección de Asientos</p>
        </header>

        <div className="grid lg:grid-cols-3 gap-12 items-start">
          <div className="lg:col-span-2">
            <SeatingChart seats={seats} onSeatSelect={handleSeatSelect} />
          </div>

          <motion.div 
            layout
            className="bg-neutral-900/50 p-8 rounded-3xl border border-neutral-800 backdrop-blur-xl sticky top-12"
          >
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              Resumen de Compra
              <span className="text-xs bg-amber-500 text-black px-2 py-0.5 rounded-full">
                {selectedSeats.length}
              </span>
            </h2>

            <div className="space-y-4 mb-8">
              {selectedSeats.map(seat => (
                <div key={seat.id} className="flex justify-between items-center text-sm">
                  <span className="text-neutral-400">Fila {seat.row}, Asiento {seat.number}</span>
                  <span className="font-mono">${seat.category === 'vip' ? '1,200' : '600'} MXN</span>
                </div>
              ))}
              {selectedSeats.length === 0 && (
                <p className="text-neutral-500 text-sm italic">No has seleccionado ningún asiento</p>
              )}
            </div>

            <div className="pt-6 border-t border-neutral-800 mb-8">
              <div className="flex justify-between items-end">
                <span className="text-neutral-400">Total</span>
                <span className="text-3xl font-black text-amber-500">${totalPrice.toLocaleString()} MXN</span>
              </div>
            </div>

            <button 
              disabled={selectedSeats.length === 0}
              className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:hover:bg-white"
            >
              Continuar al Pago
            </button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
