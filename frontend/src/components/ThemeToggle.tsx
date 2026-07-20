import React from 'react';
import { motion } from 'framer-motion';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  toggle: () => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, toggle }) => {
  return (
    <button
      onClick={toggle}
      className="relative w-16 h-8 rounded-full amber-glass flex items-center px-1 group transition-all duration-500"
      aria-label="Toggle theme"
    >
      <motion.div
        animate={{
          x: theme === 'light' ? 0 : 32,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="relative z-10 w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
        style={{
          background: theme === 'light' ? 'linear-gradient(135deg, #FFBF00, #F4D03F)' : 'linear-gradient(135deg, #0B0D17, #22A6B3)',
        }}
      >
        {theme === 'light' ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-3 h-3 bg-white/20 rounded-full blur-[2px]"
          />
        ) : (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-2 h-2 bg-white/40 rounded-full blur-[1px] absolute top-1 right-1"
          />
        )}
      </motion.div>
      
      {/* Decorative Glow */}
      <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md bg-amber-honey/10" />
    </button>
  );
};

export default ThemeToggle;
