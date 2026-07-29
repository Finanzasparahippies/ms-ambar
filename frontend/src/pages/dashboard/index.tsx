import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { showAlert, showConfirm, showToast } from '../../lib/notifications';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import CouponManager, { Coupon } from '../../components/CouponManager';
import ThemeManager from '../../components/ThemeManager';
import {
  DollarSign,
  Ticket,
  ShoppingBag,
  Users,
  Activity,
  Database,
  Cpu,
  HardDrive,
  Layers,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Gauge,
  ExternalLink,
  Truck,
  Package,
  Landmark,
  PlusCircle,
  ClipboardList,
  Check,
  MapPin,
  Mail,
  User,
  Plus,
  Trash2,
  Calendar,
  Edit2,
  X,
  Eye,
  EyeOff,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Link2,
  Image as ImageIcon,
  ChevronDown,
  Sliders,
  Target,
  FolderOpen,
  Palette,
  Monitor,
  Tablet,
  Smartphone,
  Smile,
  Camera,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const resolveMediaUrl = (url: string | null | undefined) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const backendRoot = API_URL.replace(/\/api$/, '');
  return `${backendRoot}${url.startsWith('/') ? '' : '/'}${url}`;
};

const getHoverColor = (hex: string | null | undefined): string => {
  if (!hex) return '#d97706';
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
  }
  if (cleanHex.length !== 6) return hex;
  try {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const factor = 0.15;

    let newR, newG, newB;
    if (luminance > 0.5) {
      newR = Math.max(0, Math.floor(r * (1 - factor)));
      newG = Math.max(0, Math.floor(g * (1 - factor)));
      newB = Math.max(0, Math.floor(b * (1 - factor)));
    } else {
      newR = Math.min(255, Math.floor(r + (255 - r) * factor));
      newG = Math.min(255, Math.floor(g + (255 - g) * factor));
      newB = Math.min(255, Math.floor(b + (255 - b) * factor));
    }

    const toHex = (c: number) => {
      const h = c.toString(16);
      return h.length === 1 ? '0' + h : h;
    };
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
  } catch (e) {
    return hex;
  }
};

