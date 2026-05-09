import * as React from 'react';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import SeatingChart from '../components/SeatingChart';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket, Users, Music2, MapPin, Calendar, Star } from 'lucide-react';
import { cn } from '../lib/utils';

const Home = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [currentEvent, setCurrentEvent] = useState<any>(null);
  const [seats, setSeats] = useState<any[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [wantsMG, setWantsMG] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    setIsMounted(true);
    document.documentElement.setAttribute('data-theme', theme);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://potential-fishstick-ww95q4pq4vrc5q55-8000.app.github.dev/api';
    fetch(`${apiUrl}/tickets/events/`)
      .then(res => res.json())
      .then(data => {
        setEvents(data);
        if (data && data.length > 0) setCurrentEvent(data[0]);
        setIsLoading(false);
      })
      .catch(err => console.error("Error fetching events:", err));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!currentEvent) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://potential-fishstick-ww95q4pq4vrc5q55-8000.app.github.dev/api';

    fetch(`${apiUrl}/tickets/events/${currentEvent.id}/seats/`)
      .then(res => res.json())
      .then(data => {
        setSeats(data);
      })
      .catch(err => console.error("Error fetching seats:", err));
  }, [currentEvent]);

  if (!isMounted) return null;

  const handleSeatSelect = (seat: any) => {
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

  const getPrice = (cat: string) => {
    switch (cat) {
      case 'vip': return 3500;
      case 'general_a': return 1800;
      default: return 1200;
    }
  };

  const seatsTotal = selectedSeats.reduce((acc, seat) => acc + getPrice(seat.category), 0);
  const mgPrice = wantsMG ? 2500 : 0;
  const totalPrice = seatsTotal + mgPrice;

  return (
    <div className="selection:bg-amber-honey/30 overflow-x-hidden font-outfit">
      <Head>
        <title>MS AMBAR | Esencia de Ámbar</title>
      </Head>

      <div className="max-w-[1600px] mx-auto px-6 md:px-10 pb-20">
        {/* Tour Dates Selector */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-honey/20 to-transparent"></div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40">Ruta de Esencia: Tour 2026</h3>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-honey/20 to-transparent"></div>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar no-scrollbar-md">
            {events.map((event) => (
              <motion.button
                key={event.id}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setCurrentEvent(event);
                  setSelectedSeats([]);
                  setWantsMG(false);
                }}
                className={cn(
                  "flex-shrink-0 px-8 py-5 rounded-3xl border transition-all duration-500 text-left min-w-[280px] relative overflow-hidden group",
                  currentEvent?.id === event.id 
                    ? "bg-amber-honey border-amber-honey shadow-2xl shadow-amber-honey/20" 
                    : "bg-white/5 border-white/10 hover:border-amber-honey/40"
                )}
              >
                <div className="relative z-10">
                  <p className={cn(
                    "text-[8px] font-black uppercase tracking-widest mb-1",
                    currentEvent?.id === event.id ? "text-nature-night/60" : "text-amber-honey"
                  )}>
                    {new Date(event.date).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </p>
                  <h4 className={cn(
                    "text-lg font-extrabold tracking-tight",
                    currentEvent?.id === event.id ? "text-nature-night" : "text-white"
                  )}>
                    {event.theater_name}
                  </h4>
                  <p className={cn(
                    "text-[10px] font-bold opacity-60 mt-1",
                    currentEvent?.id === event.id ? "text-nature-night/80" : ""
                  )}>
                    {event.theater_location}
                  </p>
                </div>
                {currentEvent?.id === event.id && (
                  <motion.div 
                    layoutId="active-date-bg"
                    className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-12 xl:gap-20">
          <div className="lg:col-span-8">
            <header className="mb-10">
              <motion.h2 
                key={currentEvent?.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8"
              >
                {currentEvent ? currentEvent.title : 'Cargando Magia...'}
              </motion.h2>
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-3 bg-nature-sky/5 border border-nature-sky/10 px-6 py-3 rounded-full backdrop-blur-md">
                  <MapPin size={16} className="text-nature-sky" />
                  <span className="font-semibold">{currentEvent ? currentEvent.theater_name : 'Cargando Recinto...'}</span>
                </div>
                <div className="flex items-center gap-3 bg-amber-honey/5 border border-amber-honey/10 px-6 py-3 rounded-full backdrop-blur-md">
                  <Calendar size={16} className="text-amber-honey" />
                  <span className="font-semibold">{currentEvent ? new Date(currentEvent.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</span>
                </div>
              </div>
            </header>

            {isLoading ? (
              <div className="h-[600px] flex items-center justify-center amber-glass rounded-[4rem]">
                <div className="text-amber-honey animate-pulse font-extrabold uppercase tracking-[0.5em] text-glow">Tejiendo la Red...</div>
              </div>
            ) : (
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-honey/20 to-nature-sky/20 rounded-[4.1rem] blur-xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
                <SeatingChart seats={seats} onSeatSelect={handleSeatSelect} />
              </div>
            )}
          </div>

          <div className="lg:col-span-4">
            <motion.div layout className="amber-glass p-8 rounded-[3.5rem] sticky top-8">
              <div className="text-center mb-8">
                <h3 className="text-3xl font-extrabold tracking-tight mb-2">Reserva</h3>
                <p className="text-[10px] uppercase tracking-[0.3em] opacity-40 font-bold">Asegura tu lugar en la historia</p>
              </div>

              {/* Meet & Greet Toggle */}
              <div
                onClick={() => currentEvent?.mg_available > 0 && setWantsMG(!wantsMG)}
                className={cn(
                  "mb-8 p-6 rounded-3xl border-2 transition-all cursor-pointer group relative overflow-hidden",
                  wantsMG ? "bg-amber-honey border-amber-honey" : "bg-white/5 border-white/5 hover:border-amber-honey/40"
                )}
              >
                <div className="flex items-center gap-4 relative z-10">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500",
                    wantsMG ? "bg-nature-night text-amber-honey rotate-12" : "bg-amber-honey text-nature-night"
                  )}>
                    <Star size={28} fill="currentColor" />
                  </div>
                  <div>
                    <h4 className={cn("font-extrabold text-sm uppercase tracking-widest", wantsMG ? "text-nature-night" : "")}>Meet & Greet</h4>
                    <p className={cn("text-[10px] font-bold uppercase tracking-widest mt-1", wantsMG ? "text-nature-night/60" : "text-amber-honey")}>
                      {currentEvent?.mg_available > 0 ? `${currentEvent.mg_available} Cupos` : 'Agotado'}
                    </p>
                  </div>
                </div>
                {!wantsMG && <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-black opacity-30 italic">
                  {currentEvent ? `+$${Number(currentEvent.mg_price).toLocaleString()}` : ''}
                </span>}
              </div>

              <div className="space-y-4 mb-10 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                <AnimatePresence mode="popLayout">
                  {selectedSeats.map(seat => (
                    <motion.div
                      key={seat.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex justify-between items-center bg-amber-honey/5 p-5 rounded-2xl border border-amber-honey/10"
                    >
                      <div>
                        <p className="text-[10px] font-extrabold text-amber-honey uppercase mb-1 tracking-wider">{seat.section}</p>
                        <p className="text-xs font-bold opacity-80">Fila {seat.row} • Asiento {seat.number}</p>
                      </div>
                      <span className="font-extrabold text-sm">${getPrice(seat.category).toLocaleString()}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {selectedSeats.length === 0 && (
                  <div className="py-12 text-center border-2 border-dashed border-white/10 rounded-3xl opacity-30">
                    <Ticket className="mx-auto mb-4" size={40} />
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.3em]">Explora el Mapa</p>
                  </div>
                )}
              </div>

              <div className="pt-8 border-t border-white/10 mb-8">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] uppercase font-bold opacity-40 tracking-[0.3em] mb-2">Inversión Total</p>
                    <p className="text-5xl font-black leading-none text-glow">${totalPrice.toLocaleString()}</p>
                  </div>
                  <Users size={24} className="opacity-20 mb-1" />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={selectedSeats.length === 0}
                className="btn-amber w-full py-6 text-[10px] uppercase tracking-[0.5em] disabled:opacity-30 disabled:grayscale"
              >
                Proceder al Pago
              </motion.button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
