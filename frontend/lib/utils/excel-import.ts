import * as XLSX from 'xlsx';
import type { Project } from '@/types';

// Importálható projekt mezők definíciója
export interface ImportableProjectField {
  key: keyof Project | string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'email' | 'enum' | 'boolean';
  enumValues?: string[];
  description?: string;
}

export const IMPORTABLE_FIELDS: ImportableProjectField[] = [
  { key: 'title', label: 'Projekt neve', required: true, type: 'string', description: 'A projekt megnevezése' },
  { key: 'client_name', label: 'Ügyfél neve', required: true, type: 'string', description: 'Az ügyfél teljes neve' },
  { key: 'client_address', label: 'Ügyfél címe (teljes)', required: true, type: 'string', description: 'Teljes cím egy mezőben' },
  { key: 'area_sqm', label: 'Terület (m²)', required: true, type: 'number', description: 'Padlásfödém területe négyzetméterben' },
  { key: 'client_street', label: 'Utca, házszám', required: false, type: 'string' },
  { key: 'client_city', label: 'Város', required: false, type: 'string' },
  { key: 'client_zip', label: 'Irányítószám', required: false, type: 'string' },
  { key: 'client_phone', label: 'Telefonszám', required: false, type: 'string' },
  { key: 'client_email', label: 'E-mail cím', required: false, type: 'email' },
  { key: 'client_birth_place', label: 'Születési hely', required: false, type: 'string' },
  { key: 'client_birth_date', label: 'Születési dátum', required: false, type: 'date' },
  { key: 'client_mother_name', label: 'Anyja neve', required: false, type: 'string' },
  { key: 'client_tax_id', label: 'Adószám', required: false, type: 'string' },
  { key: 'property_street', label: 'Ingatlan utca', required: false, type: 'string' },
  { key: 'property_city', label: 'Ingatlan város', required: false, type: 'string' },
  { key: 'property_zip', label: 'Ingatlan irányítószám', required: false, type: 'string' },
  {
    key: 'floor_material',
    label: 'Födém anyaga',
    required: false,
    type: 'enum',
    enumValues: ['wood', 'prefab_rc', 'monolithic_rc', 'rc_slab', 'hollow_block', 'other'],
    description: 'wood=fa, prefab_rc=előregyártott vasbeton, monolithic_rc=monolit vasbeton, rc_slab=vasbeton lemez, hollow_block=üreges blokk, other=egyéb'
  },
  { key: 'floor_material_extra', label: 'Födém anyaga (egyéb)', required: false, type: 'string' },
  {
    key: 'insulation_option',
    label: 'Szigetelés típusa',
    required: false,
    type: 'enum',
    enumValues: ['A', 'B'],
    description: 'A vagy B típusú szigetelés'
  },
  { key: 'scheduled_date', label: 'Ütemezett dátum', required: false, type: 'date' },
  { key: 'billing_amount', label: 'Számlázás összege', required: false, type: 'number' },
];

// Excel oszlop -> mező mapping típus
export interface ColumnMapping {
  excelColumn: string;
  projectField: string | null;
}

// Import előnézet sor típusa
export interface PreviewRow {
  rowIndex: number;
  data: Record<string, any>;
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

// Import eredmény típusa
export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

/**
 * Excel fájl beolvasása és sheet nevek visszaadása
 */
export function readExcelFile(file: File): Promise<{ workbook: XLSX.WorkBook; sheetNames: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        resolve({
          workbook,
          sheetNames: workbook.SheetNames,
        });
      } catch (error) {
        reject(new Error('Nem sikerült beolvasni az Excel fájlt. Ellenőrizze, hogy érvényes .xlsx vagy .xls fájl-e.'));
      }
    };
    reader.onerror = () => reject(new Error('Hiba történt a fájl olvasása közben.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Sheet adatainak kiolvasása
 */
export function getSheetData(workbook: XLSX.WorkBook, sheetName: string): { headers: string[]; rows: Record<string, any>[] } {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`A "${sheetName}" munkalap nem található.`);
  }

  // Első sor a fejléc
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    header: 1,
    raw: false,
    dateNF: 'yyyy-mm-dd'
  });

  if (jsonData.length < 2) {
    throw new Error('A munkalap üres vagy csak fejlécet tartalmaz.');
  }

  const headers = (jsonData[0] as any[]).map(h => String(h || '').trim());
  const rows = jsonData.slice(1).map((row: any) => {
    const rowObj: Record<string, any> = {};
    headers.forEach((header, index) => {
      if (header) {
        rowObj[header] = row[index];
      }
    });
    return rowObj;
  }).filter(row => Object.values(row).some(v => v !== undefined && v !== null && v !== ''));

  return { headers, rows };
}

/**
 * Automatikus oszlop mapping javasolt a fejlécek alapján
 */
