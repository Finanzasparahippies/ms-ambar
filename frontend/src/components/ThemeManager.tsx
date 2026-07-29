import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useEventTheme, ThemeConfig } from '../context/EventThemeContext';
import { Palette, Sparkles, Check, RefreshCw, Eye, Sliders, Layers, Type, Paintbrush } from 'lucide-react';
import { showToast } from '../lib/notifications';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

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

export const ThemeManager: React.FC = () => {
  const { theme, setThemeOverride, fetchThemeForEvent } = useEventTheme();
  
  const [scope, setScope] = useState<'global' | 'event'>('global');
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  const [primaryColor, setPrimaryColor] = useState('#E5A93B');
  const [secondaryColor, setSecondaryColor] = useState('#22A6B7');
  const [backgroundStart, setBackgroundStart] = useState('#080c0a');
  const [backgroundEnd, setBackgroundEnd] = useState('#040605');
  const [accentColor, setAccentColor] = useState('#9F2B00');
  const [cardBackground, setCardBackground] = useState('#0c0f0d');
  const [textColor, setTextColor] = useState('#F4F6F0');
  
  const [particleShape, setParticleShape] = useState('moon');
  const [cardStyle, setCardStyle] = useState('rounded-full');
  const [backgroundPattern, setBackgroundPattern] = useState('stars');
  const [fontPreset, setFontPreset] = useState('cormorant');
  const [customCss, setCustomCss] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch Events for selection
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await axios.get(`${API_URL}/tickets/events/`);
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
      if (scope === 'global') {
        const res = await axios.get(`${API_URL}/tickets/settings/`);
        if (res.data) {
          const cfg = res.data.theme_config || res.data;
          setPrimaryColor(cfg.primary_color || '#E5A93B');
          setSecondaryColor(cfg.secondary_color || '#22A6B7');
          setBackgroundStart(cfg.background_start || '#080c0a');
          setBackgroundEnd(cfg.background_end || '#040605');
          setAccentColor(cfg.accent_color || '#9F2B00');
          setCardBackground(cfg.card_background || '#0c0f0d');
          setTextColor(cfg.text_color || '#F4F6F0');
          setParticleShape(cfg.particle_shape || 'moon');
          setCardStyle(cfg.card_style || 'rounded-full');
          setBackgroundPattern(cfg.background_pattern || 'stars');
          setFontPreset(cfg.font_preset || 'cormorant');
          setCustomCss(cfg.custom_css || '');
        }
      } else if (selectedEventId) {
        const res = await axios.get(`${API_URL}/tickets/events/${selectedEventId}/`);
        if (res.data) {
          const cfg = res.data.theme_config || res.data;
          setPrimaryColor(res.data.primary_color || cfg.primary_color || '#E5A93B');
          setSecondaryColor(res.data.secondary_color || cfg.secondary_color || '#22A6B7');
          setBackgroundStart(res.data.background_start || cfg.background_start || '#080c0a');
          setBackgroundEnd(res.data.background_end || cfg.background_end || '#040605');
          setAccentColor(res.data.accent_color || cfg.accent_color || '#9F2B00');
          setCardBackground(res.data.card_background || cfg.card_background || '#0c0f0d');
          setTextColor(res.data.text_color || cfg.text_color || '#F4F6F0');
          setParticleShape(res.data.particle_shape || cfg.particle_shape || 'moon');
          setCardStyle(res.data.card_style || cfg.card_style || 'rounded-full');
          setBackgroundPattern(res.data.background_pattern || cfg.background_pattern || 'stars');
          setFontPreset(res.data.font_preset || cfg.font_preset || 'cormorant');
          setCustomCss(res.data.custom_css || '');
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
      primaryColor,
      secondaryColor,
      backgroundStart,
      backgroundEnd,
      accentColor,
      cardBackground,
      textColor,
      particleShape,
      cardStyle,
      backgroundPattern,
      fontPreset,
      customCss,
    });
  };

  useEffect(() => {
    handleLivePreview();
  }, [primaryColor, secondaryColor, backgroundStart, backgroundEnd, accentColor, cardBackground, textColor, particleShape, cardStyle, backgroundPattern, fontPreset, customCss]);

  const handleSave = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const payload = {
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      background_start: backgroundStart,
      background_end: backgroundEnd,
      accent_color: accentColor,
      card_background: cardBackground,
      text_color: textColor,
      particle_shape: particleShape,
      card_style: cardStyle,
      background_pattern: backgroundPattern,
      font_preset: fontPreset,
      custom_css: customCss,
    };

    try {
      if (scope === 'global') {
        await axios.post(`${API_URL}/tickets/settings/`, payload, { headers });
        showToast.success('¡Configuración de tema global guardada y aplicada a todo el sitio!');
      } else if (selectedEventId) {
        await axios.patch(`${API_URL}/tickets/events/${selectedEventId}/`, payload, { headers });
        showToast.success('¡Tema personalizado del evento actualizado con éxito!');
      }
      fetchThemeForEvent(scope === 'event' ? selectedEventId || undefined : undefined);
    } catch (e: any) {
      console.error('Error saving theme settings:', e);
      showToast.error(e.response?.data?.error || 'Error al guardar el tema visual.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="amber-glass p-8 rounded-3xl border border-white/10 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <span className="text-[10px] text-amber-honey uppercase tracking-widest font-black flex items-center gap-2 mb-2">
              <Paintbrush size={14} className="text-amber-honey" />
              Motor de Personalización Visual (Dynamic Multi-Tenant Theme Engine)
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-[#F4F6F0] uppercase italic tracking-tighter">
              Control Visual del Sitio y Eventos
            </h2>
            <p className="text-[#F4F6F0]/60 text-xs font-medium max-w-2xl mt-1">
              Modifica los colores, formas del Canvas de partículas, estilo de tarjetas, tipografía y CSS dinámico en tiempo real para todas las páginas del sitio o por evento individual.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-amber-honey hover:bg-amber-butterscotch text-[#1E2B22] font-black uppercase tracking-widest text-xs px-7 py-3.5 rounded-2xl transition-all shadow-xl shadow-amber-honey/20 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
              Guardar Tema Visual
            </button>
          </div>
        </div>
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

      {/* Main Settings Form */}
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
    </div>
  );
};
export default ThemeManager;
