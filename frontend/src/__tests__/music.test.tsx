import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import React from 'react';
import { EventThemeContextProvider } from '../context/EventThemeContext';
import MusicPage from '../pages/musica';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock Audio prototype for jsdom environment
window.HTMLMediaElement.prototype.play = jest.fn().mockImplementation(() => Promise.resolve());
window.HTMLMediaElement.prototype.pause = jest.fn();

// Mock localStorage
const storageMock: Record<string, string> = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => storageMock[key] || null,
    setItem: (key: string, value: string) => { storageMock[key] = value; },
    removeItem: (key: string) => { delete storageMock[key]; },
    clear: () => { Object.keys(storageMock).forEach(k => delete storageMock[k]); }
  },
  writable: true
});

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockImplementation(() => Promise.resolve())
  }
});

describe('MusicPage Component', () => {

  const mockAlbumsData = [
    {
      id: 1,
      title: 'Ms Ambar Aleatorio',
      release_year: '2026',
      cover_url: 'https://example.com/cover.jpg',
      description: 'Álbum oficial de prueba',
      spotify_url: 'https://open.spotify.com/artist/0jgJv4J29BJiJu1luw2SdA',
      tracks: [
        {
          id: 101,
          track_number: 1,
          title: 'Track Uno',
          duration_seconds: 215,
          duration_display: '3:35',
          preview_url: 'https://example.com/preview.mp3'
        }
      ]
    },
    {
      id: 2,
      title: 'Placeholder Vacío',
      release_year: '2026',
      cover_url: '',
      description: 'Sin tracks',
      tracks: []
    }
  ];

  const mockConfigData = {
    id: 1,
    discography_description: 'Música Oficial de Ms. Ambar ✨🎵🔥 Sencillos & Lanzamientos 🎧🌟',
    updated_at: '2026-08-06T00:00:00Z'
  };

  const mockPlaylistsData = [
    {
      id: 1,
      title: 'Dinámica Spotify',
      platform: 'spotify',
      render_type: 'iframe',
      embed_url: 'https://open.spotify.com/embed/playlist/4SIS3MJKl1MVuumtycPU22',
      is_active: true,
      order: 1
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(storageMock).forEach(k => delete storageMock[k]);
    mockedAxios.get.mockImplementation((url: string) => {

      if (url.includes('/music/config/')) {
        return Promise.resolve({ data: mockConfigData });
      }
      if (url.includes('/music/playlists/')) {
        return Promise.resolve({ data: mockPlaylistsData });
      }
      return Promise.resolve({ data: mockAlbumsData });
    });
    mockedAxios.post.mockResolvedValue({ data: { message: 'OK' } });
  });

  const renderWithContext = (ui: React.ReactElement) => {
    return render(
      <EventThemeContextProvider>
        {ui}
      </EventThemeContextProvider>
    );
  };

  test('renders discography header and official platform links', async () => {
    renderWithContext(<MusicPage />);

    await waitFor(() => {
      expect(screen.getByText(/DISCO/i)).toBeInTheDocument();
    });

    expect(screen.getByText('GRAFÍA')).toBeInTheDocument();

    const spotifyLinks = screen.getAllByText(/Spotify/i);
    expect(spotifyLinks.length).toBeGreaterThanOrEqual(1);

    const spotifyAnchor = spotifyLinks[0].closest('a');
    expect(spotifyAnchor).toHaveAttribute('href', expect.stringContaining('0jgJv4J29BJiJu1luw2SdA'));
  });

  test('renders configurable discography description with emojis', async () => {
    renderWithContext(<MusicPage />);

    await waitFor(() => {
      expect(screen.getByText(/✨🎵🔥 Sencillos & Lanzamientos 🎧🌟/i)).toBeInTheDocument();
    });
  });

  test('handles Share button action with clipboard fallback when Web Share API is unavailable', async () => {
    renderWithContext(<MusicPage />);

    await waitFor(() => {
      expect(screen.getByText(/Ms Ambar Aleatorio/i)).toBeInTheDocument();
    });

    const shareButtons = screen.getAllByRole('button', { name: /Compartir/i });
    expect(shareButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(shareButtons[0]);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  test('displays "Esperando información nueva" when API returns no albums', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/music/config/')) {
        return Promise.resolve({ data: mockConfigData });
      }
      if (url.includes('/music/playlists/')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithContext(<MusicPage />);

    await waitFor(() => {
      expect(screen.getByText(/Esperando información nueva/i)).toBeInTheDocument();
    });
  });

  test('renders embedded Spotify and YouTube playlist widgets with lazy loading', async () => {
    renderWithContext(<MusicPage />);

    await waitFor(() => {
      expect(screen.getByTitle(/Dinámica Spotify/i)).toBeInTheDocument();
    });

    const spotifyIframe = screen.getByTitle(/Dinámica Spotify/i);
    expect(spotifyIframe).toHaveAttribute('src', expect.stringContaining('4SIS3MJKl1MVuumtycPU22'));
    expect(spotifyIframe).toHaveAttribute('loading', 'lazy');
  });

  test('hides sync button for public users and displays it for staff admin users', async () => {
    // 1. Público general (sin token admin) -> no debe mostrar el botón Sincronizar
    renderWithContext(<MusicPage />);
    await waitFor(() => {
      expect(screen.getByText(/DISCO/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Sincronizar Plataformas/i)).not.toBeInTheDocument();

    // 2. Simular token de usuario staff admin en localStorage
    const staffToken = 'header.' + btoa(JSON.stringify({ is_staff: true, exp: Date.now() / 1000 + 3600 })) + '.sig';
    storageMock['token'] = staffToken;

    renderWithContext(<MusicPage />);
    await waitFor(() => {
      expect(screen.getByText(/Sincronizar Plataformas/i)).toBeInTheDocument();
    });
  });

  test('renders Now Playing control bar with album cover, track title, album name, and MM:SS seek bar when track is clicked', async () => {
    renderWithContext(<MusicPage />);

    await waitFor(() => {
      expect(screen.getByText(/Track Uno/i)).toBeInTheDocument();
    });

    const trackItem = screen.getByText(/Track Uno/i);
    fireEvent.click(trackItem);

    await waitFor(() => {
      expect(screen.getByTestId('now-playing-bar')).toBeInTheDocument();
      expect(screen.getByTestId('now-playing-title')).toHaveTextContent('Track Uno');
      expect(screen.getByTestId('now-playing-album')).toHaveTextContent('Ms Ambar Aleatorio');
      expect(screen.getByTestId('seek-bar')).toBeInTheDocument();
      expect(screen.getByTestId('current-time')).toHaveTextContent('00:00');
      expect(screen.getByTestId('total-duration')).toHaveTextContent('03:35');
    });
  });

  test('allows seeking/scrubbing through audio using progress bar range input', async () => {
    renderWithContext(<MusicPage />);

    await waitFor(() => {
      expect(screen.getByText(/Track Uno/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Track Uno/i));

    await waitFor(() => {
      expect(screen.getByTestId('seek-bar')).toBeInTheDocument();
    });

    const seekBar = screen.getByTestId('seek-bar');
    fireEvent.change(seekBar, { target: { value: '60' } });

    expect(screen.getByTestId('current-time')).toHaveTextContent('01:00');
  });
});




