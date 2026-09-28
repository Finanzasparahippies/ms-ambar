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
  rowText?: string;
  tableText?: string;
  seatText: string;
  formattedText?: string;
}

/**
 * Helper canónico de formateo de asignación de asiento.
 * Elimina prefijos redundantes ("Fila Fila F" -> "Fila: F", "Mesa Mesa 5" -> "Mesa: 5")
 * y retorna la jerarquía canónica: "Fila: F · Mesa: 4 · Asiento: 13"
 */
export function formatSeatAssignment(seat: {
  row_letter?: string;
  table_number?: string | number;
  number: number | string;
  row?: string;
  table_label?: string;
}): string {
  const parts: string[] = [];

  // Extraer y limpiar letra de fila
  let cleanRowLetter = seat.row_letter;
  if (!cleanRowLetter && seat.row) {
    const rawClean = String(seat.row).replace(/^fila\s*:?\s*/i, '').trim();
    if (!rawClean.toLowerCase().startsWith('mesa')) {
      cleanRowLetter = rawClean;
    }
  }

  if (cleanRowLetter) {
    const pureLetter = String(cleanRowLetter).replace(/^fila\s*:?\s*/i, '').trim();
    if (pureLetter) {
      parts.push(`Fila: ${pureLetter.toUpperCase()}`);
    }
  }

  // Extraer y limpiar número de mesa
  let cleanTableNum = seat.table_number;
  if (cleanTableNum === undefined && seat.table_label) {
    const match = String(seat.table_label).match(/\d+/);
    if (match) cleanTableNum = match[0];
  }
  if (cleanTableNum === undefined && seat.row && String(seat.row).toLowerCase().includes('mesa')) {
    const match = String(seat.row).match(/\d+/);
    if (match) cleanTableNum = match[0];
  }

  if (cleanTableNum !== undefined && cleanTableNum !== null && String(cleanTableNum).trim() !== '') {
    const pureTable = String(cleanTableNum).replace(/^mesa\s*:?\s*/i, '').trim();
    if (pureTable) {
      parts.push(`Mesa: ${pureTable}`);
    }
  }

  const pureSeat = String(seat.number).replace(/^asiento\s*:?\s*/i, '').trim();
  parts.push(`Asiento: ${pureSeat}`);
  return parts.join(' · '); // Resultado canónico: "Fila: F · Mesa: 4 · Asiento: 13"
}

/**
 * Retorna las partes estructuradas para renderizado jerárquico con estilos independientes.
 */
export function getSeatAssignmentParts(seat: {
  row_letter?: string;
  table_number?: string | number;
  number: number | string;
  row?: string;
  table_label?: string;
}): FormattedSeatParts {
  let cleanRowLetter = seat.row_letter;
  if (!cleanRowLetter && seat.row) {
    const rawClean = String(seat.row).replace(/^fila\s*:?\s*/i, '').trim();
    if (!rawClean.toLowerCase().startsWith('mesa')) {
      cleanRowLetter = rawClean;
    }
  }

  let rowText: string | undefined = undefined;
  if (cleanRowLetter) {
    const pureLetter = String(cleanRowLetter).replace(/^fila\s*:?\s*/i, '').trim();
    if (pureLetter) rowText = `Fila: ${pureLetter.toUpperCase()}`;
  }

  let cleanTableNum = seat.table_number;
  if (cleanTableNum === undefined && seat.table_label) {
    const match = String(seat.table_label).match(/\d+/);
    if (match) cleanTableNum = match[0];
  }
  if (cleanTableNum === undefined && seat.row && String(seat.row).toLowerCase().includes('mesa')) {
    const match = String(seat.row).match(/\d+/);
    if (match) cleanTableNum = match[0];
  }

  let tableText: string | undefined = undefined;
  if (cleanTableNum !== undefined && cleanTableNum !== null && String(cleanTableNum).trim() !== '') {
    const pureTable = String(cleanTableNum).replace(/^mesa\s*:?\s*/i, '').trim();
    if (pureTable) tableText = `Mesa: ${pureTable}`;
  }

  const pureSeat = String(seat.number).replace(/^asiento\s*:?\s*/i, '').trim();
  const seatText = `Asiento: ${pureSeat}`;

  return {
    rowText,
    tableText,
    seatText,
    formattedText: formatSeatAssignment(seat)
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
