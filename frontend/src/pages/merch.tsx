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
    <div className="selection:bg-amber-honey/30">
      <Head>
        <title>MS AMBAR | Shop</title>
      </Head>

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 pb-20">
        {/* Categories Bar */}
        <div className="flex gap-10 mb-24 amber-glass px-10 py-6 rounded-full w-fit mx-auto text-[10px] uppercase font-black tracking-[0.3em]">
          <button className="text-amber-honey text-glow">Todos</button>
          <button className="opacity-40 hover:opacity-100 transition-all">Música</button>
          <button className="opacity-40 hover:opacity-100 transition-all">Ropa</button>
          <button className="opacity-40 hover:opacity-100 transition-all">Arte</button>
        </div>

        <header className="mb-24 text-center">
          <motion.h1 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-7xl md:text-9xl font-black tracking-tighter"
          >
            MERCAN<span className="text-amber-honey text-glow">CÍA</span>
          </motion.h1>
          <p className="opacity-40 mt-4 text-[10px] font-bold uppercase tracking-[0.5em]">Colección Curada 2026</p>
        </header>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {PRODUCTS.map((product, i) => (
            <motion.div 
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group cursor-pointer"
            >
              <div className="aspect-[4/5] rounded-[3rem] overflow-hidden relative mb-8 amber-glass border-2 border-transparent group-hover:border-amber-honey/20 transition-all p-3">
                <div className="w-full h-full rounded-[2.2rem] overflow-hidden relative">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-90 group-hover:opacity-100" />
                  <div className="absolute inset-0 bg-gradient-to-t from-nature-night/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="w-16 h-16 bg-amber-honey rounded-full flex items-center justify-center text-nature-night shadow-2xl shadow-amber-honey/40"
                    >
                      <ShoppingBag size={28} />
                    </motion.button>
                  </div>
                </div>
              </div>
              
              <div className="px-4">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest group-hover:text-amber-honey transition-colors leading-tight max-w-[70%]">{product.name}</h3>
                  <span className="font-black text-sm text-amber-honey">${product.price}</span>
                </div>
                <span className="text-[9px] font-bold opacity-30 uppercase tracking-[0.3em]">{product.category}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Featured Banner */}
        <div className="mt-48 amber-glass rounded-[4rem] p-12 md:p-24 flex flex-col md:flex-row items-center gap-20 border-2 border-amber-honey/5">
          <div className="flex-1">
            <div className="flex items-center gap-3 text-amber-honey mb-8">
              <Star size={18} fill="currentColor" className="text-glow" />
              <span className="text-xs font-black uppercase tracking-[0.4em]">Exclusividad Ámbar</span>
            </div>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-10 leading-[0.9]">
              CAJA DE COLECCIÓN<br /><span className="text-amber-honey text-glow">ECLIPSE</span>
            </h2>
            <p className="opacity-50 mb-12 leading-relaxed max-w-md italic text-lg">
              Una pieza de colección que incluye el vinilo prensado en ámbar líquido, libro de arte y contenido inédito.
            </p>
            <button className="btn-amber px-12 flex items-center gap-6 group">
              Reservar Ahora
              <ArrowRight size={20} className="transition-transform group-hover:translate-x-3" />
            </button>
          </div>
          <div className="w-full md:w-[40%] aspect-square rounded-[4rem] overflow-hidden rotate-3 shadow-2xl shadow-amber-honey/10 relative p-4 amber-glass">
             <img src="https://images.unsplash.com/photo-1594434297575-583cf46c76e0?w=1000&q=80" className="w-full h-full object-cover rounded-[3rem]" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MerchPage;
