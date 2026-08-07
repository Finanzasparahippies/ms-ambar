import React, { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Share2, Disc, Youtube, Music, RefreshCw, Volume2, Sparkles, Send } from 'lucide-react';
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
  itunes_id?: string;
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
  spotify_id?: string;
  youtube_id?: string;
  itunes_id?: string;
  tracks: TrackItem[];
}

export interface PlaylistItem {
  id: number;
  title: string;
  platform: 'spotify' | 'youtube' | 'apple_music' | 'amazon_music';
  render_type: 'iframe' | 'api_sync';
  embed_url: string;
  external_id?: string;
  description?: string;
  is_active: boolean;
  order: number;
}

class IframeErrorBoundary extends React.Component<
  { children: React.ReactNode; title: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; title: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.warn('[IframeErrorBoundary] Error al renderizar reproductor embebido:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="amber-glass border border-amber-honey/20 p-8 rounded-[2.5rem] text-center max-w-lg mx-auto flex flex-col items-center justify-center my-6 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-amber-honey/10 border border-amber-honey/30 flex items-center justify-center mb-3 text-amber-honey">
            <Disc size={24} className="animate-spin" />
          </div>
          <h4 className="text-sm font-black uppercase text-white tracking-tight mb-1">
            Reproductor no disponible
          </h4>
          <p className="text-[11px] font-mono opacity-60 text-amber-honey/80">
            No se pudo cargar el reproductor para "{this.props.title}". Verifica el enlace o intenta más tarde.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&q=80';

const OFFICIAL_LINKS = {
  youtube: 'https://www.youtube.com/c/ambarcarvajal',
  spotify: 'https://open.spotify.com/artist/0jgJv4J29BJiJu1luw2SdA',
  appleMusic: 'https://music.apple.com/us/artist/ms-ambar/1565253542',
  youtubeMusic: 'https://music.youtube.com/@Ms.AmbarOficial',
  amazonMusic: 'https://music.amazon.com/artists/B09S6TLQ5B/ms-ambar'
};

const AlbumCoverImage: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [imgSrc, setImgSrc] = useState<string>(src || DEFAULT_COVER);

  useEffect(() => {
    setImgSrc(src || DEFAULT_COVER);
  }, [src]);

  return (
    <img
      src={imgSrc}
      alt={alt}
      loading="lazy"
      onError={() => setImgSrc(DEFAULT_COVER)}
      className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
    />
  );
};

const MusicPage: React.FC = () => {
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [discographyDescription, setDiscographyDescription] = useState<string>(
    'Explora las resonancias místicas, producciones acústicas y sencillos oficiales de Ms. Ambar en todas las plataformas digitales ✨🎶'
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [activeTrack, setActiveTrack] = useState<TrackItem | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    checkAdminStatus();
    fetchAlbums();
    fetchMusicConfig();
    fetchPlaylists();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const checkAdminStatus = () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64));
        if (payload && payload.is_staff && !(payload.exp && Date.now() / 1000 > payload.exp)) {
          setIsAdmin(true);
          return;
        }
      } catch (e) { }
    }
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u && (u.is_staff || u.is_superuser)) {
          setIsAdmin(true);
        }
      } catch (e) { }
    }
  };


  const fetchPlaylists = async () => {
    try {
      const apiUrl = getApiUrl();
      const res = await axios.get(`${apiUrl}/music/playlists/`);
      if (res.data && Array.isArray(res.data)) {
        setPlaylists(res.data);
      }
    } catch (err) {
      console.warn('[MusicPage] Usando listas por defecto:', err);
    }
  };


  const fetchMusicConfig = async () => {
    try {
      const apiUrl = getApiUrl();
      const res = await axios.get(`${apiUrl}/music/config/`);
      if (res.data && res.data.discography_description) {
        setDiscographyDescription(res.data.discography_description);
      }
    } catch (err) {
      console.warn('[MusicPage] Usando descripción por defecto:', err);
    }
  };

  const fetchAlbums = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      const res = await axios.get(`${apiUrl}/music/albums/`);
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        const normalized = res.data.map((item: AlbumItem) => ({
          ...item,
          title: item.title?.includes('Sinfonías') ? 'Ms Ambar Aleatorio' : item.title
        }));
        setAlbums(normalized);
      } else {
        setAlbums([]);
      }
    } catch (err) {
      console.warn('[MusicPage] Error al obtener lanzamientos:', err);
      setAlbums([]);
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

  const handleSharePage = async (title?: string) => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://msambar.com/musica';
    const shareTitle = title ? `Ms Ambar - ${title}` : 'Ms Ambar | Discografía & Música Oficial';
    const shareText = discographyDescription || 'Escucha la música oficial de Ms Ambar ✨🎶';

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        showToast.success('¡Gracias por compartir la música! 🎵');
        return;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          await copyToClipboard(shareUrl);
        }
        return;
      }
    }
    await copyToClipboard(shareUrl);
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        showToast.success('¡Enlace copiado al portapapeles! 🎵');
      }
    } catch (err) {
      showToast.error('No se pudo copiar el enlace.');
    }
  };

  const toggleTrackPlayback = useCallback((track: TrackItem) => {
    if (!track.preview_url) {
      showToast.error('Vista previa no disponible para este tema.');
      return;
    }

    if (activeTrack?.id === track.id) {
      if (isPlaying && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else if (audioRef.current) {
        audioRef.current.play().catch(() => { });
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
  }, [activeTrack, isPlaying]);

  const FAKE_TITLES = ['Ambar Vision', 'Desierto de Cristal', 'Sinfonías de Ámbar', 'Placeholder Vacío'];

  // Filter valid albums that contain real tracks to hide secondary placeholders
  const activeAlbums = albums.filter((alb) => {
    if (!alb.tracks || alb.tracks.length === 0) return false;
    if (FAKE_TITLES.includes(alb.title)) return false;
    const hasOnlyFakeTracks = alb.tracks.every((trk) => trk.preview_url?.includes('soundhelix.com'));
    if (hasOnlyFakeTracks) return false;
    return true;
  });

  return (
    <ThemedSection sectionKey="musica" className="selection:bg-amber-honey/30 min-h-screen relative overflow-hidden">
      <Head>
        <title>Ms Ambar | Discografía & Música Oficial</title>
        <meta name="description" content="Explora la música y discografía oficial de Ms Ambar. Escucha lanzamientos en Spotify, Apple Music, YouTube Music y Amazon Music." />
      </Head>

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 pb-28 pt-10 relative z-10">
        <header className="mb-12 md:mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
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
              className="text-5xl sm:text-7xl md:text-[8vw] font-black tracking-tighter leading-[0.85] mb-6"
            >
              DISCO<span className="text-amber-honey text-glow">GRAFÍA</span>
            </motion.h1>

            {/* Configurable Discography Description with Emojis */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-base sm:text-lg md:text-xl font-medium leading-relaxed text-amber-honey/90 max-w-3xl mb-4 amber-glass p-5 rounded-2xl border border-amber-honey/20 shadow-lg"
            >
              {discographyDescription}
            </motion.p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleSharePage()}
              className="amber-glass border border-amber-honey/30 hover:border-amber-honey px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-honey/50 text-white hover:text-amber-honey"
              title="Compartir Discografía"
            >
              <Share2 size={14} className="text-amber-honey" /> Compartir
            </button>

            {isAdmin && (
              <button
                onClick={handleSyncPlatform}
                disabled={syncing}
                className="amber-glass border border-amber-honey/30 hover:border-amber-honey px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-honey/50 disabled:opacity-50"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin text-amber-honey' : ''} />
                {syncing ? 'Sincronizando APIs...' : 'Sincronizar Plataformas'}
              </button>
            )}
          </div>
        </header>

        {/* Global External Streaming Platform Selector Row with Official Links */}
        <div className="flex flex-wrap gap-3 sm:gap-4 mb-16">
          <a
            href={OFFICIAL_LINKS.spotify}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-amber-honey text-black hover:bg-amber-gold border border-amber-honey px-6 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2.5 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-honey/50 shadow-lg shadow-amber-honey/10"
          >
            <Play size={14} fill="currentColor" /> Spotify
          </a>
          <a
            href={OFFICIAL_LINKS.appleMusic}
            target="_blank"
            rel="noopener noreferrer"
            className="amber-glass border border-white/15 px-6 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2.5 hover:bg-white/10 hover:border-amber-honey/50 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-honey/50 text-white"
          >
            <Disc size={14} /> Apple Music
          </a>
          <a
            href={OFFICIAL_LINKS.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="amber-glass border border-white/15 px-6 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2.5 hover:bg-white/10 hover:border-amber-honey/50 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-honey/50 text-white"
          >
            <Youtube size={14} className="text-red-500" /> YouTube
          </a>
          <a
            href={OFFICIAL_LINKS.youtubeMusic}
            target="_blank"
            rel="noopener noreferrer"
            className="amber-glass border border-white/15 px-6 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2.5 hover:bg-white/10 hover:border-amber-honey/50 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-honey/50 text-white"
          >
            <Youtube size={14} className="text-red-500" /> YouTube Music
          </a>
          <a
            href={OFFICIAL_LINKS.amazonMusic}
            target="_blank"
            rel="noopener noreferrer"
            className="amber-glass border border-white/15 px-6 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2.5 hover:bg-white/10 hover:border-amber-honey/50 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-honey/50 text-white"
          >
            <Music size={14} className="text-cyan-400" /> Amazon Music
          </a>
        </div>

        {/* Albums Section or Empty State */}
        {!loading && activeAlbums.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="amber-glass border border-amber-honey/20 p-12 md:p-20 rounded-[3rem] text-center max-w-2xl mx-auto flex flex-col items-center justify-center my-16 shadow-2xl"
          >
            <div className="w-20 h-20 rounded-full bg-amber-honey/10 border border-amber-honey/30 flex items-center justify-center mb-6 text-amber-honey">
              <Disc size={40} className="animate-pulse" />
            </div>
            <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-3 text-white">
              Esperando información nueva
            </h3>
            <p className="opacity-60 text-sm max-w-md mb-8 leading-relaxed">
              No hay lanzamientos cargados en este momento.
            </p>
            {isAdmin && (
              <button
                onClick={handleSyncPlatform}
                disabled={syncing}
                className="bg-amber-honey text-black hover:bg-amber-gold border border-amber-honey px-8 py-4 rounded-full text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2.5 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-honey/50 shadow-xl shadow-amber-honey/20 disabled:opacity-50"
              >
                <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Sincronizando Plataformas...' : 'Sincronizar Ahora'}
              </button>
            )}
          </motion.div>

        ) : (
          <div className="space-y-24 md:space-y-36">
            {activeAlbums.map((album) => {
              const displayTitle = album.title?.includes('Sinfonías') ? 'Ms Ambar Aleatorio' : album.title;

              return (
                <motion.section
                  key={album.id}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="flex flex-col lg:flex-row items-stretch gap-10 lg:gap-16 amber-glass p-8 md:p-12 rounded-[3rem] border border-white/10"
                >
                  {/* Album Cover Container */}
                  <div className="w-full lg:w-5/12 relative group max-w-md mx-auto lg:max-w-none flex flex-col justify-between">
                    <div className="relative z-10 aspect-square rounded-[2.5rem] overflow-hidden border border-amber-honey/20 shadow-2xl">
                      <AlbumCoverImage src={album.cover_url} alt={displayTitle} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 pointer-events-none" />
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
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <span className="text-amber-honey text-xs font-black tracking-[0.4em] block uppercase opacity-70">
                          Álbum Oficial • {album.tracks?.length || 0} Pistas
                        </span>
                        <button
                          onClick={() => handleSharePage(displayTitle)}
                          className="amber-glass border border-white/15 hover:border-amber-honey px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all hover:scale-105 focus:outline-none text-white/80 hover:text-amber-honey"

                          title="Compartir álbum"
                        >
                          <Share2 size={12} /> Compartir
                        </button>
                      </div>

                      <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter mb-4 text-white">
                        {displayTitle}
                      </h2>
                      <p className="opacity-60 mb-8 text-sm md:text-base leading-relaxed">
                        {album.description}
                      </p>

                      {/* Tracklist Container */}
                      <div className="space-y-2 mb-8 max-h-[380px] overflow-y-auto custom-scroll pr-2">
                        {album.tracks.map((track) => {
                          const isCurrent = activeTrack?.id === track.id;
                          const isTrackPlaying = isCurrent && isPlaying;

                          return (
                            <div
                              key={track.id}
                              onClick={() => toggleTrackPlayback(track)}
                              className={`flex items-center justify-between py-3.5 px-5 rounded-2xl transition-all cursor-pointer border ${isCurrent
                                ? 'bg-amber-honey/20 border-amber-honey text-amber-honey font-bold shadow-lg shadow-amber-honey/10'
                                : 'bg-white/5 border-transparent hover:border-white/15 hover:bg-white/10 text-white/90'
                                }`}
                            >
                              <div className="flex items-center gap-4">
                                <button className="w-8 h-8 rounded-full bg-amber-honey/20 border border-amber-honey/40 flex items-center justify-center text-amber-honey focus:outline-none">
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
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSharePage(track.title);
                                  }}
                                  className="hover:text-amber-honey transition-colors focus:outline-none"
                                  title="Compartir pista"
                                >
                                  <Share2 size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Direct Official Platform Links Footer */}
                    <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-[10px] uppercase tracking-widest font-black text-amber-honey">
                      <span>Escuchar álbum completo en perfiles oficiales:</span>
                      <div className="flex items-center gap-3">
                        <a href={OFFICIAL_LINKS.spotify} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors focus:outline-none">
                          Spotify
                        </a>
                        <a href={OFFICIAL_LINKS.appleMusic} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors focus:outline-none">
                          Apple Music
                        </a>
                        <a href={OFFICIAL_LINKS.youtube} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors focus:outline-none">
                          YouTube
                        </a>
                      </div>
                    </div>
                    </div>
                  </motion.section>
                );
              })}
            </div>
          )}

          {/* Official Embedded Playlists & Video Widgets Section */}
          <motion.section
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-20 md:mt-28"
          >
            <div className="flex items-center gap-3 text-amber-honey text-xs font-black uppercase tracking-[0.4em] mb-3">
              <Sparkles size={16} /> DESCUBRE A MS AMBAR
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter text-white mb-8">
              PLAYLISTS & <span className="text-amber-honey text-glow">VIDEOS</span>
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 w-full">
              {playlists && playlists.length > 0 ? (
                playlists.map((pl) => (
                  <IframeErrorBoundary key={pl.id} title={pl.title}>
                    <div className="amber-glass border border-amber-honey/20 hover:border-amber-honey/40 transition-all p-4 sm:p-6 rounded-[2.5rem] shadow-2xl flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-3 mb-4 px-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${
                            pl.platform === 'spotify' ? 'bg-[#1DB954]/20 border-[#1DB954]/40 text-[#1DB954]' :
                            pl.platform === 'youtube' ? 'bg-red-600/20 border-red-500/40 text-red-500' :
                            pl.platform === 'apple_music' ? 'bg-pink-600/20 border-pink-500/40 text-pink-400' :
                            'bg-cyan-600/20 border-cyan-500/40 text-cyan-400'
                          }`}>
                            {pl.platform === 'spotify' ? <Play size={14} fill="currentColor" className="ml-0.5" /> :
                             pl.platform === 'youtube' ? <Youtube size={16} /> :
                             pl.platform === 'apple_music' ? <Disc size={16} /> :
                             <Music size={16} />}
                          </div>
                          <div>
                            <h3 className="text-sm font-black uppercase text-white tracking-tight">{pl.title}</h3>
                            <p className="text-[10px] font-mono text-amber-honey/70 uppercase">
                              {pl.description || `Ms. Ambar • ${pl.platform}`}
                            </p>
                          </div>
                        </div>
                        {pl.embed_url && (
                          <a
                            href={pl.embed_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-black uppercase tracking-wider text-amber-honey hover:text-white transition-colors focus:outline-none"
                          >
                            Abrir ↗
                          </a>
                        )}
                      </div>

                      {pl.render_type === 'iframe' && pl.embed_url ? (
                        <div className="w-full rounded-2xl overflow-hidden shadow-inner border border-white/10 bg-black/40 aspect-video lg:h-[352px]">
                          <iframe
                            src={pl.embed_url}
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            allowFullScreen
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; accelerometer; gyroscope; web-share"
                            loading="lazy"
                            title={pl.title}
                            className="w-full h-full rounded-2xl min-h-[220px] sm:min-h-[280px] lg:min-h-[352px]"
                          />
                        </div>
                      ) : (
                        <div className="w-full rounded-2xl p-6 border border-white/10 bg-black/30 text-center">
                          <p className="text-xs text-amber-honey font-mono uppercase">
                            Catálogo sincronizado por API ({pl.external_id || 'Global'})
                          </p>
                        </div>
                      )}
                    </div>
                  </IframeErrorBoundary>
                ))
              ) : (
                <>
                  {/* Spotify Official Playlist Widget Fallback */}
                  <IframeErrorBoundary title="Spotify Playlist">
                    <div className="amber-glass border border-amber-honey/20 hover:border-amber-honey/40 transition-all p-4 sm:p-6 rounded-[2.5rem] shadow-2xl flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-3 mb-4 px-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#1DB954]/20 border border-[#1DB954]/40 flex items-center justify-center text-[#1DB954]">
                            <Play size={14} fill="currentColor" className="ml-0.5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black uppercase text-white tracking-tight">Spotify Playlist</h3>
                            <p className="text-[10px] font-mono text-amber-honey/70 uppercase">Ms. Ambar • Selección Oficial</p>
                          </div>
                        </div>
                        <a
                          href={OFFICIAL_LINKS.spotify}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-black uppercase tracking-wider text-amber-honey hover:text-white transition-colors focus:outline-none"
                        >
                          Abrir en App ↗
                        </a>
                      </div>

                      <div className="w-full rounded-2xl overflow-hidden shadow-inner border border-white/10 bg-black/40">
                        <iframe
                          src="https://open.spotify.com/embed/playlist/4SIS3MJKl1MVuumtycPU22?utm_source=generator&si=917272ce4bf54736"
                          width="100%"
                          height="352"
                          frameBorder="0"
                          allowFullScreen
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          loading="lazy"
                          title="Spotify Playlist Oficial Ms Ambar"
                          className="w-full rounded-2xl min-h-[320px] sm:min-h-[352px]"
                        />
                      </div>
                    </div>
                  </IframeErrorBoundary>

                  {/* YouTube Official Video Series Widget Fallback */}
                  <IframeErrorBoundary title="YouTube Videografía">
                    <div className="amber-glass border border-amber-honey/20 hover:border-amber-honey/40 transition-all p-4 sm:p-6 rounded-[2.5rem] shadow-2xl flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-3 mb-4 px-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500">
                            <Youtube size={16} />
                          </div>
                          <div>
                            <h3 className="text-sm font-black uppercase text-white tracking-tight">YouTube Videografía</h3>
                            <p className="text-[10px] font-mono text-amber-honey/70 uppercase">Canal Oficial • Videos & Lives</p>
                          </div>
                        </div>
                        <a
                          href={OFFICIAL_LINKS.youtube}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-black uppercase tracking-wider text-amber-honey hover:text-white transition-colors focus:outline-none"
                        >
                          Ver en YouTube ↗
                        </a>
                      </div>

                      <div className="w-full rounded-2xl overflow-hidden shadow-inner border border-white/10 bg-black/40 aspect-video lg:h-[352px]">
                        <iframe
                          src="https://www.youtube.com/embed/videoseries?si=gPM5tQHCXG-Pcxpi&list=PL1imJPq1V79Q72PCZk8bIBwQWW30a0fIP"
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          loading="lazy"
                          title="YouTube Videografía Oficial Ms Ambar"
                          className="w-full h-full rounded-2xl min-h-[220px] sm:min-h-[280px] lg:min-h-[352px]"
                        />
                      </div>
                    </div>
                  </IframeErrorBoundary>
                </>
              )}
            </div>
          </motion.section>

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
                className="w-10 h-10 rounded-2xl bg-amber-honey text-black flex items-center justify-center hover:scale-105 transition-transform focus:outline-none"
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
