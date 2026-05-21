import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, User, ArrowUpRight, Plus, Edit2, Trash2, Save, X, 
  Bold, Italic, Underline, Heading2, Heading3, Quote, List, 
  ListOrdered, Link2, Image as ImageIcon, Eye, Settings, Upload, 
  FolderPlus, Globe, FileText, Check, ChevronRight, AlertCircle, Sparkles
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

/** Decodes a JWT payload client-side (no signature verification). */
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

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Auth states
  const [isAdmin, setIsAdmin] = useState(false);

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

  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterSubmitting(true);
    try {
      await axios.post(`${API_URL}/blog/subscribers/`, { email: newsletterEmail });
      setNewsletterSuccess(true);
      setNewsletterEmail('');
      setTimeout(() => setNewsletterSuccess(false), 5000);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.email?.[0] || 'Error al suscribirse. Inténtalo de nuevo.');
    } finally {
      setNewsletterSubmitting(false);
    }
  };

  // Fetch initial data
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
    if (token) {
      const payload = decodeJwt(token);
      if (payload && payload.is_staff && !(payload.exp && Date.now() / 1000 > payload.exp)) {
        setIsAdmin(true);
      }
    }
    fetchData();
  }, []);

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

  // Update slug when title changes (only if it's a new post or we manually edit)
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

  // Sync contentEditable content on edit load
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

  // Handle Cover Image upload
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

  // Inline Quick Category Creation
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

  // Save Post (Create or Update)
  const handleSavePost = async () => {
    if (!editorTitle.trim()) {
      alert('Por favor, ingresa un título.');
      return;
    }
    
    const editorContent = editorRef.current?.innerHTML || '';
    if (!editorContent.trim() || editorContent === '<br>') {
      alert('Por favor, redacta el contenido del post.');
      return;
    }

    setEditorSaving(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { 
        Authorization: `Bearer ${token}`,
      } : {};
      
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
    } catch (err) {
      console.error('Failed to save post:', err);
      alert('Error al guardar la entrada del blog.');
    } finally {
      setEditorSaving(false);
    }
  };

  // Delete Post
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

  // Rich Text Editor Commands (execCommand abstraction)
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
        <title>MS AMBAR | Journal</title>
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
            border-left: 4px solid #f59e0b;
            background: rgba(255, 255, 255, 0.02);
            padding: 1rem 1.25rem;
            border-radius: 0 1rem 1rem 0;
            margin-bottom: 1.25rem;
            font-style: italic;
            color: rgba(255, 255, 255, 0.85);
          }
          .rich-text-content a {
            color: #f59e0b;
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
            object-cover: cover;
          }
          /* Custom scrollbar for editor */
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
            background: rgba(245, 158, 11, 0.3);
          }
          /* Custom placeholder style for contenteditable */
          .rich-text-content[contenteditable]:empty::before {
            content: attr(data-placeholder);
            color: rgba(255, 255, 255, 0.25);
            pointer-events: none;
            display: block;
          }
        `}</style>
      </Head>

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 pb-20 pt-32">
        
        {/* Header section */}
        <header className="mb-20 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div>
            <div className="flex items-center gap-4">
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-7xl md:text-9xl font-black tracking-tighter"
              >
                JOURNAL
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
              Bitácora de Luz & Sonido
            </p>
          </div>
          
          {/* Categories bar */}
          <div className="amber-glass px-8 py-4 rounded-2xl border border-white/5">
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-amber-honey mb-4">Filtrar Historias</p>
            <div className="flex flex-wrap gap-6 text-[10px] uppercase font-bold opacity-70">
              <span 
                onClick={() => setSelectedCategory('all')}
                className={`cursor-pointer transition-all ${
                  selectedCategory === 'all' 
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
                  className={`cursor-pointer transition-all ${
                    selectedCategory === cat.name 
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
            <p className="text-xs uppercase tracking-widest text-white/40 font-bold">Cargando crónicas...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-40 border border-white/5 bg-white/[0.01] rounded-[3rem] p-10">
            <AlertCircle size={32} className="mx-auto text-amber-honey/40 mb-4" />
            <p className="text-sm uppercase tracking-widest text-white/40 font-black">No hay crónicas disponibles</p>
            {isAdmin && (
              <button 
                onClick={() => setIsEditorOpen(true)}
                className="mt-6 text-[10px] font-black text-amber-honey uppercase tracking-wider underline hover:text-white"
              >
                Redacta la primera crónica ahora
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

                    {/* Admin Action Buttons on Card */}
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
                  
                  <div className="flex items-center gap-6 mb-6 text-[9px] font-black uppercase tracking-[0.2em] opacity-40">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-amber-honey" /> {new Date(post.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-2">
                      <User size={12} className="text-amber-honey" /> MS Ambar
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

        {/* Newsletter Section */}
        <div className="mt-40 amber-glass p-12 md:p-24 rounded-[4rem] text-center border border-white/5 relative overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-honey/5 blur-[120px] rounded-full pointer-events-none" />
          <h3 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter">Únete al <span className="text-amber-honey text-glow">Círculo</span></h3>
          <p className="opacity-50 mb-12 max-w-lg mx-auto text-sm italic">Recibe contenido exclusivo, preventas y crónicas antes que nadie.</p>
          
          {newsletterSuccess ? (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md mx-auto p-6 rounded-3xl bg-amber-honey/10 border border-amber-honey/20 text-amber-honey text-xs font-black uppercase tracking-wider flex items-center justify-center gap-3"
            >
              <Check size={16} /> ¡Te has suscrito con éxito!
            </motion.div>
          ) : (
            <form className="max-w-md mx-auto flex flex-col md:flex-row gap-4" onSubmit={handleSubscribe}>
              <input 
                type="email" 
                required
                value={newsletterEmail}
                onChange={e => setNewsletterEmail(e.target.value)}
                placeholder="TU CORREO ELECTRÓNICO" 
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-8 py-5 text-xs font-bold focus:outline-none focus:border-amber-honey/50 transition-colors placeholder:text-white/20 text-white"
              />
              <button 
                type="submit"
                disabled={newsletterSubmitting}
                className="bg-amber-honey text-nature-night px-8 py-5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-honey/15 hover:scale-105 transition-all disabled:opacity-50"
              >
                {newsletterSubmitting ? 'Procesando...' : 'Suscribir'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ─── BEEHIIV STYLE POST EDITOR OVERLAY (Admins Only) ─── */}
      <AnimatePresence>
        {isEditorOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#06070b] z-[200] flex flex-col font-sans"
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

                {/* Cloud Sync Status indicator badge */}
                <div className="hidden md:flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/10 px-3.5 py-1.5 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">Cloud Sync Conectado</span>
                </div>
              </div>

              {/* Mode toggles & Actions */}
              <div className="flex items-center gap-4">
                <div className="bg-white/5 border border-white/10 p-1 rounded-xl flex gap-1">
                  <button
                    onClick={() => setEditorMode('write')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                      editorMode === 'write' ? 'bg-amber-honey text-nature-night' : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    <FileText size={10} /> Redactar
                  </button>
                  <button
                    onClick={() => setEditorMode('preview')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                      editorMode === 'preview' ? 'bg-amber-honey text-nature-night' : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    <Eye size={10} /> Vista Previa
                  </button>
                </div>

                <div className="h-6 w-px bg-white/10" />

                <button
                  onClick={() => setShowSettingsSidebar(!showSettingsSidebar)}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                    showSettingsSidebar ? 'border-amber-honey text-amber-honey bg-amber-honey/10' : 'border-white/10 text-white/60 hover:text-white'
                  }`}
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
                    <>
                      <Save size={12} /> Guardar
                    </>
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

            {/* Editor Workspace */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* Main Writing Canvas (Beehiiv minimal layout) */}
              <div className="flex-1 overflow-y-auto px-6 py-12 custom-scroll flex justify-center bg-[#07080d]">
                <div className="max-w-[720px] w-full flex flex-col h-full">
                  
                  {editorMode === 'write' ? (
                    <>
                      {/* Editor Canvas Toolbar */}
                      <div className="sticky top-0 z-50 mb-10 bg-white/[0.02] border border-white/10 p-2 rounded-2xl backdrop-blur-xl flex flex-wrap gap-1 items-center shadow-2xl">
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
                          className="w-8 h-8 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center justify-center ml-auto"
                          title="Limpiar Formatos"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Cover Image Preview in Editor Canvas */}
                      {editorImagePreview && (
                        <div className="w-full aspect-[21/9] rounded-[2rem] overflow-hidden mb-10 border border-white/5 relative group">
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

                      {/* Header Inputs */}
                      <input
                        type="text"
                        value={editorTitle}
                        onChange={handleTitleChange}
                        placeholder="Escribe un título fascinante..."
                        className="w-full bg-transparent text-white placeholder-white/10 text-4xl md:text-5xl font-black focus:outline-none mb-4 tracking-tighter"
                      />

                      {/* Slug bar */}
                      <div className="flex items-center gap-2 mb-8 text-[10px] text-white/30 font-bold uppercase tracking-wider pl-1">
                        <span>URL Slug:</span>
                        <input
                          type="text"
                          value={editorSlug}
                          onChange={(e) => setEditorSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}
                          placeholder="slug-de-la-entrada"
                          className="bg-transparent text-amber-honey/70 focus:text-amber-honey outline-none w-full font-mono lowercase border-b border-transparent focus:border-amber-honey/20 transition-all pb-0.5"
                        />
                      </div>

                      {/* Content Editable Area */}
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
                    /* Live Editor Preview Mode */
                    <div className="flex flex-col">
                      {editorImagePreview && (
                        <div className="w-full aspect-[16/9] rounded-[2.5rem] overflow-hidden mb-12 border border-white/5">
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
                      <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8 leading-none">{editorTitle || 'Entrada sin Título'}</h1>
                      <div 
                        className="rich-text-content"
                        dangerouslySetInnerHTML={{ __html: editorRef.current?.innerHTML || '<p className="italic text-white/20">Contenido vacío...</p>' }}
                      />
                    </div>
                  )}

                </div>
              </div>

              {/* Editor Right Sidebar (Settings) */}
              <AnimatePresence>
                {showSettingsSidebar && (
                  <motion.aside 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 340, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="border-l border-white/5 bg-black/20 backdrop-blur-2xl flex flex-col overflow-hidden"
                  >
                    <div className="p-6 flex-1 overflow-y-auto space-y-8 custom-scroll w-[340px]">
                      <div className="flex items-center justify-between pb-4 border-b border-white/5">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-honey flex items-center gap-2">
                          <Settings size={12} /> Parámetros del Post
                        </h3>
                      </div>

                      {/* Publish / Draft status toggle */}
                      <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Estado de Publicación</label>
                        <div className="bg-white/[0.02] border border-white/5 p-2.5 rounded-2xl flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider pl-1">
                            {editorIsPublished ? (
                              <span className="text-amber-honey flex items-center gap-1.5">
                                <Globe size={12} /> Público / Activo
                              </span>
                            ) : (
                              <span className="text-white/40 flex items-center gap-1.5">
                                <FileText size={12} /> Borrador Local
                              </span>
                            )}
                          </span>
                          <button
                            onClick={() => setEditorIsPublished(!editorIsPublished)}
                            className={`w-12 h-6 rounded-full p-1 transition-all ${
                              editorIsPublished ? 'bg-amber-honey' : 'bg-white/10'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-nature-night transition-all ${
                              editorIsPublished ? 'translate-x-6' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                      </div>

                      {/* Category selection */}
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
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-honey/50"
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
                            <option value="" className="bg-[#0c0d12]">Seleccionar Categoría</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id} className="bg-[#0c0d12]">
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Cover Image Upload Dropzone */}
                      <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Imagen de Portada</label>
                        
                        <div className="border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] rounded-2.5rem p-6 text-center cursor-pointer transition-colors relative group">
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
                          <div className="relative rounded-2xl overflow-hidden border border-white/10 aspect-video bg-black/40">
                            <img src={editorImagePreview} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <p className="text-[9px] font-black uppercase tracking-widest text-white">Imagen Cargada</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.aside>
                )}
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
            className="fixed inset-0 bg-[#05060a]/95 z-[210] overflow-y-auto custom-scroll flex justify-center py-20 px-6 backdrop-blur-xl"
          >
            <div className="max-w-[800px] w-full relative">
              
              {/* Floating Close Button */}
              <button
                onClick={() => setActivePost(null)}
                className="fixed top-8 right-8 md:right-20 w-12 h-12 rounded-full bg-black/40 border border-white/10 hover:border-amber-honey/40 text-white flex items-center justify-center hover:scale-105 transition-all shadow-2xl backdrop-blur-md"
              >
                <X size={18} />
              </button>

              <article className="w-full">
                
                {/* Cover Image */}
                {activePost.image && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    className="w-full aspect-[21/10] rounded-[3rem] overflow-hidden mb-12 border border-white/5 shadow-2xl"
                  >
                    <img src={activePost.image} alt={activePost.title} className="w-full h-full object-cover" />
                  </motion.div>
                )}

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-4 mb-6 text-[9px] font-black uppercase tracking-widest">
                  <span className="bg-amber-honey text-nature-night px-4.5 py-2 rounded-full shadow-lg shadow-amber-honey/20">
                    {activePost.category_name || 'Crónica'}
                  </span>
                  
                  <div className="flex items-center gap-2 text-white/40">
                    <Calendar size={12} className="text-amber-honey" /> 
                    {new Date(activePost.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  
                  <div className="flex items-center gap-2 text-white/40">
                    <User size={12} className="text-amber-honey" /> MS Ambar
                  </div>
                </div>

                {/* Title */}
                <h1 className="text-4xl md:text-7xl font-black tracking-tighter mb-10 leading-none bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                  {activePost.title}
                </h1>

                {/* Separator Line */}
                <div className="h-px bg-gradient-to-r from-amber-honey/20 via-transparent to-transparent mb-12" />

                {/* HTML content rendered dynamically */}
                <div 
                  className="rich-text-content pb-20 select-text"
                  dangerouslySetInnerHTML={{ __html: activePost.content }}
                />

              </article>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
