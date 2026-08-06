import React, { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Share2, Disc, Youtube, Music, RefreshCw, Volume2, Sparkles } from 'lucide-react';
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

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&q=80';

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
        // Normalize title: rename "Sinfonías de Ámbar" or "Sinfonías de Ambar" to "Ms Ambar Aleatorio"
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
  }, [activeTrack, isPlaying]);

  // Filter valid albums that contain tracks to hide secondary placeholders
  const activeAlbums = albums.filter((alb) => alb.tracks && alb.tracks.length > 0);

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
              No hay lanzamientos cargados en este momento. Haz clic en sincronizar para buscar metadatos en las plataformas oficiales de streaming.
            </p>
            <button
              onClick={handleSyncPlatform}
              disabled={syncing}
              className="bg-amber-honey text-black hover:bg-amber-gold border border-amber-honey px-8 py-4 rounded-full text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2.5 transition-all hover:scale-105 shadow-xl shadow-amber-honey/20 disabled:opacity-50"
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Sincronizando Plataformas...' : 'Sincronizar Ahora'}
            </button>
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
                      <span className="text-amber-honey text-xs font-black tracking-[0.4em] mb-2 block uppercase opacity-70">
                        Álbum Oficial • {album.tracks?.length || 0} Pistas
                      </span>
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
              );
            })}
          </div>
        )}
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