export function suggestColumnMapping(headers: string[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];

  // Mapping szabályok (magyar és angol kulcsszavak)
  const mappingRules: Record<string, string[]> = {
    title: ['projekt', 'project', 'név', 'name', 'megnevezés', 'cím', 'title'],
    client_name: ['ügyfél', 'client', 'megrendelő', 'customer', 'tulajdonos', 'owner', 'név'],
    client_address: ['cím', 'address', 'lakcím', 'teljes cím'],
    area_sqm: ['terület', 'area', 'm2', 'm²', 'négyzetméter', 'sqm'],
    client_street: ['utca', 'street', 'házszám'],
    client_city: ['város', 'city', 'település', 'town'],
    client_zip: ['irányítószám', 'zip', 'postal', 'irsz'],
    client_phone: ['telefon', 'phone', 'tel', 'mobil', 'mobile'],
    client_email: ['email', 'e-mail', 'mail'],
    client_birth_place: ['születési hely', 'birth place', 'szül. hely'],
    client_birth_date: ['születési dátum', 'születési idő', 'birth date', 'szül. dátum'],
    client_mother_name: ['anyja neve', 'mother', 'anya neve'],
    client_tax_id: ['adószám', 'adóazonosító', 'tax', 'tax id'],
    property_street: ['ingatlan utca', 'property street'],
    property_city: ['ingatlan város', 'property city'],
    property_zip: ['ingatlan irsz', 'property zip'],
    floor_material: ['födém', 'floor', 'anyag'],
    insulation_option: ['szigetelés', 'insulation', 'opció', 'típus'],
    scheduled_date: ['ütemezés', 'scheduled', 'dátum', 'date', 'időpont'],
    billing_amount: ['összeg', 'amount', 'ár', 'price', 'számlázás'],
  };

  headers.forEach(header => {
    const normalizedHeader = header.toLowerCase().trim();
    let matchedField: string | null = null;

    for (const [field, keywords] of Object.entries(mappingRules)) {
      if (keywords.some(kw => normalizedHeader.includes(kw.toLowerCase()))) {
        matchedField = field;
        break;
      }
    }

    mappings.push({
      excelColumn: header,
      projectField: matchedField,
    });
  });

  return mappings;
}

/**
 * Érték konvertálása a megfelelő típusra
 */
function convertValue(value: any, field: ImportableProjectField): any {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const strValue = String(value).trim();

  switch (field.type) {
    case 'number':
      // Magyar formátum támogatása (vessző tizedesjel)
      const numStr = strValue.replace(/\s/g, '').replace(',', '.');
      const num = parseFloat(numStr);
      return isNaN(num) ? null : num;

    case 'date':
      // Különböző dátum formátumok kezelése
      if (value instanceof Date) {
        return value.toISOString().split('T')[0];
      }
      // Próbáljuk meg parse-olni
      const dateFormats = [
        /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
        /^(\d{4})\.(\d{2})\.(\d{2})\.?$/, // YYYY.MM.DD.
        /^(\d{2})\.(\d{2})\.(\d{4})\.?$/, // DD.MM.YYYY.
        /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY or MM/DD/YYYY
      ];

      for (const format of dateFormats) {
        const match = strValue.match(format);
        if (match) {
          // Próbáljuk értelmezni
          const d = new Date(strValue);
          if (!isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
          }
        }
      }
      // Fallback: Date parse
      const d = new Date(strValue);
      return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : null;

    case 'email':
      // Egyszerű email validáció
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(strValue) ? strValue : null;

    case 'enum':
      // Enum értékek egyeztetése (case-insensitive)
      if (field.enumValues) {
        const normalizedValue = strValue.toLowerCase();
        const match = field.enumValues.find(v => v.toLowerCase() === normalizedValue);
        return match || null;
      }
      return strValue;

    case 'boolean':
      const trueValues = ['igen', 'yes', 'true', '1', 'i', 'y'];
      const falseValues = ['nem', 'no', 'false', '0', 'n'];
      const lower = strValue.toLowerCase();
      if (trueValues.includes(lower)) return true;
      if (falseValues.includes(lower)) return false;
      return null;

    case 'string':
    default:
      return strValue;
  }
}

/**
 * Sor validálása és konvertálása
 */
export function validateAndConvertRow(
  rowData: Record<string, any>,
  mapping: ColumnMapping[],
  rowIndex: number
): PreviewRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  const convertedData: Record<string, any> = {};

  // Mapping alapján konvertálás
  mapping.forEach(({ excelColumn, projectField }) => {
    if (!projectField) return;

    const field = IMPORTABLE_FIELDS.find(f => f.key === projectField);
    if (!field) return;

    const rawValue = rowData[excelColumn];
    const convertedValue = convertValue(rawValue, field);

    if (field.required && (convertedValue === null || convertedValue === undefined || convertedValue === '')) {
      errors.push(`"${field.label}" mező kötelező, de hiányzik vagy érvénytelen`);
    } else if (rawValue && convertedValue === null) {
      warnings.push(`"${field.label}" mező értéke ("${rawValue}") nem megfelelő formátumú`);
    }

    if (convertedValue !== null && convertedValue !== undefined) {
      convertedData[projectField] = convertedValue;
    }
  });

  // Kötelező mezők ellenőrzése
  const requiredFields = IMPORTABLE_FIELDS.filter(f => f.required);
  requiredFields.forEach(field => {
    if (!convertedData[field.key] && !errors.some(e => e.includes(field.label))) {
      errors.push(`"${field.label}" mező kötelező`);
    }
  });

  return {
    rowIndex,
    data: convertedData,
    errors,
    warnings,
    isValid: errors.length === 0,
  };
}

/**
 * Teljes import előnézet generálása
 */
export function generatePreview(
  rows: Record<string, any>[],
  mapping: ColumnMapping[]
): PreviewRow[] {
  return rows.map((row, index) => validateAndConvertRow(row, mapping, index + 2)); // +2 mert 1-indexelt + fejléc sor
}

/**
 * Floor material magyar fordítása
 */
export const FLOOR_MATERIAL_LABELS: Record<string, string> = {
  wood: 'Fa',
  prefab_rc: 'Előregyártott vasbeton',
  monolithic_rc: 'Monolit vasbeton',
  rc_slab: 'Vasbeton lemez',
  hollow_block: 'Üreges blokk',
  other: 'Egyéb',
};
