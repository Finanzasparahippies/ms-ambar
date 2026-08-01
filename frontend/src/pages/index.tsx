import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle,
  ChevronRight,
  Sparkles,
  Ticket
} from 'lucide-react';
import Head from 'next/head';
import Link from 'next/link';
import * as React from 'react';
import { useEffect, useState } from 'react';
import CanvasParticles from '../components/CanvasParticles';
import ThemedSection from '../components/ThemedSection';
import { useEventTheme } from '../context/EventThemeContext';
import api from '../lib/api';



interface TarotCard {
  id: string;
  name: string;
  vibe: string;
  song: string;
  description: string;
  morphTarget: 'circle' | 'moon' | 'cactus' | 'star' | 'infinity' | 'hexagon' | 'love' | 'sun' | 'eclipse' | 'music' | 'bee' | 'eye' | 'wave' | 'spiral';
  color: string;
  icon: string;
  chordFreqs: number[];
  waveType: OscillatorType;
  useTremolo?: boolean;
  useArpeggio?: boolean;
  useSweep?: boolean;
}

const TAROT_CARDS: TarotCard[] = [
  {
    id: 'hadas',
    name: 'Hadas en el Desierto',
    vibe: 'Estética Glowy Fashion, Soulteño y Etereidad',
    song: 'Hadas en el Desierto (Soulteño)',
    description: 'La magia de las mariposas irisadas y el tul floreciente en el desierto sonorense. Una noche inolvidable de glamour, música en vivo y conexión sentimental.',
    morphTarget: 'love',
    color: '#ff75a0', // Rose pink fashion glow
    icon: '🦋',
    chordFreqs: [261.63, 329.63, 392.00, 523.25], // Sparkle Major Chord
    waveType: 'sine',
    useArpeggio: true
  },
  {
    id: 'sol',
    name: 'El Sol de Sonora',
    vibe: 'Fuerza, Vitalidad y Calor del Desierto',
    song: 'Desierto de Cristal',
    description: 'La energía radiante del desierto que impulsa la creación y disipa las sombras. Te invita a brillar con luz propia y contagiar tu alegría.',
    morphTarget: 'sun',
    color: '#FFBF00', // Amber honey
    icon: '☀️',
    chordFreqs: [261.63, 329.63, 392.00, 493.88], // C maj 7
    waveType: 'triangle'
  },
  {
    id: 'sacerdotisa',
    name: 'La Sacerdotisa del Saguaro',
    vibe: 'Intuición, Silencio y Misterio Nocturno',
    song: 'Eclipse',
    description: 'El saber oculto bajo el manto de la noche sonorense. Escucha los susurros del viento y confía plenamente en tu sabiduría interior.',
    morphTarget: 'moon',
    color: '#22A6B3', // Nature sky
    icon: '🌙',
    chordFreqs: [220.00, 261.63, 329.63, 392.00, 493.88], // Am 7/9
    waveType: 'sine'
  },
  {
    id: 'ermitano',
    name: 'El Ermitaño de los Cerros',
    vibe: 'Introspección y la Nostalgia del Blues',
    song: 'Ámbar Vision',
    description: 'La búsqueda de la verdad en la soledad de la sierra. El blues profundo te enseña a encontrar la luz en tu propio camino de autodescubrimiento.',
    morphTarget: 'cactus',
    color: '#8B4513', // Nature earth/brown
    icon: '🌵',
    chordFreqs: [164.81, 207.65, 293.66, 392.00], // E 7
    waveType: 'triangle'
  },
  {
    id: 'estrella',
    name: 'La Estrella Cósmica',
    vibe: 'Esperanza, Guía y Conexión Universal',
    song: 'Camino Estelar',
    description: 'La alineación de tu ser con las vibras del cosmos. Un recordatorio de que somos polvo de estrellas fluyendo en perfecta armonía con el todo.',
    morphTarget: 'star',
    color: '#F5F6FA', // White star
    icon: '⭐',
    chordFreqs: [523.25, 659.25, 783.99, 987.77, 1046.50], // High C maj 9
    waveType: 'sine',
    useArpeggio: true
  },
  {
    id: 'rueda',
    name: 'La Rueda de la Arena',
    vibe: 'Ciclos de la Vida y Ritmos Ancestrales',
    song: 'Ritmos Ancestrales',
    description: 'El movimiento eterno del viento que redefine las dunas. Acepta el cambio con alegría y fluye con el compás de los ciclos del universo.',
    morphTarget: 'infinity',
    color: '#9F2B00', // Amber cognac
    icon: '♾️',
    chordFreqs: [130.81, 196.00, 261.63], // Sweep chord
    waveType: 'sawtooth',
    useSweep: true
  },
  {
    id: 'colmena',
    name: 'La Colmena Sagrada',
    vibe: 'Colectividad, Dulzura y Polinización Terrestre',
    song: 'Tierra Viva',
    description: 'La magia de la colmena trabajando en armonía. Representa la labor de rescate de abejas con Tierra Viva, sanando la Madre Tierra en comunidad.',
    morphTarget: 'bee',
    color: '#F4D03F', // Amber butterscotch
    icon: '🐝',
    chordFreqs: [220.00, 330.00, 440.00], // A Major with Tremolo
    waveType: 'triangle',
    useTremolo: true
  },
  {
    id: 'templanza',
    name: 'La Templanza del Manantial',
    vibe: 'Armonía, Paciencia y Fluidez Emocional',
    song: 'Agua Calma',
    description: 'El fluir constante del agua limpia en el oasis. Te recuerda que todo llega a su debido tiempo si mantienes la paz y la fluidez en tu andar.',
    morphTarget: 'hexagon',
    color: '#4834d4', // Deep indigo
    icon: '🏺',
    chordFreqs: [130.81, 196.00, 261.63],
    waveType: 'sawtooth',
    useSweep: true
  },
  {
    id: 'mago',
    name: 'El Mago de las Frecuencias',
    vibe: 'Manifestación, Poder Creador y Alquimia',
    song: 'Frecuencia Alquimia',
    description: 'La destreza para canalizar la energía del universo en ondas sonoras. Tienes todas las herramientas para manifestar y transformar tu realidad hoy.',
    morphTarget: 'music',
    color: '#e056fd', // Violet/magenta
    icon: '🔮',
    chordFreqs: [261.63, 329.63, 392.00, 493.88], // C maj 7
    waveType: 'triangle'
  },
  {
    id: 'emperatriz',
    name: 'La Emperatriz de la Tierra',
    vibe: 'Abundancia, Creatividad y Nutrición Vital',
    song: 'Madre Selva',
    description: 'El florecimiento y el renacimiento de la flora del desierto tras la lluvia. Tu fuerza creativa se nutre de tus raíces terrestres y florece con amor.',
    morphTarget: 'love',
    color: '#6ab04c', // Nature leaf green
    icon: '🌿',
    chordFreqs: [220.00, 330.00, 440.00],
    waveType: 'triangle',
    useTremolo: true
  },
  {
    id: 'fuerza',
    name: 'La Fuerza del Saguaro',
    vibe: 'Coraje, Valentía y Resiliencia Orgánica',
    song: 'Raíces Fuertes',
    description: 'Como el saguaro centenario que resiste de pie en el desierto. Tu verdadera fuerza reside en la perseverancia, la templanza y la paz interna.',
    morphTarget: 'cactus',
    color: '#ff7979', // Warm coral
    icon: '🦁',
    chordFreqs: [164.81, 207.65, 293.66, 392.00], // E 7
    waveType: 'triangle'
  },
  {
    id: 'mundo',
    name: 'El Mundo Cósmico',
    vibe: 'Plenitud, Realización y Cierre de Ciclos',
    song: 'Universo Infinito',
    description: 'La realización total y la danza del cosmos en perfecta armonía. Has completado una etapa con éxito; celebra tus logros y abre tus alas.',
    morphTarget: 'circle',
    color: '#f9ca24', // Warm gold
    icon: '🌍',
    chordFreqs: [523.25, 659.25, 783.99, 987.77, 1046.50], // High notes
    waveType: 'sine',
    useArpeggio: true
  },
  {
    id: 'loco',
    name: 'El Loco del Viento',
    vibe: 'Libertad, Nuevos Inicios y Confianza Pura',
    song: 'Ruta Libre',
    description: 'El paso sin miedo hacia lo desconocido bajo la noche estrellada. Confía en el salto de fe y déjate guiar por tu instinto de libertad y alegría.',
    morphTarget: 'spiral',
    color: '#ffbe76', // Soft peach
    icon: '⛺',
    chordFreqs: [220.00, 261.63, 329.63, 392.00, 493.88], // Am 7/9
    waveType: 'sine'
  },
  {
    id: 'carro',
    name: 'El Carro de las Dunas',
    vibe: 'Enfoque, Dirección y Movimiento Consciente',
    song: 'Viento en Marcha',
    description: 'El avance firme y triunfante sobre las dunas infinitas. Visualiza tu meta con claridad y avanza con la confianza de que el viento sopla a tu favor.',
    morphTarget: 'infinity',
    color: '#1abc9c', // Vibrant turquoise
    icon: '🧭',
    chordFreqs: [196.00, 246.94, 293.66, 392.00], // G major chord
    waveType: 'sawtooth',
    useSweep: true
  },
  {
    id: 'juicio',
    name: 'El Despertar del Eco',
    vibe: 'Claridad, Despertar y Propósito de Luz',
    song: 'Frecuencia Despierta',
    description: 'El eco de la montaña que te llama a despertar tu potencial más puro. Es el momento de liberar viejos temores y abrazar tu vocación cósmica.',
    morphTarget: 'eclipse',
    color: '#9b59b6', // Amethyst purple
    icon: '🔔',
    chordFreqs: [349.23, 440.00, 523.25, 698.46], // F major 7 high
    waveType: 'sine',
    useArpeggio: true
  },
  {
    id: 'enamorados',
    name: 'Los Enamorados del Cosmos',
    vibe: 'Unión, Resonancia y Decisiones del Corazón',
    song: 'Alquimia Dual',
    description: 'La perfecta armonía entre el cielo y la tierra. El amor propio y la conexión genuina con los demás amplifican tu vibración y atraen bendiciones.',
    morphTarget: 'love',
    color: '#fd79a8', // Rose pink
    icon: '💖',
    chordFreqs: [164.81, 220.00, 261.63, 329.63, 415.30], // E maj 9
    waveType: 'sine'
  },
  {
    id: 'justicia',
    name: 'La Balanza de la Arena',
    vibe: 'Verdad, Equilibrio y Armonía Cósmica',
    song: 'Tierra Justa',
    description: 'La serenidad del desierto que equilibra el día y la noche. Actúa con integridad, paz y el universo alineará todas las cosas para tu mayor bien.',
    morphTarget: 'hexagon',
    color: '#74b9ff', // Air blue
    icon: '⚖️',
    chordFreqs: [146.83, 220.00, 293.66, 349.23], // D minor 7
    waveType: 'triangle'
  },
  {
    id: 'luna',
    name: 'La Luna del Desierto',
    vibe: 'Sueños, Subconsciente y Flujo Creativo Nocturno',
    song: 'Marea Cósmica',
    description: 'La luz plateada que alumbra las dunas de noche. Permite que tus sueños guíen tu arte y que tu intuición sea tu mayor faro en la oscuridad.',
    morphTarget: 'eye',
    color: '#a29bfe', // Lavender sky
    icon: '🌕',
    chordFreqs: [246.94, 293.66, 369.99, 440.00, 493.88], // B min 11 chord
    waveType: 'sine',
    useArpeggio: true
  },
  {
    id: 'hierofante',
    name: 'El Guía Cósmico',
    vibe: 'Sabiduría Ancestral, Rituales y Enseñanzas',
    song: 'Eco de Ancestros',
    description: 'Los rituales y la sabiduría transmitida por las estrellas. Hay conocimiento profundo esperándote; sé receptivo a las sabias enseñanzas de la naturaleza.',
    morphTarget: 'cactus',
    color: '#e67e22', // Warm orange
    icon: '🗝️',
    chordFreqs: [196.00, 246.94, 293.66, 349.23], // G7 chord
    waveType: 'triangle'
  },
  {
    id: 'locomotora',
    name: 'El Viaje del Tren',
    vibe: 'Aventura, Libertad de Espíritu y Nuevas Rutas',
    song: 'Blues del Camino',
    description: 'El silbato del tren cruzando el desierto de Sonora. Un llamado al viaje y a la exploración de nuevos horizontes sin mirar atrás y con un blues en el alma.',
    morphTarget: 'infinity',
    color: '#f39c12', // Golden honey
    icon: '🚂',
    chordFreqs: [146.83, 196.00, 220.00, 293.66], // G sus4
    waveType: 'sawtooth',
    useSweep: true
  },
  {
    id: 'oasis',
    name: 'El Oasis Oculto',
    vibe: 'Renovación, Abundancia y Paz Interior',
    song: 'Agua de Luz',
    description: 'Un santuario de agua cristalina rodeado de palmeras. Recuerda que siempre hay un refugio de paz dentro de ti para refrescar y nutrir tu espíritu.',
    morphTarget: 'wave',
    color: '#2ecc71', // Emerald green
    icon: '🌴',
    chordFreqs: [220.00, 277.18, 329.63, 440.00], // A major lush chord
    waveType: 'triangle',
    useTremolo: true
  }
];

