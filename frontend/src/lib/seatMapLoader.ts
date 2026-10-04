/**
 * Helper unificado de normalización y vinculación espacial de asientos y mesas.
 * Néctar Gateway Engine - ms-ambar
 */

export interface SeatDataInput {
  id?: string | number;
  row?: string;
  row_letter?: string;
  table_number?: string | number;
  table_label?: string;
  tableId?: string | number;
  table_id?: string | number;
  number: number | string;
  category?: string;
  status?: string;
  base_price?: number;
  x?: number;
  y?: number;
  [key: string]: any;
}

export interface FormattedSeatParts {
  sectionText?: string;
  rowText?: string;
  tableText?: string;
  seatText: string;
  formattedText: string;
  isGeneralAdmission: boolean;
}

/**
 * Helper canónico de formateo de asignación de asiento.
 * Retorna la jerarquía canónica: "Sección: VIP · Fila: F · Mesa: 4 · Asiento: 13"
 * Maneja defensivamente objetos Seat, objetos Ticket y strings seat_display.
 */
export function formatSeatAssignment(seat?: {
  section?: string;
  section_name?: string;
  row_letter?: string;
  table_number?: string | number;
  number?: number | string;
  seat_number?: number | string;
  row?: string;
  seat_row?: string;
  table_label?: string;
  seat_display?: string;
  seat?: any;
  seat_detail?: any;
  ga_zone?: any;
  [key: string]: any;
} | null): string {
  if (!seat) return 'Entrada General';
  return getSeatAssignmentParts(seat).formattedText;
}

/**
 * Retorna las partes estructuradas para renderizado jerárquico con estilos independientes.
 * Descompone con seguridad boletos numerados, zonas generales y deserializaciones planas de DRF.
 */
export function getSeatAssignmentParts(input?: any): FormattedSeatParts {
  if (!input) {
    return {
      seatText: 'Entrada General',
      formattedText: 'Entrada General',
      isGeneralAdmission: true,
    };
  }

  // Si input es un string plano
  if (typeof input === 'string') {
    return {
      seatText: input,
      formattedText: input,
      isGeneralAdmission: input.toLowerCase().includes('general') || input.toLowerCase().includes('meet'),
    };
  }

  // Detectar objeto seat anidado si nos pasaron un Ticket
  const actualSeat =
    input.seat_detail && typeof input.seat_detail === 'object'
      ? input.seat_detail
      : typeof input.seat === 'object' && input.seat !== null
      ? input.seat
      : input;

  // 1. Detección de Admisión General / Meet & Greet
  const isGA = Boolean(
    input.ga_zone ||
    input.is_seatless ||
    (input.seat_display && (
      input.seat_display.toLowerCase().includes('general') ||
      input.seat_display.toLowerCase().includes('meet & greet') ||
      input.seat_display.toLowerCase().includes('sin asiento')
    )) ||
    (!actualSeat && !input.seat_row && !input.number && !input.seat_number)
  );

  if (isGA) {
    const gaLabel =
      input.ga_zone?.name ||
      input.section_name ||
      (input.seat_display && !input.seat_display.includes('—') ? input.seat_display : 'Entrada General');

    return {
      sectionText: gaLabel.toLowerCase().includes('general') ? undefined : gaLabel,
      seatText: gaLabel,
      formattedText: gaLabel,
      isGeneralAdmission: true,
    };
  }

  // 2. Extracción y normalización de Sección
  let sectionText: string | undefined = undefined;
  const rawSection = actualSeat?.section || input.section || input.section_name;
  if (rawSection) {
    const cleanSection = String(rawSection).replace(/^secci[oó]n\s*:?\s*/i, '').trim();
    if (cleanSection && cleanSection.toLowerCase() !== 'general') {
      sectionText = `Sección: ${cleanSection}`;
    }
  }

  // 3. Extracción y normalización de Fila
  let rowText: string | undefined = undefined;
  let cleanRowLetter = actualSeat?.row_letter || input.row_letter;
  const rawRow = actualSeat?.row || input.seat_row || input.row;
  if (!cleanRowLetter && rawRow) {
    const rawClean = String(rawRow).replace(/^fila\s*:?\s*/i, '').trim();
    if (!rawClean.toLowerCase().startsWith('mesa')) {
      cleanRowLetter = rawClean;
    }
  }
  if (cleanRowLetter) {
    const pureLetter = String(cleanRowLetter).replace(/^fila\s*:?\s*/i, '').trim();
    if (pureLetter) {
      rowText = `Fila: ${pureLetter.toUpperCase()}`;
    }
  }

  // 4. Extracción y normalización de Mesa
  let tableText: string | undefined = undefined;
  let cleanTableNum = actualSeat?.table_number ?? input.table_number;
  const rawTableLabel = actualSeat?.table_label ?? input.table_label;
  if (cleanTableNum === undefined && rawTableLabel) {
    const match = String(rawTableLabel).match(/\d+/);
    if (match) cleanTableNum = match[0];
  }
  if (cleanTableNum === undefined && rawRow && String(rawRow).toLowerCase().includes('mesa')) {
    const match = String(rawRow).match(/\d+/);
    if (match) cleanTableNum = match[0];
  }
  if (cleanTableNum !== undefined && cleanTableNum !== null && String(cleanTableNum).trim() !== '') {
    const pureTable = String(cleanTableNum).replace(/^mesa\s*:?\s*/i, '').trim();
    if (pureTable) {
      tableText = `Mesa: ${pureTable}`;
    }
  }

  // 5. Extracción y normalización de Asiento
  const rawSeatNumber = actualSeat?.number ?? input.seat_number ?? input.number;
  let pureSeat: string | null = null;
  if (
    rawSeatNumber !== undefined &&
    rawSeatNumber !== null &&
    String(rawSeatNumber).trim() !== '' &&
    String(rawSeatNumber).trim() !== '—'
  ) {
    pureSeat = String(rawSeatNumber).replace(/^asiento\s*:?\s*/i, '').trim();
  }

  // Fallback inteligente: si pureSeat no se pudo extraer (ej. seat era sólo un ID numérico),
  // descomponer el string seat_display que genera el backend
  if (!pureSeat && input.seat_display && typeof input.seat_display === 'string' && !input.seat_display.includes('—')) {
    const chunks = input.seat_display.split('·').map((c: string) => c.trim());
    for (const chunk of chunks) {
      if (/^secci[oó]n/i.test(chunk) && !sectionText) sectionText = chunk;
      else if (/^mesa/i.test(chunk) && !tableText) tableText = chunk;
      else if (/^fila/i.test(chunk) && !rowText) rowText = chunk;
      else if (/^asiento/i.test(chunk)) pureSeat = chunk.replace(/^asiento\s*:?\s*/i, '').trim();
    }
  }

  const seatText = pureSeat ? `Asiento: ${pureSeat}` : 'Asiento Asignado';

  const parts: string[] = [];
  if (sectionText) parts.push(sectionText);
  if (rowText) parts.push(rowText);
  if (tableText) parts.push(tableText);
  parts.push(seatText);

  return {
    sectionText,
    rowText,
    tableText,
    seatText,
    formattedText: parts.join(' · '),
    isGeneralAdmission: false,
  };
}

