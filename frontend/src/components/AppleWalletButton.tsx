import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../lib/utils';

export interface MobileWalletBadgesProps {
  ticketToken: string;
  ticketId?: number | string;
  googleWalletUrl?: string;
  applePassUrl?: string;
  className?: string;
}

/**
 * Hook de detección de plataforma de usuario para Progressive Enhancement.
 * Identifica si el dispositivo pertenece al ecosistema Apple (iOS, iPadOS, macOS/Safari)
 * o al ecosistema Android/Chromium.
 */
export const useWalletPlatform = () => {
  const [isApple, setIsApple] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.navigator) {
      const ua = window.navigator.userAgent || '';
      const isAppleDevice = /iPhone|iPad|iPod|Macintosh/i.test(ua);
      const isAndroidDevice = /Android/i.test(ua);

      setIsApple(isAppleDevice);
      setIsAndroid(isAndroidDevice);
    }
  }, []);

  return { isApple, isAndroid };
};

/**
 * Botón Oficial "Add to Apple Wallet" (.pkpass).
 * Utiliza descarga binaria directa mediante enlace de navegación nativo,
 * evitando conversiones intermedias en Base64 o Blob que corrompen la interpretación
 * automática del MIME type application/vnd.apple.pkpass en Safari / WebKit.
 */
export const AppleWalletButton: React.FC<{
  ticketToken: string;
  ticketId?: number | string;
  customUrl?: string;
  isPriority?: boolean;
  className?: string;
}> = ({ ticketToken, ticketId, customUrl, isPriority = false, className = '' }) => {
  const downloadUrl = customUrl
    ? getApiUrl(customUrl)
    : getApiUrl(`/tickets/${ticketToken}/apple-pass/`);

  const filename = `ms-ambar-ticket-${ticketId || ticketToken}.pkpass`;

  const handleAppleDownload = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // En Safari iOS/macOS, la navegación directa permite al sistema interceptar el MIME type .pkpass
    if (typeof window !== 'undefined' && /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent)) {
      // Permitir la acción estándar de descarga/apertura nativa
      return;
    }
  };

  return (
    <div className={`relative group w-full ${className}`}>
      {isPriority && (
        <span className="absolute -top-2.5 right-3 bg-[#E5A93B] text-[#0C0E14] text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-md z-10 animate-pulse">
          Recomendado para Apple
        </span>
      )}
      <a
        href={downloadUrl}
        download={filename}
        onClick={handleAppleDownload}
        className={`w-full flex items-center justify-center gap-3 bg-black hover:bg-zinc-900 active:scale-[0.98] transition-all duration-200 py-3.5 px-5 rounded-2xl border ${
          isPriority
            ? 'border-[#E5A93B]/70 shadow-[0_0_20px_rgba(229,169,59,0.25)]'
            : 'border-white/20 hover:border-white/40'
        } text-white select-none cursor-pointer`}
        title="Agregar a Apple Wallet (.pkpass)"
      >
        {/* Apple Logo Oficial SVG */}
        <svg className="w-5 h-5 flex-shrink-0 text-white fill-current" viewBox="0 0 170 170" aria-hidden="true">
          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.69-7.85-11.96-14.43-5.74-8.83-10.22-19.14-13.43-30.93-3.21-11.79-4.82-22.75-4.82-32.88 0-14.58 3.73-26.65 11.19-36.21 7.46-9.56 16.92-14.42 28.37-14.58 4.67 0 9.87 1.25 15.6 3.74 5.73 2.49 9.53 3.79 11.4 3.91 1.62-.24 5.63-1.6 12.04-4.08 6.41-2.48 11.75-3.61 16.03-3.39 12.04.64 21.6 4.79 28.69 12.44-10.74 6.53-15.98 15.54-15.72 27.04.26 9.07 3.78 16.73 10.55 22.98 6.77 6.25 14.86 9.77 24.27 10.55-2.03 6.07-4.42 12.33-7.18 18.79zm-29.21-105.1c0-6.74 2.43-13.12 7.28-19.14 4.86-6.02 11.08-9.87 18.66-11.55.54 1.41.81 2.82.81 4.23 0 6.64-2.5 13.06-7.51 19.26-5.01 6.2-11.23 10.02-18.66 11.46-.22-1.42-.58-2.84-.58-4.26z" />
        </svg>
        <div className="text-left leading-none">
          <span className="text-[9px] uppercase tracking-wider text-white/60 block mb-0.5 font-medium">
            Agregar a
          </span>
          <span className="text-sm font-bold tracking-tight text-white block">
            Apple Wallet
          </span>
        </div>
      </a>
    </div>
  );
};

