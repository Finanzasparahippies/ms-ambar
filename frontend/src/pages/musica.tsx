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
    <div className="selection:bg-amber-honey/30">
      <Head>
        <title>Ms Ambar | Discografía</title>
      </Head>

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 pb-20">
        <header className="mb-32">
          <motion.h1
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-[12vw] font-black tracking-tighter leading-[0.8] mb-12"
          >
            DISCO<span className="text-amber-honey text-glow">GRAFÍA</span>
          </motion.h1>
          <div className="flex flex-wrap gap-6">
            <button className="btn-amber flex items-center gap-4 px-10">
              <Play size={18} fill="currentColor" /> Escuchar en Spotify
            </button>
            <button className="amber-glass border border-white/10 px-10 py-4 rounded-full text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-4 hover:bg-white/10 transition-all">
              <Disc size={18} /> Apple Music
            </button>
          </div>
        </header>

        <div className="space-y-60">
          {ALBUMS.map((album, i) => (
            <motion.section
              key={album.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-col lg:flex-row items-center gap-24"
            >
              <div className="w-full lg:w-1/2 relative group">
                <div className="absolute inset-0 bg-amber-honey blur-[120px] opacity-0 group-hover:opacity-20 transition-opacity duration-700" />
                <div className="relative z-10 aspect-square rounded-[4rem] overflow-hidden amber-glass border-2 border-amber-honey/10">
                  <img
                    src={album.cover}
                    alt={album.title}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 scale-105 group-hover:scale-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-nature-night/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>
              </div>

              <div className="flex-1">
                <span className="text-amber-honey text-sm font-black tracking-[0.5em] mb-4 block opacity-60">{album.year}</span>
                <h2 className="text-6xl md:text-8xl font-black tracking-tighter mb-8">{album.title}</h2>
                <p className="opacity-50 mb-12 text-lg italic leading-relaxed max-w-xl">
                  Explorando texturas orgánicas y ritmos ancestrales, este álbum redefine el sonido contemporáneo de Ms Ambar.
                </p>

                <div className="space-y-2 mb-16 amber-glass p-8 rounded-[3rem]">
                  {[1, 2, 3, 4].map(track => (
                    <div key={track} className="flex items-center justify-between py-5 border-b border-white/5 group cursor-pointer hover:bg-white/5 px-6 rounded-2xl transition-all">
                      <div className="flex items-center gap-6">
                        <span className="opacity-20 font-mono text-sm group-hover:text-amber-honey group-hover:opacity-100 transition-all">0{track}</span>
                        <span className="text-sm font-extrabold tracking-tight uppercase">Sinfonía del Ámbar {track}</span>
                      </div>
                      <div className="flex items-center gap-5 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                        <Share2 size={16} className="opacity-40 hover:text-amber-honey hover:opacity-100" />
                        <ExternalLink size={16} className="opacity-40 hover:text-amber-honey hover:opacity-100" />
                      </div>
                    </div>
                  ))}
                </div>

                <button className="text-[10px] font-black uppercase tracking-[0.5em] text-amber-honey hover:text-glow transition-all flex items-center gap-4 group">
                  Explorar Obra Completa <ArrowUpRight size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </button>
              </div>
            </motion.section>
          ))}
        </div>
      </div>
    </div>
  );
};

const ArrowUpRight = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M7 17L17 7M17 7H7M17 7V17" />
  </svg>
);

export default MusicPage;
