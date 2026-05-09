import React from 'react';
import Navbar from './Navbar';
import { motion, AnimatePresence } from 'framer-motion';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen selection:bg-amber-honey/30 overflow-x-hidden font-outfit relative">
      <Navbar />
      
      {/* Decorative Nature Elements (Static Background) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-honey/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-5%] left-[-5%] w-[40%] h-[40%] bg-nature-sky/5 blur-[100px] rounded-full" />
      </div>

      <main className="relative z-10 pt-32">
        {children}
      </main>

      {/* Footer (Nature inspired) */}
      <footer className="relative z-10 py-20 px-10 mt-20 border-t border-white/5 amber-glass rounded-t-[4rem]">
        <div className="max-w-[1200px] mx-auto grid md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <h2 className="text-4xl font-black mb-6 tracking-tighter">MS AMBAR</h2>
            <p className="opacity-50 text-sm max-w-sm leading-relaxed">
              Explorando la intersección entre la naturaleza, la historia y el sonido. Artista independiente desde México para el mundo.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest mb-6 text-amber-honey">Navegación</h4>
            <ul className="space-y-4 text-xs font-bold opacity-60">
              <li><a href="/music" className="hover:text-amber-honey">Música</a></li>
              <li><a href="/gallery" className="hover:text-amber-honey">Galería</a></li>
              <li><a href="/merch" className="hover:text-amber-honey">Shop</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest mb-6 text-amber-honey">Contacto</h4>
            <ul className="space-y-4 text-xs font-bold opacity-60">
              <li>booking@msambar.dev</li>
              <li>@msambar_oficial</li>
            </ul>
          </div>
        </div>
        <div className="max-w-[1200px] mx-auto mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-[10px] uppercase tracking-widest opacity-30 font-black">
          <span>&copy; 2026 MS AMBAR</span>
          <span>Hecho con Ámbar en México</span>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
