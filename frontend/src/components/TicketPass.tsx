import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getSeatAssignmentParts } from '../lib/seatMapLoader';

export interface TicketSeatAssignment {
  id?: string;
  row?: string;
  row_letter?: string;
  table_number?: string | number;
  table_label?: string;
  number?: string | number;
  section?: string;
  [key: string]: any;
}

export interface TicketPassProps {
  ticket: {
    token: string;
    id?: number | string;
    seat_row?: string;
    seat_number?: number | string;
    seat_row_letter?: string;
    table_number?: string | number;
    table_label?: string;
    section?: string;
    seat_display?: string;
    user_email?: string;
    qr_payload?: string;
    apple_pass_url?: string;
    google_wallet_link_url?: string;
    seat?: TicketSeatAssignment;
    ga_zone?: {
      name?: string;
    };
    [key: string]: any;
  };
  event: {
    title: string;
    date: string;
    doors_open?: string;
    venue_name: string;
    venue_address?: string;
    section?: string;
    [key: string]: any;
  };
  seat?: TicketSeatAssignment;
  className?: string;
}

export const TicketPass: React.FC<TicketPassProps> = ({
  ticket,
  event,
  seat: seatProp,
  className = ''
}) => {
  // 1. Detección reactiva de plataforma (User-Agent) para priorizar la billetera nativa
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod|macintosh/.test(ua)) {
        setPlatform('ios');
      } else if (/android/.test(ua)) {
        setPlatform('android');
      } else {
        setPlatform('other');
      }
    }
  }, []);

  // 2. Resolver información de asiento de manera unificada y normalizada
  const fallbackSeat: TicketSeatAssignment = {
    row: ticket?.seat_row,
    number: ticket?.seat_number,
    row_letter: ticket?.seat_row_letter,
    table_number: ticket?.table_number,
    table_label: (ticket as any)?.table_label,
    section: (ticket as any)?.section,
  };

  const rawSeat: TicketSeatAssignment = seatProp || ticket?.seat || fallbackSeat;
  const hasSeat = Boolean(rawSeat?.number || rawSeat?.row || rawSeat?.row_letter);

  const seatParts = hasSeat
    ? getSeatAssignmentParts({
        row: rawSeat?.row,
        row_letter: rawSeat?.row_letter,
        table_number: rawSeat?.table_number,
        table_label: (rawSeat as any)?.table_label ?? (rawSeat as any)?.table_number,
        number: rawSeat?.number ?? '—'
      })
    : null;

  const sectionName = (rawSeat as any)?.section || event?.section || ticket?.ga_zone?.name || 'GENERAL';

  // Formato de fecha oficial
  const formatEventDate = (dateStr: string) => {
    if (!dateStr) return '03 / 10 / 2026';
    try {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day} / ${month} / ${year}`;
    } catch {
      return dateStr;
    }
  };

  const formatEventTime = (timeStr?: string, dateStr?: string) => {
    const target = timeStr || dateStr;
    if (!target) return '20:00 HRS';
    try {
      const d = new Date(target);
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes} HRS`;
    } catch {
      return '20:00 HRS';
    }
  };

  // URL base de API para descargas
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const applePassUrl = ticket?.apple_pass_url
    ? `${apiBase}${ticket.apple_pass_url.startsWith('http') ? '' : ''}${ticket.apple_pass_url}`
    : `${apiBase}/api/tickets/${ticket?.token}/apple-pass/`;

  const handleSaveToGoogleWallet = async () => {
    if (!ticket?.token) return;
    setIsGoogleLoading(true);
    setGoogleError(null);

    try {
      const endpoint = ticket?.google_wallet_link_url
        ? (ticket.google_wallet_link_url.startsWith('http') ? ticket.google_wallet_link_url : `${apiBase}${ticket.google_wallet_link_url}`)
        : `${apiBase}/api/tickets/${ticket.token}/google-wallet-link/`;

      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error('No se pudo generar el enlace de Google Wallet.');
      }
      const data = await res.json();
      if (data?.save_url) {
        window.open(data.save_url, '_blank', 'noopener,noreferrer');
      } else {
        throw new Error('Enlace de guardado no retornado por el servidor.');
      }
    } catch (err: any) {
      setGoogleError(err.message || 'Error de conexión.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Botón Oficial Apple Wallet
  const renderAppleWalletButton = (isPriority: boolean) => (
    <div className="relative group w-full">
      {isPriority && (
        <span className="absolute -top-2.5 right-3 bg-[#E5A93B] text-[#11131c] text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-md z-10 animate-pulse">
          Recomendado para iPhone
        </span>
      )}
      <a
        href={applePassUrl}
        download={`ticket-${ticket?.id || ticket?.token}.pkpass`}
        className={`w-full flex items-center justify-center gap-3 bg-black hover:bg-black/90 active:scale-[0.98] transition-all duration-200 py-3.5 px-5 rounded-2xl border ${
          isPriority ? 'border-[#E5A93B]/70 shadow-[0_0_20px_rgba(229,169,59,0.25)]' : 'border-white/20 hover:border-white/40'
        } text-white select-none cursor-pointer`}
        title="Agregar a Apple Wallet (.pkpass)"
      >
        {/* Apple Logo SVG oficial */}
        <svg className="w-5 h-5 flex-shrink-0 text-white fill-current" viewBox="0 0 170 170">
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

  // Botón Oficial Google Wallet
  const renderGoogleWalletButton = (isPriority: boolean) => (
    <div className="relative group w-full">
      {isPriority && (
        <span className="absolute -top-2.5 right-3 bg-[#4285F4] text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-md z-10 animate-pulse">
          Recomendado para Android
        </span>
      )}
      <button
        onClick={handleSaveToGoogleWallet}
        disabled={isGoogleLoading}
        type="button"
        className={`w-full flex items-center justify-center gap-3 bg-[#11131c] hover:bg-[#1a1e2d] active:scale-[0.98] transition-all duration-200 py-3.5 px-5 rounded-2xl border ${
          isPriority ? 'border-[#4285F4]/70 shadow-[0_0_20px_rgba(66,133,244,0.25)]' : 'border-white/20 hover:border-white/40'
        } text-white select-none cursor-pointer disabled:opacity-50`}
        title="Guardar en Google Wallet"
      >
        {isGoogleLoading ? (
          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin flex-shrink-0" />
        ) : (
          /* Google Wallet Icon SVG */
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 48 48">
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
  );

  return (
    <div className={`w-full max-w-md mx-auto space-y-4 font-sans select-none ${className}`}>
      {/* ── CARD 1: PASE OFICIAL ── */}
      <div className="bg-[#11131c] border border-amber-500/20 rounded-[28px] p-6 sm:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.6)] relative overflow-hidden text-left">
        {/* Header con barrita ámbar */}
        <div className="border-l-[3px] border-[#E5A93B] pl-3.5 mb-6">
          <span className="text-[9px] font-black uppercase tracking-[0.25em] text-[#E5A93B] block mb-1">
            PASE OFICIAL · NÉCTAR GATEWAY
          </span>
          <h2 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white leading-tight">
            {event?.title || 'Ms. Ambar en Concierto “Hadas en el Desierto”'}
          </h2>
        </div>

        {/* Tabla de Información 2x2 */}
        <div className="grid grid-cols-2 gap-y-4 gap-x-4 border-b border-white/5 pb-4 mb-4">
          <div>
            <span className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#F4F6F0]/40 block mb-1">
              FECHA
            </span>
            <strong className="text-sm font-bold text-[#F4F6F0] block">
              {formatEventDate(event?.date)}
            </strong>
          </div>

          <div>
            <span className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#F4F6F0]/40 block mb-1">
              HORARIO
            </span>
            <strong className="text-sm font-bold text-[#F4F6F0] block">
              {formatEventTime(event?.doors_open, event?.date)}
            </strong>
          </div>

          <div>
            <span className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#F4F6F0]/40 block mb-1">
              SECCIÓN / ZONA
            </span>
            <strong className="text-sm font-black uppercase text-[#E5A93B] block">
              {sectionName}
            </strong>
          </div>

          {/* ASIGNACIÓN AUDITADA: TIPOGRAFÍA JERÁRQUICA SIN DUPLICACIONES */}
          <div>
            <span className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#F4F6F0]/40 block mb-1">
              ASIGNACIÓN
            </span>
            {seatParts ? (
              <div className="text-sm leading-tight flex items-center gap-1.5 flex-wrap">
                {seatParts.rowText && (
                  <span className="font-bold text-[#E5A93B]">
                    {seatParts.rowText}
                  </span>
                )}
                {seatParts.rowText && seatParts.tableText && (
                  <span className="text-[#F4F6F0]/30">·</span>
                )}
                {seatParts.tableText && (
                  <span className="font-bold text-[#E5A93B]">
                    {seatParts.tableText}
                  </span>
                )}
                {(seatParts.rowText || seatParts.tableText) && (
                  <span className="text-[#F4F6F0]/30">·</span>
                )}
                <span className="font-black text-[#F4F6F0]">
                  {seatParts.seatText}
                </span>
              </div>
            ) : (
              <strong className="text-sm font-bold text-[#F4F6F0]">
                {ticket?.seat_display || 'Entrada General (De pie)'}
              </strong>
            )}
          </div>
        </div>

        {/* RECINTO / VENUE */}
        <div>
          <span className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#F4F6F0]/40 block mb-1">
            RECINTO / VENUE
          </span>
          <strong className="text-sm font-semibold text-[#F4F6F0] block">
            {event?.venue_name || 'London Pub'}
            {event?.venue_address && (
              <span className="text-xs text-[#F4F6F0]/50 font-normal ml-1">
                {event.venue_address}
              </span>
            )}
          </strong>
        </div>
      </div>

      {/* ── CARD 2: CÓDIGO QR DE ACCESO ── */}
      <div className="bg-gradient-to-b from-[#11131c] to-[#0d1017] border border-[#E5A93B]/25 rounded-[28px] p-6 sm:p-7 text-center shadow-[0_12px_40px_rgba(0,0,0,0.6)] space-y-4">
        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-[#E5A93B] block">
          CÓDIGO QR DE ACCESO — USO ÚNICO
        </span>

        {/* Contenedor QR blanco puro */}
        <div className="inline-block bg-white p-4 rounded-2xl shadow-2xl">
          <QRCodeSVG
            value={ticket?.qr_payload || (ticket?.token ? `${process.env.NEXT_PUBLIC_FRONTEND_URL || ''}/tickets/${ticket.token}` : 'https://ms-ambar.com')}
            size={180}
            level="H"
            includeMargin={false}
          />
        </div>

        <p className="text-[11px] text-[#F4F6F0]/50 leading-relaxed max-w-xs mx-auto">
          Presenta este código en la entrada del evento.<br />
          <strong className="text-[#F4F6F0]/80">Solo puede escanearse una vez.</strong> No lo compartas.
        </p>

        {/* Token de autenticidad en contenedor monospace */}
        <div className="bg-black/30 border border-[#E5A93B]/10 rounded-xl p-3 inline-block max-w-full">
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[#F4F6F0]/30 block mb-1">
            TOKEN DE AUTENTICIDAD
          </span>
          <span className="font-mono text-xs font-bold text-[#E5A93B] tracking-wider break-all">
            {ticket?.token || '3157397a-50d7-435a-9a11-9a284d298473'}
          </span>
        </div>
      </div>

      {/* ── CARD 3: BILLETERAS MÓVILES (APPLE WALLET & GOOGLE WALLET) ── */}
      <div className="bg-[#11131c] border border-white/10 rounded-[28px] p-5 sm:p-6 text-center shadow-[0_12px_40px_rgba(0,0,0,0.6)] space-y-4">
        <div className="text-left border-l-[3px] border-amber-500/50 pl-3">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F4F6F0]/60 block mb-0.5">
            BILLETERA DIGITAL NATIVA
          </span>
          <span className="text-xs font-bold text-white block">
            Lleva tu boleto en tu teléfono sin necesidad de conexión
          </span>
        </div>

        {/* Renderizado dinámico condicional según OS */}
        <div className="space-y-3 pt-1">
          {platform === 'ios' ? (
            <>
              {renderAppleWalletButton(true)}
              {renderGoogleWalletButton(false)}
            </>
          ) : platform === 'android' ? (
            <>
              {renderGoogleWalletButton(true)}
              {renderAppleWalletButton(false)}
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {renderAppleWalletButton(false)}
              {renderGoogleWalletButton(false)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketPass;
