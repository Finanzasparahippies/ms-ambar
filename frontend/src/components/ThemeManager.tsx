/**
 * @file ThemeManager.tsx
 * @description Editor de Temas y Visual Inspector Ultra-Premium para Ms Ambar.
 * Proporciona un panel de control contextual y un Live Preview Canvas interactivo con sincronización a 60 FPS.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { useEventTheme, ThemeConfig, SectionThemeSpec } from '../context/EventThemeContext';
import { 
  Palette, Sparkles, Check, RefreshCw, Eye, Sliders, Layers, Type, 
  Paintbrush, Layout, Settings, Compass
} from 'lucide-react';
import { showToast } from '../lib/notifications';
import { getApiUrl, getAccessibleTextColor } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

/** Presets de formas de partículas para el canvas místico */
const SHAPE_OPTIONS = [
  { id: 'moon', label: 'Media Luna', icon: '🌙' },
  { id: 'circle', label: 'Círculo / Mundo', icon: '🌐' },
  { id: 'cactus', label: 'Cactus / Desierto', icon: '🌵' },
  { id: 'star', label: 'Estrella', icon: '⭐' },
  { id: 'infinity', label: 'Infinito', icon: '♾️' },
  { id: 'hexagon', label: 'Hexágono Futuro', icon: '⬡' },
  { id: 'sun', label: 'Sol Radiante', icon: '☀️' },
  { id: 'wave', label: 'Ondas Fluídas', icon: '🌊' },
  { id: 'spiral', label: 'Espiral Mística', icon: '🌀' },
  { id: 'music', label: 'Nota Musical', icon: '🎵' },
  { id: 'eye', label: 'Ojo de Visión', icon: '👁️' },
  { id: 'love', label: 'Corazón Sagrado', icon: '❤️' },
  { id: 'bee', label: 'Abeja / Colmena', icon: '🐝' },
  { id: 'eclipse', label: 'Eclipse Sombra', icon: '🌒' },
  { id: 'none', label: 'Partículas Libres', icon: '✨' },
];

/** Presets de estilos de redondeo para tarjetas */
const CARD_STYLE_OPTIONS = [
  { id: 'rounded-full', label: 'Ultra Suave (Píldoras y Cristal)', radius: '2.0rem' },
  { id: 'rounded-2xl', label: 'Moderno (Esquinas Medias Elegantes)', radius: '1.25rem' },
  { id: 'rounded-lg', label: 'Clásico (Esquinas Sutiles)', radius: '0.5rem' },
  { id: 'rounded-none', label: 'Recto / Neobrutalismo', radius: '0rem' },
];

/** Presets de fuentes tipográficas */
const FONT_PRESET_OPTIONS = [
  { id: 'cormorant', label: 'Cormorant Garamond (Elegante & Místico)', sample: 'Ms Ambar Concert' },
  { id: 'outfit', label: 'Outfit / Inter (Moderno & Tecnológico)', sample: 'Ms Ambar Concert' },
  { id: 'cinzel', label: 'Cinzel Decorative (Editorial & Lujo)', sample: 'Ms Ambar Concert' },
  { id: 'syne', label: 'Syne (Vanguardista & Artístico)', sample: 'Ms Ambar Concert' },
];

