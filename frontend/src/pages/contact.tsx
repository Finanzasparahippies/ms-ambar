import React from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { Send, Mail, Phone, Download, Globe } from 'lucide-react';

const ContactPage = () => {
  return (
    <div className="min-h-screen bg-black text-white font-['Inter'] selection:bg-amber-500/30 overflow-hidden">
      <Head>
        <title>MS AMBAR | Contrataciones</title>
      </Head>

      <main className="max-w-[1400px] mx-auto px-10 py-24 relative">
        {/* Abstract Background Shape */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-full bg-amber-500/5 blur-[180px] -rotate-12 pointer-events-none" />

        <div className="grid lg:grid-cols-2 gap-32 relative z-10">
          <div>
            <motion.span 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-amber-500 text-xs font-black uppercase tracking-[0.5em] mb-6 block"
            >
              Management & Booking
            </motion.span>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-8xl font-black tracking-tighter mb-10 leading-[0.9]"
            >
              HAGAMOS ALGO<br /><span className="text-neutral-700 italic">MEMORABLE</span>
            </motion.h1>
            
            <p className="text-neutral-500 text-lg mb-16 max-w-md leading-relaxed italic">
              Para presentaciones en festivales, eventos privados o colaboraciones de marca, por favor completa el formulario o contacta directamente a nuestra oficina.
            </p>

            <div className="space-y-10">
               <div className="flex items-center gap-6 group">
                  <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center group-hover:bg-amber-500 group-hover:text-black transition-all">
                     <Mail size={20} />
                  </div>
                  <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600 mb-1">Email Oficial</p>
                     <p className="text-sm font-bold">booking@msambar.com</p>
                  </div>
               </div>
               <div className="flex items-center gap-6 group">
                  <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center group-hover:bg-amber-500 group-hover:text-black transition-all">
                     <Download size={20} />
                  </div>
                  <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600 mb-1">Kit de Prensa</p>
                     <p className="text-sm font-bold underline cursor-pointer hover:text-amber-500 transition-colors">Descargar EPK (PDF, 25MB)</p>
                  </div>
               </div>
               <div className="flex items-center gap-6 group">
                  <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center group-hover:bg-amber-500 group-hover:text-black transition-all">
                     <Globe size={20} />
                  </div>
                  <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600 mb-1">Representación Global</p>
                     <p className="text-sm font-bold">Nectar Labs Agency</p>
                  </div>
               </div>
            </div>
          </div>

          <div>
            <motion.form 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-neutral-900/40 backdrop-blur-3xl p-12 rounded-[3rem] border border-neutral-800"
            >
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 ml-2">Nombre</label>
                  <input type="text" className="w-full bg-black/50 border border-neutral-800 rounded-2xl px-6 py-4 text-xs font-bold focus:border-amber-500 outline-none transition-colors" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 ml-2">Email</label>
                  <input type="email" className="w-full bg-black/50 border border-neutral-800 rounded-2xl px-6 py-4 text-xs font-bold focus:border-amber-500 outline-none transition-colors" />
                </div>
              </div>
              
              <div className="space-y-3 mb-8">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 ml-2">Tipo de Evento</label>
                <select className="w-full bg-black/50 border border-neutral-800 rounded-2xl px-6 py-4 text-xs font-bold focus:border-amber-500 outline-none transition-colors appearance-none">
                  <option>Festival</option>
                  <option>Auditorio / Teatro</option>
                  <option>Evento Privado</option>
                  <option>Campaña de Marca</option>
                </select>
              </div>

              <div className="space-y-3 mb-10">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 ml-2">Mensaje</label>
                <textarea rows={5} className="w-full bg-black/50 border border-neutral-800 rounded-2xl px-6 py-4 text-xs font-bold focus:border-amber-500 outline-none transition-colors resize-none"></textarea>
              </div>

              <button className="w-full py-6 bg-white text-black text-[10px] font-black uppercase tracking-[0.4em] rounded-2xl hover:bg-amber-500 transition-colors flex items-center justify-center gap-4 group">
                Enviar Solicitud <Send size={14} className="group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ContactPage;
