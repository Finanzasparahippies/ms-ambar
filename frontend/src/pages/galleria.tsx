import React from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { Camera, Play, Expand } from 'lucide-react';

const GALLERY_ITEMS = [
  { id: 1, type: 'image', url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&q=80', title: 'Live en Auditorio Nacional', category: 'Concierto' },
  { id: 2, type: 'video', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&q=80', title: 'Detrás de Escena: Eclipse', category: 'Documental' },
  { id: 3, type: 'image', url: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=1200&q=80', title: 'Gira Europa 2026', category: 'Tour' },
  { id: 4, type: 'image', url: 'https://images.unsplash.com/photo-1514525253361-bee8a48790c3?w=1200&q=80', title: 'Ensayo General', category: 'Backstage' },
  { id: 5, type: 'video', url: 'https://images.unsplash.com/photo-1459749411177-042180ce673c?w=1200&q=80', title: 'Lanzamiento Ambar', category: 'Promo' },
  { id: 6, type: 'image', url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=80', title: 'Sesión Acústica', category: 'Estudio' },
];

const GalleryPage = () => {
  return (
    <div className="selection:bg-amber-honey/30">
      <Head>
        <title>Ms Ambar | Galería de Luz</title>
      </Head>

      <section className="max-w-[1400px] mx-auto px-6 md:px-10 pb-20">
        <header className="mb-20 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl md:text-8xl font-black tracking-tighter mb-4"
          >
            GALERÍA DE <span className="text-glow text-amber-honey">LUZ</span>
          </motion.h1>
          <p className="opacity-40 uppercase tracking-[0.5em] text-[10px] font-bold">Visual de Tours & Sesiones</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {GALLERY_ITEMS.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="group relative aspect-[4/5] rounded-[3rem] overflow-hidden amber-glass cursor-pointer"
            >
              <img
                src={item.url}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100"
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-nature-night/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-10">
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-amber-honey text-nature-night px-4 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">
                    {item.category}
                  </span>
                  {item.type === 'video' && <Play size={14} className="text-amber-honey" />}
                </div>
                <h3 className="text-2xl font-extrabold tracking-tight mb-2">{item.title}</h3>
                <div className="flex items-center gap-2 text-amber-honey opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                  <Expand size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Ver Detalles</span>
                </div>
              </div>

              {/* Static Icon for video */}
              {item.type === 'video' && (
                <div className="absolute top-8 right-8 w-10 h-10 bg-nature-night/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10">
                  <Play size={16} className="text-amber-honey" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default GalleryPage;