const formatCampaignText = (text: string, mode: 'poem' | 'letter', alignment: string = 'center') => {
  if (!text) return '';

  // Si no hay etiquetas HTML de bloque al inicio, formateamos como texto plano
  if (!text.includes('<p') && !text.includes('<div') && !text.includes('<h')) {
    const paragraphs = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split(/\n\n+/);
    const marginBottom = mode === 'poem' ? '24px' : '16px';
    return paragraphs
      .map(p => {
        const lines = p.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return '';
        const content = mode === 'poem' ? lines.join('<br/>') : lines.join(' ');
        return `<p style="margin: 0 0 ${marginBottom} 0; line-height: 1.8; font-family: inherit; text-align: ${alignment};">${content}</p>`;
      })
      .filter(Boolean)
      .join('');
  }

  // Procesamos etiquetas block del HTML conservando y ajustando sus formatos y alineación
  const blockRegex = /<(p|div|h2|h3|blockquote|ul|ol|li)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

  return text.replace(blockRegex, (match, tag, attrs, content) => {
    const t = tag.toLowerCase();
    
    // Determinar la alineación de este bloque específico
    let textAlign = alignment;
    const styleMatch = attrs.match(/text-align\s*:\s*(left|center|right|justify)/i);
    const alignMatch = attrs.match(/\balign\s*=\s*["']?(left|center|right|justify)/i);
    
    if (styleMatch) {
      textAlign = styleMatch[1].toLowerCase();
    } else if (alignMatch) {
      textAlign = alignMatch[1].toLowerCase();
    }

    // Limpiar y conservar otros estilos inline (como color de texto o estilos de fuente)
    let extraStyle = '';
    const existingStyleMatch = attrs.match(/style\s*=\s*["']([^"']*)["']/i);
    if (existingStyleMatch) {
      extraStyle = existingStyleMatch[1]
        .split(';')
        .map((s: string) => s.trim())
        .filter((s: string) => s && !s.startsWith('text-align') && !s.startsWith('margin') && !s.startsWith('line-height') && !s.startsWith('font-family'))
        .join('; ');
      if (extraStyle && !extraStyle.endsWith(';')) {
        extraStyle += ';';
      }
    }

    // Estilos inline base compatibles con emails
    let inlineStyle = `text-align: ${textAlign}; font-family: inherit; line-height: 1.8; `;
    if (t === 'p' || t === 'div') {
      const marginBottom = mode === 'poem' ? '24px' : '16px';
      inlineStyle += `margin: 0 0 ${marginBottom} 0; `;
    } else if (t === 'h2') {
      inlineStyle += `font-size: 22px; font-weight: 900; margin: 30px 0 15px 0; color: inherit; font-style: italic; `;
    } else if (t === 'h3') {
      inlineStyle += `font-size: 18px; font-weight: 800; margin: 25px 0 12px 0; color: inherit; font-style: italic; `;
    } else if (t === 'blockquote') {
      inlineStyle += `margin: 20px 0; padding: 10px 20px; border-left: 3px solid #E5A93B; background: rgba(255,255,255,0.02); font-style: italic; `;
    } else if (t === 'ul') {
      inlineStyle += `list-style-type: disc; padding-left: 20px; margin: 0 0 16px 0; `;
    } else if (t === 'ol') {
      inlineStyle += `list-style-type: decimal; padding-left: 20px; margin: 0 0 16px 0; `;
    } else if (t === 'li') {
      inlineStyle += `margin-bottom: 8px; `;
    }

    if (extraStyle) {
      inlineStyle += ' ' + extraStyle;
    }

    if (mode === 'poem' && (t === 'p' || t === 'div')) {
      content = content.replace(/\n/g, '<br/>');
    }

    return `<${t} style="${inlineStyle.trim()}">${content}</${t}>`;
  });
};

export default function AdminDashboard() {
  const resolveFontStack = (fontKey: string) => {
    switch (fontKey) {
      case 'playfair': return "'Playfair Display', Georgia, serif";
      case 'cinzel': return "'Cinzel', Georgia, serif";
      case 'garamond': return "'Cormorant Garamond', 'Times New Roman', serif";
      case 'montserrat': return "'Montserrat', Helvetica, sans-serif";
      case 'pinyon': return "'Pinyon Script', cursive";
      default: return 'Georgia, serif';
    }
  };

  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [sysMetrics, setSysMetrics] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);

  // Dashboard Navigation State
  const [activeTab, setActiveTab] = useState<'summary' | 'orders' | 'expenses' | 'catalog' | 'theaters' | 'contracts' | 'campaigns' | 'events' | 'coupons' | 'theme'>('summary');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [orderFilter, setOrderFilter] = useState<'all' | 'paid' | 'shipped' | 'delivered'>('all');

  // Campaigns & Subscribers State
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [marketingLists, setMarketingLists] = useState<any[]>([]);
  const [campMarketingList, setCampMarketingList] = useState<string>('');
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [listName, setListName] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [listErrorMsg, setListErrorMsg] = useState<string | null>(null);
  const [campaignSubTab, setCampaignSubTab] = useState<'campaigns' | 'subscribers' | 'lists'>('campaigns');
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'content' | 'theme' | 'cover' | 'sections' | 'ctas' | 'library'>('content');
  const [editingCampaign, setEditingCampaign] = useState<any | null>(null);
  const [campId, setCampId] = useState<number | null>(null);
  const [campSubject, setCampSubject] = useState('');
  const [campSenderName, setCampSenderName] = useState('Ms Ambar');
  const [hasDraft, setHasDraft] = useState(false);
  const [campPoemText, setCampPoemText] = useState('');
  const [editorActiveTab, setEditorActiveTab] = useState<'title' | 'body' | 'footer'>('body');
  const [campEmailTitle, setCampEmailTitle] = useState('');
  const [campFooterText, setCampFooterText] = useState('');
  const [templateImages, setTemplateImages] = useState<any[]>([]);
  const [libraryUploadLoading, setLibraryUploadLoading] = useState(false);
  const [isLibrarySectionOpen, setIsLibrarySectionOpen] = useState(false);
  const [campTemplateType, setCampTemplateType] = useState('minimalist');
  const [campTextMode, setCampTextMode] = useState<'poem' | 'letter'>('poem');
  const [campImageFile, setCampImageFile] = useState<File | null>(null);
  const [campImagePreview, setCampImagePreview] = useState<string | null>(null);

  // Custom Background and CTA settings
  const [campBgImageFile, setCampBgImageFile] = useState<File | null>(null);
  const [campBgImagePreview, setCampBgImagePreview] = useState<string | null>(null);
  const [campBgOpacity, setCampBgOpacity] = useState(1.0);
  const [campBgSaturation, setCampBgSaturation] = useState(100);
  const [campBgPosition, setCampBgPosition] = useState('center');
  const [campCtaText, setCampCtaText] = useState('');
  const [campCtaLink, setCampCtaLink] = useState('');
  const [campFontFamily, setCampFontFamily] = useState('serif');
  const [campTitleFontFamily, setCampTitleFontFamily] = useState('serif');
  const [campFooterFontFamily, setCampFooterFontFamily] = useState('serif');

  // Custom Section Styles (Title, Body, Footer)
  const [campTitleTextColor, setCampTitleTextColor] = useState('#ffffff');
  const [campTitleBgColor, setCampTitleBgColor] = useState('transparent');
  const [campTitleBgImage, setCampTitleBgImage] = useState('');
  const [campTitlePadding, setCampTitlePadding] = useState('0px');
  const [campTitleRadius, setCampTitleRadius] = useState('0px');

  const [campBodyTextColor, setCampBodyTextColor] = useState('');
  const [campBodyBgColor, setCampBodyBgColor] = useState('transparent');
  const [campBodyBgImage, setCampBodyBgImage] = useState('');
  const [campBodyPadding, setCampBodyPadding] = useState('0px');
  const [campBodyRadius, setCampBodyRadius] = useState('0px');
  const [campBodyAlignment, setCampBodyAlignment] = useState('center');

  const [campFooterTextColor, setCampFooterTextColor] = useState('');
  const [campFooterBgColor, setCampFooterBgColor] = useState('transparent');
  const [campFooterBgImage, setCampFooterBgImage] = useState('');
  const [campFooterPadding, setCampFooterPadding] = useState('0px');
  const [campFooterRadius, setCampFooterRadius] = useState('0px');

  const [isSectionStyleSectionOpen, setIsSectionStyleSectionOpen] = useState(false);

  // Responsive design states
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [campCardMaxWidthDesktop, setCampCardMaxWidthDesktop] = useState('680px');
  const [campCardPaddingDesktop, setCampCardPaddingDesktop] = useState('40px');
  const [campCardPaddingTablet, setCampCardPaddingTablet] = useState('40px');
  const [campCardPaddingMobile, setCampCardPaddingMobile] = useState('16px');
  
  const [campTitleFontSizeDesktop, setCampTitleFontSizeDesktop] = useState('26px');
  const [campTitleFontSizeTablet, setCampTitleFontSizeTablet] = useState('22px');
  const [campTitleFontSizeMobile, setCampTitleFontSizeMobile] = useState('18px');
  
  const [campBodyFontSizeDesktop, setCampBodyFontSizeDesktop] = useState('16px');
  const [campBodyFontSizeTablet, setCampBodyFontSizeTablet] = useState('15px');
  const [campBodyFontSizeMobile, setCampBodyFontSizeMobile] = useState('14px');
  const [campBodyAlignmentTablet, setCampBodyAlignmentTablet] = useState('center');
  const [campBodyAlignmentMobile, setCampBodyAlignmentMobile] = useState('center');
  
  const [campImageWidthTablet, setCampImageWidthTablet] = useState('100%');
  const [campImageWidthMobile, setCampImageWidthMobile] = useState('100%');
  const [campImageAlignTablet, setCampImageAlignTablet] = useState('center');
  const [campImageAlignMobile, setCampImageAlignMobile] = useState('center');
  
  const [campCtaAlignTablet, setCampCtaAlignTablet] = useState('center');
  const [campCtaAlignMobile, setCampCtaAlignMobile] = useState('center');

  const [campTitlePaddingTablet, setCampTitlePaddingTablet] = useState('0px');
  const [campTitlePaddingMobile, setCampTitlePaddingMobile] = useState('0px');
  const [campTitleRadiusTablet, setCampTitleRadiusTablet] = useState('0px');
  const [campTitleRadiusMobile, setCampTitleRadiusMobile] = useState('0px');

  const [campBodyPaddingTablet, setCampBodyPaddingTablet] = useState('0px');
  const [campBodyPaddingMobile, setCampBodyPaddingMobile] = useState('0px');
  const [campBodyRadiusTablet, setCampBodyRadiusTablet] = useState('0px');
  const [campBodyRadiusMobile, setCampBodyRadiusMobile] = useState('0px');

  const [campFooterPaddingTablet, setCampFooterPaddingTablet] = useState('0px');
  const [campFooterPaddingMobile, setCampFooterPaddingMobile] = useState('0px');
  const [campFooterRadiusTablet, setCampFooterRadiusTablet] = useState('0px');
  const [campFooterRadiusMobile, setCampFooterRadiusMobile] = useState('0px');

  const [campLoading, setCampLoading] = useState(false);
  const [campSuccessMsg, setCampSuccessMsg] = useState<string | null>(null);
  const [campErrorMsg, setCampErrorMsg] = useState<string | null>(null);
  const [previewCampaign, setPreviewCampaign] = useState<any | null>(null);
  const [sendingCampaignId, setSendingCampaignId] = useState<number | null>(null);

  // Campaign Image/CTA Customization
  const [campImageWidth, setCampImageWidth] = useState('100%');
  const [campImageAlign, setCampImageAlign] = useState('center');
  const [campImageRadius, setCampImageRadius] = useState('20px');
  const [campCtas, setCampCtas] = useState<any[]>([]);
  const [campCtaAlignment, setCampCtaAlignment] = useState('center');
  const [campCtaMarginTop, setCampCtaMarginTop] = useState('35px');
  const [campCtaMarginBottom, setCampCtaMarginBottom] = useState('25px');
  // Accordion toggle states for Campaign Editor Modal settings
  const [isFontSectionOpen, setIsFontSectionOpen] = useState(false);
  const [isCoverSectionOpen, setIsCoverSectionOpen] = useState(false);
  const [isBgSectionOpen, setIsBgSectionOpen] = useState(false);
  const [isCtaSectionOpen, setIsCtaSectionOpen] = useState(false);
  const campaignEditorRef = React.useRef<HTMLDivElement>(null);
  const syncEditorState = () => {
    if (campaignEditorRef.current) {
      const html = campaignEditorRef.current.innerHTML;
      if (editorActiveTab === 'body') setCampPoemText(html);
      else if (editorActiveTab === 'title') setCampEmailTitle(html);
      else if (editorActiveTab === 'footer') setCampFooterText(html);
    }
  };
  const isDraftPending = React.useRef(false);

  const [modalPreviewViewport, setModalPreviewViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [emojiPopoverTarget, setEmojiPopoverTarget] = useState<'subject' | 'editor' | null>(null);

  const CURATED_EMOJIS = [
    '😊', '😂', '🤣', '🥰', '😍', '😘', '😜', '🤔', '🙄', '😬', '😭', '😱', '🤫', '😴', '🤯', '🥳', '😇', '🤠', '🤡',
    '❤️', '💖', '💗', '💓', '💞', '💕', '💘', '💔', '⭐', '🌟', '✨', '⚡', '🔥', '💥', '🌈', '🌊', '❄️', '🌀',
    '🌹', '🌸', '🍃', '🍂', '🍁', '🍄', '🌵', '🐫', '🐪', '🏜️', '🌴', '🍷', '🕯️', '🎭', '🎨', '🎤', '🎧', '🎸', '🎹',
    '🔮', '📜', '✍️', '✒️', '📖', '🎟️', '🛎️', '🗝️', '🔒', '🔓', '🖤', '👑', '💎', '🏆', '🎁', '🎈', '🎉', '🎊'
  ];

  const insertEmojiToSubject = (emoji: string) => {
    const input = document.getElementById('camp-subject-input') as HTMLInputElement;
    if (input) {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const text = campSubject;
      const newValue = text.substring(0, start) + emoji + text.substring(end);
      setCampSubject(newValue);
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 10);
    } else {
      setCampSubject(campSubject + emoji);
    }
  };

  const insertEmojiToEditor = (emoji: string) => {
    if (campaignEditorRef.current) {
      campaignEditorRef.current.focus();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(emoji);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        campaignEditorRef.current.innerHTML += emoji;
      }
      const html = campaignEditorRef.current.innerHTML;
      if (editorActiveTab === 'body') setCampPoemText(html);
      else if (editorActiveTab === 'title') setCampEmailTitle(html);
      else if (editorActiveTab === 'footer') setCampFooterText(html);
    }
  };

  // Client Dashboard & Profile states
  const [isStaff, setIsStaff] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [clientTickets, setClientTickets] = useState<any[]>([]);
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [clientActiveTab, setClientActiveTab] = useState<'tickets' | 'profile'>('tickets');
  const isSuperuser = currentUser?.is_superuser || clientProfile?.is_superuser || false;

  const executeCommand = (command: string, value: string = '') => {
    if (typeof document !== 'undefined') {
      document.execCommand(command, false, value);
      campaignEditorRef.current?.focus();
      if (campaignEditorRef.current) {
        const html = campaignEditorRef.current.innerHTML;
        if (editorActiveTab === 'body') setCampPoemText(html);
        else if (editorActiveTab === 'title') setCampEmailTitle(html);
        else if (editorActiveTab === 'footer') setCampFooterText(html);
      }
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
      insertImageAtCursor(url);
    }
  };

  const handleEditorPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\r?\n/g, '<br/>');

    if (typeof document !== 'undefined') {
      if (document.queryCommandSupported('insertHTML')) {
        document.execCommand('insertHTML', false, html);
      } else {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;
        selection.deleteFromDocument();
        const el = document.createElement('div');
        el.innerHTML = html;
        const frag = document.createDocumentFragment();
        let node;
        while ((node = el.firstChild)) {
          frag.appendChild(node);
        }
        selection.getRangeAt(0).insertNode(frag);
      }

      // Update state immediately
      if (campaignEditorRef.current) {
        const newHtml = campaignEditorRef.current.innerHTML;
        if (editorActiveTab === 'body') setCampPoemText(newHtml);
        else if (editorActiveTab === 'title') setCampEmailTitle(newHtml);
        else if (editorActiveTab === 'footer') setCampFooterText(newHtml);
      }
    }
  };

  const openProfileModal = () => {
    if (clientProfile) {
      setProfileUsername(clientProfile.username || '');
      setProfileFirstName(clientProfile.first_name || '');
      setProfileLastName(clientProfile.last_name || '');
      setProfilePhone(clientProfile.phone || '');
    }
    setProfileSuccessMsg('');
    setIsProfileModalOpen(true);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccessMsg('');
    const token = localStorage.getItem('token');
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    try {
      const res = await axios.put(`${API_URL}/users/profile/`, {
        username: profileUsername,
        first_name: profileFirstName,
        last_name: profileLastName,
        phone: profilePhone,
      }, { headers });
      setClientProfile(res.data.user || res.data);
      setProfileSuccessMsg('¡Perfil actualizado con éxito!');

      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          const updatedUser = res.data.user || res.data;
          u.username = updatedUser.username;
          u.first_name = updatedUser.first_name;
          u.last_name = updatedUser.last_name;
          localStorage.setItem('user', JSON.stringify(u));
          setCurrentUser(u);
        } catch (err) { }
      }
      setTimeout(() => {
        setIsProfileModalOpen(false);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      showToast.error('Error al actualizar el perfil.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  // User Profile Edit Form states
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileUsername, setProfileUsername] = useState('');
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  // CSV Import State
  const [importCsvFile, setImportCsvFile] = useState<File | null>(null);
  const [importCsvMarketingList, setImportCsvMarketingList] = useState<string>('');
  const [importCsvLoading, setImportCsvLoading] = useState(false);
  const [importCsvError, setImportCsvError] = useState<string | null>(null);
  const [importCsvSuccess, setImportCsvSuccess] = useState<string | null>(null);

  // Shipment Simulator State
  const [shippingOrderId, setShippingOrderId] = useState<number | null>(null);
  const [shippingStep, setShippingStep] = useState<'idle' | 'contacting' | 'generating' | 'success'>('idle');
  const [simulatedTracking, setSimulatedTracking] = useState('');

  // Add Expense Form State
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Logística & Envío');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseSuccess, setExpenseSuccess] = useState(false);

  // Merchandise Catalog Administration State
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [catalogSubTab, setCatalogSubTab] = useState<'products' | 'categories'>('products');

  // Modals & Active Edit Forms
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Product Form Fields
  const [prodId, setProdId] = useState<number | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodSlug, setProdSlug] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodCategory, setProdCategory] = useState('');
  const [prodIsActive, setProdIsActive] = useState(true);
  const [prodImageFile, setProdImageFile] = useState<File | null>(null);
  const [prodImagePreview, setProdImagePreview] = useState<string | null>(null);

  // Category Form Fields
  const [catId, setCatId] = useState<number | null>(null);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');

  // Catalog Status Notifications
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSuccessMsg, setCatalogSuccessMsg] = useState<string | null>(null);
  const [catalogErrorMsg, setCatalogErrorMsg] = useState<string | null>(null);

  // ─── CTA Hover States ───
  const [hoveredEditorCta, setHoveredEditorCta] = useState<number | null>(null);
  const [hoveredModalCta, setHoveredModalCta] = useState<number | null>(null);
  const [hoveredEditorSingleCta, setHoveredEditorSingleCta] = useState(false);
  const [hoveredModalSingleCta, setHoveredModalSingleCta] = useState(false);

  // ─── Events State ───
  const [events, setEvents] = useState<any[]>([]);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventArtist, setEventArtist] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState<'concert' | 'meet_greet'>('concert');
  const [eventTheater, setEventTheater] = useState('');
  const [eventMgPrice, setEventMgPrice] = useState('0');
  const [eventMgLimit, setEventMgLimit] = useState('0');
  const [eventPriceMultiplier, setEventPriceMultiplier] = useState('1.0');
  const [eventIsActive, setEventIsActive] = useState(true);
  const [eventImageFile, setEventImageFile] = useState<File | null>(null);
  const [eventImagePreview, setEventImagePreview] = useState<string | null>(null);
  const [eventFlyerFile, setEventFlyerFile] = useState<File | null>(null);
  const [eventFlyerPreview, setEventFlyerPreview] = useState<string | null>(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [eventSuccessMsg, setEventSuccessMsg] = useState<string | null>(null);
  const [eventErrorMsg, setEventErrorMsg] = useState<string | null>(null);

  // ─── Theaters State (Nectar Pro) ───
  const [theaters, setTheaters] = useState<any[]>([]);
  const [isTheaterModalOpen, setIsTheaterModalOpen] = useState(false);
  const [editingTheater, setEditingTheater] = useState<any | null>(null);
  const [theaterName, setTheaterName] = useState('');
  const [theaterLocation, setTheaterLocation] = useState('');
  const [theaterLoading, setTheaterLoading] = useState(false);
  const [theaterSuccessMsg, setTheaterSuccessMsg] = useState<string | null>(null);
  const [theaterErrorMsg, setTheaterErrorMsg] = useState<string | null>(null);
  const [theaterSyncStatus, setTheaterSyncStatus] = useState<Record<number, 'idle' | 'loading' | 'success' | 'error'>>({});

  // ─── Site Settings State (Dynamic Texts) ───
  const [siteSettingsSubtitle, setSiteSettingsSubtitle] = useState('Selecciona tu concierto, explora el mapa de asientos interactivo y reserva tus boletos oficiales.');
  const [siteSettingsCta, setSiteSettingsCta] = useState('¡Próximamente nuevo evento!');
  const [siteSettingsLoading, setSiteSettingsLoading] = useState(false);
  const [siteSettingsSuccess, setSiteSettingsSuccess] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login?redirect=/dashboard');
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    // Determine if user is staff or client
    const userStr = localStorage.getItem('user');
    let staffFlag = false;
    let superuserFlag = false;
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        setCurrentUser(u);
        staffFlag = u.is_staff || false;
        superuserFlag = u.is_superuser || false;
        setIsStaff(staffFlag);
      } catch (e) { }
    }

    setLoading(true);
    setError(null);

    try {
      if (staffFlag) {
        if (!superuserFlag && activeTab === 'summary') {
          setActiveTab('orders');
        }
        // Staff/Admin Data Fetching
        const [analyticsRes, systemRes, ordersRes, expensesRes, productsRes, categoriesRes, theatersRes, contractsRes, campaignsRes, subscribersRes, profileRes, templateImagesRes, eventsRes, siteSettingsRes, marketingListsRes, couponsRes] = await Promise.all([
          axios.get(`${API_URL}/dashboard/analytics/`, { headers }),
          axios.get(`${API_URL}/dashboard/system/`, { headers }).catch(err => {
            console.error("System metrics fetch failed, using fallback", err);
            return { data: null };
          }),
          axios.get(`${API_URL}/dashboard/orders/`, { headers }),
          axios.get(`${API_URL}/dashboard/expenses/`, { headers }),
          axios.get(`${API_URL}/shop/products/`, { headers }),
          axios.get(`${API_URL}/shop/categories/`, { headers }),
          axios.get(`${API_URL}/tickets/theaters/`).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/bookings/contracts/`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/blog/campaigns/`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/blog/subscribers/`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/users/profile/`, { headers }).catch(() => ({ data: null })),
          axios.get(`${API_URL}/blog/campaign-template-images/`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/tickets/events/`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/tickets/settings/`).catch(() => ({ data: null })),
          axios.get(`${API_URL}/blog/marketing-lists/`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/tickets/coupons/`, { headers }).catch(() => ({ data: [] })),
        ]);

        setStats(analyticsRes.data);
        setOrders(ordersRes.data);
        setExpenses(expensesRes.data);
        setProducts(productsRes.data);
        setCategories(categoriesRes.data);
        setTheaters(Array.isArray(theatersRes.data) ? theatersRes.data : []);
        setContracts(Array.isArray(contractsRes.data) ? contractsRes.data : []);
        setCampaigns(Array.isArray(campaignsRes.data) ? campaignsRes.data : []);
        setSubscribers(Array.isArray(subscribersRes.data) ? subscribersRes.data : []);
        setTemplateImages(Array.isArray(templateImagesRes.data) ? templateImagesRes.data : []);
        setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
        setMarketingLists(Array.isArray(marketingListsRes.data) ? marketingListsRes.data : []);
        setCoupons(Array.isArray(couponsRes.data) ? couponsRes.data : []);
        if (siteSettingsRes?.data) {
          if (siteSettingsRes.data.tickets_page_subtitle) setSiteSettingsSubtitle(siteSettingsRes.data.tickets_page_subtitle);
          if (siteSettingsRes.data.homepage_cta_text) setSiteSettingsCta(siteSettingsRes.data.homepage_cta_text);
        }
        if (profileRes && profileRes.data) {
          setClientProfile(profileRes.data);
          const realSuperuser = profileRes.data.is_superuser || false;
          if (!realSuperuser && activeTab === 'summary') {
            setActiveTab('orders');
          }
          // Sync superuser status in currentUser and localStorage
          const userStr = localStorage.getItem('user');
          if (userStr) {
            try {
              const u = JSON.parse(userStr);
              if (u.is_superuser !== realSuperuser) {
                u.is_superuser = realSuperuser;
                localStorage.setItem('user', JSON.stringify(u));
                setCurrentUser(u);
              }
            } catch (err) {}
          }
        }
        if (systemRes.data) {
          setSysMetrics(systemRes.data);
        }
      } else {
        // Client Data Fetching
        const [profileRes, ticketsRes] = await Promise.all([
          axios.get(`${API_URL}/users/profile/`, { headers }),
          axios.get(`${API_URL}/tickets/tickets/`, { headers }).catch(() => ({ data: [] }))
        ]);

        setClientProfile(profileRes.data);
        setClientTickets(Array.isArray(ticketsRes.data) ? ticketsRes.data : []);
      }
    } catch (err: any) {
      console.error("Error fetching dashboard data", err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Sesión expirada o acceso denegado. Redirigiendo...");
        setTimeout(() => {
          router.push('/login?redirect=/dashboard');
        }, 2000);
      } else {
        setError("Error de red al cargar el panel.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (campaignEditorRef.current) {
      if (editorActiveTab === 'title') {
        campaignEditorRef.current.innerHTML = campEmailTitle || '';
      } else if (editorActiveTab === 'body') {
        campaignEditorRef.current.innerHTML = campPoemText || '';
      } else if (editorActiveTab === 'footer') {
        campaignEditorRef.current.innerHTML = campFooterText || '';
      }
    }
  }, [editorActiveTab, settingsTab]);

  useEffect(() => {
    if (previewCampaign) {
      setModalPreviewViewport('desktop');
    }
  }, [previewCampaign]);

  useEffect(() => {
    let interval: any;
    if (isStaff) {
      // Poll system metrics every 15 seconds only for admins
      interval = setInterval(async () => {
        try {
          const token = localStorage.getItem('token');
          const res = await axios.get(`${API_URL}/dashboard/system/`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setSysMetrics(res.data);
        } catch (e) {
          // Silent error for polling
        }
      }, 15000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStaff]);

  // Draft Campaign Auto-Saver System
  useEffect(() => {
    if (isCampaignModalOpen && !isDraftPending.current) {
      const cleanImagePreview = campImagePreview && campImagePreview.startsWith('data:') ? null : campImagePreview;
      const cleanBgImagePreview = campBgImagePreview && campBgImagePreview.startsWith('data:') ? null : campBgImagePreview;

      const draft = {
        campId,
        campSubject,
        campSenderName,
        campPoemText,
        campEmailTitle,
        campFooterText,
        campTemplateType,
        campCtaText,
        campCtaLink,
        campFontFamily,
        campTitleFontFamily,
        campFooterFontFamily,
        campTitleTextColor,
        campTitleBgColor,
        campTitleBgImage,
        campTitlePadding,
        campTitleRadius,
        campBodyTextColor,
        campBodyBgColor,
        campBodyBgImage,
        campBodyPadding,
        campBodyRadius,
        campFooterTextColor,
        campFooterBgColor,
        campFooterBgImage,
        campFooterPadding,
        campFooterRadius,
        campImageWidth,
        campImageAlign,
        campImageRadius,
        campCtas,
        campCtaAlignment,
        campCtaMarginTop,
        campCtaMarginBottom,
        campBgOpacity,
        campBgSaturation,
        campBgPosition,
        campBodyAlignment,
        campCardMaxWidthDesktop,
        campCardPaddingDesktop,
        campCardPaddingTablet,
        campCardPaddingMobile,
        campTitleFontSizeDesktop,
        campTitleFontSizeTablet,
        campTitleFontSizeMobile,
        campBodyFontSizeDesktop,
        campBodyFontSizeTablet,
        campBodyFontSizeMobile,
        campBodyAlignmentTablet,
        campBodyAlignmentMobile,
        campImageWidthTablet,
        campImageWidthMobile,
        campImageAlignTablet,
        campImageAlignMobile,
        campCtaAlignTablet,
        campCtaAlignMobile,
        campTitlePaddingTablet,
        campTitlePaddingMobile,
        campTitleRadiusTablet,
        campTitleRadiusMobile,
        campBodyPaddingTablet,
        campBodyPaddingMobile,
        campBodyRadiusTablet,
        campBodyRadiusMobile,
        campFooterPaddingTablet,
        campFooterPaddingMobile,
        campFooterRadiusTablet,
        campFooterRadiusMobile,
        campImagePreview: cleanImagePreview,
        campBgImagePreview: cleanBgImagePreview
      };
      try {
        localStorage.setItem('ms_ambar_campaign_draft', JSON.stringify(draft));
      } catch (e) {
        console.warn('Failed to save campaign draft to localStorage:', e);
      }
    }
  }, [
    isCampaignModalOpen,
    campId,
    campSubject,
    campSenderName,
    campPoemText,
    campEmailTitle,
    campFooterText,
    campTemplateType,
    campCtaText,
    campCtaLink,
    campFontFamily,
    campTitleFontFamily,
    campFooterFontFamily,
    campTitleTextColor,
    campTitleBgColor,
    campTitleBgImage,
    campTitlePadding,
    campTitleRadius,
    campBodyTextColor,
    campBodyBgColor,
    campBodyBgImage,
    campBodyPadding,
    campBodyRadius,
    campFooterTextColor,
    campFooterBgColor,
    campFooterBgImage,
    campFooterPadding,
    campFooterRadius,
    campImageWidth,
    campImageAlign,
    campImageRadius,
    campCtas,
    campCtaAlignment,
    campCtaMarginTop,
    campCtaMarginBottom,
    campBgOpacity,
    campBgSaturation,
    campBgPosition,
    campImagePreview,
    campBgImagePreview,
    campBodyAlignment,
    campCardMaxWidthDesktop,
    campCardPaddingDesktop,
    campCardPaddingTablet,
    campCardPaddingMobile,
    campTitleFontSizeDesktop,
    campTitleFontSizeTablet,
    campTitleFontSizeMobile,
    campBodyFontSizeDesktop,
    campBodyFontSizeTablet,
    campBodyFontSizeMobile,
    campBodyAlignmentTablet,
    campBodyAlignmentMobile,
    campImageWidthTablet,
    campImageWidthMobile,
    campImageAlignTablet,
    campImageAlignMobile,
    campCtaAlignTablet,
    campCtaAlignMobile,
    campTitlePaddingTablet,
    campTitlePaddingMobile,
    campTitleRadiusTablet,
    campTitleRadiusMobile,
    campBodyPaddingTablet,
    campBodyPaddingMobile,
    campBodyRadiusTablet,
    campBodyRadiusMobile,
    campFooterPaddingTablet,
    campFooterPaddingMobile,
    campFooterRadiusTablet,
    campFooterRadiusMobile
  ]);

  const restoreDraft = () => {
    const draftStr = localStorage.getItem('ms_ambar_campaign_draft');
    if (!draftStr) return;
    try {
      const draft = JSON.parse(draftStr);
      setCampId(draft.campId ?? null);
      setCampSubject(draft.campSubject ?? '');
      setCampSenderName(draft.campSenderName ?? 'Ms Ambar');
      setCampPoemText(draft.campPoemText ?? '');
      setCampEmailTitle(draft.campEmailTitle ?? '');
      setCampFooterText(draft.campFooterText ?? '');
      setCampTemplateType(draft.campTemplateType ?? 'minimalist');
      setCampCtaText(draft.campCtaText ?? '');
      setCampCtaLink(draft.campCtaLink ?? '');
      setCampFontFamily(draft.campFontFamily ?? 'serif');
      setCampTitleFontFamily(draft.campTitleFontFamily ?? 'serif');
      setCampFooterFontFamily(draft.campFooterFontFamily ?? 'serif');
      setCampTitleTextColor(draft.campTitleTextColor ?? '#ffffff');
      setCampTitleBgColor(draft.campTitleBgColor ?? 'transparent');
      setCampTitleBgImage(draft.campTitleBgImage ?? '');
      setCampTitlePadding(draft.campTitlePadding ?? '0px');
      setCampTitleRadius(draft.campTitleRadius ?? '0px');
      setCampBodyTextColor(draft.campBodyTextColor ?? '');
      setCampBodyBgColor(draft.campBodyBgColor ?? 'transparent');
      setCampBodyBgImage(draft.campBodyBgImage ?? '');
      setCampBodyPadding(draft.campBodyPadding ?? '0px');
      setCampBodyRadius(draft.campBodyRadius ?? '0px');
      setCampFooterTextColor(draft.campFooterTextColor ?? '');
      setCampFooterBgColor(draft.campFooterBgColor ?? 'transparent');
      setCampFooterBgImage(draft.campFooterBgImage ?? '');
      setCampFooterPadding(draft.campFooterPadding ?? '0px');
      setCampFooterRadius(draft.campFooterRadius ?? '0px');
      setCampImageWidth(draft.campImageWidth ?? '100%');
      setCampImageAlign(draft.campImageAlign ?? 'center');
      setCampImageRadius(draft.campImageRadius ?? '20px');
      setCampCtas(draft.campCtas ?? []);
      setCampCtaAlignment(draft.campCtaAlignment ?? 'center');
      setCampCtaMarginTop(draft.campCtaMarginTop ?? '35px');
      setCampCtaMarginBottom(draft.campCtaMarginBottom ?? '25px');
      setCampBgOpacity(draft.campBgOpacity ?? 1.0);
      setCampBgSaturation(draft.campBgSaturation ?? 100);
      setCampBgPosition(draft.campBgPosition ?? 'center');
      setCampImagePreview(draft.campImagePreview ?? null);
      setCampBgImagePreview(draft.campBgImagePreview ?? null);
      setCampBodyAlignment(draft.campBodyAlignment ?? 'center');
      setCampCardMaxWidthDesktop(draft.campCardMaxWidthDesktop ?? '680px');
      setCampCardPaddingDesktop(draft.campCardPaddingDesktop ?? '40px');
      setCampCardPaddingTablet(draft.campCardPaddingTablet ?? '40px');
      setCampCardPaddingMobile(draft.campCardPaddingMobile ?? '16px');
      setCampTitleFontSizeDesktop(draft.campTitleFontSizeDesktop ?? '26px');
      setCampTitleFontSizeTablet(draft.campTitleFontSizeTablet ?? '22px');
      setCampTitleFontSizeMobile(draft.campTitleFontSizeMobile ?? '18px');
      setCampBodyFontSizeDesktop(draft.campBodyFontSizeDesktop ?? '16px');
      setCampBodyFontSizeTablet(draft.campBodyFontSizeTablet ?? '15px');
      setCampBodyFontSizeMobile(draft.campBodyFontSizeMobile ?? '14px');
      setCampBodyAlignmentTablet(draft.campBodyAlignmentTablet ?? 'center');
      setCampBodyAlignmentMobile(draft.campBodyAlignmentMobile ?? 'center');
      setCampImageWidthTablet(draft.campImageWidthTablet ?? '100%');
      setCampImageWidthMobile(draft.campImageWidthMobile ?? '100%');
      setCampImageAlignTablet(draft.campImageAlignTablet ?? 'center');
      setCampImageAlignMobile(draft.campImageAlignMobile ?? 'center');
      setCampCtaAlignTablet(draft.campCtaAlignTablet ?? 'center');
      setCampCtaAlignMobile(draft.campCtaAlignMobile ?? 'center');
      setCampTitlePaddingTablet(draft.campTitlePaddingTablet ?? '0px');
      setCampTitlePaddingMobile(draft.campTitlePaddingMobile ?? '0px');
      setCampTitleRadiusTablet(draft.campTitleRadiusTablet ?? '0px');
      setCampTitleRadiusMobile(draft.campTitleRadiusMobile ?? '0px');
      setCampBodyPaddingTablet(draft.campBodyPaddingTablet ?? '0px');
      setCampBodyPaddingMobile(draft.campBodyPaddingMobile ?? '0px');
      setCampBodyRadiusTablet(draft.campBodyRadiusTablet ?? '0px');
      setCampBodyRadiusMobile(draft.campBodyRadiusMobile ?? '0px');
      setCampFooterPaddingTablet(draft.campFooterPaddingTablet ?? '0px');
      setCampFooterPaddingMobile(draft.campFooterPaddingMobile ?? '0px');
      setCampFooterRadiusTablet(draft.campFooterRadiusTablet ?? '0px');
      setCampFooterRadiusMobile(draft.campFooterRadiusMobile ?? '0px');

      setTimeout(() => {
        if (campaignEditorRef.current) {
          campaignEditorRef.current.innerHTML = draft.campPoemText || '';
        }
      }, 100);

      isDraftPending.current = false;
      setHasDraft(false);
    } catch (e) {
      // ignore
    }
  };

  const discardDraft = () => {
    localStorage.removeItem('ms_ambar_campaign_draft');
    isDraftPending.current = false;
    setHasDraft(false);
  };

  // ════ Campaign CRUD Handlers ════
  const openCampaignCreateModal = () => {
    isDraftPending.current = false;
    setHasDraft(false);

    if (typeof window !== 'undefined') {
      const draftStr = localStorage.getItem('ms_ambar_campaign_draft');
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          if (!draft.campId && (draft.campSubject || draft.campPoemText || draft.campEmailTitle)) {
            isDraftPending.current = true;
            setHasDraft(true);
          }
        } catch (e) {
          // ignore
        }
      }
    }

    setEditingCampaign(null);
    setCampId(null);
    setCampSubject('');
    setCampMarketingList('');
    setCampSenderName('Ms Ambar');
    setCampPoemText('');
    setCampTemplateType('minimalist');
    setCampTextMode('poem');
    setCampImageFile(null);
    setCampImagePreview(null);
    setCampBgImageFile(null);
    setCampBgImagePreview(null);
    setCampBgOpacity(1.0);
    setCampBgSaturation(100);
    setCampBgPosition('center');
    setCampCtaText('');
    setCampCtaLink('');
    setCampFontFamily('serif');
    setCampTitleFontFamily('serif');
    setCampFooterFontFamily('serif');
    setCampImageWidth('100%');
    setCampImageAlign('center');
    setCampImageRadius('20px');
    setCampCtas([]);
    setCampCtaAlignment('center');
    setCampCtaMarginTop('35px');
    setCampCtaMarginBottom('25px');
    setCampBodyAlignment('center');
    setCampCardMaxWidthDesktop('680px');
    setCampCardPaddingDesktop('40px');
    setCampCardPaddingTablet('40px');
    setCampCardPaddingMobile('16px');
    setCampTitleFontSizeDesktop('26px');
    setCampTitleFontSizeTablet('22px');
    setCampTitleFontSizeMobile('18px');
    setCampBodyFontSizeDesktop('16px');
    setCampBodyFontSizeTablet('15px');
    setCampBodyFontSizeMobile('14px');
    setCampBodyAlignmentTablet('center');
    setCampBodyAlignmentMobile('center');
    setCampImageWidthTablet('100%');
    setCampImageWidthMobile('100%');
    setCampImageAlignTablet('center');
    setCampImageAlignMobile('center');
    setCampCtaAlignTablet('center');
    setCampCtaAlignMobile('center');
    setPreviewViewport('desktop');
    setEditorActiveTab('body');
    setCampEmailTitle('');
    setCampFooterText('');
    setCampErrorMsg(null);
    setCampSuccessMsg(null);
    setCampTitleTextColor('#ffffff');
    setCampTitleBgColor('transparent');
    setCampTitleBgImage('');
    setCampTitlePadding('0px');
    setCampTitleRadius('0px');
    setCampBodyTextColor('');
    setCampBodyBgColor('transparent');
    setCampBodyBgImage('');
    setCampBodyPadding('0px');
    setCampBodyRadius('0px');
    setCampFooterTextColor('');
    setCampFooterBgColor('transparent');
    setCampFooterBgImage('');
    setCampFooterPadding('0px');
    setCampFooterRadius('0px');
    setCampTitlePaddingTablet('0px');
    setCampTitlePaddingMobile('0px');
    setCampTitleRadiusTablet('0px');
    setCampTitleRadiusMobile('0px');
    setCampBodyPaddingTablet('0px');
    setCampBodyPaddingMobile('0px');
    setCampBodyRadiusTablet('0px');
    setCampBodyRadiusMobile('0px');
    setCampFooterPaddingTablet('0px');
    setCampFooterPaddingMobile('0px');
    setCampFooterRadiusTablet('0px');
    setCampFooterRadiusMobile('0px');
    setIsPreviewExpanded(false);
    setIsSectionStyleSectionOpen(false);
    setIsFontSectionOpen(false);
    setIsCoverSectionOpen(false);
    setIsBgSectionOpen(false);
    setIsCtaSectionOpen(false);
    setIsLibrarySectionOpen(false);
    setIsCampaignModalOpen(true);

    setTimeout(() => {
      if (campaignEditorRef.current) {
        campaignEditorRef.current.innerHTML = '';
      }
    }, 100);
  };

  const openCampaignEditModal = (campaign: any) => {
    isDraftPending.current = false;
    setHasDraft(false);

    if (typeof window !== 'undefined') {
      const draftStr = localStorage.getItem('ms_ambar_campaign_draft');
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          if (draft.campId === campaign.id && (draft.campSubject || draft.campPoemText || draft.campEmailTitle)) {
            isDraftPending.current = true;
            setHasDraft(true);
          }
        } catch (e) {
          // ignore
        }
      }
    }

    setEditingCampaign(campaign);
    setCampId(campaign.id);
    setCampSubject(campaign.subject);
    setCampMarketingList(campaign.marketing_list || '');
    setCampPoemText(campaign.poem_text);
    setEditorActiveTab('body');
    setCampEmailTitle(campaign.email_title || '');
    setCampFooterText(campaign.footer_text || '');
    setCampTemplateType(campaign.template_type);
    setCampImageFile(null);
    setCampImagePreview(campaign.image || null);
    setCampBgImageFile(null);
    setCampBgImagePreview(campaign.bg_image || null);
    setCampBgOpacity(campaign.bg_opacity ?? 1.0);
    setCampBgSaturation(campaign.bg_saturation ?? 100);
    setCampBgPosition(campaign.bg_position || 'center');
    setCampCtaText(campaign.cta_text || '');
    setCampCtaLink(campaign.cta_link || '');
    setCampFontFamily(campaign.font_family || 'serif');
    setCampTitleFontFamily(campaign.title_font_family || 'serif');
    setCampFooterFontFamily(campaign.footer_font_family || 'serif');
    setCampImageWidth(campaign.image_style?.width || '100%');
    setCampImageAlign(campaign.image_style?.align || 'center');
    setCampImageRadius(campaign.image_style?.radius || '20px');

    const styles = campaign.custom_styles || {};
    setCampTextMode(styles.text_mode || 'poem');
    setCampSenderName(styles.sender_name || 'Ms Ambar');
    setCampCtaAlignment(styles.cta_alignment || 'center');
    setCampCtaMarginTop(styles.cta_margin_top || '35px');
    setCampCtaMarginBottom(styles.cta_margin_bottom || '25px');
    setCampTitleTextColor(styles.title_color || '#ffffff');
    setCampTitleBgColor(styles.title_bg_color || 'transparent');
    setCampTitleBgImage(styles.title_bg_image || '');
    setCampTitlePadding(styles.title_padding || '0px');
    setCampTitleRadius(styles.title_radius || '0px');
    setCampBodyTextColor(styles.body_color || '');
    setCampBodyBgColor(styles.body_bg_color || 'transparent');
    setCampBodyBgImage(styles.body_bg_image || '');
    setCampBodyPadding(styles.body_padding || '0px');
    setCampBodyRadius(styles.body_radius || '0px');
    setCampBodyAlignment(styles.body_alignment || 'center');
    setCampFooterTextColor(styles.footer_color || '');
    setCampFooterBgColor(styles.footer_bg_color || 'transparent');
    setCampFooterBgImage(styles.footer_bg_image || '');
    setCampFooterPadding(styles.footer_padding || '0px');
    setCampFooterRadius(styles.footer_radius || '0px');
    setCampCardMaxWidthDesktop(styles.card_max_width_desktop || '680px');
    setCampCardPaddingDesktop(styles.card_padding_desktop || '40px');
    setCampCardPaddingTablet(styles.card_padding_tablet || '40px');
    setCampCardPaddingMobile(styles.card_padding_mobile || '16px');
    setCampTitleFontSizeDesktop(styles.title_font_size_desktop || '26px');
    setCampTitleFontSizeTablet(styles.title_font_size_tablet || '22px');
    setCampTitleFontSizeMobile(styles.title_font_size_mobile || '18px');
    setCampBodyFontSizeDesktop(styles.body_font_size_desktop || '16px');
    setCampBodyFontSizeTablet(styles.body_font_size_tablet || '15px');
    setCampBodyFontSizeMobile(styles.body_font_size_mobile || '14px');
    setCampBodyAlignmentTablet(styles.body_alignment_tablet || 'center');
    setCampBodyAlignmentMobile(styles.body_alignment_mobile || 'center');
    setCampImageWidthTablet(styles.image_width_tablet || campaign.image_style?.width || '100%');
    setCampImageWidthMobile(styles.image_width_mobile || campaign.image_style?.width || '100%');
    setCampImageAlignTablet(styles.image_align_tablet || campaign.image_style?.align || 'center');
    setCampImageAlignMobile(styles.image_align_mobile || campaign.image_style?.align || 'center');
    setCampCtaAlignTablet(styles.cta_alignment_tablet || styles.cta_alignment || 'center');
    setCampCtaAlignMobile(styles.cta_alignment_mobile || styles.cta_alignment || 'center');
    
    // Load responsive section styles
    setCampTitlePaddingTablet(styles.title_padding_tablet || styles.title_padding || '0px');
    setCampTitlePaddingMobile(styles.title_padding_mobile || styles.title_padding_tablet || styles.title_padding || '0px');
    setCampTitleRadiusTablet(styles.title_radius_tablet || styles.title_radius || '0px');
    setCampTitleRadiusMobile(styles.title_radius_mobile || styles.title_radius_tablet || styles.title_radius || '0px');
    
    setCampBodyPaddingTablet(styles.body_padding_tablet || styles.body_padding || '0px');
    setCampBodyPaddingMobile(styles.body_padding_mobile || styles.body_padding_tablet || styles.body_padding || '0px');
    setCampBodyRadiusTablet(styles.body_radius_tablet || styles.body_radius || '0px');
    setCampBodyRadiusMobile(styles.body_radius_mobile || styles.body_radius_tablet || styles.body_radius || '0px');
    
    setCampFooterPaddingTablet(styles.footer_padding_tablet || styles.footer_padding || '0px');
    setCampFooterPaddingMobile(styles.footer_padding_mobile || styles.footer_padding_tablet || styles.footer_padding || '0px');
    setCampFooterRadiusTablet(styles.footer_radius_tablet || styles.footer_radius || '0px');
    setCampFooterRadiusMobile(styles.footer_radius_mobile || styles.footer_radius_tablet || styles.footer_radius || '0px');
    
    setPreviewViewport('desktop');
    setIsPreviewExpanded(false);
    setIsSectionStyleSectionOpen(false);

    let initialCtas = campaign.ctas || [];
    if (initialCtas.length === 0 && campaign.cta_text && campaign.cta_link) {
      initialCtas = [{ text: campaign.cta_text, link: campaign.cta_link, bg_color: '', text_color: '#030303', radius: '12px' }];
    }
    setCampCtas(initialCtas);

    setCampErrorMsg(null);
    setCampSuccessMsg(null);
    setIsFontSectionOpen(false);
    setIsCoverSectionOpen(false);
    setIsBgSectionOpen(false);
    setIsCtaSectionOpen(false);
    setIsLibrarySectionOpen(false);
    setIsCampaignModalOpen(true);

    setTimeout(() => {
      if (campaignEditorRef.current) {
        campaignEditorRef.current.innerHTML = campaign.poem_text || '';
      }
    }, 100);
  };

  const handleListSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listName.trim()) {
      setListErrorMsg('El nombre de la lista es obligatorio.');
      return;
    }
    setListLoading(true);
    setListErrorMsg(null);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      await axios.post(`${API_URL}/blog/marketing-lists/`, {
        name: listName,
        description: listDescription
      }, { headers });

      // Refresh list data
      const listsRes = await axios.get(`${API_URL}/blog/marketing-lists/`, { headers });
      setMarketingLists(listsRes.data);

      setListName('');
      setListDescription('');
      setIsListModalOpen(false);
      showToast.success('Lista de marketing creada con éxito!');
    } catch (err: any) {
      setListErrorMsg(err.response?.data?.error || err.response?.data?.detail || 'Error al crear la lista.');
    } finally {
      setListLoading(false);
    }
  };

  const handleCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campSubject.trim()) { setCampErrorMsg('El asunto es obligatorio.'); return; }

    let finalPoemText = campPoemText;
    let finalEmailTitle = campEmailTitle;
    let finalFooterText = campFooterText;

    if (campaignEditorRef.current) {
      const currentContent = campaignEditorRef.current.innerHTML;
      if (editorActiveTab === 'body') finalPoemText = currentContent;
      else if (editorActiveTab === 'title') finalEmailTitle = currentContent;
      else if (editorActiveTab === 'footer') finalFooterText = currentContent;
    }

    if (!finalPoemText.trim() || finalPoemText.trim() === '<br>') {
      setCampErrorMsg('El cuerpo del poema es obligatorio.');
      return;
    }

    setCampLoading(true);
    setCampErrorMsg(null);
    setCampSuccessMsg(null);

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const formData = new FormData();
    formData.append('subject', campSubject);
    if (campMarketingList) {
      formData.append('marketing_list', campMarketingList);
    }
    formData.append('poem_text', finalPoemText);
    formData.append('email_title', finalEmailTitle);
    formData.append('footer_text', finalFooterText);
    formData.append('template_type', campTemplateType);
    if (campImageFile) {
      formData.append('image', campImageFile);
    } else if (!campImagePreview) {
      formData.append('image', '');
    }
    formData.append('bg_opacity', String(campBgOpacity));
    formData.append('bg_saturation', String(campBgSaturation));
    formData.append('bg_position', campBgPosition);
    formData.append('cta_text', campCtaText);
    formData.append('cta_link', campCtaLink);
    formData.append('font_family', campFontFamily);
    formData.append('title_font_family', campTitleFontFamily);
    formData.append('footer_font_family', campFooterFontFamily);
    if (campBgImageFile) {
      formData.append('bg_image', campBgImageFile);
    } else if (!campBgImagePreview) {
      formData.append('bg_image', '');
    }
    formData.append('image_style', JSON.stringify({
      width: campImageWidth,
      align: campImageAlign,
      radius: campImageRadius
    }));
    formData.append('ctas', JSON.stringify(campCtas));

    const customStyles = {
      text_mode: campTextMode,
      sender_name: campSenderName,
      cta_alignment: campCtaAlignment,
      cta_margin_top: campCtaMarginTop,
      cta_margin_bottom: campCtaMarginBottom,
      title_color: campTitleTextColor,
      title_bg_color: campTitleBgColor,
      title_bg_image: campTitleBgImage,
      title_padding: campTitlePadding,
      title_radius: campTitleRadius,
      body_color: campBodyTextColor,
      body_bg_color: campBodyBgColor,
      body_bg_image: campBodyBgImage,
      body_padding: campBodyPadding,
      body_radius: campBodyRadius,
      body_alignment: campBodyAlignment,
      footer_color: campFooterTextColor,
      footer_bg_color: campFooterBgColor,
      footer_bg_image: campFooterBgImage,
      footer_padding: campFooterPadding,
      footer_radius: campFooterRadius,
      card_max_width_desktop: campCardMaxWidthDesktop,
      card_padding_desktop: campCardPaddingDesktop,
      card_padding_tablet: campCardPaddingTablet,
      card_padding_mobile: campCardPaddingMobile,
      title_font_size_desktop: campTitleFontSizeDesktop,
      title_font_size_tablet: campTitleFontSizeTablet,
      title_font_size_mobile: campTitleFontSizeMobile,
      body_font_size_desktop: campBodyFontSizeDesktop,
      body_font_size_tablet: campBodyFontSizeTablet,
      body_font_size_mobile: campBodyFontSizeMobile,
      body_alignment_desktop: campBodyAlignment,
      body_alignment_tablet: campBodyAlignmentTablet,
      body_alignment_mobile: campBodyAlignmentMobile,
      image_width_tablet: campImageWidthTablet,
      image_width_mobile: campImageWidthMobile,
      image_align_tablet: campImageAlignTablet,
      image_align_mobile: campImageAlignMobile,
      cta_alignment_tablet: campCtaAlignTablet,
      cta_alignment_mobile: campCtaAlignMobile,
      title_padding_tablet: campTitlePaddingTablet,
      title_padding_mobile: campTitlePaddingMobile,
      title_radius_tablet: campTitleRadiusTablet,
      title_radius_mobile: campTitleRadiusMobile,
      body_padding_tablet: campBodyPaddingTablet,
      body_padding_mobile: campBodyPaddingMobile,
      body_radius_tablet: campBodyRadiusTablet,
      body_radius_mobile: campBodyRadiusMobile,
      footer_padding_tablet: campFooterPaddingTablet,
      footer_padding_mobile: campFooterPaddingMobile,
      footer_radius_tablet: campFooterRadiusTablet,
      footer_radius_mobile: campFooterRadiusMobile
    };
    formData.append('custom_styles', JSON.stringify(customStyles));

    try {
      if (campId) {
        await axios.patch(`${API_URL}/blog/campaigns/${campId}/`, formData, { headers });
        setCampSuccessMsg('¡Campaña de correos actualizada con éxito!');
      } else {
        await axios.post(`${API_URL}/blog/campaigns/`, formData, { headers });
        setCampSuccessMsg('¡Campaña de correos creada con éxito!');
      }
      setIsCampaignModalOpen(false);
      localStorage.removeItem('ms_ambar_campaign_draft');
      setHasDraft(false);
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 401) {
        // Token invalid or expired – redirect to login
        router.push('/login?redirect=/dashboard');
      } else {
        setCampErrorMsg(err.response?.data ? JSON.stringify(err.response.data) : 'Error al procesar la campaña.');
      }
    } finally {
      setCampLoading(false);
    }
  };

  const handleCampaignDelete = async (id: number, subject: string) => {
    const isConfirmed = await showConfirm(`¿Eliminar permanentemente la campaña "${subject}"?`, "Eliminar Campaña");
    if (!isConfirmed) return;
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      await axios.delete(`${API_URL}/blog/campaigns/${id}/`, { headers });
      fetchDashboardData();
    } catch (err) {
      console.error('Error eliminando campaña:', err);
    }
  };

  const handleCampaignSend = async (id: number) => {
    const isConfirmed = await showConfirm('¿Estás seguro de que deseas enviar esta campaña de poemas a todos los suscriptores activos? Esta acción es irreversible.', "Enviar Campaña");
    if (!isConfirmed) return;
    setSendingCampaignId(id);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      await axios.post(`${API_URL}/blog/campaigns/${id}/send_campaign/`, {}, { headers });
      showToast.success('¡Envío de campaña iniciado con éxito!');
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      showAlert(err.response?.data?.error || 'Error al enviar la campaña.', "Error de Envío", "error");
    } finally {
      setSendingCampaignId(null);
    }
  };

  const fetchTemplateImages = async () => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const res = await axios.get(`${API_URL}/blog/campaign-template-images/`, { headers });
      setTemplateImages(res.data);
    } catch (err) {
      console.error('Error fetching template images:', err);
    }
  };

  const handleTemplateImageUpload = async (file: File) => {
    if (!file) return;
    setLibraryUploadLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const formData = new FormData();
    formData.append('image', file);
    try {
      await axios.post(`${API_URL}/blog/campaign-template-images/`, formData, { headers });
      await fetchTemplateImages();
    } catch (err) {
      console.error('Error uploading template image:', err);
      showToast.error('Error al subir la imagen a la biblioteca.');
    } finally {
      setLibraryUploadLoading(false);
    }
  };

  const handleTemplateImageDelete = async (id: number) => {
    const isConfirmed = await showConfirm('¿Eliminar esta imagen de la biblioteca?', "Eliminar Imagen");
    if (!isConfirmed) return;
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      await axios.delete(`${API_URL}/blog/campaign-template-images/${id}/`, { headers });
      await fetchTemplateImages();
    } catch (err) {
      console.error('Error deleting template image:', err);
      showToast.error('Error al eliminar la imagen.');
    }
  };

  const handleUseTemplateAsCover = async (imageUrl: string) => {
    try {
      let targetUrl = imageUrl;
      if (imageUrl.startsWith('http')) {
        try {
          const parsedUrl = new URL(imageUrl);
          targetUrl = parsedUrl.pathname;
        } catch (e) {
          // ignore
        }
      }
      const response = await fetch(targetUrl);
      const blob = await response.blob();
      const filename = targetUrl.substring(targetUrl.lastIndexOf('/') + 1);
      const file = new File([blob], filename, { type: blob.type });
      setCampImageFile(file);
      setCampImagePreview(targetUrl);
    } catch (err) {
      console.error('Error setting cover image from template:', err);
    }
  };

  const handleUseTemplateAsBg = async (imageUrl: string) => {
    try {
      let targetUrl = imageUrl;
      if (imageUrl.startsWith('http')) {
        try {
          const parsedUrl = new URL(imageUrl);
          targetUrl = parsedUrl.pathname;
        } catch (e) {
          // ignore
        }
      }
      const response = await fetch(targetUrl);
      const blob = await response.blob();
      const filename = targetUrl.substring(targetUrl.lastIndexOf('/') + 1);
      const file = new File([blob], filename, { type: blob.type });
      setCampBgImageFile(file);
      setCampBgImagePreview(targetUrl);
    } catch (err) {
      console.error('Error setting background image from template:', err);
    }
  };

  const insertImageAtCursor = (imageUrl: string) => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const imgHtml = `<img src="${imageUrl}" style="max-width:100%; height:auto; border-radius:12px; margin:15px auto; display:block; border:1px solid rgba(255,255,255,0.05);" />`;

      // Si el editor está en la pestaña "Contenido" y el tab activo es el "Cuerpo":
      if (settingsTab === 'content' && editorActiveTab === 'body' && campaignEditorRef.current) {
        campaignEditorRef.current.focus();
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          
          // Verificar que la selección esté realmente dentro del editor
          if (campaignEditorRef.current.contains(range.commonAncestorContainer)) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.borderRadius = '12px';
            img.style.margin = '15px auto';
            img.style.display = 'block';
            img.style.border = '1px solid rgba(255,255,255,0.05)';

            range.deleteContents();
            range.insertNode(img);

            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);

            setCampPoemText(campaignEditorRef.current.innerHTML);
            return;
          }
        }
        
        // Si no hay selección válida, añadir al final de la vista y actualizar estado
        campaignEditorRef.current.innerHTML += imgHtml;
        setCampPoemText(campaignEditorRef.current.innerHTML);
      } else {
        // Si está en otra sección (Diseño, Portada, Biblioteca) o en otro tab (Título, Pie):
        // 1. Guardar estado del editor actual si es que hay algo montado
        syncEditorState();
        
        // 2. Cambiar de sección al cuerpo del email
        setSettingsTab('content');
        setEditorActiveTab('body');
        
        // 3. Añadir la imagen al final del estado del cuerpo
        setCampPoemText(prev => {
          const base = prev || '';
          return base + imgHtml;
        });
      }
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importCsvFile) {
      setImportCsvError('Por favor selecciona un archivo CSV.');
      return;
    }
    setImportCsvLoading(true);
    setImportCsvError(null);
    setImportCsvSuccess(null);
    const token = localStorage.getItem('token');
    const headers = {
      Authorization: `Bearer ${token}`
    };
    const formData = new FormData();
    formData.append('file', importCsvFile);
    if (importCsvMarketingList) {
      formData.append('marketing_list_id', importCsvMarketingList);
    }
    try {
      const res = await axios.post(`${API_URL}/blog/subscribers/import_csv/`, formData, { headers });
      setImportCsvSuccess(res.data.message || 'Importación completada con éxito.');
      setImportCsvFile(null);
      setImportCsvMarketingList('');
      const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      setImportCsvError(err.response?.data?.error || 'Error al importar los contactos.');
    } finally {
      setImportCsvLoading(false);
    }
  };

  // ════ Theater CRUD Handlers (Nectar Pro) ════
  const openTheaterCreateModal = () => {
    setEditingTheater(null);
    setTheaterName('');
    setTheaterLocation('');
    setTheaterErrorMsg(null);
    setTheaterSuccessMsg(null);
    setIsTheaterModalOpen(true);
  };

  const openTheaterEditModal = (theater: any) => {
    setEditingTheater(theater);
    setTheaterName(theater.name);
    setTheaterLocation(theater.location || '');
    setTheaterErrorMsg(null);
    setTheaterSuccessMsg(null);
    setIsTheaterModalOpen(true);
  };

  const handleTheaterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theaterName.trim()) { setTheaterErrorMsg('El nombre del teatro es obligatorio.'); return; }
    const finalLocation = theaterLocation.trim() || 'Ubicación por definir';
    setTheaterLoading(true);
    setTheaterErrorMsg(null);
    try {
      if (editingTheater) {
        await axios.patch(`${API_URL}/tickets/theaters/${editingTheater.id}/`, { name: theaterName, location: finalLocation });
        setTheaterSuccessMsg('¡Teatro actualizado con éxito!');
      } else {
        await axios.post(`${API_URL}/tickets/theaters/`, { name: theaterName, location: finalLocation, layout: { seats: [], map_elements: [] } });
        setTheaterSuccessMsg('¡Teatro creado! Ábrelo en Nectar Studio para diseñar su planta.');
      }
      setIsTheaterModalOpen(false);
      fetchDashboardData();
    } catch (err: any) {
      setTheaterErrorMsg(err.response?.data ? (typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : String(err.response.data)) : 'Error al procesar el teatro.');
    } finally {
      setTheaterLoading(false);
    }
  };

  const handleTheaterDelete = async (id: number, name: string) => {
    const isConfirmed = await showConfirm(`¿Eliminar permanentemente "${name}"? Se borrarán todos los asientos y eventos asociados.`, "Eliminar Teatro");
    if (!isConfirmed) return;
    try {
      await axios.delete(`${API_URL}/tickets/theaters/${id}/`);
      fetchDashboardData();
    } catch (err) { console.error('Error eliminando teatro:', err); }
  };

  const handleTheaterSync = async (id: number) => {
    setTheaterSyncStatus(prev => ({ ...prev, [id]: 'loading' }));
    try {
      await axios.post(`${API_URL}/tickets/theaters/${id}/generate_seats/`);
      setTheaterSyncStatus(prev => ({ ...prev, [id]: 'success' }));
      setTimeout(() => setTheaterSyncStatus(prev => ({ ...prev, [id]: 'idle' })), 3500);
    } catch {
      setTheaterSyncStatus(prev => ({ ...prev, [id]: 'error' }));
      setTimeout(() => setTheaterSyncStatus(prev => ({ ...prev, [id]: 'idle' })), 3500);
    }
  };

  // ─── Events Form & Action Handlers ───
  const openEventCreateModal = () => {
    setEditingEvent(null);
    setEventTitle('');
    setEventArtist('');
    setEventDate('');
    setEventType('concert');
    setEventTheater('');
    setEventMgPrice('0');
    setEventMgLimit('0');
    setEventPriceMultiplier('1.0');
    setEventIsActive(true);
    setEventImageFile(null);
    setEventImagePreview(null);
    setEventFlyerFile(null);
    setEventFlyerPreview(null);
    setEventErrorMsg(null);
    setEventSuccessMsg(null);
    setIsEventModalOpen(true);
  };

  const openEventEditModal = (event: any) => {
    setEditingEvent(event);
    setEventTitle(event.title);
    setEventArtist(event.artist);
    
    let formattedDate = '';
    if (event.date) {
      const d = new Date(event.date);
      const offset = d.getTimezoneOffset();
      const localDate = new Date(d.getTime() - (offset * 60 * 1000));
      formattedDate = localDate.toISOString().slice(0, 16);
    }
    setEventDate(formattedDate);
    setEventType(event.event_type || 'concert');
    setEventTheater(event.theater ? String(event.theater) : '');
    setEventMgPrice(String(event.mg_price || '0'));
    setEventMgLimit(String(event.mg_limit || '0'));
    setEventPriceMultiplier(String(event.price_multiplier || '1.0'));
    setEventIsActive(event.is_active);
    setEventImageFile(null);
    setEventImagePreview(event.image ? resolveMediaUrl(event.image) : null);
    setEventFlyerFile(null);
    setEventFlyerPreview(event.flyer ? resolveMediaUrl(event.flyer) : null);
    setEventErrorMsg(null);
    setEventSuccessMsg(null);
    setIsEventModalOpen(true);
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) { setEventErrorMsg('El título es obligatorio.'); return; }
    if (!eventArtist.trim()) { setEventErrorMsg('El artista es obligatorio.'); return; }
    if (!eventDate) { setEventErrorMsg('La fecha es obligatoria.'); return; }
    if (eventType === 'concert' && !eventTheater) { setEventErrorMsg('Debes seleccionar un teatro para un concierto.'); return; }
    
    if (eventType === 'meet_greet') {
      if (!eventMgPrice || parseFloat(eventMgPrice) < 0) { setEventErrorMsg('El precio de la convivencia debe ser un valor válido.'); return; }
      if (!eventMgLimit || parseInt(eventMgLimit) < 0) { setEventErrorMsg('El límite de boletos debe ser un valor válido.'); return; }
    }

    setEventLoading(true);
    setEventErrorMsg(null);
    setEventSuccessMsg(null);

    const token = localStorage.getItem('token');
    const headers = { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    };

    const formData = new FormData();
    formData.append('title', eventTitle);
    formData.append('artist', eventArtist);
    formData.append('date', eventDate);
    formData.append('event_type', eventType);
    formData.append('price_multiplier', eventPriceMultiplier);
    formData.append('is_active', eventIsActive ? 'true' : 'false');
    formData.append('mg_price', eventMgPrice || '0.00');
    formData.append('mg_limit', eventMgLimit || '0');

    if (eventType === 'concert') {
      formData.append('theater', eventTheater);
      const selectedT = theaters.find((t: any) => t.id?.toString() === eventTheater?.toString());
      formData.append('venue_name', selectedT?.name || 'Recinto Principal');
      formData.append('venue_address', selectedT?.location || 'Ubicación por definir');
    } else {
      formData.append('theater', '');
      formData.append('venue_name', 'Evento Convivencia');
      formData.append('venue_address', 'Plataforma Digital');
    }

    if (eventImageFile) {
      formData.append('image', eventImageFile);
    }
    if (eventFlyerFile) {
      formData.append('flyer', eventFlyerFile);
    }

    try {
      if (editingEvent) {
        await axios.patch(`${API_URL}/tickets/events/${editingEvent.id}/`, formData, { headers });
        setEventSuccessMsg('¡Evento actualizado con éxito!');
      } else {
        await axios.post(`${API_URL}/tickets/events/`, formData, { headers });
        setEventSuccessMsg('¡Evento creado con éxito!');
      }
      setIsEventModalOpen(false);
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      setEventErrorMsg(err.response?.data ? JSON.stringify(err.response.data) : 'Error al guardar el evento.');
    } finally {
      setEventLoading(false);
    }
  };

  const handleEventDelete = async (id: number, title: string) => {
    const isConfirmed = await showConfirm(`¿Eliminar permanentemente "${title}"? Se borrarán todos los boletos asociados.`, "Eliminar Evento");
    if (!isConfirmed) return;
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      await axios.delete(`${API_URL}/tickets/events/${id}/`, { headers });
      fetchDashboardData();
    } catch (err) {
      console.error('Error eliminando evento:', err);
    }
  };

  const handleToggleEventActive = async (event: any) => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      await axios.patch(`${API_URL}/tickets/events/${event.id}/`, { is_active: !event.is_active }, { headers });
      fetchDashboardData();
    } catch (err) {
      console.error('Error al cambiar estado del evento:', err);
    }
  };


  const handleUpdateOrderStatus = async (orderId: number, nextStatus: 'shipped' | 'delivered') => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    if (nextStatus === 'shipped') {
      // Trigger Shipment Simulation sequence
      setShippingOrderId(orderId);
      setShippingStep('contacting');

      setTimeout(() => {
        setShippingStep('generating');
      }, 1000);

      setTimeout(async () => {
        const trackingNum = `DHL-MSAMBAR-${Math.floor(100000 + Math.random() * 900000)}`;
        setSimulatedTracking(trackingNum);

        try {
          await axios.patch(`${API_URL}/dashboard/orders/`, {
            order_id: orderId,
            status: 'shipped'
          }, { headers });

          setShippingStep('success');
          fetchDashboardData();
        } catch (e) {
          console.error("Failed to ship order", e);
          setShippingStep('idle');
        }
      }, 2500);
    } else {
      // Direct Delivery status update
      try {
        await axios.patch(`${API_URL}/dashboard/orders/`, {
          order_id: orderId,
          status: 'delivered'
        }, { headers });
        fetchDashboardData();
      } catch (e) {
        console.error("Failed to deliver order", e);
      }
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseLoading(true);
    setExpenseSuccess(false);

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      await axios.post(`${API_URL}/dashboard/expenses/`, {
        title: expenseTitle,
        amount: parseFloat(expenseAmount),
        category: expenseCategory,
        description: expenseDesc
      }, { headers });

      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseDesc('');
      setExpenseSuccess(true);
      fetchDashboardData();

      setTimeout(() => {
        setExpenseSuccess(false);
      }, 3000);
    } catch (err) {
      console.error("Failed to add expense", err);
    } finally {
      setExpenseLoading(false);
    }
  };

  // Product Operations
  const openProductCreateModal = () => {
    setProdId(null);
    setProdName('');
    setProdSlug('');
    setProdDesc('');
    setProdPrice('');
    setProdStock('');
    setProdCategory(categories[0]?.id || '');
    setProdIsActive(true);
    setProdImageFile(null);
    setProdImagePreview(null);
    setCatalogErrorMsg(null);
    setCatalogSuccessMsg(null);
    setIsProductModalOpen(true);
  };

  const openProductEditModal = (product: any) => {
    setProdId(product.id);
    setProdName(product.name);
    setProdSlug(product.slug || '');
    setProdDesc(product.description || '');
    setProdPrice(String(product.price));
    setProdStock(String(product.stock));
    setProdCategory(product.category || '');
    setProdIsActive(product.is_active !== false);
    setProdImageFile(null);
    setProdImagePreview(product.image || null);
    setCatalogErrorMsg(null);
    setCatalogSuccessMsg(null);
    setIsProductModalOpen(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatalogLoading(true);
    setCatalogErrorMsg(null);
    setCatalogSuccessMsg(null);

    const token = localStorage.getItem('token');
    const headers = {
      Authorization: `Bearer ${token}`
    };

    const formData = new FormData();
    formData.append('name', prodName);
    if (prodSlug) formData.append('slug', prodSlug);
    formData.append('description', prodDesc);
    formData.append('price', prodPrice);
    formData.append('stock', prodStock);
    if (prodCategory) formData.append('category', prodCategory);
    formData.append('is_active', String(prodIsActive));
    if (prodImageFile) {
      formData.append('image', prodImageFile);
    }

    try {
      if (prodId) {
        await axios.patch(`${API_URL}/shop/products/${prodId}/`, formData, { headers });
        setCatalogSuccessMsg('¡Producto actualizado con éxito!');
      } else {
        await axios.post(`${API_URL}/shop/products/`, formData, { headers });
        setCatalogSuccessMsg('¡Producto creado con éxito!');
      }
      setIsProductModalOpen(false);
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      setCatalogErrorMsg(err.response?.data ? JSON.stringify(err.response.data) : 'Error al procesar el producto.');
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleProductDelete = async (id: number) => {
    const isConfirmed = await showConfirm('¿Estás seguro de que deseas eliminar este producto?', "Eliminar Producto");
    if (!isConfirmed) return;
    setCatalogLoading(true);
    setCatalogErrorMsg(null);

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      await axios.delete(`${API_URL}/shop/products/${id}/`, { headers });
      setCatalogSuccessMsg('Producto eliminado con éxito.');
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      setCatalogErrorMsg('Error al eliminar el producto.');
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleProductToggleActive = async (product: any) => {
    setCatalogLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      await axios.patch(`${API_URL}/shop/products/${product.id}/`, {
        is_active: !product.is_active
      }, { headers });
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    } finally {
      setCatalogLoading(false);
    }
  };

  // Category Operations
  const openCategoryCreateModal = () => {
    setCatId(null);
    setCatName('');
    setCatSlug('');
    setCatalogErrorMsg(null);
    setCatalogSuccessMsg(null);
    setIsCategoryModalOpen(true);
  };

  const openCategoryEditModal = (category: any) => {
    setCatId(category.id);
    setCatName(category.name);
    setCatSlug(category.slug || '');
    setCatalogErrorMsg(null);
    setCatalogSuccessMsg(null);
    setIsCategoryModalOpen(true);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatalogLoading(true);
    setCatalogErrorMsg(null);
    setCatalogSuccessMsg(null);

    const token = localStorage.getItem('token');
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const data: any = { name: catName };
    if (catSlug) data.slug = catSlug;

    try {
      if (catId) {
        await axios.patch(`${API_URL}/shop/categories/${catId}/`, data, { headers });
        setCatalogSuccessMsg('¡Categoría actualizada con éxito!');
      } else {
        await axios.post(`${API_URL}/shop/categories/`, data, { headers });
        setCatalogSuccessMsg('¡Categoría creada con éxito!');
      }
      setIsCategoryModalOpen(false);
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      setCatalogErrorMsg(err.response?.data ? JSON.stringify(err.response.data) : 'Error al procesar la categoría.');
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleCategoryDelete = async (id: number) => {
    const isConfirmed = await showConfirm('¿Estás seguro de que deseas eliminar esta categoría? Si la eliminas, todos los productos en ella quedarán sin categoría.', "Eliminar Categoría");
    if (!isConfirmed) return;
    setCatalogLoading(true);
    setCatalogErrorMsg(null);

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      await axios.delete(`${API_URL}/shop/categories/${id}/`, { headers });
      setCatalogSuccessMsg('Categoría eliminada con éxito.');
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      setCatalogErrorMsg('Error al eliminar la categoría.');
    } finally {
      setCatalogLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen text-[#F4F6F0] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-amber-honey/20 border-t-amber-honey animate-spin" />
        <p className="text-[#F4F6F0]/60 tracking-widest font-black uppercase text-xs">Cargando Bóveda Ms Ambar...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen text-[#F4F6F0] flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full amber-glass border border-white/10 p-8 rounded-[2rem] text-center shadow-2xl shadow-black/30"
        >
          <AlertTriangle className="text-amber-honey w-16 h-16 mx-auto mb-6" />
          <h2 className="text-2xl font-black uppercase italic tracking-tight mb-2 text-[#F4F6F0]">⚠️ Acceso Limitado</h2>
          <p className="text-[#F4F6F0]/60 text-sm mb-6 leading-relaxed">
            {error}. Se requiere una cuenta de administrador registrada en el sistema.
          </p>
          <a
            href="/admin/"
            target="_blank"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-honey to-amber-gold hover:from-amber-gold hover:to-amber-500 text-[#1E2B22] font-black uppercase tracking-widest text-xs px-6 py-4 rounded-xl transition-all shadow-[0_4px_20px_rgba(229,169,59,0.2)]"
          >
            Django Admin <ExternalLink size={14} />
          </a>
        </motion.div>
      </div>
    );
  }

  const financials = stats?.financials;
  const tickets = stats?.tickets;
  const shop = stats?.shop;
  const vitals = stats?.vitals;
  const chartData = stats?.charts?.daily_sales || [];

  // SVG Area Chart calculations
  const chartWidth = 700;
  const chartHeight = 220;
  const paddingLeft = 40;
  const paddingRight = 10;
  const paddingTop = 20;
  const paddingBottom = 30;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const maxVal = Math.max(...chartData.map((d: any) => d.total), 100) * 1.1;

  const points = chartData.map((d: any, i: number) => {
    const x = paddingLeft + (i / (chartData.length - 1)) * innerWidth;
    const y = paddingTop + innerHeight - (d.total / maxVal) * innerHeight;
    return { x, y, data: d };
  });

  const linePath = points.length > 0
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p: any) => `L ${p.x} ${p.y}`).join(' ')
    : '';

  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + innerHeight} L ${points[0].x} ${paddingTop + innerHeight} Z`
    : '';

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const viewBoxX = (mouseX / rect.width) * chartWidth;

    let closestPoint = points[0];
    let minDiff = Math.abs(points[0].x - viewBoxX);

    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(points[i].x - viewBoxX);
      if (diff < minDiff) {
        minDiff = diff;
        closestPoint = points[i];
      }
    }

    if (viewBoxX >= paddingLeft - 20 && viewBoxX <= chartWidth - paddingRight + 20) {
      setHoveredPoint({
        ...closestPoint.data,
        x: closestPoint.x,
        y: closestPoint.y
      });
    } else {
      setHoveredPoint(null);
    }
  };

  const pendingOrdersCount = orders.filter(o => o.status === 'paid').length;

  const activePoint = hoveredPoint || (points.length > 0 ? {
    ...points[points.length - 1].data,
    x: points[points.length - 1].x,
    y: points[points.length - 1].y
  } : null);

  return (
    <div data-theme="dark" className="min-h-screen text-[#F4F6F0] py-12 px-6 lg:px-12 relative overflow-hidden font-sans">
      {/* Background Decorative Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-honey/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-honey/[0.03] blur-[120px] rounded-full pointer-events-none" />

      {!isStaff ? (
        /* ==================== CLIENT DASHBOARD ==================== */
        <div className="relative z-10 space-y-8">
          <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <span className="text-[10px] text-amber-honey uppercase tracking-widest font-black flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-honey animate-ping" />
                Bóveda Personal
              </span>
              <h1 className="text-4xl md:text-5xl font-black text-[#F4F6F0] uppercase italic tracking-tighter mt-1">
                Hola, {clientProfile?.first_name || clientProfile?.username || 'Fan de Ms. Ámbar'}
              </h1>
              <p className="text-[#F4F6F0]/50 text-xs font-bold uppercase tracking-widest mt-2">
                Tus boletos, accesos a experiencias y perfil
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={openProfileModal}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-3 rounded-xl shadow-lg transition-all text-xs font-bold uppercase tracking-widest text-[#F4F6F0]"
              >
                <User size={14} className="text-amber-honey" /> Ver Perfil
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 border border-red-500/30 text-red-400 font-black uppercase tracking-widest text-xs px-5 py-3 rounded-xl transition-all"
              >
                Salir
              </button>
            </div>
          </header>

          {/* Navigation Tabs Bar for Client */}
          <div className="flex gap-4 mb-8 amber-glass border border-white/10 p-2 rounded-2xl w-fit shadow-lg">
            <button
              onClick={() => setClientActiveTab('tickets')}
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${clientActiveTab === 'tickets'
                ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
                : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
                }`}
            >
              🎟️ Mis Boletos
            </button>
            <button
              onClick={() => setClientActiveTab('profile')}
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${clientActiveTab === 'profile'
                ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
                : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
                }`}
            >
              👤 Mi Perfil
            </button>
          </div>

          <AnimatePresence>
            {clientActiveTab === 'tickets' && (
              <motion.div
                key="client-tickets-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                {clientTickets.length === 0 ? (
                  <div className="amber-glass border border-white/10 rounded-[2rem] p-16 text-center space-y-4">
                    <p className="text-[#F4F6F0]/50 text-sm uppercase tracking-wider italic">No tienes boletos adquiridos.</p>
                    <Link
                      href="/tienda"
                      className="inline-block bg-amber-honey text-[#1E2B22] font-black uppercase tracking-widest text-xs px-6 py-3.5 rounded-xl hover:bg-amber-gold transition-all"
                    >
                      Ir a la Tienda
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {clientTickets.map((ticket: any) => (
                      <div
                        key={ticket.id}
                        className="amber-glass border border-white/10 p-6 rounded-[2.5rem] relative overflow-hidden flex flex-col sm:flex-row justify-between gap-6 shadow-xl hover:border-white/20 transition-all group"
                      >
                        {/* Event Details (Left) */}
                        <div className="flex-1 flex flex-col justify-between space-y-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              {ticket.has_mg && (
                                <span className="bg-gradient-to-r from-amber-honey to-amber-gold text-[#1E2B22] text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-md animate-pulse">
                                  Meet & Greet VIP
                                </span>
                              )}
                              <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${ticket.status === 'paid' ? 'bg-green-500/10 border border-green-500/25 text-green-400' :
                                ticket.status === 'used' ? 'bg-white/5 border border-white/10 text-[#F4F6F0]/40' :
                                  'bg-yellow-500/10 border border-yellow-500/25 text-yellow-400'
                                }`}>
                                {ticket.status === 'paid' ? 'Pagado' : ticket.status === 'used' ? 'Usado' : 'Reservado'}
                              </span>
                            </div>
                            <span className="text-[10px] text-amber-honey uppercase tracking-widest font-black block">
                              {ticket.event_artist || 'Ms. Ámbar'}
                            </span>
                            <h3 className="text-xl font-black uppercase italic tracking-tight text-[#F4F6F0] mt-0.5 leading-tight group-hover:text-amber-honey transition-colors">
                              {ticket.event_title}
                            </h3>
                          </div>

                          <div className="space-y-2 text-xs text-[#F4F6F0]/70">
                            <div className="flex items-center gap-2">
                              <Calendar size={12} className="text-[#F4F6F0]/40" />
                              <span>
                                {new Date(ticket.event_date).toLocaleDateString('es-MX', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })} • {new Date(ticket.event_date).toLocaleTimeString('es-MX', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin size={12} className="text-[#F4F6F0]/40" />
                              <span>{ticket.theater_name} ({ticket.theater_location})</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                            <div>
                              <span className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold block">Asiento / Zona</span>
                              <span className="text-xs font-black text-amber-honey uppercase font-mono">{ticket.seat_display}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold block">Código</span>
                              <span className="text-[9px] font-mono text-[#F4F6F0]/65">#{ticket.token ? ticket.token.substring(0, 8).toUpperCase() : ticket.id}</span>
                            </div>
                          </div>
                        </div>

                        {/* QR Code Container (Right) */}
                        <div className="w-full sm:w-[150px] flex flex-col items-center justify-center bg-white p-3 rounded-2xl shrink-0 group-hover:scale-[1.02] transition-transform shadow-inner">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&color=080c0a&bgcolor=ffffff&data=${ticket.token}`}
                            alt="QR Token"
                            className="w-[120px] h-[120px] object-contain"
                          />
                          <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-[#080C0A] mt-2 select-all">
                            Scan en Entrada
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {clientActiveTab === 'profile' && (
              <motion.div
                key="client-profile-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-xl"
              >
                <div className="amber-glass border border-white/10 p-8 rounded-[2.5rem] space-y-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-[-30px] right-[-30px] w-32 h-32 bg-amber-honey/10 blur-2xl rounded-full pointer-events-none" />

                  <div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tight text-[#F4F6F0]">
                      Detalles de Cuenta
                    </h2>
                    <p className="text-[9px] text-[#F4F6F0]/50 uppercase tracking-widest font-bold mt-1">
                      Información de contacto oficial registrada
                    </p>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-white/5">
                      <div>
                        <span className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold block">Nombre de Usuario</span>
                        <span className="text-sm font-bold text-[#F4F6F0]">{clientProfile?.username || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold block">Correo Electrónico</span>
                        <span className="text-sm font-bold text-[#F4F6F0]">{clientProfile?.email || '-'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-white/5">
                      <div>
                        <span className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold block">Nombre</span>
                        <span className="text-sm font-bold text-[#F4F6F0]">{clientProfile?.first_name || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold block">Apellido</span>
                        <span className="text-sm font-bold text-[#F4F6F0]">{clientProfile?.last_name || '-'}</span>
                      </div>
                    </div>
                    <div className="pb-2">
                      <span className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold block">Teléfono de Contacto</span>
                      <span className="text-sm font-bold text-amber-honey font-mono">{clientProfile?.phone || 'No especificado'}</span>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={openProfileModal}
                      className="bg-amber-honey text-[#1E2B22] font-black uppercase tracking-widest text-xs px-6 py-3.5 rounded-xl hover:bg-amber-gold transition-all shadow-lg shadow-amber-honey/10 flex items-center gap-2"
                    >
                      <Edit2 size={13} /> Editar Perfil
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* ==================== ADMIN CONSOLE ==================== */
        <div className="space-y-8">
          <header className="mb-8 relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <span className="text-[10px] text-amber-honey uppercase tracking-widest font-black flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-honey animate-ping" />
                Consola del Artista
              </span>
              <h1 className="text-4xl md:text-5xl font-black text-[#F4F6F0] uppercase italic tracking-tighter mt-1">
                Bóveda de Resumen
              </h1>
              <p className="text-[#F4F6F0]/50 text-xs font-bold uppercase tracking-widest mt-2">
                Métricas de Ventas, Taquilla, Logística y Salud de Servidores de Ms Ambar
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={openProfileModal}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-3 rounded-xl shadow-lg transition-all text-xs font-bold uppercase tracking-widest text-[#F4F6F0]"
              >
                <User size={14} className="text-amber-honey" /> Ver Perfil
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 border border-red-500/30 text-red-400 font-black uppercase tracking-widest text-xs px-5 py-3 rounded-xl transition-all"
              >
                Salir
              </button>
              <Link
                href="/dashboard/scan-tickets"
                className="flex items-center gap-2 bg-gradient-to-r from-amber-honey to-amber-500 hover:from-amber-500 hover:to-amber-600 text-[#1E2B22] font-black uppercase tracking-widest text-xs px-5 py-3 rounded-xl transition-all shadow-[0_4px_20px_rgba(229,169,59,0.15)]"
              >
                <Camera size={14} /> Escanear Boletos
              </Link>
              <Link
                href="/dashboard/performance"
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-3 rounded-xl shadow-lg transition-all text-xs font-bold uppercase tracking-widest text-[#F4F6F0]"
              >
                <Activity size={14} className="text-amber-honey" /> Rendimiento
              </Link>
              <a
                href="/admin/"
                target="_blank"
                className="flex items-center gap-2 bg-gradient-to-r from-amber-honey to-amber-500 hover:from-amber-500 hover:to-amber-600 text-[#1E2B22] font-black uppercase tracking-widest text-xs px-5 py-3 rounded-xl transition-all shadow-[0_4px_20px_rgba(229,169,59,0.15)]"
              >
                Django <ExternalLink size={14} />
              </a>
            </div>
          </header>

          {/* Navigation Tabs Bar */}
          <div className="flex gap-4 mb-8 amber-glass border border-white/10 p-2 rounded-2xl w-fit relative z-10 shadow-lg flex-wrap">
            {isSuperuser && (
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'summary'
                  ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
                  : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
                  }`}
              >
                📊 Resumen General
              </button>
            )}
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'orders'
                ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
                : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
                }`}
            >
              📦 Despacho de Pedidos
              {pendingOrdersCount > 0 && (
                <span className="w-5 h-5 bg-[#080C0A] border border-[#F4F6F0] text-[#F4F6F0] rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
                  {pendingOrdersCount}
                </span>
              )}
            </button>
            {isSuperuser && (
              <button
                onClick={() => setActiveTab('expenses')}
                className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'expenses'
                  ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
                  : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
                  }`}
              >
                💸 Control de Gastos
              </button>
            )}
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'catalog'
                ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
                : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
                }`}
            >
              🛍️ Catálogo de Tienda
            </button>
            <button
              onClick={() => setActiveTab('theaters')}
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'theaters'
                ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
                : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
                }`}
            >
              🎭 Teatros
            </button>
            <button
              onClick={() => setActiveTab('contracts')}
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'contracts'
                ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
                : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
                }`}
            >
              ✍️ Contratos
              {contracts.filter(c => !c.is_fully_signed).length > 0 && (
                <span className="w-5 h-5 bg-[#080C0A] border border-[#F4F6F0] text-[#F4F6F0] rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
                  {contracts.filter(c => !c.is_fully_signed).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'campaigns'
                ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
                : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
                }`}
            >
              📧 Campañas de Marketing
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'events'
                ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
                : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
                }`}
            >
              📅 Eventos
            </button>
            <button
              onClick={() => setActiveTab('coupons')}
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'coupons'
                ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
                : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
                }`}
            >
              🎟️ Cupones VIP
            </button>
            <button
              onClick={() => setActiveTab('theme')}
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'theme'
                ? 'bg-amber-honey text-[#1E2B22] shadow-md shadow-amber-honey/10'
                : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
                }`}
            >
              🎨 Tema & Apariencia
            </button>
          </div>

          {/* Main Administrative Views Context */}
          <div className="relative z-10">
            <AnimatePresence>

              {/* TAB: TEMA Y APARIENCIA VISUAL */}
              {activeTab === 'theme' && (
                <motion.div
                  key="theme-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <ThemeManager />
                </motion.div>
              )}

              {/* TAB: CUPONES Y DESCUENTOS */}

              {/* TAB: CUPONES Y DESCUENTOS */}
              {activeTab === 'coupons' && (
                <motion.div
                  key="coupons-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <CouponManager
                    coupons={coupons}
                    events={events}
                    apiUrl={API_URL}
                    onRefresh={fetchDashboardData}
                  />
                </motion.div>
              )}

              {/* TAB 1: SUMMARY DASHBOARD */}
              {activeTab === 'summary' && (
                <motion.div
                  key="summary-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  {/* stat cards (3x2 Grid) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <StatCard
                      title="Ingresos Totales"
                      value={`$${financials?.gross_sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      icon={<DollarSign className="text-amber-400" />}
                      color="amber"
                      detail="Combinado: Taquilla + Tienda"
                    />
                    <StatCard
                      title="Ventas de Tickets"
                      value={`$${financials?.ticket_sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      icon={<Ticket className="text-amber-300" />}
                      color="gold"
                      detail={`Boletos: ${tickets?.total_sold} vendidos`}
                    />
                    <StatCard
                      title="Ventas de Tienda"
                      value={`$${financials?.shop_sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      icon={<ShoppingBag className="text-amber-500" />}
                      color="honey"
                      detail={`Pedidos: ${shop?.total_orders} completados`}
                    />
                    <StatCard
                      title="Gastos Operativos"
                      value={`$${financials?.total_expenses?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      icon={<TrendingDown className="text-red-400" />}
                      color="honey"
                      detail="Pérdidas, Envíos & Producción"
                    />
                    <StatCard
                      title="Beneficio Neto Real"
                      value={`$${financials?.net_profit?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      icon={<Landmark className="text-green-400" />}
                      color="amber"
                      detail="Ingresos libres de gastos"
                    />
                    <StatCard
                      title="Upgrades M&G"
                      value={tickets?.mg_upgrades}
                      icon={<Users className="text-yellow-400" />}
                      color="yellow"
                      detail={`Ingreso M&G: $${financials?.mg_revenue.toLocaleString()}`}
                    />
                  </div>

                  {/* Charts and Operations grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* SVG Interactive Area Chart */}
                    <div className="lg:col-span-2 amber-glass border border-white/10 p-6 rounded-[2rem] shadow-lg shadow-black/20 flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h3 className="text-lg font-black uppercase italic tracking-tight flex items-center gap-2 text-[#F4F6F0]">
                            <TrendingUp size={18} className="text-amber-honey" /> Flujo de Ingresos Diarios
                          </h3>
                          <p className="text-[#F4F6F0]/50 text-[10px] font-bold uppercase tracking-widest mt-1">
                            Taquilla & Tienda - Últimos 30 días
                          </p>
                        </div>
                        {activePoint && (
                          <div className="text-right">
                            <span className="text-amber-honey font-mono text-sm font-bold">
                              ${activePoint.total.toLocaleString()}
                            </span>
                            <p className="text-[9px] text-[#F4F6F0]/50 uppercase font-black tracking-wider">
                              {activePoint.date === points[points.length - 1]?.data?.date ? 'Hoy (Día Actual)' : activePoint.date}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="relative w-full h-[220px]">
                        <svg
                          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                          className="w-full h-full overflow-visible select-none cursor-crosshair"
                          onMouseMove={handleMouseMove}
                          onMouseLeave={() => setHoveredPoint(null)}
                        >
                          <defs>
                            <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#E5A93B" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#E5A93B" stopOpacity="0.00" />
                            </linearGradient>
                          </defs>
                          {[0, 0.25, 0.5, 0.75, 1.0].map((ratio, idx) => {
                            const y = paddingTop + innerHeight * (1 - ratio);
                            const val = maxVal * ratio;
                            return (
                              <g key={idx}>
                                <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#ffffff" strokeOpacity="0.08" strokeDasharray="4 4" />
                                <text x={paddingLeft - 8} y={y + 4} fill="#F4F6F0" fillOpacity="0.4" fontSize="9" fontWeight="bold" textAnchor="end">${Math.round(val)}</text>
                              </g>
                            );
                          })}

                          {/* X-Axis labels with explicit and styled label for the current day (Hoy) */}
                          {points.filter((_: any, idx: number) => idx % 5 === 0 || idx === points.length - 1).map((p: any, idx: number) => {
                            const isLast = p.data.date === points[points.length - 1]?.data?.date;
                            return (
                              <text
                                key={idx}
                                x={p.x}
                                y={paddingTop + innerHeight + 18}
                                fill={isLast ? "#E5A93B" : "#F4F6F0"}
                                fillOpacity={isLast ? "0.9" : "0.4"}
                                fontSize="9"
                                fontWeight={isLast ? "black" : "bold"}
                                textAnchor="middle"
                              >
                                {isLast ? "Hoy" : p.data.date}
                              </text>
                            );
                          })}

                          {areaPath && <path d={areaPath} fill="url(#salesGradient)" />}
                          {linePath && <path d={linePath} fill="none" stroke="#E5A93B" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}

                          {/* Premium Proximity Guide Line and Glowing Dot */}
                          {activePoint && (
                            <g>
                              {/* Vertical guide line */}
                              <line
                                x1={activePoint.x}
                                y1={paddingTop}
                                x2={activePoint.x}
                                y2={paddingTop + innerHeight}
                                stroke="#E5A93B"
                                strokeOpacity="0.3"
                                strokeDasharray="4 4"
                                strokeWidth="1.5"
                              />
                              {/* Concentric glowing indicator */}
                              <circle cx={activePoint.x} cy={activePoint.y} r="8" fill="#E5A93B" fillOpacity="0.35" className="animate-pulse" />
                              <circle cx={activePoint.x} cy={activePoint.y} r="4.5" fill="#E5A93B" stroke="#ffffff" strokeWidth="2" />
                            </g>
                          )}
                        </svg>

                        {/* Floating Glassmorphic Tooltip */}
                        <AnimatePresence>
                          {activePoint && (
                            <motion.div
                              key={`tooltip-${activePoint.date}`}
                              initial={{ opacity: 0, scale: 0.92, y: 5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.92, y: 5 }}
                              transition={{ duration: 0.12, ease: 'easeOut' }}
                              style={{
                                position: 'absolute',
                                left: `${(activePoint.x / chartWidth) * 100}%`,
                                top: `${(activePoint.y / chartHeight) * 100 - 15}%`,
                                transform: 'translate(-50%, -100%)',
                              }}
                              className="pointer-events-none z-[100] bg-[#0B0F0D] border border-amber-honey/30 px-3 py-2 rounded-xl flex flex-col gap-0.5 shadow-xl shadow-black/30 min-w-[100px] text-center backdrop-blur-md"
                            >
                              <span className="text-[10px] font-black text-amber-honey font-mono tracking-tight">
                                ${activePoint.total.toLocaleString()}
                              </span>
                              <span className="text-[8px] text-[#F4F6F0]/50 uppercase font-black tracking-wider">
                                {activePoint.date === points[points.length - 1]?.data?.date ? 'Hoy' : activePoint.date}
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Quick Operations */}
                    <div className="amber-glass border border-white/10 p-6 rounded-[2rem] shadow-lg shadow-black/20 flex flex-col gap-4">
                      <h3 className="text-lg font-black uppercase italic tracking-tight mb-2 flex items-center gap-2 text-[#F4F6F0]">
                        <Layers size={18} className="text-amber-honey" /> Operaciones Rápidas
                      </h3>
                      <QuickActionBtn href="/designer" title="Diseñador de Mapas" desc="Editor de Seating Chart 2D" icon={<Layers size={18} />} />
                      <QuickActionBtn href="/dashboard/scan-tickets" title="Escáner de Boletos" desc="Validar y registrar entradas en tiempo real" icon={<Camera size={18} />} />
                      <QuickActionBtn href="/dashboard/performance" title="Monitor Core Web Vitals" desc="Tiempos del Servidor y Logs" icon={<Activity size={18} />} />
                      <QuickActionBtn href="/admin/shop/product/" title="Catálogo de Productos" desc="Editar Stock de Mercancía" icon={<ShoppingBag size={18} />} external />
                      <QuickActionBtn href="/admin/tickets/event/" title="Fechas & Conciertos" desc="Programar nuevos eventos" icon={<Ticket size={18} />} external />
                      <div
                        onClick={() => setActiveTab('theaters')}
                        className="p-4 bg-white/5 border border-white/10 hover:border-amber-honey/30 hover:bg-amber-honey/[0.02] rounded-2xl shadow-md transition-all group flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2.5 bg-white/5 rounded-xl group-hover:bg-amber-honey/10 group-hover:scale-105 transition-all text-[#F4F6F0]/60 group-hover:text-amber-honey">
                            <MapPin size={18} />
                          </div>
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-[#F4F6F0] group-hover:text-amber-honey transition-colors">Gestión de Teatros</h4>
                            <p className="text-[9px] uppercase tracking-widest text-[#F4F6F0]/40 group-hover:text-[#F4F6F0]/60 mt-0.5">Crear y administrar recintos</p>
                          </div>
                        </div>
                        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-amber-honey" />
                      </div>

                    </div>
                  </div>

                  {/* Health and Products section */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="amber-glass border border-white/10 p-6 rounded-[2rem] shadow-lg shadow-black/20">
                      <h3 className="text-lg font-black uppercase italic tracking-tight mb-4 flex items-center gap-2 text-[#F4F6F0]">
                        <Cpu size={18} className="text-amber-honey" /> Servidor y Base de Datos
                      </h3>
                      {sysMetrics ? (
                        <div className="space-y-6">
                          <div>
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2 text-[#F4F6F0]">
                              <span className="flex items-center gap-1 opacity-60"><Cpu size={12} /> Carga CPU ({sysMetrics.cpu?.cores} Núcleos)</span>
                              <span className="text-amber-honey">{sysMetrics.cpu?.percent}%</span>
                            </div>
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-amber-honey to-amber-500 transition-all duration-500" style={{ width: `${sysMetrics.cpu?.percent}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2 text-[#F4F6F0]">
                              <span className="flex items-center gap-1 opacity-60"><Layers size={12} /> Memoria RAM</span>
                              <span className="text-amber-honey">{sysMetrics.memory?.used_gb} / {sysMetrics.memory?.total_gb} GB</span>
                            </div>
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-amber-honey to-amber-500 transition-all duration-500" style={{ width: `${sysMetrics.memory?.percent}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2 text-[#F4F6F0]">
                              <span className="flex items-center gap-1 opacity-60"><HardDrive size={12} /> Almacenamiento SSD</span>
                              <span className="text-amber-honey">{sysMetrics.disk?.used_gb?.toFixed(1)} / {sysMetrics.disk?.total_gb?.toFixed(1)} GB</span>
                            </div>
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-amber-honey to-amber-500 transition-all duration-500" style={{ width: `${sysMetrics.disk?.percent}%` }} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between">
                              <span className="text-[10px] uppercase opacity-40 font-bold text-[#F4F6F0]/60">Base de Datos</span>
                              <span className="text-sm font-black flex items-center gap-2 mt-2 text-[#F4F6F0]">
                                <Database size={14} className={sysMetrics.database?.status === 'Conectado' ? 'text-green-400' : 'text-red-400'} />
                                {sysMetrics.database?.status}
                              </span>
                            </div>
                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between">
                              <span className="text-[10px] uppercase opacity-40 font-bold text-[#F4F6F0]/60">Uptime</span>
                              <span className="text-[11px] font-mono font-bold truncate mt-2 text-amber-honey">{sysMetrics.system?.uptime || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[#F4F6F0]/20 text-xs py-8 text-center uppercase tracking-widest font-bold">Sin datos del sistema</p>
                      )}
                    </div>

                    <div className="amber-glass border border-white/10 p-6 rounded-[2rem] shadow-lg shadow-black/20 lg:col-span-2">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-black uppercase italic tracking-tight flex items-center gap-2 text-[#F4F6F0]">
                          <ShoppingBag size={18} className="text-amber-honey" /> Inteligencia de Ventas (Top Merch)
                        </h3>
                        {shop?.low_stock_count > 0 && (
                          <span className="flex items-center gap-1 bg-amber-950/20 border border-amber-honey/30 text-amber-honey text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full animate-pulse">
                            <AlertTriangle size={10} /> {shop?.low_stock_count} Stock Bajo
                          </span>
                        )}
                      </div>
                      {shop?.top_products && shop.top_products.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b border-white/10 text-[9px] uppercase tracking-widest opacity-40 text-left text-[#F4F6F0]">
                                <th className="py-3 font-black">Producto</th>
                                <th className="py-3 font-black text-center">Unidades</th>
                                <th className="py-3 font-black text-right">Ingresos</th>
                              </tr>
                            </thead>
                            <tbody>
                              {shop.top_products.map((p: any, idx: number) => (
                                <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-all">
                                  <td className="py-3.5 text-xs font-black text-[#F4F6F0]/85">{p.name}</td>
                                  <td className="py-3.5 text-xs font-mono text-center text-amber-honey font-bold">{p.quantity}</td>
                                  <td className="py-3.5 text-xs font-mono text-right text-[#F4F6F0] font-black">${p.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 opacity-30 text-center">
                          <ShoppingBag size={48} className="mb-4 text-[#F4F6F0]/30" />
                          <p className="text-xs uppercase tracking-widest font-black text-[#F4F6F0]/30">Sin ventas de mercancía registradas</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 2: ORDERS MANAGEMENT QUEUE */}
              {activeTab === 'orders' && (
                <motion.div
                  key="orders-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Order Filtering Options */}
                  <div className="flex gap-3 bg-white/5 border border-white/10 p-1.5 rounded-xl w-fit shadow-lg">
                    {['all', 'paid', 'shipped', 'delivered'].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setOrderFilter(filter as any)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${orderFilter === filter
                          ? 'bg-white/10 text-white'
                          : 'text-[#F4F6F0]/50 hover:text-[#F4F6F0] hover:bg-white/5'
                          }`}
                      >
                        {filter === 'all' && 'Todos'}
                        {filter === 'paid' && 'Pendientes Despacho'}
                        {filter === 'shipped' && 'En Tránsito (Shipped)'}
                        {filter === 'delivered' && 'Entregados'}
                      </button>
                    ))}
                  </div>

                  {/* Simulated Shipping Modal Overlay */}
                  {shippingOrderId && shippingStep !== 'idle' && (
                    <div className="fixed inset-0 bg-[#0B0F0D]/60 z-[110] flex items-center justify-center p-6 backdrop-blur-md">
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="amber-glass max-w-md w-full p-8 rounded-[2.5rem] text-center shadow-2xl relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-honey/40 to-transparent" />
                        {shippingStep === 'contacting' && (
                          <div className="py-6 space-y-4">
                            <div className="w-12 h-12 border-4 border-amber-honey/20 border-t-amber-honey rounded-full animate-spin mx-auto" />
                            <h4 className="text-md font-black uppercase tracking-wider text-[#F4F6F0]">Despachando Guía DHL...</h4>
                            <p className="text-[10px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold">Estableciendo comunicación de paquetería</p>
                          </div>
                        )}
                        {shippingStep === 'generating' && (
                          <div className="py-6 space-y-4">
                            <div className="w-12 h-12 border-4 border-amber-honey/20 border-t-amber-gold rounded-full animate-spin mx-auto" />
                            <h4 className="text-md font-black uppercase tracking-wider text-[#F4F6F0]">Imprimiendo Guía Postal...</h4>
                            <p className="text-[10px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold">Generando archivo PDF y Tracking Number</p>
                          </div>
                        )}
                        {shippingStep === 'success' && (
                          <div className="py-6 space-y-5">
                            <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 flex items-center justify-center mx-auto animate-bounce">
                              <Check size={32} />
                            </div>
                            <div>
                              <h4 className="text-md font-black uppercase tracking-wider text-[#F4F6F0]">¡Guía Generada Exitosamente!</h4>
                              <p className="text-xs text-[#F4F6F0]/50 mt-2">El pedido ha sido entregado a paquetería.</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl text-left space-y-1">
                              <span className="text-[9px] text-[#F4F6F0]/40 uppercase tracking-widest font-black block">Código de Seguimiento</span>
                              <span className="text-xs font-mono font-bold text-amber-honey">{simulatedTracking}</span>
                            </div>
                            <button
                              onClick={() => {
                                setShippingOrderId(null);
                                setShippingStep('idle');
                              }}
                              className="w-full bg-amber-honey text-black font-black uppercase tracking-widest text-[9px] py-3.5 rounded-xl mt-4 hover:bg-amber-gold transition-all"
                            >
                              Cerrar y Actualizar Lista
                            </button>
                          </div>
                        )}
                      </motion.div>
                    </div>
                  )}

                  {/* Orders Listing Queue */}
                  <div className="space-y-4">
                    {orders
                      .filter((o) => orderFilter === 'all' ? true : o.status === orderFilter)
                      .length === 0 ? (
                      <div className="amber-glass border border-white/10 p-16 rounded-[2.5rem] text-center flex flex-col items-center justify-center gap-4 shadow-lg">
                        <Package size={48} className="text-[#F4F6F0]/10" />
                        <p className="text-xs uppercase tracking-widest font-black text-[#F4F6F0]/30">No se encontraron pedidos en esta categoría</p>
                      </div>
                    ) : (
                      orders
                        .filter((o) => orderFilter === 'all' ? true : o.status === orderFilter)
                        .map((order) => (
                          <div key={order.id} className="amber-glass border border-white/10 p-6 rounded-[2rem] hover:border-amber-honey/20 transition-all flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative overflow-hidden group shadow-lg">
                            {/* Left Info: Meta, address, items */}
                            <div className="space-y-4 flex-1">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-xs font-black text-[#F4F6F0]/80">Orden #{order.id}</span>
                                <span className="text-[9px] opacity-40 font-bold uppercase tracking-wider flex items-center gap-1 text-[#F4F6F0]"><Calendar size={10} /> {new Date(order.created_at).toLocaleString()}</span>
                                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full border ${order.status === 'paid' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse' :
                                  order.status === 'shipped' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                                    'bg-green-500/10 border-green-500/30 text-green-400'
                                  }`}>
                                  {order.status === 'paid' ? 'Pendiente Envío (Pagado)' :
                                    order.status === 'shipped' ? 'En Tránsito (Shipped)' :
                                      'Entregado'}
                                </span>
                              </div>

                              {/* Recipient card details */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/5 border border-white/10 p-4 rounded-xl">
                                <div className="space-y-1.5">
                                  <span className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-black block">Información del Cliente</span>
                                  <div className="text-xs font-black flex items-center gap-1.5 text-[#F4F6F0]"><User size={12} className="text-[#F4F6F0]/50" /> {order.full_name}</div>
                                  <div className="text-[10px] text-[#F4F6F0]/60 flex items-center gap-1.5"><Mail size={12} className="text-[#F4F6F0]/50" /> {order.user_email}</div>
                                </div>
                                <div className="space-y-1.5">
                                  <span className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-black block">Dirección de Despacho</span>
                                  <div className="text-xs font-black flex items-center gap-1.5 text-[#F4F6F0]"><MapPin size={12} className="text-[#F4F6F0]/50" /> {order.address}</div>
                                  <div className="text-[10px] text-[#F4F6F0]/60 pl-4">{order.city}, {order.country}</div>
                                </div>
                              </div>

                              {/* Items table list */}
                              <div className="space-y-1.5">
                                <span className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-black block">Artículos a Enviar</span>
                                <div className="flex flex-wrap gap-2">
                                  {order.items.map((item: any, idx: number) => (
                                    <span key={idx} className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-bold text-[#F4F6F0]/80">
                                      {item.quantity}x <span className="text-amber-honey font-black uppercase tracking-wider">{item.product_name}</span> (${item.price})
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Right actions: Total & Shipping Buttons */}
                            <div className="flex flex-col items-end gap-3 shrink-0 self-stretch lg:self-center justify-between border-t lg:border-t-0 border-white/10 pt-4 lg:pt-0">
                              <div className="text-right">
                                <span className="text-[9px] uppercase tracking-widest text-[#F4F6F0]/40 font-black block mb-0.5">Total Abonado</span>
                                <span className="text-lg font-black text-amber-honey">${order.total_amount}</span>
                              </div>

                              {order.status === 'paid' && (
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => handleUpdateOrderStatus(order.id, 'shipped')}
                                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-[9px] px-5 py-3.5 rounded-xl transition-all shadow-[0_2px_15px_rgba(245,158,11,0.15)] flex items-center gap-1.5"
                                >
                                  <Truck size={12} /> Generar Guía y Despachar
                                </motion.button>
                              )}

                              {order.status === 'shipped' && (
                                <div className="flex flex-col gap-2 w-full">
                                  <div className="p-2 bg-blue-950/20 border border-blue-500/20 rounded-lg text-[9px] text-blue-400 font-mono text-center font-bold">
                                    En Tránsito
                                  </div>
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                                    className="border border-green-500/20 bg-green-500/10 text-green-400 font-black uppercase tracking-widest text-[9px] px-5 py-3 rounded-xl hover:bg-green-500/25 transition-all flex items-center justify-center gap-1"
                                  >
                                    <Check size={12} /> Confirmar Entrega
                                  </motion.button>
                                </div>
                              )}

                              {order.status === 'delivered' && (
                                <div className="flex items-center gap-1 text-green-400 text-xs font-black uppercase tracking-widest border border-green-500/20 bg-green-950/20 px-4 py-2 rounded-xl">
                                  <Check size={14} /> Entregado
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </motion.div>
              )}

              {/* TAB 3: EXPENSES LEDGER */}
              {activeTab === 'expenses' && (
                <motion.div
                  key="expenses-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                >
                  {/* Left Column: Expenses History List */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <h3 className="text-lg font-black uppercase italic tracking-tight text-[#F4F6F0]">Registro de Gastos Históricos</h3>
                        <p className="text-[10px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold mt-0.5">Control de pérdidas y costos logísticos</p>
                      </div>
                    </div>

                    {expenses.length === 0 ? (
                      <div className="amber-glass border border-white/10 p-16 rounded-[2.5rem] text-center flex flex-col items-center justify-center gap-4 shadow-lg">
                        <ClipboardList size={48} className="text-[#F4F6F0]/10" />
                        <p className="text-xs uppercase tracking-widest font-black text-[#F4F6F0]/30">No se han registrado gastos operativos aún</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {expenses.map((e) => (
                          <div key={e.id} className="bg-white/5 border border-white/10 p-5 rounded-2xl flex justify-between items-center gap-6 shadow-lg">
                            <div className="space-y-1">
                              <div className="text-xs font-black uppercase tracking-wider text-[#F4F6F0]">{e.title}</div>
                              {e.description && <p className="text-[10px] text-[#F4F6F0]/60 leading-relaxed max-w-md">{e.description}</p>}
                              <div className="flex gap-3 text-[9px] opacity-40 font-bold uppercase tracking-widest pt-1 text-[#F4F6F0]">
                                <span>Categoría: {e.category}</span>
                                <span>•</span>
                                <span>{new Date(e.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-sm font-mono font-black text-red-400">-${e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Add Expense Form */}
                  <div className="amber-glass border border-white/10 p-6 rounded-[2rem] h-fit shadow-lg shadow-black/20">
                    <h3 className="text-lg font-black uppercase italic tracking-tight mb-4 flex items-center gap-2 text-[#F4F6F0]">
                      <PlusCircle size={18} className="text-amber-honey" /> Registrar Gasto
                    </h3>

                    <form onSubmit={handleAddExpense} className="space-y-4">
                      {expenseSuccess && (
                        <motion.div
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="p-3.5 bg-green-950/20 border border-green-500/20 text-green-400 rounded-xl text-xs font-bold uppercase tracking-wider text-center"
                        >
                          ¡Gasto registrado con éxito!
                        </motion.div>
                      )}

                      {/* Title */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Título del Gasto</label>
                        <input
                          type="text"
                          required
                          value={expenseTitle}
                          onChange={(e) => setExpenseTitle(e.target.value)}
                          placeholder="Ej: Tarifas de Envío DHL"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold text-white placeholder-white/30"
                        />
                      </div>

                      {/* Amount */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Monto (USD/ARS)</label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-xs font-bold">$</div>
                          <input
                            type="number"
                            required
                            step="0.01"
                            value={expenseAmount}
                            onChange={(e) => setExpenseAmount(e.target.value)}
                            placeholder="1500.00"
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold font-mono text-white placeholder-white/30"
                          />
                        </div>
                      </div>

                      {/* Category Selection */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Categoría</label>
                        <select
                          value={expenseCategory}
                          onChange={(e) => setExpenseCategory(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold uppercase tracking-wider text-white bg-[#121915]"
                        >
                          <option value="Logística & Envío" className="bg-[#121915]">🚚 Logística & Envío</option>
                          <option value="Producción de Merch" className="bg-[#121915]">👕 Producción de Merch</option>
                          <option value="Licencias & Hosting" className="bg-[#121915]">💻 Licencias & Hosting</option>
                          <option value="Honorarios Artistas" className="bg-[#121915]">Honorarios Artistas</option>
                          <option value="Marketing & Anuncios" className="bg-[#121915]">📢 Marketing & Anuncios</option>
                          <option value="Gastos Generales" className="bg-[#121915]">💸 Gastos Generales</option>
                        </select>
                      </div>

                      {/* Description */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Descripción Breve</label>
                        <textarea
                          rows={3}
                          value={expenseDesc}
                          onChange={(e) => setExpenseDesc(e.target.value)}
                          placeholder="Detalles complementarios del gasto..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold text-white placeholder-white/30"
                        />
                      </div>

                      {/* Submit Button */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        type="submit"
                        disabled={expenseLoading}
                        className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-[9px] py-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-[0_2px_15px_rgba(245,158,11,0.15)] disabled:opacity-50 mt-2"
                      >
                        {expenseLoading ? (
                          <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        ) : (
                          <><Plus size={12} /> Registrar en Bóveda</>
                        )}
                      </motion.button>
                    </form>
                  </div>
                </motion.div>
              )}

              {/* TAB 4: MERCHANDISE CATALOG */}
              {activeTab === 'catalog' && (
                <motion.div
                  key="catalog-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Notifications */}
                  {catalogSuccessMsg && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl text-xs font-bold uppercase tracking-wider text-center">
                      {catalogSuccessMsg}
                    </div>
                  )}
                  {catalogErrorMsg && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs font-bold uppercase tracking-wider text-center">
                      {catalogErrorMsg}
                    </div>
                  )}

                  {/* Catalog Navigation Sub-Bar & Create Buttons */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0B0F0D]/40 border border-white/10 p-4 rounded-[2rem] shadow-lg">
                    <div className="flex gap-2 bg-white/5 border border-white/10 p-1 rounded-xl">
                      <button
                        onClick={() => setCatalogSubTab('products')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${catalogSubTab === 'products'
                          ? 'bg-white/10 text-white'
                          : 'text-[#F4F6F0]/50 hover:text-[#F4F6F0] hover:bg-white/5'
                          }`}
                      >
                        🛍️ Productos ({products.length})
                      </button>
                      <button
                        onClick={() => setCatalogSubTab('categories')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${catalogSubTab === 'categories'
                          ? 'bg-white/10 text-white'
                          : 'text-[#F4F6F0]/50 hover:text-[#F4F6F0] hover:bg-white/5'
                          }`}
                      >
                        🏷️ Categorías ({categories.length})
                      </button>
                    </div>

                    {catalogSubTab === 'products' ? (
                      <button
                        onClick={openProductCreateModal}
                        className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-[9px] px-5 py-3 rounded-xl transition-all shadow-[0_2px_15px_rgba(245,158,11,0.15)]"
                      >
                        <PlusCircle size={14} /> Agregar Producto
                      </button>
                    ) : (
                      <button
                        onClick={openCategoryCreateModal}
                        className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-[9px] px-5 py-3 rounded-xl transition-all shadow-[0_2px_15px_rgba(245,158,11,0.15)]"
                      >
                        <PlusCircle size={14} /> Agregar Categoría
                      </button>
                    )}
                  </div>

                  {/* Sub-Tab Content: Products Grid */}
                  {catalogSubTab === 'products' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {products.length === 0 ? (
                        <div className="col-span-full bg-white/5 border border-white/10 p-16 rounded-[2.5rem] text-center flex flex-col items-center justify-center gap-4 shadow-lg">
                          <ShoppingBag size={48} className="text-[#F4F6F0]/10" />
                          <p className="text-xs uppercase tracking-widest font-black text-[#F4F6F0]/30">No se encontraron productos registrados</p>
                        </div>
                      ) : (
                        products.map((product) => (
                          <div key={product.id} className="bg-white/5 border border-white/10 p-5 rounded-[2rem] hover:border-amber-honey/20 transition-all flex flex-col justify-between relative overflow-hidden group shadow-lg">
                            {/* Status badge */}
                            <div className="absolute top-4 right-4 flex gap-2 z-10">
                              <button
                                onClick={() => handleProductToggleActive(product)}
                                title={product.is_active ? "Desactivar" : "Activar"}
                                className={`p-2 rounded-xl border backdrop-blur-md transition-all ${product.is_active
                                  ? 'bg-green-950/20 border-green-500/20 text-green-400'
                                  : 'bg-red-950/20 border-red-500/20 text-red-400'
                                  }`}
                              >
                                {product.is_active ? <Eye size={12} /> : <EyeOff size={12} />}
                              </button>
                            </div>

                            <div>
                              {/* Image Preview Container */}
                              <div className="w-full h-40 bg-white/5 border border-white/10 rounded-2xl mb-4 overflow-hidden relative flex items-center justify-center">
                                {product.image ? (
                                  <img
                                    src={product.image}
                                    alt={product.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                  />
                                ) : (
                                  <ShoppingBag size={40} className="text-[#F4F6F0]/10" />
                                )}
                              </div>

                              {/* Info */}
                              <div className="space-y-1">
                                <span className="text-[8px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-[#F4F6F0]/50 uppercase tracking-widest font-bold">
                                  {product.category_name || 'Sin Categoría'}
                                </span>
                                <h4 className="text-sm font-black text-[#F4F6F0] uppercase tracking-tight line-clamp-1 pt-1">{product.name}</h4>
                                <p className="text-[10px] text-[#F4F6F0]/60 line-clamp-2 leading-relaxed h-8">{product.description || 'Sin descripción'}</p>
                              </div>
                            </div>

                            {/* Bottom Metadata & CTA */}
                            <div className="border-t border-white/10 pt-4 mt-4 flex justify-between items-center">
                              <div>
                                <span className="text-[8px] uppercase tracking-widest text-[#F4F6F0]/40 font-black block">Precio & Stock</span>
                                <div className="flex gap-2 items-baseline">
                                  <span className="text-sm font-black text-amber-honey">${product.price}</span>
                                  <span className={`text-[9px] font-mono font-bold ${product.stock > 5 ? 'text-[#F4F6F0]/50' : 'text-red-400 animate-pulse'}`}>
                                    ({product.stock} disp.)
                                  </span>
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => openProductEditModal(product)}
                                  className="p-2.5 bg-white/5 border border-white/10 hover:border-amber-honey/30 hover:bg-amber-honey/10 text-[#F4F6F0] rounded-xl transition-all"
                                  title="Editar Producto"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  onClick={() => handleProductDelete(product.id)}
                                  className="p-2.5 bg-white/5 border border-white/10 hover:border-red-500/30 hover:bg-red-950/20 border-red-500/20 text-red-400 rounded-xl transition-all"
                                  title="Eliminar Producto"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Sub-Tab Content: Categories List */}
                  {catalogSubTab === 'categories' && (
                    <div className="space-y-4">
                      {categories.length === 0 ? (
                        <div className="bg-white/5 border border-white/10 p-16 rounded-[2.5rem] text-center flex flex-col items-center justify-center gap-4 shadow-lg">
                          <Layers size={48} className="text-[#F4F6F0]/10" />
                          <p className="text-xs uppercase tracking-widest font-black text-[#F4F6F0]/30">No se encontraron categorías registradas</p>
                        </div>
                      ) : (
                        categories.map((category) => (
                          <div key={category.id} className="bg-white/5 border border-white/10 p-5 rounded-2xl hover:border-amber-honey/20 transition-all flex justify-between items-center gap-6 shadow-lg">
                            <div>
                              <h4 className="text-xs font-black uppercase tracking-wider text-[#F4F6F0]">{category.name}</h4>
                              <p className="text-[10px] text-amber-honey/60 font-mono font-bold mt-0.5">slug: {category.slug}</p>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => openCategoryEditModal(category)}
                                className="p-2.5 bg-white/5 border border-white/10 hover:border-amber-honey/30 hover:bg-amber-honey/10 text-[#F4F6F0] rounded-xl transition-all"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => handleCategoryDelete(category.id)}
                                className="p-2.5 bg-white/5 border border-white/10 hover:border-red-500/30 hover:bg-red-950/10 text-red-400 rounded-xl transition-all"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* PRODUCT CREATION/EDIT MODAL OVERLAY */}
                  {isProductModalOpen && (
                    <div
                      onClick={() => setIsProductModalOpen(false)}
                      className="fixed inset-0 bg-[#0B0F0D]/60 z-[120] flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm"
                    >
                      <motion.div
                        onClick={e => e.stopPropagation()}
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="amber-glass max-w-xl w-full p-8 rounded-[2.5rem] shadow-2xl relative my-8 overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-honey/40 to-transparent" />
                        <button
                          onClick={() => setIsProductModalOpen(false)}
                          className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-xl text-[#F4F6F0]/50 hover:text-white transition-all"
                        >
                          <X size={16} />
                        </button>

                        <h3 className="text-xl font-black uppercase italic tracking-tight mb-6 text-[#F4F6F0] flex items-center gap-2">
                          <ShoppingBag size={20} className="text-amber-honey" />
                          {prodId ? 'Editar Producto Merch' : 'Nuevo Producto Merch'}
                        </h3>

                        <form onSubmit={handleProductSubmit} className="space-y-4">
                          {/* Name */}
                          <div className="space-y-1">
                            <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Nombre del Producto</label>
                            <input
                              type="text"
                              required
                              value={prodName}
                              onChange={(e) => setProdName(e.target.value)}
                              placeholder="Ej: Remera Ms Ambar Premium Black"
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold text-white placeholder-white/30"
                            />
                          </div>

                          {/* Price & Stock */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Precio (USD)</label>
                              <input
                                type="number"
                                required
                                step="0.01"
                                value={prodPrice}
                                onChange={(e) => setProdPrice(e.target.value)}
                                placeholder="25.00"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold font-mono text-white placeholder-white/30"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Stock Disponible</label>
                              <input
                                type="number"
                                required
                                value={prodStock}
                                onChange={(e) => setProdStock(e.target.value)}
                                placeholder="50"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold font-mono text-white placeholder-white/30"
                              />
                            </div>
                          </div>

                          {/* Category Select */}
                          <div className="space-y-1">
                            <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Categoría</label>
                            <select
                              required
                              value={prodCategory}
                              onChange={(e) => setProdCategory(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold uppercase tracking-wider text-white bg-[#121915]"
                            >
                              <option value="" className="bg-[#121915] text-[#F4F6F0]">Seleccionar Categoría...</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id} className="bg-[#121915] text-[#F4F6F0]">🏷️ {c.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Image Upload */}
                          <div className="space-y-2">
                            <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Imagen del Producto</label>
                            <div className="flex gap-4 items-center bg-white/5 border border-white/10 p-4 rounded-xl">
                              <div className="w-16 h-16 bg-white/5 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-white/10">
                                {prodImagePreview ? (
                                  <img src={prodImagePreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                  <ShoppingBag size={24} className="text-[#F4F6F0]/10" />
                                )}
                              </div>
                              <div className="space-y-1 flex-1">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setProdImageFile(file);
                                      setProdImagePreview(URL.createObjectURL(file));
                                    }
                                  }}
                                  className="text-[10px] text-[#F4F6F0]/60 file:bg-white/5 file:border-0 file:rounded-lg file:text-[#F4F6F0] file:px-3 file:py-1.5 file:text-[9px] file:uppercase file:font-black file:tracking-widest file:mr-3 cursor-pointer hover:file:bg-white/10"
                                />
                                <p className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold">Formatos recomendados: JPG, PNG o WebP. Máx 5MB.</p>
                              </div>
                            </div>
                          </div>

                          {/* Description */}
                          <div className="space-y-1">
                            <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Descripción del Producto</label>
                            <textarea
                              rows={3}
                              required
                              value={prodDesc}
                              onChange={(e) => setProdDesc(e.target.value)}
                              placeholder="Características, material, talles, etc..."
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold text-white placeholder-white/30"
                            />
                          </div>

                          {/* Active Status Checkbox */}
                          <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-4 rounded-xl">
                            <input
                              type="checkbox"
                              id="prodIsActive"
                              checked={prodIsActive}
                              onChange={(e) => setProdIsActive(e.target.checked)}
                              className="w-4 h-4 accent-amber-honey rounded border-white/10 cursor-pointer"
                            />
                            <label htmlFor="prodIsActive" className="text-[10px] text-[#F4F6F0]/80 uppercase tracking-widest font-black cursor-pointer selection:bg-transparent">
                              Artículo Activo (Visible en la Tienda Pública)
                            </label>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-4 pt-2">
                            <button
                              type="button"
                              onClick={() => setIsProductModalOpen(false)}
                              className="w-1/2 bg-white/5 hover:bg-white/10 border border-white/10 text-[#F4F6F0] font-black uppercase tracking-widest text-[9px] py-4 rounded-xl transition-all"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              disabled={catalogLoading}
                              className="w-1/2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-[9px] py-4 rounded-xl flex items-center justify-center gap-1.5 shadow-[0_2px_15px_rgba(245,158,11,0.15)] disabled:opacity-50"
                            >
                              {catalogLoading ? (
                                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                              ) : (
                                prodId ? 'Guardar Cambios' : 'Crear Producto'
                              )}
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    </div>
                  )}

                  {/* CATEGORY CREATION/EDIT MODAL OVERLAY */}
                  {isCategoryModalOpen && (
                    <div
                      onClick={() => setIsCategoryModalOpen(false)}
                      className="fixed inset-0 bg-[#0B0F0D]/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm"
                    >
                      <motion.div
                        onClick={e => e.stopPropagation()}
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="amber-glass max-w-md w-full p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-honey/40 to-transparent" />
                        <button
                          onClick={() => setIsCategoryModalOpen(false)}
                          className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-xl text-[#F4F6F0]/50 hover:text-white transition-all"
                        >
                          <X size={16} />
                        </button>

                        <h3 className="text-xl font-black uppercase italic tracking-tight mb-6 text-[#F4F6F0] flex items-center gap-2">
                          <Layers size={20} className="text-amber-honey" />
                          {catId ? 'Editar Categoría' : 'Nueva Categoría'}
                        </h3>

                        <form onSubmit={handleCategorySubmit} className="space-y-4">
                          {/* Name */}
                          <div className="space-y-1">
                            <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Nombre de la Categoría</label>
                            <input
                              type="text"
                              required
                              value={catName}
                              onChange={(e) => setCatName(e.target.value)}
                              placeholder="Ej: Accesorios"
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold text-white placeholder-white/30"
                            />
                          </div>

                          {/* Slug */}
                          <div className="space-y-1">
                            <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Slug Personalizado (Opcional)</label>
                            <input
                              type="text"
                              value={catSlug}
                              onChange={(e) => setCatSlug(e.target.value)}
                              placeholder="Ej: accesorios-indumentaria"
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold font-mono text-white placeholder-white/30"
                            />
                          </div>

                          {/* Actions */}
                          <div className="flex gap-4 pt-2">
                            <button
                              type="button"
                              onClick={() => setIsCategoryModalOpen(false)}
                              className="w-1/2 bg-white/5 hover:bg-white/10 border border-white/10 text-[#F4F6F0] font-black uppercase tracking-widest text-[9px] py-4 rounded-xl transition-all"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              disabled={catalogLoading}
                              className="w-1/2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-[9px] py-4 rounded-xl flex items-center justify-center gap-1.5 shadow-[0_2px_15px_rgba(245,158,11,0.15)] disabled:opacity-50"
                            >
                              {catalogLoading ? 'Guardando...' : 'Guardar Categoría'}
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ══════ TAB 5: THEATERS MANAGEMENT ══════ */}
              {activeTab === 'theaters' && (
                <motion.div
                  key="theaters-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-2xl font-black uppercase italic tracking-tight flex items-center gap-2">
                        <MapPin size={20} className="text-amber-500" /> Gestión de Recintos
                      </h2>
                      <p className="text-[#F4F6F0]/50 text-[10px] uppercase tracking-widest font-bold mt-1">
                        Crea y administra teatros — abre cada uno en Nectar Studio para diseñar su planta
                      </p>
                    </div>
                    <button
                      onClick={openTheaterCreateModal}
                      className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-xs px-5 py-3 rounded-xl transition-all shadow-[0_4px_20px_rgba(245,158,11,0.15)]"
                    >
                      <Plus size={15} /> Nuevo Teatro
                    </button>
                  </div>

                  {/* Success / Error messages */}
                  {theaterSuccessMsg && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl">
                      <Check size={14} className="text-green-600 shrink-0" />
                      <p className="text-xs font-bold text-green-600">{theaterSuccessMsg}</p>
                    </motion.div>
                  )}
                  {theaterErrorMsg && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                      <AlertTriangle size={14} className="text-red-600 shrink-0" />
                      <p className="text-xs font-bold text-red-600">{theaterErrorMsg}</p>
                    </motion.div>
                  )}

                  {/* Theaters Grid */}
                  {theaters.length === 0 ? (
                    <div className="bg-white/5 border border-white/10 rounded-[2rem] p-16 flex flex-col items-center gap-4 text-center shadow-lg shadow-black/20">
                      <MapPin size={48} className="text-[#F4F6F0]/20" />
                      <p className="text-[#F4F6F0]/40 text-xs uppercase tracking-widest font-black">Sin teatros registrados</p>
                      <p className="text-[#F4F6F0]/30 text-[10px] font-bold">Crea tu primer recinto para comenzar a vender boletos</p>
                      <button onClick={openTheaterCreateModal} className="mt-4 px-6 py-3 bg-amber-honey text-black font-black uppercase tracking-widest rounded-xl hover:bg-amber-gold transition-all">
                        Crear primer Teatro
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {theaters.map((theater: any, idx: number) => {
                        const seatCount = theater.seats?.length ?? 0;
                        const syncSt = theaterSyncStatus[theater.id] || 'idle';
                        return (
                          <motion.div
                            key={theater.id ? `theater-${theater.id}` : `theater-idx-${idx}`}
                            whileHover={{ y: -4 }}
                            className="bg-white/5 border border-white/10 hover:border-amber-honey/40 rounded-[2rem] p-6 flex flex-col gap-5 transition-all shadow-lg shadow-black/20"
                          >
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-amber-honey/10 border border-amber-honey/20 flex items-center justify-center shrink-0">
                                  <MapPin size={18} className="text-amber-honey" />
                                </div>
                                <div>
                                  <h3 className="text-sm font-black text-[#F4F6F0] leading-tight">{theater.name}</h3>
                                  <p className="text-[9px] text-[#F4F6F0]/50 uppercase tracking-widest font-bold mt-0.5">{theater.location || 'Sin ubicación'}</p>
                                </div>
                              </div>
                              <span className="shrink-0 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[#F4F6F0]/60">
                                ID #{theater.id}
                              </span>
                            </div>

                            {/* Stats row */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                                <p className="text-[8px] uppercase tracking-widest text-[#F4F6F0]/50 font-bold">Asientos</p>
                                <p className="text-lg font-black text-[#F4F6F0] mt-1">{seatCount}</p>
                              </div>
                              <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                                <p className="text-[8px] uppercase tracking-widest text-[#F4F6F0]/50 font-bold">Zonas GA</p>
                                <p className="text-lg font-black text-[#F4F6F0] mt-1">{theater.ga_zones?.length ?? 0}</p>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2">
                              {/* Sync seats button */}
                              <button
                                onClick={() => handleTheaterSync(theater.id)}
                                disabled={syncSt === 'loading'}
                                className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${syncSt === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                                  syncSt === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                    'bg-white/5 border border-white/10 text-[#F4F6F0]/60 hover:bg-white/10 hover:text-white'
                                  }`}
                              >
                                {syncSt === 'loading' ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> :
                                  syncSt === 'success' ? <Check size={12} /> :
                                    syncSt === 'error' ? <AlertTriangle size={12} /> :
                                      <Layers size={12} />}
                                {syncSt === 'success' ? 'Asientos Sincronizados' : syncSt === 'error' ? 'Error al Sincronizar' : 'Sincronizar Asientos'}
                              </button>

                              {/* Secondary actions */}
                              <div className="grid grid-cols-3 gap-2">
                                <Link
                                  href="/designer"
                                  onClick={() => { }}
                                  className="py-2.5 rounded-xl text-[8px] font-black uppercase tracking-wider text-center bg-amber-honey/10 border border-amber-honey/20 text-amber-honey hover:bg-amber-honey hover:text-black hover:font-bold transition-all flex items-center justify-center gap-1"
                                >
                                  <Layers size={11} /> Diseñar
                                </Link>
                                <button
                                  onClick={() => openTheaterEditModal(theater)}
                                  className="py-2.5 rounded-xl text-[8px] font-black uppercase tracking-wider bg-white/5 border border-white/10 text-[#F4F6F0]/60 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-1"
                                >
                                  <Edit2 size={11} /> Editar
                                </button>
                                <button
                                  onClick={() => handleTheaterDelete(theater.id, theater.name)}
                                  className="py-2.5 rounded-xl text-[8px] font-black uppercase tracking-wider bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-1"
                                >
                                  <Trash2 size={11} /> Borrar
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ══════ THEATER MODAL (Dashboard) ══════ */}
              <AnimatePresence>
                {isTheaterModalOpen && (
                  <motion.div
                    key="theater-modal-wrapper"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-[#0B0F0D]/60 backdrop-blur-md"
                    onClick={() => setIsTheaterModalOpen(false)}
                  >
                    <motion.div
                      onClick={e => e.stopPropagation()}
                      initial={{ opacity: 0, scale: 0.93, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93, y: 20 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                      className="amber-glass w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-honey/40 to-transparent" />
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-amber-honey/10 border border-amber-honey/20 rounded-2xl flex items-center justify-center">
                            <MapPin size={20} className="text-amber-honey" />
                          </div>
                          <div>
                            <h2 className="text-[13px] font-black uppercase tracking-[0.25em] text-[#F4F6F0]">
                              {editingTheater ? 'Editar Teatro' : 'Nuevo Teatro'}
                            </h2>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-amber-honey mt-0.5">Nectar Studio — Venue Management</p>
                          </div>
                        </div>
                        <button onClick={() => setIsTheaterModalOpen(false)} className="w-9 h-9 rounded-xl bg-white/5 text-[#F4F6F0]/40 hover:bg-white/10 hover:text-white flex items-center justify-center transition-all">
                          <X size={16} />
                        </button>
                      </div>

                      <form onSubmit={handleTheaterSubmit} className="space-y-5">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F4F6F0]/60 block">Nombre del Recinto *</label>
                          <input
                            type="text" autoFocus value={theaterName} onChange={(e) => setTheaterName(e.target.value)}
                            placeholder="Ej: Teatro Metropólitan CDMX"
                            className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold outline-none focus:border-amber-honey transition-all placeholder:text-white/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F4F6F0]/60 block">Ubicación / Ciudad</label>
                          <input
                            type="text" value={theaterLocation} onChange={(e) => setTheaterLocation(e.target.value)}
                            placeholder="Ej: Ciudad de México, CDMX"
                            className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold outline-none focus:border-amber-honey transition-all placeholder:text-white/30"
                          />
                        </div>
                        {!editingTheater && (
                          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-honey/10 border border-amber-honey/20">
                            <Calendar size={14} className="text-amber-honey mt-0.5 shrink-0" />
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#F4F6F0]/70 leading-relaxed">
                              Después de crear el teatro, ábrelo en Nectar Studio Designer para diseñar la planta y agregar butacas.
                            </p>
                          </div>
                        )}
                        {theaterErrorMsg && (
                          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                            <AlertTriangle size={13} className="text-red-400 shrink-0" />
                            <p className="text-[10px] font-bold text-red-400">{theaterErrorMsg}</p>
                          </div>
                        )}
                        <div className="flex gap-3 pt-2">
                          <button type="button" onClick={() => setIsTheaterModalOpen(false)} className="flex-1 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] bg-white/5 border border-white/10 text-[#F4F6F0]/60 hover:bg-white/10 transition-all">
                            Cancelar
                          </button>
                          <button type="submit" disabled={theaterLoading} className="flex-1 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] bg-gradient-to-r from-amber-500 to-amber-600 text-black flex items-center justify-center gap-2 shadow-[0_2px_15px_rgba(245,158,11,0.2)] disabled:opacity-50">
                            {theaterLoading
                              ? <><div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Guardando...</>
                              : <><Check size={13} /> {editingTheater ? 'Guardar Cambios' : 'Crear Teatro'}</>
                            }
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ══════ EVENT MODAL (Dashboard) ══════ */}
              <AnimatePresence>
                {isEventModalOpen && (
                  <motion.div
                    key="event-modal-wrapper"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-[#0B0F0D]/60 backdrop-blur-md overflow-y-auto"
                    onClick={() => setIsEventModalOpen(false)}
                  >
                    <motion.div
                      onClick={e => e.stopPropagation()}
                      initial={{ opacity: 0, scale: 0.93, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.93, y: 20 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                      className="amber-glass w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden my-8"
                    >
                      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-honey/40 to-transparent" />
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-amber-honey/10 border border-amber-honey/20 rounded-2xl flex items-center justify-center">
                            <Calendar size={20} className="text-amber-honey" />
                          </div>
                          <div>
                            <h2 className="text-[13px] font-black uppercase tracking-[0.25em] text-[#F4F6F0]">
                              {editingEvent ? 'Editar Evento' : 'Nuevo Evento'}
                            </h2>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-amber-honey mt-0.5">Ms Ambar — Event Management</p>
                          </div>
                        </div>
                        <button onClick={() => setIsEventModalOpen(false)} className="w-9 h-9 rounded-xl bg-white/5 text-[#F4F6F0]/40 hover:bg-white/10 hover:text-white flex items-center justify-center transition-all">
                          <X size={16} />
                        </button>
                      </div>

                      <form onSubmit={handleEventSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                        {/* Title */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F4F6F0]/60 block">Título del Evento *</label>
                          <input
                            type="text" required value={eventTitle} onChange={(e) => setEventTitle(e.target.value)}
                            placeholder="Ej: Ms Ambar en Concierto Acústico"
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold outline-none focus:border-amber-honey transition-all"
                          />
                        </div>

                        {/* Artist */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F4F6F0]/60 block">Artista / Intérprete *</label>
                          <input
                            type="text" required value={eventArtist} onChange={(e) => setEventArtist(e.target.value)}
                            placeholder="Ej: Ms Ambar"
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold outline-none focus:border-amber-honey transition-all"
                          />
                        </div>

                        {/* Date & Type */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F4F6F0]/60 block">Fecha y Hora *</label>
                            <input
                              type="datetime-local" required value={eventDate} onChange={(e) => setEventDate(e.target.value)}
                              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold outline-none focus:border-amber-honey transition-all [color-scheme:dark]"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F4F6F0]/60 block">Tipo de Evento *</label>
                            <select
                              value={eventType} onChange={(e) => setEventType(e.target.value as any)}
                              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold outline-none focus:border-amber-honey transition-all [color-scheme:dark]"
                            >
                              <option value="concert">Concierto / Venue</option>
                              <option value="meet_greet">Meet & Greet (Convivencia)</option>
                            </select>
                          </div>
                        </div>

                        {/* Conditional Theater (Only for concert) */}
                        {eventType === 'concert' && (
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F4F6F0]/60 block">Teatro / Recinto *</label>
                            <select
                              required value={eventTheater} onChange={(e) => setEventTheater(e.target.value)}
                              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold outline-none focus:border-amber-honey transition-all [color-scheme:dark]"
                            >
                              <option value="">-- Selecciona un Recinto --</option>
                              {theaters.map((t: any) => (
                                <option key={t.id} value={t.id}>{t.name} ({t.location})</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Pricing Configuration */}
                        <div className="grid grid-cols-2 gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                          {eventType === 'concert' ? (
                            <>
                              <div className="space-y-1 col-span-2 sm:col-span-1">
                                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-honey block">Precio Base del Boleto ($ MXN) *</label>
                                <input
                                  type="number" step="10" min="0" required
                                  value={
                                    (() => {
                                      const minSeat = (() => {
                                        const t = theaters.find((x: any) => x.id?.toString() === eventTheater?.toString());
                                        if (!t || !t.seats || t.seats.length === 0) return 1000;
                                        const prices = t.seats.map((s: any) => Number(s.base_price || 1000));
                                        return Math.min(...prices) || 1000;
                                      })();
                                      return Math.round(minSeat * parseFloat(eventPriceMultiplier || '1.0'));
                                    })()
                                  }
                                  onChange={(e) => {
                                    const desired = parseFloat(e.target.value) || 0;
                                    const minSeat = (() => {
                                      const t = theaters.find((x: any) => x.id?.toString() === eventTheater?.toString());
                                      if (!t || !t.seats || t.seats.length === 0) return 1000;
                                      const prices = t.seats.map((s: any) => Number(s.base_price || 1000));
                                      return Math.min(...prices) || 1000;
                                    })();
                                    const newMult = (desired / minSeat).toFixed(2);
                                    setEventPriceMultiplier(newMult);
                                  }}
                                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold outline-none focus:border-amber-honey transition-all"
                                />
                                <span className="text-[8px] text-[#F4F6F0]/40 font-bold uppercase tracking-wider block">Precio base estimado por entrada.</span>
                              </div>

                              <div className="space-y-1 col-span-2 sm:col-span-1">
                                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-honey block">Multiplicador de Precios</label>
                                <input
                                  type="number" step="0.01" min="0.1" required value={eventPriceMultiplier} onChange={(e) => setEventPriceMultiplier(e.target.value)}
                                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold outline-none focus:border-amber-honey transition-all"
                                />
                                <span className="text-[8px] text-[#F4F6F0]/40 font-bold uppercase tracking-wider block">Factor de escala sobre mapa del teatro.</span>
                              </div>

                              <div className="space-y-1 col-span-2 sm:col-span-1">
                                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-honey block">Upgrade VIP Meet & Greet ($ MXN)</label>
                                <input
                                  type="number" step="10" min="0" required value={eventMgPrice} onChange={(e) => setEventMgPrice(e.target.value)}
                                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold outline-none focus:border-amber-honey transition-all"
                                />
                                <span className="text-[8px] text-[#F4F6F0]/40 font-bold uppercase tracking-wider block">Dejar en 0 si no se ofrece upgrade.</span>
                              </div>

                              <div className="space-y-1 col-span-2 sm:col-span-1">
                                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-honey block">Límite Upgrades VIP M&G</label>
                                <input
                                  type="number" min="0" required value={eventMgLimit} onChange={(e) => setEventMgLimit(e.target.value)}
                                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold outline-none focus:border-amber-honey transition-all"
                                />
                                <span className="text-[8px] text-[#F4F6F0]/40 font-bold uppercase tracking-wider block">Capacidad máxima de pases VIP.</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="space-y-1 col-span-2 sm:col-span-1">
                                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-honey block">Precio del Boleto ($ MXN) *</label>
                                <input
                                  type="number" step="10" min="0" required value={eventMgPrice} onChange={(e) => setEventMgPrice(e.target.value)}
                                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold outline-none focus:border-amber-honey transition-all"
                                />
                                <span className="text-[8px] text-[#F4F6F0]/40 font-bold uppercase tracking-wider block">Precio por acceso de convivencia.</span>
                              </div>

                              <div className="space-y-1 col-span-2 sm:col-span-1">
                                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-honey block">Límite de Boletos (Capacidad) *</label>
                                <input
                                  type="number" min="0" required value={eventMgLimit} onChange={(e) => setEventMgLimit(e.target.value)}
                                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold outline-none focus:border-amber-honey transition-all"
                                />
                                <span className="text-[8px] text-[#F4F6F0]/40 font-bold uppercase tracking-wider block">Total de accesos disponibles.</span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Flyer Upload */}
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-honey block">🎟️ Flyer Oficial del Evento</label>
                          <div className="flex gap-4 items-center">
                            <div className="flex-1">
                              <input
                                type="file" accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setEventFlyerFile(file);
                                    const reader = new FileReader();
                                    reader.onloadend = () => setEventFlyerPreview(reader.result as string);
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="w-full text-xs text-[#F4F6F0]/60 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-widest file:bg-amber-honey/20 file:text-amber-honey hover:file:bg-amber-honey/30 file:cursor-pointer"
                              />
                            </div>
                            {eventFlyerPreview && (
                              <div className="w-24 h-14 rounded-xl border border-amber-honey/20 bg-black/40 overflow-hidden shrink-0">
                                <img src={eventFlyerPreview} alt="Flyer Preview" className="w-full h-full object-cover" />
                              </div>
                            )}
                          </div>
                          <span className="text-[8px] text-[#F4F6F0]/30 font-bold uppercase tracking-wider block">Se mostrará en la landing page y en la p&aacute;gina de compra de boletos.</span>
                        </div>

                        {/* Image Upload */}
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F4F6F0]/60 block">Imagen de Portada</label>
                          <div className="flex gap-4 items-center">
                            <div className="flex-1">
                              <input
                                type="file" accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setEventImageFile(file);
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setEventImagePreview(reader.result as string);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="w-full text-xs text-[#F4F6F0]/60 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-widest file:bg-amber-honey file:text-black hover:file:bg-amber-gold file:cursor-pointer"
                              />
                            </div>
                            {eventImagePreview && (
                              <div className="w-16 h-16 rounded-xl border border-white/10 bg-black/40 overflow-hidden shrink-0">
                                <img src={eventImagePreview} alt="Preview" className="w-full h-full object-cover" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Active Toggle */}
                        <div className="flex items-center gap-3 pt-2">
                          <input
                            type="checkbox" id="eventIsActive" checked={eventIsActive} onChange={(e) => setEventIsActive(e.target.checked)}
                            className="w-4 h-4 rounded border-white/10 bg-white/5 text-amber-honey focus:ring-amber-honey [color-scheme:dark]"
                          />
                          <label htmlFor="eventIsActive" className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F4F6F0]/80 cursor-pointer">
                            Evento Activo (Visible para los clientes)
                          </label>
                        </div>

                        {eventErrorMsg && (
                          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                            <AlertTriangle size={13} className="text-red-400 shrink-0" />
                            <p className="text-[10px] font-bold text-red-400">{eventErrorMsg}</p>
                          </div>
                        )}

                        {eventSuccessMsg && (
                          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                            <Check size={13} className="text-green-400 shrink-0" />
                            <p className="text-[10px] font-bold text-green-400">{eventSuccessMsg}</p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 pt-4">
                          <button type="button" onClick={() => setIsEventModalOpen(false)} className="flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] bg-white/5 border border-white/10 text-[#F4F6F0]/60 hover:bg-white/10 transition-all">
                            Cancelar
                          </button>
                          <button type="submit" disabled={eventLoading} className="flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] bg-gradient-to-r from-amber-500 to-amber-600 text-black flex items-center justify-center gap-2 shadow-[0_2px_15px_rgba(245,158,11,0.2)] disabled:opacity-50">
                            {eventLoading
                              ? <><div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Guardando...</>
                              : <><Check size={13} /> {editingEvent ? 'Guardar Cambios' : 'Crear Evento'}</>
                            }
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ══════ TAB 6: CONTRACTS PIPELINE ══════ */}
              {activeTab === 'contracts' && (
                <motion.div
                  key="contracts-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div>
                      <h2 className="text-2xl font-black uppercase italic tracking-tight flex items-center gap-2 text-[#F4F6F0]">
                        ✍️ Pipeline de Contratos Artísticos
                      </h2>
                      <p className="text-[#F4F6F0]/50 text-[10px] uppercase tracking-widest font-bold mt-1">
                        Monitorea, comparte enlaces y contrafirma acuerdos digitales de MS Ambar
                      </p>
                    </div>
                  </div>

                  {/* Pipeline Kanban Columns */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                    {/* Column 1: Generated/Pending Client Signature */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-3 pb-2 border-b border-white/10">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-honey flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-honey animate-pulse" /> Propuestas (Cliente Pendiente)
                        </span>
                        <span className="text-[10px] font-black text-[#F4F6F0]/60 bg-white/5 px-2 py-0.5 rounded-full">
                          {contracts.filter(c => !c.signature_base64).length}
                        </span>
                      </div>

                      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                        {contracts.filter(c => !c.signature_base64).length === 0 ? (
                          <div className="p-8 text-center rounded-[2rem] border border-white/10 bg-white/5 text-xs text-[#F4F6F0]/40 italic">
                            No hay propuestas pendientes
                          </div>
                        ) : (
                          contracts.filter(c => !c.signature_base64).map((c: any) => (
                            <div key={c.id} className="p-6 rounded-3xl border border-white/10 bg-white/5 space-y-4 hover:border-amber-honey/30 transition-all shadow-lg shadow-black/20">
                              <div className="space-y-1">
                                <h4 className="text-sm font-black text-[#F4F6F0]">{c.inquiry_detail?.name || 'Promotor'}</h4>
                                <p className="text-[8px] font-bold text-[#F4F6F0]/50 uppercase tracking-widest">
                                  {c.inquiry_detail?.company || 'Particular'}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-4 pt-2 text-[10px]">
                                <div>
                                  <p className="opacity-40 uppercase font-bold text-[8px]">Fecha Show</p>
                                  <p className="font-bold text-[#F4F6F0]/80">{c.inquiry_detail?.date || 'Definir'}</p>
                                </div>
                                <div>
                                  <p className="opacity-40 uppercase font-bold text-[8px]">Honorarios</p>
                                  <p className="font-bold text-amber-honey">${parseFloat(c.fee).toLocaleString('es-MX')} MXN</p>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  const link = `${window.location.origin}/bookings/sign/${c.id}`;
                                  navigator.clipboard.writeText(link);
                                  showToast.success('Enlace de firma copiado al portapapeles!');
                                }}
                                className="w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-[#F4F6F0]/70 transition-all text-center block"
                              >
                                🔗 Copiar Enlace de Firma
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Column 2: Waiting for Manager Countersign */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-3 pb-2 border-b border-white/10">
                        <span className="text-[10px] font-black uppercase tracking-widest text-yellow-600 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-ping" /> Esperando Contrafirma
                        </span>
                        <span className="text-[10px] font-black text-[#F4F6F0]/60 bg-white/5 px-2 py-0.5 rounded-full">
                          {contracts.filter(c => c.signature_base64 && !c.is_fully_signed).length}
                        </span>
                      </div>

                      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                        {contracts.filter(c => c.signature_base64 && !c.is_fully_signed).length === 0 ? (
                          <div className="p-8 text-center rounded-[2rem] border border-white/10 bg-white/5 text-xs text-[#F4F6F0]/40 italic">
                            Ningún acuerdo pendiente de firma de management
                          </div>
                        ) : (
                          contracts.filter(c => c.signature_base64 && !c.is_fully_signed).map((c: any) => (
                            <div key={c.id} className="p-6 rounded-3xl border border-yellow-500/20 bg-white/5 space-y-4 hover:border-yellow-500/40 transition-all shadow-lg shadow-black/20">
                              <div className="space-y-1">
                                <h4 className="text-sm font-black text-[#F4F6F0]">{c.inquiry_detail?.name || 'Promotor'}</h4>
                                <p className="text-[8px] font-bold text-[#F4F6F0]/50 uppercase tracking-widest">
                                  {c.inquiry_detail?.company || 'Particular'}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-4 pt-2 text-[10px]">
                                <div>
                                  <p className="opacity-40 uppercase font-bold text-[8px]">Fecha Show</p>
                                  <p className="font-bold text-[#F4F6F0]/80">{c.inquiry_detail?.date || 'Definir'}</p>
                                </div>
                                <div>
                                  <p className="opacity-40 uppercase font-bold text-[8px]">Honorarios</p>
                                  <p className="font-bold text-amber-honey">${parseFloat(c.fee).toLocaleString('es-MX')} MXN</p>
                                </div>
                              </div>
                              <Link
                                href={`/bookings/sign/${c.id}`}
                                className="w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-yellow-500 hover:bg-yellow-600 text-black font-black transition-all text-center block"
                              >
                                ✍️ Firmar como Manager
                              </Link>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Column 3: Fully Signed and Certified */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-3 pb-2 border-b border-white/10">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Cerrados y Certificados
                        </span>
                        <span className="text-[10px] font-black text-[#F4F6F0]/60 bg-white/5 px-2 py-0.5 rounded-full">
                          {contracts.filter(c => c.is_fully_signed).length}
                        </span>
                      </div>

                      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                        {contracts.filter(c => c.is_fully_signed).length === 0 ? (
                          <div className="p-8 text-center rounded-[2rem] border border-white/10 bg-white/5 text-xs text-[#F4F6F0]/40 italic">
                            No hay contratos cerrados todavía
                          </div>
                        ) : (
                          contracts.filter(c => c.is_fully_signed).map((c: any) => {
                            const pdfUrl = c.pdf_file ? (c.pdf_file.startsWith('http') ? c.pdf_file : `${API_URL.replace('/api', '')}${c.pdf_file}`) : '#';
                            return (
                              <div key={c.id} className="p-6 rounded-3xl border border-emerald-500/20 bg-white/5 space-y-4 hover:border-emerald-500/40 transition-all shadow-lg shadow-black/20">
                                <div className="space-y-1">
                                  <h4 className="text-sm font-black text-[#F4F6F0]">{c.inquiry_detail?.name || 'Promotor'}</h4>
                                  <p className="text-[8px] font-bold text-[#F4F6F0]/50 uppercase tracking-widest">
                                    {c.inquiry_detail?.company || 'Particular'}
                                  </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2 text-[10px]">
                                  <div>
                                    <p className="opacity-40 uppercase font-bold text-[8px]">Fecha Show</p>
                                    <p className="font-bold text-[#F4F6F0]/80">{c.inquiry_detail?.date || 'Definir'}</p>
                                  </div>
                                  <div>
                                    <p className="opacity-40 uppercase font-bold text-[8px]">Honorarios</p>
                                    <p className="font-bold text-emerald-400">${parseFloat(c.fee).toLocaleString('es-MX')} MXN</p>
                                  </div>
                                </div>
                                <a
                                  href={pdfUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all text-center block border border-emerald-500/20"
                                >
                                  📄 Descargar Contrato PDF
                                </a>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                  </div>

                </motion.div>
              )}

              {/* TAB 7: EMAIL CAMPAIGNS */}
              {activeTab === 'campaigns' && (
                <motion.div
                  key="campaigns-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  {/* Campaigns Sub-Tab Navigation Bar */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 amber-glass border border-white/10 p-4 rounded-[2rem]">
                    <div className="flex gap-2 bg-white/5 border border-white/10 p-1 rounded-xl">
                      <button
                        onClick={() => setCampaignSubTab('campaigns')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${campaignSubTab === 'campaigns'
                          ? 'bg-amber-honey text-[#1E2B22] shadow-sm'
                          : 'text-[#F4F6F0]/50 hover:text-[#F4F6F0] hover:bg-white/5'
                          }`}
                      >
                        📧 Campañas de Marketing ({campaigns.length})
                      </button>
                      <button
                        onClick={() => setCampaignSubTab('subscribers')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${campaignSubTab === 'subscribers'
                          ? 'bg-amber-honey text-[#1E2B22] shadow-sm'
                          : 'text-[#F4F6F0]/50 hover:text-[#F4F6F0] hover:bg-white/5'
                          }`}
                      >
                        👥 Lista de Suscriptores ({subscribers.length})
                      </button>
                      <button
                        onClick={() => setCampaignSubTab('lists')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${campaignSubTab === 'lists'
                          ? 'bg-amber-honey text-[#1E2B22] shadow-sm'
                          : 'text-[#F4F6F0]/50 hover:text-[#F4F6F0] hover:bg-white/5'
                          }`}
                      >
                        🎯 Listas de Contactos ({marketingLists.length})
                      </button>
                    </div>

                    {campaignSubTab === 'campaigns' ? (
                      <button
                        onClick={openCampaignCreateModal}
                        className="bg-amber-honey text-black px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-gold transition-all flex items-center gap-2"
                      >
                        <Plus size={14} /> Nueva Campaña
                      </button>
                    ) : campaignSubTab === 'lists' ? (
                      <button
                        onClick={() => {
                          setListName('');
                          setListDescription('');
                          setListErrorMsg(null);
                          setIsListModalOpen(true);
                        }}
                        className="bg-amber-honey text-black px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-gold transition-all flex items-center gap-2"
                      >
                        <Plus size={14} /> Nueva Lista
                      </button>
                    ) : (
                      <span className="text-[10px] text-[#F4F6F0]/50 uppercase tracking-widest font-black pr-4">
                        Importación y Gestión de Contactos
                      </span>
                    )}
                  </div>

                  {campaignSubTab === 'campaigns' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {campaigns.length === 0 ? (
                        <div className="col-span-full p-12 text-center rounded-[2rem] border border-white/10 bg-white/5 text-xs text-[#F4F6F0]/40 italic">
                          No has creado ninguna campaña de Marketing todavía.
                        </div>
                      ) : (
                        campaigns.map((c: any) => (
                          <div key={c.id} className="p-6 rounded-[2rem] border border-white/10 bg-white/5 space-y-4 hover:border-amber-honey/40 transition-all flex flex-col justify-between shadow-lg shadow-black/20">
                            <div className="space-y-3">
                              <div className="flex justify-between items-start">
                                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${c.template_type === 'moss' ? 'bg-green-950 text-green-300 border border-green-800' :
                                  c.template_type === 'cosmic' ? 'bg-purple-950 text-purple-300 border border-purple-800' :
                                    c.template_type === 'glow' ? 'bg-yellow-950 text-yellow-300 border border-yellow-800' :
                                      c.template_type === 'mist' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                                        'bg-neutral-900 text-neutral-300 border border-neutral-700'
                                  }`}>
                                  {c.template_type === 'minimalist' ? 'Minimalist Carbon' :
                                    c.template_type === 'moss' ? 'Moss Green' :
                                      c.template_type === 'cosmic' ? 'Cosmic Night' :
                                        c.template_type === 'glow' ? 'Amber Glow' :
                                          c.template_type === 'mist' ? 'Mystic Mist' : c.template_type}
                                </span>

                                {c.is_sent ? (
                                  <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
                                    Enviada
                                  </span>
                                ) : (
                                  <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
                                    Borrador
                                  </span>
                                )}
                              </div>

                              <div>
                                <h4 className="text-base font-black text-[#F4F6F0] leading-snug line-clamp-2">{c.subject}</h4>
                                <p className="text-[9px] text-[#F4F6F0]/50 font-bold uppercase tracking-widest mt-1">
                                  Creado: {new Date(c.created_at).toLocaleDateString('es-MX')}
                                </p>
                                {c.is_sent && c.sent_at && (
                                  <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest font-mono">
                                    Enviado: {new Date(c.sent_at).toLocaleDateString('es-MX')}
                                  </p>
                                )}
                                {c.marketing_list_name ? (
                                  <div className="mt-2 flex items-center gap-1.5">
                                    <span className="text-[8.5px] font-black uppercase tracking-widest text-amber-honey bg-amber-honey/10 border border-amber-honey/20 px-2 py-0.5 rounded-lg">
                                      🎯 {c.marketing_list_name}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="mt-2 flex items-center gap-1.5">
                                    <span className="text-[8.5px] font-black uppercase tracking-widest text-[#F4F6F0]/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg">
                                      🌍 Todos los suscriptores
                                    </span>
                                  </div>
                                )}
                              </div>

                              <p className="text-xs text-[#F4F6F0]/70 line-clamp-4 italic bg-white/5 p-4 rounded-2xl border border-white/10 whitespace-pre-line">
                                {c.poem_text.substring(0, 180)}{c.poem_text.length > 180 ? '...' : ''}
                              </p>
                            </div>

                            <div className="flex gap-2 pt-4 border-t border-white/10">
                              <button
                                onClick={() => setPreviewCampaign(c)}
                                className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 text-[#F4F6F0]/70"
                              >
                                <Eye size={12} /> Previsualizar
                              </button>

                              {!c.is_sent && (
                                <>
                                  <button
                                    onClick={() => openCampaignEditModal(c)}
                                    className="w-10 h-10 bg-white/5 hover:bg-amber-honey/10 border border-white/10 hover:border-amber-honey/30 rounded-xl flex items-center justify-center text-[#F4F6F0]/60 hover:text-amber-honey transition-all"
                                    title="Editar"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleCampaignSend(c.id)}
                                    disabled={sendingCampaignId === c.id}
                                    className="flex-1 py-2 bg-amber-honey hover:bg-amber-gold text-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 font-bold shadow-lg shadow-amber-honey/15"
                                  >
                                    {sendingCampaignId === c.id ? 'Enviando...' : '🚀 Enviar'}
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleCampaignDelete(c.id, c.subject)}
                                className="w-10 h-10 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 rounded-xl flex items-center justify-center text-[#F4F6F0]/40 hover:text-red-400 transition-all"
                                title="Eliminar"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {campaignSubTab === 'subscribers' && (
                    <div className="space-y-6">
                      {/* Summary & CSV Uploader split */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Stats */}
                        <div className="amber-glass border border-white/10 p-6 rounded-[2rem] flex flex-col justify-between gap-4 shadow-lg shadow-black/20">
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-[#F4F6F0]/50 mb-4">Métricas del Newsletter</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                                <span className="text-[8px] uppercase tracking-widest opacity-40 font-bold block">Activos</span>
                                <span className="text-2xl font-black text-[#F4F6F0] font-mono">{subscribers.filter(s => s.is_active).length}</span>
                              </div>
                              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                                <span className="text-[8px] uppercase tracking-widest opacity-40 font-bold block">Premium</span>
                                <span className="text-2xl font-black text-amber-honey font-mono">{subscribers.filter(s => s.is_premium).length}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-[10px] text-[#F4F6F0]/50 uppercase tracking-widest font-black pl-1">
                            Total en Bóveda: {subscribers.length} contactos
                          </div>
                        </div>

                        {/* CSV Importer Form */}
                        <div className="lg:col-span-2 amber-glass border border-white/10 p-6 rounded-[2rem] shadow-lg shadow-black/20">
                          <h4 className="text-xs font-black uppercase tracking-wider text-amber-honey flex items-center gap-2 mb-2">
                            📥 Importador Masivo de Contactos (CSV)
                          </h4>
                          <p className="text-[9px] text-[#F4F6F0]/50 uppercase tracking-widest font-bold mb-4">
                            Sube un archivo para importar o actualizar tu lista. Columnas soportadas: subscriber_id, api_subscription_id, email, tags, status, premium?, created_at
                          </p>

                          <form onSubmit={handleCsvImport} className="flex flex-col sm:flex-row gap-4 items-end">
                            <div className="space-y-1.5 flex-1 w-full">
                              <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-bold block pl-1">Seleccionar Archivo CSV</label>
                              <input
                                type="file"
                                id="csv-file-input"
                                accept=".csv"
                                onChange={e => {
                                  const file = e.target.files?.[0] || null;
                                  setImportCsvFile(file);
                                }}
                                className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-amber-honey transition-all font-semibold file:bg-white/10 file:border-0 file:rounded-lg file:text-[#F4F6F0]/70 file:px-3 file:py-1 file:text-[9px] file:uppercase file:font-black file:tracking-widest file:mr-3 cursor-pointer hover:file:bg-white/20"
                              />
                            </div>

                            <div className="space-y-1.5 flex-1 w-full">
                              <label className="text-[9px] text-amber-honey uppercase tracking-widest font-bold block pl-1">🎯 Lista de Destino (Opcional)</label>
                              <select
                                value={importCsvMarketingList}
                                onChange={e => setImportCsvMarketingList(e.target.value)}
                                className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:border-amber-honey transition-all [color-scheme:dark]"
                              >
                                <option value="">-- Importar a contactos generales --</option>
                                {marketingLists.map((list: any) => (
                                  <option key={list.id} value={list.id}>
                                    {list.name} ({list.subscriber_count} suscriptores)
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              type="submit"
                              disabled={importCsvLoading}
                              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-[9px] px-6 py-4 rounded-xl transition-all shadow-[0_2px_15px_rgba(245,158,11,0.15)] disabled:opacity-50 w-full sm:w-auto self-stretch sm:self-end flex items-center justify-center gap-2"
                            >
                              {importCsvLoading ? (
                                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                              ) : (
                                'Importar Contactos'
                              )}
                            </button>
                          </form>

                          {importCsvSuccess && (
                            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/25 text-green-400 rounded-xl text-xs font-bold uppercase tracking-wider text-center">
                              {importCsvSuccess}
                            </div>
                          )}
                          {importCsvError && (
                            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider text-center">
                              {importCsvError}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Subscribers list table */}
                      <div className="amber-glass border border-white/10 rounded-[2rem] p-6 overflow-hidden shadow-lg shadow-black/20">
                        <h4 className="text-xs font-black uppercase tracking-wider text-[#F4F6F0] mb-4">Lista de Contactos</h4>
                        {subscribers.length === 0 ? (
                          <div className="p-8 text-center text-xs text-[#F4F6F0]/40 italic">
                            No hay suscriptores en la base de datos.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="border-b border-white/10 text-[9px] uppercase tracking-widest text-[#F4F6F0]/50 text-left">
                                  <th className="py-3 font-black">Email</th>
                                  <th className="py-3 font-black">ID Suscriptor</th>
                                  <th className="py-3 font-black">ID API</th>
                                  <th className="py-3 font-black">Tags</th>
                                  <th className="py-3 font-black text-center">Estado</th>
                                  <th className="py-3 font-black text-center">Premium</th>
                                  <th className="py-3 font-black text-right">Fecha Registro</th>
                                </tr>
                              </thead>
                              <tbody>
                                {subscribers.map((s: any, idx: number) => (
                                  <tr key={idx} className="border-b border-white/10 last:border-0 hover:bg-white/5 transition-all text-xs">
                                    <td className="py-3 font-black text-[#F4F6F0]">{s.email}</td>
                                    <td className="py-3 font-mono text-[#F4F6F0]/55">{s.subscriber_id || '-'}</td>
                                    <td className="py-3 font-mono text-[#F4F6F0]/55">{s.api_subscription_id || '-'}</td>
                                    <td className="py-3">
                                      {s.tags ? (
                                        <div className="flex flex-wrap gap-1">
                                          {s.tags.split(',').map((t: string, i: number) => (
                                            <span key={i} className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-[8px] font-bold text-[#F4F6F0]/60">
                                              {t.trim()}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-[#F4F6F0]/40">-</span>
                                      )}
                                    </td>
                                    <td className="py-3 text-center">
                                      <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${s.is_active ? 'bg-green-500/10 border border-green-500/25 text-green-400' : 'bg-red-500/10 border border-red-500/25 text-red-400'
                                        }`}>
                                        {s.is_active ? 'Activo' : 'Inactivo'}
                                      </span>
                                    </td>
                                    <td className="py-3 text-center">
                                      <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${s.is_premium ? 'bg-amber-honey/20 border border-amber-honey/30 text-amber-honey' : 'bg-white/5 border border-white/10 text-[#F4F6F0]/40'
                                        }`}>
                                        {s.is_premium ? 'Premium' : 'Estándar'}
                                      </span>
                                    </td>
                                    <td className="py-3 font-mono text-right text-[#F4F6F0]/55">
                                      {new Date(s.created_at).toLocaleDateString('es-MX')}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {campaignSubTab === 'lists' && (
                    <div className="space-y-6">
                      <div className="amber-glass border border-white/10 rounded-[2rem] p-6 overflow-hidden shadow-lg shadow-black/20">
                        <div className="flex justify-between items-center mb-6">
                          <div>
                            <h4 className="text-sm font-black uppercase tracking-wider text-[#F4F6F0]">Listas de Contactos y Segmentación</h4>
                            <p className="text-[9px] text-[#F4F6F0]/50 uppercase tracking-widest font-bold mt-1">
                              Administra los segmentos de contactos a los que puedes dirigir tus campañas de marketing
                            </p>
                          </div>
                        </div>

                        {marketingLists.length === 0 ? (
                          <div className="p-12 text-center text-xs text-[#F4F6F0]/40 italic">
                            No hay listas de marketing registradas en el sistema.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {marketingLists.map((list: any) => (
                              <div key={list.id} className="p-6 rounded-[2rem] border border-white/10 bg-white/5 space-y-4 hover:border-amber-honey/40 transition-all flex flex-col justify-between shadow-lg shadow-black/20">
                                <div className="space-y-2">
                                  <div className="flex justify-between items-start">
                                    <span className="text-[8.5px] font-black uppercase tracking-widest text-amber-honey bg-amber-honey/10 border border-amber-honey/20 px-2.5 py-1 rounded-lg">
                                      List ID: {list.id}
                                    </span>
                                    <span className="text-[8.5px] font-black uppercase tracking-widest text-[#F4F6F0]/50 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                                      👥 {list.subscriber_count} suscriptores
                                    </span>
                                  </div>
                                  <h4 className="text-base font-black text-[#F4F6F0] leading-snug">{list.name}</h4>
                                  <p className="text-xs text-[#F4F6F0]/70 min-h-[40px] italic">
                                    {list.description || 'Sin descripción.'}
                                  </p>
                                  {list.event_title && (
                                    <div className="pt-2 border-t border-white/5 space-y-1">
                                      <span className="text-[7.5px] font-black uppercase tracking-wider text-[#F4F6F0]/40 block">Evento Vinculado</span>
                                      <span className="text-[10px] font-bold text-amber-honey/90 flex items-center gap-1.5">
                                        🎟️ {list.event_title}
                                      </span>
                                    </div>
                                  )}
                                  <div className="text-[8.5px] text-[#F4F6F0]/40 font-bold uppercase tracking-wider">
                                    Creado: {new Date(list.created_at).toLocaleDateString('es-MX')}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* TAB 8: EVENTS MANAGEMENT */}
              {activeTab === 'events' && (
                <motion.div
                  key="events-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Site Settings Panel */}
                  <div className="bg-white/5 border border-amber-honey/20 rounded-[2rem] p-6 space-y-4">
                    <div>
                      <h3 className="text-sm font-black uppercase italic tracking-tight text-amber-honey flex items-center gap-2">⚙️ Textos Dinámicos del Sitio</h3>
                      <p className="text-[9px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold mt-1">Actualiza los textos que aparecen en la página de accesos y la landing page.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F4F6F0]/60 block">Subtítulo de Página de Accesos</label>
                        <textarea
                          value={siteSettingsSubtitle}
                          onChange={e => setSiteSettingsSubtitle(e.target.value)}
                          rows={3}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold outline-none focus:border-amber-honey transition-all resize-none"
                          placeholder="Selecciona tu concierto, explora el mapa..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F4F6F0]/60 block">Badge de Próximo Evento (Landing)</label>
                        <input
                          type="text"
                          value={siteSettingsCta}
                          onChange={e => setSiteSettingsCta(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold outline-none focus:border-amber-honey transition-all"
                          placeholder="¡Próximamente nuevo evento!"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={async () => {
                          setSiteSettingsLoading(true);
                          try {
                            const token = localStorage.getItem('token');
                            // POST to create or update the singleton
                            await fetch(`${API_URL}/tickets/settings/`, {
                              method: 'POST',
                              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ tickets_page_subtitle: siteSettingsSubtitle, homepage_cta_text: siteSettingsCta })
                            });
                            setSiteSettingsSuccess('¡Configuración guardada exitosamente!');
                            setTimeout(() => setSiteSettingsSuccess(null), 3000);
                          } catch (err) {
                            console.error('Error saving site settings:', err);
                          } finally {
                            setSiteSettingsLoading(false);
                          }
                        }}
                        disabled={siteSettingsLoading}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-honey text-black font-black uppercase tracking-widest text-[9px] hover:bg-amber-gold transition-all disabled:opacity-50 shadow-[0_4px_20px_rgba(245,158,11,0.15)]"
                      >
                        {siteSettingsLoading ? 'Guardando...' : '💾 Guardar Configuración'}
                      </button>
                      {siteSettingsSuccess && (
                        <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">{siteSettingsSuccess}</p>
                      )}
                    </div>
                  </div>

                  {/* Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-2xl font-black uppercase italic tracking-tight flex items-center gap-2">
                        📅 Gestión de Eventos
                      </h2>
                      <p className="text-[#F4F6F0]/50 text-[10px] uppercase tracking-widest font-bold mt-1">
                        Crea y administra conciertos (con mapa de asientos) o convivencias Meet & Greet sin música
                      </p>
                    </div>
                    <button
                      onClick={openEventCreateModal}
                      className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black uppercase tracking-widest text-xs px-5 py-3 rounded-xl transition-all shadow-[0_4px_20px_rgba(245,158,11,0.15)]"
                    >
                      <Plus size={15} /> Nuevo Evento
                    </button>
                  </div>

                  {/* Events Grid */}
                  {events.length === 0 ? (
                    <div className="bg-white/5 border border-white/10 rounded-[2rem] p-16 flex flex-col items-center gap-4 text-center shadow-lg shadow-black/20">
                      <Calendar size={48} className="text-[#F4F6F0]/20" />
                      <p className="text-[#F4F6F0]/40 text-xs uppercase tracking-widest font-black">Sin eventos registrados</p>
                      <p className="text-[#F4F6F0]/30 text-[10px] font-bold">Crea tu primer evento musical o de convivencia para comenzar a vender accesos</p>
                      <button onClick={openEventCreateModal} className="mt-4 px-6 py-3 bg-amber-honey text-black font-black uppercase tracking-widest rounded-xl hover:bg-amber-gold transition-all">
                        Crear primer Evento
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {events.map((event: any, idx: number) => (
                        <motion.div
                          key={event.id ? `event-${event.id}` : `event-idx-${idx}`}
                          whileHover={{ y: -4 }}
                          className="bg-white/5 border border-white/10 hover:border-amber-honey/40 rounded-[2rem] p-6 flex flex-col gap-4 transition-all shadow-lg shadow-black/20"
                        >
                          {/* Event Cover Image */}
                          <div className="w-full h-40 rounded-2xl bg-black/40 border border-white/5 overflow-hidden relative">
                            {event.image ? (
                              <img src={resolveMediaUrl(event.image)} alt={event.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-2">
                                <Calendar size={32} />
                                <span className="text-[9px] uppercase tracking-widest font-bold">Sin Imagen de Portada</span>
                              </div>
                            )}
                            <div className="absolute top-3 right-3 flex gap-1">
                              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                                event.event_type === 'concert'
                                  ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                                  : 'bg-amber-950/80 text-amber-300 border-amber-800'
                              }`}>
                                {event.event_type === 'concert' ? 'Concierto' : 'Meet & Greet'}
                              </span>
                              <button
                                onClick={() => handleToggleEventActive(event)}
                                className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all ${
                                  event.is_active
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800 hover:bg-emerald-900'
                                    : 'bg-red-950/80 text-red-300 border-red-800 hover:bg-red-900'
                                }`}
                              >
                                {event.is_active ? 'Activo' : 'Inactivo'}
                              </button>
                            </div>
                          </div>

                          {/* Event Details */}
                          <div className="space-y-2 flex-1">
                            <div>
                              <h3 className="text-sm font-black text-[#F4F6F0] leading-tight line-clamp-1">{event.title}</h3>
                              <p className="text-[9px] text-[#F4F6F0]/50 uppercase tracking-widest font-bold mt-0.5">{event.artist}</p>
                            </div>

                            <div className="border-t border-white/5 pt-2 mt-2 space-y-1.5 text-[9px] font-bold uppercase tracking-wider text-[#F4F6F0]/70">
                              <div className="flex items-center gap-1.5">
                                <Calendar size={11} className="text-amber-honey" />
                                <span>{new Date(event.date).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} hrs</span>
                              </div>
                              {event.event_type === 'concert' && (
                                <div className="flex items-center gap-1.5">
                                  <MapPin size={11} className="text-amber-honey" />
                                  <span className="line-clamp-1">Recinto: {event.theater_name || 'Sin teatro asignado'}</span>
                                </div>
                              )}
                            </div>

                            {/* Pricing & Limits info */}
                            <div className="bg-black/30 rounded-xl p-3 border border-white/5 text-[9px] font-bold uppercase tracking-widest text-[#F4F6F0]/60 space-y-1 mt-2">
                              {event.event_type === 'concert' ? (
                                <>
                                  <div className="flex justify-between">
                                    <span>Multiplicador de Precio:</span>
                                    <span className="text-[#F4F6F0] font-black">{event.price_multiplier}x</span>
                                  </div>
                                  {Number(event.mg_price) > 0 && (
                                    <div className="flex justify-between border-t border-white/5 pt-1 mt-1 text-amber-honey">
                                      <span>Upgrade M&G:</span>
                                      <span>${Number(event.mg_price).toLocaleString()} MXN ({event.mg_available} disp)</span>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  <div className="flex justify-between">
                                    <span>Precio de Convivencia:</span>
                                    <span className="text-[#F4F6F0] font-black">${Number(event.mg_price).toLocaleString()} MXN</span>
                                  </div>
                                  <div className="flex justify-between border-t border-white/5 pt-1 mt-1">
                                    <span>Boletos Disp / Límite:</span>
                                    <span className="text-amber-honey font-black">{event.mg_available} / {event.mg_limit}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Card Actions */}
                          <div className="flex gap-2 border-t border-white/5 pt-4">
                            <button
                              onClick={() => openEventEditModal(event)}
                              className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[#F4F6F0] hover:bg-white/10 transition-all flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest"
                            >
                              <Edit2 size={12} /> Editar
                            </button>
                            <button
                              onClick={() => handleEventDelete(event.id, event.title)}
                              className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Campaign Creation/Edition Modal */}
            {isCampaignModalOpen && (
              <div
                onClick={() => setIsCampaignModalOpen(false)}
                className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-start justify-center p-6 md:p-12 overflow-y-auto"
              >
                <motion.div
                  onClick={e => e.stopPropagation()}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="amber-glass w-full max-w-7xl rounded-[2.5rem] p-8 shadow-2xl relative flex flex-col lg:flex-row gap-8 max-h-[90vh] overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-honey/40 to-transparent" />
                  <button
                    type="button"
                    onClick={() => setIsCampaignModalOpen(false)}
                    className="absolute top-6 right-6 w-9 h-9 rounded-xl border border-white/10 text-[#F4F6F0]/40 hover:text-[#F4F6F0] flex items-center justify-center transition-all hover:bg-white/5 z-50"
                  >
                    <X size={16} />
                  </button>

                  {/* Column 1: Editor Form */}
                  <div className={`${isPreviewExpanded ? 'hidden' : 'flex-1'} overflow-y-auto pr-2 custom-scroll space-y-6 lg:max-h-[78vh]`}>
                    <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tight text-[#F4F6F0]">
                        {campId ? 'Editar Campaña de Poemas' : 'Nueva Campaña de Poemas'}
                      </h3>
                      <p className="text-[9px] text-[#F4F6F0]/55 uppercase tracking-widest font-bold mt-1">
                        Redacta y elige el diseño de fondo premium
                      </p>
                    </div>

                    {hasDraft && (
                      <div className="bg-amber-honey/10 border border-amber-honey/30 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <p className="text-xs font-bold text-amber-honey uppercase tracking-wider">Borrador Detectado</p>
                          <p className="text-[10px] text-[#F4F6F0]/70 mt-0.5">Se encontró progreso no guardado de tu última sesión de edición.</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={restoreDraft}
                            className="bg-amber-honey text-[#1E2B22] font-black uppercase tracking-widest text-[9px] px-3 py-2 rounded-lg hover:bg-amber-gold transition-all"
                          >
                            Restaurar
                          </button>
                          <button
                            type="button"
                            onClick={discardDraft}
                            className="border border-white/10 hover:bg-white/5 text-[#F4F6F0]/65 hover:text-[#F4F6F0] font-black uppercase tracking-widest text-[9px] px-3 py-2 rounded-lg transition-all"
                          >
                            Descartar
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Navigation Tab Bar for Editor Settings */}
                    <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 gap-1 overflow-x-auto custom-scroll mb-4">
                      {[
                        { id: 'content', label: 'Contenido', icon: <Mail size={12} /> },
                        { id: 'theme', label: 'Diseño', icon: <Palette size={12} /> },
                        { id: 'cover', label: 'Portada', icon: <ImageIcon size={12} /> },
                        { id: 'sections', label: 'Espaciado', icon: <Sliders size={12} /> },
                        { id: 'ctas', label: 'Botones', icon: <Target size={12} /> },
                        { id: 'library', label: 'Biblioteca', icon: <FolderOpen size={12} /> },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            syncEditorState();
                            setSettingsTab(tab.id as any);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 whitespace-nowrap ${
                            settingsTab === tab.id
                              ? 'bg-amber-honey text-[#030303] shadow-md scale-[1.02]'
                              : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
                          }`}
                        >
                          {tab.icon}
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <form onSubmit={handleCampaignSubmit} className="space-y-6">
                      {campErrorMsg && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-bold uppercase tracking-wide">
                          ⚠️ {campErrorMsg}
                        </div>
                      )}

                      {/* Mini Breakpoint Switcher for styling options */}
                      {['cover', 'sections', 'ctas'].includes(settingsTab) && (
                        <div className="flex justify-between items-center bg-white/5 border border-white/5 p-3 rounded-2xl">
                          <span className="text-[9px] text-[#F4F6F0]/65 uppercase tracking-widest font-black">Diseño responsivo activo:</span>
                          <div className="flex bg-neutral-950 border border-white/10 rounded-xl p-0.5 gap-0.5 animate-fade-in">
                            {[
                              { id: 'desktop', label: 'Escritorio', icon: <Monitor size={10} /> },
                              { id: 'tablet', label: 'Tablet', icon: <Tablet size={10} /> },
                              { id: 'mobile', label: 'Móvil', icon: <Smartphone size={10} /> },
                            ].map(vp => (
                              <button
                                key={vp.id}
                                type="button"
                                onClick={() => setPreviewViewport(vp.id as any)}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                                  previewViewport === vp.id
                                    ? 'bg-amber-honey text-[#030303] shadow-md scale-[1.02]'
                                    : 'text-[#F4F6F0]/65 hover:text-[#F4F6F0] hover:bg-white/5'
                                }`}
                              >
                                {vp.icon}
                                <span className="hidden sm:inline">{vp.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* CATEGORY 1: CONTENT */}
                      {settingsTab === 'content' && (
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2 relative">
                              <div className="flex justify-between items-center">
                                <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Asunto del Correo</label>
                                <button
                                  type="button"
                                  onClick={() => setEmojiPopoverTarget(emojiPopoverTarget === 'subject' ? null : 'subject')}
                                  className="text-[9px] text-[#F4F6F0]/50 hover:text-amber-honey transition-all flex items-center gap-1 font-black uppercase tracking-wider"
                                >
                                  <Smile size={10} /> Emojis
                                </button>
                              </div>
                              <input
                                id="camp-subject-input"
                                type="text"
                                value={campSubject}
                                onChange={e => setCampSubject(e.target.value)}
                                placeholder="Ej. Susurros del Desierto - Un poema de Ms Ambar"
                                required
                                className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:border-amber-honey transition-all placeholder:text-[#F4F6F0]/30"
                              />
                              {emojiPopoverTarget === 'subject' && (
                                <div className="absolute right-0 top-[60px] z-[100] bg-[#0c0f0d] border border-white/10 rounded-2xl p-3 shadow-2xl w-60 grid grid-cols-6 gap-2">
                                  {CURATED_EMOJIS.map(em => (
                                    <button
                                      key={em}
                                      type="button"
                                      onClick={() => {
                                        insertEmojiToSubject(em);
                                        setEmojiPopoverTarget(null);
                                      }}
                                      className="text-lg hover:bg-white/5 p-1 rounded transition-all text-center"
                                    >
                                      {em}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Nombre del Remitente (Header)</label>
                              <input
                                type="text"
                                value={campSenderName}
                                onChange={e => setCampSenderName(e.target.value)}
                                placeholder="Ej. Ms Ambar"
                                className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:border-amber-honey transition-all placeholder:text-[#F4F6F0]/30"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[9px] text-amber-honey uppercase tracking-widest font-black block">🎯 Lista de Destinatarios (Segmentación)</label>
                            <select
                              value={campMarketingList}
                              onChange={e => setCampMarketingList(e.target.value)}
                              className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:border-amber-honey transition-all [color-scheme:dark]"
                            >
                              <option value="">-- Enviar a todos los suscriptores activos --</option>
                              {marketingLists.map((list: any) => (
                                <option key={list.id} value={list.id}>
                                  {list.name} ({list.subscriber_count} suscriptores) {list.event_title ? `[Evento: ${list.event_title}]` : ''}
                                </option>
                              ))}
                            </select>
                            <p className="text-[8px] text-[#F4F6F0]/40 font-bold uppercase tracking-wider block">
                              Selecciona una lista para dirigir la campaña solo a esos contactos. Si no seleccionas ninguna, se enviará a todos los suscriptores activos.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Formato del Texto</label>
                            <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 gap-1 w-full sm:w-fit">
                              {[
                                { id: 'poem', label: 'Modo Poema (Saltos de Línea)' },
                                { id: 'letter', label: 'Modo Carta (Texto Fluyente)' },
                              ].map(mode => (
                                <button
                                  key={mode.id}
                                  type="button"
                                  onClick={() => setCampTextMode(mode.id as any)}
                                  className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                                    campTextMode === mode.id
                                      ? 'bg-amber-honey text-[#030303] shadow-md scale-[1.02]'
                                      : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
                                  }`}
                                >
                                  {mode.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Contenido del Correo</label>
                              <span className="text-[8px] bg-amber-honey/10 text-amber-honey border border-amber-honey/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                Editando: {editorActiveTab === 'title' ? 'Título' : editorActiveTab === 'footer' ? 'Pie' : 'Cuerpo'}
                              </span>
                            </div>

                            {/* Segmented Tab Controls */}
                            <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 gap-1">
                              {[
                                { id: 'title', label: 'Título / Cabecera' },
                                { id: 'body', label: 'Cuerpo del Correo' },
                                { id: 'footer', label: 'Pie de Página (Footer)' }
                              ].map(tab => (
                                <button
                                  key={tab.id}
                                  type="button"
                                  onClick={() => {
                                    if (campaignEditorRef.current) {
                                      const html = campaignEditorRef.current.innerHTML;
                                      if (editorActiveTab === 'body') setCampPoemText(html);
                                      else if (editorActiveTab === 'title') setCampEmailTitle(html);
                                      else if (editorActiveTab === 'footer') setCampFooterText(html);
                                    }
                                    setEditorActiveTab(tab.id as any);
                                  }}
                                  className={`flex-1 py-2 text-center rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                                    editorActiveTab === tab.id
                                      ? 'bg-amber-honey text-[#030303] shadow-md'
                                      : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
                                  }`}
                                >
                                  {tab.label}
                                </button>
                              ))}
                            </div>

                            {/* Editor Canvas Toolbar */}
                            <div className="bg-white/5 border border-white/10 p-2 rounded-2xl flex flex-wrap gap-1 items-center shadow-lg">
                              <button
                                type="button"
                                onClick={() => executeCommand('bold')}
                                className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                                title="Negrita"
                              >
                                <Bold size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => executeCommand('italic')}
                                className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                                title="Itálica"
                              >
                                <Italic size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => executeCommand('underline')}
                                className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                                title="Subrayado"
                              >
                                <Underline size={14} />
                              </button>

                              <div className="w-px h-6 bg-white/10 mx-1" />

                              <button
                                type="button"
                                onClick={() => executeCommand('justifyLeft')}
                                className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                                title="Alinear Izquierda"
                              >
                                <AlignLeft size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => executeCommand('justifyCenter')}
                                className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                                title="Alinear Centro"
                              >
                                <AlignCenter size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => executeCommand('justifyRight')}
                                className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                                title="Alinear Derecha"
                              >
                                <AlignRight size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => executeCommand('justifyFull')}
                                className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                                title="Justificar"
                              >
                                <AlignJustify size={14} />
                              </button>

                              <div className="w-px h-6 bg-white/10 mx-1" />

                              <button
                                type="button"
                                onClick={() => executeCommand('formatBlock', '<h2>')}
                                className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center font-bold text-xs"
                                title="Título Grande H2"
                              >
                                H2
                              </button>
                              <button
                                type="button"
                                onClick={() => executeCommand('formatBlock', '<h3>')}
                                className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center font-bold text-xs"
                                title="Título Mediano H3"
                              >
                                H3
                              </button>
                              <button
                                type="button"
                                onClick={() => executeCommand('formatBlock', '<p>')}
                                className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center text-xs"
                                title="Párrafo"
                              >
                                P
                              </button>

                              <div className="w-px h-6 bg-white/10 mx-1" />

                              <button
                                type="button"
                                onClick={() => executeCommand('insertUnorderedList')}
                                className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                                title="Lista Viñetas"
                              >
                                <List size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => executeCommand('insertOrderedList')}
                                className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                                title="Lista Enumerada"
                              >
                                <ListOrdered size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => executeCommand('formatBlock', '<blockquote>')}
                                className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                                title="Cita"
                              >
                                <Quote size={14} />
                              </button>

                              <div className="w-px h-6 bg-white/10 mx-1" />

                              <button
                                type="button"
                                onClick={handleLinkInsert}
                                className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                                title="Insertar Enlace"
                              >
                                <Link2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={handleImageInsert}
                                className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                                title="Insertar Imagen por URL"
                              >
                                <ImageIcon size={14} />
                              </button>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setEmojiPopoverTarget(emojiPopoverTarget === 'editor' ? null : 'editor')}
                                  className="w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                                  title="Insertar Emoji"
                                >
                                  <Smile size={14} />
                                </button>
                                {emojiPopoverTarget === 'editor' && (
                                  <div className="absolute left-0 top-10 z-[100] bg-[#0c0f0d] border border-white/10 rounded-2xl p-3 shadow-2xl w-60 grid grid-cols-6 gap-2">
                                    {CURATED_EMOJIS.map(em => (
                                      <button
                                        key={em}
                                        type="button"
                                        onClick={() => {
                                          insertEmojiToEditor(em);
                                          setEmojiPopoverTarget(null);
                                        }}
                                        className="text-lg hover:bg-white/5 p-1 rounded transition-all text-center"
                                      >
                                        {em}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => executeCommand('removeFormat')}
                                className="w-8 h-8 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center justify-center ml-auto"
                                title="Limpiar Formatos"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>

                            {/* Content Editable Area */}
                            <div
                              ref={campaignEditorRef}
                              contentEditable
                              suppressContentEditableWarning
                              onInput={e => {
                                const html = e.currentTarget.innerHTML;
                                if (editorActiveTab === 'body') setCampPoemText(html);
                                else if (editorActiveTab === 'title') setCampEmailTitle(html);
                                else if (editorActiveTab === 'footer') setCampFooterText(html);
                              }}
                              onPaste={handleEditorPaste}
                              data-placeholder={
                                editorActiveTab === 'title'
                                  ? 'Escribe un título personalizado para el correo (o déjalo en blanco para usar el asunto)...'
                                  : editorActiveTab === 'footer'
                                    ? 'Escribe un pie de página personalizado (o déjalo en blanco para usar el predeterminado)...'
                                    : 'Comienza a redactar el cuerpo del poema o correo aquí...'
                              }
                              className="w-full min-h-[220px] max-h-[400px] overflow-y-auto bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:border-amber-honey transition-all"
                              style={{ outline: 'none' }}
                            />
                          </div>
                        </div>
                      )}

                      {/* CATEGORY 2: THEME & BACKGROUND */}
                      {settingsTab === 'theme' && (
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Plantilla de Fondo / Diseño Premium</label>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                              {[
                                { id: 'minimalist', name: 'Carbon', desc: 'Negro & Ámbar', class: 'bg-[#0c0d13] border-amber-honey/40 text-amber-honey' },
                                { id: 'moss', name: 'Moss', desc: 'Verde Musgo', class: 'bg-[#122017] border-green-800 text-green-300' },
                                { id: 'cosmic', name: 'Cosmic', desc: 'Índigo Cósmico', class: 'bg-[#0c0a1a] border-purple-800 text-purple-300' },
                                { id: 'glow', name: 'Glow', desc: 'Cálido Miel', class: 'bg-[#1a130c] border-amber-700 text-amber-500' },
                                { id: 'mist', name: 'Mist', desc: 'Gris Pizarra', class: 'bg-[#181b22] border-cyan-800 text-cyan-400' },
                              ].map(t => (
                                <div
                                  key={t.id}
                                  onClick={() => setCampTemplateType(t.id)}
                                  className={`p-3 rounded-2xl border cursor-pointer text-center transition-all hover:scale-102 flex flex-col justify-center items-center gap-1 ${t.class} ${campTemplateType === t.id ? 'ring-2 ring-amber-honey border-transparent' : 'opacity-65 hover:opacity-100'
                                    }`}
                                >
                                  <span className="text-[10px] font-black uppercase tracking-wider">{t.name}</span>
                                  <span className="text-[7px] font-bold uppercase tracking-widest opacity-60">{t.desc}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Tipografía Global de Sección</label>
                            <p className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold">
                              Sección activa seleccionada: <span className="text-amber-honey underline italic">{editorActiveTab === 'title' ? 'Título' : editorActiveTab === 'footer' ? 'Pie' : 'Cuerpo'}</span>
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {[
                                { id: 'serif', name: 'Estándar', css: 'font-serif', desc: 'Georgia Elegante' },
                                { id: 'playfair', name: 'Playfair', css: 'font-serif', style: { fontFamily: "'Playfair Display', serif" }, desc: 'Clásico & Sofisticado' },
                                { id: 'cinzel', name: 'Cinzel', css: 'font-serif', style: { fontFamily: "'Cinzel', serif" }, desc: 'Romano Imperial' },
                                { id: 'garamond', name: 'Garamond', css: 'font-serif', style: { fontFamily: "'Cormorant Garamond', serif" }, desc: 'Musgo Artístico' },
                                { id: 'montserrat', name: 'Montserrat', css: 'font-sans', style: { fontFamily: "'Montserrat', sans-serif" }, desc: 'Minimalista Moderno' },
                                { id: 'pinyon', name: 'Pinyon Script', css: 'font-cursive', style: { fontFamily: "'Pinyon Script', cursive" }, desc: 'Caligrafía Íntima' },
                              ].map(f => {
                                const currentActiveFont =
                                  editorActiveTab === 'title' ? campTitleFontFamily :
                                    editorActiveTab === 'footer' ? campFooterFontFamily :
                                      campFontFamily;

                                const handleFontSelect = () => {
                                  if (editorActiveTab === 'title') setCampTitleFontFamily(f.id);
                                  else if (editorActiveTab === 'footer') setCampFooterFontFamily(f.id);
                                  else setCampFontFamily(f.id);
                                };

                                return (
                                  <div
                                    key={f.id}
                                    onClick={handleFontSelect}
                                    className={`p-3 rounded-2xl border cursor-pointer text-center transition-all hover:scale-102 flex flex-col justify-center items-center gap-1 ${currentActiveFont === f.id
                                      ? 'bg-amber-honey/10 border-amber-honey text-amber-honey ring-1 ring-amber-honey'
                                      : 'bg-white/5 border border-white/10 text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/10'
                                      }`}
                                  >
                                    <span className="text-xs font-black" style={f.style}>{f.name}</span>
                                    <span className="text-[7px] font-bold uppercase tracking-widest opacity-60">{f.desc}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-4 border-t border-white/5 pt-4">
                            <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Imagen de Fondo del Correo</label>
                            <div className="flex gap-4 items-center bg-white/5 border border-white/10 p-4 rounded-xl">
                              <div className="w-16 h-16 bg-white/5 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-white/10">
                                {campBgImagePreview ? (
                                  <img src={resolveMediaUrl(campBgImagePreview)} alt="Background Preview" className="w-full h-full object-cover" />
                                ) : (
                                  <Eye size={20} className="text-[#F4F6F0]/20" />
                                )}
                              </div>
                              <div className="space-y-1 flex-1">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setCampBgImageFile(file);
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        setCampBgImagePreview(reader.result as string);
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                  className="text-[10px] text-[#F4F6F0]/70 file:bg-white/10 file:border-0 file:rounded-lg file:text-[#F4F6F0] file:px-3 file:py-1.5 file:text-[9px] file:uppercase file:font-black file:tracking-widest file:mr-3 cursor-pointer hover:file:bg-white/20"
                                />
                                <p className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold">Imagen integrada para el fondo de todo el correo.</p>
                                {campBgImagePreview && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCampBgImageFile(null);
                                      setCampBgImagePreview(null);
                                    }}
                                    className="text-[9px] uppercase font-black tracking-widest text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 px-2.5 py-1.5 rounded-lg transition-all block mt-2"
                                  >
                                    Quitar Fondo
                                  </button>
                                )}
                              </div>
                            </div>

                            {templateImages.length > 0 && (
                              <div className="space-y-1.5">
                                <label className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold block">O de la Biblioteca:</label>
                                <div className="flex gap-2 overflow-x-auto pb-1 custom-scroll">
                                  {templateImages.map((img: any) => (
                                    <div
                                      key={img.id}
                                      onClick={() => handleUseTemplateAsBg(img.image)}
                                      className={`w-10 h-10 rounded-lg overflow-hidden border cursor-pointer hover:border-[#82c99b] shrink-0 transition-all ${campBgImagePreview === img.image ? 'border-[#82c99b] ring-1 ring-[#82c99b]' : 'border-white/10'}`}
                                    >
                                      <img src={img.image} className="w-full h-full object-cover" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black">
                                  <span>Opacidad</span>
                                  <span className="text-amber-honey font-mono">{Math.round(campBgOpacity * 100)}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={campBgOpacity}
                                  onChange={e => setCampBgOpacity(parseFloat(e.target.value))}
                                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-honey"
                                />
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black">
                                  <span>Saturación</span>
                                  <span className="text-amber-honey font-mono">{campBgSaturation}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="200"
                                  step="10"
                                  value={campBgSaturation}
                                  onChange={e => setCampBgSaturation(parseInt(e.target.value))}
                                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-honey"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Posición del Fondo</label>
                                <select
                                  value={campBgPosition}
                                  onChange={e => setCampBgPosition(e.target.value)}
                                  className="w-full bg-[#121915] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey text-[#F4F6F0]"
                                >
                                  <option value="center">Centro</option>
                                  <option value="top">Superior</option>
                                  <option value="bottom">Inferior</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* CATEGORY 3: COVER IMAGE */}
                      {settingsTab === 'cover' && (
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Archivo de Portada (Opcional)</label>
                            <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-xl">
                              {campImagePreview && (
                                <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0">
                                  <img src={campImagePreview} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setCampImageFile(file);
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setCampImagePreview(reader.result as string);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="text-xs text-[#F4F6F0]/70 file:mr-4 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-widest file:bg-white/10 file:text-[#F4F6F0] file:cursor-pointer hover:file:bg-white/20"
                              />
                              {campImagePreview && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCampImageFile(null);
                                    setCampImagePreview(null);
                                  }}
                                  className="text-[9px] uppercase font-black tracking-widest text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 px-2.5 py-1.5 rounded-lg transition-all"
                                >
                                  Quitar Portada
                                </button>
                              )}
                            </div>

                            {templateImages.length > 0 && (
                              <div className="space-y-1.5 pt-2">
                                <label className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest font-bold block">O de la Biblioteca:</label>
                                <div className="flex gap-2 overflow-x-auto pb-1 custom-scroll">
                                  {templateImages.map((img: any) => (
                                    <div
                                      key={img.id}
                                      onClick={() => handleUseTemplateAsCover(img.image)}
                                      className={`w-12 h-12 rounded-lg overflow-hidden border cursor-pointer hover:border-amber-honey shrink-0 transition-all ${campImagePreview === img.image ? 'border-amber-honey ring-1 ring-amber-honey' : 'border-white/10'}`}
                                    >
                                      <img src={img.image} className="w-full h-full object-cover" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="space-y-4 pt-2 border-t border-white/5">
                            <span className="text-[9px] text-amber-honey uppercase tracking-widest font-black block">
                              Ajustes de Imagen ({previewViewport === 'desktop' ? 'Escritorio' : previewViewport === 'tablet' ? 'Tablet' : 'Móvil'})
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
                              <div className="space-y-1">
                                <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Ancho de Imagen</label>
                                <select
                                  value={
                                    previewViewport === 'desktop' ? campImageWidth :
                                    previewViewport === 'tablet' ? campImageWidthTablet :
                                    campImageWidthMobile
                                  }
                                  onChange={e => {
                                    if (previewViewport === 'desktop') setCampImageWidth(e.target.value);
                                    else if (previewViewport === 'tablet') setCampImageWidthTablet(e.target.value);
                                    else setCampImageWidthMobile(e.target.value);
                                  }}
                                  className="w-full bg-[#121915] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey text-[#F4F6F0]"
                                >
                                  <option value="30%">Pequeña (30%)</option>
                                  <option value="50%">Mediana (50%)</option>
                                  <option value="80%">Grande (80%)</option>
                                  <option value="100%">Completo (100%)</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Alineación</label>
                                <select
                                  value={
                                    previewViewport === 'desktop' ? campImageAlign :
                                    previewViewport === 'tablet' ? campImageAlignTablet :
                                    campImageAlignMobile
                                  }
                                  onChange={e => {
                                    if (previewViewport === 'desktop') setCampImageAlign(e.target.value);
                                    else if (previewViewport === 'tablet') setCampImageAlignTablet(e.target.value);
                                    else setCampImageAlignMobile(e.target.value);
                                  }}
                                  className="w-full bg-[#121915] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey text-[#F4F6F0]"
                                >
                                  <option value="left">Izquierda</option>
                                  <option value="center">Centro</option>
                                  <option value="right">Derecha</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Redondeado (Global)</label>
                                <select
                                  value={campImageRadius}
                                  onChange={e => setCampImageRadius(e.target.value)}
                                  className="w-full bg-[#121915] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey text-[#F4F6F0]"
                                >
                                  <option value="0px">Sin (0px)</option>
                                  <option value="8px">Sutil (8px)</option>
                                  <option value="16px">Elegante (16px)</option>
                                  <option value="20px">Redondeado (20px)</option>
                                  <option value="30px">Muy Redondo (30px)</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* CATEGORY 4: SPACING & BOX STYLES */}
                      {settingsTab === 'sections' && (
                        <div className="space-y-6">
                          <div className="bg-[#121915]/50 border border-amber-honey/10 p-4 rounded-xl space-y-2">
                            <p className="text-[10px] text-amber-honey font-bold uppercase tracking-wider">
                              Sección activa: <span className="underline italic text-[#F4F6F0]">{editorActiveTab === 'title' ? 'Título' : editorActiveTab === 'footer' ? 'Pie' : 'Cuerpo'}</span>
                            </p>
                            <p className="text-[8px] text-[#F4F6F0]/40 uppercase tracking-widest leading-normal">
                              Usa las pestañas superiores de la categoría "Contenido" para cambiar qué sección estás personalizando.
                            </p>
                          </div>

                          {/* CONFIGURACIÓN GENERAL DE LA TARJETA */}
                          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-4">
                            <span className="text-[9px] text-amber-honey uppercase tracking-widest font-black block border-b border-white/5 pb-1">Configuración General de la Tarjeta</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                              <div className="space-y-1">
                                <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Ancho Máximo (Escritorio)</label>
                                <select
                                  value={campCardMaxWidthDesktop}
                                  onChange={e => setCampCardMaxWidthDesktop(e.target.value)}
                                  className="w-full bg-[#121915] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey text-[#F4F6F0]"
                                >
                                  <option value="600px">Estrecho (600px)</option>
                                  <option value="680px">Estándar (680px)</option>
                                  <option value="760px">Ancho (760px)</option>
                                  <option value="840px">Extra Ancho (840px)</option>
                                  <option value="1000px">Giga Ancho (1000px)</option>
                                  <option value="1200px">Ultra Ancho (1200px)</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">
                                  Relleno de Tarjeta ({previewViewport === 'desktop' ? 'Escritorio' : previewViewport === 'tablet' ? 'Tablet' : 'Móvil'})
                                </label>
                                <select
                                  value={
                                    previewViewport === 'desktop' ? campCardPaddingDesktop :
                                    previewViewport === 'tablet' ? campCardPaddingTablet :
                                    campCardPaddingMobile
                                  }
                                  onChange={e => {
                                    if (previewViewport === 'desktop') setCampCardPaddingDesktop(e.target.value);
                                    else if (previewViewport === 'tablet') setCampCardPaddingTablet(e.target.value);
                                    else setCampCardPaddingMobile(e.target.value);
                                  }}
                                  className="w-full bg-[#121915] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey text-[#F4F6F0]"
                                >
                                  {(previewViewport === 'desktop'
                                    ? [
                                        { value: '20px', label: 'Sutil (20px)' },
                                        { value: '32px', label: 'Mediano (32px)' },
                                        { value: '40px', label: 'Elegante (40px)' },
                                        { value: '48px', label: 'Extra Elegante (48px)' },
                                      ]
                                    : previewViewport === 'tablet'
                                      ? [
                                          { value: '20px', label: 'Sutil (20px)' },
                                          { value: '24px', label: 'Mediano (24px)' },
                                          { value: '32px', label: 'Elegante (32px)' },
                                          { value: '40px', label: 'Extra Elegante (40px)' },
                                        ]
                                      : [
                                          { value: '12px', label: 'Sutil (12px)' },
                                          { value: '16px', label: 'Mediano (16px)' },
                                          { value: '20px', label: 'Elegante (20px)' },
                                          { value: '24px', label: 'Extra Elegante (24px)' },
                                        ]
                                  ).map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>

                          {editorActiveTab === 'title' && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Color del Texto del Título</label>
                                  <div className="flex gap-2 items-center">
                                    <input
                                      type="color"
                                      value={campTitleTextColor.startsWith('#') ? campTitleTextColor : '#ffffff'}
                                      onChange={e => setCampTitleTextColor(e.target.value)}
                                      className="w-8 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer p-0 overflow-hidden"
                                    />
                                    <input
                                      type="text"
                                      value={campTitleTextColor}
                                      onChange={e => setCampTitleTextColor(e.target.value)}
                                      placeholder="#ffffff"
                                      className="flex-1 bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-amber-honey transition-all"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Color de Fondo del Título</label>
                                  <div className="flex gap-2 items-center">
                                    <input
                                      type="color"
                                      value={campTitleBgColor.startsWith('#') ? campTitleBgColor : '#000000'}
                                      onChange={e => setCampTitleBgColor(e.target.value)}
                                      className="w-8 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer p-0 overflow-hidden"
                                    />
                                    <select
                                      value={campTitleBgColor}
                                      onChange={e => setCampTitleBgColor(e.target.value)}
                                      className="flex-1 bg-[#121915] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey text-[#F4F6F0]"
                                    >
                                      <option value="transparent">Transparente</option>
                                      <option value="#080C0A">Negro Carbon (#080C0A)</option>
                                      <option value="#0c0f0d">Verde Oscuro (#0c0f0d)</option>
                                      <option value="rgba(229, 169, 59, 0.1)">Ámbar Translúcido</option>
                                      {campTitleBgColor.startsWith('#') && !['#080C0A', '#0c0f0d'].includes(campTitleBgColor) && (
                                        <option value={campTitleBgColor}>Personalizado: {campTitleBgColor}</option>
                                      )}
                                    </select>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">
                                    Relleno (Padding) ({previewViewport === 'desktop' ? 'Escritorio' : previewViewport === 'tablet' ? 'Tablet' : 'Móvil'})
                                  </label>
                                  <select
                                    value={
                                      previewViewport === 'desktop' ? campTitlePadding :
                                      previewViewport === 'tablet' ? campTitlePaddingTablet :
                                      campTitlePaddingMobile
                                    }
                                    onChange={e => {
                                      if (previewViewport === 'desktop') setCampTitlePadding(e.target.value);
                                      else if (previewViewport === 'tablet') setCampTitlePaddingTablet(e.target.value);
                                      else setCampTitlePaddingMobile(e.target.value);
                                    }}
                                    className="w-full bg-[#121915] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey text-[#F4F6F0]"
                                  >
                                    <option value="0px">Ninguno (0px)</option>
                                    <option value="10px">Sutil (10px)</option>
                                    <option value="20px">Mediano (20px)</option>
                                    <option value="35px">Elegante (35px)</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">
                                    Bordes Redondeados ({previewViewport === 'desktop' ? 'Escritorio' : previewViewport === 'tablet' ? 'Tablet' : 'Móvil'})
                                  </label>
                                  <select
                                    value={
                                      previewViewport === 'desktop' ? campTitleRadius :
                                      previewViewport === 'tablet' ? campTitleRadiusTablet :
                                      campTitleRadiusMobile
                                    }
                                    onChange={e => {
                                      if (previewViewport === 'desktop') setCampTitleRadius(e.target.value);
                                      else if (previewViewport === 'tablet') setCampTitleRadiusTablet(e.target.value);
                                      else setCampTitleRadiusMobile(e.target.value);
                                    }}
                                    className="w-full bg-[#121915] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey text-[#F4F6F0]"
                                  >
                                    <option value="0px">Recto (0px)</option>
                                    <option value="8px">Sutil (8px)</option>
                                    <option value="16px">Elegante (16px)</option>
                                    <option value="24px">Muy Redondo (24px)</option>
                                  </select>
                                </div>
                              </div>

                              <div className="space-y-3 pt-2 border-t border-white/5">
                                <div className="space-y-1 animate-fade-in">
                                  <label className="text-[9px] text-amber-honey uppercase tracking-widest font-black block">
                                    Tamaño de Letra del Título ({previewViewport === 'desktop' ? 'Escritorio' : previewViewport === 'tablet' ? 'Tablet' : 'Móvil'})
                                  </label>
                                  <select
                                    value={
                                      previewViewport === 'desktop' ? campTitleFontSizeDesktop :
                                      previewViewport === 'tablet' ? campTitleFontSizeTablet :
                                      campTitleFontSizeMobile
                                    }
                                    onChange={e => {
                                      if (previewViewport === 'desktop') setCampTitleFontSizeDesktop(e.target.value);
                                      else if (previewViewport === 'tablet') setCampTitleFontSizeTablet(e.target.value);
                                      else setCampTitleFontSizeMobile(e.target.value);
                                    }}
                                    className="w-full bg-[#121915] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey text-[#F4F6F0]"
                                  >
                                    {(previewViewport === 'desktop'
                                      ? ['20px', '24px', '26px', '30px', '36px', '42px']
                                      : previewViewport === 'tablet'
                                        ? ['18px', '20px', '22px', '26px', '30px']
                                        : ['16px', '18px', '20px', '24px']
                                    ).map(sz => (
                                      <option key={sz} value={sz}>{sz}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Imagen de Fondo del Título</label>
                                  {campTitleBgImage && (
                                    <button type="button" onClick={() => setCampTitleBgImage('')} className="text-[8px] uppercase tracking-widest font-black text-red-400">Quitar Imagen</button>
                                  )}
                                </div>
                                {templateImages.length > 0 && (
                                  <div className="flex gap-2 overflow-x-auto pb-1 custom-scroll">
                                    {templateImages.map((img: any) => (
                                      <div
                                        key={img.id}
                                        onClick={() => setCampTitleBgImage(img.image)}
                                        className={`w-12 h-12 rounded-lg overflow-hidden border cursor-pointer hover:border-amber-honey shrink-0 transition-all ${campTitleBgImage === img.image ? 'border-amber-honey ring-1 ring-amber-honey' : 'border-white/10'}`}
                                      >
                                        <img src={img.image} className="w-full h-full object-cover" />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {editorActiveTab === 'body' && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Color del Texto del Poema</label>
                                  <div className="flex gap-2 items-center">
                                    <input
                                      type="color"
                                      value={campBodyTextColor.startsWith('#') ? campBodyTextColor : '#f4f6f0'}
                                      onChange={e => setCampBodyTextColor(e.target.value)}
                                      className="w-8 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer p-0 overflow-hidden"
                                    />
                                    <input
                                      type="text"
                                      value={campBodyTextColor}
                                      onChange={e => setCampBodyTextColor(e.target.value)}
                                      placeholder="Defecto de Plantilla"
                                      className="flex-1 bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-amber-honey transition-all"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Color de Fondo del Poema</label>
                                  <div className="flex gap-2 items-center">
                                    <input
                                      type="color"
                                      value={campBodyBgColor.startsWith('#') ? campBodyBgColor : '#000000'}
                                      onChange={e => setCampBodyBgColor(e.target.value)}
                                      className="w-8 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer p-0 overflow-hidden"
                                    />
                                    <select
                                      value={campBodyBgColor}
                                      onChange={e => setCampBodyBgColor(e.target.value)}
                                      className="flex-1 bg-[#121915] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey text-[#F4F6F0]"
                                    >
                                      <option value="transparent">Transparente</option>
                                      <option value="#080C0A">Negro Carbon (#080C0A)</option>
                                      <option value="#0c0f0d">Verde Oscuro (#0c0f0d)</option>
                                      <option value="rgba(229, 169, 59, 0.06)">Ámbar Translúcido</option>
                                      {campBodyBgColor.startsWith('#') && !['#080C0A', '#0c0f0d'].includes(campBodyBgColor) && (
                                        <option value={campBodyBgColor}>Personalizado: {campBodyBgColor}</option>
                                      )}
                                    </select>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">
                                    Relleno (Padding) ({previewViewport === 'desktop' ? 'Escritorio' : previewViewport === 'tablet' ? 'Tablet' : 'Móvil'})
                                  </label>
                                  <select
                                    value={
                                      previewViewport === 'desktop' ? campBodyPadding :
                                      previewViewport === 'tablet' ? campBodyPaddingTablet :
                                      campBodyPaddingMobile
                                    }
                                    onChange={e => {
                                      if (previewViewport === 'desktop') setCampBodyPadding(e.target.value);
                                      else if (previewViewport === 'tablet') setCampBodyPaddingTablet(e.target.value);
                                      else setCampBodyPaddingMobile(e.target.value);
                                    }}
                                    className="w-full bg-[#121915] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey text-[#F4F6F0]"
                                  >
                                    <option value="0px">Ninguno (0px)</option>
                                    <option value="12px">Sutil (12px)</option>
                                    <option value="24px">Mediano (24px)</option>
                                    <option value="40px">Elegante (40px)</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">
                                    Bordes Redondeados ({previewViewport === 'desktop' ? 'Escritorio' : previewViewport === 'tablet' ? 'Tablet' : 'Móvil'})
                                  </label>
                                  <select
                                    value={
                                      previewViewport === 'desktop' ? campBodyRadius :
                                      previewViewport === 'tablet' ? campBodyRadiusTablet :
                                      campBodyRadiusMobile
                                    }
                                    onChange={e => {
                                      if (previewViewport === 'desktop') setCampBodyRadius(e.target.value);
                                      else if (previewViewport === 'tablet') setCampBodyRadiusTablet(e.target.value);
                                      else setCampBodyRadiusMobile(e.target.value);
                                    }}
                                    className="w-full bg-[#121915] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey text-[#F4F6F0]"
                                  >
                                    <option value="0px">Recto (0px)</option>
                                    <option value="12px">Sutil (12px)</option>
                                    <option value="20px">Elegante (20px)</option>
                                    <option value="32px">Muy Redondo (32px)</option>
                                  </select>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                                <div className="space-y-1">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">
                                    Alineación del Poema ({previewViewport === 'desktop' ? 'Escritorio' : previewViewport === 'tablet' ? 'Tablet' : 'Móvil'})
                                  </label>
                                  <select
                                    value={
                                      previewViewport === 'desktop' ? campBodyAlignment :
                                      previewViewport === 'tablet' ? campBodyAlignmentTablet :
                                      campBodyAlignmentMobile
                                    }
                                    onChange={e => {
                                      if (previewViewport === 'desktop') setCampBodyAlignment(e.target.value);
                                      else if (previewViewport === 'tablet') setCampBodyAlignmentTablet(e.target.value);
                                      else setCampBodyAlignmentMobile(e.target.value);
                                    }}
                                    className="w-full bg-[#121915] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey text-[#F4F6F0]"
                                  >
                                    <option value="center">Centrado (Por Defecto)</option>
                                    <option value="left">Izquierda</option>
                                    <option value="justify">Justificado</option>
                                    <option value="right">Derecha</option>
                                  </select>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">
                                    Tamaño de Letra del Poema ({previewViewport === 'desktop' ? 'Escritorio' : previewViewport === 'tablet' ? 'Tablet' : 'Móvil'})
                                  </label>
                                  <select
                                    value={
                                      previewViewport === 'desktop' ? campBodyFontSizeDesktop :
                                      previewViewport === 'tablet' ? campBodyFontSizeTablet :
                                      campBodyFontSizeMobile
                                    }
                                    onChange={e => {
                                      if (previewViewport === 'desktop') setCampBodyFontSizeDesktop(e.target.value);
                                      else if (previewViewport === 'tablet') setCampBodyFontSizeTablet(e.target.value);
                                      else setCampBodyFontSizeMobile(e.target.value);
                                    }}
                                    className="w-full bg-[#121915] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey text-[#F4F6F0]"
                                  >
                                    {(previewViewport === 'desktop'
                                      ? ['14px', '16px', '18px', '20px']
                                      : previewViewport === 'tablet'
                                        ? ['13px', '14px', '15px', '16px', '18px']
                                        : ['12px', '13px', '14px', '15px', '16px']
                                    ).map(sz => (
                                      <option key={sz} value={sz}>{sz}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Imagen de Fondo del Poema</label>
                                  {campBodyBgImage && (
                                    <button type="button" onClick={() => setCampBodyBgImage('')} className="text-[8px] uppercase tracking-widest font-black text-red-400">Quitar Imagen</button>
                                  )}
                                </div>
                                {templateImages.length > 0 && (
                                  <div className="flex gap-2 overflow-x-auto pb-1 custom-scroll">
                                    {templateImages.map((img: any) => (
                                      <div
                                        key={img.id}
                                        onClick={() => setCampBodyBgImage(img.image)}
                                        className={`w-12 h-12 rounded-lg overflow-hidden border cursor-pointer hover:border-amber-honey shrink-0 transition-all ${campBodyBgImage === img.image ? 'border-amber-honey ring-1 ring-amber-honey' : 'border-white/10'}`}
                                      >
                                        <img src={img.image} className="w-full h-full object-cover" />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {editorActiveTab === 'footer' && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Color del Texto de Pie</label>
                                  <div className="flex gap-2 items-center">
                                    <input
                                      type="color"
                                      value={campFooterTextColor.startsWith('#') ? campFooterTextColor : '#888888'}
                                      onChange={e => setCampFooterTextColor(e.target.value)}
                                      className="w-8 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer p-0 overflow-hidden"
                                    />
                                    <input
                                      type="text"
                                      value={campFooterTextColor}
                                      onChange={e => setCampFooterTextColor(e.target.value)}
                                      placeholder="Defecto de Plantilla"
                                      className="flex-1 bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-amber-honey transition-all"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Color de Fondo de Pie</label>
                                  <div className="flex gap-2 items-center">
                                    <input
                                      type="color"
                                      value={campFooterBgColor.startsWith('#') ? campFooterBgColor : '#000000'}
                                      onChange={e => setCampFooterBgColor(e.target.value)}
                                      className="w-8 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer p-0 overflow-hidden"
                                    />
                                    <select
                                      value={campFooterBgColor}
                                      onChange={e => setCampFooterBgColor(e.target.value)}
                                      className="flex-1 bg-[#121915] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey text-[#F4F6F0]"
                                    >
                                      <option value="transparent">Transparente</option>
                                      <option value="#080C0A">Negro Carbon (#080C0A)</option>
                                      <option value="#0c0f0d">Verde Oscuro (#0c0f0d)</option>
                                      <option value="rgba(229, 169, 59, 0.05)">Ámbar Translúcido</option>
                                      {campFooterBgColor.startsWith('#') && !['#080C0A', '#0c0f0d'].includes(campFooterBgColor) && (
                                        <option value={campFooterBgColor}>Personalizado: {campFooterBgColor}</option>
                                      )}
                                    </select>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">
                                    Relleno (Padding) ({previewViewport === 'desktop' ? 'Escritorio' : previewViewport === 'tablet' ? 'Tablet' : 'Móvil'})
                                  </label>
                                  <select
                                    value={
                                      previewViewport === 'desktop' ? campFooterPadding :
                                      previewViewport === 'tablet' ? campFooterPaddingTablet :
                                      campFooterPaddingMobile
                                    }
                                    onChange={e => {
                                      if (previewViewport === 'desktop') setCampFooterPadding(e.target.value);
                                      else if (previewViewport === 'tablet') setCampFooterPaddingTablet(e.target.value);
                                      else setCampFooterPaddingMobile(e.target.value);
                                    }}
                                    className="w-full bg-[#121915] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey text-[#F4F6F0]"
                                  >
                                    <option value="0px">Ninguno (0px)</option>
                                    <option value="10px">Sutil (10px)</option>
                                    <option value="20px">Mediano (20px)</option>
                                    <option value="30px">Grande (30px)</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">
                                    Bordes Redondeados ({previewViewport === 'desktop' ? 'Escritorio' : previewViewport === 'tablet' ? 'Tablet' : 'Móvil'})
                                  </label>
                                  <select
                                    value={
                                      previewViewport === 'desktop' ? campFooterRadius :
                                      previewViewport === 'tablet' ? campFooterRadiusTablet :
                                      campFooterRadiusMobile
                                    }
                                    onChange={e => {
                                      if (previewViewport === 'desktop') setCampFooterRadius(e.target.value);
                                      else if (previewViewport === 'tablet') setCampFooterRadiusTablet(e.target.value);
                                      else setCampFooterRadiusMobile(e.target.value);
                                    }}
                                    className="w-full bg-[#121915] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-honey text-[#F4F6F0]"
                                  >
                                    <option value="0px">Recto (0px)</option>
                                    <option value="8px">Sutil (8px)</option>
                                    <option value="16px">Elegante (16px)</option>
                                  </select>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Imagen de Fondo de Pie</label>
                                  {campFooterBgImage && (
                                    <button type="button" onClick={() => setCampFooterBgImage('')} className="text-[8px] uppercase tracking-widest font-black text-red-400">Quitar Imagen</button>
                                  )}
                                </div>
                                {templateImages.length > 0 && (
                                  <div className="flex gap-2 overflow-x-auto pb-1 custom-scroll">
                                    {templateImages.map((img: any) => (
                                      <div
                                        key={img.id}
                                        onClick={() => setCampFooterBgImage(img.image)}
                                        className={`w-12 h-12 rounded-lg overflow-hidden border cursor-pointer hover:border-amber-honey shrink-0 transition-all ${campFooterBgImage === img.image ? 'border-amber-honey ring-1 ring-amber-honey' : 'border-white/10'}`}
                                      >
                                        <img src={img.image} className="w-full h-full object-cover" />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* CATEGORY 5: CALL TO ACTIONS BUILDER */}
                      {settingsTab === 'ctas' && (
                        <div className="space-y-4">
                          {/* GLOBAL CTA BLOCK SETTINGS */}
                          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-3">
                            <span className="text-[9px] text-amber-honey uppercase tracking-widest font-black block border-b border-white/5 pb-1">Distribución del Bloque de Botones</span>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[8px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Margen Sup.</label>
                                <select
                                  value={campCtaMarginTop}
                                  onChange={e => setCampCtaMarginTop(e.target.value)}
                                  className="w-full bg-[#121915] border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] outline-none text-[#F4F6F0]"
                                >
                                  <option value="15px">Pequeño (15px)</option>
                                  <option value="25px">Medio (25px)</option>
                                  <option value="35px">Elegante (35px)</option>
                                  <option value="50px">Grande (50px)</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Margen Inf.</label>
                                <select
                                  value={campCtaMarginBottom}
                                  onChange={e => setCampCtaMarginBottom(e.target.value)}
                                  className="w-full bg-[#121915] border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] outline-none text-[#F4F6F0]"
                                >
                                  <option value="10px">Pequeño (10px)</option>
                                  <option value="20px">Medio (20px)</option>
                                  <option value="25px">Estándar (25px)</option>
                                  <option value="40px">Grande (40px)</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 pt-2 border-t border-white/5 animate-fade-in">
                              <div className="space-y-1">
                                <label className="text-[8px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">
                                  Alineación de Botones ({previewViewport === 'desktop' ? 'Escritorio' : previewViewport === 'tablet' ? 'Tablet' : 'Móvil'})
                                </label>
                                <select
                                  value={
                                    previewViewport === 'desktop' ? campCtaAlignment :
                                    previewViewport === 'tablet' ? campCtaAlignTablet :
                                    campCtaAlignMobile
                                  }
                                  onChange={e => {
                                    if (previewViewport === 'desktop') setCampCtaAlignment(e.target.value);
                                    else if (previewViewport === 'tablet') setCampCtaAlignTablet(e.target.value);
                                    else setCampCtaAlignMobile(e.target.value);
                                  }}
                                  className="w-full bg-[#121915] border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] outline-none text-[#F4F6F0]"
                                >
                                  <option value="left">Izquierda</option>
                                  <option value="center">Centro</option>
                                  <option value="right">Derecha</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-between items-center pb-2 border-b border-white/5">
                            <span className="text-[10px] text-[#F4F6F0]/40 uppercase tracking-widest font-black">Lista de Acciones</span>
                            <button
                              type="button"
                              onClick={() => {
                                setCampCtas([...campCtas, { text: '', link: '', bg_color: '', text_color: '#030303', radius: '12px' }]);
                              }}
                              className="px-3 py-1.5 bg-white/5 border border-white/10 hover:border-amber-honey/30 hover:bg-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest text-amber-honey flex items-center gap-1 transition-all"
                            >
                              <Plus size={10} /> Agregar CTA
                            </button>
                          </div>

                          {campCtas.length === 0 ? (
                            <div className="space-y-3">
                              <p className="text-[9px] text-[#F4F6F0]/40 uppercase tracking-widest font-black pl-1 italic">
                                Ninguno creado aún. Agrega uno arriba, o usa el CTA simple (Legacy):
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Texto del Botón (Legacy)</label>
                                  <input
                                    type="text"
                                    value={campCtaText}
                                    onChange={e => setCampCtaText(e.target.value)}
                                    placeholder="Ej. Escuchar Single"
                                    className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:border-amber-honey transition-all placeholder:text-[#F4F6F0]/30"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Enlace del Botón (Legacy URL)</label>
                                  <input
                                    type="url"
                                    value={campCtaLink}
                                    onChange={e => setCampCtaLink(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:border-amber-honey transition-all font-mono placeholder:text-[#F4F6F0]/30"
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-1 custom-scroll">
                              {campCtas.map((cta, idx) => (
                                <div key={idx} className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-3 relative group">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newCtas = [...campCtas];
                                      newCtas.splice(idx, 1);
                                      setCampCtas(newCtas);
                                    }}
                                    className="absolute top-3 right-3 w-6 h-6 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                                  >
                                    <X size={10} />
                                  </button>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-[8px] text-[#F4F6F0]/50 uppercase tracking-widest font-black block pl-1">Texto del Botón</label>
                                      <input
                                        type="text"
                                        value={cta.text}
                                        onChange={e => {
                                          const newCtas = [...campCtas];
                                          newCtas[idx].text = e.target.value;
                                          setCampCtas(newCtas);
                                        }}
                                        placeholder="Ej. Escuchar Single"
                                        className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[8px] text-[#F4F6F0]/50 uppercase tracking-widest font-black block pl-1">Enlace (URL)</label>
                                      <input
                                        type="url"
                                        value={cta.link}
                                        onChange={e => {
                                          const newCtas = [...campCtas];
                                          newCtas[idx].link = e.target.value;
                                          setCampCtas(newCtas);
                                        }}
                                        placeholder="https://..."
                                        className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none font-mono"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-[8px] text-[#F4F6F0]/50 uppercase tracking-widest font-black block pl-1">Fondo del Botón</label>
                                      <div className="flex gap-2 items-center">
                                        <input
                                          type="color"
                                          value={cta.bg_color || '#82c99b'}
                                          onChange={e => {
                                            const newCtas = [...campCtas];
                                            newCtas[idx].bg_color = e.target.value;
                                            setCampCtas(newCtas);
                                          }}
                                          className="w-6 h-6 rounded-md bg-transparent border border-white/10 cursor-pointer p-0 overflow-hidden"
                                        />
                                        <input
                                          type="text"
                                          value={cta.bg_color || ''}
                                          onChange={e => {
                                            const newCtas = [...campCtas];
                                            newCtas[idx].bg_color = e.target.value;
                                            setCampCtas(newCtas);
                                          }}
                                          placeholder="Defecto"
                                          className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-lg px-2 py-1 text-[10px] focus:outline-none"
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-[8px] text-[#F4F6F0]/50 uppercase tracking-widest font-black block pl-1">Color del Texto</label>
                                      <div className="flex gap-2 items-center">
                                        <input
                                          type="color"
                                          value={cta.text_color || '#030303'}
                                          onChange={e => {
                                            const newCtas = [...campCtas];
                                            newCtas[idx].text_color = e.target.value;
                                            setCampCtas(newCtas);
                                          }}
                                          className="w-6 h-6 rounded-md bg-transparent border border-white/10 cursor-pointer p-0 overflow-hidden"
                                        />
                                        <input
                                          type="text"
                                          value={cta.text_color || ''}
                                          onChange={e => {
                                            const newCtas = [...campCtas];
                                            newCtas[idx].text_color = e.target.value;
                                            setCampCtas(newCtas);
                                          }}
                                          placeholder="#030303"
                                          className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-lg px-2 py-1 text-[10px] focus:outline-none"
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-[8px] text-[#F4F6F0]/50 uppercase tracking-widest font-black block pl-1">Redondeado</label>
                                      <select
                                        value={cta.radius || '8px'}
                                        onChange={e => {
                                          const newCtas = [...campCtas];
                                          newCtas[idx].radius = e.target.value;
                                          setCampCtas(newCtas);
                                        }}
                                        className="w-full bg-[#121915] border border-white/10 rounded-lg px-2 py-1 text-[10px] outline-none text-[#F4F6F0]"
                                      >
                                        <option value="0px">Recto (0px)</option>
                                        <option value="4px">Sutil (4px)</option>
                                        <option value="8px">Elegante (8px)</option>
                                        <option value="12px">Redondo (12px)</option>
                                        <option value="20px">Total (20px)</option>
                                      </select>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1 border-t border-white/5">
                                    <div className="space-y-1">
                                      <label className="text-[8px] text-[#F4F6F0]/50 uppercase tracking-widest font-black block pl-1">Tamaño / Relleno</label>
                                      <select
                                        value={cta.padding_size || 'medium'}
                                        onChange={e => {
                                          const newCtas = [...campCtas];
                                          newCtas[idx].padding_size = e.target.value;
                                          setCampCtas(newCtas);
                                        }}
                                        className="w-full bg-[#121915] border border-white/10 rounded-lg px-2 py-1 text-[10px] outline-none text-[#F4F6F0]"
                                      >
                                        <option value="small">Pequeño (S)</option>
                                        <option value="medium">Mediano (M)</option>
                                        <option value="large">Grande (L)</option>
                                      </select>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-[8px] text-[#F4F6F0]/50 uppercase tracking-widest font-black block pl-1">Glow / Sombra</label>
                                      <select
                                        value={cta.shadow_style || 'default'}
                                        onChange={e => {
                                          const newCtas = [...campCtas];
                                          newCtas[idx].shadow_style = e.target.value;
                                          setCampCtas(newCtas);
                                        }}
                                        className="w-full bg-[#121915] border border-white/10 rounded-lg px-2 py-1 text-[10px] outline-none text-[#F4F6F0]"
                                      >
                                        <option value="none">Sin Sombra</option>
                                        <option value="sutil">Sutil</option>
                                        <option value="default">Estándar</option>
                                        <option value="glow">Brillo Ámbar</option>
                                        <option value="hard">Sólida Retro</option>
                                      </select>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-[8px] text-[#F4F6F0]/50 uppercase tracking-widest font-black block pl-1">Grosor Borde</label>
                                      <select
                                        value={cta.border_width || '0px'}
                                        onChange={e => {
                                          const newCtas = [...campCtas];
                                          newCtas[idx].border_width = e.target.value;
                                          setCampCtas(newCtas);
                                        }}
                                        className="w-full bg-[#121915] border border-white/10 rounded-lg px-2 py-1 text-[10px] outline-none text-[#F4F6F0]"
                                      >
                                        <option value="0px">Sin Borde</option>
                                        <option value="1px">Fino (1px)</option>
                                        <option value="2px">Medio (2px)</option>
                                        <option value="3px">Grueso (3px)</option>
                                      </select>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-[8px] text-[#F4F6F0]/50 uppercase tracking-widest font-black block pl-1">Ancho Completo</label>
                                      <div className="flex items-center h-7 pl-1">
                                        <input
                                          type="checkbox"
                                          checked={cta.is_full_width || false}
                                          onChange={e => {
                                            const newCtas = [...campCtas];
                                            newCtas[idx].is_full_width = e.target.checked;
                                            setCampCtas(newCtas);
                                          }}
                                          className="w-4 h-4 rounded border-white/10 bg-transparent text-amber-honey focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                        />
                                        <span className="text-[9px] text-[#F4F6F0]/50 uppercase font-black tracking-wider ml-2">Bloque</span>
                                      </div>
                                    </div>
                                  </div>

                                  {cta.border_width && cta.border_width !== '0px' && (
                                    <div className="grid grid-cols-2 gap-3 pt-1">
                                      <div className="space-y-1">
                                        <label className="text-[8px] text-[#F4F6F0]/50 uppercase tracking-widest font-black block pl-1">Estilo de Borde</label>
                                        <select
                                          value={cta.border_style || 'solid'}
                                          onChange={e => {
                                            const newCtas = [...campCtas];
                                            newCtas[idx].border_style = e.target.value;
                                            setCampCtas(newCtas);
                                          }}
                                          className="w-full bg-[#121915] border border-white/10 rounded-lg px-2 py-1 text-[10px] outline-none text-[#F4F6F0]"
                                        >
                                          <option value="solid">Sólido</option>
                                          <option value="dashed">Guiones</option>
                                          <option value="dotted">Puntos</option>
                                          <option value="double">Doble</option>
                                        </select>
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[8px] text-[#F4F6F0]/50 uppercase tracking-widest font-black block pl-1">Color del Borde</label>
                                        <div className="flex gap-2 items-center">
                                          <input
                                            type="color"
                                            value={cta.border_color || cta.bg_color || '#82c99b'}
                                            onChange={e => {
                                              const newCtas = [...campCtas];
                                              newCtas[idx].border_color = e.target.value;
                                              setCampCtas(newCtas);
                                            }}
                                            className="w-6 h-6 rounded-md bg-transparent border border-white/10 cursor-pointer p-0 overflow-hidden"
                                          />
                                          <input
                                            type="text"
                                            value={cta.border_color || ''}
                                            onChange={e => {
                                              const newCtas = [...campCtas];
                                              newCtas[idx].border_color = e.target.value;
                                              setCampCtas(newCtas);
                                            }}
                                            placeholder="Igual a Fondo"
                                            className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-lg px-2 py-1 text-[10px] focus:outline-none"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* CATEGORY 6: LIBRARY */}
                      {settingsTab === 'library' && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center pb-2 border-b border-white/5">
                            <span className="text-[10px] text-[#F4F6F0]/40 uppercase tracking-widest font-black">Biblioteca de Imágenes</span>
                            <label className="px-3 py-1.5 bg-amber-honey/10 border border-amber-honey/20 hover:bg-amber-honey/20 rounded-lg text-[9px] font-black uppercase tracking-widest text-amber-honey flex items-center gap-1 cursor-pointer transition-all">
                              <Plus size={10} /> {libraryUploadLoading ? 'Subiendo...' : 'Subir Imagen'}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={libraryUploadLoading}
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleTemplateImageUpload(file);
                                }}
                              />
                            </label>
                          </div>

                          {templateImages.length === 0 ? (
                            <div className="text-center py-8 border border-dashed border-white/10 rounded-2xl">
                              <FolderOpen size={24} className="mx-auto text-[#F4F6F0]/20 mb-2" />
                              <p className="text-[10px] text-[#F4F6F0]/40 uppercase tracking-widest font-black">Tu biblioteca está vacía</p>
                              <p className="text-[9px] text-[#F4F6F0]/30 mt-1 max-w-xs mx-auto leading-normal">Sube imágenes para utilizarlas como portada, fondo o dentro de los poemas.</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[48vh] overflow-y-auto pr-1 custom-scroll">
                              {templateImages.map((img: any) => (
                                <div key={img.id} className="group relative bg-white/5 border border-white/5 rounded-2xl overflow-hidden aspect-square flex flex-col justify-end">
                                  <img src={img.image} className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105 duration-300" />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => insertImageAtCursor(img.image)}
                                      className="w-full py-1 bg-amber-honey hover:bg-amber-gold text-[#030303] rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all"
                                    >
                                      <PlusCircle size={9} /> Insertar en Editor
                                    </button>
                                    <div className="grid grid-cols-2 gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleUseTemplateAsCover(img.image)}
                                        className="py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[7px] font-black uppercase tracking-wider transition-all"
                                      >
                                        Portada
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUseTemplateAsBg(img.image)}
                                        className="py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[7px] font-black uppercase tracking-wider transition-all"
                                      >
                                        Fondo Gral
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setCampTitleBgImage(img.image)}
                                        className="py-1 bg-white/15 hover:bg-white/25 text-[#F4F6F0]/80 rounded-md text-[6px] font-bold uppercase transition-all"
                                        title="Fondo Título"
                                      >
                                        Título
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setCampBodyBgImage(img.image)}
                                        className="py-1 bg-white/15 hover:bg-white/25 text-[#F4F6F0]/80 rounded-md text-[6px] font-bold uppercase transition-all"
                                        title="Fondo Cuerpo"
                                      >
                                        Cuerpo
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setCampFooterBgImage(img.image)}
                                        className="py-1 bg-white/15 hover:bg-white/25 text-[#F4F6F0]/80 rounded-md text-[6px] font-bold uppercase transition-all"
                                        title="Fondo Pie"
                                      >
                                        Pie
                                      </button>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleTemplateImageDelete(img.id)}
                                      className="w-full py-1 bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all mt-0.5 border border-red-500/10"
                                    >
                                      <Trash2 size={9} /> Eliminar
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-4 justify-end pt-4 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => setIsCampaignModalOpen(false)}
                          className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-[#F4F6F0]/80"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={campLoading}
                          className="px-8 py-3 bg-amber-honey text-[#1E2B22] rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-honey/15 disabled:opacity-50 transition-all hover:bg-amber-gold"
                        >
                          {campLoading ? 'Procesando...' : campId ? 'Actualizar Campaña' : 'Crear Campaña'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Column 2: Live Preview */}
                  <div className={`${isPreviewExpanded ? 'flex-1 w-full pl-0 border-l-0' : 'hidden lg:flex lg:w-[500px] xl:w-[580px] pl-4 border-l border-white/10'} overflow-y-auto border-t lg:border-t-0 custom-scroll flex-col gap-4 lg:max-h-[78vh] sticky top-0`}>
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <div>
                        <h3 className="text-sm font-black uppercase italic tracking-tight text-[#F4F6F0]">Previsualizador en Tiempo Real</h3>
                        <p className="text-[8px] text-[#F4F6F0]/50 uppercase tracking-widest font-bold mt-1">Cómo se verá el correo recibido</p>
                      </div>

                      <div className="flex gap-2 items-center">
                        {/* Viewport Switcher Selector */}
                        <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 gap-1">
                          {[
                            { id: 'desktop', label: 'Escritorio', icon: <Monitor size={10} /> },
                            { id: 'tablet', label: 'Tablet', icon: <Tablet size={10} /> },
                            { id: 'mobile', label: 'Móvil', icon: <Smartphone size={10} /> },
                          ].map(vp => (
                            <button
                              key={vp.id}
                              type="button"
                              onClick={() => setPreviewViewport(vp.id as any)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all duration-200 ${
                                previewViewport === vp.id
                                  ? 'bg-amber-honey text-[#030303] shadow-md scale-[1.02]'
                                  : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
                              }`}
                            >
                              {vp.icon}
                              <span>{vp.label}</span>
                            </button>
                          ))}
                        </div>

                        {/* Expand/Collapse Button */}
                        <button
                          type="button"
                          onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                          className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 border border-white/10 text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/10 transition-all duration-200"
                          title={isPreviewExpanded ? 'Mostrar Editor' : 'Ocultar Editor (Pantalla Completa)'}
                        >
                          {isPreviewExpanded ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                    </div>

                    <div 
                      className="border border-white/10 rounded-2xl overflow-hidden flex flex-col bg-[#080C0A] transition-all duration-300 mx-auto w-full"
                      style={{
                        width: previewViewport === 'mobile' ? '375px' : previewViewport === 'tablet' ? '768px' : '100%',
                        maxWidth: '100%',
                      }}
                    >
                      {/* Email Header */}
                      <div className="bg-white/5 border-b border-white/10 px-4 py-3 space-y-1.5 text-[10px] text-[#F4F6F0]/70">
                        <div><span className="font-bold text-[#F4F6F0]/45 mr-2 uppercase text-[8px] tracking-wider">De:</span> Ms Ambar &lt;hola@msambar.com&gt;</div>
                        <div><span className="font-bold text-[#F4F6F0]/45 mr-2 uppercase text-[8px] tracking-wider">Asunto:</span> <span className="text-[#F4F6F0] font-semibold">{campSubject || '(Sin Asunto)'}</span></div>
                      </div>

                      {/* Email Body Frame */}
                      <div className="overflow-y-auto custom-scroll" style={{
                        padding: previewViewport === 'mobile' ? '12px 8px' : '16px',
                        backgroundColor:
                          campTemplateType === 'moss' ? '#0b130e' :
                            campTemplateType === 'cosmic' ? '#05050f' :
                              campTemplateType === 'glow' ? '#0f0b07' :
                                campTemplateType === 'mist' ? '#0f1115' : '#06070b'
                      }}>
                        <div style={{
                          maxWidth: previewViewport === 'mobile' ? '100%' : previewViewport === 'tablet' ? '100%' : campCardMaxWidthDesktop,
                          width: '100%',
                          minWidth: '300px',
                          boxSizing: 'border-box',
                          margin: '0 auto',
                          backgroundColor:
                            campTemplateType === 'moss' ? '#122017' :
                              campTemplateType === 'cosmic' ? '#0c0a1a' :
                                campTemplateType === 'glow' ? '#1a130c' :
                                  campTemplateType === 'mist' ? '#181b22' : '#0c0d13',
                          border:
                            campTemplateType === 'moss' ? '1px solid #2e4d38' :
                              campTemplateType === 'cosmic' ? '1px solid #4a154b' :
                                campTemplateType === 'glow' ? '1px solid #d97706' :
                                  campTemplateType === 'mist' ? '1px solid #374151' : '1px solid rgba(255, 255, 255, 0.05)',
                          padding: previewViewport === 'mobile' ? campCardPaddingMobile : previewViewport === 'tablet' ? campCardPaddingTablet : campCardPaddingDesktop,
                          borderRadius: '16px',
                          fontFamily:
                            campFontFamily === 'playfair' ? "'Playfair Display', Georgia, serif" :
                              campFontFamily === 'cinzel' ? "'Cinzel', Georgia, serif" :
                                campFontFamily === 'garamond' ? "'Cormorant Garamond', 'Times New Roman', serif" :
                                  campFontFamily === 'montserrat' ? "'Montserrat', Helvetica, sans-serif" :
                                    campFontFamily === 'pinyon' ? "'Pinyon Script', cursive" :
                                      'Georgia, serif',
                          textAlign: 'left',
                          transition: 'all 0.3s ease',
                          ...(campBgImagePreview ? {
                            backgroundImage: `linear-gradient(rgba(${campTemplateType === 'moss' ? '18, 32, 23' :
                              campTemplateType === 'cosmic' ? '12, 10, 26' :
                                campTemplateType === 'glow' ? '26, 19, 12' :
                                  campTemplateType === 'mist' ? '24, 27, 34' : '12, 13, 19'
                              }, ${Math.max(0, Math.min(1, 1 - campBgOpacity))}), rgba(${campTemplateType === 'moss' ? '18, 32, 23' :
                                campTemplateType === 'cosmic' ? '12, 10, 26' :
                                  campTemplateType === 'glow' ? '26, 19, 12' :
                                    campTemplateType === 'mist' ? '24, 27, 34' : '12, 13, 19'
                              }, ${Math.max(0, Math.min(1, 1 - campBgOpacity))})) , url(${resolveMediaUrl(campBgImagePreview)})`,
                            backgroundPosition: campBgPosition,
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: 'cover',
                            filter: `saturate(${campBgSaturation}%)`,
                          } : {})
                        }}>
                          {/* Monogram logo */}
                          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                            <div style={{
                              display: 'inline-block',
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor:
                                campTemplateType === 'moss' ? '#82c99b' :
                                  campTemplateType === 'cosmic' ? '#c084fc' :
                                    campTemplateType === 'glow' ? '#f59e0b' :
                                      campTemplateType === 'mist' ? '#06b6d4' : '#f59e0b',
                              color: '#030303',
                              lineHeight: '32px',
                              textAlign: 'center',
                              fontWeight: 'bold',
                              fontSize: '16px'
                            }}>
                              <img src="/logos/ms_ambar_monograma_n.png" alt="A" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', padding: '3px', boxSizing: 'border-box' }} />
                            </div>
                            <h5 style={{ color: '#ffffff', fontSize: '13px', fontWeight: 'bold', margin: '4px 0 0 0' }}>{campSenderName || 'Ms Ambar'}</h5>
                          </div>

                          {/* Cover Image */}
                          {campImagePreview && (
                            <div style={{
                              textAlign: (
                                ((previewViewport === 'mobile' ? campImageAlignMobile : previewViewport === 'tablet' ? campImageAlignTablet : campImageAlign) === 'left' ? 'left' :
                                (previewViewport === 'mobile' ? campImageAlignMobile : previewViewport === 'tablet' ? campImageAlignTablet : campImageAlign) === 'right' ? 'right' : 'center') as any
                              ),
                              marginBottom: '15px'
                            }}>
                              <img
                                src={resolveMediaUrl(campImagePreview)}
                                style={{
                                  width: previewViewport === 'mobile' ? campImageWidthMobile : previewViewport === 'tablet' ? campImageWidthTablet : campImageWidth || '100%',
                                  maxWidth: '100%',
                                  height: 'auto',
                                  borderRadius: campImageRadius || '16px',
                                  border: '1px solid rgba(255,255,255,0.05)',
                                  display: 'inline-block'
                                }}
                                alt="Cover"
                              />
                            </div>
                          )}

                          {/* Subject inside body */}
                          <h4 style={{
                            color: campTitleTextColor,
                            backgroundColor: campTitleBgColor,
                            backgroundImage: campTitleBgImage ? `url(${resolveMediaUrl(campTitleBgImage)})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            padding: previewViewport === 'mobile' ? campTitlePaddingMobile : previewViewport === 'tablet' ? campTitlePaddingTablet : campTitlePadding,
                            borderRadius: previewViewport === 'mobile' ? campTitleRadiusMobile : previewViewport === 'tablet' ? campTitleRadiusTablet : campTitleRadius,
                            fontSize: previewViewport === 'mobile' ? campTitleFontSizeMobile : previewViewport === 'tablet' ? campTitleFontSizeTablet : campTitleFontSizeDesktop,
                            fontWeight: 'bold',
                            textAlign: 'center',
                            fontStyle: 'italic',
                            marginBottom: '15px',
                            fontFamily: resolveFontStack(campTitleFontFamily),
                            boxSizing: 'border-box'
                          }}>
                            {campEmailTitle ? (
                              <span dangerouslySetInnerHTML={{ __html: campEmailTitle }} />
                            ) : (
                              campSubject || '(Sin Asunto)'
                            )}
                          </h4>

                          {/* Poem content HTML */}
                          <div style={{ textAlign: 'center' }}>
                            <div
                              className="leading-relaxed italic"
                              style={{
                                color: campBodyTextColor || (
                                  campTemplateType === 'moss' ? '#f5fbf7' :
                                    campTemplateType === 'cosmic' ? '#ffffff' :
                                      campTemplateType === 'glow' ? '#fffdfa' :
                                        campTemplateType === 'mist' ? '#f3f4f6' : '#ffffff'
                                ),
                                backgroundColor: campBodyBgColor,
                                backgroundImage: campBodyBgImage ? `url(${resolveMediaUrl(campBodyBgImage)})` : undefined,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                padding: previewViewport === 'mobile' ? campBodyPaddingMobile : previewViewport === 'tablet' ? campBodyPaddingTablet : campBodyPadding,
                                borderRadius: previewViewport === 'mobile' ? campBodyRadiusMobile : previewViewport === 'tablet' ? campBodyRadiusTablet : campBodyRadius,
                                opacity: 0.9,
                                fontFamily: resolveFontStack(campFontFamily),
                                fontSize: previewViewport === 'mobile' ? campBodyFontSizeMobile : previewViewport === 'tablet' ? campBodyFontSizeTablet : campBodyFontSizeDesktop,
                                boxSizing: 'border-box',
                                marginBottom: '20px',
                                textAlign: (previewViewport === 'mobile' ? campBodyAlignmentMobile : previewViewport === 'tablet' ? campBodyAlignmentTablet : campBodyAlignment) as any,
                                display: 'inline-block',
                                maxWidth: '90%',
                                wordBreak: 'break-word'
                              }}
                              dangerouslySetInnerHTML={{ __html: formatCampaignText(campPoemText, campTextMode, previewViewport === 'mobile' ? campBodyAlignmentMobile : previewViewport === 'tablet' ? campBodyAlignmentTablet : campBodyAlignment) || '<i>El cuerpo del poema aparecerá aquí...</i>' }}
                            />
                          </div>

                          {/* CTAs list */}
                          {campCtas && campCtas.length > 0 ? (
                            <div style={{
                              textAlign: (previewViewport === 'mobile' ? campCtaAlignMobile : previewViewport === 'tablet' ? campCtaAlignTablet : campCtaAlignment) as any,
                              marginTop: campCtaMarginTop,
                              marginBottom: campCtaMarginBottom
                            }}>
                              {campCtas.map((cta: any, cidx: number) => {
                                const baseBg = cta.bg_color || (
                                  campTemplateType === 'moss' ? '#82c99b' :
                                    campTemplateType === 'cosmic' ? '#c084fc' :
                                      campTemplateType === 'glow' ? '#f59e0b' :
                                        campTemplateType === 'mist' ? '#06b6d4' : '#f59e0b'
                                );
                                return (
                                  <span
                                    key={cidx}
                                    onMouseEnter={() => setHoveredEditorCta(cidx)}
                                    onMouseLeave={() => setHoveredEditorCta(null)}
                                    style={{
                                      backgroundColor: hoveredEditorCta === cidx ? getHoverColor(baseBg) : baseBg,
                                      color: cta.text_color || '#030303',
                                      padding: cta.padding_size === 'small' ? '6px 12px' : cta.padding_size === 'large' ? '12px 24px' : '8px 16px',
                                      borderRadius: cta.radius || '8px',
                                      fontSize: cta.padding_size === 'large' ? '11px' : cta.padding_size === 'small' ? '9px' : '10px',
                                      fontWeight: 'bold',
                                      display: cta.is_full_width ? 'block' : 'inline-block',
                                      margin: cta.is_full_width ? '10px auto' : '4px 6px',
                                      letterSpacing: '0.5px',
                                      textTransform: 'uppercase',
                                      border: cta.border_width && cta.border_width !== '0px' ? `${cta.border_width} ${cta.border_style || 'solid'} ${cta.border_color || cta.bg_color || '#82c99b'}` : 'none',
                                      boxShadow: cta.shadow_style === 'none' ? 'none' : cta.shadow_style === 'sutil' ? '0 2px 5px rgba(0,0,0,0.1)' : cta.shadow_style === 'glow' ? `0 0 12px ${(cta.bg_color || '#82c99b')}88` : cta.shadow_style === 'hard' ? '3px 3px 0px rgba(0,0,0,0.3)' : '0 4px 10px rgba(0,0,0,0.2)',
                                      transition: 'background-color 0.2s ease-in-out',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {cta.text || 'Botón CTA'}
                                  </span>
                                );
                              })}
                            </div>
                          ) : campCtaText ? (
                            <div style={{
                              textAlign: (previewViewport === 'mobile' ? campCtaAlignMobile : previewViewport === 'tablet' ? campCtaAlignTablet : campCtaAlignment) as any,
                              marginTop: campCtaMarginTop,
                              marginBottom: campCtaMarginBottom
                            }}>
                              {(() => {
                                const baseBg = campTemplateType === 'moss' ? '#82c99b' :
                                  campTemplateType === 'cosmic' ? '#c084fc' :
                                    campTemplateType === 'glow' ? '#f59e0b' :
                                      campTemplateType === 'mist' ? '#06b6d4' : '#f59e0b';
                                return (
                                  <span
                                    onMouseEnter={() => setHoveredEditorSingleCta(true)}
                                    onMouseLeave={() => setHoveredEditorSingleCta(false)}
                                    style={{
                                      backgroundColor: hoveredEditorSingleCta ? getHoverColor(baseBg) : baseBg,
                                      color: '#030303',
                                      padding: '8px 16px',
                                      borderRadius: '8px',
                                      fontSize: '10px',
                                      fontWeight: 'bold',
                                      display: 'inline-block',
                                      letterSpacing: '0.5px',
                                      textTransform: 'uppercase',
                                      boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                      transition: 'background-color 0.2s ease-in-out',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {campCtaText}
                                  </span>
                                );
                              })()}
                            </div>
                          ) : null}

                          {/* Footer Signature */}
                          <div style={{
                            textAlign: 'center',
                            borderTop: '1px solid rgba(255,255,255,0.05)',
                            paddingTop: (previewViewport === 'mobile' ? campFooterPaddingMobile : previewViewport === 'tablet' ? campFooterPaddingTablet : campFooterPadding) !== '0px'
                              ? (previewViewport === 'mobile' ? campFooterPaddingMobile : previewViewport === 'tablet' ? campFooterPaddingTablet : campFooterPadding)
                              : '10px',
                            marginTop: '20px',
                            color: campFooterTextColor || 'rgba(255,255,255,0.3)',
                            backgroundColor: campFooterBgColor,
                            backgroundImage: campFooterBgImage ? `url(${resolveMediaUrl(campFooterBgImage)})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            padding: previewViewport === 'mobile' ? campFooterPaddingMobile : previewViewport === 'tablet' ? campFooterPaddingTablet : campFooterPadding,
                            borderRadius: previewViewport === 'mobile' ? campFooterRadiusMobile : previewViewport === 'tablet' ? campFooterRadiusTablet : campFooterRadius,
                            fontSize: '8px',
                            lineHeight: '1.4',
                            fontFamily: resolveFontStack(campFooterFontFamily),
                            boxSizing: 'border-box'
                          }}>
                            {campFooterText ? (
                              <div style={{ margin: '0 0 4px 0' }} dangerouslySetInnerHTML={{ __html: campFooterText }} />
                            ) : (
                              <p style={{ margin: '0 0 4px 0' }}>Recibiste este correo porque eres parte del club de Ms Ambar.</p>
                            )}
                            <p style={{ margin: '0' }}>Desuscribirse del boletín</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {isListModalOpen && (
              <div
                onClick={() => setIsListModalOpen(false)}
                className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-6"
              >
                <motion.div
                  onClick={e => e.stopPropagation()}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="amber-glass w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative flex flex-col gap-6"
                >
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-honey/40 to-transparent" />
                  <button
                    type="button"
                    onClick={() => setIsListModalOpen(false)}
                    className="absolute top-6 right-6 w-9 h-9 rounded-xl border border-white/10 text-[#F4F6F0]/40 hover:text-[#F4F6F0] flex items-center justify-center transition-all hover:bg-white/5"
                  >
                    <X size={16} />
                  </button>

                  <div>
                    <h3 className="text-xl font-black uppercase italic tracking-tight text-[#F4F6F0]">
                      Nueva Lista de Contactos
                    </h3>
                    <p className="text-[9px] text-[#F4F6F0]/55 uppercase tracking-widest font-bold mt-1">
                      Crea un segmento personalizado de marketing
                    </p>
                  </div>

                  <form onSubmit={handleListSubmit} className="space-y-4">
                    {listErrorMsg && (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-[10px] font-bold uppercase tracking-wide">
                        ⚠️ {listErrorMsg}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Nombre de la Lista *</label>
                      <input
                        type="text"
                        value={listName}
                        onChange={e => setListName(e.target.value)}
                        placeholder="Ej. Clientes VIP de Guadalajara"
                        required
                        className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:border-amber-honey transition-all placeholder:text-[#F4F6F0]/30"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block">Descripción</label>
                      <textarea
                        value={listDescription}
                        onChange={e => setListDescription(e.target.value)}
                        placeholder="Describe el propósito de este segmento de destinatarios..."
                        rows={3}
                        className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:border-amber-honey transition-all placeholder:text-[#F4F6F0]/30 resize-none"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsListModalOpen(false)}
                        className="flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] bg-white/5 border border-white/10 text-[#F4F6F0]/60 hover:bg-white/10 transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={listLoading}
                        className="flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] bg-gradient-to-r from-amber-500 to-amber-600 text-black flex items-center justify-center gap-2 shadow-[0_2px_15px_rgba(245,158,11,0.2)] disabled:opacity-50"
                      >
                        {listLoading ? 'Creando...' : 'Crear Lista'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}

            {/* Simulated Email Client Live Preview Modal */}
            {previewCampaign && (() => {
              const styles = typeof previewCampaign.custom_styles === 'string'
                ? JSON.parse(previewCampaign.custom_styles)
                : (previewCampaign.custom_styles || {});

              const activeCardPadding =
                modalPreviewViewport === 'mobile' ? (styles.card_padding_mobile || '16px') :
                modalPreviewViewport === 'tablet' ? (styles.card_padding_tablet || '32px') :
                (styles.card_padding_desktop || styles.card_padding || '40px');

              const activeTitlePadding =
                modalPreviewViewport === 'mobile' ? (styles.title_padding_mobile || styles.title_padding || '0px') :
                modalPreviewViewport === 'tablet' ? (styles.title_padding_tablet || styles.title_padding || '0px') :
                (styles.title_padding || '0px');

              const activeTitleRadius =
                modalPreviewViewport === 'mobile' ? (styles.title_radius_mobile || styles.title_radius || '0px') :
                modalPreviewViewport === 'tablet' ? (styles.title_radius_tablet || styles.title_radius || '0px') :
                (styles.title_radius || '0px');

              const activeTitleFontSize =
                modalPreviewViewport === 'mobile' ? (styles.title_font_size_mobile || '20px') :
                modalPreviewViewport === 'tablet' ? (styles.title_font_size_tablet || '24px') :
                (styles.title_font_size_desktop || '26px');

              const activeBodyPadding =
                modalPreviewViewport === 'mobile' ? (styles.body_padding_mobile || styles.body_padding || '0px') :
                modalPreviewViewport === 'tablet' ? (styles.body_padding_tablet || styles.body_padding || '0px') :
                (styles.body_padding || '0px');

              const activeBodyRadius =
                modalPreviewViewport === 'mobile' ? (styles.body_radius_mobile || styles.body_radius || '0px') :
                modalPreviewViewport === 'tablet' ? (styles.body_radius_tablet || styles.body_radius || '0px') :
                (styles.body_radius || '0px');

              const activeBodyFontSize =
                modalPreviewViewport === 'mobile' ? (styles.body_font_size_mobile || '14px') :
                modalPreviewViewport === 'tablet' ? (styles.body_font_size_tablet || '15px') :
                (styles.body_font_size_desktop || '16px');

              const activeBodyAlignment =
                modalPreviewViewport === 'mobile' ? (styles.body_alignment_mobile || styles.body_alignment || 'center') :
                modalPreviewViewport === 'tablet' ? (styles.body_alignment_tablet || styles.body_alignment || 'center') :
                (styles.body_alignment || 'center');

              const activeImageWidth =
                modalPreviewViewport === 'mobile' ? (styles.image_width_mobile || '100%') :
                modalPreviewViewport === 'tablet' ? (styles.image_width_tablet || '100%') :
                (styles.image_width || previewCampaign.image_style?.width || '100%');

              const activeImageAlign =
                modalPreviewViewport === 'mobile' ? (styles.image_align_mobile || 'center') :
                modalPreviewViewport === 'tablet' ? (styles.image_align_tablet || 'center') :
                (styles.image_align || previewCampaign.image_style?.align || 'center');

              const activeImageRadius =
                styles.image_radius || previewCampaign.image_style?.radius || '20px';

              const activeCtaAlign =
                modalPreviewViewport === 'mobile' ? (styles.cta_alignment_mobile || 'center') :
                modalPreviewViewport === 'tablet' ? (styles.cta_alignment_tablet || 'center') :
                (styles.cta_alignment || 'center');

              const activeFooterPadding =
                modalPreviewViewport === 'mobile' ? (styles.footer_padding_mobile || styles.footer_padding || '0px') :
                modalPreviewViewport === 'tablet' ? (styles.footer_padding_tablet || styles.footer_padding || '0px') :
                (styles.footer_padding || '0px');

              const activeFooterRadius =
                modalPreviewViewport === 'mobile' ? (styles.footer_radius_mobile || styles.footer_radius || '0px') :
                modalPreviewViewport === 'tablet' ? (styles.footer_radius_tablet || styles.footer_radius || '0px') :
                (styles.footer_radius || '0px');

              const titleBgStyle: any = styles.title_bg_color && styles.title_bg_color !== 'transparent'
                ? { backgroundColor: styles.title_bg_color }
                : {};
              if (styles.title_bg_image) {
                titleBgStyle.backgroundImage = `url(${resolveMediaUrl(styles.title_bg_image)})`;
                titleBgStyle.backgroundSize = 'cover';
                titleBgStyle.backgroundPosition = 'center';
              }

              const bodyBgStyle: any = styles.body_bg_color && styles.body_bg_color !== 'transparent'
                ? { backgroundColor: styles.body_bg_color }
                : {};
              if (styles.body_bg_image) {
                bodyBgStyle.backgroundImage = `url(${resolveMediaUrl(styles.body_bg_image)})`;
                bodyBgStyle.backgroundSize = 'cover';
                bodyBgStyle.backgroundPosition = 'center';
              }

              const footerBgStyle: any = styles.footer_bg_color && styles.footer_bg_color !== 'transparent'
                ? { backgroundColor: styles.footer_bg_color }
                : {};
              if (styles.footer_bg_image) {
                footerBgStyle.backgroundImage = `url(${resolveMediaUrl(styles.footer_bg_image)})`;
                footerBgStyle.backgroundSize = 'cover';
                footerBgStyle.backgroundPosition = 'center';
              }

              return (
                <div
                  onClick={() => setPreviewCampaign(null)}
                  className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-6 overflow-y-auto"
                >
                  <motion.div
                    onClick={e => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="amber-glass w-full max-w-5xl rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-honey/40 to-transparent" />
                    <button
                      onClick={() => setPreviewCampaign(null)}
                      className="absolute top-6 right-6 w-9 h-9 rounded-xl border border-white/10 text-[#F4F6F0]/40 hover:text-[#F4F6F0] flex items-center justify-center transition-all hover:bg-white/5"
                    >
                      <X size={16} />
                    </button>

                    <div className="flex justify-between items-center flex-wrap gap-2 pr-12">
                      <div>
                        <h3 className="text-xl font-black uppercase italic tracking-tight text-[#F4F6F0]">Previsualización de Correo</h3>
                        <p className="text-[9px] text-[#F4F6F0]/50 uppercase tracking-widest font-bold mt-1">Simulación de bandeja de entrada</p>
                      </div>

                      <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 gap-1">
                        {[
                          { id: 'desktop', label: 'Escritorio', icon: <Monitor size={10} /> },
                          { id: 'tablet', label: 'Tablet', icon: <Tablet size={10} /> },
                          { id: 'mobile', label: 'Móvil', icon: <Smartphone size={10} /> },
                        ].map(vp => (
                          <button
                            key={vp.id}
                            type="button"
                            onClick={() => setModalPreviewViewport(vp.id as any)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all duration-200 ${
                              modalPreviewViewport === vp.id
                                ? 'bg-amber-honey text-[#030303] shadow-md scale-[1.02]'
                                : 'text-[#F4F6F0]/60 hover:text-[#F4F6F0] hover:bg-white/5'
                            }`}
                          >
                            {vp.icon}
                            <span>{vp.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Simulated Email Client Frame */}
                    <div className="border border-white/10 rounded-2xl overflow-hidden flex flex-col flex-1 bg-[#080C0A]">
                      {/* Email header bar */}
                      <div className="bg-white/5 border-b border-white/10 px-6 py-4 space-y-1.5 text-xs text-[#F4F6F0]/70">
                        <div><span className="font-bold text-[#F4F6F0]/45 mr-2 uppercase text-[9px] tracking-wider">De:</span> Ms Ambar &lt;hola@msambar.com&gt;</div>
                        <div><span className="font-bold text-[#F4F6F0]/45 mr-2 uppercase text-[9px] tracking-wider">Para:</span> suscriptor@ejemplo.com</div>
                        <div><span className="font-bold text-[#F4F6F0]/45 mr-2 uppercase text-[9px] tracking-wider">Asunto:</span> <span className="text-[#F4F6F0] font-semibold">{previewCampaign.subject}</span></div>
                      </div>

                      {/* Email body simulation */}
                      <div className="flex-1 overflow-y-auto custom-scroll" style={{
                        padding: modalPreviewViewport === 'mobile' ? '12px 8px' : '20px',
                        backgroundColor:
                          previewCampaign.template_type === 'moss' ? '#0b130e' :
                            previewCampaign.template_type === 'cosmic' ? '#05050f' :
                              previewCampaign.template_type === 'glow' ? '#0f0b07' :
                                previewCampaign.template_type === 'mist' ? '#0f1115' : '#06070b'
                      }}>
                        <div style={{
                          width: modalPreviewViewport === 'mobile' ? '375px' : modalPreviewViewport === 'tablet' ? '768px' : '100%',
                          maxWidth: modalPreviewViewport === 'mobile' ? '100%' : modalPreviewViewport === 'tablet' ? '100%' : (styles.card_max_width_desktop || '680px'),
                          minWidth: '300px',
                          boxSizing: 'border-box',
                          margin: '0 auto',
                          backgroundColor:
                            previewCampaign.template_type === 'moss' ? '#122017' :
                              previewCampaign.template_type === 'cosmic' ? '#0c0a1a' :
                                previewCampaign.template_type === 'glow' ? '#1a130c' :
                                  previewCampaign.template_type === 'mist' ? '#181b22' : '#0c0d13',
                          border:
                            previewCampaign.template_type === 'moss' ? '1px solid #2e4d38' :
                              previewCampaign.template_type === 'cosmic' ? '1px solid #4a154b' :
                                previewCampaign.template_type === 'glow' ? '1px solid #d97706' :
                                  previewCampaign.template_type === 'mist' ? '1px solid #374151' : '1px solid rgba(255, 255, 255, 0.05)',
                          padding: activeCardPadding,
                          borderRadius: '20px',
                          fontFamily:
                            previewCampaign.font_family === 'playfair' ? "'Playfair Display', Georgia, serif" :
                              previewCampaign.font_family === 'cinzel' ? "'Cinzel', Georgia, serif" :
                                previewCampaign.font_family === 'garamond' ? "'Cormorant Garamond', 'Times New Roman', serif" :
                                  previewCampaign.font_family === 'montserrat' ? "'Montserrat', Helvetica, sans-serif" :
                                    previewCampaign.font_family === 'pinyon' ? "'Pinyon Script', cursive" :
                                      'Georgia, serif',
                          textAlign: 'left',
                          // Background Image Overlay & blending simulation
                          ...(previewCampaign.bg_image ? {
                            backgroundImage: `linear-gradient(rgba(${previewCampaign.template_type === 'moss' ? '18, 32, 23' :
                              previewCampaign.template_type === 'cosmic' ? '12, 10, 26' :
                                previewCampaign.template_type === 'glow' ? '26, 19, 12' :
                                  previewCampaign.template_type === 'mist' ? '24, 27, 34' : '12, 13, 19'
                              }, ${Math.max(0, Math.min(1, 1 - (previewCampaign.bg_opacity ?? 1.0)))}), rgba(${previewCampaign.template_type === 'moss' ? '18, 32, 23' :
                                previewCampaign.template_type === 'cosmic' ? '12, 10, 26' :
                                  previewCampaign.template_type === 'glow' ? '26, 19, 12' :
                                    previewCampaign.template_type === 'mist' ? '24, 27, 34' : '12, 13, 19'
                              }, ${Math.max(0, Math.min(1, 1 - (previewCampaign.bg_opacity ?? 1.0)))})) , url(${resolveMediaUrl(previewCampaign.bg_image)})`,
                            backgroundPosition: previewCampaign.bg_position || 'center',
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: 'cover',
                            filter: `saturate(${previewCampaign.bg_saturation ?? 100}%)`,
                          } : {})
                        }}>
                          {/* Logo header */}
                          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                            <div style={{
                              display: 'inline-block',
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              backgroundColor:
                                previewCampaign.template_type === 'moss' ? '#82c99b' :
                                  previewCampaign.template_type === 'cosmic' ? '#c084fc' :
                                    previewCampaign.template_type === 'glow' ? '#f59e0b' :
                                      previewCampaign.template_type === 'mist' ? '#06b6d4' : '#f59e0b',
                              color: '#030303',
                              lineHeight: '40px',
                              textAlign: 'center',
                              fontWeight: 'bold',
                              fontSize: '20px'
                            }}>
                              <img src="/logos/ms_ambar_monograma_n.png" alt="A" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', padding: '4px', boxSizing: 'border-box' }} />
                            </div>
                            <h4 style={{ color: '#ffffff', fontSize: '18px', fontWeight: 'bold', margin: '10px 0 0 0' }}>
                              {styles.sender_name || 'Ms Ambar'}
                            </h4>
                            <p style={{
                              color:
                                previewCampaign.template_type === 'moss' ? '#82c99b' :
                                  previewCampaign.template_type === 'cosmic' ? '#c084fc' :
                                    previewCampaign.template_type === 'glow' ? '#f59e0b' :
                                      previewCampaign.template_type === 'mist' ? '#06b6d4' : '#f59e0b',
                              fontSize: '8px',
                              textTransform: 'uppercase',
                              letterSpacing: '2px',
                              margin: '2px 0 0 0'
                            }}>Ambar te escribe • Club Exclusivo</p>
                          </div>

                          {/* Optional cover image */}
                          {previewCampaign.image && (
                            <div style={{
                              textAlign: (activeImageAlign === 'left' ? 'left' :
                                activeImageAlign === 'right' ? 'right' : 'center') as any,
                              marginBottom: '20px'
                            }}>
                              <img
                                src={resolveMediaUrl(previewCampaign.image)}
                                style={{
                                  width: activeImageWidth,
                                  maxWidth: '100%',
                                  height: 'auto',
                                  borderRadius: activeImageRadius,
                                  border: '1px solid rgba(255,255,255,0.05)',
                                  display: 'inline-block'
                                }}
                                alt="Cover"
                              />
                            </div>
                          )}

                          {/* Subject as title inside email */}
                          <h3 style={{
                            color: styles.title_color || '#ffffff',
                            ...titleBgStyle,
                            padding: activeTitlePadding,
                            borderRadius: activeTitleRadius,
                            fontSize: activeTitleFontSize,
                            fontWeight: 'bold',
                            textAlign: 'center',
                            fontStyle: 'italic',
                            marginBottom: '25px',
                            fontFamily: resolveFontStack(previewCampaign.title_font_family),
                            boxSizing: 'border-box'
                          }}>
                            {previewCampaign.email_title ? (
                              <span dangerouslySetInnerHTML={{ __html: previewCampaign.email_title }} />
                            ) : (
                              previewCampaign.subject
                            )}
                          </h3>

                          {/* Poem body */}
                          <div style={{
                            color: styles.body_color || (
                              previewCampaign.template_type === 'moss' ? '#f5fbf7' :
                                previewCampaign.template_type === 'cosmic' ? '#ffffff' :
                                  previewCampaign.template_type === 'glow' ? '#fffdfa' :
                                    previewCampaign.template_type === 'mist' ? '#f3f4f6' : '#ffffff'
                            ),
                            ...bodyBgStyle,
                            padding: activeBodyPadding,
                            borderRadius: activeBodyRadius,
                            fontSize: activeBodyFontSize,
                            lineHeight: '1.8',
                            textAlign: activeBodyAlignment as any,
                            fontStyle: 'italic',
                            opacity: 0.95,
                            fontFamily: resolveFontStack(previewCampaign.font_family),
                            boxSizing: 'border-box',
                            marginBottom: '30px'
                          }}>
                            <div dangerouslySetInnerHTML={{ __html: formatCampaignText(previewCampaign.poem_text, styles.text_mode || 'poem', activeBodyAlignment) || '<i>El cuerpo del poema aparecerá aquí...</i>' }} />
                          </div>

                          {/* Dynamic CTA Buttons */}
                          {previewCampaign.ctas && previewCampaign.ctas.length > 0 ? (
                            <div style={{ textAlign: activeCtaAlign as any, marginTop: '30px', marginBottom: '20px' }}>
                              {previewCampaign.ctas.map((cta: any, cidx: number) => {
                                const baseBg = cta.bg_color || (
                                  previewCampaign.template_type === 'moss' ? '#82c99b' :
                                    previewCampaign.template_type === 'cosmic' ? '#c084fc' :
                                      previewCampaign.template_type === 'glow' ? '#f59e0b' :
                                        previewCampaign.template_type === 'mist' ? '#06b6d4' : '#f59e0b'
                                );
                                return (
                                  <a
                                    key={cidx}
                                    href={cta.link || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onMouseEnter={() => setHoveredModalCta(cidx)}
                                    onMouseLeave={() => setHoveredModalCta(null)}
                                    style={{
                                      backgroundColor: hoveredModalCta === cidx ? getHoverColor(baseBg) : baseBg,
                                      color: cta.text_color || '#030303',
                                      padding: '14px 28px',
                                      borderRadius: cta.radius || '12px',
                                      fontSize: '13px',
                                      fontWeight: 'bold',
                                      textDecoration: 'none',
                                      display: cta.is_full_width ? 'block' : 'inline-block',
                                      margin: cta.is_full_width ? '10px auto' : '5px 10px',
                                      letterSpacing: '1px',
                                      textTransform: 'uppercase',
                                      boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
                                      transition: 'background-color 0.2s ease-in-out'
                                    }}
                                  >
                                    {cta.text}
                                  </a>
                                );
                              })}
                            </div>
                          ) : previewCampaign.cta_text ? (
                            <div style={{ textAlign: activeCtaAlign as any, marginTop: '30px', marginBottom: '20px' }}>
                              {(() => {
                                const baseBg = previewCampaign.template_type === 'moss' ? '#82c99b' :
                                  previewCampaign.template_type === 'cosmic' ? '#c084fc' :
                                    previewCampaign.template_type === 'glow' ? '#f59e0b' :
                                      previewCampaign.template_type === 'mist' ? '#06b6d4' : '#f59e0b';
                                return (
                                  <a
                                    href={previewCampaign.cta_link || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onMouseEnter={() => setHoveredModalSingleCta(true)}
                                    onMouseLeave={() => setHoveredModalSingleCta(false)}
                                    style={{
                                      backgroundColor: hoveredModalSingleCta ? getHoverColor(baseBg) : baseBg,
                                      color: '#030303',
                                      padding: '14px 28px',
                                      borderRadius: '12px',
                                      fontSize: '13px',
                                      fontWeight: 'bold',
                                      textDecoration: 'none',
                                      display: 'inline-block',
                                      letterSpacing: '1px',
                                      textTransform: 'uppercase',
                                      boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
                                      transition: 'background-color 0.2s ease-in-out'
                                    }}
                                  >
                                    {previewCampaign.cta_text}
                                  </a>
                                );
                              })()}
                            </div>
                          ) : null}

                          {/* Footer */}
                          <div style={{
                            textAlign: 'center',
                            borderTop: '1px solid rgba(255,255,255,0.05)',
                            paddingTop: activeFooterPadding !== '0px' ? activeFooterPadding : '15px',
                            marginTop: '30px',
                            color: styles.footer_color || 'rgba(255,255,255,0.3)',
                            ...footerBgStyle,
                            padding: activeFooterPadding || '0px',
                            borderRadius: activeFooterRadius || '0px',
                            fontSize: '9px',
                            lineHeight: '1.4',
                            fontFamily: resolveFontStack(previewCampaign.footer_font_family),
                            boxSizing: 'border-box'
                          }}>
                            {previewCampaign.footer_text ? (
                              <div style={{ margin: '0 0 8px 0' }} dangerouslySetInnerHTML={{ __html: previewCampaign.footer_text }} />
                            ) : (
                              <p style={{ margin: '0 0 8px 0' }}>Recibiste este correo porque eres parte del club de Ms Ambar.</p>
                            )}
                            <p style={{ margin: '0' }}>
                              <span style={{
                                color:
                                  previewCampaign.template_type === 'moss' ? '#82c99b' :
                                    previewCampaign.template_type === 'cosmic' ? '#c084fc' :
                                      previewCampaign.template_type === 'glow' ? '#f59e0b' :
                                        previewCampaign.template_type === 'mist' ? '#06b6d4' : '#f59e0b'
                              }}>
                                Desuscribirse del boletín
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => setPreviewCampaign(null)}
                        className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-[#F4F6F0]/80 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                      >
                        Cerrar Vista Previa
                      </button>
                    </div>
                  </motion.div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* User Profile Edit Modal */}
      {isProfileModalOpen && (
        <div
          onClick={() => setIsProfileModalOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-6 overflow-y-auto"
        >
          <motion.div
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="amber-glass w-full max-w-md rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-honey/40 to-transparent" />
            <button
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute top-6 right-6 w-9 h-9 rounded-xl border border-white/10 text-[#F4F6F0]/40 hover:text-[#F4F6F0] flex items-center justify-center transition-all hover:bg-white/5"
            >
              <X size={16} />
            </button>

            <div>
              <h3 className="text-xl font-black uppercase italic tracking-tight text-[#F4F6F0]">
                Editar Perfil
              </h3>
              <p className="text-[9px] text-[#F4F6F0]/55 uppercase tracking-widest font-bold mt-1">
                Actualiza tus datos de contacto personales
              </p>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              {profileSuccessMsg && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl text-xs font-bold uppercase tracking-wide">
                  {profileSuccessMsg}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Nombre de Usuario</label>
                <input
                  type="text"
                  value={profileUsername}
                  onChange={e => setProfileUsername(e.target.value)}
                  required
                  className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:border-amber-honey transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Nombre</label>
                  <input
                    type="text"
                    value={profileFirstName}
                    onChange={e => setProfileFirstName(e.target.value)}
                    className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:border-amber-honey transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Apellido</label>
                  <input
                    type="text"
                    value={profileLastName}
                    onChange={e => setProfileLastName(e.target.value)}
                    className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:border-amber-honey transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-[#F4F6F0]/60 uppercase tracking-widest font-black block pl-1">Teléfono</label>
                <input
                  type="text"
                  value={profilePhone}
                  onChange={e => setProfilePhone(e.target.value)}
                  placeholder="Ej. +526621234567"
                  className="w-full bg-white/5 text-[#F4F6F0] border border-white/10 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:border-amber-honey transition-all font-mono"
                />
              </div>

              <div className="flex gap-4 justify-end pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-[#F4F6F0]/80"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-8 py-3 bg-amber-honey text-[#1E2B22] rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-honey/15 disabled:opacity-50 transition-all hover:bg-amber-gold flex items-center gap-2"
                >
                  {profileSaving ? 'Guardando...' : 'Guardar Perfil'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// Stat Card Component
const StatCard = ({ icon, title, value, detail, color }: any) => {
  const glowColors: any = {
    amber: 'shadow-lg shadow-black/20 border-amber-honey/20 hover:border-amber-honey/40',
    gold: 'shadow-lg shadow-black/20 border-amber-honey/20 hover:border-amber-honey/40',
    honey: 'shadow-lg shadow-black/20 border-amber-honey/20 hover:border-amber-honey/40',
    yellow: 'shadow-lg shadow-black/20 border-amber-honey/20 hover:border-amber-honey/40',
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={`amber-glass border rounded-[2rem] p-6 transition-all duration-300 relative group overflow-hidden ${glowColors[color]}`}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] text-[#F4F6F0]/60 uppercase tracking-widest font-black">{title}</span>
        <div className="p-2.5 bg-white/5 rounded-xl group-hover:scale-110 transition-transform text-[#F4F6F0]">
          {icon}
        </div>
      </div>
      <div className="text-2xl md:text-3xl font-black text-[#F4F6F0] tracking-tight mb-2">{value}</div>
      <div className="text-[#F4F6F0]/40 text-[9px] uppercase tracking-widest font-black">{detail}</div>
    </motion.div>
  );
};

// Quick Action Button Component
const QuickActionBtn = ({ href, title, desc, icon, external }: any) => {
  const BtnContent = (
    <div className="p-4 bg-white/5 border border-white/10 hover:border-amber-honey/30 hover:bg-amber-honey/[0.02] rounded-2xl shadow-md transition-all group flex items-center justify-between cursor-pointer">
      <div className="flex items-center gap-4">
        <div className="p-2.5 bg-white/5 rounded-xl group-hover:bg-amber-honey/10 group-hover:scale-105 transition-all text-[#F4F6F0]/60 group-hover:text-amber-honey">
          {icon}
        </div>
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-[#F4F6F0] group-hover:text-amber-honey transition-colors">{title}</h4>
          <p className="text-[9px] uppercase tracking-widest text-[#F4F6F0]/40 group-hover:text-[#F4F6F0]/60 mt-0.5">{desc}</p>
        </div>
      </div>
      <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-amber-honey" />
    </div>
  );

  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer">{BtnContent}</a>
  ) : (
    <Link href={href}>{BtnContent}</Link>
  );
}
