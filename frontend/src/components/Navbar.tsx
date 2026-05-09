import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ThemeToggle from './ThemeToggle';
import { motion } from 'framer-motion';

const Navbar = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const router = useRouter();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const navLinks = [
    { name: 'Tour', href: '/' },
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

        <div className="hidden md:flex gap-8 items-center">
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
          <ThemeToggle theme={theme} toggle={toggleTheme} />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
