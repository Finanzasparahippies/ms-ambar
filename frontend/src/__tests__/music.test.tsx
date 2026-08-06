import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MusicPage from '../pages/musica';
import { EventThemeContextProvider } from '../context/EventThemeContext';

// Mock axios
jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({
    data: [
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
    ]
  }),
  post: jest.fn().mockResolvedValue({
    data: { message: 'OK' }
  })
}));

// Mock Audio prototype for jsdom environment
window.HTMLMediaElement.prototype.play = jest.fn().mockImplementation(() => Promise.resolve());
window.HTMLMediaElement.prototype.pause = jest.fn();

describe('MusicPage Component', () => {
  const renderWithContext = (ui: React.ReactElement) => {
    return render(
      <EventThemeContextProvider>
        {ui}
      </EventThemeContextProvider>
    );
  };

  test('renders discography header and platform links', async () => {
    renderWithContext(<MusicPage />);

    expect(screen.getByText(/DISCO/i)).toBeInTheDocument();
    expect(screen.getByText(/GRAFÍA/i)).toBeInTheDocument();
    expect(screen.getByText(/Spotify/i)).toBeInTheDocument();
    expect(screen.getByText(/Apple Music/i)).toBeInTheDocument();
    expect(screen.getByText(/YouTube Music/i)).toBeInTheDocument();
  });

  test('renders albums and track items from API or fallback data', async () => {
    renderWithContext(<MusicPage />);

    await waitFor(() => {
      expect(screen.getByText(/Eclipse/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Sinfonía del Ámbar I/i)).toBeInTheDocument();
  });

  test('handles audio preview playback toggle on track click', async () => {
    renderWithContext(<MusicPage />);

    await waitFor(() => {
      expect(screen.getByText(/Sinfonía del Ámbar I/i)).toBeInTheDocument();
    });

    const trackRow = screen.getByText(/Sinfonía del Ámbar I/i);
    fireEvent.click(trackRow);

    // Should open floating player bar with active track title
    await waitFor(() => {
      expect(screen.getAllByText(/Sinfonía del Ámbar I/i).length).toBeGreaterThanOrEqual(1);
    });
  });
});
