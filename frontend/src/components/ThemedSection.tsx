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
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  if (cleanHex.length !== 6) return undefined;
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return undefined;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r} ${g} ${b}`;
}

export const ThemedSection: React.FC<ThemedSectionProps> = ({
  sectionKey,
  className = '',
  children,
  id,
}) => {
  const { 
    style: hookStyle, bgColor, bgGradient, headingColor, textColor, accentColor, 
    cardBg, cardBoxShadow, borderColor, borderWidth, borderOpacity, borderStylePreset, 
    buttonBg, buttonText, spec 
  } = useSectionTheme(sectionKey);

  const customVars: Record<string, string> = {
    [`--sec-${sectionKey}-bg`]: bgColor,
    [`--sec-${sectionKey}-gradient`]: bgGradient || '',
    [`--sec-${sectionKey}-heading`]: headingColor,
    [`--sec-${sectionKey}-text`]: textColor,
    [`--sec-${sectionKey}-accent`]: accentColor,
    [`--sec-${sectionKey}-card-bg`]: cardBg,
    [`--sec-${sectionKey}-shadow`]: cardBoxShadow || '',
    [`--sec-${sectionKey}-border`]: borderColor || 'rgb(229 169 59 / 0.25)',
    [`--sec-${sectionKey}-border-width`]: borderWidth || '1px',
    [`--sec-${sectionKey}-border-opacity`]: String(borderOpacity ?? 0.25),
    [`--sec-${sectionKey}-border-style`]: borderStylePreset || 'solid',
    [`--sec-${sectionKey}-button-bg`]: buttonBg,
    [`--sec-${sectionKey}-button-text`]: buttonText,
    '--primary-color': accentColor,
    '--accent-color': accentColor,
    '--card-bg': cardBg,
    '--text-color': textColor,
    '--heading-color': headingColor,
    '--button-bg': buttonBg,
    '--button-text': buttonText,
    '--border-color': borderColor || 'rgb(229 169 59 / 0.25)',
  };

  const rgbPrimary = hexToRgb(accentColor || headingColor);
  if (rgbPrimary) {
    customVars['--amber-primary'] = rgbPrimary;
    customVars['--color-primary-rgb'] = rgbPrimary;
    customVars['--color-accent-rgb'] = rgbPrimary;
    customVars['--color-honey-rgb'] = rgbPrimary;
  }

  const rgbText = hexToRgb(textColor);
  if (rgbText) {
    customVars['--foreground-rgb'] = rgbText;
    customVars['--color-text-rgb'] = rgbText;
  }

  const rgbCard = hexToRgb(cardBg);
  if (rgbCard) {
    customVars['--color-card-rgb'] = rgbCard;
  }

  let radiusClass = '';
  if (spec.card_style === 'rounded-full') radiusClass = 'rounded-3xl';
  else if (spec.card_style === 'rounded-2xl') radiusClass = 'rounded-2xl';
  else if (spec.card_style === 'rounded-lg') radiusClass = 'rounded-lg';
  else if (spec.card_style === 'rounded-none') radiusClass = 'rounded-none';

  const isFooter = sectionKey === 'footer';
  const effectiveAnimation = isFooter ? 'none' : (spec.animation_preset || 'none');
  const safeTextColor = textColor || '#F4F6F0';
  const safeHeadingColor = headingColor || '#FFFFFF';

  const combinedStyle: React.CSSProperties = {
    backgroundColor: bgColor,
    backgroundImage: bgGradient || undefined,
    boxShadow: cardBoxShadow || undefined,
    color: safeTextColor,
    borderColor: borderColor,
    borderWidth: borderWidth,
    borderStyle: borderStylePreset === 'glass' ? 'solid' : borderStylePreset,
    ...(isFooter ? { transform: 'none', animation: 'none' } : {}),
    ...customVars as any
  };

  return (
    <section
      id={id}
      data-section-key={sectionKey}
      data-section-shape={spec.particle_shape}
      data-section-animation={effectiveAnimation}
      data-section-image-filter={spec.image_filter || 'none'}
      style={combinedStyle}
      className={`relative transition-colors duration-300 ${radiusClass} ${isFooter ? 'isolation-auto !transform-none !animate-none' : ''} ${className}`}
    >
      {spec.image_filter && spec.image_filter !== 'none' && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              [data-section-key="${sectionKey}"] img {
                ${spec.image_filter === 'grayscale' ? 'filter: grayscale(100%);' : ''}
                ${spec.image_filter === 'sepia' ? 'filter: sepia(85%);' : ''}
                ${spec.image_filter === 'glow-amber' ? 'filter: drop-shadow(0 0 30px rgba(229, 169, 59, 0.5));' : ''}
                ${spec.image_filter === 'contrast' ? 'filter: contrast(125%) brightness(105%);' : ''}
              }
            `
          }}
        />
      )}
      {spec.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: `[data-section-key="${sectionKey}"] { ${spec.custom_css} }` }} />
      )}
      {children}
    </section>
  );
};

export default ThemedSection;
