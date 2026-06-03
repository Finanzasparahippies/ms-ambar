import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ThemeToggle from './ThemeToggle';
import { LogOut, Shield, Layers, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/** Decodes a JWT payload client-side (no signature verification). */
function decodeJwt(token: string): Record<string, any> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

const Navbar = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Force light theme
    setTheme('light');
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');

    // Read auth status directly from the JWT payload — no localStorage.user needed
    const token = localStorage.getItem('token');
    if (token) {
      const payload = decodeJwt(token);
      // Treat token as expired / invalid if exp is in the past
      if (payload && !(payload.exp && Date.now() / 1000 > payload.exp)) {
        setIsAuthenticated(true);
        setIsAdmin(!!payload.is_staff);
      } else {
        // Token expired — clean up silently
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
      }
    } else {
      setIsAuthenticated(false);
      setIsAdmin(false);
    }
    setIsMobileMenuOpen(false);
  }, [router.pathname]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setIsAdmin(false);
    router.push('/login');
  };

  // Public navigation links — Designer is intentionally excluded (admin-only)
  const navLinks = [
    { name: 'Inicio', href: '/' },
    { name: 'Accesos', href: '/comprar-boletos' },
    // { name: 'Galería', href: '/galleria' }, // TODO: Habilitar cuando esté completado
    // { name: 'Música', href: '/musica' }, // TODO: Habilitar cuando esté completado
    { name: 'Tienda', href: '/tienda' },
    { name: 'Ambar Te Escribe', href: '/ambar-te-escribe' },
    { name: 'Contacto', href: '/contacto' },
    // { name: 'Entretenimiento', href: '/entretenimiento' }, // TODO: Habilitar cuando esté completado
  ];

  return (
    <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-[1200px]">
      <div className="amber-glass px-8 py-4 rounded-[2rem] flex justify-between items-center">
        <Link href="/" className="flex items-center gap-4 group">
          <div className="w-10 h-10 bg-amber-honey rounded-full flex items-center justify-center shadow-lg shadow-amber-honey/20 transition-transform group-hover:rotate-12">
            <span className="text-nature-night font-black text-lg">A</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tighter text-glow">MS AMBAR</h1>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex gap-6 items-center">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className={`text-[10px] uppercase font-bold tracking-[0.3em] transition-all hover:text-amber-honey ${router.pathname === link.href ? 'text-amber-honey' : 'opacity-60'
                }`}
            >
              {link.name}
            </Link>
          ))}
          <div className="h-6 w-px bg-white/10 mx-2" />

          {/* Dynamic Authentication Controls */}
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              {isAdmin && (
                <>
                  {/* Nectar Studio Designer — admins only */}
                  <Link
                    href="/designer"
                    className={`text-[9px] uppercase font-black tracking-widest flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${router.pathname === '/designer'
                      ? 'bg-amber-honey text-nature-night border-amber-honey'
                      : 'text-amber-honey bg-amber-honey/10 border-amber-honey/20 hover:bg-amber-honey/25'
                      }`}
                    title="Nectar Studio Designer — Solo Admins"
                  >
                    <Layers size={10} /> Studio
                  </Link>
                  {/* Admin Dashboard */}
                  <Link
                    href="/dashboard"
                    className={`text-[9px] uppercase font-black tracking-widest flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${router.pathname.startsWith('/dashboard')
                      ? 'bg-amber-honey text-nature-night border-amber-honey'
                      : 'text-amber-honey bg-amber-honey/10 border-amber-honey/20 hover:bg-amber-honey/25'
                      }`}
                  >
                    <Shield size={10} /> Admin
                  </Link>
                </>
              )}
              <button
                onClick={handleLogout}
                className="text-[9px] uppercase font-black tracking-widest opacity-60 hover:opacity-100 hover:text-red-400 transition-colors flex items-center gap-1"
                title="Cerrar Sesión"
              >
                <LogOut size={12} /> Salir
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-[9px] uppercase font-black tracking-widest text-amber-honey hover:text-white transition-all bg-white/5 border border-white/10 px-4 py-2 rounded-full hover:bg-white/10"
            >
              Login
            </Link>
          )}

          {/* <div className="h-6 w-px bg-white/10 mx-1" />
          <ThemeToggle theme={theme} toggle={toggleTheme} /> */}
        </div>

        {/* Mobile controls */}
        <div className="flex md:hidden items-center gap-4">
          {/* <ThemeToggle theme={theme} toggle={toggleTheme} /> */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-white hover:text-amber-honey p-1 transition-colors outline-none"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="amber-glass mt-2 p-6 rounded-[2rem] flex flex-col gap-4 md:hidden border border-white/5 shadow-2xl"
          >
            <div className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`text-[11px] uppercase font-bold tracking-[0.25em] transition-all hover:text-amber-honey py-2 border-b border-white/[0.03] ${router.pathname === link.href ? 'text-amber-honey' : 'opacity-60'
                    }`}
                >
                  {link.name}
                </Link>
              ))}
            </div>

            {/* Authentication state in mobile menu */}
            {isAuthenticated ? (
              <div className="flex flex-col gap-3 pt-3 border-t border-white/10">
                {isAdmin && (
                  <div className="flex gap-3">
                    <Link
                      href="/designer"
                      className={`text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full border transition-all flex-1 ${router.pathname === '/designer'
                        ? 'bg-amber-honey text-nature-night border-amber-honey'
                        : 'text-amber-honey bg-amber-honey/10 border-amber-honey/20 hover:bg-amber-honey/25'
                        }`}
                    >
                      <Layers size={12} /> Studio
                    </Link>
                    <Link
                      href="/dashboard"
                      className={`text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full border transition-all flex-1 ${router.pathname.startsWith('/dashboard')
                        ? 'bg-amber-honey text-nature-night border-amber-honey'
                        : 'text-amber-honey bg-amber-honey/10 border-amber-honey/20 hover:bg-amber-honey/25'
                        }`}
                    >
                      <Shield size={12} /> Admin
                    </Link>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="text-[10px] uppercase font-black tracking-widest text-red-400 hover:text-red-300 transition-colors flex items-center justify-center gap-1.5 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl w-full"
                >
                  <LogOut size={14} /> Salir
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-[10px] uppercase font-black tracking-widest text-amber-honey hover:text-white text-center transition-all bg-white/5 border border-white/10 py-3 rounded-2xl hover:bg-white/10 mt-2"
              >
                Login
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
