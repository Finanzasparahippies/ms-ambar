import React from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { Play, Share2, Disc, ExternalLink } from 'lucide-react';

const ALBUMS = [
  { id: 1, title: 'Eclipse', year: '2026', tracks: 12, cover: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&q=80' },
  { id: 2, title: 'Ambar Vision', year: '2024', tracks: 10, cover: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&q=80' },
  { id: 3, title: 'Desierto de Cristal', year: '2023', tracks: 8, cover: 'https://images.unsplash.com/photo-1514525253361-bee8a48790c3?w=500&q=80' },
];

const MusicPage = () => {
  return (
    <div className="min-h-screen bg-black text-white font-['Inter'] selection:bg-amber-500/30">
      <Head>
        <title>MS AMBAR | Música</title>
      </Head>

      <main className="max-w-[1400px] mx-auto px-10 py-24">
        <header className="mb-32">
          <motion.h1 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-[12vw] font-black tracking-tighter leading-[0.8] mb-10"
          >
            DISCOGRAFÍA
          </motion.h1>
          <div className="flex gap-4">
            <button className="bg-amber-500 text-black px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
              <Play size={14} fill="black" /> Escuchar en Spotify
            </button>
            <button className="border border-neutral-800 px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-white hover:text-black transition-all">
              <Disc size={14} /> Apple Music
            </button>
          </div>
        </header>

        <div className="space-y-40">
          {ALBUMS.map((album, i) => (
            <motion.section 
              key={album.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-col lg:flex-row items-center gap-20"
            >
              <div className="w-full lg:w-1/2 relative group">
                <div className="absolute inset-0 bg-amber-500 blur-[100px] opacity-0 group-hover:opacity-20 transition-opacity duration-700" />
                <img 
                  src={album.cover} 
                  alt={album.title} 
                  className="w-full aspect-square object-cover rounded-[3rem] shadow-2xl relative z-10 grayscale group-hover:grayscale-0 transition-all duration-700" 
                />
              </div>

              <div className="flex-1">
                <span className="text-amber-500 text-sm font-black tracking-[0.5em] mb-4 block">{album.year}</span>
                <h2 className="text-7xl font-black tracking-tighter mb-8">{album.title}</h2>
                <p className="text-neutral-500 mb-12 text-lg italic leading-relaxed">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                </p>
                
                <div className="space-y-4 mb-16">
                   {[1, 2, 3, 4].map(track => (
                     <div key={track} className="flex items-center justify-between py-4 border-b border-neutral-900 group cursor-pointer hover:border-amber-500/50 transition-colors">
                        <div className="flex items-center gap-6">
                           <span className="text-neutral-700 font-mono text-sm group-hover:text-amber-500 transition-colors">0{track}</span>
                           <span className="text-sm font-bold tracking-tight uppercase">Canción de Ejemplo {track}</span>
                        </div>
                        <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Share2 size={16} className="text-neutral-500 hover:text-white" />
                           <ExternalLink size={16} className="text-neutral-500 hover:text-white" />
                        </div>
                     </div>
                   ))}
                </div>

                <button className="text-xs font-black uppercase tracking-[0.4em] text-neutral-400 hover:text-amber-500 transition-colors flex items-center gap-3">
                  Ver Álbum Completo <ArrowRight size={14} />
                </button>
              </div>
            </motion.section>
          ))}
        </div>
      </main>
    </div>
  );
};

const ArrowRight = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

export default MusicPage;
