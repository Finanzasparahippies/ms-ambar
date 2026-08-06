import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Camera,
  ChevronLeft, ChevronRight,
  Expand,
  Link2,
  Loader2,
  Maximize,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Volume2, VolumeX,
  X
} from 'lucide-react';
import Head from 'next/head';
import React, { useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import Swal from 'sweetalert2';
import ImageOptimizerWidget from '../components/ImageOptimizerWidget';
import { useSectionTheme } from '../context/EventThemeContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

interface GalleryItem {
  id: number;
  title: string;
  description?: string;
  media_type: 'image' | 'video';
  provider: 'cloudinary' | 'youtube' | 'instagram' | 'vimeo' | 'external';
  url: string;
  optimized_url?: string;
  streaming_url?: string;
  embed_url?: string;
  thumbnail_url?: string;
  external_id?: string;
  public_id?: string;
  width?: number;
  height?: number;
  duration?: number;
  category?: string;
  order: number;
  created_at: string;
}

/** Decodes a JWT payload client-side (no signature verification). */
function decodeJwt(token: string): Record<string, any> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

// Formatear duración de segundos a MM:SS
const formatDuration = (secs?: number) => {
  if (!secs) return '0:00';
  const minutes = Math.floor(secs / 60);
  const seconds = Math.floor(secs % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Todos');

  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Custom HTML5 Video Player state inside Lightbox
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const lightboxVideoRef = useRef<HTMLVideoElement>(null);

  // Admin Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isOptimizerModalOpen, setIsOptimizerModalOpen] = useState(false);
  const [uploadSource, setUploadSource] = useState<'cloudinary' | 'external'>('cloudinary');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parsingLoading, setParsingLoading] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [order, setOrder] = useState(0);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');

  // Parsed external fields
  const [parsedData, setParsedData] = useState<{
    provider?: string;
    external_id?: string;
    embed_url?: string;
    thumbnail_url?: string;
    media_type?: 'image' | 'video';
    width?: number;
    height?: number;
  } | null>(null);

  useEffect(() => {
    fetchItems();
    checkAdminStatus();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/gallery/items/`);
      setItems(res.data);
    } catch (err) {
      console.error('Error fetching gallery items:', err);
      toast.error('Error al cargar la galería.');
    } finally {
      setLoading(false);
    }
  };

  const checkAdminStatus = () => {
    const token = localStorage.getItem('token');
    if (token) {
      const payload = decodeJwt(token);
      if (payload && !(payload.exp && Date.now() / 1000 > payload.exp)) {
        setIsAdmin(!!payload.is_staff);
      }
    }
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') setLightboxIndex(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, items, activeFilter]);

  const getFilteredItems = () => {
    if (activeFilter === 'Todos') return items;
    return items.filter(item => item.category === activeFilter);
  };

  const categories = ['Todos', ...Array.from(new Set(items.map(item => item.category).filter(Boolean)))];

  const handlePrev = () => {
    const filtered = getFilteredItems();
    if (lightboxIndex !== null && filtered.length > 0) {
      setLightboxIndex(prev => (prev !== null && prev > 0 ? prev - 1 : filtered.length - 1));
      resetPlayerState();
    }
  };

  const handleNext = () => {
    const filtered = getFilteredItems();
    if (lightboxIndex !== null && filtered.length > 0) {
      setLightboxIndex(prev => (prev !== null && prev < filtered.length - 1 ? prev + 1 : 0));
      resetPlayerState();
    }
  };

  const resetPlayerState = () => {
    setIsPlaying(true);
    setVideoProgress(0);
  };

  // Video custom controls logic
  const togglePlay = () => {
    if (lightboxVideoRef.current) {
      if (isPlaying) {
        lightboxVideoRef.current.pause();
      } else {
        lightboxVideoRef.current.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (lightboxVideoRef.current) {
      lightboxVideoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVideoProgress(val);
    if (lightboxVideoRef.current) {
      lightboxVideoRef.current.currentTime = (val / 100) * videoDuration;
    }
  };

  const handleVideoTimeUpdate = () => {
    if (lightboxVideoRef.current) {
      const current = lightboxVideoRef.current.currentTime;
      const total = lightboxVideoRef.current.duration || 1;
      setVideoProgress((current / total) * 100);
    }
  };

  const handleVideoLoadedMetadata = () => {
    if (lightboxVideoRef.current) {
      setVideoDuration(lightboxVideoRef.current.duration);
    }
  };

  const handleFullscreen = () => {
    if (lightboxVideoRef.current) {
      if (lightboxVideoRef.current.requestFullscreen) {
        lightboxVideoRef.current.requestFullscreen();
      }
    }
  };

  // Safe Play/Pause hover preview triggers
  const handleMouseEnterVideo = (e: React.MouseEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    video.play().catch(() => {
      // Catch concurrent play calls / browser constraints silently
    });
  };

  const handleMouseLeaveVideo = (e: React.MouseEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    video.pause();
    video.currentTime = 0;
  };

  // Parse link handler when external link is pasted
  const handleUrlBlur = async (e?: React.FocusEvent<HTMLInputElement> | string) => {
    const targetUrl = typeof e === 'string' ? e : (e?.target?.value || externalUrl);
    if (!targetUrl) return;
    setParsingLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const res = await axios.post(`${API_URL}/gallery/items/parse_external_url/`, { url: targetUrl }, { headers });
      const data = res.data;
      setParsedData(data);
      if (data.title && !title) setTitle(data.title);
      if (data.media_type) setMediaType(data.media_type);
      toast.success(`Enlace de ${data.provider} detectado y analizado.`);
    } catch (err: any) {
      console.error('Error parsing external URL:', err);
      toast.error('No se pudo analizar la URL externa.');
    } finally {
      setParsingLoading(false);
    }
  };

  const handleDeleteItem = async (id: number, title: string) => {
    const result = await Swal.fire({
      title: '¿Eliminar de la Galería?',
      text: `¿Seguro que deseas eliminar "${title}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#E5A93B',
      cancelButtonColor: 'rgba(255,255,255,0.05)',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#0B0F0D',
      color: '#F4F6F0',
    });

    if (result.isConfirmed) {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      try {
        await axios.delete(`${API_URL}/gallery/items/${id}/`, { headers });
        toast.success('Elemento eliminado.');
        fetchItems();
      } catch (err) {
        console.error('Error deleting item:', err);
        toast.error('No se pudo eliminar el elemento.');
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return toast.error('El título es requerido.');

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    setUploadLoading(true);
    setUploadProgress(0);

    try {
      if (uploadSource === 'cloudinary') {
        if (!selectedFile) {
          setUploadLoading(false);
          return toast.error('Debe seleccionar un archivo para subir.');
        }

        // Edge case: validación en frontend
        const fileType = selectedFile.type.startsWith('image/') ? 'image' : 'video';
        const maxSize = fileType === 'image' ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
        if (selectedFile.size > maxSize) {
          setUploadLoading(false);
          return toast.error(`El archivo excede el tamaño límite (${fileType === 'image' ? '10MB' : '100MB'}).`);
        }

        // 1. Obtener firma presignada del backend
        const sigRes = await axios.post(`${API_URL}/gallery/items/signature/`, {
          media_type: fileType,
          file_size: selectedFile.size
        }, { headers });

        const { signature, timestamp, folder, public_id, api_key, cloud_name } = sigRes.data;

        // 2. Subir directamente a Cloudinary
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('api_key', api_key);
        formData.append('timestamp', timestamp.toString());
        formData.append('signature', signature);
        formData.append('folder', folder);
        formData.append('public_id', public_id);

        const resourceType = fileType === 'video' ? 'video' : 'image';
        const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloud_name}/${resourceType}/upload`;

        const uploadRes = await axios.post(cloudinaryUrl, formData, {
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(pct);
            }
          }
        });

        const cloudData = uploadRes.data;

        // 3. Registrar en Django
        await axios.post(`${API_URL}/gallery/items/`, {
          title,
          description,
          category,
          order,
          media_type: fileType,
          provider: 'cloudinary',
          url: cloudData.secure_url,
          public_id: cloudData.public_id,
          width: cloudData.width,
          height: cloudData.height,
          duration: cloudData.duration || null
        }, { headers });

      } else {
        // Multi-source link upload
        if (!externalUrl || !parsedData) {
          setUploadLoading(false);
          return toast.error('Debe ingresar y validar una URL externa.');
        }

        await axios.post(`${API_URL}/gallery/items/`, {
          title,
          description,
          category,
          order,
          media_type: mediaType,
          provider: parsedData.provider,
          url: externalUrl,
          embed_url: parsedData.embed_url,
          thumbnail_url: parsedData.thumbnail_url,
          external_id: parsedData.external_id,
          width: parsedData.width,
          height: parsedData.height,
        }, { headers });
      }

      toast.success('Elemento añadido correctamente.');
      setIsUploadModalOpen(false);
      resetForm();
      fetchItems();
    } catch (err: any) {
      console.error('Error saving gallery item:', err);
      const errMsg = err.response?.data?.detail || err.response?.data?.error || 'Error al guardar el elemento en el servidor.';
      toast.error(errMsg);
    } finally {
      setUploadLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setOrder(0);
    setSelectedFile(null);
    setExternalUrl('');
    setParsedData(null);
  };

  const filteredItems = getFilteredItems();
  const gallerySection = useSectionTheme('gallery_grid');

  return (
    <div style={gallerySection.style} className="min-h-screen bg-nature-night text-nature-white selection:bg-amber-honey/30 pb-20 transition-colors duration-300">
      <Head>
        <title>Ms Ambar | Galería</title>
        <meta name="description" content="Visuales oficiales de conciertos, grabaciones y backstage exclusivo del club Ms Ambar." />
      </Head>
      <Toaster position="bottom-right" />

      {/* Header */}
      <section className="max-w-[1400px] mx-auto px-6 md:px-10 pt-32 pb-12">
        <header className="mb-12 text-center relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="inline-block p-4 border border-amber-honey/20 rounded-full mb-6 bg-nature-night/50 backdrop-blur-xl"
          >
            <Camera className="text-amber-honey animate-pulse" size={28} />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl md:text-8xl font-black tracking-tighter mb-4 uppercase italic"
          >
            Galería de <span className="text-glow text-amber-honey">Ms Ambar</span>
          </motion.h1>
          <p className="opacity-50 uppercase tracking-[0.4em] text-[10px] md:text-xs font-black">
            Archivo oficial del club & bitácora visual
          </p>

          {/* Admin Control Trigger */}
          {isAdmin && (
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 mt-6 md:mt-0 md:absolute md:right-0 md:top-0">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOptimizerModalOpen(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-full border border-amber-400/60 bg-amber-400/20 text-amber-400 font-black uppercase tracking-wider text-xs shadow-lg hover:bg-amber-400 hover:text-slate-950 transition-all duration-300"
              >
                <Sparkles size={16} />
                Optimizar Imágenes
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-full border border-amber-honey/40 bg-amber-honey/10 text-amber-honey font-bold uppercase tracking-wider text-xs shadow-glow hover:bg-amber-honey hover:text-nature-night transition-all duration-300"
              >
                <Plus size={16} />
                Añadir Multimedia
              </motion.button>
            </div>
          )}
        </header>

        {/* Filter Categories Bar */}
        {categories.length > 2 && (
          <div className="flex flex-wrap justify-center gap-3 mb-16">
            {categories.map((cat, idx) => (
              <motion.button
                key={idx}
                onClick={() => setActiveFilter(cat || 'Todos')}
                className={`px-6 py-2.5 rounded-full text-xs font-black tracking-widest uppercase transition-all duration-300 ${activeFilter === (cat || 'Todos')
                  ? 'bg-amber-honey text-nature-night shadow-glow'
                  : 'bg-nature-night/60 border border-white/5 text-white/50 hover:text-white hover:border-white/20'
                  }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {cat || 'General'}
              </motion.button>
            ))}
          </div>
        )}

        {/* Loading / Skeleton State */}
        {loading ? (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-6 w-full">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="break-inside-avoid mb-6 w-full rounded-[2.5rem] bg-nature-night/40 border border-white/5 animate-pulse flex flex-col justify-end p-8"
                style={{ height: i % 2 === 0 ? '420px' : '300px' }}
              >
                <div className="w-1/3 h-4 bg-white/10 rounded-full mb-3" />
                <div className="w-2/3 h-7 bg-white/10 rounded-full mb-2" />
                <div className="w-1/2 h-3 bg-white/5 rounded-full" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 opacity-30 text-lg uppercase tracking-wider">
            La galería se encuentra vacía por el momento.
          </div>
        ) : (
          /* Masonry Grid */
          <div className="columns-1 md:columns-2 lg:columns-3 gap-6 [column-fill:_balance] w-full">
            {filteredItems.map((item, idx) => {
              const isCloudinaryVideo = item.media_type === 'video' && item.provider === 'cloudinary';
              const isYoutubeVideo = item.media_type === 'video' && item.provider === 'youtube';
              const hasHoverAutoplay = isCloudinaryVideo || isYoutubeVideo;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => setLightboxIndex(idx)}
                  className="break-inside-avoid mb-6 group relative rounded-[2.5rem] overflow-hidden amber-glass border border-white/5 cursor-pointer flex flex-col justify-end bg-black"
                >
                  {/* Media Rendering */}
                  {item.media_type === 'image' ? (
                    <img
                      src={item.optimized_url || item.thumbnail_url || item.url}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100"
                    />
                  ) : isCloudinaryVideo ? (
                    <video
                      src={item.optimized_url || item.url}
                      muted
                      loop
                      playsInline
                      onMouseEnter={handleMouseEnterVideo}
                      onMouseLeave={handleMouseLeaveVideo}
                      className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100"
                    />
                  ) : isYoutubeVideo ? (
                    <div className="relative w-full overflow-hidden aspect-video">
                      <img
                        src={item.thumbnail_url || `https://img.youtube.com/vi/${item.external_id}/hqdefault.jpg`}
                        alt={item.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100"
                      />
                      {/* Temporary silent preview on hover */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${item.external_id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${item.external_id}`}
                          className="w-full h-full pointer-events-none"
                          frameBorder="0"
                          allow="autoplay"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Other embed previews */
                    <div className="relative w-full aspect-video">
                      <img
                        src={item.thumbnail_url || '/placeholder.png'}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100"
                      />
                    </div>
                  )}

                  {/* Duración Badge */}
                  {item.media_type === 'video' && item.duration && (
                    <div className="absolute top-6 right-6 bg-nature-night/70 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black tracking-wider text-amber-honey border border-white/10 z-10">
                      {formatDuration(item.duration)}
                    </div>
                  )}

                  {/* Provider Brand Icon */}
                  {item.provider !== 'cloudinary' && (
                    <div className="absolute top-6 left-6 bg-nature-night/70 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase text-white/70 border border-white/10 z-10">
                      {item.provider}
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-nature-night/95 via-nature-night/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8 z-20">
                    <div className="flex items-center justify-between">
                      <div>
                        {item.category && (
                          <span className="bg-amber-honey text-nature-night px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mb-3 inline-block">
                            {item.category}
                          </span>
                        )}
                        <h3 className="text-xl font-extrabold tracking-tight mb-2 text-white">{item.title}</h3>
                        {item.description && (
                          <p className="text-[11px] text-white/50 line-clamp-2 max-w-[280px] mb-4">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-center w-12 h-12 rounded-full border border-amber-honey/20 bg-amber-honey/10 text-amber-honey">
                        <Expand size={18} />
                      </div>
                    </div>
                  </div>

                  {/* Admin Delete Action */}
                  {isAdmin && (
                    <div className="absolute bottom-6 right-6 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(item.id, item.title);
                        }}
                        className="p-3 bg-red-600/20 text-red-500 border border-red-500/30 hover:bg-red-600 hover:text-white rounded-full transition-all duration-300"
                        title="Borrar de Galería"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Lightbox / Modal Polimórfico */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-nature-night/95 backdrop-blur-2xl flex items-center justify-center p-4"
          >
            {/* Close Button */}
            <button
              onClick={() => setLightboxIndex(null)}
              className="absolute top-8 right-8 z-50 p-4 text-white/60 hover:text-white hover:bg-white/5 rounded-full transition-all duration-300"
            >
              <X size={28} />
            </button>

            {/* Left Nav Button */}
            <button
              onClick={handlePrev}
              className="absolute left-8 p-4 text-white/40 hover:text-white hover:bg-white/5 rounded-full transition-all duration-300"
            >
              <ChevronLeft size={36} />
            </button>

            {/* Right Nav Button */}
            <button
              onClick={handleNext}
              className="absolute right-8 p-4 text-white/40 hover:text-white hover:bg-white/5 rounded-full transition-all duration-300"
            >
              <ChevronRight size={36} />
            </button>

            {/* Content Container */}
            <div className="max-w-[1200px] w-full max-h-[85vh] flex flex-col items-center justify-center relative">
              <motion.div
                key={getFilteredItems()[lightboxIndex]?.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full flex flex-col items-center"
              >
                {/* Media Render */}
                {(() => {
                  const activeItem = getFilteredItems()[lightboxIndex];
                  if (!activeItem) return null;

                  if (activeItem.media_type === 'image') {
                    return (
                      <img
                        src={activeItem.optimized_url || activeItem.url}
                        alt={activeItem.title}
                        className="max-h-[70vh] w-auto max-w-full rounded-[2rem] object-contain shadow-2xl border border-white/5"
                      />
                    );
                  }

                  // Cloudinary Custom HTML5 Video Player
                  if (activeItem.provider === 'cloudinary') {
                    return (
                      <div className="relative w-full max-w-[900px] aspect-video rounded-[2rem] overflow-hidden bg-black shadow-2xl border border-white/5 group">
                        <video
                          ref={lightboxVideoRef}
                          src={activeItem.optimized_url || activeItem.url}
                          autoPlay
                          playsInline
                          onTimeUpdate={handleVideoTimeUpdate}
                          onLoadedMetadata={handleVideoLoadedMetadata}
                          className="w-full h-full object-contain"
                        />

                        {/* Custom video overlay controls */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                          {/* Progress bar */}
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={videoProgress}
                            onChange={handleProgressChange}
                            className="w-full h-1 bg-white/20 accent-amber-honey rounded-lg cursor-pointer mb-4"
                          />
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <button onClick={togglePlay} className="text-white hover:text-amber-honey transition-colors">
                                {isPlaying ? <Play size={20} className="fill-current" /> : <Play size={20} />}
                              </button>
                              <button onClick={toggleMute} className="text-white hover:text-amber-honey transition-colors">
                                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                              </button>
                              <span className="text-[11px] font-mono opacity-60">
                                {formatDuration(lightboxVideoRef.current ? lightboxVideoRef.current.currentTime : 0)} / {formatDuration(videoDuration)}
                              </span>
                            </div>
                            <button onClick={handleFullscreen} className="text-white hover:text-amber-honey transition-colors">
                              <Maximize size={20} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // YouTube Player
                  if (activeItem.provider === 'youtube') {
                    return (
                      <div className="w-full max-w-[900px] aspect-video rounded-[2rem] overflow-hidden shadow-2xl border border-white/5 bg-black">
                        <iframe
                          src={`${activeItem.embed_url}?autoplay=1&rel=0`}
                          className="w-full h-full"
                          allow="autoplay; encrypted-media"
                          allowFullScreen
                          frameBorder="0"
                        />
                      </div>
                    );
                  }

                  // Instagram Post/Reel
                  if (activeItem.provider === 'instagram') {
                    return (
                      <div className="w-full max-w-[500px] aspect-[9/16] max-h-[70vh] rounded-[2rem] overflow-hidden bg-black border border-white/10 shadow-2xl">
                        <iframe
                          src={activeItem.embed_url}
                          className="w-full h-full"
                          frameBorder="0"
                          scrolling="no"
                          allowTransparency
                        />
                      </div>
                    );
                  }

                  // Vimeo / Other
                  return (
                    <div className="w-full max-w-[900px] aspect-video rounded-[2rem] overflow-hidden shadow-2xl border border-white/5 bg-black">
                      <iframe
                        src={activeItem.embed_url || activeItem.url}
                        className="w-full h-full"
                        allowFullScreen
                        frameBorder="0"
                      />
                    </div>
                  );
                })()}

                {/* Lightbox Footer Details */}
                <div className="mt-6 text-center max-w-[600px]">
                  <h2 className="text-2xl font-black text-white">{getFilteredItems()[lightboxIndex]?.title}</h2>
                  {getFilteredItems()[lightboxIndex]?.description && (
                    <p className="text-sm opacity-50 mt-2">{getFilteredItems()[lightboxIndex]?.description}</p>
                  )}
                  {getFilteredItems()[lightboxIndex]?.category && (
                    <span className="mt-3 inline-block bg-white/5 text-amber-honey border border-amber-honey/20 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {getFilteredItems()[lightboxIndex]?.category}
                    </span>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Upload / Add Media Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 30 }}
              className="bg-[#121218] border border-slate-700/80 rounded-[3rem] w-full max-w-xl p-8 relative shadow-2xl text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close */}
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/50 hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>

              <h2 className="text-3xl font-black mb-6 uppercase tracking-tight text-white italic">
                Añadir a la <span className="text-amber-400">Galería</span>
              </h2>

              <form onSubmit={handleUploadSubmit} className="space-y-5">
                {/* Source Selection */}
                <div className="flex gap-2 p-1.5 bg-[#181824] border border-slate-800 rounded-full">
                  <button
                    type="button"
                    onClick={() => { setUploadSource('cloudinary'); resetForm(); }}
                    className={`flex-1 py-3 text-center rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 ${uploadSource === 'cloudinary' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    Cargar Archivo (Cloudinary)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setUploadSource('external'); resetForm(); }}
                    className={`flex-1 py-3 text-center rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 ${uploadSource === 'external' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    Vincular Enlace (YT/IG/Vimeo)
                  </button>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Título</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#181824] border border-slate-700 text-white placeholder-slate-400 focus:border-amber-400 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors font-medium"
                    placeholder="Título del elemento"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Descripción (Opcional)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-[#181824] border border-slate-700 text-white placeholder-slate-400 focus:border-amber-400 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors resize-none font-medium"
                    placeholder="Detalles sobre el medio..."
                  />
                </div>

                {/* Category & Order Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Categoría</label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-[#181824] border border-slate-700 text-white placeholder-slate-400 focus:border-amber-400 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors font-medium"
                      placeholder="Ej: Tour, Backstage..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Orden</label>
                    <input
                      type="number"
                      value={order}
                      onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#181824] border border-slate-700 text-white placeholder-slate-400 focus:border-amber-400 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors font-medium"
                    />
                  </div>
                </div>

                {/* Source Dependent Section */}
                {uploadSource === 'cloudinary' ? (
                  /* Cloudinary File Upload Dropzone */
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Seleccionar Archivo (Foto / Video)
                    </label>
                    <div className="border border-dashed border-slate-700 hover:border-amber-400/60 rounded-2xl p-6 text-center cursor-pointer transition-colors relative bg-[#181824]">
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div className="flex flex-col items-center">
                        <Upload size={24} className="text-amber-400 mb-2" />
                        <p className="text-xs text-slate-200 font-medium">
                          {selectedFile ? selectedFile.name : 'Arrastra o haz click para seleccionar'}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Límites: Imagen 35MB / Video 100MB
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Link parsing inputs */
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                        Enlace de YouTube, Instagram, Vimeo o TikTok
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="url"
                            value={externalUrl}
                            onChange={(e) => setExternalUrl(e.target.value)}
                            onBlur={handleUrlBlur}
                            className="w-full bg-[#181824] border border-slate-700 text-white placeholder-slate-400 focus:border-amber-400 rounded-2xl pl-10 pr-5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors font-medium"
                            placeholder="https://..."
                          />
                          <Link2 className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                        </div>
                        {parsingLoading && (
                          <div className="flex items-center justify-center px-4 bg-slate-800 rounded-2xl">
                            <Loader2 className="animate-spin text-amber-400" size={18} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Parser fields auto preview */}
                    {parsedData && (
                      <div className="flex gap-4 p-4 border border-slate-700 bg-[#181824] rounded-2xl">
                        {parsedData.thumbnail_url && (
                          <img
                            src={parsedData.thumbnail_url}
                            alt="preview"
                            className="w-24 h-16 rounded-lg object-cover border border-slate-700"
                          />
                        )}
                        <div className="flex flex-col justify-center">
                          <span className="text-xs font-bold uppercase text-amber-400 tracking-widest">
                            {parsedData.provider} / {parsedData.media_type}
                          </span>
                          <span className="text-xs text-slate-200 truncate max-w-[250px] mt-1 font-medium">
                            {title || 'Cargando título...'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Progress bar */}
                {uploadLoading && uploadSource === 'cloudinary' && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-amber-400">
                      <span>Subiendo a Cloudinary...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 transition-all duration-100" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}

                {/* Action button */}
                <motion.button
                  type="submit"
                  disabled={uploadLoading || parsingLoading}
                  className="w-full bg-amber-400 text-slate-950 font-black uppercase tracking-wider py-4 rounded-2xl shadow-lg hover:bg-amber-300 disabled:opacity-50 transition-all duration-300 text-xs flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {uploadLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      Subiendo...
                    </>
                  ) : (
                    'Guardar Elemento'
                  )}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Image Optimizer Modal */}
      <AnimatePresence>
        {isOptimizerModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 30 }}
              className="w-full max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              <ImageOptimizerWidget
                onCancel={() => setIsOptimizerModalOpen(false)}
                onSuccess={() => {
                  fetchItems();
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