/** Estructura contextual de las 13 Páginas del proyecto y sus Secciones correspondientes */
const PAGE_ROUTES = [
  { 
    path: '/', 
    name: 'Landing Page (Inicio)', 
    sections: [
      { id: 'hero', label: 'Hero Principal (Portada)', icon: '🌟' },
      { id: 'biography', label: 'Biografía & Cantautora', icon: '📜' },
      { id: 'events_grid', label: 'Próximos Conciertos & Boletos', icon: '🎫' },
      { id: 'tarot_experience', label: 'Experiencia Tarot & Mística', icon: '🔮' },
      { id: 'tour_timeline', label: 'Línea de Tiempo de Gira', icon: '🗓️' },
      { id: 'vip_experience', label: 'Experiencia VIP Meet & Greet', icon: '👑' },
      { id: 'navbar', label: 'Navegación (Header Global)', icon: '🧭' },
      { id: 'footer', label: 'Pie de Página (Footer Global)', icon: '⚓' },
    ]
  },
  {
    path: '/galleria',
    name: 'Galería de Luz Multimedia',
    sections: [
      { id: 'gallery_header', label: 'Encabezado de Galería', icon: '📷' },
      { id: 'gallery_grid', label: 'Grilla Masonry Multimedia', icon: '🖼️' },
      { id: 'gallery_lightbox', label: 'Visor Lightbox Polimórfico', icon: '🔍' },
      { id: 'navbar', label: 'Navegación (Header Global)', icon: '🧭' },
      { id: 'footer', label: 'Pie de Página (Footer Global)', icon: '⚓' },
    ]
  },
  {
    path: '/biography',
    name: 'Biografía Editorial',
    sections: [
      { id: 'biography', label: 'Sección Principal Biografía', icon: '📜' },
      { id: 'navbar', label: 'Navegación (Header Global)', icon: '🧭' },
      { id: 'footer', label: 'Pie de Página (Footer Global)', icon: '⚓' },
    ]
  },
  {
    path: '/ambar-te-escribe',
    name: 'Ambar te Escribe (Cartas & Crónicas)',
    sections: [
      { id: 'ambar_te_escribe', label: 'Contenido Cartas & Escritos', icon: '✍️' },
      { id: 'navbar', label: 'Navegación (Header Global)', icon: '🧭' },
      { id: 'footer', label: 'Pie de Página (Footer Global)', icon: '⚓' },
    ]
  },
  {
    path: '/blog',
    name: 'Blog & Novedades',
    sections: [
      { id: 'blog_section', label: 'Grilla de Artículos & Posts', icon: '📰' },
      { id: 'navbar', label: 'Navegación (Header Global)', icon: '🧭' },
      { id: 'footer', label: 'Pie de Página (Footer Global)', icon: '⚓' },
    ]
  },
  {
    path: '/comprar-boletos',
    name: 'Página de Compra & Taquilla',
    sections: [
      { id: 'tickets_page', label: 'Encabezado & Lista de Eventos', icon: '🎟️' },
      { id: 'seating_map', label: 'Mapa Interactivo de Asientos', icon: '🗺️' },
      { id: 'checkout_modal', label: 'Modal de Checkout & Pagos', icon: '💳' },
      { id: 'navbar', label: 'Navegación (Header Global)', icon: '🧭' },
      { id: 'footer', label: 'Pie de Página (Footer Global)', icon: '⚓' },
    ]
  },
  {
    path: '/contacto',
    name: 'Contacto & Prensa',
    sections: [
      { id: 'contacto', label: 'Formulario de Contacto & Redes', icon: '✉️' },
      { id: 'navbar', label: 'Navegación (Header Global)', icon: '🧭' },
      { id: 'footer', label: 'Pie de Página (Footer Global)', icon: '⚓' },
    ]
  },
  {
    path: '/entretenimiento',
    name: 'Entretenimiento Interactivo',
    sections: [
      { id: 'entretenimiento', label: 'Sección Mística & Juegos', icon: '🎮' },
      { id: 'navbar', label: 'Navegación (Header Global)', icon: '🧭' },
      { id: 'footer', label: 'Pie de Página (Footer Global)', icon: '⚓' },
    ]
  },
  {
    path: '/musica',
    name: 'Música & Discografía',
    sections: [
      { id: 'musica', label: 'Reproductor & Álbumes', icon: '🎧' },
      { id: 'navbar', label: 'Navegación (Header Global)', icon: '🧭' },
      { id: 'footer', label: 'Pie de Página (Footer Global)', icon: '⚓' },
    ]
  },
  {
    path: '/tienda',
    name: 'Tienda Oficial & Merch',
    sections: [
      { id: 'tienda', label: 'Catálogo de Productos & Merchandising', icon: '🛍️' },
      { id: 'navbar', label: 'Navegación (Header Global)', icon: '🧭' },
      { id: 'footer', label: 'Pie de Página (Footer Global)', icon: '⚓' },
    ]
  },
  {
    path: '/tour',
    name: 'Gira & Fechas de Conciertos',
    sections: [
      { id: 'tour_section', label: 'Calendario de Gira', icon: '🎤' },
      { id: 'navbar', label: 'Navegación (Header Global)', icon: '🧭' },
      { id: 'footer', label: 'Pie de Página (Footer Global)', icon: '⚓' },
    ]
  },
  {
    path: '/suscribirse',
    name: 'Club de Fans & Newsletter',
    sections: [
      { id: 'suscribirse', label: 'Formulario VIP & Suscripción', icon: '💌' },
      { id: 'navbar', label: 'Navegación (Header Global)', icon: '🧭' },
      { id: 'footer', label: 'Pie de Página (Footer Global)', icon: '⚓' },
    ]
  },
  {
    path: '/auth',
    name: 'Autenticación & Acceso',
    sections: [
      { id: 'auth_card', label: 'Tarjeta Login / Registro', icon: '🔐' },
      { id: 'navbar', label: 'Navegación (Header Global)', icon: '🧭' },
      { id: 'footer', label: 'Pie de Página (Footer Global)', icon: '⚓' },
    ]
  }
];

