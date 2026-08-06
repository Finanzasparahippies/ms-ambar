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

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/music/config/')) {
        return Promise.resolve({ data: mockConfigData });
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
      expect(screen.getByTitle(/Spotify Playlist Oficial Ms Ambar/i)).toBeInTheDocument();
      expect(screen.getByTitle(/YouTube Videografía Oficial Ms Ambar/i)).toBeInTheDocument();
    });

    const spotifyIframe = screen.getByTitle(/Spotify Playlist Oficial Ms Ambar/i);
    expect(spotifyIframe).toHaveAttribute('src', expect.stringContaining('4SIS3MJKl1MVuumtycPU22'));
    expect(spotifyIframe).toHaveAttribute('loading', 'lazy');

    const youtubeIframe = screen.getByTitle(/YouTube Videografía Oficial Ms Ambar/i);
    expect(youtubeIframe).toHaveAttribute('src', expect.stringContaining('PL1imJPq1V79Q72PCZk8bIBwQWW30a0fIP'));
    expect(youtubeIframe).toHaveAttribute('loading', 'lazy');
  });
});

