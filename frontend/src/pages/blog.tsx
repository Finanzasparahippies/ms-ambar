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
    <div className="min-h-screen bg-black text-white font-['Inter'] selection:bg-amber-500/30">
      <Head>
        <title>MS AMBAR | Blog</title>
      </Head>

      <main className="max-w-[1200px] mx-auto px-10 py-24">
        <header className="mb-32 flex justify-between items-end">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-8xl font-black tracking-tighter"
            >
              JOURNAL
            </motion.h1>
            <p className="text-neutral-500 mt-4 text-xl italic uppercase tracking-widest">Update & Stories</p>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500">Filtrar por</p>
            <div className="flex gap-6 mt-4 text-[10px] uppercase font-bold text-neutral-600">
               <span className="text-white">Todos</span>
               <span className="hover:text-white cursor-pointer">Tour</span>
               <span className="hover:text-white cursor-pointer">Music</span>
               <span className="hover:text-white cursor-pointer">Personal</span>
            </div>
          </div>
        </header>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-16">
          {POSTS.map((post, i) => (
            <motion.article 
              key={post.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group cursor-pointer"
            >
              <div className="aspect-[16/10] bg-neutral-900 rounded-[2.5rem] overflow-hidden mb-8 relative">
                <img 
                  src={post.image} 
                  alt={post.title} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                />
                <div className="absolute top-6 left-6">
                   <span className="bg-amber-500 text-black px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest">
                     {post.tag}
                   </span>
                </div>
              </div>
              
              <div className="flex items-center gap-6 mb-6 text-[9px] font-black uppercase tracking-[0.2em] text-neutral-600">
                 <div className="flex items-center gap-2">
                    <Calendar size={12} /> {post.date}
                 </div>
                 <div className="flex items-center gap-2">
                    <User size={12} /> MS Ambar
                 </div>
              </div>

              <h2 className="text-2xl font-black tracking-tight mb-4 group-hover:text-amber-500 transition-colors leading-tight">
                {post.title}
              </h2>
              <p className="text-neutral-500 text-sm leading-relaxed mb-8 line-clamp-2">
                {post.excerpt}
              </p>
              
              <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-white transition-all">
                 Leer Más <ArrowUpRight size={14} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </button>
            </motion.article>
          ))}
        </div>

        {/* Newsletter Section */}
        <div className="mt-40 bg-neutral-900/30 p-20 rounded-[4rem] border border-neutral-800 text-center">
           <h3 className="text-4xl font-black mb-6 tracking-tight">Únete a la Comunidad</h3>
           <p className="text-neutral-500 mb-12 max-w-lg mx-auto italic">Recibe contenido exclusivo, preventas y noticias antes que nadie.</p>
           <form className="max-w-md mx-auto flex gap-4">
              <input 
                type="email" 
                placeholder="TU EMAIL" 
                className="flex-1 bg-black/50 border border-neutral-800 rounded-2xl px-6 py-4 text-xs font-black focus:outline-none focus:border-amber-500 transition-colors"
              />
              <button className="bg-white text-black px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 transition-all">
                Suscribir
              </button>
           </form>
        </div>
      </main>
    </div>
  );
};

export default BlogPage;