const COLOR_PRESETS = [
  { id: 'amber-honey', name: 'Ámbar Místico', primary: '#E5A93B', secondary: '#22A6B7', start: '#080c0a', end: '#040605', card: '#0c0f0d', text: '#F4F6F0', heading: '#E5A93B' },
  { id: 'emerald-desert', name: 'Noche Esmeralda', primary: '#10B981', secondary: '#06B6D4', start: '#022c22', end: '#021e17', card: '#064e3b', text: '#ECFDF5', heading: '#34D399' },
  { id: 'neon-violet', name: 'Violeta Neón', primary: '#8B5CF6', secondary: '#EC4899', start: '#0f0728', end: '#090319', card: '#1e1035', text: '#F5F3FF', heading: '#A78BFA' },
  { id: 'royal-gold', name: 'Oro Imperial', primary: '#F59E0B', secondary: '#D97706', start: '#1c1305', end: '#0f0a02', card: '#291b07', text: '#FFFBEB', heading: '#FBBF24' },
  { id: 'crimson-rose', name: 'Rosa Carmesí', primary: '#F43F5E', secondary: '#FB7185', start: '#1f040a', end: '#120205', card: '#330812', text: '#FFF1F2', heading: '#FDA4AF' },
  { id: 'cyber-ocean', name: 'Océano Futuro', primary: '#0EA5E9', secondary: '#6366F1', start: '#031a2b', end: '#020f1a', card: '#082f49', text: '#F0F9FF', heading: '#38BDF8' }
];

