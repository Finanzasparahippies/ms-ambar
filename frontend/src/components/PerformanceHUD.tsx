import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Zap, Cpu, BarChart3 } from 'lucide-react';

const PerformanceHUD = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [fps, setFps] = useState(0);
  const [vitals, setVitals] = useState<Record<string, number>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'P') {
        setIsVisible(!isVisible);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    if (!isVisible) {
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }

    // FPS Counter
    let frameCount = 0;
    let lastTime = performance.now();
    let animationId: number;

    const updateFps = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = now;
      }
      animationId = requestAnimationFrame(updateFps);
    };

    animationId = requestAnimationFrame(updateFps);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-4 right-4 z-[9999] bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-4 text-white font-mono text-xs shadow-2xl min-w-[200px]"
      >
        <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2">
          <Activity size={14} className="text-amber-400" />
          <span className="font-bold text-amber-100 uppercase tracking-wider">Performance Manager</span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-white/50 flex items-center gap-1">
              <Zap size={12} /> Render FPS
            </span>
            <span className={`${fps > 55 ? 'text-green-400' : 'text-amber-400'}`}>{fps}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-white/50 flex items-center gap-1">
              <Cpu size={12} /> Status
            </span>
            <span className="text-blue-400">OPTIMIZED</span>
          </div>

          <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-white/30">
            Press <kbd className="bg-white/10 px-1 rounded text-white/60">Shift + P</kbd> to hide
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PerformanceHUD;
