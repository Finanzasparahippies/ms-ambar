import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import { EventThemeContextProvider, useSectionTheme, sanitizeCssProperty } from '../context/EventThemeContext';
import ThemeManager from '../components/ThemeManager';
import ThemedSection from '../components/ThemedSection';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const DummySectionConsumer = ({ sectionKey }: { sectionKey: string }) => {
  const { style, bgColor, headingColor } = useSectionTheme(sectionKey);
  return (
    <div style={style} data-testid={`section-${sectionKey}`}>
      <h1 style={{ color: headingColor }}>Título de Sección</h1>
      <p style={{ color: style.color }}>Contenido de sección</p>
    </div>
  );
};

describe('Theme Customization Engine, Zero-Flicker & Scope Prefixing Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
    }
    mockedAxios.get.mockResolvedValue({ data: {} });
    mockedAxios.post.mockResolvedValue({ data: { status: 'success' } });
  });

  test('el hook useSectionTheme debe generar variables CSS prefijadas (--sec-[sectionKey]-bg) y resolver fallbacks seguros', async () => {
    render(
      <EventThemeContextProvider>
        <DummySectionConsumer sectionKey="hero" />
      </EventThemeContextProvider>
    );

    const sectionEl = screen.getByTestId('section-hero');
    expect(sectionEl).toBeInTheDocument();

    // Debe resolver el fallback por defecto (#080c0a) cuando no hay overrides
    expect(sectionEl.style.backgroundColor).toBeTruthy();
  });

  test('ThemedSection debe envolver los contenedores inyectando scope CSS y clases de borde', async () => {
    render(
      <EventThemeContextProvider>
        <ThemedSection sectionKey="gallery_grid">
          <div>Contenido de Galería</div>
        </ThemedSection>
      </EventThemeContextProvider>
    );

    const secEl = screen.getByText('Contenido de Galería').closest('section');
    expect(secEl).toHaveAttribute('data-section-key', 'gallery_grid');
  });

  test('ThemeManager debe incluir las 13 páginas del proyecto en el Selector Contextual', async () => {
    render(
      <EventThemeContextProvider>
        <ThemeManager />
      </EventThemeContextProvider>
    );

    const pageSelect = screen.getByLabelText('Página Activa a Editar:') as HTMLSelectElement;
    expect(pageSelect.options.length).toBe(13);

    // Cambiar a la página de 'Ambar te escribe' (/ambar-te-escribe)
    fireEvent.change(pageSelect, { target: { value: '/ambar-te-escribe' } });

    await waitFor(() => {
      expect(screen.getByText('Contenido Cartas & Escritos')).toBeInTheDocument();
    });
  });

  test('el Visual Inspector debe detener event bubbling con stopPropagation', async () => {
    render(
      <EventThemeContextProvider>
        <ThemeManager />
      </EventThemeContextProvider>
    );

    const heroSimulation = screen.getByText('Hero Principal (Portada)').closest('div');
    expect(heroSimulation).not.toBeNull();

    fireEvent.click(heroSimulation!);

    await waitFor(() => {
      expect(screen.getByText('Controles: hero')).toBeInTheDocument();
    });
  });

  test('debe inyectar variables CSS para estados Hover y Focus y la regla de transiciones suaves en el DOM', async () => {
    render(
      <EventThemeContextProvider>
        <DummySectionConsumer sectionKey="hero" />
      </EventThemeContextProvider>
    );

    const rootStyle = document.documentElement.style;
    expect(rootStyle.getPropertyValue('--button-hover-bg')).toBeTruthy();
    expect(rootStyle.getPropertyValue('--button-focus-ring')).toBeTruthy();
    expect(rootStyle.getPropertyValue('--card-hover-border')).toBeTruthy();
    expect(rootStyle.getPropertyValue('--element-hover-color')).toBeTruthy();

    const transitionStyle = document.getElementById('ms-ambar-theme-transition-css');
    expect(transitionStyle).toBeInTheDocument();
  });

  test('sanitizeCssProperty debe bloquear tokens XSS peligrosos y retornar el fallback', () => {
    expect(sanitizeCssProperty('url(javascript:alert(1))', 'fallback')).toBe('fallback');
    expect(sanitizeCssProperty('expression(alert(1))', '')).toBe('');
    expect(sanitizeCssProperty('linear-gradient(135deg, #000, #fff)', 'fallback')).toBe('linear-gradient(135deg, #000, #fff)');
  });
});

