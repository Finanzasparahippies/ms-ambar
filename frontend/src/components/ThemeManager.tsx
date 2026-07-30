import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useEventTheme, ThemeConfig, SectionThemeSpec } from '../context/EventThemeContext';
import { Palette, Sparkles, Check, RefreshCw, Eye, Sliders, Layers, Type, Paintbrush, Layout, Settings } from 'lucide-react';
import { showToast } from '../lib/notifications';
import { getApiUrl } from '../lib/utils';

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

const CARD_STYLE_OPTIONS = [
  { id: 'rounded-full', label: 'Ultra Suave (Píldoras y Cristal)', radius: '2.0rem' },
  { id: 'rounded-2xl', label: 'Moderno (Esquinas Medias Elegantes)', radius: '1.25rem' },
  { id: 'rounded-lg', label: 'Clásico (Esquinas Sutiles)', radius: '0.5rem' },
  { id: 'rounded-none', label: 'Recto / Neobrutalismo', radius: '0rem' },
];

const BACKGROUND_PATTERN_OPTIONS = [
  { id: 'stars', label: 'Estrellas Doradas Flotantes' },
  { id: 'grid', label: 'Malla Geométrica Futurista' },
  { id: 'dots', label: 'Puntos Sutiles Minimalistas' },
  { id: 'waves', label: 'Ondas Gradientes Suaves' },
  { id: 'none', label: 'Limpio (Solo degradado)' },
];

const FONT_PRESET_OPTIONS = [
  { id: 'cormorant', label: 'Cormorant Garamond (Elegante & Místico)', sample: 'Ms Ambar Concert' },
  { id: 'outfit', label: 'Outfit / Inter (Moderno & Tecnológico)', sample: 'Ms Ambar Concert' },
  { id: 'cinzel', label: 'Cinzel Decorative (Editorial & Lujo)', sample: 'Ms Ambar Concert' },
  { id: 'syne', label: 'Syne (Vanguardista & Artístico)', sample: 'Ms Ambar Concert' },
];

const ANIMATION_OPTIONS = [
  { id: 'none', label: 'Estático (Sin animación)', icon: '🛑' },
  { id: 'float', label: 'Flotación Suave (Levitación)', icon: '🎈' },
  { id: 'pulse', label: 'Latido Organic', icon: '💓' },
  { id: 'glow', label: 'Resplandor Místico Radiante', icon: '✨' },
  { id: 'shimmer', label: 'Brillo Irisado', icon: '💎' },
];

const IMAGE_FILTER_OPTIONS = [
  { id: 'none', label: 'Sin Filtro (Original)' },
  { id: 'glow-amber', label: 'Resplandor Ámbar Místico' },
  { id: 'grayscale', label: 'Blanco y Negro Editorial' },
  { id: 'sepia', label: 'Sepia Cálido' },
  { id: 'contrast', label: 'Alto Contraste' },
];

