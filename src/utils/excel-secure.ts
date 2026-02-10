/**
 * Utilitaire sécurisé pour lecture/écriture Excel (exceljs).
 * Remplace xlsx (SheetJS) pour éviter les vulnérabilités sans correctif.
 */

import ExcelJS from 'exceljs';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 100000;
const MAX_COLS = 1000;

export function validateExcelFile(file: { size?: number; name?: string; type?: string }): void {
  if (file.size && file.size > MAX_FILE_SIZE) {
    throw new Error(`Fichier trop volumineux. Maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
  ];
  if (file.type && !validTypes.includes(file.type) && !file.name?.match(/\.(xlsx|xls|csv)$/i)) {
    throw new Error('Format de fichier non supporté. Formats acceptés: .xlsx, .xls, .csv');
  }
  if (file.name && /[<>:"|?*\x00-\x1f]/.test(file.name)) {
    throw new Error('Nom de fichier invalide');
  }
}

/** Convertit un ArrayBuffer/Uint8Array en base64 (compatible React Native) */
function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  if (typeof btoa !== 'undefined') return btoa(binary);
  throw new Error('Impossible d\'encoder en base64 (Buffer/btoa indisponibles)');
}

/**
 * Exporte un tableau d'objets en fichier Excel (base64).
 */
export async function writeExcelFromJson(data: any[], sheetName: string): Promise<string> {
  if (!Array.isArray(data) || data.length === 0) throw new Error('Les données sont vides');
  if (data.length > MAX_ROWS) throw new Error(`Trop de lignes (maximum: ${MAX_ROWS})`);
  const firstKeys = Object.keys(data[0] || {});
  if (firstKeys.length > MAX_COLS) throw new Error(`Trop de colonnes (maximum: ${MAX_COLS})`);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31), { properties: {} });
  sheet.addRow(firstKeys);
  data.forEach((row) => sheet.addRow(firstKeys.map((k) => row[k])));
  const buffer = await workbook.xlsx.writeBuffer();
  return bufferToBase64(buffer as ArrayBuffer);
}

/**
 * Lit un fichier Excel (base64) et retourne les lignes de la première feuille en JSON.
 */
export async function readExcelFromBase64(base64: string): Promise<any[]> {
  const workbook = new ExcelJS.Workbook();
  const binary = typeof atob !== 'undefined' ? atob(base64) : (() => { throw new Error('atob indisponible'); })();
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  await workbook.xlsx.load(buf.buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Fichier Excel invalide ou vide');
  if (sheet.rowCount > MAX_ROWS) throw new Error(`Trop de lignes (maximum: ${MAX_ROWS})`);
  const rows: any[] = [];
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    const v = cell.value;
    headers[colNumber - 1] = v != null ? String(v) : `Col${colNumber}`;
  });
  for (let i = 2; i <= (sheet.rowCount || 0); i++) {
    const row = sheet.getRow(i);
    const obj: Record<string, any> = {};
    headers.forEach((h, idx) => {
      const cell = row.getCell(idx + 1);
      obj[h] = cell.value != null ? cell.value : '';
    });
    rows.push(obj);
  }
  return rows;
}

/**
 * Parse une chaîne CSV en tableau d'objets (première ligne = en-têtes).
 */
export function parseCSVToJson(csvContent: string): any[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < csvContent.length; i++) {
    const c = csvContent[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (c === '\r' && csvContent[i + 1] === '\n') i++;
      lines.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  if (current) lines.push(current);

  const parseRow = (row: string): string[] => {
    const out: string[] = [];
    let cell = '';
    let inQ = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') {
        inQ = !inQ;
      } else if ((c === ',' || c === ';') && !inQ) {
        out.push(cell.trim());
        cell = '';
      } else {
        cell += c;
      }
    }
    out.push(cell.trim());
    return out;
  };

  if (lines.length < 2) return [];
  const headers = parseRow(lines[0]);
  const result: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => {
      obj[h] = values[j] ?? '';
    });
    result.push(obj);
  }
  return result;
}
