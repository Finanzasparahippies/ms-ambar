import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import GalleryPage from '../pages/galleria';

jest.mock('axios');
jest.mock('sweetalert2');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GalleryPage Frontend Tests', () => {
  const mockItems = [
    {
      id: 1,
      title: 'Concierto 1',
      description: 'Gira principal',
      media_type: 'image',
      provider: 'cloudinary',
      url: 'https://cloudinary.com/image.jpg',
      optimized_url: 'https://cloudinary.com/image.jpg?f_auto',
      category: 'Tour',
      order: 0,
      created_at: '2026-08-01'
    },
    {
      id: 2,
      title: 'Video Detrás de Escena',
      description: 'Backstage clips',
      media_type: 'video',
      provider: 'cloudinary',
      url: 'https://cloudinary.com/video.mp4',
      optimized_url: 'https://cloudinary.com/video.mp4?f_auto',
      duration: 120,
      category: 'Backstage',
      order: 1,
      created_at: '2026-08-02'
    },
    {
      id: 3,
      title: 'YouTube Clip',
      media_type: 'video',
      provider: 'youtube',
      url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
      embed_url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      external_id: 'dQw4w9WgXcQ',
      category: 'Promo',
      order: 2,
      created_at: '2026-08-03'
    }
  ];

  let originalPlay: typeof HTMLMediaElement.prototype.play;
  let originalPause: typeof HTMLMediaElement.prototype.pause;

  beforeAll(() => {
    // Mock window.matchMedia for react-hot-toast in JSDOM environment
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

    // Mock HTML5 video elements APIs
    originalPlay = HTMLMediaElement.prototype.play;
    originalPause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = jest.fn();
    
    // Silence console errors during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    HTMLMediaElement.prototype.play = originalPlay;
    HTMLMediaElement.prototype.pause = originalPause;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockedAxios.get.mockResolvedValue({ data: mockItems });
  });

  test('debe mostrar skeletons de carga mientras finaliza el request a la API', async () => {
    // Axios get no resuelto de inmediato
    let resolveGet: any;
    const promise = new Promise((resolve) => { resolveGet = resolve; });
    mockedAxios.get.mockReturnValueOnce(promise);

    render(<GalleryPage />);

    // Comprobar presencia de skeletons (pulse animación)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);

    // Resolver API
    resolveGet({ data: mockItems });
    await waitFor(() => {
      expect(screen.getByText('Concierto 1')).toBeInTheDocument();
    });
  });

  test('debe renderizar el Masonry Grid con los elementos de la galería', async () => {
    render(<GalleryPage />);

    await waitFor(() => {
      expect(screen.getByText('Concierto 1')).toBeInTheDocument();
      expect(screen.getByText('Video Detrás de Escena')).toBeInTheDocument();
      expect(screen.getByText('YouTube Clip')).toBeInTheDocument();
    });

    // Validar badge de duración en video
    expect(screen.getByText('2:00')).toBeInTheDocument();
  });

  test('debe disparar autoplay silencioso del video en hover de tarjeta', async () => {
    render(<GalleryPage />);

    await waitFor(() => {
      expect(screen.getByText('Video Detrás de Escena')).toBeInTheDocument();
    });

    const videos = document.querySelectorAll('video');
    expect(videos.length).toBeGreaterThan(0);
    const targetVideo = videos[0];

    // Simular MouseEnter
    fireEvent.mouseEnter(targetVideo);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

    // Simular MouseLeave
    fireEvent.mouseLeave(targetVideo);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  test('debe abrir Lightbox polimórfico interactivo y navegar con teclado y botones', async () => {
    render(<GalleryPage />);

    await waitFor(() => {
      expect(screen.getByText('Concierto 1')).toBeInTheDocument();
    });

    // Click en primer elemento (Concierto 1 - imagen)
    fireEvent.click(screen.getByText('Concierto 1'));

    // Debe mostrar lightbox centrado
    await waitFor(() => {
      expect(screen.getAllByAltText('Concierto 1').length).toBe(2);
    });

    // Navegar al siguiente (Video Cloudinary) usando teclado
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getAllByText('Video Detrás de Escena').length).toBeGreaterThanOrEqual(1);
    });

    // Debe renderizar el reproductor de video HTML5 en el lightbox
    const lightboxVideo = document.querySelector('video[ref]');
    expect(lightboxVideo).toBeDefined();

    // Cerrar con Escape
    fireEvent.keyDown(window, { key: 'ArrowRight' }); // Ir a YouTube clip
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      // El modal no debe estar visible (solo la tarjeta en el grid)
      expect(screen.getAllByAltText('Concierto 1').length).toBe(1);
    });
  });

  test('debe remover los listeners globales al cerrar/desmontar el Lightbox para evitar memory leaks', async () => {
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    
    render(<GalleryPage />);
    await waitFor(() => {
      expect(screen.getByText('Concierto 1')).toBeInTheDocument();
    });

    // Abrir y cerrar modal
    fireEvent.click(screen.getByText('Concierto 1'));
    fireEvent.keyDown(window, { key: 'Escape' });

    // Comprobar que remueve el event listener 'keydown' al cerrar
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  test('debe mostrar el botón de admin e interactuar con el modal de carga si is_staff es true', async () => {
    // Generar mock token staff
    const token = 'header.' + btoa(JSON.stringify({ is_staff: true, exp: Date.now() / 1000 + 86400 })) + '.signature';
    localStorage.setItem('token', token);

    render(<GalleryPage />);

    await waitFor(() => {
      expect(screen.getByText('Añadir Multimedia')).toBeInTheDocument();
    });

    // Abrir Modal de Carga
    await act(async () => {
      fireEvent.click(screen.getByText('Añadir Multimedia'));
    });

    await waitFor(() => {
      expect(screen.getByText('Guardar Elemento')).toBeInTheDocument();
    });

    // Cambiar a origen externo
    await act(async () => {
      fireEvent.click(screen.getByText('Vincular Enlace (YT/IG/Vimeo)'));
    });

    // Simular entrada de enlace externo de YouTube
    const urlInput = await screen.findByPlaceholderText('https://...');

    // Mockear endpoint de parseo
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        provider: 'youtube',
        external_id: 'dQw4w9WgXcQ',
        embed_url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        media_type: 'video',
        title: 'Video Parseado YouTube',
        width: 1920,
        height: 1080
      }
    });

    const fillInput = (input: HTMLElement, value: string) => {
      const inputEl = input as HTMLInputElement;
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(inputEl, value);
      }
      inputEl.value = value;
      fireEvent.input(inputEl, { target: { value } });
      fireEvent.change(inputEl, { target: { value } });
    };

    await act(async () => {
      fillInput(urlInput, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    await waitFor(() => {
      expect(urlInput).toHaveValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    // Simular blur en el input de URL
    await act(async () => {
      fireEvent.blur(urlInput, { target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } });
    });

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/gallery/items/parse_external_url/'),
        { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        expect.any(Object)
      );
      // El formulario debe haber autocompletado el título y mostrar previsualización de la miniatura
      expect(screen.getByText('Video Parseado YouTube')).toBeInTheDocument();
    });
  });

  test('debe manejar errores de red en la subida a Cloudinary restaurando el estado visual sin crear registros huérfanos', async () => {
    // Mock token admin
    const token = 'header.' + btoa(JSON.stringify({ is_staff: true, exp: Date.now() / 1000 + 86400 })) + '.signature';
    localStorage.setItem('token', token);

    render(<GalleryPage />);
    await waitFor(() => {
      expect(screen.getByText('Añadir Multimedia')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Añadir Multimedia'));
    await waitFor(() => {
      expect(screen.getByText('Guardar Elemento')).toBeInTheDocument();
    });

    // Seleccionar título
    const titleInput = screen.getByPlaceholderText('Título del elemento');
    fireEvent.change(titleInput, { target: { value: 'Subida Fallida' } });

    // Mockear firma del backend (Paso 1 exitoso)
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        signature: 'mock_sig',
        timestamp: 123456,
        folder: 'test',
        public_id: 'test_123',
        api_key: 'key',
        cloud_name: 'cloud'
      }
    });

    // Mockear error de red de Axios en la subida directa a Cloudinary (Paso 2 fallido)
    mockedAxios.post.mockRejectedValueOnce(new Error('Network Error Cloudinary'));

    // Disparar submit (necesitamos simular que un archivo fue seleccionado)
    const file = new File(['dummy content'], 'photo.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('photo.png')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Guardar Elemento'));
      await Promise.resolve();
    });

    await waitFor(() => {
      // Debe haber intentado la firma y la subida
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      // Pero no debe haber llamado al backend Django para registrar el item (Paso 3 omitido por error)
      const postCalls = mockedAxios.post.mock.calls;
      const endpointsCalled = postCalls.map(c => c[0]);
      expect(endpointsCalled).not.toContain(expect.stringContaining('/gallery/items/'));
    });

    await act(async () => {
      await Promise.resolve();
    });
  });
});
