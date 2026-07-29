import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import { EventThemeContextProvider, useEventTheme } from '../context/EventThemeContext';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const TestComponent = () => {
  const { theme, loading } = useEventTheme();
  if (loading) return <div>Cargando tema...</div>;
  return (
    <div>
      <span data-testid="primary-color">{theme.primaryColor}</span>
      <span data-testid="particle-shape">{theme.particleShape}</span>
      <span data-testid="card-style">{theme.cardStyle}</span>
    </div>
  );
};

describe('EventThemeContext Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('debe cargar y aplicar los colores y configuración del tema por defecto', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        primary_color: '#E5A93B',
        secondary_color: '#22A6B7',
        background_start: '#080c0a',
        background_end: '#040605',
        accent_color: '#9F2B00',
        card_background: '#0c0f0d',
        text_color: '#F4F6F0',
        particle_shape: 'moon',
        card_style: 'rounded-full',
        background_pattern: 'stars',
        font_preset: 'cormorant',
        custom_css: '',
      },
    });

    render(
      <EventThemeContextProvider>
        <TestComponent />
      </EventThemeContextProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('primary-color')).toHaveTextContent('#E5A93B');
      expect(screen.getByTestId('particle-shape')).toHaveTextContent('moon');
      expect(screen.getByTestId('card-style')).toHaveTextContent('rounded-full');
    });

    // Check DOM root CSS properties & data attributes
    expect(document.documentElement.getAttribute('data-theme-shape')).toBe('moon');
    expect(document.documentElement.getAttribute('data-theme-card-style')).toBe('rounded-full');
  });

  test('debe aplicar la personalización específica por evento cuando se modifica la API', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        primary_color: '#FF0055',
        secondary_color: '#00E5FF',
        background_start: '#0f051d',
        background_end: '#05010a',
        accent_color: '#FF0055',
        card_background: '#190a2e',
        text_color: '#FFFFFF',
        particle_shape: 'cactus',
        card_style: 'rounded-2xl',
        background_pattern: 'grid',
        font_preset: 'outfit',
        custom_css: '.hero { opacity: 0.9; }',
      },
    });

    render(
      <EventThemeContextProvider>
        <TestComponent />
      </EventThemeContextProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('primary-color')).toHaveTextContent('#FF0055');
      expect(screen.getByTestId('particle-shape')).toHaveTextContent('cactus');
      expect(screen.getByTestId('card-style')).toHaveTextContent('rounded-2xl');
    });

    expect(document.documentElement.getAttribute('data-theme-shape')).toBe('cactus');
    expect(document.documentElement.getAttribute('data-theme-card-style')).toBe('rounded-2xl');
  });
});
