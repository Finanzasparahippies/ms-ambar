import * as React from 'react';
import Navbar from './Navbar';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const router = useRouter();

  // Exclude marketing navbar and footer on auth screens and admin panels
  const isAuthOrAdmin =
    router.pathname.startsWith('/login') ||
    router.pathname.startsWith('/signup') ||
    router.pathname.startsWith('/forgot-password') ||
    router.pathname.startsWith('/reset-password') ||
    router.pathname.startsWith('/admin') ||
    router.pathname.startsWith('/dashboard');

  React.useEffect(() => {
    if (isAuthOrAdmin) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, [isAuthOrAdmin]);

  if (isAuthOrAdmin) {
    return (
      <div data-theme="dark" className="min-h-screen selection:bg-amber-honey/30 overflow-x-hidden font-outfit relative bg-gradient-to-br from-[#080c0a] to-[#040605] text-[#F4F6F0]">
        <main className="relative z-10 min-h-screen">
          {children}
        </main>
      </div>
    );
  }

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
      <footer className="relative z-10 py-12 px-6 mt-12 border-t border-amber-honey/20 dark:border-amber-honey/25 bg-[#0c0f0d] rounded-t-[2.5rem] md:rounded-t-[4rem] md:py-20 md:px-10 md:mt-20 md:bg-white/10 md:dark:bg-[#0c0f0d]/95 md:backdrop-blur-xl shadow-xl dark:shadow-2xl dark:shadow-black">
        <div className="max-w-[1200px] mx-auto grid md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <Link href="/" className="inline-block mb-6">
              <img src="/logos/ms_ambar_logo_b.png" alt="Ms Ambar" className="h-10 w-auto object-contain hover:opacity-80 transition-opacity duration-300" />
            </Link>
            <p className="opacity-50 text-sm max-w-sm leading-relaxed">
              Cantautora sonorense; artista independiente de México para el mundo.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest mb-6 text-amber-honey">Navegación</h4>
            <ul className="space-y-4 text-xs font-bold opacity-60">
              <li><a href="/" className="hover:text-amber-honey">Inicio</a></li>
              <li><a href="/comprar-boletos" className="hover:text-amber-honey">Accesos</a></li>
              <li><a href="/tienda" className="hover:text-amber-honey">Tienda</a></li>
              <li><a href="/ambar-te-escribe" className="hover:text-amber-honey">Ambar Te escribe</a></li>
              <li><a href="/contacto" className="hover:text-amber-honey">Contacto</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest mb-6 text-amber-honey">Contacto</h4>
            <ul className="space-y-4 text-xs font-bold opacity-60">
              <li>promociones@msambar.com</li>
              <li>@ms.ambarc</li>
            </ul>
          </div>
        </div>
        <div className="max-w-[1200px] mx-auto mt-10 md:mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-[10px] uppercase tracking-widest text-[#F4F6F0]/40 font-black gap-4">
          <span>&copy; {new Date().getFullYear()} Ms Ambar</span>
          <span className="flex flex-wrap items-center justify-center gap-1.5">
            <span>Hecho en colaboración para Ms Ambar en México</span>
            <span className="opacity-30">•</span>
            <span>Desarrollado por</span>
            <a
              href="https://nectarlabs.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#F4F6F0]/80 hover:text-amber-honey transition-all duration-300 font-black tracking-normal group"
            >
              <svg className="w-3.5 h-3.5 fill-current text-amber-honey group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              NectarLabs
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
