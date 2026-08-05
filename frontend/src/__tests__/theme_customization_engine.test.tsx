import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import { EventThemeContextProvider } from '../context/EventThemeContext';
import ThemeManager from '../components/ThemeManager';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Theme Customization Engine & Visual Inspector Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockedAxios.get.mockResolvedValue({ data: {} });
    mockedAxios.post.mockResolvedValue({ data: { status: 'success' } });
  });

  test('debe renderizar el Selector Contextual de Páginas y actualizar las secciones correspondientes', async () => {
    render(
      <EventThemeContextProvider>
        <ThemeManager />
      </EventThemeContextProvider>
    );

    // Por defecto inicia en '/' (Landing Page)
    expect(screen.getByText('Hero Principal (Portada)')).toBeInTheDocument();

    // Cambiar selector contextual a '/galleria'
    const pageSelect = screen.getByLabelText('Página Activa a Editar:') as HTMLSelectElement;
    fireEvent.change(pageSelect, { target: { value: '/galleria' } });

    // La lista de secciones debe filtrarse automáticamente a las de Galería
    await waitFor(() => {
      expect(screen.getByText('Grilla Masonry Multimedia')).toBeInTheDocument();
      expect(screen.queryByText('Hero Principal (Portada)')).toBeNull();
    });
  });

  test('el Visual Inspector debe interceptar el click en el Canvas con stopPropagation y seleccionar la sección activa', async () => {
    render(
      <EventThemeContextProvider>
        <ThemeManager />
      </EventThemeContextProvider>
    );

    // Buscar en el Live Preview Canvas la sección simulada de Hero
    const heroSimulation = screen.getByText('Ms Ambar Live 2026').closest('div');
    expect(heroSimulation).not.toBeNull();

    // Disparar click en la simulación de Hero
    fireEvent.click(heroSimulation!);

    // Debe haber seleccionado 'hero' como sección activa y activado el modo 'section'
    await waitFor(() => {
      expect(screen.getByText('Controles: hero')).toBeInTheDocument();
    });
  });

  test('debe aplicar debouncing (16ms) e inyección en tiempo real en las variables CSS del DOM', async () => {
    render(
      <EventThemeContextProvider>
        <ThemeManager />
      </EventThemeContextProvider>
    );

    // Buscar el color picker primario
    const colorPickers = document.querySelectorAll('input[type="color"]');
    expect(colorPickers.length).toBeGreaterThan(0);
    const primaryPicker = colorPickers[0];

    // Cambiar color a Verde Neon (#00FF66)
    fireEvent.change(primaryPicker, { target: { value: '#00FF66' } });

    // Aguardar el debounce a 60FPS (~16ms)
    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--primary-color')).toBe('#00FF66');
    });
  });

  test('debe aplicar un Fallback Layout Preset y emitir console.warn si se ingresa una ruta no registrada', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <EventThemeContextProvider>
        <ThemeManager />
      </EventThemeContextProvider>
    );

    // Intentar forzar un cambio de estado a una ruta inexistente
    const pageSelect = screen.getByLabelText('Página Activa a Editar:') as HTMLSelectElement;
    
    // Agregamos una opción ficticia corrupta
    const option = document.createElement('option');
    option.value = '/ruta-corrupta-inexistente';
    option.text = 'Corrupta';
    pageSelect.appendChild(option);

    fireEvent.change(pageSelect, { target: { value: '/ruta-corrupta-inexistente' } });

    await waitFor(() => {
      // Debe haber advertido en consola sin colapsar la interfaz
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Ruta "/ruta-corrupta-inexistente" no registrada'));
      // Aplica fallback seguro
      expect(screen.getByText('Live Preview Canvas (Visual Inspector)')).toBeInTheDocument();
    });

    warnSpy.mockRestore();
  });
});