/**
 * SeatMapLoader: Vincula exhaustivamente seats con map_elements
 * para restituir el número de mesa, letra de fila limpia y el texto jerárquico.
 */
export function loadAndMapSeats<T extends SeatDataInput>(
  rawSeats: T[],
  mapElements: any[] = []
): (T & {
  row_letter: string;
  table_number?: number | string;
  table_label?: string;
  tableId?: string | number;
  seat_display: string;
})[] {
  if (!Array.isArray(rawSeats) || rawSeats.length === 0) return [];

  const tableElements = (Array.isArray(mapElements) ? mapElements : []).filter(
    (el: any) => el?.type === 'table' || el?.tableShape || String(el?.label || '').trim().toLowerCase().startsWith('mesa')
  );

  const tableById = new Map<string, any>();
  const tableByLabel = new Map<string, any>();
  tableElements.forEach((t: any) => {
    if (t?.id !== undefined) tableById.set(String(t.id), t);
    if (t?.label) tableByLabel.set(String(t.label).trim().toLowerCase(), t);
  });

  return rawSeats.map(seat => {
    let matchedTable: any = null;

    // 1. Por ID directo (tableId o table_id)
    const tid = seat.tableId || seat.table_id;
    if (tid !== undefined && tableById.has(String(tid))) {
      matchedTable = tableById.get(String(tid));
    }

    // 2. Por coincidencia de label en seat.row (ej. seat.row === "Mesa 5")
    if (!matchedTable && seat.row) {
      const rowKey = String(seat.row).trim().toLowerCase();
      if (tableByLabel.has(rowKey)) {
        matchedTable = tableByLabel.get(rowKey);
      }
    }

    // 3. Por proximidad geométrica radial (≤ 80px)
    if (!matchedTable && seat.x !== undefined && seat.y !== undefined && tableElements.length > 0) {
      let minDist = Infinity;
      let closest: any = null;
      for (const t of tableElements) {
        if (t.x !== undefined && t.y !== undefined) {
          const dist = Math.hypot(t.x - seat.x, t.y - seat.y);
          if (dist <= 80 && dist < minDist) {
            minDist = dist;
            closest = t;
          }
        }
      }
      if (closest) {
        matchedTable = closest;
      }
    }

    // Extracción de datos de mesa
    let table_number: string | number | undefined = undefined;
    let table_label: string | undefined = undefined;
    let resolvedTableId = tid;

    if (matchedTable) {
      resolvedTableId = matchedTable.id;
      table_label = matchedTable.label || `Mesa ${matchedTable.id}`;
      const numMatch = String(matchedTable.label || matchedTable.id).match(/\d+/);
      if (numMatch) {
        table_number = parseInt(numMatch[0], 10);
      }
    } else if (seat.row && String(seat.row).toLowerCase().includes('mesa')) {
      const numMatch = String(seat.row).match(/\d+/);
      if (numMatch) {
        table_number = parseInt(numMatch[0], 10);
        table_label = `Mesa ${table_number}`;
      }
    }

    // Extracción de fila pura (row_letter)
    let row_letter = '';
    const candidateRow = (matchedTable && (matchedTable.row || matchedTable.row_label)) || seat.row || '';
    const cleanCand = String(candidateRow).replace(/^fila\s*/i, '').trim();
    if (cleanCand && !cleanCand.toLowerCase().startsWith('mesa')) {
      row_letter = cleanCand.toUpperCase();
    } else if (seat.row_letter) {
      row_letter = String(seat.row_letter).replace(/^fila\s*/i, '').trim().toUpperCase();
    }

    const assignment = formatSeatAssignment({
      row_letter,
      table_number,
      table_label,
      number: seat.number,
      row: seat.row
    });

    return {
      ...seat,
      row_letter,
      table_number,
      table_label,
      tableId: resolvedTableId,
      table_id: resolvedTableId,
      seat_display: assignment
    };
  });
}

export const SeatMapLoader = {
  formatSeatAssignment,
  getSeatAssignmentParts,
  loadAndMapSeats
};
