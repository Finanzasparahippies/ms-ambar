import React from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { Calendar, User, ArrowUpRight } from 'lucide-react';

const POSTS = [
  { 
    id: 1, 
    title: 'Detrás de Escena: La creación de "Eclipse"', 
    excerpt: 'Exploramos el proceso creativo y las influencias detrás del nuevo álbum de MS AMBAR.', 
    date: '10 May, 2026', 
    image: 'https://images.unsplash.com/photo-1514525253361-bee8a48790c3?w=800&q=80',
    tag: 'Creativo'
  },
  { 
    id: 2, 
    title: 'Gira Europea Confirmada: 12 Ciudades', 
    excerpt: 'La artista se presentará en los escenarios más emblemáticos de Europa este otoño.', 
    date: '05 May, 2026', 
    image: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=800&q=80',
    tag: 'Tour'
  },
  { 
    id: 3, 
    title: 'Entrevista Exclusiva con Vogue', 
    excerpt: 'MS AMBAR habla sobre moda, activismo y el futuro de la música independiente.', 
    date: '01 May, 2026', 
    image: 'https://images.unsplash.com/photo-1459749411177-042180ce673c?w=800&q=80',
    tag: 'Prensa'
  }
];

const BlogPage = () => {
  return (
    <div className="selection:bg-amber-honey/30">
      <Head>
        <title>MS AMBAR | Journal</title>
      </Head>

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 pb-20">
        <header className="mb-24 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-7xl md:text-9xl font-black tracking-tighter"
            >
              JOURNAL
            </motion.h1>
            <p className="opacity-40 mt-4 text-sm font-bold uppercase tracking-[0.4em] text-glow text-amber-honey">Bitácora de Luz & Sonido</p>
          </div>
          <div className="amber-glass px-8 py-4 rounded-2xl">
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-amber-honey mb-4">Filtrar Historias</p>
            <div className="flex gap-8 text-[10px] uppercase font-bold opacity-60">
               <span className="text-amber-honey cursor-pointer underline decoration-2 underline-offset-8">Todos</span>
               <span className="hover:text-amber-honey cursor-pointer transition-colors">Tour</span>
               <span className="hover:text-amber-honey cursor-pointer transition-colors">Proceso</span>
               <span className="hover:text-amber-honey cursor-pointer transition-colors">Prensa</span>
            </div>
          </div>
        </header>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
          {POSTS.map((post, i) => (
            <motion.article 
              key={post.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group cursor-pointer amber-glass p-6 rounded-[3rem] hover:scale-[1.02] transition-all"
            >
              <div className="aspect-[16/11] rounded-[2rem] overflow-hidden mb-8 relative">
                <img 
                  src={post.image} 
                  alt={post.title} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100" 
                />
                <div className="absolute top-6 left-6">
                   <span className="bg-amber-honey text-nature-night px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-amber-honey/20">
                     {post.tag}
                   </span>
                </div>
              </div>
              
              <div className="flex items-center gap-6 mb-6 text-[9px] font-black uppercase tracking-[0.2em] opacity-40">
                 <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-amber-honey" /> {post.date}
                 </div>
                 <div className="flex items-center gap-2">
                    <User size={12} className="text-amber-honey" /> MS Ambar
                 </div>
              </div>

              <h2 className="text-2xl font-extrabold tracking-tight mb-4 group-hover:text-amber-honey transition-colors leading-tight">
                {post.title}
              </h2>
              <p className="opacity-50 text-sm leading-relaxed mb-8 line-clamp-2">
                {post.excerpt}
              </p>
              
              <button className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-amber-honey group-hover:text-glow transition-all">
                 Inmersión <ArrowUpRight size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </button>
            </motion.article>
          ))}
        </div>

        {/* Newsletter Section */}
        <div className="mt-40 amber-glass p-12 md:p-24 rounded-[4rem] text-center border-2 border-amber-honey/5">
           <h3 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter">Únete al <span className="text-amber-honey text-glow">Círculo</span></h3>
           <p className="opacity-50 mb-12 max-w-lg mx-auto text-sm italic">Recibe contenido exclusivo, preventas y crónicas antes que nadie.</p>
           <form className="max-w-md mx-auto flex flex-col md:flex-row gap-4">
              <input 
                type="email" 
                placeholder="TU CORREO ELECTRÓNICO" 
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-8 py-5 text-xs font-bold focus:outline-none focus:border-amber-honey/50 transition-colors"
              />
              <button className="btn-amber">
                Suscribir
              </button>
           </form>
        </div>
      </div>
    </div>
  );
};

export default BlogPage;
