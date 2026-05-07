import React, { useState } from 'react';
import Head from 'next/head';
import SeatingChart from '../components/SeatingChart';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket, Users, Music2, MapPin, Calendar } from 'lucide-react';

const Home = () => {
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [isMounted, setIsMounted] = useState(false);

  React.useEffect(() => {
    setIsMounted(true);
    // Generate 8 rows (A-H) with varying seat counts for a curved theater look
    const initial = [];
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    let id = 0;
    
    rows.forEach((row, rowIndex) => {
      // Inner rows have fewer seats, outer rows have more
      const seatCount = 8 + (rowIndex * 2); 
      for (let i = 1; i <= seatCount; i++) {
        initial.push({
          id: id++,
          row: row,
          number: i,
          status: Math.random() > 0.85 ? 'occupied' : 'available',
          category: rowIndex < 3 ? 'vip' : 'standard',
        });
      }
    });
    setSeats(initial);
  }, []);

  if (!isMounted) return <div className="min-h-screen bg-black" />;

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

  const totalPrice = selectedSeats.reduce((acc, seat) => acc + (seat.category === 'vip' ? 2400 : 1200), 0);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-amber-500/30 overflow-x-hidden">
      <Head>
        <title>MS AMBAR | Boletos Oficiales</title>
        <meta name="description" content="Gira Mundial 2026 - MS AMBAR" />
      </Head>

      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-neutral-800/20 blur-[150px] rounded-full" />
      </div>

      <main className="relative z-10 max-w-[1600px] mx-auto px-10 py-16">
        {/* Navigation / Artist Brand */}
        <nav className="flex justify-between items-center mb-24">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
              <span className="text-black font-black text-xl">A</span>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter leading-none">MS AMBAR</h1>
              <span className="text-[10px] text-neutral-500 uppercase tracking-[0.4em]">Official Store</span>
            </div>
          </div>
          
          <div className="hidden md:flex gap-10 text-[10px] uppercase font-black tracking-widest text-neutral-400">
            <a href="#" className="hover:text-amber-500 transition-colors">Tour</a>
            <a href="#" className="hover:text-amber-500 transition-colors">Music</a>
            <a href="#" className="hover:text-amber-500 transition-colors">Merch</a>
            <a href="#" className="text-amber-500">Tickets</a>
          </div>
        </nav>

        <div className="grid lg:grid-cols-12 gap-20">
          {/* Main Seating Area */}
          <div className="lg:col-span-8">
            <header className="mb-12">
              <div className="flex items-center gap-3 text-amber-500 mb-4">
                <Music2 size={16} />
                <span className="text-xs font-black uppercase tracking-[0.3em]">En Vivo</span>
              </div>
              <h2 className="text-5xl font-black tracking-tight mb-6 leading-none">
                Selecciona tu Experiencia
              </h2>
              
              <div className="flex flex-wrap gap-6 text-sm text-neutral-400">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-neutral-600" />
                  <span>15 Junio, 2026</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-neutral-600" />
                  <span>Teatro Metropolitan, CDMX</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-neutral-600" />
                  <span>Capacidad: {seats.length} Asientos</span>
                </div>
              </div>
            </header>

            <SeatingChart seats={seats} onSeatSelect={handleSeatSelect} />
          </div>

          {/* Checkout Summary Sidebar */}
          <div className="lg:col-span-4 lg:pt-24">
            <motion.div 
              layout
              className="bg-neutral-900/40 backdrop-blur-3xl p-10 rounded-[2.5rem] border border-neutral-800 shadow-2xl sticky top-12"
            >
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black tracking-tight">Tu Selección</h3>
                <div className="bg-amber-500 text-black w-8 h-8 rounded-full flex items-center justify-center font-black text-sm">
                  {selectedSeats.length}
                </div>
              </div>

              <div className="space-y-6 mb-12 max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {selectedSeats.map(seat => (
                    <motion.div 
                      key={seat.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5"
                    >
                      <div>
                        <p className="text-xs font-black text-amber-500 uppercase tracking-widest mb-1">
                          {seat.category === 'vip' ? 'Experiencia VIP' : 'General'}
                        </p>
                        <p className="text-sm font-bold">Fila {seat.row} • Asiento {seat.number}</p>
                      </div>
                      <span className="font-mono text-sm font-black text-neutral-300">
                        ${(seat.category === 'vip' ? 2400 : 1200).toLocaleString()}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {selectedSeats.length === 0 && (
                  <div className="py-12 text-center">
                    <div className="w-16 h-16 bg-neutral-800/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-neutral-800">
                      <Ticket size={24} className="text-neutral-600" />
                    </div>
                    <p className="text-neutral-500 text-sm italic">
                      Selecciona tus asientos para continuar
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-8 border-t border-neutral-800 mb-10">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] uppercase font-black text-neutral-500 tracking-[0.2em] mb-1">Total a Pagar</p>
                    <p className="text-4xl font-black text-white leading-none">${totalPrice.toLocaleString()}</p>
                  </div>
                  <span className="text-[10px] text-neutral-500 font-bold uppercase mb-1">MXN</span>
                </div>
              </div>

              <motion.button 
                whileHover={{ scale: 1.02, backgroundColor: '#f59e0b', color: '#000' }}
                whileTap={{ scale: 0.98 }}
                disabled={selectedSeats.length === 0}
                className="w-full py-6 bg-white text-black text-xs font-black uppercase tracking-[0.3em] rounded-2xl transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:shadow-amber-500/20"
              >
                Completar Compra
              </motion.button>
              
              <p className="mt-6 text-[10px] text-neutral-600 text-center uppercase font-bold tracking-widest">
                Transacción Protegida por Stripe
              </p>
            </motion.div>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .mask-linear {
          mask-image: linear-gradient(to bottom, black, transparent);
        }
      `}</style>
    </div>
  );
}

export default Home;
