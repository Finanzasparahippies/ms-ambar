import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ThemeToggle from './ThemeToggle';
import { LogOut, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

const Navbar = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }

    // Check user authentication status on mount
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token) {
      setIsAuthenticated(true);
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.is_staff) {
            setIsAdmin(true);
          }
        } catch (e) {}
      }
    }
  }, [router.pathname]); // Re-run when navigation changes to catch login/logout events

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

  const navLinks = [
    { name: 'Tour', href: '/' },
    { name: 'Designer', href: '/designer' },
    { name: 'Galería', href: '/gallery' },
    { name: 'Música', href: '/music' },
    { name: 'Shop', href: '/merch' },
    { name: 'Blog', href: '/blog' },
    { name: 'Booking', href: '/contact' },
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
 
        <div className="hidden md:flex gap-6 items-center">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className={`text-[10px] uppercase font-bold tracking-[0.3em] transition-all hover:text-amber-honey ${
                router.pathname === link.href ? 'text-amber-honey' : 'opacity-60'
              }`}
            >
              {link.name}
            </Link>
          ))}
          <div className="h-6 w-px bg-white/10 mx-2" />
          
          {/* Dynamic Authentication Controls */}
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              {isAdmin && (
                <Link
                  href="/dashboard"
                  className="text-[9px] uppercase font-black tracking-widest text-amber-honey bg-amber-honey/10 border border-amber-honey/20 px-3.5 py-1.5 rounded-full hover:bg-amber-honey/25 transition-all flex items-center gap-1.5"
                >
                  <Shield size={10} /> Panel Admin
                </Link>
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

          <div className="h-6 w-px bg-white/10 mx-1" />
          <ThemeToggle theme={theme} toggle={toggleTheme} />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
