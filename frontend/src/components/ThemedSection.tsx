import React from 'react';
import { useEventTheme } from '../context/EventThemeContext';

interface ThemedSectionProps {
  sectionKey: string;
  className?: string;
  children: React.ReactNode;
  id?: string;
}

function hexToRgb(hex?: string): string | undefined {
  if (!hex) return undefined;
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  if (cleanHex.length !== 6) return undefined;
  const num = parseInt(cleanHex, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

export const ThemedSection: React.FC<ThemedSectionProps> = ({
  sectionKey,
  className = '',
  children,
  id,
}) => {
  const { getSectionTheme } = useEventTheme();
  const sec = getSectionTheme(sectionKey);

  const style: React.CSSProperties = {};
  const customVars: Record<string, string> = {};

  if (sec.accent_color) {
    customVars['--primary-color'] = sec.accent_color;
    customVars['--accent-color'] = sec.accent_color;
    const rgb = hexToRgb(sec.accent_color);
    if (rgb) customVars['--amber-primary'] = rgb;
  }
  if (sec.card_bg) customVars['--card-bg'] = sec.card_bg;
  if (sec.text_color) {
    customVars['--text-color'] = sec.text_color;
    style.color = sec.text_color;
    const rgb = hexToRgb(sec.text_color);
    if (rgb) customVars['--foreground-rgb'] = rgb;
  }
  if (sec.border_color) customVars['--border-color'] = sec.border_color;
  if (sec.bg_gradient_start) customVars['--background-start'] = sec.bg_gradient_start;
  if (sec.bg_gradient_end) customVars['--background-end'] = sec.bg_gradient_end;
  if (sec.bg_color) style.backgroundColor = sec.bg_color;

  if (sec.bg_gradient_start && sec.bg_gradient_end) {
    style.background = `linear-gradient(135deg, ${sec.bg_gradient_start}, ${sec.bg_gradient_end})`;
  } else if (sec.bg_gradient_start) {
    style.backgroundColor = sec.bg_gradient_start;
  }

  let radiusClass = '';
  if (sec.card_style === 'rounded-full') radiusClass = 'rounded-3xl';
  else if (sec.card_style === 'rounded-2xl') radiusClass = 'rounded-2xl';
  else if (sec.card_style === 'rounded-lg') radiusClass = 'rounded-lg';
  else if (sec.card_style === 'rounded-none') radiusClass = 'rounded-none';

  const combinedStyle: React.CSSProperties = { ...style, ...customVars as any };

  return (
    <section
      id={id}
      data-section-key={sectionKey}
      data-section-shape={sec.particle_shape}
      style={combinedStyle}
      className={`relative transition-all duration-500 ${radiusClass} ${className}`}
    >
      {sec.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: `[data-section-key="${sectionKey}"] { ${sec.custom_css} }` }} />
      )}
      {children}
    </section>
  );
};

export default ThemedSection;
