import React from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { Send, Mail, Phone, Download, Globe } from 'lucide-react';

const ContactPage = () => {
  return (
    <div className="selection:bg-amber-honey/30">
      <Head>
        <title>MS AMBAR | Booking</title>
      </Head>

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 pb-20">
        <div className="grid lg:grid-cols-2 gap-24 items-center">
          <div>
            <motion.span 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-amber-honey text-xs font-black uppercase tracking-[0.5em] mb-8 block text-glow"
            >
              Management & Booking
            </motion.span>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-7xl md:text-8xl font-black tracking-tighter mb-10 leading-[0.9]"
            >
              HAGAMOS ALGO<br /><span className="text-amber-honey opacity-40 italic">MEMORABLE</span>
            </motion.h1>
            
            <p className="opacity-50 text-lg mb-16 max-w-md leading-relaxed italic">
              Para presentaciones en festivales, colaboraciones de marca o crónicas musicales, contacta directamente con nuestro equipo.
            </p>

            <div className="space-y-8">
               <div className="flex items-center gap-6 group amber-glass p-6 rounded-3xl w-fit pr-12 border-transparent hover:border-amber-honey/20 transition-all cursor-pointer">
                  <div className="w-14 h-14 bg-amber-honey rounded-2xl flex items-center justify-center text-nature-night shadow-lg shadow-amber-honey/20">
                     <Mail size={24} />
                  </div>
                  <div>
                     <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">Email Oficial</p>
                     <p className="text-sm font-bold">booking@msambar.dev</p>
                  </div>
               </div>
               <div className="flex items-center gap-6 group amber-glass p-6 rounded-3xl w-fit pr-12 border-transparent hover:border-amber-honey/20 transition-all cursor-pointer">
                  <div className="w-14 h-14 bg-amber-honey/10 rounded-2xl flex items-center justify-center text-amber-honey">
                     <Download size={24} />
                  </div>
                  <div>
                     <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">Press Kit</p>
                     <p className="text-sm font-bold underline decoration-amber-honey/40">Descargar EPK (PDF, 25MB)</p>
                  </div>
               </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-amber-honey/5 blur-3xl rounded-full opacity-50 pointer-events-none" />
            <motion.form 
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="amber-glass p-10 md:p-14 rounded-[3.5rem] border-2 border-amber-honey/5 relative"
            >
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-2">Nombre</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold focus:border-amber-honey/50 outline-none transition-all" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-2">Email</label>
                  <input type="email" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold focus:border-amber-honey/50 outline-none transition-all" />
                </div>
              </div>
              
              <div className="space-y-3 mb-6">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-2">Naturaleza del Evento</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold focus:border-amber-honey/50 outline-none transition-all appearance-none">
                  <option className="bg-nature-night">Festival de Música</option>
                  <option className="bg-nature-night">Evento Privado</option>
                  <option className="bg-nature-night">Campaña Artística</option>
                  <option className="bg-nature-night">Colaboración</option>
                </select>
              </div>

              <div className="space-y-3 mb-10">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-2">Tu Mensaje</label>
                <textarea rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold focus:border-amber-honey/50 outline-none transition-all resize-none"></textarea>
              </div>

              <button className="btn-amber w-full flex items-center justify-center gap-4 group">
                Enviar Mensaje <Send size={18} className="group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