export const ThemeManager: React.FC = () => {
  const { theme, setThemeOverride, resetThemeToDefaults, clearSectionOverrides } = useEventTheme();

  // Contextual Page & Section selection state
  const [selectedRoutePath, setSelectedRoutePath] = useState<string>('/');
  const [selectedSectionKey, setSelectedSectionKey] = useState<string>('hero');
  const [hoveredSectionKey, setHoveredSectionKey] = useState<string | null>(null);

  // Global Theme States
  const [themeMode, setThemeMode] = useState<'global' | 'section'>(theme.themeMode || 'global');
  const [primaryColor, setPrimaryColor] = useState('#E5A93B');
  const [secondaryColor, setSecondaryColor] = useState('#22A6B7');
  const [backgroundStart, setBackgroundStart] = useState('#080c0a');
  const [backgroundEnd, setBackgroundEnd] = useState('#040605');
  const [accentColor, setAccentColor] = useState('#9F2B00');
  const [cardBackground, setCardBackground] = useState('#0c0f0d');
  const [textColor, setTextColor] = useState('#F4F6F0');
  const [headingColor, setHeadingColor] = useState('#E5A93B');
  const [subtitleColor, setSubtitleColor] = useState('#F4F6F0');
  const [buttonBg, setButtonBg] = useState('#E5A93B');
  const [buttonText, setButtonText] = useState('#080c0a');
  const [borderColor, setBorderColor] = useState('#E5A93B');

  const [particleShape, setParticleShape] = useState('moon');
  const [cardStyle, setCardStyle] = useState('rounded-full');
  const [backgroundPattern, setBackgroundPattern] = useState('stars');
  const [fontPreset, setFontPreset] = useState('cormorant');
  const [allowCanvasZoom, setAllowCanvasZoom] = useState<boolean>(true);
  const [customCss, setCustomCss] = useState('');

  // Section-level Themes State
  const [sectionThemes, setSectionThemes] = useState<Record<string, SectionThemeSpec>>({});
  const [saving, setSaving] = useState(false);

  // Debounce Timer Ref to achieve 60 FPS smooth updates without React re-render thrashing
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get active route specification with Fallback Resolution
  const currentRouteSpec = PAGE_ROUTES.find(r => r.path === selectedRoutePath) || (() => {
    console.warn(`[ThemeManager Warning] Ruta "${selectedRoutePath}" no registrada. Aplicando Layout Preset por defecto.`);
    return PAGE_ROUTES[0]; // Fallback safe preset
  })();

  // Synchronize initial values from API context
  useEffect(() => {
    if (theme) {
      setPrimaryColor(theme.primaryColor || '#E5A93B');
      setSecondaryColor(theme.secondaryColor || '#22A6B7');
      setBackgroundStart(theme.backgroundStart || '#080c0a');
      setBackgroundEnd(theme.backgroundEnd || '#040605');
      setAccentColor(theme.accentColor || '#9F2B00');
      setCardBackground(theme.cardBackground || '#0c0f0d');
      setTextColor(theme.textColor || '#F4F6F0');
      setHeadingColor(theme.headingColor || theme.primaryColor || '#E5A93B');
      setSubtitleColor(theme.subtitleColor || theme.textColor || '#F4F6F0');
      setButtonBg(theme.buttonBg || theme.primaryColor || '#E5A93B');
      setButtonText(theme.buttonText || theme.backgroundStart || '#080c0a');
      setBorderColor(theme.borderColor || '#E5A93B');
      setParticleShape(theme.particleShape || 'moon');
      setCardStyle(theme.cardStyle || 'rounded-full');
      setBackgroundPattern(theme.backgroundPattern || 'stars');
      setFontPreset(theme.fontPreset || 'cormorant');
      setCustomCss(theme.customCss || '');
      setSectionThemes(theme.sectionThemes || {});
    }
  }, [theme]);

  /**
   * Performs real-time debounced DOM injection of CSS variables to maintain 60 FPS performance.
   * Directs updates into documentElement styles avoiding expensive React lifecycle loops.
   */
  const handleLivePreview = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce at 16ms (~60 FPS)
    debounceTimerRef.current = setTimeout(() => {
      setThemeOverride({
        themeMode,
        primaryColor,
        secondaryColor,
        backgroundStart,
        backgroundEnd,
        accentColor,
        cardBackground,
        textColor,
        headingColor,
        subtitleColor,
        buttonBg,
        buttonText,
        borderColor,
        particleShape,
        cardStyle,
        backgroundPattern,
        fontPreset,
        customCss,
        sectionThemes,
      });
    }, 16);
  }, [themeMode, primaryColor, secondaryColor, backgroundStart, backgroundEnd, accentColor, cardBackground, textColor, headingColor, subtitleColor, buttonBg, buttonText, borderColor, particleShape, cardStyle, backgroundPattern, fontPreset, customCss, sectionThemes, setThemeOverride]);

  useEffect(() => {
    handleLivePreview();
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [handleLivePreview]);

  /**
   * Updates properties of a specific section in sectionThemes dictionary.
   */
  const updateSectionProp = (sectionKey: string, field: keyof SectionThemeSpec, val: any) => {
    setSectionThemes(prev => {
      const currentSec = prev[sectionKey] || {};
      const updatedSec = { ...currentSec, [field]: val };
      return { ...prev, [sectionKey]: updatedSec };
    });
  };

  /**
   * Applies one-click color palette preset.
   */
  const applyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
    setBackgroundStart(preset.start);
    setBackgroundEnd(preset.end);
    setCardBackground(preset.card);
    setTextColor(preset.text);
    setHeadingColor(preset.heading);
    setThemeMode('global');
    showToast.success(`Paleta "${preset.name}" aplicada correctamente.`);
  };

  /**
   * Saves updated theme configuration to Django backend.
   */
  const handleSave = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const payload = {
      theme_mode: themeMode,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      background_start: backgroundStart,
      background_end: backgroundEnd,
      accent_color: accentColor,
      card_background: cardBackground,
      text_color: textColor,
      heading_color: headingColor,
      subtitle_color: subtitleColor,
      button_bg: buttonBg,
      button_text: buttonText,
      border_color: borderColor,
      particle_shape: particleShape,
      card_style: cardStyle,
      background_pattern: backgroundPattern,
      font_preset: fontPreset,
      allow_canvas_zoom: allowCanvasZoom,
      custom_css: customCss,
      section_themes: sectionThemes,
    };

    try {
      const apiUrl = getApiUrl();
      await axios.post(`${apiUrl}/tickets/settings/`, payload, { headers });
      showToast.success('¡Configuración de tema guardada en el servidor!');
    } catch (e: any) {
      console.error('Error saving theme settings:', e);
      showToast.error(e.response?.data?.error || 'Error al guardar la personalización visual.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handles Visual Inspector click on simulated Canvas sections, halting Event Bubbling.
   */
  const handleVisualInspectorSelect = (e: React.MouseEvent, sectionId: string) => {
    e.stopPropagation(); // Prevenir selección múltiple encadenada por event bubbling
    setSelectedSectionKey(sectionId);
    setThemeMode('section');
    showToast.success(`Sección "${sectionId}" seleccionada para edición.`);
  };

  const currentSectionSpec = sectionThemes[selectedSectionKey] || {};

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto text-nature-white selection:bg-amber-honey/30">
      
      {/* Top Banner Header */}
      <div className="amber-glass p-8 rounded-3xl border border-white/10 relative overflow-hidden shadow-glow">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          <div>
            <span className="text-[10px] text-amber-honey uppercase tracking-widest font-black flex items-center gap-2 mb-2">
              <Paintbrush size={14} className="text-amber-honey" />
              Editor de Temas & Inspector Visual Granular (Canvas Live Inspector)
            </span>
            <h2 className="text-3xl lg:text-4xl font-black text-white uppercase italic tracking-tighter">
              Personalización Visual <span className="text-amber-honey">Contextual</span>
            </h2>
            <p className="text-white/60 text-xs font-medium max-w-2xl mt-1">
              Selecciona la página y haz clic directamente sobre las secciones en el Canvas Interactivo para personalizar colores, bordes y tipografías en tiempo real.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                clearSectionOverrides();
                setThemeMode('global');
                showToast.success('Secciones reajustadas a la paleta global.');
              }}
              className="bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px] px-4 py-3 rounded-2xl transition-all border border-white/10"
            >
              🧹 Limpiar Secciones
            </button>

            <button
              onClick={() => {
                resetThemeToDefaults();
                showToast.success('Valores restablecidos a los por defecto.');
              }}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-300 font-black uppercase tracking-widest text-[10px] px-4 py-3 rounded-2xl transition-all border border-red-500/20"
            >
              🔄 Restablecer Todo
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-amber-honey hover:bg-amber-honey/90 text-nature-night font-black uppercase tracking-widest text-xs px-6 py-3.5 rounded-2xl transition-all shadow-glow flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
              Guardar en Servidor
            </button>
          </div>
        </div>
      </div>

      {/* Main Split View: Left Control Panel vs Right Visual Inspector Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Contextual Control Panel (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Contextual Page & Mode Selection Card */}
          <div className="amber-glass p-6 rounded-3xl border border-white/10 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-xs font-black uppercase tracking-widest text-amber-honey flex items-center gap-2">
                <Compass size={16} /> Selector Contextual de Página
              </h3>
              <span className="text-[9px] bg-white/5 text-white/50 px-2.5 py-1 rounded-full font-mono">
                {selectedRoutePath}
              </span>
            </div>

            {/* Route Dropdown */}
            <div>
              <label htmlFor="page-active-select" className="block text-[10px] font-black uppercase tracking-wider text-white/70 mb-2">
                Página Activa a Editar:
              </label>
              <select
                id="page-active-select"
                value={selectedRoutePath}
                onChange={(e) => {
                  const newPath = e.target.value;
                  setSelectedRoutePath(newPath);
                  // Auto-select first section of new route
                  const r = PAGE_ROUTES.find(p => p.path === newPath);
                  if (r && r.sections.length > 0) {
                    setSelectedSectionKey(r.sections[0].id);
                  }
                }}
                className="w-full bg-[#0d110e] border border-white/20 rounded-2xl px-4 py-3 text-xs font-bold text-white focus:border-amber-honey focus:outline-none focus:ring-1 focus:ring-amber-honey"
              >
                {PAGE_ROUTES.map(route => (
                  <option key={route.path} value={route.path} className="bg-[#0d110e] text-white py-1">
                    {route.name} ({route.path})
                  </option>
                ))}
              </select>
            </div>

            {/* Mode Selector Toggle */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-white/70 mb-2">
                Modo de Aplicación:
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#0d110e] border border-white/20 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setThemeMode('global')}
                  className={`py-2 text-center rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    themeMode === 'global' ? 'bg-amber-honey text-black font-black shadow-glow' : 'text-white/70 hover:text-white'
                  }`}
                >
                  Paleta Global
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('section')}
                  className={`py-2 text-center rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    themeMode === 'section' ? 'bg-amber-honey text-black font-black shadow-glow' : 'text-white/70 hover:text-white'
                  }`}
                >
                  Por Sección
                </button>
              </div>
            </div>

            {/* Contextual Sections Buttons List */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-white/70 mb-2">
                Secciones de esta página:
              </label>
              <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scroll pr-1">
                {currentRouteSpec.sections.map((sec) => {
                  const isSelected = selectedSectionKey === sec.id;
                  const isHovered = hoveredSectionKey === sec.id;
                  const hasCustom = !!sectionThemes[sec.id];

                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => {
                        setSelectedSectionKey(sec.id);
                        setThemeMode('section');
                      }}
                      onMouseEnter={() => setHoveredSectionKey(sec.id)}
                      onMouseLeave={() => setHoveredSectionKey(null)}
                      className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between text-xs ${
                        isSelected
                          ? 'bg-amber-honey text-black border-amber-honey font-black shadow-glow'
                          : isHovered
                          ? 'bg-white/10 text-white border-amber-honey/50'
                          : 'bg-[#0d110e] text-white/90 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span>{sec.icon}</span>
                        <span>{sec.label}</span>
                      </div>
                      {hasCustom && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400" title="Personalizado" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Granular Controls for Selected Section / Global */}
          <div className="amber-glass p-6 rounded-3xl border border-white/10 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-xs font-black uppercase tracking-widest text-amber-honey flex items-center gap-2">
                <Sliders size={16} /> Controles: {themeMode === 'section' ? selectedSectionKey : 'Global'}
              </h3>
              {themeMode === 'section' && (
                <button
                  onClick={() => {
                    setSectionThemes(prev => {
                      const copy = { ...prev };
                      delete copy[selectedSectionKey];
                      return copy;
                    });
                    showToast.success(`Ajustes de "${selectedSectionKey}" reajustados.`);
                  }}
                  className="text-[9px] text-red-400 hover:text-red-300 uppercase tracking-widest font-black"
                >
                  Restablecer Sección
                </button>
              )}
            </div>

            {/* Section Specific Color Pickers */}
            <div className="space-y-4">
              {/* Primary / Section Bg */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-white/70 mb-2">
                  {themeMode === 'section' ? 'Fondo de Sección (Solid BG)' : 'Color Primario'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={themeMode === 'section' ? (currentSectionSpec.bg_color || backgroundStart) : primaryColor}
                    onChange={(e) => {
                      if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'bg_color', e.target.value);
                      else setPrimaryColor(e.target.value);
                    }}
                    className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={themeMode === 'section' ? (currentSectionSpec.bg_color || backgroundStart) : primaryColor}
                    onChange={(e) => {
                      if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'bg_color', e.target.value);
                      else setPrimaryColor(e.target.value);
                    }}
                    className="bg-[#0d110e] border border-white/20 rounded-xl px-3 py-2 text-xs font-mono text-white w-full focus:border-amber-honey focus:outline-none focus:ring-1 focus:ring-amber-honey"
                  />
                </div>
              </div>

              {/* Text / Heading Color */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-white/70 mb-2">
                  Color de Título / Encabezado
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={themeMode === 'section' ? (currentSectionSpec.heading_color || headingColor) : headingColor}
                    onChange={(e) => {
                      if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'heading_color', e.target.value);
                      else setHeadingColor(e.target.value);
                    }}
                    className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={themeMode === 'section' ? (currentSectionSpec.heading_color || headingColor) : headingColor}
                    onChange={(e) => {
                      if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'heading_color', e.target.value);
                      else setHeadingColor(e.target.value);
                    }}
                    className="bg-[#0d110e] border border-white/20 rounded-xl px-3 py-2 text-xs font-mono text-white w-full focus:border-amber-honey focus:outline-none focus:ring-1 focus:ring-amber-honey"
                  />
                </div>
              </div>

              {/* Card Style and Typography */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-white/70 mb-2">
                    Bordes / Redondeo:
                  </label>
                  <select
                    value={cardStyle}
                    onChange={(e) => setCardStyle(e.target.value)}
                    className="w-full bg-[#0d110e] border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-amber-honey focus:outline-none focus:ring-1 focus:ring-amber-honey"
                  >
                    {CARD_STYLE_OPTIONS.map(c => (
                      <option key={c.id} value={c.id} className="bg-[#0d110e] text-white py-1">{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-white/70 mb-2">
                    Fuente Tipográfica:
                  </label>
                  <select
                    value={fontPreset}
                    onChange={(e) => setFontPreset(e.target.value)}
                    className="w-full bg-[#0d110e] border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-amber-honey focus:outline-none focus:ring-1 focus:ring-amber-honey"
                  >
                    {FONT_PRESET_OPTIONS.map(f => (
                      <option key={f.id} value={f.id} className="bg-[#0d110e] text-white py-1">{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preset Palettes Quick Row */}
              <div className="pt-3 border-t border-white/10">
                <span className="block text-[9px] font-black uppercase text-amber-honey tracking-widest mb-2">
                  Paletas Rápidas (1-Click):
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_PRESETS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2 text-left"
                    >
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.primary }} />
                      <span className="text-[9px] font-bold truncate text-white/80">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Inspector Live Canvas Simulation (7 Cols) */}
        <div className="lg:col-span-7 space-y-4 sticky top-24">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Eye className="text-amber-honey animate-pulse" size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest text-white">
                Live Preview Canvas (Visual Inspector)
              </h3>
            </div>
            <span className="text-[9px] text-white/40 font-mono">
              Haz clic en cualquier sección para inspeccionar y editar
            </span>
          </div>

          {/* Interactive Simulated Page Canvas Box */}
          <div className="amber-glass rounded-[2.5rem] border border-white/15 overflow-hidden shadow-2xl p-6 relative bg-black/90 min-h-[550px] flex flex-col justify-between">
            
            {/* Header Simulation Bar */}
            <div 
              onClick={(e) => handleVisualInspectorSelect(e, 'navbar')}
              onMouseEnter={() => setHoveredSectionKey('navbar')}
              onMouseLeave={() => setHoveredSectionKey(null)}
              className={`p-4 rounded-2xl border transition-all duration-300 relative cursor-pointer mb-6 ${
                selectedSectionKey === 'navbar'
                  ? 'border-amber-honey bg-amber-honey/10 shadow-glow'
                  : hoveredSectionKey === 'navbar'
                  ? 'border-amber-honey/60 bg-white/5'
                  : 'border-white/10 bg-nature-night/50'
              }`}
            >
              {(selectedSectionKey === 'navbar' || hoveredSectionKey === 'navbar') && (
                <div className="absolute -top-3 left-4 bg-amber-honey text-nature-night px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest z-10">
                  Editar: Navbar (Header Global)
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="font-black text-sm italic tracking-tighter text-amber-honey">MS AMBAR</span>
                <div className="flex gap-4 text-[10px] uppercase font-bold text-white/60">
                  <span>Inicio</span>
                  <span>Galería</span>
                  <span>Boletos</span>
                </div>
              </div>
            </div>

            {/* Dynamic Body Sections depending on selected route */}
            <div className="space-y-6 flex-1 flex flex-col justify-center">
              
              {selectedRoutePath === '/' && (
                <>
                  {/* Hero Simulation */}
                  <div
                    onClick={(e) => handleVisualInspectorSelect(e, 'hero')}
                    onMouseEnter={() => setHoveredSectionKey('hero')}
                    onMouseLeave={() => setHoveredSectionKey(null)}
                    style={{
                      backgroundColor: sectionThemes['hero']?.bg_color || 'transparent',
                    }}
                    className={`p-8 rounded-3xl border text-center transition-all duration-300 relative cursor-pointer ${
                      selectedSectionKey === 'hero'
                        ? 'border-amber-honey bg-amber-honey/10 shadow-glow'
                        : hoveredSectionKey === 'hero'
                        ? 'border-amber-honey/60 bg-white/5'
                        : 'border-white/10 bg-[#0c0f0d]/60 backdrop-blur-md'
                    }`}
                  >
                    {(selectedSectionKey === 'hero' || hoveredSectionKey === 'hero') && (
                      <div className="absolute -top-3 left-4 bg-amber-honey text-black px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest z-10 shadow-md">
                        Editar: Hero Principal
                      </div>
                    )}
                    <h1 
                      style={{ 
                        color: getAccessibleTextColor(
                          sectionThemes['hero']?.bg_color || backgroundStart, 
                          sectionThemes['hero']?.heading_color || headingColor
                        ) 
                      }}
                      className="text-3xl font-black italic tracking-tighter uppercase mb-2 font-serif"
                    >
                      Ms Ambar Live 2026
                    </h1>
                    <p 
                      style={{
                        color: getAccessibleTextColor(
                          sectionThemes['hero']?.bg_color || backgroundStart,
                          textColor
                        )
                      }}
                      className="text-xs max-w-sm mx-auto mb-4 opacity-80"
                    >
                      Voz mística & Experiencia sonora sensorial
                    </p>
                    <button 
                      style={{ backgroundColor: buttonBg, color: buttonText }}
                      className="px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-transform hover:scale-105"
                    >
                      Comprar Boletos
                    </button>
                  </div>

                  {/* Events Grid Simulation */}
                  <div
                    onClick={(e) => handleVisualInspectorSelect(e, 'events_grid')}
                    onMouseEnter={() => setHoveredSectionKey('events_grid')}
                    onMouseLeave={() => setHoveredSectionKey(null)}
                    style={{
                      backgroundColor: sectionThemes['events_grid']?.bg_color || 'transparent',
                    }}
                    className={`p-6 rounded-3xl border transition-all duration-300 relative cursor-pointer ${
                      selectedSectionKey === 'events_grid'
                        ? 'border-amber-honey bg-amber-honey/10 shadow-glow'
                        : hoveredSectionKey === 'events_grid'
                        ? 'border-amber-honey/60 bg-white/5'
                        : 'border-white/10 bg-[#0c0f0d]/60 backdrop-blur-md'
                    }`}
                  >
                    {(selectedSectionKey === 'events_grid' || hoveredSectionKey === 'events_grid') && (
                      <div className="absolute -top-3 left-4 bg-amber-honey text-black px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest z-10 shadow-md">
                        Editar: Próximos Conciertos
                      </div>
                    )}
                    <h3 
                      style={{
                        color: getAccessibleTextColor(
                          sectionThemes['events_grid']?.bg_color || backgroundStart,
                          headingColor
                        )
                      }}
                      className="text-xs font-black uppercase tracking-widest mb-3 font-serif"
                    >
                      Próximas Fechas
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                        <div className="text-[10px] font-bold text-white">Auditorio Nacional</div>
                        <div className="text-[9px] text-white/50">CDMX • 14 Octubre</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                        <div className="text-[10px] font-bold text-white">Teatro Diana</div>
                        <div className="text-[9px] text-white/50">Guadalajara • 28 Octubre</div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {selectedRoutePath === '/galleria' && (
                <div
                  onClick={(e) => handleVisualInspectorSelect(e, 'gallery_grid')}
                  onMouseEnter={() => setHoveredSectionKey('gallery_grid')}
                  onMouseLeave={() => setHoveredSectionKey(null)}
                  style={{
                    backgroundColor: sectionThemes['gallery_grid']?.bg_color || 'transparent',
                  }}
                  className={`p-6 rounded-3xl border transition-all duration-300 relative cursor-pointer ${
                    selectedSectionKey === 'gallery_grid'
                      ? 'border-amber-honey bg-amber-honey/10 shadow-glow'
                      : hoveredSectionKey === 'gallery_grid'
                      ? 'border-amber-honey/60 bg-white/5'
                      : 'border-white/10 bg-[#0c0f0d]/60 backdrop-blur-md'
                  }`}
                >
                  {(selectedSectionKey === 'gallery_grid' || hoveredSectionKey === 'gallery_grid') && (
                    <div className="absolute -top-3 left-4 bg-amber-honey text-black px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest z-10 shadow-md">
                      Editar: Grilla Masonry Galería
                    </div>
                  )}
                  <h3 
                    style={{
                      color: getAccessibleTextColor(
                        sectionThemes['gallery_grid']?.bg_color || backgroundStart,
                        headingColor
                      )
                    }}
                    className="text-xs font-black uppercase tracking-widest mb-3 font-serif"
                  >
                    Galería de Luz Multimedia
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-20 bg-white/10 rounded-xl animate-pulse border border-white/10" />
                    <div className="h-28 bg-white/10 rounded-xl animate-pulse border border-white/10" />
                    <div className="h-20 bg-white/10 rounded-xl animate-pulse border border-white/10" />
                  </div>
                </div>
              )}

              {selectedRoutePath === '/biography' && (
                <div
                  onClick={(e) => handleVisualInspectorSelect(e, 'biography')}
                  onMouseEnter={() => setHoveredSectionKey('biography')}
                  onMouseLeave={() => setHoveredSectionKey(null)}
                  style={{
                    backgroundColor: sectionThemes['biography']?.bg_color || 'transparent',
                  }}
                  className={`p-6 rounded-3xl border transition-all duration-300 relative cursor-pointer ${
                    selectedSectionKey === 'biography'
                      ? 'border-amber-honey bg-amber-honey/10 shadow-glow'
                      : hoveredSectionKey === 'biography'
                      ? 'border-amber-honey/60 bg-white/5'
                      : 'border-white/10 bg-[#0c0f0d]/60 backdrop-blur-md'
                  }`}
                >
                  {(selectedSectionKey === 'biography' || hoveredSectionKey === 'biography') && (
                    <div className="absolute -top-3 left-4 bg-amber-honey text-black px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest z-10 shadow-md">
                      Editar: Biografía Editorial
                    </div>
                  )}
                  <h2 
                    style={{
                      color: getAccessibleTextColor(
                        sectionThemes['biography']?.bg_color || backgroundStart,
                        headingColor
                      )
                    }}
                    className="text-xl font-black mb-2 font-serif"
                  >
                    La Cantautora
                  </h2>
                  <p 
                    style={{
                      color: getAccessibleTextColor(
                        sectionThemes['biography']?.bg_color || backgroundStart,
                        textColor
                      )
                    }}
                    className="text-xs opacity-80"
                  >
                    Fusión mística de R&B, soul y música latina de vanguardia.
                  </p>
                </div>
              )}

              {/* Generic/Fallback simulation view for all other routes */}
              {['/ambar-te-escribe', '/blog', '/comprar-boletos', '/contacto', '/entretenimiento', '/musica', '/tienda', '/tour', '/suscribirse', '/auth'].includes(selectedRoutePath) && (
                <div
                  onClick={(e) => {
                    if (currentRouteSpec.sections[0]) {
                      handleVisualInspectorSelect(e, currentRouteSpec.sections[0].id);
                    }
                  }}
                  className="p-6 rounded-3xl border border-white/10 bg-[#0c0f0d]/60 backdrop-blur-md text-center space-y-3 cursor-pointer hover:border-amber-honey/50 transition-all"
                >
                  <div className="text-2xl">{currentRouteSpec.sections[0]?.icon || '✨'}</div>
                  <h3 className="text-sm font-black text-amber-honey uppercase tracking-wider font-serif">
                    {currentRouteSpec.name}
                  </h3>
                  <p className="text-xs text-white/60 max-w-xs mx-auto">
                    Inspección activa para {currentRouteSpec.sections.length} secciones configurables en este módulo.
                  </p>
                </div>
              )}
            </div>

            {/* Footer Simulation Bar */}
            <div 
              onClick={(e) => handleVisualInspectorSelect(e, 'footer')}
              onMouseEnter={() => setHoveredSectionKey('footer')}
              onMouseLeave={() => setHoveredSectionKey(null)}
              className={`p-4 rounded-2xl border transition-all duration-300 relative cursor-pointer mt-6 text-center ${
                selectedSectionKey === 'footer'
                  ? 'border-amber-honey bg-amber-honey/10 shadow-glow'
                  : hoveredSectionKey === 'footer'
                  ? 'border-amber-honey/60 bg-white/5'
                  : 'border-white/10 bg-nature-night/50'
              }`}
            >
              {(selectedSectionKey === 'footer' || hoveredSectionKey === 'footer') && (
                <div className="absolute -top-3 left-4 bg-amber-honey text-nature-night px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest z-10">
                  Editar: Footer (Pie de Página)
                </div>
              )}
              <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold">
                © 2026 Ms Ambar • Todos los derechos reservados
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeManager;
