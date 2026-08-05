import React from 'react';
import { useEventTheme, useSectionTheme } from '../context/EventThemeContext';

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
  const { style: hookStyle, bgColor, headingColor, textColor, accentColor, cardBg, borderColor, buttonBg, buttonText, spec } = useSectionTheme(sectionKey);

  const customVars: Record<string, string> = {
    [`--sec-${sectionKey}-bg`]: bgColor,
    [`--sec-${sectionKey}-heading`]: headingColor,
    [`--sec-${sectionKey}-text`]: textColor,
    [`--sec-${sectionKey}-accent`]: accentColor,
    [`--sec-${sectionKey}-card-bg`]: cardBg,
    [`--sec-${sectionKey}-border`]: borderColor,
    [`--sec-${sectionKey}-button-bg`]: buttonBg,
    [`--sec-${sectionKey}-button-text`]: buttonText,
    '--primary-color': accentColor,
    '--accent-color': accentColor,
    '--card-bg': cardBg,
    '--text-color': textColor,
    '--heading-color': headingColor,
    '--button-bg': buttonBg,
    '--button-text': buttonText,
    '--border-color': borderColor,
  };

  const rgbPrimary = hexToRgb(accentColor);
  if (rgbPrimary) customVars['--amber-primary'] = rgbPrimary;

  const rgbText = hexToRgb(textColor);
  if (rgbText) customVars['--foreground-rgb'] = rgbText;

  let radiusClass = '';
  if (spec.card_style === 'rounded-full') radiusClass = 'rounded-3xl';
  else if (spec.card_style === 'rounded-2xl') radiusClass = 'rounded-2xl';
  else if (spec.card_style === 'rounded-lg') radiusClass = 'rounded-lg';
  else if (spec.card_style === 'rounded-none') radiusClass = 'rounded-none';

  const combinedStyle: React.CSSProperties = {
    backgroundColor: bgColor,
    color: textColor,
    borderColor: borderColor,
    ...customVars as any
  };

  return (
    <section
      id={id}
      data-section-key={sectionKey}
      data-section-shape={spec.particle_shape}
      data-section-animation={spec.animation_preset || 'none'}
      data-section-image-filter={spec.image_filter || 'none'}
      style={combinedStyle}
      className={`relative transition-colors duration-300 ${radiusClass} ${className}`}
    >
      {sec.image_filter && sec.image_filter !== 'none' && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              [data-section-key="${sectionKey}"] img {
                ${sec.image_filter === 'grayscale' ? 'filter: grayscale(100%);' : ''}
                ${sec.image_filter === 'sepia' ? 'filter: sepia(85%);' : ''}
                ${sec.image_filter === 'glow-amber' ? 'filter: drop-shadow(0 0 30px rgba(229, 169, 59, 0.5));' : ''}
                ${sec.image_filter === 'contrast' ? 'filter: contrast(125%) brightness(105%);' : ''}
              }
            `
          }}
        />
      )}
      {sec.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: `[data-section-key="${sectionKey}"] { ${sec.custom_css} }` }} />
      )}
      {children}
    </section>
  );
};

export default ThemedSection;
