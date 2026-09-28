import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getSeatAssignmentParts, formatSeatAssignment } from '../lib/seatMapLoader';

export interface TicketPassProps {
  ticket: {
    token: string;
    seat_row?: string;
    seat_number?: number | string;
    seat_display?: string;
    user_email?: string;
    seat?: {
      row?: string;
      number: number | string;
      row_letter?: string;
      table_number?: string | number;
      table_label?: string;
      section?: string;
      [key: string]: any;
    };
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
  seat?: {
    row?: string;
    number?: number | string;
    row_letter?: string;
    table_number?: string | number;
    table_label?: string;
    section?: string;
    [key: string]: any;
  };
  className?: string;
}

export const TicketPass: React.FC<TicketPassProps> = ({
  ticket,
  event,
  seat: seatProp,
  className = ''
}) => {
  // 1. Resolver información de asiento de manera unificada y normalizada
  const rawSeat = seatProp || ticket?.seat || {
    row: ticket?.seat_row,
    number: ticket?.seat_number,
    row_letter: ticket?.seat_row_letter,
    table_number: ticket?.table_number
  };

  const hasSeat = Boolean(rawSeat?.number || rawSeat?.row || rawSeat?.row_letter);

  const seatParts = hasSeat
    ? getSeatAssignmentParts({
        row: rawSeat?.row,
        row_letter: rawSeat?.row_letter,
        table_number: rawSeat?.table_number,
        table_label: rawSeat?.table_label,
        number: rawSeat?.number ?? '—'
      })
    : null;

  const sectionName = rawSeat?.section || event?.section || ticket?.ga_zone?.name || 'GENERAL';

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
            value={ticket?.token ? `${process.env.NEXT_PUBLIC_FRONTEND_URL || ''}/tickets/${ticket.token}` : 'https://ms-ambar.com'}
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
    </div>
  );
};

export default TicketPass;
