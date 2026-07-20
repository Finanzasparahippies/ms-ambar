import * as React from 'react';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';

interface Event {
  id: number;
  title: string;
  date: string;
  theater_name: string;
  theater_location: string;
}

interface TourTimelineProps {
  events: Event[];
  currentEvent: Event | null;
  onEventSelect: (event: Event) => void;
}

const TourTimeline = ({ events, currentEvent, onEventSelect }: TourTimelineProps) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const years = useMemo(() => {
    const yearsSet = new Set(events.map(e => new Date(e.date).getFullYear()));
    yearsSet.add(2026);
    yearsSet.add(2027);
    return Array.from(yearsSet).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events
      .filter(e => new Date(e.date).getFullYear() === selectedYear)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events, selectedYear]);

  return (
    <div className="mb-20">
      {/* Year Selector */}
      <div className="flex items-center justify-between mb-10 px-4">
        <div className="flex items-center gap-8">
           <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-amber-honey">Ruta de Esencia</h3>
           <div className="flex gap-4">
             {years.map(year => (
               <button
                 key={year}
                 onClick={() => setSelectedYear(year)}
                 className={cn(
                   "text-2xl font-black transition-all relative px-2",
                   selectedYear === year 
                    ? "text-nature-night dark:text-white" 
                    : "text-nature-night/20 dark:text-white/20 hover:text-nature-night/40 dark:hover:text-white/40"
                 )}
               >
                 {year}
                 {selectedYear === year && (
                   <motion.div 
                     layoutId="year-dot"
                     className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-amber-honey rounded-full shadow-[0_0_10px_#FFBF00]" 
                   />
                 )}
               </button>
             ))}
           </div>
        </div>
        
        <div className="hidden md:flex items-center gap-3 opacity-30 text-[10px] font-black uppercase tracking-widest text-nature-night dark:text-white">
          <ArrowLeft size={12} /> Desliza para explorar <ArrowRight size={12} />
        </div>
      </div>

      {/* Timeline Track */}
      <div className="relative group">
        {/* The Track Line */}
        <div className="absolute top-[4.5rem] left-0 w-full h-px bg-gradient-to-r from-transparent via-nature-night/10 dark:via-white/10 to-transparent z-0" />
        
        <div className="flex gap-8 overflow-x-auto pb-12 pt-4 px-4 no-scrollbar scroll-smooth">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedYear}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.5, ease: "circOut" }}
              className="flex gap-8 w-full"
            >
              {filteredEvents.length > 0 ? (
                filteredEvents.map((event, index) => {
                  const date = new Date(event.date);
                  const isActive = currentEvent?.id === event.id;

                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex-shrink-0 w-[320px] relative z-10"
                    >
                      {/* Date Bubble */}
                      <div className="flex flex-col items-center mb-6">
                         <div className={cn(
                           "w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center transition-all duration-500 mb-4 z-10 shadow-xl",
                           isActive 
                            ? "bg-amber-honey border-amber-honey shadow-[0_0_30px_rgba(255,191,0,0.4)] scale-110" 
                            : "bg-white dark:bg-nature-night border-nature-night/10 dark:border-white/10 group-hover:border-amber-honey/50"
                         )}>
                            <span className={cn(
                              "text-[9px] font-black uppercase leading-none mb-0.5 transition-colors duration-500", 
                              isActive ? "text-nature-night/70" : "text-nature-night/40 dark:text-white/40"
                            )}>
                              {date.toLocaleDateString('es-MX', { month: 'short' })}
                            </span>
                            <span className={cn(
                              "text-base font-black leading-none transition-colors duration-500", 
                              isActive ? "text-nature-night" : "text-nature-night dark:text-white"
                            )}>
                              {date.getDate()}
                            </span>
                         </div>
                      </div>

                      {/* Event Card */}
                      <motion.button
                        whileHover={{ y: -8 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onEventSelect(event)}
                        className={cn(
                          "w-full text-left p-8 rounded-[2.5rem] border transition-all duration-500 relative overflow-hidden group/card",
                          isActive 
                            ? "bg-amber-honey border-amber-honey shadow-2xl shadow-amber-honey/30" 
                            : "bg-white/40 dark:bg-white/5 border-nature-night/5 dark:border-white/5 hover:border-amber-honey/30"
                        )}
                      >
                        <div className="relative z-10">
                          <div className="flex justify-between items-start mb-4">
                             <div className={cn(
                               "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                               isActive ? "bg-nature-night text-amber-honey" : "bg-nature-night/5 dark:bg-white/5 text-nature-night/40 dark:text-white/40"
                             )}>
                               {event.theater_location}
                             </div>
                             {isActive && <motion.div layoutId="active-indicator" className="w-2.5 h-2.5 bg-nature-night rounded-full shadow-lg" />}
                          </div>
                          
                          <h4 className={cn(
                            "text-xl font-extrabold tracking-tight mb-2 line-clamp-1",
                            isActive ? "text-nature-night" : "text-nature-night dark:text-white"
                          )}>
                            {event.theater_name}
                          </h4>
                          
                          <div className={cn(
                            "flex items-center gap-2 opacity-60 text-[10px] font-bold uppercase tracking-wider",
                            isActive ? "text-nature-night" : "text-nature-night dark:text-white"
                          )}>
                             <Calendar size={12} />
                             {date.toLocaleDateString('es-MX', { weekday: 'long' })}
                          </div>
                        </div>

                        {/* Hover Decorative Element */}
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-honey/5 blur-2xl rounded-full group-hover/card:bg-amber-honey/20 transition-all duration-700" />
                      </motion.button>
                    </motion.div>
                  );
                })
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full py-20 text-center amber-glass rounded-[3rem] border-2 border-dashed border-nature-night/5 dark:border-white/5"
                >
                   <Calendar className="mx-auto mb-4 opacity-20 text-nature-night dark:text-white" size={48} />
                   <p className="text-sm font-black uppercase tracking-[0.4em] opacity-30 text-nature-night dark:text-white">Caminos por Descubrir en {selectedYear}</p>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default TourTimeline;
