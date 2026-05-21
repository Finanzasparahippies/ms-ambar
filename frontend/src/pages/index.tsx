import * as React from 'react';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Ticket, ArrowRight, Sparkles, ChevronRight, Play
} from 'lucide-react';

const Home = () => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <div className="selection:bg-amber-honey/30 overflow-x-hidden font-outfit text-white">
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
            <Link
              href="/tour"
              className="px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] bg-amber-honey text-[#06070b] shadow-lg shadow-amber-honey/20 hover:scale-105 transition-all flex items-center gap-3"
            >
              <Ticket size={14} /> Adquirir Boletos
            </Link>
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
              { title: 'Ritual Acústico', desc: 'Sesión en Vivo en Teatros CDMX', img: 'https://images.unsplash.com/photo-1514525253361-bee8a48790c3?q=80&w=800&auto=format&fit=crop' },
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
              Visitar el Newsletter de Ms Ambar <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
