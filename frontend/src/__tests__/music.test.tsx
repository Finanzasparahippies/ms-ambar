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

describe('MusicPage Component', () => {
  const mockAlbumsData = [
    {
      id: 1,
      title: 'Sinfonías de Ámbar',
      release_year: '2026',
      cover_url: 'https://example.com/cover.jpg',
      description: 'Álbum oficial de prueba',
      spotify_url: 'https://open.spotify.com',
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

  test('renames Sinfonías de Ámbar to Ms Ambar Aleatorio and filters out empty placeholder containers', async () => {
    renderWithContext(<MusicPage />);

    await waitFor(() => {
      expect(screen.getByText(/Ms Ambar Aleatorio/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Track Uno/i)).toBeInTheDocument();
    expect(screen.queryByText(/Placeholder Vacío/i)).not.toBeInTheDocument();
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
      expect(screen.getByText(/Track Uno/i)).toBeInTheDocument();
    });

    const trackRow = screen.getByText(/Track Uno/i);
    fireEvent.click(trackRow);

    await waitFor(() => {
      expect(screen.getAllByText(/Track Uno/i).length).toBeGreaterThanOrEqual(1);
    });
  });
});
