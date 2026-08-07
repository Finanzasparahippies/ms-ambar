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
  { id: 'triangle', label: 'Triángulo Místico', icon: '🔺' },
  { id: 'polygon', label: 'Polígono Geométrico', icon: '⬟' },
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
      { id: 'contact_section', label: 'Club de Fans & Newsletter', icon: '💌' },
      { id: 'tarot_experience', label: 'Experiencia Tarot & Mística', icon: '🔮' },
      { id: 'tour_timeline', label: 'Línea de Tiempo de Gira', icon: '🗓️' },
      { id: 'vip_experience', label: 'Experiencia VIP Meet & Greet', icon: '👑' },
      { id: 'navbar', label: 'Navegación (Header Global)', icon: '🧭' },
      { id: 'footer', label: 'Pie de Página (Footer Global)', icon: '⚓' },
    ]
  },
  {
    path: '/galeria',
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
      { id: 'contact_section', label: 'Formulario de Contacto & Booking', icon: '✉️' },
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

const ThemeModeSelector: React.FC<{
  themeMode: 'global' | 'section';
  onChange: (mode: 'global' | 'section') => void;
}> = ({ themeMode, onChange }) => (
  <div>
    <label className="block text-[10px] font-black uppercase tracking-wider text-white/70 mb-2">
      Modo de Aplicación:
    </label>
    <div className="grid grid-cols-2 gap-2 p-1 bg-[#0d110e] border border-white/20 rounded-2xl">
      <button
        type="button"
        onClick={() => onChange('global')}
        className={`py-2 text-center rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
          themeMode === 'global' ? 'bg-amber-honey text-black font-black shadow-glow' : 'text-white/70 hover:text-white'
        }`}
      >
        Paleta Global
      </button>
      <button
        type="button"
        onClick={() => onChange('section')}
        className={`py-2 text-center rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
          themeMode === 'section' ? 'bg-amber-honey text-black font-black shadow-glow' : 'text-white/70 hover:text-white'
        }`}
      >
        Por Sección
      </button>
    </div>
  </div>
);

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
  const [backgroundGradient, setBackgroundGradient] = useState('');
  const [accentColor, setAccentColor] = useState('#9F2B00');
  const [cardBackground, setCardBackground] = useState('#0c0f0d');
  const [cardBoxShadow, setCardBoxShadow] = useState('');
  const [borderWidth, setBorderWidth] = useState('1px');
  const [borderOpacity, setBorderOpacity] = useState(0.25);
  const [borderStylePreset, setBorderStylePreset] = useState('solid');
  const [textColor, setTextColor] = useState('#F4F6F0');
  const [headingColor, setHeadingColor] = useState('#E5A93B');
  const [subtitleColor, setSubtitleColor] = useState('#F4F6F0');
  const [buttonBg, setButtonBg] = useState('#E5A93B');
  const [buttonText, setButtonText] = useState('#080c0a');
  const [buttonHoverBg, setButtonHoverBg] = useState('#FFC048');
  const [buttonHoverText, setButtonHoverText] = useState('#080c0a');
  const [buttonFocusRing, setButtonFocusRing] = useState('#E5A93B');
  const [cardHoverBg, setCardHoverBg] = useState('#121714');
  const [cardHoverBorder, setCardHoverBorder] = useState('#E5A93B');
  const [cardFocusRing, setCardFocusRing] = useState('#22A6B7');
  const [elementHoverColor, setElementHoverColor] = useState('#FFC048');
  const [elementFocusRing, setElementFocusRing] = useState('#E5A93B');
  const [borderColor, setBorderColor] = useState('rgba(229, 169, 59, 0.25)');

  const [particleShape, setParticleShape] = useState('moon');
  const [particleDensity, setParticleDensity] = useState(65);
  const [particleSpeed, setParticleSpeed] = useState(1.0);
  const [particleColor, setParticleColor] = useState('');
  const [cardStyle, setCardStyle] = useState('rounded-full');
  const [backgroundPattern, setBackgroundPattern] = useState('stars');
  const [fontPreset, setFontPreset] = useState('cormorant');
  const [allowCanvasZoom, setAllowCanvasZoom] = useState<boolean>(true);
  const [customCss, setCustomCss] = useState('');

  // Section-level Themes State
  const [sectionThemes, setSectionThemes] = useState<Record<string, SectionThemeSpec>>({});
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saving' | 'saved'>('saved');

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
      setBackgroundGradient(theme.backgroundGradient || '');
      setAccentColor(theme.accentColor || '#9F2B00');
      setCardBackground(theme.cardBackground || '#0c0f0d');
      setCardBoxShadow(theme.cardBoxShadow || '');
      setBorderWidth(theme.borderWidth || '1px');
      setBorderOpacity(theme.borderOpacity ?? 0.25);
      setBorderStylePreset(theme.borderStylePreset || 'solid');
      setTextColor(theme.textColor || '#F4F6F0');
      setHeadingColor(theme.headingColor || theme.primaryColor || '#E5A93B');
      setSubtitleColor(theme.subtitleColor || theme.textColor || '#F4F6F0');
      setButtonBg(theme.buttonBg || theme.primaryColor || '#E5A93B');
      setButtonText(theme.buttonText || theme.backgroundStart || '#080c0a');
      setButtonHoverBg(theme.buttonHoverBg || '#FFC048');
      setButtonHoverText(theme.buttonHoverText || '#080c0a');
      setButtonFocusRing(theme.buttonFocusRing || theme.primaryColor || '#E5A93B');
      setCardHoverBg(theme.cardHoverBg || '#121714');
      setCardHoverBorder(theme.cardHoverBorder || theme.primaryColor || '#E5A93B');
      setCardFocusRing(theme.cardFocusRing || theme.secondaryColor || '#22A6B7');
      setElementHoverColor(theme.elementHoverColor || '#FFC048');
      setElementFocusRing(theme.elementFocusRing || theme.primaryColor || '#E5A93B');
      setBorderColor(theme.borderColor || '#E5A93B');
      setParticleShape(theme.particleShape || 'moon');
      setParticleDensity(theme.particleDensity ?? 65);
      setParticleSpeed(theme.particleSpeed ?? 1.0);
      setParticleColor(theme.particleColor || '');
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
    setSyncStatus('syncing');
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
        backgroundGradient,
        accentColor,
        cardBackground,
        cardBoxShadow,
        borderWidth,
        borderOpacity,
        borderStylePreset,
        textColor,
        headingColor,
        subtitleColor,
        buttonBg,
        buttonText,
        buttonHoverBg,
        buttonHoverText,
        buttonFocusRing,
        cardHoverBg,
        cardHoverBorder,
        cardFocusRing,
        elementHoverColor,
        elementFocusRing,
        borderColor,
        particleShape,
        particleDensity,
        particleSpeed,
        particleColor,
        cardStyle,
        backgroundPattern,
        fontPreset,
        customCss,
        sectionThemes,
      });
      setSyncStatus('idle');
    }, 16);
  }, [themeMode, primaryColor, secondaryColor, backgroundStart, backgroundEnd, backgroundGradient, accentColor, cardBackground, cardBoxShadow, borderWidth, borderOpacity, borderStylePreset, textColor, headingColor, subtitleColor, buttonBg, buttonText, buttonHoverBg, buttonHoverText, buttonFocusRing, cardHoverBg, cardHoverBorder, cardFocusRing, elementHoverColor, elementFocusRing, borderColor, particleShape, particleDensity, particleSpeed, particleColor, cardStyle, backgroundPattern, fontPreset, customCss, sectionThemes, setThemeOverride]);

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
    setThemeMode('section');
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
    setSyncStatus('saving');
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const payload = {
      theme_mode: themeMode,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      background_start: backgroundStart,
      background_end: backgroundEnd,
      background_gradient: backgroundGradient,
      accent_color: accentColor,
      card_background: cardBackground,
      card_box_shadow: cardBoxShadow,
      border_width: borderWidth,
      border_opacity: borderOpacity,
      border_style_preset: borderStylePreset,
      text_color: textColor,
      heading_color: headingColor,
      subtitle_color: subtitleColor,
      button_bg: buttonBg,
      button_text: buttonText,
      button_hover_bg: buttonHoverBg,
      button_hover_text: buttonHoverText,
      button_focus_ring: buttonFocusRing,
      card_hover_bg: cardHoverBg,
      card_hover_border: cardHoverBorder,
      card_focus_ring: cardFocusRing,
      element_hover_color: elementHoverColor,
      element_focus_ring: elementFocusRing,
      border_color: borderColor,
      particle_shape: particleShape,
      particle_density: particleDensity,
      particle_speed: particleSpeed,
      particle_color: particleColor,
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
      setSyncStatus('saved');
      showToast.success('¡Configuración de tema guardada en el servidor!');
    } catch (e: any) {
      console.error('Error saving theme settings:', e);
      setSyncStatus('idle');
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
            {/* Indicador Visual de Sincronización & Debounce State */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#0d110e] border border-white/20 text-xs font-mono">
              {syncStatus === 'syncing' && (
                <span className="flex items-center gap-1.5 text-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  Sincronizando previa...
                </span>
              )}
              {syncStatus === 'saving' && (
                <span className="flex items-center gap-1.5 text-sky-300">
                  <RefreshCw className="animate-spin" size={14} />
                  Guardando en servidor...
                </span>
              )}
              {syncStatus === 'saved' && (
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <Check size={14} />
                  Cambios guardados
                </span>
              )}
              {syncStatus === 'idle' && (
                <span className="text-white/60 font-semibold">
                  ✓ Previa lista
                </span>
              )}
            </div>

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

            {/* Reusable Mode Selector Toggle */}
            <ThemeModeSelector themeMode={themeMode} onChange={setThemeMode} />

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

              {/* Estados Interactivos: Hover & Focus (WCAG AA) */}
              <div className="pt-3 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-amber-honey flex items-center gap-1.5">
                    <Sparkles size={12} /> Estados Hover & Focus (WCAG AA)
                  </label>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                    WCAG AA OK
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Botón Hover Bg */}
                  <div>
                    <label className="block text-[9px] font-bold text-white/60 mb-1">Botón Hover (Fondo):</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={buttonHoverBg}
                        onChange={(e) => setButtonHoverBg(e.target.value)}
                        className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={buttonHoverBg}
                        onChange={(e) => setButtonHoverBg(e.target.value)}
                        className="bg-[#0d110e] border border-white/20 rounded-lg px-2 py-1 text-[11px] font-mono text-white w-full"
                      />
                    </div>
                  </div>

                  {/* Botón Focus Ring */}
                  <div>
                    <label className="block text-[9px] font-bold text-white/60 mb-1">Botón Focus Ring:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={buttonFocusRing}
                        onChange={(e) => setButtonFocusRing(e.target.value)}
                        className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={buttonFocusRing}
                        onChange={(e) => setButtonFocusRing(e.target.value)}
                        className="bg-[#0d110e] border border-white/20 rounded-lg px-2 py-1 text-[11px] font-mono text-white w-full"
                      />
                    </div>
                  </div>

                  {/* Card Hover Border */}
                  <div>
                    <label className="block text-[9px] font-bold text-white/60 mb-1">Tarjeta Hover Borde:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={cardHoverBorder}
                        onChange={(e) => setCardHoverBorder(e.target.value)}
                        className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={cardHoverBorder}
                        onChange={(e) => setCardHoverBorder(e.target.value)}
                        className="bg-[#0d110e] border border-white/20 rounded-lg px-2 py-1 text-[11px] font-mono text-white w-full"
                      />
                    </div>
                  </div>

                  {/* Element Hover Color */}
                  <div>
                    <label className="block text-[9px] font-bold text-white/60 mb-1">Elemento Hover Color:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={elementHoverColor}
                        onChange={(e) => setElementHoverColor(e.target.value)}
                        className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={elementHoverColor}
                        onChange={(e) => setElementHoverColor(e.target.value)}
                        className="bg-[#0d110e] border border-white/20 rounded-lg px-2 py-1 text-[11px] font-mono text-white w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Degradados CSS & Sombras Dinámicas */}
              <div className="pt-3 border-t border-white/10 space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-wider text-amber-honey flex items-center gap-1.5">
                  <Sparkles size={12} /> Degradados & Sombras Avanzadas
                </label>

                {/* Degradado CSS de Fondo */}
                <div>
                  <label className="block text-[9px] font-bold text-white/60 mb-1">
                    {themeMode === 'section' ? 'Degradado CSS de Sección:' : 'Degradado CSS Global:'}
                  </label>
                  <input
                    type="text"
                    placeholder="linear-gradient(135deg, #080c0a 0%, #040605 100%)"
                    value={themeMode === 'section' ? (currentSectionSpec.bg_gradient || backgroundGradient) : backgroundGradient}
                    onChange={(e) => {
                      if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'bg_gradient', e.target.value);
                      else setBackgroundGradient(e.target.value);
                    }}
                    className="bg-[#0d110e] border border-white/20 rounded-xl px-3 py-2 text-xs font-mono text-white w-full focus:border-amber-honey focus:outline-none"
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const val = 'linear-gradient(135deg, #080c0a 0%, #16241c 100%)';
                        if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'bg_gradient', val);
                        else setBackgroundGradient(val);
                      }}
                      className="text-[9px] px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-white/70"
                    >
                      Preset Ámbar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const val = 'radial-gradient(circle at center, #102a28 0%, #040605 100%)';
                        if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'bg_gradient', val);
                        else setBackgroundGradient(val);
                      }}
                      className="text-[9px] px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-white/70"
                    >
                      Preset Esmeralda
                    </button>
                  </div>
                </div>

                {/* Sombra Dinámica (Box Shadow) */}
                <div>
                  <label className="block text-[9px] font-bold text-white/60 mb-1">
                    {themeMode === 'section' ? 'Sombra / Elevación de Sección:' : 'Sombra / Resplandor Dinámico:'}
                  </label>
                  <input
                    type="text"
                    placeholder="0 20px 30px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(229, 169, 59, 0.2)"
                    value={themeMode === 'section' ? (currentSectionSpec.card_box_shadow || cardBoxShadow) : cardBoxShadow}
                    onChange={(e) => {
                      if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'card_box_shadow', e.target.value);
                      else setCardBoxShadow(e.target.value);
                    }}
                    className="bg-[#0d110e] border border-white/20 rounded-xl px-3 py-2 text-xs font-mono text-white w-full focus:border-amber-honey focus:outline-none"
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const val = '0 0 25px rgba(229, 169, 59, 0.35)';
                        if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'card_box_shadow', val);
                        else setCardBoxShadow(val);
                      }}
                      className="text-[9px] px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-lg"
                    >
                      Glow Místico
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const val = '0 20px 25px -5px rgba(0, 0, 0, 0.7)';
                        if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'card_box_shadow', val);
                        else setCardBoxShadow(val);
                      }}
                      className="text-[9px] px-2 py-1 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg"
                    >
                      Sombra Profunda
                    </button>
                  </div>
                </div>

                {/* Gestión de Bordes: Grosor, Opacidad y Estilo */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-white/60 mb-1">Grosor Borde:</label>
                    <select
                      value={themeMode === 'section' ? (currentSectionSpec.border_width || borderWidth) : borderWidth}
                      onChange={(e) => {
                        if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'border_width', e.target.value);
                        else setBorderWidth(e.target.value);
                      }}
                      className="w-full bg-[#0d110e] border border-white/20 rounded-lg px-2 py-1 text-[11px] font-mono text-white"
                    >
                      <option value="1px">1px (Fino)</option>
                      <option value="2px">2px (Medio)</option>
                      <option value="3px">3px (Grueso)</option>
                      <option value="4px">4px (Bold)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-white/60 mb-1">Opacidad Borde:</label>
                    <select
                      value={String(themeMode === 'section' ? (currentSectionSpec.border_opacity ?? borderOpacity) : borderOpacity)}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'border_opacity', v);
                        else setBorderOpacity(v);
                      }}
                      className="w-full bg-[#0d110e] border border-white/20 rounded-lg px-2 py-1 text-[11px] font-mono text-white"
                    >
                      <option value="0.1">10% (Sutil)</option>
                      <option value="0.25">25% (Estándar)</option>
                      <option value="0.5">50% (Intenso)</option>
                      <option value="1">100% (Opaco)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-white/60 mb-1">Estilo Borde:</label>
                    <select
                      value={themeMode === 'section' ? (currentSectionSpec.border_style_preset || borderStylePreset) : borderStylePreset}
                      onChange={(e) => {
                        if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'border_style_preset', e.target.value);
                        else setBorderStylePreset(e.target.value);
                      }}
                      className="w-full bg-[#0d110e] border border-white/20 rounded-lg px-2 py-1 text-[11px] font-mono text-white"
                    >
                      <option value="solid">Línea Solid</option>
                      <option value="glass">Glass / Cristal</option>
                      <option value="dashed">Punteado / Dashed</option>
                      <option value="dotted">Puntos / Dotted</option>
                    </select>
                  </div>
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

          {/* Dedicated Particle System & Visual Effects Card */}
          <div className="amber-glass p-6 rounded-3xl border border-white/10 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-xs font-black uppercase tracking-widest text-amber-honey flex items-center gap-2">
                <Sparkles size={16} /> Fondo de Partículas & Efectos
              </h3>
              <span className="text-[9px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full font-mono">
                Canvas 60 FPS
              </span>
            </div>

            <div className="space-y-4">
              {/* Particle Shape Dropdown */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-white/70 mb-2">
                  Forma / Geometría de Partículas:
                </label>
                <select
                  value={themeMode === 'section' ? (currentSectionSpec.particle_shape || particleShape) : particleShape}
                  onChange={(e) => {
                    if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'particle_shape', e.target.value);
                    else setParticleShape(e.target.value);
                  }}
                  className="w-full bg-[#0d110e] border border-white/20 rounded-2xl px-4 py-3 text-xs font-bold text-white focus:border-amber-honey focus:outline-none focus:ring-1 focus:ring-amber-honey"
                >
                  {SHAPE_OPTIONS.map(shape => (
                    <option key={shape.id} value={shape.id} className="bg-[#0d110e] text-white py-1">
                      {shape.icon} {shape.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Particle Density Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-white/70">
                    Densidad (Cantidad de Partículas):
                  </label>
                  <span className="text-xs font-mono font-bold text-amber-honey bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
                    {themeMode === 'section' ? (currentSectionSpec.particle_density ?? particleDensity) : particleDensity} pts
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="5"
                  value={themeMode === 'section' ? (currentSectionSpec.particle_density ?? particleDensity) : particleDensity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'particle_density', val);
                    else setParticleDensity(val);
                  }}
                  className="w-full accent-amber-honey cursor-pointer h-2 bg-white/10 rounded-lg"
                />
              </div>

              {/* Particle Speed Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-white/70">
                    Velocidad de Movimiento:
                  </label>
                  <span className="text-xs font-mono font-bold text-amber-honey bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
                    {(themeMode === 'section' ? (currentSectionSpec.particle_speed ?? particleSpeed) : particleSpeed).toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.1"
                  value={themeMode === 'section' ? (currentSectionSpec.particle_speed ?? particleSpeed) : particleSpeed}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'particle_speed', val);
                    else setParticleSpeed(val);
                  }}
                  className="w-full accent-amber-honey cursor-pointer h-2 bg-white/10 rounded-lg"
                />
              </div>

              {/* Particle Custom Color Picker */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-white/70 mb-2">
                  Color Personalizado de Partículas:
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={particleColor || primaryColor}
                    onChange={(e) => {
                      if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'particle_color', e.target.value);
                      else setParticleColor(e.target.value);
                    }}
                    className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    placeholder="Auto (Usar color primario)"
                    value={particleColor}
                    onChange={(e) => {
                      if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'particle_color', e.target.value);
                      else setParticleColor(e.target.value);
                    }}
                    className="bg-[#0d110e] border border-white/20 rounded-xl px-3 py-2 text-xs font-mono text-white w-full focus:border-amber-honey focus:outline-none"
                  />
                  {particleColor && (
                    <button
                      type="button"
                      onClick={() => {
                        if (themeMode === 'section') updateSectionProp(selectedSectionKey, 'particle_color', '');
                        else setParticleColor('');
                      }}
                      className="text-[9px] px-2 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-xl uppercase font-bold"
                    >
                      Auto
                    </button>
                  )}
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
              
              {/* Dynamic Live Preview Canvas for all registered Page Sections */}
              {currentRouteSpec.sections
                .filter(sec => sec.id !== 'navbar' && sec.id !== 'footer')
                .map((sec) => {
                  const secSpec = sectionThemes[sec.id] || {};
                  const isSelected = selectedSectionKey === sec.id;
                  const isHovered = hoveredSectionKey === sec.id;
                  const secBg = secSpec.bg_color || secSpec.card_bg || 'transparent';
                  const secGradient = secSpec.bg_gradient || '';
                  const secHeading = secSpec.heading_color || headingColor;
                  const secText = secSpec.text_color || textColor;
                  const secBtnBg = secSpec.button_bg || buttonBg;
                  const secBtnText = secSpec.button_text || buttonText;

                  return (
                    <div
                      key={sec.id}
                      onClick={(e) => handleVisualInspectorSelect(e, sec.id)}
                      onMouseEnter={() => setHoveredSectionKey(sec.id)}
                      onMouseLeave={() => setHoveredSectionKey(null)}
                      style={{
                        backgroundColor: secBg !== 'transparent' ? secBg : undefined,
                        backgroundImage: secGradient || undefined,
                        boxShadow: secSpec.card_box_shadow || undefined,
                      }}
                      className={`p-6 rounded-3xl border transition-all duration-300 relative cursor-pointer ${
                        isSelected
                          ? 'border-amber-honey bg-amber-honey/10 shadow-glow ring-2 ring-amber-honey/40'
                          : isHovered
                          ? 'border-amber-honey/60 bg-white/5'
                          : 'border-white/10 bg-[#0c0f0d]/60 backdrop-blur-md'
                      }`}
                    >
                      {(isSelected || isHovered) && (
                        <div className="absolute -top-3 left-4 bg-amber-honey text-black px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest z-10 shadow-md">
                          Editar: {sec.label}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base">{sec.icon}</span>
                        <h3
                          style={{ color: getAccessibleTextColor(secBg !== 'transparent' ? secBg : backgroundStart, secHeading) }}
                          className="text-sm font-black uppercase tracking-wider font-serif"
                        >
                          {sec.label}
                        </h3>
                      </div>

                      <p
                        style={{ color: getAccessibleTextColor(secBg !== 'transparent' ? secBg : backgroundStart, secText) }}
                        className="text-xs max-w-sm mb-4 opacity-80"
                      >
                        Simulación de sección <span className="font-mono text-amber-honey font-bold">{sec.id}</span> en {currentRouteSpec.name}.
                      </p>

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          style={{ backgroundColor: secBtnBg, color: secBtnText }}
                          className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-transform hover:scale-105 shadow-sm"
                        >
                          Acción {sec.label.split(' ')[0]}
                        </button>
                        <div className="text-[9px] opacity-60 font-mono" style={{ color: getAccessibleTextColor(secBg !== 'transparent' ? secBg : backgroundStart, secText) }}>
                          [data-section-key="{sec.id}"]
                        </div>
                      </div>
                    </div>
                  );
                })}
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
