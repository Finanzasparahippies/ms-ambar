import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { getApiUrl } from '../lib/utils';

export interface SectionThemeSpec {
  bg_color?: string;
  bg_gradient_start?: string;
  bg_gradient_end?: string;
  text_color?: string;
  heading_color?: string;
  subtitle_color?: string;
  accent_color?: string;
  card_bg?: string;
  button_bg?: string;
  button_text?: string;
  border_color?: string;
  particle_shape?: string;
  card_style?: string;
  animation_preset?: string;
  image_filter?: string;
  custom_css?: string;
  timeline_glow?: string;
  timeline_hover_balloon?: boolean;
}

export interface ThemeConfig {
  themeMode?: 'global' | 'section';
  primaryColor: string;
  secondaryColor: string;
  backgroundStart: string;
  backgroundEnd: string;
  accentColor: string;
  cardBackground: string;
  textColor: string;
  headingColor?: string;
  subtitleColor?: string;
  buttonBg?: string;
  buttonText?: string;
  borderColor?: string;
  particleShape: string;
  cardStyle: string;
  backgroundPattern: string;
  fontPreset: string;
  animationPreset?: string;
  imageFilter?: string;
  customCss: string;
  sectionThemes?: Record<string, SectionThemeSpec>;
  eventId?: number | null;
  eventTitle?: string | null;
}

const LOCAL_STORAGE_THEME_KEY = 'ms_ambar_theme_override_v2';

const DEFAULT_THEME: ThemeConfig = {
  themeMode: 'global',
  primaryColor: '#E5A93B',
  secondaryColor: '#22A6B7',
  backgroundStart: '#080c0a',
  backgroundEnd: '#040605',
  accentColor: '#9F2B00',
  cardBackground: '#0c0f0d',
  textColor: '#F4F6F0',
  headingColor: '#E5A93B',
  subtitleColor: '#F4F6F0',
  buttonBg: '#E5A93B',
  buttonText: '#080c0a',
  borderColor: 'rgba(229, 169, 59, 0.25)',
  particleShape: 'moon',
  cardStyle: 'rounded-full',
  backgroundPattern: 'stars',
  fontPreset: 'cormorant',
  animationPreset: 'none',
  imageFilter: 'none',
  customCss: '',
  sectionThemes: {},
  eventId: null,
  eventTitle: null,
};

interface EventThemeContextType {
  theme: ThemeConfig;
  loading: boolean;
  setThemeOverride: (override: Partial<ThemeConfig>) => void;
  fetchThemeForEvent: (eventId?: number | string) => Promise<void>;
  getSectionTheme: (sectionKey: string) => SectionThemeSpec;
  resetThemeToDefaults: () => void;
  clearSectionOverrides: () => void;
}

const EventThemeContext = createContext<EventThemeContextType>({
  theme: DEFAULT_THEME,
  loading: true,
  setThemeOverride: () => {},
  fetchThemeForEvent: async () => {},
  getSectionTheme: () => ({}),
  resetThemeToDefaults: () => {},
  clearSectionOverrides: () => {},
});

export const useEventTheme = () => useContext(EventThemeContext);

