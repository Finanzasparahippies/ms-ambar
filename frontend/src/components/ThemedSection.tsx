import React from 'react';
import { useEventTheme } from '../context/EventThemeContext';

interface ThemedSectionProps {
  sectionKey: string;
  className?: string;
  children: React.ReactNode;
  id?: string;
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

  if (sec.bg_color) style.backgroundColor = sec.bg_color;
  if (sec.bg_gradient_start && sec.bg_gradient_end) {
    style.background = `linear-gradient(135deg, ${sec.bg_gradient_start}, ${sec.bg_gradient_end})`;
  }
  if (sec.text_color) style.color = sec.text_color;

  let radiusClass = '';
  if (sec.card_style === 'rounded-full') radiusClass = 'rounded-3xl';
  else if (sec.card_style === 'rounded-2xl') radiusClass = 'rounded-2xl';
  else if (sec.card_style === 'rounded-lg') radiusClass = 'rounded-lg';
  else if (sec.card_style === 'rounded-none') radiusClass = 'rounded-none';

  return (
    <section
      id={id}
      data-section-key={sectionKey}
      data-section-shape={sec.particle_shape}
      style={style}
      className={`relative transition-all duration-500 ${radiusClass} ${className}`}
    >
      {children}
    </section>
  );
};

export default ThemedSection;