const formatoHoraOficial = (fechaString: string) => {
  if (!fechaString) return "--:--";
  try {
    const fecha = new Date(fechaString);
    return fecha.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Mexico_City' // 🌟 Forzamos la zona horaria del DF en el render del cliente
    });
  } catch (e) {
    return "--:--";
  }
};

const Home = () => {
  const { getSectionTheme } = useEventTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [newsletterName, setNewsletterName] = useState('');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [newsletterErrorMessage, setNewsletterErrorMessage] = useState('');
  const [nextEvent, setNextEvent] = useState<any>(null);
  const [siteSettings, setSiteSettings] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
    Promise.all([
      api.get('/tickets/events/').catch(() => ({ data: [] })),
      api.get('/tickets/settings/').catch(() => ({ data: null })),
    ]).then(([evRes, stRes]) => {
      if (stRes?.data) {
        setSiteSettings(stRes.data);
      }
      if (evRes.data && Array.isArray(evRes.data) && evRes.data.length > 0) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const upcoming = evRes.data
          .filter((e: any) => e.is_active !== false)
          .map((e: any) => ({ ...e, dateObj: new Date(e.date) }))
          .filter((e: any) => e.dateObj >= startOfToday)
          .sort((a: any, b: any) => a.dateObj.getTime() - b.dateObj.getTime());

        if (upcoming.length > 0) {
          setNextEvent(upcoming[0]);
        } else {
          setNextEvent(null);
        }
      }
    }).catch(err => console.error("Error fetching homepage data:", err));
  }, []);

  const getFormattedEventDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
      const formatted = d.toLocaleDateString('es-MX', options);
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return "Oct 24";
    }
  };

  /**
   * [Nectar Dynamic Pricing - Frontend Mirror Engine]
   * Garantiza la tarifa mínima establecida (baseAmount) y aplica aumentos progresivos
   * únicamente en los últimos 3 meses antes del evento.
   */
  const getDynamicPrice = (event: any, baseAmount: number) => {
    if (!event || !baseAmount || baseAmount <= 0) return baseAmount || 0;
    if (event.enable_dynamic_pricing === false || !event.date) return baseAmount;
    const eventDate = new Date(event.date);
    const now = new Date();
    const eventMonthIdx = eventDate.getFullYear() * 12 + eventDate.getMonth();
    const currMonthIdx = now.getFullYear() * 12 + now.getMonth();
    const monthsDiff = eventMonthIdx - currMonthIdx;

    if (monthsDiff >= 2) {
      return baseAmount;
    }

    const increments = 2 - Math.max(0, monthsDiff);
    const increment = Number(event.monthly_price_increment ?? 50);
    const increase = increments * increment;

    return Math.max(baseAmount, baseAmount + increase);
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterStatus('submitting');
    setNewsletterErrorMessage('');

    try {
      await api.post('/blog/subscribers/', {
        email: newsletterEmail,
        name: newsletterName
      });
      setNewsletterStatus('success');
      setNewsletterEmail('');
      setNewsletterName('');
      setTimeout(() => setNewsletterStatus('idle'), 6000);
    } catch (err: any) {
      console.error(err);
      setNewsletterStatus('error');
      const backendErr = err.response?.data?.email?.[0] || '';
      if (backendErr.includes('exists') || backendErr.includes('already exists') || backendErr.includes('existe')) {
        setNewsletterErrorMessage('Este correo electrónico ya está registrado a las cartas.');
      } else if (err.response?.data?.email) {
        setNewsletterErrorMessage('Por favor, ingresa un correo electrónico válido.');
      } else {
        setNewsletterErrorMessage('Hubo un error al procesar tu registro. Por favor, intenta de nuevo.');
      }
    }
  };

  if (!isMounted) return null;

  return (
    <div className="selection:bg-amber-honey/30 overflow-x-hidden font-outfit text-[#F4F6F0] bg-[#06070b] min-h-screen">
      <Head>
        <title>Ms Ambar | Cantautora Mexicana</title>
        <meta name="description" content="Ms Ambar - Desde Sonora para el mundo, adquiere tus boletos y acompáñame en este camino por la música y los escenarios." />
      </Head>

      {/* ─── HERO SECTION (NECTAR LABS & GLOWY FASHION STYLE) ─── */}
      <ThemedSection sectionKey="hero" className="relative min-h-[50vh] flex flex-col justify-center items-center px-6 pt-32 pb-8 md:pt-40 md:pb-12 overflow-hidden">
        {/* Interactive canvas background (Rose-Gold Fairy Dust Particles) */}
        <CanvasParticles morphTarget="none" />

        {/* Iridescent Glowy Fashion Spheres - GPU Optimized */}
        <div className="absolute top-1/4 left-1/4 w-[300px] sm:w-[550px] h-[300px] sm:h-[550px] bg-pink-500/15 rounded-full blur-2xl md:blur-[140px] pointer-events-none animate-pulse will-change-transform" />
        <div className="absolute bottom-1/4 right-1/4 w-[250px] sm:w-[450px] h-[250px] sm:h-[450px] bg-purple-600/15 rounded-full blur-2xl md:blur-[120px] pointer-events-none will-change-transform" />
        <div className="absolute top-1/3 right-1/3 w-[200px] sm:w-[350px] h-[200px] sm:h-[350px] bg-cyan-400/10 rounded-full blur-xl md:blur-[100px] pointer-events-none will-change-transform" />

        {/* Ambient Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="max-w-4xl text-center space-y-8 z-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500/15 via-rose-500/20 to-purple-500/15 border border-pink-400/40 px-5 py-2.5 rounded-full w-fit mx-auto mb-4 shadow-[0_0_25px_rgba(255,117,160,0.25)] backdrop-blur-md"
          >
            <span className="text-xs">🦋</span>
            <Sparkles size={12} className="text-pink-300 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-pink-200">
              {nextEvent
                ? `Concierto Oficial | ${getFormattedEventDate(nextEvent.date)} en ${nextEvent.venue_name || 'Por Definir'}`
                : "Próximamente"
              }
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="flex justify-center items-center py-6"
          >
            <img
              src="/logos/ms_ambar_logo_b.png"
              alt="Ms Ambar"
              className="h-20 md:h-32 w-auto object-contain hover:scale-[1.02] transition-transform duration-500"
              style={{ filter: 'drop-shadow(0 0 45px rgba(255,117,160,0.35)) drop-shadow(0 0 20px rgba(229,169,59,0.25))' }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6"
          >
            <Link
              href="/comprar-boletos"
              className="px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] bg-gradient-to-r from-pink-500 via-rose-400 to-amber-400 text-[#06070b] shadow-xl shadow-pink-500/25 hover:scale-105 hover:shadow-pink-500/45 transition-all flex items-center gap-3 font-extrabold"
            >
              <Ticket size={18} /> Adquirir Accesos
            </Link>
            {/*<Link
              href="/contacto"
              className="px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] border border-white/20 text-[#F4F6F0] hover:border-amber-honey/40 hover:bg-amber-honey/5 transition-all flex items-center gap-3"
            >
              Contacto <ArrowRight size={14} />
            </Link>*/}
          </motion.div>
        </div>
      </ThemedSection>

      {/* ─── HADAS EN EL DESIERTO (GLOWY FASHION SHOWCASE) ─── */}
      {nextEvent?.flyer_url && (
        <ThemedSection sectionKey="events_grid" className="pb-16 md:pb-24 bg-[#06070b]">
          <div className="max-w-[1400px] mx-auto px-6 md:px-10">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="relative bg-gradient-to-br from-[#1c0a1e] via-[#100615] to-[#07050a] rounded-[2.5rem] overflow-hidden border border-pink-500/30 group shadow-[0_0_90px_rgba(232,67,147,0.22)] grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 p-8 md:p-14 items-center"
            >
              {/* Decorative Glow Elements - GPU Optimized */}
              <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-pink-500/20 rounded-full blur-2xl md:blur-[120px] pointer-events-none z-10 group-hover:bg-pink-500/30 transition-colors duration-1000 will-change-transform" />
              <div className="absolute bottom-0 left-0 w-56 sm:w-80 h-56 sm:h-80 bg-purple-600/15 rounded-full blur-2xl md:blur-[100px] pointer-events-none z-10 will-change-transform" />

              {/* Left Column: Content */}
              <div className="space-y-6 order-2 lg:order-1 lg:col-span-7 z-20 flex flex-col items-center lg:items-start text-center lg:text-left justify-center h-full w-full">
                <div className="flex flex-wrap items-center gap-3 justify-center lg:justify-start">
                  <div className="inline-flex items-center gap-2 bg-pink-500/15 border border-pink-400/30 px-3.5 py-1.5 rounded-full w-fit backdrop-blur-md shadow-lg shadow-pink-500/10">
                    <Sparkles size={12} className="text-pink-300 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-pink-200">
                      🦋 Concierto Oficial
                    </span>
                  </div>
                </div>

                <div className="space-y-2 flex flex-col items-center lg:items-start">
                  <span className="text-[10px] font-black uppercase tracking-[0.35em] text-pink-300/80">Ms. Ambar Presenta</span>
                  <h2 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-pink-100 to-rose-300 leading-[0.95] max-w-md lg:max-w-xl group-hover:from-pink-100 group-hover:to-pink-300 transition-colors duration-500">
                    {nextEvent.title}
                  </h2>
                </div>

                <div className="w-16 h-[2px] bg-gradient-to-r from-pink-500/60 via-purple-500/40 to-transparent lg:from-pink-500/60 lg:to-transparent" />

                <div className="space-y-4 w-full max-w-md lg:max-w-lg flex flex-col items-center lg:items-start">
                  <div className="text-sm md:text-base text-white/90 font-bold tracking-tight space-y-2 w-full text-center lg:text-left">
                    <p className="text-pink-200 font-extrabold text-lg flex items-center justify-center lg:justify-start gap-2">
                      <span>🗓️</span> {getFormattedEventDate(nextEvent.date)}
                    </p>

                    {/* <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 text-xs font-medium text-pink-100/70 pt-0.5">
                      {nextEvent.doors_open && (
                        <span className="bg-pink-500/10 border border-pink-500/20 px-3 py-1 rounded-full text-pink-200">
                          🚪 Puertas: <strong className="text-white">{formatoHoraOficial(nextEvent.doors_open)} hrs</strong>
                        </span>
                      )}
                      {nextEvent.date && (nextEvent.duration_minutes || nextEvent.end_date) && (
                        <span className="bg-pink-500/10 border border-pink-500/20 px-3 py-1 rounded-full text-pink-200">
                          ✨ Cierre: <strong className="text-white">
                            {(() => {
                              if (nextEvent.end_date) {
                                return formatoHoraOficial(nextEvent.end_date);
                              }
                              const startDate = new Date(nextEvent.date);
                              const calculatedEndDate = new Date(startDate.getTime() + (Number(nextEvent.duration_minutes || 120) * 60 * 1000));
                              return formatoHoraOficial(calculatedEndDate.toISOString());
                            })()} hrs
                          </strong>
                        </span>
                      )}
                    </div> */}

                    <p className="text-xs text-pink-200/70 font-normal tracking-normal pt-1 flex items-center justify-center lg:justify-start gap-1.5">
                      📍 <strong className="text-white">{nextEvent.venue_name || 'London Pub'}</strong> — <span className="italic">{nextEvent.venue_address || 'Av. Tamaulipas 11, Centro, Hermosillo, Sonora'}</span>
                    </p>
                  </div>

                  {nextEvent && (
                    <div className="text-xs md:text-sm text-pink-100/90 font-medium leading-relaxed bg-pink-950/40 p-5 rounded-2xl border border-pink-500/25 backdrop-blur-md w-full text-center lg:text-left space-y-3 shadow-xl">
                      <div className="flex items-center justify-between border-b border-pink-500/20 pb-2.5">
                        <span className="text-pink-300 font-black text-xs uppercase tracking-wider">Tarifas del Evento</span>
                        {nextEvent.enable_dynamic_pricing !== false && (
                          <span className="text-[10px] bg-pink-500/20 text-pink-200 px-2.5 py-0.5 rounded-full border border-pink-400/30 font-semibold">
                            Precio Dinámico
                          </span>
                        )}
                      </div>

                      {nextEvent.event_type === 'meet_greet' ? (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/80 font-medium">🎟️ Acceso Convivencia M&G</span>
                          <span className="text-white font-black text-base">${Math.round(Number(nextEvent.mg_price || 0)).toLocaleString('es-MX')} MXN</span>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {/* Boleto General (Sin Asiento) */}
                          {nextEvent.allow_seatless_tickets !== false && (
                            <div className="flex items-center justify-between text-xs md:text-sm bg-white/[0.04] p-3 rounded-xl border border-pink-500/20">
                              <div className="flex flex-col text-left">
                                <span className="text-white font-bold">🎟️ Entrada General (Sin Asiento)</span>
                                <span className="text-[10px] text-pink-200/60">Acceso preferencial a zona general</span>
                              </div>
                              <span className="text-pink-300 font-black text-sm md:text-base">
                                ${Math.round(nextEvent.effective_seatless_ticket_price !== undefined
                                  ? Number(nextEvent.effective_seatless_ticket_price)
                                  : getDynamicPrice(nextEvent, Number(nextEvent.seatless_ticket_price ?? 0))
                                ).toLocaleString('es-MX')} MXN
                              </span>
                            </div>
                          )}

                          {/* Boleto Numerado (Asiento de Mesa) */}
                          {nextEvent.allow_numbered_tickets !== false && (
                            <div className="flex items-center justify-between text-xs md:text-sm bg-white/[0.04] p-3 rounded-xl border border-pink-500/20">
                              <div className="flex flex-col text-left">
                                <span className="text-white font-bold">🪑 Asiento Numerado (Mesas)</span>
                                <span className="text-[10px] text-pink-200/60">Lugar reservado en mapa de mesas interactivo</span>
                              </div>
                              <span className="text-pink-300 font-black text-sm md:text-base">
                                ${Math.round(nextEvent.numbered_seat_base_price !== undefined
                                  ? Number(nextEvent.numbered_seat_base_price)
                                  : getDynamicPrice(nextEvent, Number(nextEvent.numbered_ticket_price ?? 1000))
                                ).toLocaleString('es-MX')} MXN
                              </span>
                            </div>
                          )}

                          {/* Meet & Greet Adicional (Opcional) */}
                          {nextEvent.mg_limit > 0 && (
                            <div className="flex items-center justify-between text-xs bg-purple-500/15 p-3 rounded-xl border border-purple-500/30 text-purple-200">
                              <span className="font-semibold">🤝 Pase Opcional Meet & Greet</span>
                              <span className="font-black text-white">+${Math.round(Number(nextEvent.mg_price ?? 0)).toLocaleString('es-MX')} MXN</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 w-full lg:w-auto">
                  <Link
                    href="/comprar-boletos"
                    className={`inline-flex items-center justify-center gap-3 w-[90%] mx-auto sm:mx-0 sm:w-fit px-12 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.25em] transition-all duration-300 ${nextEvent.event_type === 'meet_greet' && nextEvent.mg_available === 0
                      ? 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed pointer-events-none'
                      : 'bg-gradient-to-r from-pink-500 via-rose-400 to-amber-400 text-[#06070b] shadow-xl shadow-pink-500/25 hover:from-pink-400 hover:to-amber-300 hover:scale-[1.03] hover:shadow-pink-500/40'
                      }`}
                  >
                    <Ticket size={14} />
                    {nextEvent.event_type === 'meet_greet' && nextEvent.mg_available === 0 ? 'Cupos Agotados' : 'Adquirir Accesos'}
                  </Link>
                </div>
              </div>

              {/* Right Column: Flyer Poster Container */}
              <div className="w-full h-[500px] sm:h-[600px] lg:h-[720px] overflow-hidden rounded-3xl order-1 lg:order-2 lg:col-span-5 z-20 flex justify-center lg:justify-end">
                <div className="relative w-full h-full max-w-[420px] lg:max-w-none rounded-2xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.7)] border border-pink-400/30 group/flyer bg-black/40">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent z-10 pointer-events-none" />
                  <img
                    src={nextEvent.flyer_url}
                    alt={`Flyer: ${nextEvent.title}`}
                    className="w-full h-full object-contain object-center group-hover/flyer:scale-[1.03] transition-transform duration-1000 ease-out"
                  />
                  <div className="absolute bottom-5 left-5 z-20">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-pink-300">
                      Hadas en el Desierto
                    </span>
                    <p className="text-xs font-bold text-white uppercase italic">
                      Sábado 3 Oct • London Pub
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </ThemedSection>
      )}

      {/* ─── BIOGRAPHY SECTION ─── */}
      {(() => {
        const bioTheme = { ...getSectionTheme('tarot_experience'), ...getSectionTheme('biography') };
        const bioBadge = siteSettings?.bio_badge || bioTheme.bio_badge || "La Cantautora";
        const bioTitle = siteSettings?.bio_title || bioTheme.bio_title || "Ms. Ambar";
        const bioImage = siteSettings?.bio_image_url || siteSettings?.bio_image || bioTheme.bio_image || "/Images/Inicio_Biografia.jpg";
        const bioLocation = siteSettings?.bio_location || bioTheme.bio_location || "Hermosillo • México";
        const bioCtaText = siteSettings?.bio_cta_text || bioTheme.bio_cta_text || "Ver Próximos Eventos";
        const bioCtaUrl = siteSettings?.bio_cta_url || bioTheme.bio_cta_url || "/tour";

        const rawContent = siteSettings?.bio_content || bioTheme.bio_content;
        const paragraphs: string[] = rawContent
          ? rawContent.split('\n').filter((p: string) => p.trim().length > 0)
          : [
            'Ms. Ambar, nombre artístico de la cantautora originaria de Hermosillo, Sonora, es una figura destacada en la música latina por su fusión de géneros como R&B, soul, regional mexicano y bachata. Su carrera profesional comenzó en 2017 con la banda "Moonset", pero consolidó su relevancia al unirse a la gira del rapero mexicano Charles Ans en 2022, actuando como telonera en grandes escenarios como el Auditorio Nacional.',
            'Su primer álbum formal, "14•28", fue lanzado en octubre de 2024; el título hace referencia a la numerología y a fechas significativas. A través de su música, busca conectar emocionalmente con el público compartiendo historias autobiográficas y reflexiones sobre la vida, la muerte y las memorias.',
            'Un hito reciente en su trayectoria fue su selección para representar a México en la categoría folclórica del Festival de Viña del Mar 2025, con la canción "No te voy a llorar", consolidándose como una de las artistas más prometedoras de la nueva generación musical mexicana.'
          ];

        return (
          <ThemedSection sectionKey="biography" className="pt-8 pb-16 md:pt-12 md:pb-24 relative overflow-hidden bg-[#06070b]">
            <div className="absolute top-1/2 left-[-10%] w-[35%] h-[35%] bg-amber-honey/5 blur-2xl md:blur-[100px] rounded-full pointer-events-none will-change-transform" />

            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20 items-center">
                {/* Left Column: Image with premium frame */}
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8 }}
                  className="lg:col-span-5 relative group max-w-md mx-auto lg:max-w-none w-full"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-amber-honey/20 to-transparent rounded-[3rem] blur-2xl opacity-30 group-hover:opacity-60 transition-opacity duration-700 pointer-events-none" />

                  <div className="relative rounded-[3rem] overflow-hidden border border-white/10 p-3 bg-white/[0.02] backdrop-blur-md transition-all duration-500 group-hover:border-amber-honey/30 shadow-2xl">
                    <div className="relative aspect-[3/4] rounded-[2.5rem] overflow-hidden">
                      <img
                        src={bioImage}
                        alt={bioTitle}
                        loading="lazy"
                        decoding="async"
                        className="object-cover w-full h-full grayscale group-hover:grayscale-0 scale-100 group-hover:scale-105 transition-all duration-700 ease-out"
                        style={{ filter: bioTheme.image_filter && bioTheme.image_filter !== 'none' ? bioTheme.image_filter : undefined }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#06070b]/60 via-transparent to-transparent opacity-60" />
                    </div>
                  </div>

                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-amber-honey/30 group-hover:border-amber-honey transition-colors duration-500 rounded-tl-[2rem]" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-amber-honey/30 group-hover:border-amber-honey transition-colors duration-500 rounded-br-[2rem]" />
                </motion.div>

                {/* Right Column: Typography & Story */}
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="lg:col-span-7 space-y-6 sm:space-y-8"
                >
                  <div className="space-y-2.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-honey flex items-center gap-2" style={{ color: bioTheme.subtitle_color || undefined }}>
                      <Sparkles size={10} className="animate-pulse" /> {bioBadge}
                    </span>
                    <h3 className="text-3xl sm:text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-[#F4F6F0]" style={{ color: bioTheme.heading_color || undefined }}>
                      {bioTitle}
                    </h3>
                    <div className="w-16 h-[2px] bg-gradient-to-r from-amber-honey to-transparent" />
                  </div>

                  <div className="space-y-4 sm:space-y-6 text-[#F4F6F0]/85 text-xs sm:text-sm md:text-base font-medium leading-relaxed font-sans" style={{ color: bioTheme.text_color || undefined }}>
                    {paragraphs.map((para: string, idx: number) => (
                      <p key={idx}>{para}</p>
                    ))}
                  </div>

                  <div className="pt-2 sm:pt-4 flex flex-wrap gap-4 sm:gap-6 items-center">
                    <Link
                      href={bioCtaUrl}
                      className="px-5 sm:px-6 py-3.5 sm:py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.25em] bg-white/5 border border-white/10 hover:border-amber-honey/40 hover:bg-amber-honey/5 hover:text-amber-honey transition-all flex items-center gap-2 text-[#F4F6F0]"
                      style={{ backgroundColor: bioTheme.button_bg || undefined, color: bioTheme.button_text || undefined }}
                    >
                      {bioCtaText} <ArrowRight size={12} />
                    </Link>
                    <span className="text-[9px] uppercase tracking-widest text-[#F4F6F0]/40 font-bold">
                      {bioLocation}
                    </span>
                  </div>
                </motion.div>
              </div>
            </div>
          </ThemedSection>
        );
      })()}

      {/* ─── NEWSLETTER / CLUB SHOWCASE (Ambar te Escribe) ─── */}
      <ThemedSection sectionKey="contact_section" className="py-16 md:py-24 border-t border-white/10 relative overflow-hidden bg-white/[0.02]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] sm:w-[450px] h-[280px] sm:h-[450px] bg-pink-500/5 rounded-full blur-2xl md:blur-[120px] pointer-events-none will-change-transform" />

        <div className="max-w-md mx-auto px-6 text-center space-y-8 relative z-10 bg-[#0c140f] border border-pink-500/10 p-12 md:p-14 rounded-[3rem] shadow-[0_0_50px_rgba(30,43,34,0.25)]">
          <div className="space-y-3">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-honey">Esto es solo para los reales</span>
            <h3 className="text-4xl md:text-5xl font-serif text-white tracking-tight italic font-normal leading-tight">Ambar te escribe</h3>
            <p className="text-white/60 text-xs max-w-sm mx-auto leading-relaxed">
              Deja tu nombre y correo aquí para recibir el newsletter escrito por Ms. Ambar, en donde te contará ideas hechas canciones, fechas próximas de presentaciones o noticias exclusivas.
            </p>
          </div>

          <div className="pt-2">
            <AnimatePresence mode="wait">
              {newsletterStatus === 'success' ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center gap-3 bg-amber-honey/10 border border-amber-honey/20 text-amber-honey p-8 rounded-[2rem] text-center"
                >
                  <div className="w-12 h-12 bg-amber-honey/20 rounded-full flex items-center justify-center text-amber-honey">
                    <CheckCircle size={20} />
                  </div>
                  <h4 className="font-bold uppercase tracking-wider text-[11px] mt-2">¡Suscripción Completada!</h4>
                  <p className="text-[10px] text-white/80 leading-relaxed">
                    Te has unido con éxito al club oficial de Ms Ambar.
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <motion.form
                    key="form"
                    onSubmit={handleSubscribe}
                    className="flex flex-col gap-3 text-left"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Nombre"
                        value={newsletterName}
                        onChange={e => setNewsletterName(e.target.value)}
                        required
                        className="w-full bg-white/5 text-white rounded-xl px-5 py-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-honey/50 transition-all border border-white/10 placeholder:text-white/30"
                        disabled={newsletterStatus === 'submitting'}
                      />
                      <input
                        type="email"
                        placeholder="Dirección de correo electrónico"
                        value={newsletterEmail}
                        onChange={e => {
                          setNewsletterEmail(e.target.value);
                          if (newsletterStatus === 'error') setNewsletterStatus('idle');
                        }}
                        required
                        className="w-full bg-white/5 text-white rounded-xl px-5 py-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-honey/50 transition-all border border-white/10 placeholder:text-white/30"
                        disabled={newsletterStatus === 'submitting'}
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-pink-500 via-rose-400 to-amber-400 hover:from-amber-gold hover:to-amber-500 active:scale-[0.98] text-[#06070b] font-black text-[10px] uppercase tracking-[0.25em] py-[18px] rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_35px_rgba(245,158,11,0.35)] whitespace-nowrap text-center flex items-center justify-center gap-2 hover:scale-[1.02]"
                      disabled={newsletterStatus === 'submitting'}
                    >
                      {newsletterStatus === 'submitting' ? (
                        <span className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                          Procesando...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Suscribirse al Club <Sparkles size={11} className="text-[#06070b] fill-current animate-pulse" />
                        </span>
                      )}
                    </button>

                    <p className="text-[9px] text-white/40 tracking-wider text-center pt-2">
                      Respetamos tu privacidad.
                    </p>
                  </motion.form>

                  {newsletterStatus === 'error' && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-amber-honey text-[9px] font-bold uppercase tracking-widest text-center"
                    >
                      ⚠️ {newsletterErrorMessage}
                    </motion.div>
                  )}
                </div>
              )}
            </AnimatePresence>
          </div>

          <div className="pt-2">
            <Link
              href="/ambar-te-escribe"
              className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F4F6F0]/50 hover:text-amber-honey transition-colors"
            >
              Acceder al club<ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </ThemedSection>
    </div>
  );
};

export default Home;