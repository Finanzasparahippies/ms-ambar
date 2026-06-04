import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, User, ArrowUpRight, Plus, Edit2, Trash2, Save, X,
  Bold, Italic, Underline, Heading2, Heading3, Quote, List,
  ListOrdered, Link2, Image as ImageIcon, Eye, Settings, Upload,
  FolderPlus, Globe, FileText, Check, ChevronRight, AlertCircle, Sparkles, Lock
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  image: string | null;
  category: number | null;
  category_name: string;
  created_at: string;
  is_published: boolean;
}

interface Category {
  id: number;
  name: string;
  slug: string;
}

function decodeJwt(token: string): Record<string, any> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

const stripHtml = (html: string) => {
  return html ? html.replace(/<[^>]*>/g, '') : '';
};

export default function AmbarTeEscribePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error';
  }
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  // Auth & Lock states
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [checkingSub, setCheckingSub] = useState(true);

  // Reader views
  const [activePost, setActivePost] = useState<Post | null>(null);

  // Editor states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const [editorTitle, setEditorTitle] = useState('');
  const [editorSlug, setEditorSlug] = useState('');
  const [editorCategory, setEditorCategory] = useState<string>('');
  const [editorImageFile, setEditorImageFile] = useState<File | null>(null);
  const [editorImagePreview, setEditorImagePreview] = useState<string | null>(null);
  const [editorIsPublished, setEditorIsPublished] = useState(true);

  const [editorSaving, setEditorSaving] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(true);
  const [editorMode, setEditorMode] = useState<'write' | 'preview'>('write');

  const [newsletterName, setNewsletterName] = useState('');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);

  // Initial Data Fetch
  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [postsRes, catsRes] = await Promise.all([
        axios.get(`${API_URL}/blog/posts/`, { headers }),
        axios.get(`${API_URL}/blog/categories/`, { headers }),
      ]);

      setPosts(postsRes.data);
      setCategories(catsRes.data);
    } catch (err) {
      console.error('Error fetching blog data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check admin authentication
    const token = localStorage.getItem('token');
    let adminActive = false;
    if (token) {
      const payload = decodeJwt(token);
      if (payload && payload.is_staff && !(payload.exp && Date.now() / 1000 > payload.exp)) {
        setIsAdmin(true);
        setIsUnlocked(true);
        adminActive = true;
      }
    }
    fetchData();

    // Check subscriber/unlock status
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const emailToUnsubscribe = params.get('unsubscribe');
      const subEmail = params.get('sub_email');
      const targetEmail = emailToUnsubscribe || subEmail;

      if (targetEmail) {
        localStorage.setItem('ms_ambar_subscriber_email', targetEmail);
        setIsUnlocked(true);

        if (emailToUnsubscribe) {
          // Process unsubscribe
          axios.post(`${API_URL}/blog/subscribers/unsubscribe/`, { email: emailToUnsubscribe })
            .then(() => {
              showToast('Te has desuscrito con éxito del Club de Ms Ambar.', 'success');
              localStorage.removeItem('ms_ambar_subscriber_email');
              setIsUnlocked(false);
              window.history.replaceState({}, document.title, window.location.pathname);
            })
            .catch((err) => {
              console.error('Error desuscribiendo:', err);
              showToast('Hubo un problema al procesar tu desuscripción.', 'error');
              window.history.replaceState({}, document.title, window.location.pathname);
            });
        } else {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else {
        const storedEmail = localStorage.getItem('ms_ambar_subscriber_email');
        if (storedEmail || adminActive) {
          setIsUnlocked(true);
        }
      }
    }
    setCheckingSub(false);
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterSubmitting(true);
    try {
      await axios.post(`${API_URL}/blog/subscribers/`, {
        email: newsletterEmail,
        name: newsletterName
      });
      localStorage.setItem('ms_ambar_subscriber_email', newsletterEmail);
      setIsUnlocked(true);
      setNewsletterSuccess(true);
      setNewsletterEmail('');
      setNewsletterName('');
      showToast('Te has suscrito con éxito al Club de Ms Ambar.', 'success');
    } catch (err: any) {
      console.error(err);
      const isAlreadySubbed = err.response?.data?.email?.[0]?.includes('exists') ||
        err.response?.data?.email?.[0]?.includes('ya existe') ||
        err.response?.status === 400;

      if (isAlreadySubbed) {
        localStorage.setItem('ms_ambar_subscriber_email', newsletterEmail);
        setIsUnlocked(true);
        setNewsletterEmail('');
        setNewsletterName('');
        showToast('Suscripción confirmada. Acceso desbloqueado.', 'success');
      } else {
        const msg = err.response?.data?.email?.[0] || 'Error al suscribirse. Inténtalo de nuevo.';
        showToast(msg, 'error');
      }
    } finally {
      setNewsletterSubmitting(false);
    }
  };

  useEffect(() => {
    if (isEditorOpen || activePost) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('hide-navbar');
    } else {
      document.body.style.overflow = '';
      document.body.classList.remove('hide-navbar');
    }
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('hide-navbar');
    };
  }, [isEditorOpen, activePost]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditorTitle(val);
    if (!editingPost) {
      setEditorSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '')
      );
    }
  };

  useEffect(() => {
    if (isEditorOpen) {
      if (editingPost) {
        setEditorTitle(editingPost.title);
        setEditorSlug(editingPost.slug);
        setEditorCategory(editingPost.category ? String(editingPost.category) : '');
        setEditorIsPublished(editingPost.is_published);
        setEditorImagePreview(editingPost.image);
        setEditorImageFile(null);
        if (editorRef.current) {
          editorRef.current.innerHTML = editingPost.content;
        }
      } else {
        setEditorTitle('');
        setEditorSlug('');
        setEditorCategory('');
        setEditorIsPublished(true);
        setEditorImagePreview(null);
        setEditorImageFile(null);
        if (editorRef.current) {
          editorRef.current.innerHTML = '';
        }
      }
    }
  }, [editingPost, isEditorOpen]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditorImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditorImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await axios.post(`${API_URL}/blog/categories/`, { name: newCatName }, { headers });
      setCategories([...categories, res.data]);
      setEditorCategory(String(res.data.id));
      setNewCatName('');
      setShowNewCatInput(false);
    } catch (err) {
      console.error('Failed to create category:', err);
    }
  };

  const handleSavePost = async () => {
    if (!editorTitle.trim()) {
      showToast('Por favor, ingresa un título.', 'error');
      return;
    }

    const editorContent = editorRef.current?.innerHTML || '';
    if (!editorContent.trim() || editorContent === '<br>') {
      showToast('Por favor, redacta el contenido del post.', 'error');
      return;
    }

    setEditorSaving(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const formData = new FormData();
      formData.append('title', editorTitle);
      formData.append('slug', editorSlug);
      formData.append('content', editorContent);
      formData.append('is_published', String(editorIsPublished));
      if (editorCategory) {
        formData.append('category', editorCategory);
      }
      if (editorImageFile) {
        formData.append('image', editorImageFile);
      }

      if (editingPost) {
        await axios.patch(`${API_URL}/blog/posts/${editingPost.id}/`, formData, {
          headers: { ...headers, 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await axios.post(`${API_URL}/blog/posts/`, formData, {
          headers: { ...headers, 'Content-Type': 'multipart/form-data' }
        });
      }

      setIsEditorOpen(false);
      fetchData();
      showToast('Crónica guardada y sintonizada correctamente.', 'success');
    } catch (err) {
      console.error('Failed to save post:', err);
      showToast('Error al guardar la entrada del blog.', 'error');
    } finally {
      setEditorSaving(false);
    }
  };

  const handleDeletePost = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este post? Esta acción es irreversible.')) return;

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`${API_URL}/blog/posts/${id}/`, { headers });
      fetchData();
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };

  const executeCommand = (command: string, value: string = '') => {
    if (typeof document !== 'undefined') {
      document.execCommand(command, false, value);
      editorRef.current?.focus();
    }
  };

  const handleLinkInsert = () => {
    const url = prompt('Ingresa la URL del enlace:');
    if (url) {
      executeCommand('createLink', url);
    }
  };

  const handleImageInsert = () => {
    const url = prompt('Ingresa la URL de la imagen:');
    if (url) {
      executeCommand('insertImage', url);
    }
  };

  const filteredPosts = selectedCategory === 'all'
    ? posts
    : posts.filter(p => p.category_name === selectedCategory || (p.category && String(p.category) === selectedCategory));

  return (
    <div className="selection:bg-amber-honey/30 min-h-screen text-white relative">
      <Head>
        <title>Ms Ambar | Ambar te escribe</title>
        <style>{`
          .rich-text-content h2 {
            font-size: 1.875rem;
            font-weight: 900;
            margin-top: 1.75rem;
            margin-bottom: 0.75rem;
            letter-spacing: -0.025em;
            color: #ffffff;
          }
          .rich-text-content h3 {
            font-size: 1.5rem;
            font-weight: 800;
            margin-top: 1.5rem;
            margin-bottom: 0.5rem;
            letter-spacing: -0.025em;
            color: #f3f4f6;
          }
          .rich-text-content p {
            font-size: 0.95rem;
            line-height: 1.75;
            margin-bottom: 1.25rem;
            color: rgba(255, 255, 255, 0.75);
          }
          .rich-text-content ul {
            list-style-type: disc;
            list-style-position: inside;
            margin-bottom: 1.25rem;
            padding-left: 1rem;
            color: rgba(255, 255, 255, 0.75);
          }
          .rich-text-content ol {
            list-style-type: decimal;
            list-style-position: inside;
            margin-bottom: 1.25rem;
            padding-left: 1rem;
            color: rgba(255, 255, 255, 0.75);
          }
          .rich-text-content blockquote {
            border-left: 4px solid #e5a93b;
            background: rgba(255, 255, 255, 0.02);
            padding: 1rem 1.25rem;
            border-radius: 0 1rem 1rem 0;
            margin-bottom: 1.25rem;
            font-style: italic;
            color: rgba(255, 255, 255, 0.85);
          }
          .rich-text-content a {
            color: #e5a93b;
            text-decoration: underline;
            transition: color 0.2s;
          }
          .rich-text-content a:hover {
            color: #ffffff;
          }
          .rich-text-content img {
            border-radius: 1.5rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
            margin: 2rem auto;
            max-height: 450px;
            object-fit: cover;
          }
          .custom-scroll::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          .custom-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scroll::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 99px;
          }
          .custom-scroll::-webkit-scrollbar-thumb:hover {
            background: rgba(229, 169, 59, 0.3);
          }
          .rich-text-content[contenteditable]:empty::before {
            content: attr(data-placeholder);
            color: rgba(255, 255, 255, 0.25);
            pointer-events: none;
            display: block;
          }
        `}</style>
      </Head>
      <AnimatePresence mode="wait">
        {checkingSub ? (
          <div className="min-h-screen bg-gradient-to-br from-[#121915] to-[#080C0A] text-[#F4F6F0] flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-4 border-amber-honey/20 border-t-amber-honey rounded-full animate-spin" />
            <p className="text-[#F4F6F0]/40 tracking-widest font-bold uppercase text-xs">Validando Acceso...</p>
          </div>
        ) : !isUnlocked ? (
          /* Lock screen / Subscriber Registration */
          <motion.div
            key="lock-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#121915] to-[#080C0A] px-6 py-20 relative overflow-hidden"
          >
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-honey/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-md w-full amber-glass p-8 md:p-12 rounded-[3.5rem] text-center relative z-10">
              <div className="w-16 h-16 bg-amber-honey/10 border border-amber-honey/30 rounded-full flex items-center justify-center mx-auto mb-8 shadow-md overflow-hidden p-2.5 transition-transform hover:scale-105 duration-300">
                <img src="/logos/ms_ambar_monograma_b.png" alt="Ms Ambar" className="w-full h-full object-contain" />
              </div>

              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-honey block mb-2">Solo para los reales</span>
              <h2 className="text-3xl font-serif text-[#F4F6F0] mb-4 tracking-tight italic font-normal">Ambar te escribe</h2>
              <p className="text-[#F4F6F0]/70 mb-10 text-xs leading-relaxed max-w-sm mx-auto">
                Las crónicas y bitácoras de Ms Ambar están reservadas para los suscriptores. Ingresa tu correo y nombre para desbloquear el contenido del feed y recibir poemas exclusivos en tu bandeja.
              </p>

              <form className="flex flex-col gap-3 text-left" onSubmit={handleSubscribe}>
                <input
                  type="text"
                  required
                  value={newsletterName}
                  onChange={e => setNewsletterName(e.target.value)}
                  placeholder="Tu Nombre"
                  className="w-full bg-white/5 text-white rounded-xl px-5 py-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-honey/50 transition-all border border-white/10 placeholder:text-white/30"
                  disabled={newsletterSubmitting}
                />
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={e => setNewsletterEmail(e.target.value)}
                  placeholder="Tu Correo Electrónico"
                  className="w-full bg-white/5 text-white rounded-xl px-5 py-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-honey/50 transition-all border border-white/10 placeholder:text-white/30"
                  disabled={newsletterSubmitting}
                />
                <button
                  type="submit"
                  disabled={newsletterSubmitting}
                  className="w-full bg-gradient-to-r from-amber-honey via-amber-gold to-amber-500 hover:from-amber-gold hover:to-amber-500 active:scale-[0.98] text-[#1E2B22] font-black text-[10px] uppercase tracking-[0.25em] py-[18px] rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_35px_rgba(245,158,11,0.35)] whitespace-nowrap text-center flex items-center justify-center gap-2 hover:scale-[1.02]"
                >
                  {newsletterSubmitting ? (
                    <span className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-[#1E2B22]/20 border-t-[#1E2B22] rounded-full animate-spin" />
                      Verificando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Desbloquear Cartas <Sparkles size={11} className="text-[#1E2B22] fill-current animate-pulse" />
                    </span>
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        ) : (
          /* Unlocked Content */
          <motion.div
            key="unlocked-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-[1400px] mx-auto px-6 md:px-10 pb-20 pt-32"
          >
            {/* Header section */}
            <header className="mb-20 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
              <div>
                <div className="flex items-center gap-4">
                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-5xl md:text-7xl font-black tracking-tighter"
                  >
                    Ambar te escribe
                  </motion.h1>
                  {isAdmin && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setEditingPost(null);
                        setIsEditorOpen(true);
                      }}
                      className="bg-amber-honey text-nature-night px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg shadow-amber-honey/20 mt-4 md:mt-0"
                    >
                      <Plus size={14} /> Nueva Entrada
                    </motion.button>
                  )}
                </div>
                <p className="opacity-40 mt-4 text-sm font-bold uppercase tracking-[0.4em] text-glow text-amber-honey">
                  Club Exclusivo
                </p>
              </div>
              {/* Categories bar */}
              <div className="amber-glass px-8 py-4 rounded-2xl border border-white/5">
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-amber-honey mb-4">Filtrar Historias</p>
                <div className="flex flex-wrap gap-6 text-[10px] uppercase font-bold text-[#F4F6F0]/70">
                  <span
                    onClick={() => setSelectedCategory('all')}
                    className={`cursor-pointer transition-all ${selectedCategory === 'all'
                      ? 'text-amber-honey underline decoration-2 underline-offset-8'
                      : 'hover:text-amber-honey'
                      }`}
                  >
                    Todos
                  </span>
                  {categories.map((cat) => (
                    <span
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`cursor-pointer transition-all ${selectedCategory === cat.name
                        ? 'text-amber-honey underline decoration-2 underline-offset-8'
                        : 'hover:text-amber-honey'
                        }`}
                    >
                      {cat.name}
                    </span>
                  ))}
                </div>
              </div>
            </header>

            {/* Loading state */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-40 gap-4">
                <div className="w-10 h-10 border-4 border-amber-honey/20 border-t-amber-honey rounded-full animate-spin" />
                <p className="text-xs uppercase tracking-widest text-[#F4F6F0]/40 font-bold">Cargando Feed...</p>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center py-40 border border-white/10 bg-white/[0.01] rounded-[3rem] p-10">
                <AlertCircle size={32} className="mx-auto text-amber-honey/40 mb-4" />
                <p className="text-sm uppercase tracking-widest text-[#F4F6F0]/45 font-black">No hay feed disponibles</p>
                {isAdmin && (
                  <button
                    onClick={() => setIsEditorOpen(true)}
                    className="mt-6 text-[10px] font-black text-amber-honey uppercase tracking-wider underline hover:text-white"
                  >
                    Redactar ahora
                  </button>
                )}
              </div>
            ) : (
              /* Post Grid */
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
                {filteredPosts.map((post, i) => (
                  <motion.article
                    key={post.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="group cursor-pointer amber-glass p-6 rounded-[3rem] hover:scale-[1.02] transition-all relative flex flex-col justify-between min-h-[500px]"
                  >
                    <div>
                      <div className="aspect-[16/11] rounded-[2rem] overflow-hidden mb-8 relative">
                        <img
                          src={post.image || 'https://images.unsplash.com/photo-1514525253361-bee8a48790c3?w=800&q=80'}
                          alt={post.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100"
                        />

                        <div className="absolute top-6 left-6 flex justify-between w-[85%] items-start">
                          <span className="bg-amber-honey text-nature-night px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-amber-honey/20">
                            {post.category_name || 'Sin Categoría'}
                          </span>
                          {!post.is_published && (
                            <span className="bg-white/10 text-white border border-white/20 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest backdrop-blur-md">
                              Borrador
                            </span>
                          )}
                        </div>

                        {/* Admin Action Buttons */}
                        {isAdmin && (
                          <div className="absolute bottom-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingPost(post);
                                setIsEditorOpen(true);
                              }}
                              className="w-9 h-9 rounded-xl bg-black/60 border border-white/20 flex items-center justify-center text-amber-honey hover:bg-amber-honey hover:text-black transition-all hover:scale-105"
                              title="Editar Post"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePost(post.id);
                              }}
                              className="w-9 h-9 rounded-xl bg-black/60 border border-white/20 flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white transition-all hover:scale-105"
                              title="Eliminar Post"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-6 mb-6 text-[9px] font-black uppercase tracking-[0.2em] text-[#F4F6F0]/40">
                        <div className="flex items-center gap-2">
                          <Calendar size={12} className="text-amber-honey" /> {new Date(post.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="flex items-center gap-2">
                          <User size={12} className="text-amber-honey" /> Ms Ambar
                        </div>
                      </div>

                      <h2 className="text-2xl font-extrabold tracking-tight mb-4 group-hover:text-amber-honey transition-colors leading-tight line-clamp-2">
                        {post.title}
                      </h2>
                      <p className="opacity-60 text-xs leading-relaxed mb-8 line-clamp-3">
                        {stripHtml(post.content).substring(0, 150) + (stripHtml(post.content).length > 150 ? '...' : '')}
                      </p>
                    </div>

                    <button
                      onClick={() => setActivePost(post)}
                      className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-amber-honey group-hover:text-glow transition-all mt-auto"
                    >
                      Inmersión <ArrowUpRight size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </button>
                  </motion.article>
                ))}
              </div>
            )}

            {/* Newsletter Subscription confirmation at footer of page */}
            <div className="mt-40 bg-forest-green border border-amber-honey/10 p-12 md:p-20 rounded-[3rem] text-center relative overflow-hidden shadow-[0_0_50px_rgba(30,43,34,0.25)] max-w-2xl mx-auto">
              <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-honey/5 blur-[120px] rounded-full pointer-events-none" />
              <div className="w-12 h-12 bg-amber-honey/10 border border-amber-honey/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md overflow-hidden p-2 transition-transform hover:scale-105 duration-300">
                <img src="/logos/ms_ambar_monograma_b.png" alt="Ms Ambar" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-3xl font-serif text-white mb-4 tracking-tight italic font-normal">Miembro de las Cartas</h3>
              <p className="text-white/60 mb-6 max-w-md mx-auto text-xs leading-relaxed">
                Estás registrado correctamente. Recibirás de manera directa y en exclusiva los poemas y lanzamientos de Ms Ambar.
              </p>
              <button
                onClick={() => {
                  localStorage.removeItem('ms_ambar_subscriber_email');
                  setIsUnlocked(false);
                  showToast('Has cerrado tu sesión de lector.', 'error');
                }}
                className="text-[9px] font-black text-red-400 hover:text-red-300 uppercase tracking-widest hover:underline"
              >
                Salir de las cartas (Cerrar Sesión)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── BEEHIIV STYLE POST EDITOR OVERLAY (Admins Only) ─── */}
      <AnimatePresence>
        {isEditorOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#080C0A] z-[200] flex flex-col font-sans text-[#F4F6F0]"
          >
            {/* Editor Top Bar */}
            <header className="h-16 px-6 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-md">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-honey/10 border border-amber-honey/20 flex items-center justify-center animate-pulse">
                    <Sparkles size={14} className="text-amber-honey" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-widest text-white/95">
                      {editingPost ? 'Editar Entrada' : 'Nueva Crónica'}
                    </h2>
                    <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold mt-0.5">Nectar Studio Publisher</p>
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/10 px-3.5 py-1.5 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">Cloud Sync Conectado</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="bg-white/5 border border-white/10 p-1 rounded-xl flex gap-1">
                  <button
                    onClick={() => setEditorMode('write')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${editorMode === 'write' ? 'bg-amber-honey text-nature-night' : 'opacity-60 hover:opacity-100'}`}
                  >
                    <FileText size={10} /> Redactar
                  </button>
                  <button
                    onClick={() => setEditorMode('preview')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${editorMode === 'preview' ? 'bg-amber-honey text-nature-night' : 'opacity-60 hover:opacity-100'}`}
                  >
                    <Eye size={10} /> Vista Previa
                  </button>
                </div>

                <div className="h-6 w-px bg-white/10" />

                <button
                  onClick={() => setShowSettingsSidebar(!showSettingsSidebar)}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${showSettingsSidebar ? 'border-amber-honey text-amber-honey bg-amber-honey/10' : 'border-white/10 text-white/60 hover:text-white'}`}
                  title="Configuración de Entrada"
                >
                  <Settings size={14} />
                </button>

                <button
                  onClick={handleSavePost}
                  disabled={editorSaving}
                  className="bg-amber-honey text-nature-night px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-amber-honey/10 disabled:opacity-50"
                >
                  {editorSaving ? (
                    <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : (
                    <><Save size={12} /> Guardar</>
                  )}
                </button>

                <button
                  onClick={() => setIsEditorOpen(false)}
                  className="w-9 h-9 rounded-xl border border-white/10 text-white/40 hover:text-white flex items-center justify-center transition-all hover:bg-white/5"
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-12 custom-scroll flex justify-center bg-[#07080d]">
                <div className="max-w-[720px] w-full flex flex-col h-full">
                  {editorMode === 'write' ? (
                    <>
                      <div className="sticky top-0 z-50 mb-10 bg-white/[0.02] border border-white/10 p-2 rounded-2xl flex flex-wrap gap-1 items-center shadow-2xl">
                        <button
                          onClick={() => executeCommand('bold')}
                          className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                          title="Negrita"
                        >
                          <Bold size={14} />
                        </button>
                        <button
                          onClick={() => executeCommand('italic')}
                          className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                          title="Itálica"
                        >
                          <Italic size={14} />
                        </button>
                        <button
                          onClick={() => executeCommand('underline')}
                          className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                          title="Subrayado"
                        >
                          <Underline size={14} />
                        </button>

                        <div className="w-px h-6 bg-white/10 mx-1" />

                        <button
                          onClick={() => executeCommand('formatBlock', '<h2>')}
                          className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center font-bold text-xs"
                          title="Título Grande H2"
                        >
                          H2
                        </button>
                        <button
                          onClick={() => executeCommand('formatBlock', '<h3>')}
                          className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center font-bold text-xs"
                          title="Título Mediano H3"
                        >
                          H3
                        </button>
                        <button
                          onClick={() => executeCommand('formatBlock', '<p>')}
                          className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center text-xs"
                          title="Párrafo"
                        >
                          P
                        </button>

                        <div className="w-px h-6 bg-white/10 mx-1" />

                        <button
                          onClick={() => executeCommand('insertUnorderedList')}
                          className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                          title="Lista Viñetas"
                        >
                          <List size={14} />
                        </button>
                        <button
                          onClick={() => executeCommand('insertOrderedList')}
                          className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                          title="Lista Enumerada"
                        >
                          <ListOrdered size={14} />
                        </button>
                        <button
                          onClick={() => executeCommand('formatBlock', '<blockquote>')}
                          className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                          title="Cita"
                        >
                          <Quote size={14} />
                        </button>

                        <div className="w-px h-6 bg-white/10 mx-1" />

                        <button
                          onClick={handleLinkInsert}
                          className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                          title="Insertar Enlace"
                        >
                          <Link2 size={14} />
                        </button>
                        <button
                          onClick={handleImageInsert}
                          className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                          title="Insertar Imagen por URL"
                        >
                          <ImageIcon size={14} />
                        </button>
                        <button
                          onClick={() => executeCommand('removeFormat')}
                          className="w-8 h-8 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-500/5 flex items-center justify-center ml-auto"
                          title="Limpiar Formatos"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {editorImagePreview && (
                        <div className="w-full aspect-[21/9] rounded-[2rem] overflow-hidden mb-10 border border-white/10 relative group">
                          <img src={editorImagePreview} alt="Cover preview" className="w-full h-full object-cover" />
                          <button
                            onClick={() => {
                              setEditorImagePreview(null);
                              setEditorImageFile(null);
                            }}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-red-500 hover:text-white transition-all scale-0 group-hover:scale-100"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}

                      <input
                        type="text"
                        value={editorTitle}
                        onChange={handleTitleChange}
                        placeholder="Escribe un título fascinante..."
                        className="w-full bg-transparent text-white placeholder-white/20 text-4xl md:text-5xl font-black focus:outline-none mb-4 tracking-tighter"
                      />

                      <div className="flex items-center gap-2 mb-8 text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">
                        <span>URL Slug:</span>
                        <input
                          type="text"
                          value={editorSlug}
                          onChange={(e) => setEditorSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}
                          placeholder="slug-de-la-entrada"
                          className="bg-transparent text-amber-honey/70 focus:text-amber-honey outline-none w-full font-mono lowercase border-b border-transparent focus:border-amber-honey/20 transition-all pb-0.5"
                        />
                      </div>

                      <div
                        ref={editorRef}
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder="Comienza a redactar tu historia aquí. Usa el toolbar superior para dar formato dinámico..."
                        className="flex-1 w-full min-h-[400px] text-white/80 focus:outline-none text-base leading-relaxed rich-text-content pl-1"
                        style={{ outline: 'none' }}
                      />
                    </>
                  ) : (
                    <div className="flex flex-col">
                      {editorImagePreview && (
                        <div className="w-full aspect-[16/9] rounded-[2.5rem] overflow-hidden mb-12 border border-white/10">
                          <img src={editorImagePreview} alt="Cover" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex items-center gap-3 mb-6">
                        <span className="bg-amber-honey text-nature-night px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest">
                          {categories.find(c => String(c.id) === editorCategory)?.name || 'Crónica'}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                          {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8 leading-none text-white">{editorTitle || 'Entrada sin Título'}</h1>
                      <div
                        className="rich-text-content"
                        dangerouslySetInnerHTML={{ __html: editorRef.current?.innerHTML || '<p class="italic text-white/30">Contenido vacío...</p>' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <AnimatePresence>
                <motion.aside
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 340, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="border-l border-white/5 bg-black/40 backdrop-blur-2xl flex flex-col overflow-hidden"
                >
                  <div className="p-6 flex-1 overflow-y-auto space-y-8 custom-scroll w-[340px]">
                    <div className="flex items-center justify-between pb-4 border-b border-white/5">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-honey flex items-center gap-2">
                        <Settings size={12} /> Parámetros del Post
                      </h3>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Estado de Publicación</label>
                      <div className="bg-white/5 border border-white/10 p-2.5 rounded-2xl flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider pl-1">
                          {editorIsPublished ? (
                            <span className="text-amber-honey flex items-center gap-1.5">
                              <Globe size={12} /> Público / Activo
                            </span>
                          ) : (
                            <span className="text-white/45 flex items-center gap-1.5">
                              <FileText size={12} /> Borrador Local
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => setEditorIsPublished(!editorIsPublished)}
                          className={`w-12 h-6 rounded-full p-1 transition-all ${editorIsPublished ? 'bg-amber-honey' : 'bg-white/10'}`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-all ${editorIsPublished ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Categoría</label>
                        <button
                          onClick={() => setShowNewCatInput(!showNewCatInput)}
                          className="text-[9px] text-amber-honey hover:text-white uppercase font-black tracking-widest flex items-center gap-1"
                        >
                          <FolderPlus size={10} /> {showNewCatInput ? 'Cancelar' : 'Nueva'}
                        </button>
                      </div>

                      {showNewCatInput ? (
                        <form onSubmit={handleCreateCategory} className="flex gap-2">
                          <input
                            type="text"
                            required
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            placeholder="Nombre de categoría"
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-honey/50 text-white"
                          />
                          <button
                            type="submit"
                            className="bg-amber-honey text-nature-night px-3 rounded-xl flex items-center justify-center"
                          >
                            <Plus size={14} />
                          </button>
                        </form>
                      ) : (
                        <select
                          value={editorCategory}
                          onChange={(e) => setEditorCategory(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-amber-honey/50 outline-none text-white/80"
                        >
                          <option value="" className="bg-[#121915] text-[#F4F6F0]">Seleccionar Categoría</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id} className="bg-[#121915] text-[#F4F6F0]">
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Imagen de Portada</label>

                      <div className="border border-dashed border-white/10 bg-white/5 hover:bg-white/10 rounded-2.5rem p-6 text-center cursor-pointer transition-colors relative group">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <Upload size={20} className="mx-auto text-amber-honey/60 mb-2 group-hover:scale-110 transition-transform" />
                        <p className="text-[10px] font-black uppercase tracking-wider text-white/60">Cargar Archivo</p>
                        <p className="text-[8px] text-white/30 uppercase font-bold tracking-widest mt-1">PNG, JPG, WEBP hasta 5MB</p>
                      </div>

                      {editorImagePreview && (
                        <div className="relative rounded-2xl overflow-hidden border border-white/10 aspect-video bg-[#07080d]">
                          <img src={editorImagePreview} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <p className="text-[9px] font-black uppercase tracking-widest text-white">Imagen Cargada</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.aside>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── NECTAR LABS FULL READING VIEW (Inmersión) ─── */}
      <AnimatePresence>
        {activePost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#080C0A]/95 z-[210] overflow-y-auto custom-scroll flex justify-center py-20 px-6 backdrop-blur-xl text-[#F4F6F0]"
          >
            <div className="max-w-[800px] w-full relative">
              <button
                onClick={() => setActivePost(null)}
                className="fixed top-8 right-8 md:right-20 w-12 h-12 rounded-full bg-black/60 border border-white/20 hover:border-amber-honey/40 text-white flex items-center justify-center hover:scale-105 transition-all shadow-2xl backdrop-blur-md"
              >
                <X size={18} />
              </button>

              <article className="w-full">
                {activePost.image && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    className="w-full aspect-[21/10] rounded-[3rem] overflow-hidden mb-12 border border-white/10 shadow-2xl"
                  >
                    <img src={activePost.image} alt={activePost.title} className="w-full h-full object-cover" />
                  </motion.div>
                )}

                <div className="flex flex-wrap items-center gap-4 mb-6 text-[9px] font-black uppercase tracking-widest">
                  <span className="bg-amber-honey text-nature-night px-4.5 py-2 rounded-full shadow-lg shadow-amber-honey/20">
                    {activePost.category_name || 'Crónica'}
                  </span>

                  <div className="flex items-center gap-2 text-[#F4F6F0]/50">
                    <Calendar size={12} className="text-amber-honey" />
                    {new Date(activePost.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>

                  <div className="flex items-center gap-2 text-[#F4F6F0]/50">
                    <User size={12} className="text-amber-honey" /> Ms Ambar
                  </div>
                </div>

                <h1 className="text-4xl md:text-7xl font-black tracking-tighter mb-10 leading-none text-[#F4F6F0]">
                  {activePost.title}
                </h1>

                <div className="h-px bg-gradient-to-r from-amber-honey/30 via-transparent to-transparent mb-12" />

                <div
                  className="rich-text-content pb-20 select-text"
                  dangerouslySetInnerHTML={{ __html: activePost.content }}
                />
              </article>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notifications Container */}
      <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`pointer-events-auto p-4 rounded-2xl border flex items-start gap-3 shadow-2xl backdrop-blur-xl ${toast.type === 'success'
                ? 'bg-amber-950/40 border-amber-honey/40 text-amber-100'
                : 'bg-red-950/40 border-red-500/30 text-red-100'
                } amber-glass`}
            >
              <div className={`p-1.5 rounded-lg ${toast.type === 'success' ? 'bg-amber-honey/20 text-amber-honey animate-pulse' : 'bg-red-500/20 text-red-400'}`}>
                {toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="text-[10px] font-black uppercase tracking-widest">
                  {toast.type === 'success' ? 'SINTONIZACIÓN' : 'FRECUENCIA INCOMPATIBLE'}
                </h4>
                <p className="text-[11px] font-medium leading-relaxed opacity-90">{toast.message}</p>
              </div>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-white/30 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
