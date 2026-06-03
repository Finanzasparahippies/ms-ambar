import * as React from 'react';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import SeatingChart from '../components/SeatingChart';
import TourTimeline from '../components/TourTimeline';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Ticket, Users, MapPin, Calendar, Star, Sparkles, Minus, Plus, X, CheckCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import axios from 'axios';

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

  // Meet & Greet and Checkout states
  const [mgQuantity, setMgQuantity] = useState(1);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [createdTickets, setCreatedTickets] = useState<any[]>([]);

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

  const getPrice = (seat: any) => {
    if (!seat) return 0;
    const base = Number(seat.base_price || 0);
    const mult = Number(currentEvent?.price_multiplier || 1);
    return Math.round(base * mult);
  };

  const isMeetGreet = currentEvent?.event_type === 'meet_greet';
  const seatsTotal = isMeetGreet ? 0 : selectedSeats.reduce((acc, seat) => acc + getPrice(seat), 0);
  const mgPrice = isMeetGreet 
    ? mgQuantity * Number(currentEvent?.mg_price || 0)
    : (wantsMG ? Number(currentEvent?.mg_price || 0) : 0);
  const totalPrice = seatsTotal + mgPrice;

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName) return;
    setIsSubmitting(true);
    
    try {
      const apiUrl = getApiUrl();
      const res = await axios.post(`${apiUrl}/tickets/tickets/checkout/`, {
        email,
        event_id: currentEvent.id,
        seat_ids: isMeetGreet ? [] : selectedSeats.map(s => s.id),
        quantity: isMeetGreet ? mgQuantity : 1,
        phone,
        has_mg: isMeetGreet ? true : wantsMG
      });
      
      setCreatedTickets(res.data.tickets || []);
      setCheckoutSuccess(true);
      setSelectedSeats([]);
      setWantsMG(false);
    } catch (err) {
      console.error("Error during checkout:", err);
      alert("Hubo un error al procesar la reserva. Por favor intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
            className="text-6xl md:text-8xl font-black tracking-tighter uppercase italic leading-tight px-4 md:px-8 py-2 md:py-4"
          >
            TOUR <span className="text-glow text-gradient bg-gradient-to-r from-amber-400 via-amber-honey to-amber-700 bg-clip-text text-transparent px-2">OFICIAL 2026</span>
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
            setMgQuantity(1);
            setCheckoutSuccess(false);
            setCreatedTickets([]);
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
                  <span>{currentEvent && currentEvent.theater_name ? currentEvent.theater_name : isMeetGreet ? 'Plataforma Digital' : 'Cargando Recinto...'}</span>
                </div>
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-3 rounded-full backdrop-blur-md">
                  <Calendar size={14} className="text-amber-honey" />
                  <span>{currentEvent ? new Date(currentEvent.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</span>
                </div>
              </div>
            </header>

            {isLoading ? (
              <div className="h-[450px] md:h-[700px] flex items-center justify-center border border-white/5 bg-white/[0.01] rounded-[3.5rem]">
                <div className="text-amber-honey animate-pulse font-extrabold uppercase tracking-[0.5em]">Tejiendo la Planta...</div>
              </div>
            ) : isMeetGreet ? (
              <div className="flex flex-col items-center justify-center h-[450px] md:h-[700px] border border-white/5 bg-nature-night/60 rounded-[3.5rem] p-8 text-center space-y-6 backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-honey/10 to-amber-600/10 rounded-[3.6rem] blur-xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
                <div className="w-20 h-20 rounded-full bg-amber-honey/10 border border-amber-honey/20 flex items-center justify-center text-amber-honey animate-pulse z-10">
                  <Star size={36} className="fill-current" />
                </div>
                <div className="space-y-2 z-10">
                  <h3 className="text-2xl font-black uppercase tracking-wider text-white">Convivencia Meet & Greet</h3>
                  <p className="text-xs text-white/50 max-w-md mx-auto leading-relaxed">
                    Pase exclusivo para convivir con MS Ambar. Evento especial sin límite de boletos para compartir momentos únicos, firmar autógrafos y tomarse fotografías.
                  </p>
                </div>
                
                <div className="flex items-center gap-6 bg-white/5 border border-white/10 px-8 py-4 rounded-3xl backdrop-blur-md z-10">
                  <button 
                    onClick={() => setMgQuantity(Math.max(1, mgQuantity - 1))}
                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-white hover:bg-amber-honey hover:text-black transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-2xl font-black min-w-[2rem] text-center">{mgQuantity}</span>
                  <button 
                    onClick={() => setMgQuantity(mgQuantity + 1)}
                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-white hover:bg-amber-honey hover:text-black transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                
                <div className="space-y-1 z-10">
                  <p className="text-[10px] font-black uppercase text-amber-honey tracking-widest">Precio por Boleto</p>
                  <p className="text-xl font-bold">${Number(currentEvent.mg_price).toLocaleString()} MXN</p>
                </div>
              </div>
            ) : (
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-honey/10 to-amber-600/10 rounded-[3.6rem] blur-xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
                <div className="h-[450px] md:h-[700px] rounded-[3.5rem] overflow-hidden border border-white/5">
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

              {/* Meet & Greet Toggle (Standard Concert Events Only) */}
              {!isMeetGreet && (
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
              )}

              <div className="space-y-3 mb-8 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                {isMeetGreet ? (
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
                    <div>
                      <p className="text-[9px] font-black text-amber-honey uppercase tracking-wider">Meet & Greet</p>
                      <p className="text-xs font-bold opacity-80">{mgQuantity} Pase(s) de Convivencia</p>
                    </div>
                    <span className="font-extrabold text-xs">${(mgQuantity * Number(currentEvent?.mg_price || 0)).toLocaleString()} MXN</span>
                  </div>
                ) : (
                  <>
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
                          <span className="font-extrabold text-xs">${getPrice(seat).toLocaleString()} MXN</span>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {selectedSeats.length === 0 && (
                      <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl opacity-20">
                        <Ticket className="mx-auto mb-2 text-white/50" size={32} />
                        <p className="text-[9px] font-bold uppercase tracking-[0.25em]">Elige un asiento en el mapa</p>
                      </div>
                    )}
                  </>
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
                disabled={isMeetGreet ? false : selectedSeats.length === 0}
                onClick={() => setIsCheckoutOpen(true)}
                className="w-full py-4.5 rounded-2xl text-[9px] font-black uppercase tracking-[0.25em] bg-amber-honey text-black disabled:opacity-30 disabled:grayscale transition-all shadow-lg shadow-amber-honey/10"
              >
                Proceder al Pago
              </motion.button>
            </motion.div>
          </div>
        </div>

        {/* ─── NECTAR GATEWAY CHECKOUT MODAL ─── */}
        <AnimatePresence>
          {isCheckoutOpen && (
            <div className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-nature-night/95 backdrop-blur-2xl border border-white/10 p-8 md:p-10 rounded-[2.5rem] w-full max-w-lg space-y-6 relative text-white shadow-2xl overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-honey/5 rounded-bl-[8rem] pointer-events-none" />
                
                {/* Close Button */}
                {!checkoutSuccess && (
                  <button 
                    onClick={() => {
                      setIsCheckoutOpen(false);
                      setFullName('');
                      setEmail('');
                      setPhone('');
                    }}
                    className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                )}

                {checkoutSuccess ? (
                  <div className="text-center space-y-6 py-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
                      <CheckCircle size={32} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black uppercase tracking-wider">¡Compra Confirmada!</h3>
                      <p className="text-xs text-white/60">Tus accesos han sido generados y enviados a su correo:</p>
                      <p className="text-xs font-bold text-amber-honey">{email}</p>
                    </div>

                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5 text-left space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-honey">Tus Boletos Digitales</h4>
                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                        {createdTickets.map((t, idx) => (
                          <div key={t.id} className="flex justify-between items-center bg-black/30 p-3 rounded-lg border border-white/5">
                            <span className="text-xs font-bold text-white/80">Boleto #{idx + 1} ({t.seat_display})</span>
                            <Link 
                              href={`/tickets/${t.token}`} 
                              className="text-[9px] font-black uppercase tracking-wider text-amber-honey hover:text-white transition-colors"
                              target="_blank"
                            >
                              Ver Boleto
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setIsCheckoutOpen(false);
                        setCheckoutSuccess(false);
                        setCreatedTickets([]);
                        setFullName('');
                        setEmail('');
                        setPhone('');
                      }}
                      className="w-full py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.25em] bg-amber-honey text-black hover:scale-[1.02] transition-transform"
                    >
                      Finalizar y Volver
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleCheckoutSubmit} className="space-y-6">
                    <div className="border-b border-white/5 pb-4">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-honey">Pasarela Segura</span>
                      <h3 className="text-2xl font-black uppercase tracking-tight mt-1">Confirmar Reserva</h3>
                    </div>

                    {/* Order Summary */}
                    <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Resumen del Evento</p>
                      <h4 className="text-sm font-black text-white">{currentEvent?.title}</h4>
                      <p className="text-xs text-white/60">
                        {isMeetGreet 
                          ? `${mgQuantity} Pase(s) de Convivencia Meet & Greet`
                          : `${selectedSeats.length} Asiento(s): ${selectedSeats.map(s => `${s.row}${s.number}`).join(', ')}`
                        }
                        {wantsMG && !isMeetGreet && " (Incluye Meet & Greet)"}
                      </p>
                      <div className="flex justify-between items-end pt-3 border-t border-white/5 mt-2">
                        <span className="text-[10px] uppercase font-bold text-white/40">Total a Pagar</span>
                        <span className="text-lg font-black text-amber-honey">${totalPrice.toLocaleString()} MXN</span>
                      </div>
                    </div>

                    {/* Input Fields */}
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-bold tracking-widest text-white/40">Nombre Completo</label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={e => setFullName(e.target.value)}
                          placeholder="Juan Pérez..."
                          className="w-full bg-white/[0.02] border border-white/10 focus:border-amber-honey/40 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none transition-colors"
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-bold tracking-widest text-white/40">Correo Electrónico</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="juan@example.com..."
                          className="w-full bg-white/[0.02] border border-white/10 focus:border-amber-honey/40 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none transition-colors"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-bold tracking-widest text-white/40">Teléfono (WhatsApp)</label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="+52 55 1234 5678..."
                          className="w-full bg-white/[0.02] border border-white/10 focus:border-amber-honey/40 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-4.5 rounded-xl text-[9px] font-black uppercase tracking-[0.25em] bg-amber-honey text-black disabled:opacity-30 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                    >
                      {isSubmitting ? 'Procesando Pago...' : 'Confirmar y Generar Boletos'}
                    </button>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
};

export default TourPage;
