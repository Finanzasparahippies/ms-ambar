import React, { useState } from 'react';
import Head from 'next/head';
import SeatingChart from '../components/SeatingChart';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket, Users, Music2, MapPin, Calendar, Star } from 'lucide-react';
import { cn } from '../lib/utils';

const Home = () => {
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [isMounted, setIsMounted] = useState(false);
  const [wantsMG, setWantsMG] = useState(false);
  const [mgAvailable, setMgAvailable] = useState(15); // Mock availability

  React.useEffect(() => {
    setIsMounted(true);
    const initial = [];
    
    // Define sections based on the new logic
    const sections = [
      { name: 'VIP Frontal', pos: 'front', rows: ['A', 'B'], count: 8, cat: 'vip' },
      { name: 'General A', pos: 'front', rows: ['C', 'D', 'E'], count: 12, cat: 'general_a' },
      { name: 'Lateral Izq', pos: 'side_left', rows: ['L1', 'L2'], count: 10, cat: 'standard' },
      { name: 'Lateral Der', pos: 'side_right', rows: ['R1', 'R2'], count: 10, cat: 'standard' }
    ];

    let id = 0;
    sections.forEach(sec => {
      sec.rows.forEach(row => {
        for (let i = 1; i <= sec.count; i++) {
          initial.push({
            id: id++,
            row: row,
            number: i,
            status: Math.random() > 0.9 ? 'occupied' : 'available',
            category: sec.cat,
            section: sec.name,
            position: sec.pos
          });
        }
      });
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

  const getPrice = (cat) => {
    switch(cat) {
      case 'vip': return 3500;
      case 'general_a': return 1800;
      default: return 1200;
    }
  };

  const seatsTotal = selectedSeats.reduce((acc, seat) => acc + getPrice(seat.category), 0);
  const mgPrice = wantsMG ? 2500 : 0;
  const totalPrice = seatsTotal + mgPrice;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-amber-500/30 overflow-x-hidden font-['Inter']">
      <Head>
        <title>MS AMBAR | Boletos Oficiales</title>
      </Head>

      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-neutral-800/20 blur-[150px] rounded-full" />
      </div>

      <main className="relative z-10 max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        {/* Nav Bar */}
        <nav className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <span className="text-black font-black text-lg">A</span>
            </div>
            <h1 className="text-xl font-black tracking-tighter">MS AMBAR</h1>
          </div>
          <div className="flex gap-8 text-[10px] uppercase font-black tracking-[0.3em] text-neutral-500">
            <a href="/merch" className="hover:text-amber-500 transition-colors">Shop</a>
            <a href="/music" className="hover:text-amber-500 transition-colors">Music</a>
            <a href="/blog" className="hover:text-amber-500 transition-colors">Blog</a>
            <a href="/contact" className="hover:text-amber-500 transition-colors">Booking</a>
          </div>
        </nav>

        <div className="grid lg:grid-cols-12 gap-12 xl:gap-20">
          <div className="lg:col-span-8">
            <header className="mb-10">
              <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
                Tour 2026: <span className="text-amber-500 italic">Eclipse</span>
              </h2>
              <div className="flex flex-wrap gap-6 text-sm text-neutral-500">
                <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full">
                  <MapPin size={14} className="text-amber-500" />
                  <span>Teatro Metropolitan, CDMX</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full">
                  <Calendar size={14} className="text-amber-500" />
                  <span>15 de Junio, 2026</span>
                </div>
              </div>
            </header>

            <SeatingChart seats={seats} onSeatSelect={handleSeatSelect} />
          </div>

          <div className="lg:col-span-4">
            <motion.div layout className="bg-neutral-900/50 backdrop-blur-2xl p-8 rounded-[3rem] border border-neutral-800 sticky top-8">
              <h3 className="text-2xl font-black mb-8 tracking-tight text-center">Confirmación</h3>
              
              {/* Meet & Greet Toggle */}
              <div 
                onClick={() => mgAvailable > 0 && setWantsMG(!wantsMG)}
                className={cn(
                  "mb-8 p-6 rounded-3xl border transition-all cursor-pointer group relative overflow-hidden",
                  wantsMG ? "bg-amber-500 border-amber-400" : "bg-neutral-800/30 border-neutral-700 hover:border-amber-500/50"
                )}
              >
                <div className="flex items-center gap-4 relative z-10">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                    wantsMG ? "bg-black text-amber-500" : "bg-amber-500 text-black"
                  )}>
                    <Star size={24} fill="currentColor" />
                  </div>
                  <div>
                    <h4 className={cn("font-black text-sm uppercase tracking-widest", wantsMG ? "text-black" : "text-white")}>Meet & Greet</h4>
                    <p className={cn("text-[10px] font-bold uppercase tracking-widest mt-1", wantsMG ? "text-black/60" : "text-amber-500/80")}>
                      {mgAvailable > 0 ? `${mgAvailable} Cupos Disponibles` : 'Agotado'}
                    </p>
                  </div>
                </div>
                {!wantsMG && <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-black text-neutral-600">+$2,500</span>}
              </div>

              <div className="space-y-4 mb-10">
                <AnimatePresence mode="popLayout">
                  {selectedSeats.map(seat => (
                    <motion.div 
                      key={seat.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5"
                    >
                      <div>
                        <p className="text-[9px] font-black text-amber-500 uppercase mb-1">{seat.section}</p>
                        <p className="text-xs font-bold">Fila {seat.row} • {seat.number}</p>
                      </div>
                      <span className="font-mono text-sm font-black">${getPrice(seat.category).toLocaleString()}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {selectedSeats.length === 0 && (
                  <div className="py-10 text-center border-2 border-dashed border-neutral-800 rounded-3xl">
                    <Ticket className="mx-auto mb-3 opacity-20" size={32} />
                    <p className="text-xs text-neutral-600 font-bold uppercase tracking-widest">Selecciona Asientos</p>
                  </div>
                )}
              </div>

              <div className="pt-8 border-t border-neutral-800 mb-8">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] uppercase font-black text-neutral-500 tracking-[0.2em] mb-1">Total MXN</p>
                    <p className="text-5xl font-black leading-none">${totalPrice.toLocaleString()}</p>
                  </div>
                  <Users size={20} className="text-neutral-700 mb-1" />
                </div>
              </div>

              <motion.button 
                whileTap={{ scale: 0.95 }}
                disabled={selectedSeats.length === 0}
                className="w-full py-6 bg-white text-black text-xs font-black uppercase tracking-[0.4em] rounded-2xl disabled:opacity-20 hover:bg-amber-500 transition-colors shadow-2xl shadow-amber-500/10"
              >
                Checkout con Stripe
              </motion.button>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Home;