// Convert hex to RGB triplet string "r, g, b"
function hexToRgbTriplet(hex: string): string {
  if (!hex) return '229, 169, 59';
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  if (cleanHex.length !== 6) return '229, 169, 59';
  const num = parseInt(cleanHex, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

export const EventThemeContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [loading, setLoading] = useState<boolean>(true);

  const applyThemeToDOM = (cfg: ThemeConfig) => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    // Set CSS variables
    root.style.setProperty('--amber-primary-hex', cfg.primaryColor);
    root.style.setProperty('--amber-primary', hexToRgbTriplet(cfg.primaryColor));
    root.style.setProperty('--sky-accent', hexToRgbTriplet(cfg.secondaryColor));
    root.style.setProperty('--primary-color', cfg.primaryColor);
    root.style.setProperty('--secondary-color', cfg.secondaryColor);
    root.style.setProperty('--background-start', cfg.backgroundStart);
    root.style.setProperty('--background-end', cfg.backgroundEnd);
    root.style.setProperty('--accent-color', cfg.accentColor);
    root.style.setProperty('--card-bg', cfg.cardBackground);
    root.style.setProperty('--foreground-rgb', hexToRgbTriplet(cfg.textColor));
    root.style.setProperty('--text-color', cfg.textColor);
    root.style.setProperty('--heading-color', cfg.headingColor || cfg.primaryColor);
    root.style.setProperty('--subtitle-color', cfg.subtitleColor || cfg.textColor);
    root.style.setProperty('--button-bg', cfg.buttonBg || cfg.primaryColor);
    root.style.setProperty('--button-text', cfg.buttonText || cfg.backgroundStart);
    root.style.setProperty('--border-color', cfg.borderColor || `rgba(${hexToRgbTriplet(cfg.primaryColor)}, 0.25)`);

    // Card radius mapping
    let radius = '2rem';
    if (cfg.cardStyle === 'rounded-2xl') radius = '1.25rem';
    else if (cfg.cardStyle === 'rounded-lg') radius = '0.5rem';
    else if (cfg.cardStyle === 'rounded-none') radius = '0rem';
    root.style.setProperty('--theme-card-radius', radius);

    // Font preset mapping
    let fontSerif = "'Cormorant Garamond', Georgia, serif";
    if (cfg.fontPreset === 'outfit') fontSerif = "'Outfit', 'Inter', sans-serif";
    else if (cfg.fontPreset === 'cinzel') fontSerif = "'Cinzel Decorative', Georgia, serif";
    else if (cfg.fontPreset === 'syne') fontSerif = "'Syne', sans-serif";
    root.style.setProperty('--theme-heading-font', fontSerif);

    // Data attributes for layout selectors & animations
    root.setAttribute('data-theme-pattern', cfg.backgroundPattern || 'stars');
    root.setAttribute('data-theme-shape', cfg.particleShape || 'moon');
    root.setAttribute('data-theme-card-style', cfg.cardStyle || 'rounded-full');
    root.setAttribute('data-theme-animation', cfg.animationPreset || 'none');
    root.setAttribute('data-theme-image-filter', cfg.imageFilter || 'none');
    root.setAttribute('data-theme-mode', cfg.themeMode || 'global');

    // Custom CSS injection
    let customStyleTag = document.getElementById('ms-ambar-custom-theme-css');
    if (!customStyleTag) {
      customStyleTag = document.createElement('style');
      customStyleTag.id = 'ms-ambar-custom-theme-css';
      document.head.appendChild(customStyleTag);
    }
    customStyleTag.textContent = cfg.customCss || '';
  };

  const getSavedLocalTheme = (): Partial<ThemeConfig> | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_THEME_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const fetchThemeForEvent = async (eventId?: number | string) => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      const url = eventId 
        ? `${apiUrl}/tickets/theme/active/?event_id=${eventId}`
        : `${apiUrl}/tickets/theme/active/`;
      
      const res = await axios.get(url);
      let baseThemeData: ThemeConfig = DEFAULT_THEME;

      if (res.data) {
        const d = res.data;
        baseThemeData = {
          themeMode: d.theme_mode || 'global',
          primaryColor: d.primary_color || DEFAULT_THEME.primaryColor,
          secondaryColor: d.secondary_color || DEFAULT_THEME.secondaryColor,
          backgroundStart: d.background_start || DEFAULT_THEME.backgroundStart,
          backgroundEnd: d.background_end || DEFAULT_THEME.backgroundEnd,
          accentColor: d.accent_color || DEFAULT_THEME.accentColor,
          cardBackground: d.card_background || DEFAULT_THEME.cardBackground,
          textColor: d.text_color || DEFAULT_THEME.textColor,
          headingColor: d.heading_color || d.primary_color || DEFAULT_THEME.headingColor,
          subtitleColor: d.subtitle_color || d.text_color || DEFAULT_THEME.subtitleColor,
          buttonBg: d.button_bg || d.primary_color || DEFAULT_THEME.buttonBg,
          buttonText: d.button_text || d.background_start || DEFAULT_THEME.buttonText,
          borderColor: d.border_color || DEFAULT_THEME.borderColor,
          particleShape: d.particle_shape || DEFAULT_THEME.particleShape,
          cardStyle: d.card_style || DEFAULT_THEME.cardStyle,
          backgroundPattern: d.background_pattern || DEFAULT_THEME.backgroundPattern,
          fontPreset: d.font_preset || DEFAULT_THEME.fontPreset,
          animationPreset: d.animation_preset || DEFAULT_THEME.animationPreset,
          imageFilter: d.image_filter || DEFAULT_THEME.imageFilter,
          customCss: d.custom_css || '',
          sectionThemes: d.section_themes || {},
          eventId: d.event_id || null,
          eventTitle: d.event_title || null,
        };
      }

      // Merge local draft override if available so changes persist across navigations
      const localDraft = getSavedLocalTheme();
      const finalTheme = localDraft ? { ...baseThemeData, ...localDraft } : baseThemeData;

      setTheme(finalTheme);
      applyThemeToDOM(finalTheme);
    } catch (err) {
      console.warn('[EventThemeContext] Failed to load theme from backend, applying defaults:', err);
      const localDraft = getSavedLocalTheme();
      const finalTheme = localDraft ? { ...DEFAULT_THEME, ...localDraft } : DEFAULT_THEME;
      setTheme(finalTheme);
      applyThemeToDOM(finalTheme);
    } finally {
      setLoading(false);
    }
  };

  const setThemeOverride = (override: Partial<ThemeConfig>) => {
    setTheme(prev => {
      const updated = { ...prev, ...override };
      applyThemeToDOM(updated);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(LOCAL_STORAGE_THEME_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error('[EventThemeContext] Error writing local theme draft:', e);
        }
      }
      return updated;
    });
  };

  const resetThemeToDefaults = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_STORAGE_THEME_KEY);
    }
    setTheme(DEFAULT_THEME);
    applyThemeToDOM(DEFAULT_THEME);
  };

  const clearSectionOverrides = () => {
    setThemeOverride({
      themeMode: 'global',
      sectionThemes: {},
    });
  };

  const getSectionTheme = (sectionKey: string): SectionThemeSpec => {
    // Edgecase resolution: In Global mode, ignore section overrides so styles never collide!
    if (theme.themeMode === 'global') {
      return {};
    }

    const sec = theme.sectionThemes?.[sectionKey] || {};
    return {
      heading_color: sec.heading_color || theme.headingColor || theme.primaryColor,
      text_color: sec.text_color || theme.textColor,
      subtitle_color: sec.subtitle_color || theme.subtitleColor || theme.textColor,
      accent_color: sec.accent_color || theme.accentColor || theme.primaryColor,
      card_bg: sec.card_bg || theme.cardBackground,
      border_color: sec.border_color || theme.borderColor,
      button_bg: sec.button_bg || theme.buttonBg || theme.primaryColor,
      button_text: sec.button_text || theme.buttonText,
      particle_shape: sec.particle_shape || theme.particleShape,
      card_style: sec.card_style || theme.cardStyle,
      animation_preset: sec.animation_preset || theme.animationPreset,
      image_filter: sec.image_filter || theme.imageFilter,
      custom_css: sec.custom_css || '',
    };
  };

  useEffect(() => {
    fetchThemeForEvent();
  }, []);

  return (
    <EventThemeContext.Provider value={{ 
      theme, 
      loading, 
      setThemeOverride, 
      fetchThemeForEvent, 
      getSectionTheme,
      resetThemeToDefaults,
      clearSectionOverrides 
    }}>
      {children}
    </EventThemeContext.Provider>
  );
};
