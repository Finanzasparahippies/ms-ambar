import React, { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Share2, Disc, ExternalLink, Youtube, Music, RefreshCw, Volume2, Sparkles } from 'lucide-react';
import axios from 'axios';
import ThemedSection from '../components/ThemedSection';
import { getApiUrl } from '../lib/utils';
import { showToast } from '../lib/notifications';

interface TrackItem {
  id: number;
  track_number: number;
  title: string;
  duration_seconds: number;
  duration_display: string;
  preview_url?: string;
  spotify_id?: string;
  youtube_id?: string;
  is_single?: boolean;
}

interface AlbumItem {
  id: number;
  title: string;
  release_year: string;
  cover_url: string;
  description: string;
  spotify_url?: string;
  apple_music_url?: string;
  youtube_url?: string;
  youtube_music_url?: string;
  amazon_music_url?: string;
  tracks: TrackItem[];
}

const FALLBACK_ALBUMS: AlbumItem[] = [
  {
    id: 1,
    title: 'Eclipse',
    release_year: '2026',
    cover_url: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&q=80',
    description: 'Explorando texturas orgánicas y ritmos ancestrales, este álbum redefine el sonido contemporáneo de Ms Ambar.',
    spotify_url: 'https://open.spotify.com',
    apple_music_url: 'https://music.apple.com',
    youtube_url: 'https://youtube.com',
    youtube_music_url: 'https://music.youtube.com',
    amazon_music_url: 'https://music.amazon.com',
    tracks: [
      { id: 101, track_number: 1, title: 'Sinfonía del Ámbar I (Eclipse Intro)', duration_seconds: 215, duration_display: '3:35', preview_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
      { id: 102, track_number: 2, title: 'Luz de Luna en el Desierto', duration_seconds: 240, duration_display: '4:00', preview_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
      { id: 103, track_number: 3, title: 'Fuego Inextinguible', duration_seconds: 198, duration_display: '3:18', preview_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
      { id: 104, track_number: 4, title: 'Ecos del Silencio', duration_seconds: 225, duration_display: '3:45', preview_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
    ]
  },
  {
    id: 2,
    title: 'Ambar Vision',
    release_year: '2024',
    cover_url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&q=80',
    description: 'Una travesía audiovisual y conceptual que combina R&B alternativo con melodías envolventes.',
    spotify_url: 'https://open.spotify.com',
    apple_music_url: 'https://music.apple.com',
    youtube_url: 'https://youtube.com',
    youtube_music_url: 'https://music.youtube.com',
    amazon_music_url: 'https://music.amazon.com',
    tracks: [
      { id: 201, track_number: 1, title: 'Visión de Cristal', duration_seconds: 210, duration_display: '3:30', preview_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
      { id: 202, track_number: 2, title: 'No Te Voy a Llorar (Viña 2025 Live)', duration_seconds: 250, duration_display: '4:10', preview_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
      { id: 203, track_number: 3, title: '14•28 (Título Numerológico)', duration_seconds: 205, duration_display: '3:25', preview_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' },
    ]
  },
  {
    id: 3,
    title: 'Desierto de Cristal',
    release_year: '2023',
    cover_url: 'https://images.unsplash.com/photo-1514525253361-bee8a48790c3?w=800&q=80',
    description: 'Primeras resonancias acústicas de la cantautora originaria de Hermosillo, Sonora.',
    spotify_url: 'https://open.spotify.com',
    apple_music_url: 'https://music.apple.com',
    youtube_url: 'https://youtube.com',
    youtube_music_url: 'https://music.youtube.com',
    amazon_music_url: 'https://music.amazon.com',
    tracks: [
      { id: 301, track_number: 1, title: 'Cactus & Misticismo', duration_seconds: 180, duration_display: '3:00', preview_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
      { id: 302, track_number: 2, title: 'Bajo las Estrellas de Sonora', duration_seconds: 235, duration_display: '3:55', preview_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' },
    ]
  }
];

const MusicPage: React.FC = () => {
  const [albums, setAlbums] = useState<AlbumItem[]>(FALLBACK_ALBUMS);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [activeTrack, setActiveTrack] = useState<TrackItem | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchAlbums();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const fetchAlbums = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      const res = await axios.get(`${apiUrl}/music/albums/`);
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setAlbums(res.data);
      }
    } catch (err) {
      console.warn('[MusicPage] Usando discografía oficial por defecto:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncPlatform = async () => {
    try {
      setSyncing(true);
      const apiUrl = getApiUrl();
      const res = await axios.post(`${apiUrl}/music/sync/`, { query: 'Ms Ambar' });
      if (res.data) {
        showToast.success('Metadatos de plataformas sincronizados correctamente.');
        await fetchAlbums();
      }
    } catch (err) {
      showToast.error('Respuesta de respaldo aplicada tras reintento exponencial.');
    } finally {
      setSyncing(false);
    }
  };

  const toggleTrackPlayback = (track: TrackItem) => {
    if (!track.preview_url) {
      showToast.error('Vista previa no disponible para este tema.');
      return;
    }

    if (activeTrack?.id === track.id) {
      if (isPlaying && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else if (audioRef.current) {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const newAudio = new Audio(track.preview_url);
    audioRef.current = newAudio;
    setActiveTrack(track);
    setIsPlaying(true);

    newAudio.play().catch((err) => {
      console.warn('Playback error:', err);
      setIsPlaying(false);
    });

    newAudio.onended = () => {
      setIsPlaying(false);
    };
  };

  return (
    <ThemedSection sectionKey="musica" className="selection:bg-amber-honey/30 min-h-screen relative overflow-hidden">
      <Head>
        <title>Ms Ambar | Discografía & Música Oficial</title>
        <meta name="description" content="Explora la música y discografía oficial de Ms Ambar. Escucha lanzamientos en Spotify, Apple Music, YouTube Music y Amazon Music." />
      </Head>

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 pb-28 pt-10 relative z-10">
        <header className="mb-16 md:mb-28 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 text-amber-honey text-xs font-black uppercase tracking-[0.4em] mb-4"
            >
              <Sparkles size={16} /> Arte & Sonido Místico
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-5xl sm:text-7xl md:text-[8vw] font-black tracking-tighter leading-[0.85] mb-8"
            >
              DISCO<span className="text-amber-honey text-glow">GRAFÍA</span>
            </motion.h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSyncPlatform}
              disabled={syncing}
              className="amber-glass border border-amber-honey/30 hover:border-amber-honey px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 transition-all hover:scale-105 disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin text-amber-honey' : ''} />
              {syncing ? 'Sincronizando APIs...' : 'Sincronizar Plataformas'}
            </button>
          </div>
        </header>

        {/* Global External Streaming Platform Selector Row */}
        <div className="flex flex-wrap gap-3 sm:gap-4 mb-20">
          <a
            href="https://open.spotify.com"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-amber-honey text-black hover:bg-amber-gold border border-amber-honey px-6 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2.5 transition-all hover:scale-105 shadow-lg shadow-amber-honey/10"
          >
            <Play size={14} fill="currentColor" /> Spotify
          </a>
          <a
            href="https://music.apple.com"
            target="_blank"
            rel="noopener noreferrer"
            className="amber-glass border border-white/15 px-6 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2.5 hover:bg-white/10 transition-all hover:scale-105"
          >
            <Disc size={14} /> Apple Music
          </a>
          <a
            href="https://youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="amber-glass border border-white/15 px-6 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2.5 hover:bg-white/10 transition-all hover:scale-105"
          >
            <Youtube size={14} /> YouTube
          </a>
          <a
            href="https://music.youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="amber-glass border border-white/15 px-6 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2.5 hover:bg-white/10 transition-all hover:scale-105"
          >
            <Youtube size={14} className="text-red-500" /> YouTube Music
          </a>
          <a
            href="https://music.amazon.com"
            target="_blank"
            rel="noopener noreferrer"
            className="amber-glass border border-white/15 px-6 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2.5 hover:bg-white/10 transition-all hover:scale-105"
          >
            <Music size={14} className="text-cyan-400" /> Amazon Music
          </a>
        </div>

        {/* Albums and Tracklist Section */}
        <div className="space-y-24 md:space-y-36">
          {albums.map((album) => (
            <motion.section
              key={album.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-col lg:flex-row items-stretch gap-10 lg:gap-16 amber-glass p-8 md:p-12 rounded-[3rem] border border-white/10"
            >
              {/* Album Cover & Glow Container */}
              <div className="w-full lg:w-5/12 relative group max-w-md mx-auto lg:max-w-none flex flex-col justify-between">
                <div className="relative z-10 aspect-square rounded-[2.5rem] overflow-hidden border border-amber-honey/20 shadow-2xl">
                  <img
                    src={album.cover_url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&q=80'}
                    alt={album.title}
                    className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
                  <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                    <span className="text-amber-honey text-xs font-mono font-bold uppercase tracking-widest bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-amber-honey/30">
                      {album.release_year}
                    </span>
                  </div>
                </div>
              </div>

              {/* Album Details & Tracks List */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-amber-honey text-xs font-black tracking-[0.4em] mb-2 block uppercase opacity-70">
                    Álbum Oficial • {album.tracks?.length || 0} Pistas
                  </span>
                  <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter mb-4 text-white">
                    {album.title}
                  </h2>
                  <p className="opacity-60 mb-8 text-sm md:text-base leading-relaxed">
                    {album.description}
                  </p>

                  {/* Tracklist Container */}
                  <div className="space-y-2 mb-8 max-h-[380px] overflow-y-auto custom-scroll pr-2">
                    {(album.tracks || []).map((track) => {
                      const isCurrent = activeTrack?.id === track.id;
                      const isTrackPlaying = isCurrent && isPlaying;

                      return (
                        <div
                          key={track.id}
                          onClick={() => toggleTrackPlayback(track)}
                          className={`flex items-center justify-between py-3.5 px-5 rounded-2xl transition-all cursor-pointer border ${
                            isCurrent
                              ? 'bg-amber-honey/20 border-amber-honey text-amber-honey font-bold shadow-lg shadow-amber-honey/10'
                              : 'bg-white/5 border-transparent hover:border-white/15 hover:bg-white/10 text-white/90'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <button className="w-8 h-8 rounded-full bg-amber-honey/20 border border-amber-honey/40 flex items-center justify-center text-amber-honey">
                              {isTrackPlaying ? <Pause size={14} /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                            </button>
                            <span className="opacity-40 font-mono text-xs">
                              {track.track_number < 10 ? `0${track.track_number}` : track.track_number}
                            </span>
                            <span className="text-xs md:text-sm font-black tracking-tight uppercase">
                              {track.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-xs font-mono opacity-60">
                            <span>{track.duration_display || '3:30'}</span>
                            <Share2 size={14} className="hover:text-amber-honey transition-colors" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Direct Platform Links Footer */}
                <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-[10px] uppercase tracking-widest font-black text-amber-honey">
                  <span>Escuchar álbum completo en:</span>
                  <div className="flex items-center gap-3">
                    {album.spotify_url && (
                      <a href={album.spotify_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                        Spotify
                      </a>
                    )}
                    {album.apple_music_url && (
                      <a href={album.apple_music_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                        Apple Music
                      </a>
                    )}
                    {album.youtube_url && (
                      <a href={album.youtube_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                        YouTube
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.section>
          ))}
        </div>
      </div>

      {/* Floating Sticky Audio Player Control Bar */}
      <AnimatePresence>
        {activeTrack && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-6 right-6 md:left-auto md:right-10 md:w-96 z-[120] amber-glass p-4 rounded-3xl border border-amber-honey/40 shadow-2xl flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 truncate">
              <div className="w-10 h-10 rounded-2xl bg-amber-honey text-black flex items-center justify-center font-bold">
                <Volume2 size={20} className={isPlaying ? 'animate-bounce' : ''} />
              </div>
              <div className="truncate">
                <p className="text-xs font-black uppercase text-white truncate">{activeTrack.title}</p>
                <p className="text-[9px] font-mono text-amber-honey uppercase tracking-wider">Ms Ambar • Vista Previa</p>
              </div>
            </div>

            <button
              onClick={() => toggleTrackPlayback(activeTrack)}
              className="w-10 h-10 rounded-2xl bg-amber-honey text-black flex items-center justify-center hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </ThemedSection>
  );
};

export default MusicPage;
