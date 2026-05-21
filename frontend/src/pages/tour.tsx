import * as React from 'react';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import SeatingChart from '../components/SeatingChart';
import TourTimeline from '../components/TourTimeline';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Ticket, Users, MapPin, Calendar, Star, Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';

const TourPage = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [currentEvent, setCurrentEvent] = useState<any>(null);
  const [seats, setSeats] = useState<any[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [wantsMG, setWantsMG] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [elements, setElements] = useState<any[]>([]);

  const getApiUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== 'undefined' && window.location.origin.includes('github.dev')
        ? window.location.origin.replace(window.location.port, '8000') + '/api'
        : 'http://localhost:8000/api');
  };

  useEffect(() => {
    setIsMounted(true);
    document.documentElement.setAttribute('data-theme', theme);
    const apiUrl = getApiUrl();
    fetch(`${apiUrl}/tickets/events/`)
      .then(res => res.json())
      .then(data => {
        setEvents(data);
        if (data && data.length > 0) {
          setCurrentEvent(data[0]);
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Error fetching events:", err);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!currentEvent) return;
    const apiUrl = getApiUrl();

    fetch(`${apiUrl}/tickets/events/${currentEvent.id}/seats/`)
      .then(res => res.json())
      .then(data => {
        if (data.seats) {
          setSeats(data.seats);
          setElements(data.elements || []);
        } else {
          setSeats(data);
          setElements([]);
        }
      })
      .catch(err => console.error("Error fetching seats:", err));
  }, [currentEvent]);

  if (!isMounted) return null;

  const handleSelectionChange = (ids: string[]) => {
    const selectedObjects = ids.map(id => {
      return seats.find(s => String(s.id) === id);
    }).filter(Boolean);
    setSelectedSeats(selectedObjects);
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
    <div className="selection:bg-amber-honey/30 overflow-x-hidden font-outfit text-white min-h-screen">
      <Head>
        <title>MS AMBAR | Tour Oficial 2026</title>
        <meta name="description" content="MS Ambar Tour Oficial 2026. Reserva tus entradas y vive la experiencia acústico-visual de vanguardia." />
      </Head>

      {/* Header section (Nectar Labs style) */}
      <section className="pt-10 pb-16 max-w-[1600px] mx-auto px-6 md:px-10 text-center relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-15%] w-[45%] h-[45%] bg-amber-honey/5 blur-[120px] rounded-full pointer-events-none animate-pulse" />
        <div className="max-w-4xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 bg-amber-honey/10 border border-amber-honey/20 px-4 py-2 rounded-full w-fit mx-auto"
          >
            <Sparkles size={12} className="text-amber-honey animate-spin" />
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-honey">Experiencia Inmersiva</span>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-6xl md:text-8xl font-black tracking-tighter uppercase italic leading-none"
          >
            TOUR <span className="text-glow text-gradient bg-gradient-to-r from-amber-400 via-amber-honey to-amber-700 bg-clip-text text-transparent">OFICIAL 2026</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-white/60 text-xs md:text-sm uppercase tracking-[0.4em] max-w-2xl mx-auto leading-relaxed"
          >
            Selecciona tu concierto, explora el mapa de asientos interactivo y reserva tus boletos oficiales.
          </motion.p>
        </div>
      </section>

      {/* Main Reservation Section */}
      <section className="pb-32 max-w-[1600px] mx-auto px-6 md:px-10">
        <TourTimeline 
          events={events} 
          currentEvent={currentEvent} 
          onEventSelect={(event) => {
            setCurrentEvent(event);
            setSelectedSeats([]);
            setWantsMG(false);
          }}
        />

        <div className="grid lg:grid-cols-12 gap-12 xl:gap-20 mt-12">
          <div className="lg:col-span-8">
            <header className="mb-10">
              <motion.h2 
                key={currentEvent?.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-6xl font-black tracking-tight mb-8 uppercase italic"
              >
                {currentEvent ? currentEvent.title : 'Selecciona un Concierto...'}
              </motion.h2>
              <div className="flex flex-wrap gap-6 text-xs uppercase tracking-widest font-black">
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-3 rounded-full backdrop-blur-md">
                  <MapPin size={14} className="text-amber-honey" />
                  <span>{currentEvent ? currentEvent.theater_name : 'Cargando Recinto...'}</span>
                </div>
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-3 rounded-full backdrop-blur-md">
                  <Calendar size={14} className="text-amber-honey" />
                  <span>{currentEvent ? new Date(currentEvent.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</span>
                </div>
              </div>
            </header>

            {isLoading ? (
              <div className="h-[700px] flex items-center justify-center border border-white/5 bg-white/[0.01] rounded-[3.5rem]">
                <div className="text-amber-honey animate-pulse font-extrabold uppercase tracking-[0.5em]">Tejiendo la Planta...</div>
              </div>
            ) : (
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-honey/10 to-amber-600/10 rounded-[3.6rem] blur-xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
                <div className="h-[700px] rounded-[3.5rem] overflow-hidden border border-white/5">
                  <SeatingChart 
                    seats={seats} 
                    onSelect={handleSelectionChange} 
                    selectedIds={selectedSeats.map(s => String(s.id))}
                    theme={theme} 
                    elements={elements}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-4">
            <motion.div layout className="border border-white/5 bg-white/[0.02] p-8 rounded-[3rem] sticky top-8">
              <div className="text-center mb-8 border-b border-white/5 pb-6">
                <h3 className="text-2xl font-black uppercase tracking-wider mb-2">Reserva Digital</h3>
                <p className="text-[9px] uppercase tracking-[0.3em] opacity-40 font-bold">Reserva directa mediante Néctar Gateway</p>
              </div>

              {/* Meet & Greet Toggle */}
              <div
                onClick={() => currentEvent?.mg_available > 0 && setWantsMG(!wantsMG)}
                className={cn(
                  "mb-6 p-5 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden",
                  wantsMG ? "bg-amber-honey border-amber-honey" : "bg-white/5 border-white/5 hover:border-amber-honey/30"
                )}
              >
                <div className="flex items-center gap-4 relative z-10">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500",
                    wantsMG ? "bg-black text-amber-honey rotate-12" : "bg-amber-honey text-black"
                  )}>
                    <Star size={20} fill="currentColor" />
                  </div>
                  <div>
                    <h4 className={cn("font-black text-xs uppercase tracking-widest", wantsMG ? "text-black" : "text-white")}>Meet & Greet</h4>
                    <p className={cn("text-[9px] font-bold uppercase tracking-widest mt-1", wantsMG ? "text-black/60" : "text-amber-honey")}>
                      {currentEvent?.mg_available > 0 ? `${currentEvent.mg_available} Pases Disponibles` : 'Agotado'}
                    </p>
                  </div>
                </div>
                {!wantsMG && <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-black opacity-30 italic">
                  {currentEvent ? `+$${Number(currentEvent.mg_price).toLocaleString()}` : ''}
                </span>}
              </div>

              <div className="space-y-3 mb-8 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                <AnimatePresence mode="popLayout">
                  {selectedSeats.map(seat => (
                    <motion.div
                      key={seat.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5"
                    >
                      <div>
                        <p className="text-[9px] font-black text-amber-honey uppercase tracking-wider">{seat.category}</p>
                        <p className="text-xs font-bold opacity-80">Fila {seat.row} • Asiento {seat.number}</p>
                      </div>
                      <span className="font-extrabold text-xs">${getPrice(seat.category).toLocaleString()} MXN</span>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {selectedSeats.length === 0 && (
                  <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl opacity-20">
                    <Ticket className="mx-auto mb-2 text-white/50" size={32} />
                    <p className="text-[9px] font-bold uppercase tracking-[0.25em]">Elige un asiento en el mapa</p>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-white/5 mb-6">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] uppercase font-bold opacity-40 tracking-[0.25em] mb-2">Total</p>
                    <p className="text-4xl font-black leading-none text-amber-honey">${totalPrice.toLocaleString()} MXN</p>
                  </div>
                  <Users size={18} className="opacity-20 mb-1" />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={selectedSeats.length === 0}
                className="w-full py-4.5 rounded-2xl text-[9px] font-black uppercase tracking-[0.25em] bg-amber-honey text-black disabled:opacity-30 disabled:grayscale transition-all shadow-lg shadow-amber-honey/10"
              >
                Proceder al Pago
              </motion.button>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TourPage;
