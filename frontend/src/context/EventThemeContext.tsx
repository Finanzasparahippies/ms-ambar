import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  backgroundStart: string;
  backgroundEnd: string;
  accentColor: string;
  cardBackground: string;
  textColor: string;
  particleShape: string;
  cardStyle: string;
  backgroundPattern: string;
  fontPreset: string;
  customCss: string;
  eventId?: number | null;
  eventTitle?: string | null;
}

const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#E5A93B',
  secondaryColor: '#22A6B7',
  backgroundStart: '#080c0a',
  backgroundEnd: '#040605',
  accentColor: '#9F2B00',
  cardBackground: '#0c0f0d',
  textColor: '#F4F6F0',
  particleShape: 'moon',
  cardStyle: 'rounded-full',
  backgroundPattern: 'stars',
  fontPreset: 'cormorant',
  customCss: '',
  eventId: null,
  eventTitle: null,
};

interface EventThemeContextType {
  theme: ThemeConfig;
  loading: boolean;
  setThemeOverride: (override: Partial<ThemeConfig>) => void;
  fetchThemeForEvent: (eventId?: number | string) => Promise<void>;
}

const EventThemeContext = createContext<EventThemeContextType>({
  theme: DEFAULT_THEME,
  loading: true,
  setThemeOverride: () => {},
  fetchThemeForEvent: async () => {},
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
    root.style.setProperty('--primary-color', cfg.primaryColor);
    root.style.setProperty('--secondary-color', cfg.secondaryColor);
    root.style.setProperty('--background-start', cfg.backgroundStart);
    root.style.setProperty('--background-end', cfg.backgroundEnd);
    root.style.setProperty('--accent-color', cfg.accentColor);
    root.style.setProperty('--card-bg', cfg.cardBackground);
    root.style.setProperty('--foreground-rgb', hexToRgbTriplet(cfg.textColor));

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

    // Data attributes for layout selectors
    root.setAttribute('data-theme-pattern', cfg.backgroundPattern || 'stars');
    root.setAttribute('data-theme-shape', cfg.particleShape || 'moon');
    root.setAttribute('data-theme-card-style', cfg.cardStyle || 'rounded-full');

    // Custom CSS injection
    let customStyleTag = document.getElementById('ms-ambar-custom-theme-css');
    if (!customStyleTag) {
      customStyleTag = document.createElement('style');
      customStyleTag.id = 'ms-ambar-custom-theme-css';
      document.head.appendChild(customStyleTag);
    }
    customStyleTag.textContent = cfg.customCss || '';
  };

  const fetchThemeForEvent = async (eventId?: number | string) => {
    try {
      setLoading(true);
      const url = eventId 
        ? `${API_URL}/tickets/theme/active/?event_id=${eventId}`
        : `${API_URL}/tickets/theme/active/`;
      
      const res = await axios.get(url);
      if (res.data) {
        const d = res.data;
        const newTheme: ThemeConfig = {
          primaryColor: d.primary_color || DEFAULT_THEME.primaryColor,
          secondaryColor: d.secondary_color || DEFAULT_THEME.secondaryColor,
          backgroundStart: d.background_start || DEFAULT_THEME.backgroundStart,
          backgroundEnd: d.background_end || DEFAULT_THEME.backgroundEnd,
          accentColor: d.accent_color || DEFAULT_THEME.accentColor,
          cardBackground: d.card_background || DEFAULT_THEME.cardBackground,
          textColor: d.text_color || DEFAULT_THEME.textColor,
          particleShape: d.particle_shape || DEFAULT_THEME.particleShape,
          cardStyle: d.card_style || DEFAULT_THEME.cardStyle,
          backgroundPattern: d.background_pattern || DEFAULT_THEME.backgroundPattern,
          fontPreset: d.font_preset || DEFAULT_THEME.fontPreset,
          customCss: d.custom_css || '',
          eventId: d.event_id || null,
          eventTitle: d.event_title || null,
        };
        setTheme(newTheme);
        applyThemeToDOM(newTheme);
      }
    } catch (err) {
      console.warn('[EventThemeContext] Failed to load theme from backend, applying defaults:', err);
      applyThemeToDOM(DEFAULT_THEME);
    } finally {
      setLoading(false);
    }
  };

  const setThemeOverride = (override: Partial<ThemeConfig>) => {
    setTheme(prev => {
      const updated = { ...prev, ...override };
      applyThemeToDOM(updated);
      return updated;
    });
  };

  useEffect(() => {
    fetchThemeForEvent();
  }, []);

  return (
    <EventThemeContext.Provider value={{ theme, loading, setThemeOverride, fetchThemeForEvent }}>
      {children}
    </EventThemeContext.Provider>
  );
};
