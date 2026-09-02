import Link from 'next/link';
import { useRouter } from 'next/router';
import * as React from 'react';
import Navbar from './Navbar';
import ThemedSection from './ThemedSection';
import CartDrawer from './CartDrawer';

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
    const authSectionKey = router.pathname.startsWith('/dashboard') || router.pathname.startsWith('/admin') ? 'dashboard' : 'auth_pages';
    return (
      <ThemedSection sectionKey={authSectionKey} className="min-h-screen selection:bg-amber-honey/30 overflow-x-hidden font-outfit relative">
        <main className="relative z-10 min-h-screen">
          {children}
        </main>
        <CartDrawer />
      </ThemedSection>
    );
  }

  return (
    <div className="min-h-screen selection:bg-amber-honey/30 overflow-x-hidden font-outfit relative">
      <Navbar />
      <CartDrawer />

      {/* Decorative Nature Elements (Static Background) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-honey/10 blur-2xl md:blur-[120px] rounded-full will-change-transform opacity-70 md:opacity-100" />
        <div className="absolute bottom-[-5%] left-[-5%] w-[40%] h-[40%] bg-nature-sky/5 blur-xl md:blur-[100px] rounded-full will-change-transform opacity-70 md:opacity-100" />
      </div>

      <main className="relative z-10 pt-32">
        {children}
      </main>

      {/* Footer (Nature inspired - Static & Stable) */}
      <ThemedSection sectionKey="footer" className="relative z-10 py-12 px-6 mt-16 border-t border-amber-honey/20 bg-[#0c0f0d] rounded-t-[2.5rem] md:rounded-t-[3.5rem] md:py-16 md:px-10 md:mt-24 shadow-2xl">
        <div className="max-w-[1200px] mx-auto grid md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <Link href="/" className="inline-block mb-6">
              <img src="/logos/ms_ambar_logo_b.png" alt="Ms Ambar" className="h-10 w-auto object-contain hover:opacity-80 transition-opacity duration-300" />
            </Link>
            <p className="text-neutral-400 text-sm max-w-sm leading-relaxed">
              Cantautora sonorense; artista independiente de México para el mundo.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest mb-6 text-amber-honey">Navegación</h4>
            <ul className="space-y-4 text-xs font-bold text-neutral-300">
              <li><a href="/" className="hover:text-amber-honey transition-colors">Inicio</a></li>
              <li><a href="/comprar-boletos" className="hover:text-amber-honey transition-colors">Accesos</a></li>
              <li><a href="/musica" className="hover:text-amber-honey transition-colors">Música</a></li>
              <li><a href="/tienda" className="hover:text-amber-honey transition-colors">Tienda</a></li>
              <li><a href="/galeria" className="hover:text-amber-honey transition-colors">Galería</a></li>
              <li><a href="/ambar-te-escribe" className="hover:text-amber-honey transition-colors">Ambar Te escribe</a></li>
              <li><a href="/contacto" className="hover:text-amber-honey transition-colors">Contacto</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest mb-6 text-amber-honey">Contacto</h4>
            <ul className="space-y-4 text-xs font-bold text-neutral-300">
              <li className="hover:text-amber-honey transition-colors">promociones@msambar.com</li>
              <li className="hover:text-amber-honey transition-colors">@ms.ambarc</li>
            </ul>
          </div>
        </div>
        <div className="max-w-[1200px] mx-auto mt-10 md:mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center text-[10px] uppercase tracking-widest text-neutral-400 font-black gap-4">
          <span>&copy; {new Date().getFullYear()} Ms Ambar</span>
          <span className="flex flex-wrap items-center justify-center gap-1.5">
            <span>Hecho en colaboración para Ms Ambar en México</span>
            <span className="opacity-40">•</span>
            <span>Desarrollado por</span>
            <a
              href="https://nectarlabs.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-white hover:text-amber-honey transition-all duration-300 font-black tracking-normal group"
            >
              <svg className="w-3.5 h-3.5 fill-current text-amber-honey group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              NectarLabs
            </a>
          </span>
        </div>
      </ThemedSection>
    </div>
  );
};

export default Layout;
