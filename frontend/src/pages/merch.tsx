import React from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { ShoppingBag, Star, ArrowRight } from 'lucide-react';

const PRODUCTS = [
  { id: 1, name: 'Vinilo "Eclipse" Edición Limitada', price: 850, image: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=500&q=80', category: 'Music' },
  { id: 2, name: 'Hoodie MS AMBAR Black Onyx', price: 1200, image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500&q=80', category: 'Apparel' },
  { id: 3, name: 'T-Shirt Gira Mundial 2026', price: 550, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80', category: 'Apparel' },
  { id: 4, name: 'Poster Autografiado Numerado', price: 400, image: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=500&q=80', category: 'Art' },
];

const MerchPage = () => {
  return (
    <div className="min-h-screen bg-black text-white font-['Inter']">
      <Head>
        <title>MS AMBAR | Merch Store</title>
      </Head>

      {/* Hero Store */}
      <div className="relative h-[50vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/20 to-black z-0" />
        <div className="relative z-10 text-center">
          <motion.span 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-black uppercase tracking-[0.5em] text-amber-500 mb-4 block"
          >
            Colección Oficial
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-7xl font-black tracking-tighter"
          >
            MERCHANDISE
          </motion.h1>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-10 py-24">
        {/* Categories Bar */}
        <div className="flex gap-10 mb-20 border-b border-neutral-800 pb-8 text-[10px] uppercase font-black tracking-widest text-neutral-500">
          <button className="text-white border-b-2 border-amber-500 pb-8 -mb-8">Todos</button>
          <button className="hover:text-amber-500 transition-colors">Música</button>
          <button className="hover:text-amber-500 transition-colors">Ropa</button>
          <button className="hover:text-amber-500 transition-colors">Accesorios</button>
        </div>

        {/* Product Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {PRODUCTS.map((product, i) => (
            <motion.div 
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group cursor-pointer"
            >
              <div className="aspect-[4/5] bg-neutral-900 rounded-[2rem] overflow-hidden relative mb-6">
                <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="w-14 h-14 bg-amber-500 rounded-full flex items-center justify-center text-black"
                  >
                    <ShoppingBag size={24} />
                  </motion.button>
                </div>
              </div>
              
              <div className="px-2">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-black uppercase tracking-tight group-hover:text-amber-500 transition-colors">{product.name}</h3>
                  <span className="font-mono text-sm font-black text-neutral-400">${product.price}</span>
                </div>
                <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">{product.category}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Featured Banner */}
        <div className="mt-40 bg-neutral-900/50 rounded-[4rem] p-20 border border-neutral-800 flex flex-col md:flex-row items-center gap-20">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-amber-500 mb-6">
              <Star size={16} fill="currentColor" />
              <span className="text-xs font-black uppercase tracking-widest">Exclusivo Web</span>
            </div>
            <h2 className="text-5xl font-black tracking-tighter mb-8 leading-tight">
              CAJA DE COLECCIÓN<br />EDICIÓN ANIVERSARIO
            </h2>
            <p className="text-neutral-500 mb-10 leading-relaxed max-w-md italic">
              Incluye vinilo a color, libro de arte de 100 páginas y acceso exclusivo a contenido digital.
            </p>
            <button className="flex items-center gap-4 text-xs font-black uppercase tracking-[0.3em] bg-white text-black px-10 py-6 rounded-2xl hover:bg-amber-500 transition-colors group">
              Reservar Ahora
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-2" />
            </button>
          </div>
          <div className="w-full md:w-1/3 aspect-square bg-neutral-800 rounded-3xl overflow-hidden rotate-3 shadow-2xl">
             <img src="https://images.unsplash.com/photo-1594434297575-583cf46c76e0?w=500&q=80" className="w-full h-full object-cover" />
          </div>
        </div>
      </main>
    </div>
  );
};

export default MerchPage;
