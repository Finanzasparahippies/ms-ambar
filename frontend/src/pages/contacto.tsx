import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mail, Download, ArrowRight, CheckCircle, Calendar, Phone, Award } from 'lucide-react';
import api from '../lib/api';
import { showAlert } from '../lib/notifications';
import ThemedSection from '../components/ThemedSection';

const ContactPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [date, setDate] = useState('');
  const [venueType, setVenueType] = useState('festival');
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name,
        email,
        phone,
        company: company || null,
        date: date || null,
        venue_type: venueType,
        message,
      };
      const res = await api.post('/bookings/inquiries/', payload);
      setSuccessData(res.data);
    } catch (err: any) {
      console.error(err);
      showAlert('Hubo un error al procesar tu solicitud de booking. Por favor verifica tus datos.', 'Error de Envío', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ThemedSection sectionKey="contact_section" className="selection:bg-amber-honey/30 min-h-screen pt-32 pb-20 font-sans text-[#F4F6F0]">
      <Head>
        <title>Ms Ambar | Promociones & Contrataciones</title>
      </Head>

      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-amber-honey text-xs font-black uppercase tracking-[0.5em] mb-8 block text-glow"
            >
              Management & Promociones
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-6xl md:text-8xl font-black tracking-tighter mb-10 leading-[0.9]"
            >
              HAGAMOS ALGO<br /><span className="text-amber-honey opacity-80 italic">MEMORABLE</span>
            </motion.h1>

            <p className="text-[#F4F6F0]/70 text-lg mb-16 max-w-md leading-relaxed">
              Para presentaciones en festivales, clubes, teatros o eventos privados, inicia tu solicitud formal aquí. Nuestro motor genera un borrador de acuerdo inmediato al finalizar.
            </p>

            <div className="space-y-6">
              <div className="flex items-center gap-6 group bg-white/5 border border-white/10 p-6 rounded-3xl w-fit pr-12 hover:border-amber-honey/20 transition-all">
                <div className="w-14 h-14 bg-amber-honey rounded-2xl flex items-center justify-center text-nature-night shadow-lg shadow-amber-honey/20">
                  <Mail size={24} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#F4F6F0]/50 mb-1">Email Oficial</p>
                  <p className="text-sm font-bold text-[#F4F6F0]">promociones@msambar.com</p>
                </div>
              </div>
              <a
                href="/MS_AMBAR_EPK.pdf"
                download="MS_AMBAR_EPK.pdf"
                className="flex items-center gap-6 group bg-white/5 border border-white/10 p-6 rounded-3xl w-fit pr-12 hover:border-amber-honey/20 transition-all cursor-pointer"
              >
                <div className="w-14 h-14 bg-amber-honey/10 rounded-2xl flex items-center justify-center text-amber-honey">
                  <Download size={24} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#F4F6F0]/50 mb-1">Press Kit</p>
                  <p className="text-sm font-bold underline decoration-amber-honey/40 text-[#F4F6F0]">Descargar EPK (PDF, 25MB)</p>
                </div>
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-amber-honey/5 blur-3xl rounded-full opacity-50 pointer-events-none" />

            <AnimatePresence mode="wait">
              {!successData ? (
                <motion.form
                  key="booking-form"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onSubmit={handleSubmit}
                  className="amber-glass p-8 md:p-12 rounded-[3rem] relative shadow-xl"
                >
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[#F4F6F0]/60 ml-1">Nombre del Promotor</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ej. Juan Pérez"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold focus:border-amber-honey outline-none transition-all text-white placeholder-white/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[#F4F6F0]/60 ml-1">Correo de Contacto</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="promotor@evento.com"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold focus:border-amber-honey outline-none transition-all text-white placeholder-white/30"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[#F4F6F0]/60 ml-1">Teléfono / WhatsApp</label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+52 55 1234 5678"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold focus:border-amber-honey outline-none transition-all text-white placeholder-white/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[#F4F6F0]/60 ml-1">Compañía / Razón Social</label>
                      <input
                        type="text"
                        value={company}
                        onChange={e => setCompany(e.target.value)}
                        placeholder="Opcional"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold focus:border-amber-honey outline-none transition-all text-white placeholder-white/30"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[#F4F6F0]/60 ml-1">Fecha Tentativa</label>
                      <input
                        type="date"
                        required
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold focus:border-amber-honey outline-none transition-all text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[#F4F6F0]/60 ml-1">Tipo de Foro</label>
                      <div className="relative">
                        <select
                          value={venueType}
                          onChange={e => setVenueType(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold focus:border-amber-honey outline-none transition-all appearance-none text-white"
                        >
                          <option value="festival" className="bg-[#121915] text-[#F4F6F0]">Festival de Música</option>
                          <option value="theater" className="bg-[#121915] text-[#F4F6F0]">Teatro / Auditorio</option>
                          <option value="club" className="bg-[#121915] text-[#F4F6F0]">Club / Centro Nocturno</option>
                          <option value="private" className="bg-[#121915] text-[#F4F6F0]">Evento Privado</option>
                          <option value="other" className="bg-[#121915] text-[#F4F6F0]">Otro</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-10">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[#F4F6F0]/60 ml-1">Detalles de la Oferta / Mensaje</label>
                    <textarea
                      rows={4}
                      required
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="Especifica aforo estimado, locación y condiciones propuestas..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold focus:border-amber-honey outline-none transition-all resize-none text-white placeholder-white/30"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-amber-honey text-black px-8 py-5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-honey/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {submitting ? 'Procesando Booking...' : 'Enviar Propuesta Formal'}
                    <Send size={14} />
                  </button>
                </motion.form>
              ) : (
                <motion.div
                  key="booking-success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="amber-glass p-8 md:p-12 rounded-[3rem] text-center relative shadow-xl"
                >
                  <div className="w-20 h-20 bg-amber-honey/10 border border-amber-honey/30 rounded-full flex items-center justify-center mx-auto mb-8 text-amber-honey">
                    <CheckCircle size={36} />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black mb-4 tracking-tighter">¡SOLICITUD REGISTRADA!</h3>
                  <p className="text-[#F4F6F0]/70 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
                    Hemos recibido tu propuesta para la presentación del día <strong>{date}</strong>. Se ha generado un borrador de contrato artístico.
                  </p>

                  <div className="bg-white/5 border border-white/10 p-6 rounded-2xl mb-10 text-left space-y-4">
                    <div className="flex items-center gap-3 text-xs">
                      <Award size={16} className="text-amber-honey" />
                      <div>
                        <p className="text-[9px] font-black uppercase text-[#F4F6F0]/50">Estatus del Acuerdo</p>
                        <p className="font-bold text-[#F4F6F0]/90">Pendiente de Firma del Promotor</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <Calendar size={16} className="text-amber-honey" />
                      <div>
                        <p className="text-[9px] font-black uppercase text-[#F4F6F0]/50">Fecha Asignada</p>
                        <p className="font-bold text-[#F4F6F0]/90">{date}</p>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/bookings/sign/${successData.contract_id}`}
                    className="w-full bg-amber-honey text-black px-8 py-5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-honey/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                  >
                    Ir al Visor de Contrato <ArrowRight size={14} />
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </ThemedSection>
  );
};

export default ContactPage;