const PAGE_SECTIONS = [
  { id: 'hero', label: 'Landing Page: Hero Principal (Portada)', icon: '🌟' },
  { id: 'biography', label: 'Landing Page: Biografía & Historia Cantautora', icon: '📜' },
  { id: 'events_grid', label: 'Landing Page: Próximos Conciertos y Boletos', icon: '🎫' },
  { id: 'tarot_experience', label: 'Landing Page: Experiencia Tarot & Mística', icon: '🔮' },
  { id: 'tour_timeline', label: 'Landing Page: Línea de Tiempo de Gira', icon: '🗓️' },
  { id: 'vip_experience', label: 'Landing Page: Experiencia VIP Meet & Greet', icon: '👑' },
  { id: 'tickets_page', label: 'Página de Compra: Encabezado y Accesos', icon: '🎟️' },
  { id: 'seating_map', label: 'Página de Compra: Mapa Interactivo de Asientos', icon: '🗺️' },
  { id: 'checkout_modal', label: 'Modal de Checkout y Resumen de Compra', icon: '💳' },
  { id: 'ambar_te_escribe', label: 'Página: Ambar Te Escribe (Blog & Crónicas)', icon: '✍️' },
  { id: 'entretenimiento', label: 'Página: Entretenimiento Interactivo & Canvas', icon: '🎨' },
  { id: 'tienda', label: 'Página: Tienda Oficial & Merch', icon: '🛍️' },
  { id: 'musica', label: 'Página: Música & Discografía', icon: '🎵' },
  { id: 'contact_section', label: 'Página: Contacto & Solicitud de Booking', icon: '📬' },
  { id: 'ticket_detail', label: 'Página: Detalle de Boleto & Código QR', icon: '🎟️' },
  { id: 'dashboard', label: 'Panel: Dashboard & Administración', icon: '📊' },
  { id: 'auth_pages', label: 'Páginas: Autenticación (Login, Registro)', icon: '🔐' },
  { id: 'navbar', label: 'Barra de Navegación Global (Header)', icon: '🧭' },
  { id: 'footer', label: 'Pie de Página y Redes Sociales (Footer)', icon: '⚓' },
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
  const { theme, setThemeOverride, fetchThemeForEvent, resetThemeToDefaults, clearSectionOverrides } = useEventTheme();

  const [scope, setScope] = useState<'global' | 'event'>('global');
  const [activeTabMode, setActiveTabMode] = useState<'general' | 'sections'>('general');
  const [themeMode, setThemeMode] = useState<'global' | 'section'>(theme.themeMode || 'global');
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  // Global Theme States
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
  const [animationPreset, setAnimationPreset] = useState('none');
  const [imageFilter, setImageFilter] = useState('none');
  const [customCss, setCustomCss] = useState('');

  // Section-level Themes State
  const [sectionThemes, setSectionThemes] = useState<Record<string, SectionThemeSpec>>({});
  const [selectedSectionKey, setSelectedSectionKey] = useState<string>('hero');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch Events for selection
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const apiUrl = getApiUrl();
        const res = await axios.get(`${apiUrl}/tickets/events/`);
        if (res.data && Array.isArray(res.data)) {
          setEvents(res.data);
          if (res.data.length > 0 && !selectedEventId) {
            setSelectedEventId(res.data[0].id);
          }
        }
      } catch (e) {
        console.error('Error fetching events for theme manager:', e);
      }
    };
    fetchEvents();
  }, []);

  // Fetch theme configuration depending on scope
  const loadThemeConfig = async () => {
    setLoading(true);
    try {
      const apiUrl = getApiUrl();
      if (scope === 'global') {
        const res = await axios.get(`${apiUrl}/tickets/settings/`);
        if (res.data) {
          const cfg = res.data.theme_config || res.data;
          setPrimaryColor(cfg.primary_color || '#E5A93B');
          setSecondaryColor(cfg.secondary_color || '#22A6B7');
          setBackgroundStart(cfg.background_start || '#080c0a');
          setBackgroundEnd(cfg.background_end || '#040605');
          setAccentColor(cfg.accent_color || '#9F2B00');
          setCardBackground(cfg.card_background || '#0c0f0d');
          setTextColor(cfg.text_color || '#F4F6F0');
          setHeadingColor(cfg.heading_color || cfg.primary_color || '#E5A93B');
          setSubtitleColor(cfg.subtitle_color || cfg.text_color || '#F4F6F0');
          setButtonBg(cfg.button_bg || cfg.primary_color || '#E5A93B');
          setButtonText(cfg.button_text || cfg.background_start || '#080c0a');
          setBorderColor(cfg.border_color || '#E5A93B');
          setParticleShape(cfg.particle_shape || 'moon');
          setCardStyle(cfg.card_style || 'rounded-full');
          setBackgroundPattern(cfg.background_pattern || 'stars');
          setFontPreset(cfg.font_preset || 'cormorant');
          setAnimationPreset(cfg.animation_preset || 'none');
          setImageFilter(cfg.image_filter || 'none');
          setCustomCss(cfg.custom_css || '');
          setSectionThemes(cfg.section_themes || res.data.section_themes || {});
        }
      } else if (selectedEventId) {
        const res = await axios.get(`${apiUrl}/tickets/events/${selectedEventId}/`);
        if (res.data) {
          const cfg = res.data.theme_config || res.data;
          setPrimaryColor(res.data.primary_color || cfg.primary_color || '#E5A93B');
          setSecondaryColor(res.data.secondary_color || cfg.secondary_color || '#22A6B7');
          setBackgroundStart(res.data.background_start || cfg.background_start || '#080c0a');
          setBackgroundEnd(res.data.background_end || cfg.background_end || '#040605');
          setAccentColor(res.data.accent_color || cfg.accent_color || '#9F2B00');
          setCardBackground(res.data.card_background || cfg.card_background || '#0c0f0d');
          setTextColor(res.data.text_color || cfg.text_color || '#F4F6F0');
          setHeadingColor(cfg.heading_color || cfg.primary_color || '#E5A93B');
          setSubtitleColor(cfg.subtitle_color || cfg.text_color || '#F4F6F0');
          setButtonBg(cfg.button_bg || cfg.primary_color || '#E5A93B');
          setButtonText(cfg.button_text || cfg.background_start || '#080c0a');
          setBorderColor(cfg.border_color || '#E5A93B');
          setParticleShape(res.data.particle_shape || cfg.particle_shape || 'moon');
          setCardStyle(res.data.card_style || cfg.card_style || 'rounded-full');
          setBackgroundPattern(res.data.background_pattern || cfg.background_pattern || 'stars');
          setFontPreset(res.data.font_preset || cfg.font_preset || 'cormorant');
          setAnimationPreset(cfg.animation_preset || 'none');
          setImageFilter(cfg.image_filter || 'none');
          setCustomCss(res.data.custom_css || '');
          setSectionThemes(res.data.section_themes || cfg.section_themes || {});
        }
      }
    } catch (e) {
      console.error('Error loading theme settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThemeConfig();
  }, [scope, selectedEventId]);

  // Preview theme changes in real time as user edits form
  const handleLivePreview = () => {
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
      animationPreset,
      imageFilter,
      customCss,
      sectionThemes,
    });
  };

  useEffect(() => {
    handleLivePreview();
  }, [themeMode, primaryColor, secondaryColor, backgroundStart, backgroundEnd, accentColor, cardBackground, textColor, headingColor, subtitleColor, buttonBg, buttonText, borderColor, particleShape, cardStyle, backgroundPattern, fontPreset, animationPreset, imageFilter, customCss, sectionThemes]);

  const applyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
    setBackgroundStart(preset.start);
    setBackgroundEnd(preset.end);
    setCardBackground(preset.card);
    setTextColor(preset.text);
    setHeadingColor(preset.heading);
    setThemeMode('global');
    showToast.success(`Paleta "${preset.name}" aplicada correctamente en modo global.`);
  };

  const updateSectionProp = (key: string, field: keyof SectionThemeSpec, val: any) => {
    setSectionThemes(prev => {
      const currentSec = prev[key] || {};
      const updatedSec = { ...currentSec, [field]: val };
      return { ...prev, [key]: updatedSec };
    });
  };

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
      animation_preset: animationPreset,
      image_filter: imageFilter,
      custom_css: customCss,
      section_themes: sectionThemes,
    };

    try {
      const apiUrl = getApiUrl();
      if (scope === 'global') {
        await axios.post(`${apiUrl}/tickets/settings/`, payload, { headers });
        showToast.success('¡Configuración de tema y secciones guardada en todo el sitio!');
      } else if (selectedEventId) {
        await axios.patch(`${apiUrl}/tickets/events/${selectedEventId}/`, payload, { headers });
        showToast.success('¡Tema y secciones personalizadas del evento actualizados con éxito!');
      }
      fetchThemeForEvent(scope === 'event' ? selectedEventId || undefined : undefined);
    } catch (e: any) {
      console.error('Error saving theme settings:', e);
      showToast.error(e.response?.data?.error || 'Error al guardar la personalización visual.');
    } finally {
      setSaving(false);
    }
  };

  const currentSectionSpec = sectionThemes[selectedSectionKey] || {};

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="amber-glass p-8 rounded-3xl border border-white/10 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <span className="text-[10px] text-amber-honey uppercase tracking-widest font-black flex items-center gap-2 mb-2">
              <Paintbrush size={14} className="text-amber-honey" />
              Motor de Personalización Granular por Sección y Evento (Dynamic Page Builder)
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-[#F4F6F0] uppercase italic tracking-tighter">
              Control Visual del Sitio y Secciones
            </h2>
            <p className="text-[#F4F6F0]/60 text-xs font-medium max-w-2xl mt-1">
              Configura colores, formas de partículas, estilos de tarjetas, tipografía y personalización específica para cada sección individual (`Hero`, `Mapa`, `Boletos`, `Contacto`, etc.).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                clearSectionOverrides();
                setThemeMode('global');
                showToast.success('🧹 Secciones limpiadas. Se ha activado la Paleta Global Unificada.');
              }}
              className="bg-white/10 hover:bg-white/20 text-[#F4F6F0] font-black uppercase tracking-widest text-[10px] px-4 py-3 rounded-2xl transition-all border border-white/10 flex items-center gap-1.5"
            >
              🧹 Limpiar Secciones
            </button>

            <button
              onClick={() => {
                resetThemeToDefaults();
                showToast.success('🔄 Tema restablecido a los valores predeterminados del sistema.');
              }}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-300 font-black uppercase tracking-widest text-[10px] px-4 py-3 rounded-2xl transition-all border border-red-500/20 flex items-center gap-1.5"
            >
              🔄 Restablecer Todo
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-amber-honey hover:bg-amber-butterscotch text-[#1E2B22] font-black uppercase tracking-widest text-xs px-6 py-3.5 rounded-2xl transition-all shadow-xl shadow-amber-honey/20 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
              Guardar en Servidor
            </button>
          </div>
        </div>
      </div>

      {/* Explicit Theme Mode Selector: Global Palette vs Section Override Mode */}
      <div className="amber-glass p-6 rounded-3xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-[#F4F6F0] uppercase tracking-wider flex items-center gap-2">
              <Sliders size={16} className="text-amber-honey" /> Modo de Aplicación de Estilos
            </h3>
            <p className="text-xs text-[#F4F6F0]/60 mt-0.5">
              Elige si deseas aplicar la paleta de colores uniformemente en todo el sitio o permitir personalizaciones por sección.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#080c0a] p-1.5 rounded-2xl border border-white/15">
            <button
              onClick={() => setThemeMode('global')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${themeMode === 'global' ? 'bg-amber-honey text-black shadow-md' : 'text-white/60 hover:text-white'}`}
            >
              Paleta Global Unificada
            </button>
            <button
              onClick={() => setThemeMode('section')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${themeMode === 'section' ? 'bg-amber-honey text-black shadow-md' : 'text-white/60 hover:text-white'}`}
            >
              Personalización por Sección
            </button>
          </div>
        </div>

        {/* 1-Click Preset Palettes */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-honey block">
            Paletas de Colores Rápidas (1-Clic):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex flex-col gap-2 text-left group"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: preset.primary }} />
                  <span className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: preset.secondary }} />
                  <span className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: preset.card }} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-tight text-white/90 group-hover:text-amber-honey line-clamp-1">
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mode Sub-navigation: General Palette vs Granular Section Customizer */}
      <div className="flex gap-3 bg-white/5 border border-white/10 p-1.5 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTabMode('general')}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTabMode === 'general' ? 'bg-amber-honey text-[#1E2B22] shadow-lg' : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0]'}`}
        >
          <Palette size={14} /> Tema General & Paleta Global
        </button>
        <button
          onClick={() => setActiveTabMode('sections')}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTabMode === 'sections' ? 'bg-amber-honey text-[#1E2B22] shadow-lg' : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0]'}`}
        >
          <Layout size={14} /> Personalización por Sección Individual
        </button>
      </div>

      {/* Scope Selector: Global Site vs Event Override */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          onClick={() => setScope('global')}
          className={`amber-glass p-6 rounded-2xl border transition-all cursor-pointer ${scope === 'global' ? 'border-amber-honey bg-amber-honey/10 shadow-lg shadow-amber-honey/10' : 'border-white/10 hover:border-white/20'}`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-amber-honey/20 rounded-xl text-amber-honey">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#F4F6F0]">Tema Global del Sitio</h3>
              <p className="text-xs text-[#F4F6F0]/50">Aplica la paleta de colores por defecto a todas las páginas de ms-ambar.</p>
            </div>
          </div>
        </div>

        <div
          onClick={() => setScope('event')}
          className={`amber-glass p-6 rounded-2xl border transition-all cursor-pointer ${scope === 'event' ? 'border-amber-honey bg-amber-honey/10 shadow-lg shadow-amber-honey/10' : 'border-white/10 hover:border-white/20'}`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-amber-honey/20 rounded-xl text-amber-honey">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#F4F6F0]">Sobrescritura por Evento</h3>
              <p className="text-xs text-[#F4F6F0]/50">Asigna colores y figuras exclusivas para un concierto o convivencia.</p>
            </div>
          </div>

          {scope === 'event' && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <label className="text-[10px] text-amber-honey font-bold uppercase tracking-widest block mb-2">Seleccionar Evento:</label>
              <select
                value={selectedEventId || ''}
                onChange={(e) => setSelectedEventId(Number(e.target.value))}
                className="w-full bg-[#080c0a] border border-white/20 rounded-xl px-4 py-2.5 text-xs text-[#F4F6F0] font-bold focus:border-amber-honey focus:outline-none"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} ({ev.artist})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* MODE 1: General Theme Settings */}
      {activeTabMode === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Colors Section */}
          <div className="amber-glass p-6 rounded-3xl border border-white/10 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <Palette className="text-amber-honey" size={20} />
              <h3 className="text-lg font-bold text-[#F4F6F0] uppercase tracking-wider">Paleta de Colores & Degradados</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Color Primario (Botones / Luces)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-12 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="bg-[#080c0a] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-[#F4F6F0] w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Color Secundario (Acentos)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-12 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="bg-[#080c0a] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-[#F4F6F0] w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Fondo Inicio (Gradient Start)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={backgroundStart}
                    onChange={(e) => setBackgroundStart(e.target.value)}
                    className="w-12 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={backgroundStart}
                    onChange={(e) => setBackgroundStart(e.target.value)}
                    className="bg-[#080c0a] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-[#F4F6F0] w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Fondo Fin (Gradient End)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={backgroundEnd}
                    onChange={(e) => setBackgroundEnd(e.target.value)}
                    className="w-12 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={backgroundEnd}
                    onChange={(e) => setBackgroundEnd(e.target.value)}
                    className="bg-[#080c0a] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-[#F4F6F0] w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Color Resplandor / Brillo</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-12 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="bg-[#080c0a] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-[#F4F6F0] w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Fondo Tarjetas de Cristal</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={cardBackground}
                    onChange={(e) => setCardBackground(e.target.value)}
                    className="w-12 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={cardBackground}
                    onChange={(e) => setCardBackground(e.target.value)}
                    className="bg-[#080c0a] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-[#F4F6F0] w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Color de Títulos / Encabezados (h1, h2, h3)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={headingColor}
                    onChange={(e) => setHeadingColor(e.target.value)}
                    className="w-12 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={headingColor}
                    onChange={(e) => setHeadingColor(e.target.value)}
                    className="bg-[#080c0a] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-[#F4F6F0] w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Color de Texto Base y Subtítulos</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-12 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="bg-[#080c0a] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-[#F4F6F0] w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Fondo de Botones CTA</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={buttonBg}
                    onChange={(e) => setButtonBg(e.target.value)}
                    className="w-12 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={buttonBg}
                    onChange={(e) => setButtonBg(e.target.value)}
                    className="bg-[#080c0a] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-[#F4F6F0] w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Texto de Botones CTA</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                    className="w-12 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                    className="bg-[#080c0a] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-[#F4F6F0] w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Color de Bordes de Tarjetas</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="w-12 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="bg-[#080c0a] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-[#F4F6F0] w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Animation Presets for Objects */}
          <div className="amber-glass p-6 rounded-3xl border border-white/10 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <Sparkles className="text-amber-honey" size={20} />
              <h3 className="text-lg font-bold text-[#F4F6F0] uppercase tracking-wider">Animaciones de Objetos y Elementos</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ANIMATION_OPTIONS.map((anim) => (
                <button
                  key={anim.id}
                  type="button"
                  onClick={() => setAnimationPreset(anim.id)}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${animationPreset === anim.id ? 'bg-amber-honey text-[#1E2B22] border-amber-honey shadow-lg font-bold' : 'bg-[#080c0a]/60 text-[#F4F6F0]/70 border-white/10 hover:border-white/20'}`}
                >
                  <span className="text-xl">{anim.icon}</span>
                  <span className="text-xs">{anim.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Particle Canvas Shape Selection */}
          <div className="amber-glass p-6 rounded-3xl border border-white/10 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <Sparkles className="text-amber-honey" size={20} />
              <h3 className="text-lg font-bold text-[#F4F6F0] uppercase tracking-wider">Figura Geométrica del Canvas de Partículas</h3>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 max-h-[320px] overflow-y-auto custom-scroll pr-1">
              {SHAPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setParticleShape(opt.id)}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${particleShape === opt.id ? 'bg-amber-honey text-[#1E2B22] border-amber-honey shadow-lg shadow-amber-honey/20 font-bold' : 'bg-[#080c0a]/60 text-[#F4F6F0]/70 border-white/10 hover:border-white/20'}`}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <span className="text-[10px] font-black uppercase tracking-tight">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Card Styles & Typography */}
          <div className="amber-glass p-6 rounded-3xl border border-white/10 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <Type className="text-amber-honey" size={20} />
              <h3 className="text-lg font-bold text-[#F4F6F0] uppercase tracking-wider">Estilos de Tarjeta & Fuentes</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Estilo de Bordes y Redondeo</label>
                <div className="grid grid-cols-2 gap-2">
                  {CARD_STYLE_OPTIONS.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setCardStyle(st.id)}
                      className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${cardStyle === st.id ? 'bg-amber-honey text-[#1E2B22] border-amber-honey' : 'bg-[#080c0a] text-[#F4F6F0]/70 border-white/10 hover:border-white/20'}`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Preset de Fuentes Tipográficas</label>
                <div className="grid grid-cols-2 gap-2">
                  {FONT_PRESET_OPTIONS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFontPreset(f.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${fontPreset === f.id ? 'bg-amber-honey text-[#1E2B22] border-amber-honey' : 'bg-[#080c0a] text-[#F4F6F0]/70 border-white/10 hover:border-white/20'}`}
                    >
                      <div className="text-xs font-bold">{f.label}</div>
                      <div className="text-[10px] opacity-70 italic mt-0.5">{f.sample}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Custom CSS Block */}
          <div className="amber-glass p-6 rounded-3xl border border-white/10 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <Sliders className="text-amber-honey" size={20} />
              <h3 className="text-lg font-bold text-[#F4F6F0] uppercase tracking-wider">CSS Personalizado Avanzado</h3>
            </div>

            <div>
              <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Escribe reglas CSS adicionales (opcional):</label>
              <textarea
                rows={7}
                value={customCss}
                onChange={(e) => setCustomCss(e.target.value)}
                placeholder="/* Ejemplo: body { filter: contrast(105%); } */"
                className="w-full bg-[#080c0a] border border-white/15 rounded-2xl p-4 text-xs font-mono text-amber-honey focus:border-amber-honey focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: Granular Section Customizer */}
      {activeTabMode === 'sections' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Section List Selector */}
          <div className="amber-glass p-6 rounded-3xl border border-white/10 space-y-3 lg:col-span-1">
            <h3 className="text-sm font-bold text-amber-honey uppercase tracking-wider mb-2">Seleccionar Sección del Sitio:</h3>
            {PAGE_SECTIONS.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setSelectedSectionKey(sec.id)}
                className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 ${selectedSectionKey === sec.id ? 'bg-amber-honey text-[#1E2B22] border-amber-honey shadow-lg font-bold' : 'bg-[#080c0a]/60 text-[#F4F6F0]/80 border-white/10 hover:border-white/20'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{sec.icon}</span>
                  <span className="text-xs font-bold">{sec.label}</span>
                </div>
                {sectionThemes[sec.id] && Object.keys(sectionThemes[sec.id] || {}).length > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" title="Sección personalizada" />
                )}
              </button>
            ))}
          </div>

          {/* Granular Section Properties Form */}
          <div className="amber-glass p-6 rounded-3xl border border-white/10 space-y-6 lg:col-span-2">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <span className="text-[10px] text-amber-honey uppercase tracking-widest font-black block">Configuración de Sección</span>
                <h3 className="text-xl font-bold text-[#F4F6F0]">
                  {PAGE_SECTIONS.find(s => s.id === selectedSectionKey)?.label}
                </h3>
              </div>

              <button
                onClick={() => {
                  setSectionThemes(prev => {
                    const copy = { ...prev };
                    delete copy[selectedSectionKey];
                    return copy;
                  });
                  showToast.success('Ajustes específicos de la sección restablecidos.');
                }}
                className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10"
              >
                Restablecer Sección
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Fondo de Sección (Solid Color)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={currentSectionSpec.bg_color || '#080c0a'}
                    onChange={(e) => updateSectionProp(selectedSectionKey, 'bg_color', e.target.value)}
                    className="w-12 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={currentSectionSpec.bg_color || ''}
                    placeholder="Ej. #080c0a"
                    onChange={(e) => updateSectionProp(selectedSectionKey, 'bg_color', e.target.value)}
                    className="bg-[#080c0a] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-[#F4F6F0] w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Color del Texto Base de la Sección</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={currentSectionSpec.text_color || '#F4F6F0'}
                    onChange={(e) => updateSectionProp(selectedSectionKey, 'text_color', e.target.value)}
                    className="w-12 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={currentSectionSpec.text_color || ''}
                    placeholder="Ej. #F4F6F0"
                    onChange={(e) => updateSectionProp(selectedSectionKey, 'text_color', e.target.value)}
                    className="bg-[#080c0a] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-[#F4F6F0] w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Color de Títulos de Sección</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={currentSectionSpec.heading_color || '#E5A93B'}
                    onChange={(e) => updateSectionProp(selectedSectionKey, 'heading_color', e.target.value)}
                    className="w-12 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={currentSectionSpec.heading_color || ''}
                    placeholder="Ej. #E5A93B"
                    onChange={(e) => updateSectionProp(selectedSectionKey, 'heading_color', e.target.value)}
                    className="bg-[#080c0a] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-[#F4F6F0] w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Color de Botones CTA de Sección</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={currentSectionSpec.button_bg || '#E5A93B'}
                    onChange={(e) => updateSectionProp(selectedSectionKey, 'button_bg', e.target.value)}
                    className="w-12 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={currentSectionSpec.button_bg || ''}
                    placeholder="Ej. #E5A93B"
                    onChange={(e) => updateSectionProp(selectedSectionKey, 'button_bg', e.target.value)}
                    className="bg-[#080c0a] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-[#F4F6F0] w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Filtro Visual para Imágenes</label>
                <select
                  value={currentSectionSpec.image_filter || 'none'}
                  onChange={(e) => updateSectionProp(selectedSectionKey, 'image_filter', e.target.value)}
                  className="w-full bg-[#080c0a] border border-white/20 rounded-xl px-4 py-2.5 text-xs text-[#F4F6F0] font-bold focus:border-amber-honey focus:outline-none"
                >
                  {IMAGE_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Animación de Objetos en Sección</label>
                <select
                  value={currentSectionSpec.animation_preset || 'none'}
                  onChange={(e) => updateSectionProp(selectedSectionKey, 'animation_preset', e.target.value)}
                  className="w-full bg-[#080c0a] border border-white/20 rounded-xl px-4 py-2.5 text-xs text-[#F4F6F0] font-bold focus:border-amber-honey focus:outline-none"
                >
                  {ANIMATION_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.icon} {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Figura Canvas para esta Sección</label>
                <select
                  value={currentSectionSpec.particle_shape || 'moon'}
                  onChange={(e) => updateSectionProp(selectedSectionKey, 'particle_shape', e.target.value)}
                  className="w-full bg-[#080c0a] border border-white/20 rounded-xl px-4 py-2.5 text-xs text-[#F4F6F0] font-bold focus:border-amber-honey focus:outline-none"
                >
                  {SHAPE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.icon} {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-2">Redondeo de Tarjetas en esta Sección</label>
                <select
                  value={currentSectionSpec.card_style || 'rounded-full'}
                  onChange={(e) => updateSectionProp(selectedSectionKey, 'card_style', e.target.value)}
                  className="w-full bg-[#080c0a] border border-white/20 rounded-xl px-4 py-2.5 text-xs text-[#F4F6F0] font-bold focus:border-amber-honey focus:outline-none"
                >
                  {CARD_STYLE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 📜 DEDICATED BIOGRAPHY CONFIGURATION PANEL */}
            {(selectedSectionKey === 'biography' || selectedSectionKey === 'tarot_experience') && (
              <div className="pt-6 border-t border-white/10 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📜</span>
                  <h4 className="text-sm font-black uppercase tracking-wider text-amber-honey">
                    Configuración de Contenido Autobiográfico de la Artista
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-1.5">
                      Insignia / Distintivo (Ej. "La Cantautora")
                    </label>
                    <input
                      type="text"
                      value={currentSectionSpec.bio_badge || ''}
                      placeholder="La Cantautora"
                      onChange={(e) => updateSectionProp(selectedSectionKey, 'bio_badge', e.target.value)}
                      className="w-full bg-[#080c0a] border border-white/15 rounded-xl px-3.5 py-2 text-xs font-bold text-[#F4F6F0] focus:border-amber-honey focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-1.5">
                      Nombre de Artista / Título (Ej. "Ms. Ambar")
                    </label>
                    <input
                      type="text"
                      value={currentSectionSpec.bio_title || ''}
                      placeholder="Ms. Ambar"
                      onChange={(e) => updateSectionProp(selectedSectionKey, 'bio_title', e.target.value)}
                      className="w-full bg-[#080c0a] border border-white/15 rounded-xl px-3.5 py-2 text-xs font-bold text-[#F4F6F0] focus:border-amber-honey focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-1.5">
                      Ubicación / Origen (Ej. "Hermosillo • México")
                    </label>
                    <input
                      type="text"
                      value={currentSectionSpec.bio_location || ''}
                      placeholder="Hermosillo • México"
                      onChange={(e) => updateSectionProp(selectedSectionKey, 'bio_location', e.target.value)}
                      className="w-full bg-[#080c0a] border border-white/15 rounded-xl px-3.5 py-2 text-xs font-bold text-[#F4F6F0] focus:border-amber-honey focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-1.5">
                      URL de la Fotografía Oficial
                    </label>
                    <input
                      type="text"
                      value={currentSectionSpec.bio_image || ''}
                      placeholder="/Images/Inicio_Biografia.jpg"
                      onChange={(e) => updateSectionProp(selectedSectionKey, 'bio_image', e.target.value)}
                      className="w-full bg-[#080c0a] border border-white/15 rounded-xl px-3.5 py-2 text-xs font-mono text-[#F4F6F0] focus:border-amber-honey focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-1.5">
                      Texto del Botón CTA (Ej. "Ver Próximos Eventos")
                    </label>
                    <input
                      type="text"
                      value={currentSectionSpec.bio_cta_text || ''}
                      placeholder="Ver Próximos Eventos"
                      onChange={(e) => updateSectionProp(selectedSectionKey, 'bio_cta_text', e.target.value)}
                      className="w-full bg-[#080c0a] border border-white/15 rounded-xl px-3.5 py-2 text-xs font-bold text-[#F4F6F0] focus:border-amber-honey focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-1.5">
                      Enlace del Botón CTA (Ej. "/tour")
                    </label>
                    <input
                      type="text"
                      value={currentSectionSpec.bio_cta_url || ''}
                      placeholder="/tour"
                      onChange={(e) => updateSectionProp(selectedSectionKey, 'bio_cta_url', e.target.value)}
                      className="w-full bg-[#080c0a] border border-white/15 rounded-xl px-3.5 py-2 text-xs font-mono text-[#F4F6F0] focus:border-amber-honey focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[#F4F6F0]/60 font-bold uppercase tracking-widest block mb-1.5">
                    Historia / Párrafos de la Biografía (Separa párrafos con saltos de línea):
                  </label>
                  <textarea
                    rows={5}
                    value={currentSectionSpec.bio_content || ''}
                    placeholder="Ms. Ambar, nombre artístico de la cantautora originaria de Hermosillo, Sonora..."
                    onChange={(e) => updateSectionProp(selectedSectionKey, 'bio_content', e.target.value)}
                    className="w-full bg-[#080c0a] border border-white/15 rounded-2xl p-3.5 text-xs text-[#F4F6F0] leading-relaxed focus:border-amber-honey focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Dedicated Tour Timeline Ultrapremium Controls */}
            {selectedSectionKey === 'tour_timeline' && (
              <div className="col-span-1 sm:col-span-2 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-4 mt-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-amber-400" size={16} />
                  <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                    Ajustes Ultrapremium de la Línea de Ruta de Eventos (Tour Timeline)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-[#F4F6F0]/70 font-bold uppercase tracking-widest block mb-2">
                      Globo Emergente Flotante (Cover Image Tooltip)
                    </label>
                    <select
                      value={currentSectionSpec.timeline_hover_balloon !== false ? 'true' : 'false'}
                      onChange={(e) => updateSectionProp(selectedSectionKey, 'timeline_hover_balloon', e.target.value === 'true')}
                      className="w-full bg-[#080c0a] border border-white/20 rounded-xl px-4 py-2 text-xs text-[#F4F6F0] font-bold focus:border-amber-honey focus:outline-none"
                    >
                      <option value="true">✨ Habilitado (Muestra la portada oficial al pasar el puntero)</option>
                      <option value="false">Deshabilitado</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#F4F6F0]/70 font-bold uppercase tracking-widest block mb-2">
                      Resplandor y Neón de Tarjeta Focalizada
                    </label>
                    <select
                      value={currentSectionSpec.timeline_glow || 'amber-neon'}
                      onChange={(e) => updateSectionProp(selectedSectionKey, 'timeline_glow', e.target.value)}
                      className="w-full bg-[#080c0a] border border-white/20 rounded-xl px-4 py-2 text-xs text-[#F4F6F0] font-bold focus:border-amber-honey focus:outline-none"
                    >
                      <option value="amber-neon">🟡 Cristal Oscuro con Neón Ámbar (Recomendado)</option>
                      <option value="cyan-neon">🌐 Cristal Oscuro con Neón Cian</option>
                      <option value="gold-glass">✨ Cristal Dorado de Lujo</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeManager;