/**
 * Contenedor Unificado de Pases Móviles:
 * Renderiza los botones de Apple Wallet y Google Wallet lado a lado con priorización
 * contextual según el sistema operativo del usuario.
 */
export const MobileWalletBadges: React.FC<MobileWalletBadgesProps> = ({
  ticketToken,
  ticketId,
  googleWalletUrl,
  applePassUrl,
  className = ''
}) => {
  const { isApple, isAndroid } = useWalletPlatform();
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

  const handleGoogleWalletClick = async () => {
    if (!ticketToken) return;
    setIsGoogleLoading(true);
    setGoogleError(null);

    try {
      const endpoint = googleWalletUrl
        ? getApiUrl(googleWalletUrl)
        : getApiUrl(`/tickets/${ticketToken}/google-wallet-link/`);

      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error('No se pudo generar el enlace de Google Wallet.');
      }
      const data = await res.json();
      if (data?.save_url) {
        window.open(data.save_url, '_blank', 'noopener,noreferrer');
      } else {
        throw new Error('Enlace no disponible.');
      }
    } catch (err: any) {
      setGoogleError(err.message || 'Error de conexión con Google Wallet.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className={`w-full flex flex-col sm:flex-row items-center gap-3 ${className}`}>
      {/* 1. Botón Apple Wallet */}
      <AppleWalletButton
        ticketToken={ticketToken}
        ticketId={ticketId}
        customUrl={applePassUrl}
        isPriority={isApple}
        className={isApple ? 'order-1' : isAndroid ? 'order-2' : 'order-1'}
      />

      {/* 2. Botón Google Wallet */}
      <div className={`relative group w-full ${isAndroid ? 'order-1' : 'order-2'}`}>
        {isAndroid && (
          <span className="absolute -top-2.5 right-3 bg-[#4285F4] text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-md z-10 animate-pulse">
            Recomendado para Android
          </span>
        )}
        <button
          onClick={handleGoogleWalletClick}
          disabled={isGoogleLoading}
          type="button"
          className={`w-full flex items-center justify-center gap-3 bg-[#11131c] hover:bg-[#1a1e2d] active:scale-[0.98] transition-all duration-200 py-3.5 px-5 rounded-2xl border ${
            isAndroid
              ? 'border-[#4285F4]/70 shadow-[0_0_20px_rgba(66,133,244,0.25)]'
              : 'border-white/20 hover:border-white/40'
          } text-white select-none cursor-pointer disabled:opacity-50`}
          title="Guardar en Google Wallet"
        >
          {isGoogleLoading ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin flex-shrink-0" />
          ) : (
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
              <path fill="#34A853" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13.5 24 13.5c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.3 6.3 14.7z"/>
              <path fill="#FBBC05" d="M24 46c5.4 0 10.3-1.9 14.1-5.1l-6.5-5.3c-2.1 1.4-4.7 2.4-7.6 2.4-6.1 0-10.7-3.1-11.8-8.5L5.7 34.3C9.1 41.3 15.9 46 24 46z"/>
              <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.8 2.6-2.4 4.8-4.6 6.3l6.5 5.3c4.4-4.1 7.3-10.1 7.3-16.1 0-1.3-.2-2.7-.5-4z"/>
            </svg>
          )}
          <div className="text-left leading-none">
            <span className="text-[9px] uppercase tracking-wider text-white/60 block mb-0.5 font-medium">
              Guardar en
            </span>
            <span className="text-sm font-bold tracking-tight text-white block">
              Google Wallet
            </span>
          </div>
        </button>
        {googleError && (
          <span className="text-[10px] text-red-400 mt-1 block text-center">
            {googleError}
          </span>
        )}
      </div>
    </div>
  );
};

export default AppleWalletButton;
