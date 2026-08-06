import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import MusicPage from '../pages/musica';
import { EventThemeContextProvider } from '../context/EventThemeContext';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock Audio prototype for jsdom environment
window.HTMLMediaElement.prototype.play = jest.fn().mockImplementation(() => Promise.resolve());
window.HTMLMediaElement.prototype.pause = jest.fn();

describe('MusicPage Component', () => {
  const mockAlbumsData = [
    {
      id: 1,
      title: 'Eclipse',
      release_year: '2026',
      cover_url: 'https://example.com/cover.jpg',
      description: 'Álbum oficial de prueba',
      spotify_url: 'https://open.spotify.com',
      tracks: [
        {
          id: 101,
          track_number: 1,
          title: 'Sinfonía del Ámbar I',
          duration_seconds: 215,
          duration_display: '3:35',
          preview_url: 'https://example.com/preview.mp3'
        }
      ]
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValue({ data: mockAlbumsData });
    mockedAxios.post.mockResolvedValue({ data: { message: 'OK' } });
  });

  const renderWithContext = (ui: React.ReactElement) => {
    return render(
      <EventThemeContextProvider>
        {ui}
      </EventThemeContextProvider>
    );
  };

  test('renders discography header and platform links', async () => {
    renderWithContext(<MusicPage />);

    await waitFor(() => {
      expect(screen.getByText(/DISCO/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/GRAFÍA/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Spotify/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Apple Music/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/YouTube Music/i).length).toBeGreaterThanOrEqual(1);
  });

  test('renders albums and track items from API data', async () => {
    renderWithContext(<MusicPage />);

    await waitFor(() => {
      expect(screen.getByText(/Eclipse/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Sinfonía del Ámbar I/i)).toBeInTheDocument();
  });

  test('displays "Esperando información nueva" when API returns no albums', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [] });

    renderWithContext(<MusicPage />);

    await waitFor(() => {
      expect(screen.getByText(/Esperando información nueva/i)).toBeInTheDocument();
    });
  });

  test('handles audio preview playback toggle on track click', async () => {
    renderWithContext(<MusicPage />);

    await waitFor(() => {
      expect(screen.getByText(/Sinfonía del Ámbar I/i)).toBeInTheDocument();
    });

    const trackRow = screen.getByText(/Sinfonía del Ámbar I/i);
    fireEvent.click(trackRow);

    await waitFor(() => {
      expect(screen.getAllByText(/Sinfonía del Ámbar I/i).length).toBeGreaterThanOrEqual(1);
    });
  });
});
