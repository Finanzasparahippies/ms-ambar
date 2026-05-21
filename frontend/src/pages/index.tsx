import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import SeatingChart from '../components/SeatingChart';
import TourTimeline from '../components/TourTimeline';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Ticket, Users, Music2, MapPin, Calendar, Star, 
  Play, ArrowRight, Sparkles, ChevronRight, Volume2 
} from 'lucide-react';
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

  const ticketSectionRef = useRef<HTMLDivElement>(null);

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

  const [elements, setElements] = useState<any[]>([]);

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

  const scrollToTickets = () => {
    ticketSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="selection:bg-amber-honey/30 overflow-x-hidden font-outfit bg-[#06070b] text-white">
      <Head>
        <title>MS AMBAR | Esencia Artística y Experiencia de Sonidos</title>
        <meta name="description" content="MS Ambar - Una fusión vanguardista de música, arte digital y escenografía de alta gama. Adquiere boletos oficiales y reserva experiencias exclusivas." />
      </Head>

      {/* ─── HERO SECTION (NECTAR LABS STYLE) ─── */}
      <section className="relative min-h-[90vh] flex flex-col justify-center items-center px-6 overflow-hidden">
        {/* Glow Spheres */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-amber-honey/10 rounded-full blur-[140px] pointer-events-none animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-600/5 rounded-full blur-[120px] pointer-events-none" />

        {/* Ambient Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="max-w-4xl text-center space-y-8 z-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex items-center justify-center gap-2 bg-amber-honey/10 border border-amber-honey/20 px-4 py-2 rounded-full w-fit mx-auto mb-4"
          >
            <Sparkles size={12} className="text-amber-honey animate-spin" />
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-honey">Tour Oficial 2026</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-6xl md:text-9xl font-black tracking-tight leading-none uppercase italic"
          >
            MS <span className="text-gradient bg-gradient-to-r from-amber-400 via-amber-honey to-amber-700 bg-clip-text text-transparent">AMBAR</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-white/60 text-xs md:text-sm uppercase tracking-[0.4em] max-w-2xl mx-auto leading-relaxed"
          >
            La fusión vanguardista de arte lumínico, diseño acústico premium y expresión escénica digital.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6"
          >
            <button
              onClick={scrollToTickets}
              className="px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] bg-amber-honey text-[#06070b] shadow-lg shadow-amber-honey/20 hover:scale-105 transition-all flex items-center gap-3"
            >
              <Ticket size={14} /> Adquirir Boletos
            </button>
            <Link
              href="/contact"
              className="px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] border border-white/10 hover:border-amber-honey/40 hover:bg-amber-honey/5 transition-all flex items-center gap-3"
            >
              Proponer Booking <ArrowRight size={14} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ─── LIVE MUSIC RELEASES SHOWCASE ─── */}
      <section className="py-24 border-y border-white/5 bg-black/20 relative">
        <div className="max-w-[1600px] mx-auto px-6 md:px-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-honey">Lanzamientos Recientes</span>
              <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tight mt-2">Música & Producción</h3>
            </div>
            <Link href="/music" className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-amber-honey transition-colors flex items-center gap-2 mt-4 md:mt-0">
              Escuchar Discografía Completa <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Esencia de Ámbar', desc: 'LP Álbum de Estudio • 2026', img: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop' },
              { title: 'Ritual Acústico', desc: 'Sesión en Vivo en Teatros CDMX', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop' },
              { title: 'Frecuencia Metrópoli', desc: 'EP Mezclas Alternativas', img: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=800&auto=format&fit=crop' }
            ].map((track, i) => (
              <div key={i} className="group relative rounded-[2.5rem] border border-white/5 bg-white/[0.02] overflow-hidden p-4 hover:border-amber-honey/20 transition-all">
                <div className="relative aspect-square rounded-[2rem] overflow-hidden mb-6">
                  <img src={track.img} alt={track.title} className="object-cover w-full h-full group-hover:scale-105 transition-all duration-700" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button className="w-16 h-16 rounded-full bg-amber-honey text-black flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                      <Play size={24} className="fill-current ml-1" />
                    </button>
                  </div>
                </div>
                <div className="px-2 space-y-1">
                  <h4 className="font-black uppercase text-sm text-white group-hover:text-amber-honey transition-colors">{track.title}</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{track.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TICKETING EXPERIENCE SECTION (SCROLL TARGET) ─── */}
      <section ref={ticketSectionRef} className="py-24 max-w-[1600px] mx-auto px-6 md:px-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-honey">Experiencia Interactiva</span>
            <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tight mt-2">Reservar Asientos</h3>
          </div>
        </div>

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

      {/* ─── NEWSLETTER / BLOG SHOWCASE ─── */}
      <section className="py-24 border-t border-white/5 bg-black/40">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-honey">Boletín Oficial</span>
          <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tight">Únete al Círculo</h3>
          <p className="text-white/60 text-xs md:text-sm max-w-xl mx-auto leading-relaxed">
            Recibe crónicas exclusivas del tour, invitaciones a ensayos generales y avisos tempranos de preventas de boletos.
          </p>
          <div className="pt-4">
            <Link 
              href="/blog" 
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-honey hover:text-white transition-colors"
            >
              Visitar el Blog de Crónicas <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
