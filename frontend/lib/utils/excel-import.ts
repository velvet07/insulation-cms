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
  // NOTE: 'title' lesz automatikusan generálva, nem kell az XLSX-ben
  { key: 'client_name', label: 'Szerződő neve', required: true, type: 'string', description: 'A szerződő fél teljes neve' },
  { key: 'client_email', label: 'Email cím', required: false, type: 'email' },
  { key: 'client_phone', label: 'Telefonszám', required: false, type: 'string' },
  { key: 'client_zip', label: 'IRSZ', required: false, type: 'string' },
  { key: 'client_city', label: 'Város', required: false, type: 'string' },
  { key: 'client_street', label: 'Utca, házszám', required: false, type: 'string' },
  { key: 'property_hrsz', label: 'Helyrajzi szám', required: false, type: 'string' },
  { key: 'client_birth_place', label: 'Születési hely', required: false, type: 'string' },
  { key: 'client_birth_date', label: 'Születési idő', required: false, type: 'date' },
  { key: 'client_mother_name', label: 'Anyja neve', required: false, type: 'string' },
  { key: 'client_tax_id', label: 'Adóazonosító', required: false, type: 'string' },
  { key: 'property_zip', label: 'Ingatlan IRSZ', required: false, type: 'string' },
  { key: 'property_city', label: 'Ingatlan város', required: false, type: 'string' },
  { key: 'property_street', label: 'Ingatlan Utca, házszám', required: false, type: 'string' },
  { key: 'area_sqm', label: 'Padlás alapterülete (m²)', required: false, type: 'number', description: 'Padlásfödém területe négyzetméterben' },
  {
    key: 'floor_material',
    label: 'Padlásfödém anyaga',
    required: false,
    type: 'enum',
    enumValues: ['wood', 'prefab_rc', 'monolithic_rc', 'rc_slab', 'hollow_block', 'other'],
    description: 'Fa, Előre gyártott vb. (betongerendás), Monolit v.b., Vasbeton tálcás, Horcsik, Egyéb'
  },
  { key: 'floor_material_extra', label: 'Egyéb födém', required: false, type: 'string' },
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
 * Ellenőrzi, hogy egy sor magyarázó sor-e
 * (ha legalább 3 cellában szerepel a "formátum", "példa", "értékek", "kötelező" szavak egyike)
 */
function isDescriptionRow(row: any[]): boolean {
  if (!Array.isArray(row)) return false;
  
  const keywords = ['formátum', 'példa', 'értékek', 'kötelező', 'format', 'example', 'values', 'required', 'leírás', 'description'];
  const matchCount = row.filter(cell => {
    const str = String(cell || '').toLowerCase();
    return str && keywords.some(kw => str.includes(kw));
  }).length;
  
  return matchCount >= 3;
}

/**
 * Sheet adatainak kiolvasása
 * A 2. sort kihagyja, ha magyarázó sor
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
  
  // Ellenőrizzük a 2. sort, hogy magyarázó sor-e
  let dataStartIndex = 1;
  if (jsonData.length > 1 && isDescriptionRow(jsonData[1] as any[])) {
    console.log('2. sor magyarázó sor - kihagyva');
    dataStartIndex = 2;
  }
  
  const rows = jsonData.slice(dataStartIndex).map((row: any) => {
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

  // Mapping szabályok (magyar és angol kulcsszavak) - új formátum alapján
  const mappingRules: Record<string, string[]> = {
    client_name: ['szerződő neve', 'ügyfél', 'client', 'megrendelő', 'customer', 'tulajdonos', 'owner', 'név'],
    client_email: ['email', 'e-mail', 'mail', 'e-mail cím'],
    client_phone: ['telefon', 'phone', 'tel', 'mobil', 'mobile', 'telefonszám'],
    client_zip: ['irsz', 'irányítószám', 'zip', 'postal'],
    client_city: ['város', 'city', 'település', 'town'],
    client_street: ['utca', 'street', 'házszám', 'utca, házszám'],
    property_hrsz: ['helyrajzi', 'hrsz', 'helyrajzi szám'],
    client_birth_place: ['születési hely', 'birth place', 'szül. hely'],
    client_birth_date: ['születési dátum', 'születési idő', 'birth date', 'szül. dátum', 'születési'],
    client_mother_name: ['anyja neve', 'mother', 'anya neve', 'anyja'],
    client_tax_id: ['adószám', 'adóazonosító', 'tax', 'tax id'],
    property_zip: ['ingatlan irsz', 'property zip', 'ingatlan irányítószám'],
    property_city: ['ingatlan város', 'property city'],
    property_street: ['ingatlan utca', 'property street', 'ingatlan utca, házszám'],
    area_sqm: ['padlás alapterülete', 'alapterület'],
    floor_material: ['padlásfödém anyaga', 'födém anyaga'],
    floor_material_extra: ['egyéb födém'],
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
 * Magyar födém anyag mapping
 * Zárójeles és zárójel nélküli verziók is
 */
const FLOOR_MATERIAL_MAPPING: Record<string, string> = {
  'fa': 'wood',
  'wood': 'wood',
  'előre gyártott vb': 'prefab_rc',
  'előre gyártott vb.': 'prefab_rc',
  'előre gyártott vb. (betongerendás)': 'prefab_rc',
  'előre gyártott vb (betongerendás)': 'prefab_rc',
  'előre gyártott vasbeton': 'prefab_rc',
  'betongerendás': 'prefab_rc',
  'prefab_rc': 'prefab_rc',
  'monolit v.b': 'monolithic_rc',
  'monolit v.b.': 'monolithic_rc',
  'monolit vasbeton': 'monolithic_rc',
  'monolithic_rc': 'monolithic_rc',
  'vasbeton tálcás': 'rc_slab',
  'vasbeton lemez': 'rc_slab',
  'rc_slab': 'rc_slab',
  'horcsik': 'hollow_block',
  'üreges blokk': 'hollow_block',
  'hollow_block': 'hollow_block',
  'egyéb': 'other',
  'other': 'other',
};

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
          // DD.MM.YYYY formátum kezelése
          if (format === dateFormats[2]) {
            const [_, day, month, year] = match;
            const dateStr = `${year}-${month}-${day}`;
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
              return d.toISOString().split('T')[0];
            }
          } else {
            // Próbáljuk értelmezni
            const d = new Date(strValue.replace(/\./g, '-'));
            if (!isNaN(d.getTime())) {
              return d.toISOString().split('T')[0];
            }
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
      // Speciális kezelés floor_material mezőhöz
      if (field.key === 'floor_material') {
        const normalized = strValue.toLowerCase().trim();
        const mapped = FLOOR_MATERIAL_MAPPING[normalized];
        return mapped || null;
      }
      
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
 * Projekt név generálása az ügyfél neve és város alapján
 * Formátum: Név - Település - yyyy mmdd hhmmss
 */
export function generateProjectTitle(clientName: string, city: string, customTimestamp?: string): string {
  let identifier: string;
  
  if (customTimestamp) {
    identifier = customTimestamp;
  } else {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    identifier = `${year} ${month}${day} ${hours}${minutes}${seconds}`;
  }

  return `${clientName} - ${city} - ${identifier}`;
}

/**
 * Következő egyedi időbélyeg generálása
 * Ha az azonosító már létezik, az utolsó számot lépteti (201711 -> 201712)
 */
export function generateUniqueTimestamp(baseTimestamp: string, existingTimestamps: Set<string>): string {
  if (!existingTimestamps.has(baseTimestamp)) {
    return baseTimestamp;
  }

  // Utolsó 2 szám kinyerése és léptetése
  const parts = baseTimestamp.split(' ');
  if (parts.length === 3) {
    const lastPart = parts[2]; // hhmmss
    let counter = parseInt(lastPart, 10);
    
    // Léptetés, amíg nem találunk egyedi azonosítót
    while (true) {
      counter++;
      const newLastPart = String(counter).padStart(6, '0');
      const newTimestamp = `${parts[0]} ${parts[1]} ${newLastPart}`;
      
      if (!existingTimestamps.has(newTimestamp)) {
        return newTimestamp;
      }
    }
  }

  return baseTimestamp;
}

/**
 * Sor validálása és konvertálása
 * Automatikusan generálja a projekt nevét egyedi időbélyeggel
 */
export function validateAndConvertRow(
  rowData: Record<string, any>,
  mapping: ColumnMapping[],
  rowIndex: number,
  timestamp: string
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

  // Projekt név automatikus generálása egyedi időbélyeggel
  const clientName = convertedData.client_name || 'Névtelen';
  const city = convertedData.client_city || convertedData.property_city || 'Ismeretlen';
  convertedData.title = generateProjectTitle(clientName, city, timestamp);

  // client_address generálása a kompatibilitás miatt
  if (convertedData.client_street && convertedData.client_city && convertedData.client_zip) {
    convertedData.client_address = `${convertedData.client_zip} ${convertedData.client_city}, ${convertedData.client_street}`;
  }

  // area_sqm alapértelmezett érték, ha nincs megadva
  if (!convertedData.area_sqm) {
    convertedData.area_sqm = 0;
  }

  return {
    rowIndex,
    data: convertedData,
    errors,
    warnings,
    isValid: errors.length === 0,
  };
}

/**
 * Teljes import előnézet generálása egyedi időbélyegekkel
 */
export function generatePreview(
  rows: Record<string, any>[],
  mapping: ColumnMapping[]
): PreviewRow[] {
  // Alap időbélyeg generálása
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const baseTimestamp = `${year} ${month}${day} ${hours}${minutes}${seconds}`;

  // Már használt időbélyegek nyilvántartása
  const usedTimestamps = new Set<string>();

  return rows.map((row, index) => {
    // Egyedi időbélyeg generálása
    const uniqueTimestamp = generateUniqueTimestamp(baseTimestamp, usedTimestamps);
    usedTimestamps.add(uniqueTimestamp);

    return validateAndConvertRow(row, mapping, index + 2, uniqueTimestamp); // +2 mert 1-indexelt + fejléc sor
  });
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

/**
 * Minta Excel sablon generálása és letöltése
 * Tartalmazza az összes mezőt, leírásokat és példa adatokat
 */
export function downloadImportTemplate(): void {
  // Fejléc sor - mező címkék (kötelező mezők *-gal jelölve)
  const headers = IMPORTABLE_FIELDS.map(f => f.required ? `${f.label} *` : f.label);

  // Leírás sor - magyarázatok minden mezőhöz
  const descriptions = IMPORTABLE_FIELDS.map(f => {
    let desc = f.description || '';
    if (f.key === 'floor_material') {
      desc = 'Értékek: Fa, Előre gyártott vb. (betongerendás), Monolit v.b., Vasbeton tálcás, Horcsik, Egyéb';
    }
    if (f.type === 'date') {
      desc = (desc ? desc + ' - ' : '') + 'Formátum: ÉÉÉÉ-HH-NN';
    }
    if (f.type === 'number') {
      desc = (desc ? desc + ' - ' : '') + 'Szám';
    }
    if (f.type === 'email') {
      desc = (desc ? desc + ' - ' : '') + 'E-mail formátum';
    }
    if (f.required) {
      desc = (desc ? desc + ' - ' : '') + 'KÖTELEZŐ';
    }
    return desc;
  });

  // Példa adatok - 3 minta sor
  const exampleRows = [
    [
      'Kovács János',
      'kovacs.janos@email.hu',
      '+36 30 123 4567',
      '1234',
      'Budapest',
      'Példa utca 1.',
      '12345/6',
      'Budapest',
      '1975-03-15',
      'Kovács Mária',
      '8123456789',
      '',
      '',
      '',
      '85',
      'Fa',
      '',
    ],
    [
      'Nagy Péter',
      'nagy.peter@gmail.com',
      '+36 20 987 6543',
      '5600',
      'Békéscsaba',
      'Kossuth u. 22.',
      '56789/1',
      'Gyula',
      '1982-08-22',
      'Kiss Erzsébet',
      '8987654321',
      '5600',
      'Békéscsaba',
      'Petőfi u. 5.',
      '62,5',
      'Előre gyártott vb. (betongerendás)',
      '',
    ],
    [
      'Szabó László',
      'szabo.laszlo@freemail.hu',
      '06-37-123-456',
      '3000',
      'Hatvan',
      'Rákóczi út 100.',
      '3000/123',
      'Hatvan',
      '1968.12.01.',
      'Tóth Anna',
      '',
      '',
      '',
      '',
      '120',
      'Monolit v.b.',
      '',
    ],
  ];

  // Worksheet létrehozása
  const wsData = [
    headers,
    descriptions,
    ...exampleRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Oszlopszélességek beállítása
  const colWidths = IMPORTABLE_FIELDS.map(f => {
    const labelLen = f.label.length;
    const descLen = (f.description || '').length;
    return { wch: Math.max(labelLen, descLen / 2, 15) };
  });
  ws['!cols'] = colWidths;

  // Fejléc sor formázása (félkövér) - XLSX nem támogatja közvetlenül, de a sheet struktúrában jelezhetjük
  // A valódi formázást a letöltés után Excel-ben kell alkalmazni

  // Workbook létrehozása
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Projektek');

  // Útmutató sheet hozzáadása
  const guideData = [
    ['PROJEKT IMPORT ÚTMUTATÓ'],
    [''],
    ['Ez a sablon fájl segít a projektek tömeges importálásában.'],
    [''],
    ['HASZNÁLAT:'],
    ['1. Töltse ki a "Projektek" munkalapot az adataival'],
    ['2. A *-gal jelölt mezők kötelezőek'],
    ['3. A 2. sor tartalmazza a mezők leírását - ezt NEM KÖTELEZŐ törölni, automatikusan kihagyja az import'],
    ['4. A 3-5. sorok példa adatok - ezeket törölje és írja át a saját adataira'],
    ['5. Mentse el a fájlt és töltse fel az import oldalon'],
    [''],
    ['AUTOMATIKUS MEZŐK:'],
    ['• Projekt neve - AUTOMATIKUSAN generálódik (formátum: Név - Település - yyyy mmdd hhmmss)'],
    ['• Azonosító - Automatikusan léptetődik, ha több projekt importálása ugyanabban a másodpercben történik (201711, 201712, 201713...)'],
    ['• Ügyfél címe - Automatikusan összeáll az IRSZ, Város és Utca mezőkből'],
    [''],
    ['KÖTELEZŐ MEZŐK:'],
    ['• Szerződő neve * - A szerződő fél teljes neve'],
    [''],
    ['DÁTUM FORMÁTUMOK (születési idő):'],
    ['• 1975-03-15 (ajánlott)'],
    ['• 1975.03.15.'],
    ['• 15.03.1975'],
    [''],
    ['FÖDÉM ANYAG ÉRTÉKEK (magyar nyelven):'],
    ['• Fa'],
    ['• Előre gyártott vb. (betongerendás)'],
    ['• Monolit v.b.'],
    ['• Vasbeton tálcás'],
    ['• Horcsik'],
    ['• Egyéb'],
    [''],
    ['TIPPEK:'],
    ['• A terület mezőben használhat vesszőt vagy pontot tizedesjelként'],
    ['• A telefonszám bármilyen formátumú lehet'],
    ['• Ha az ingatlan címe megegyezik az ügyfél címével, hagyja üresen az ingatlan mezőket'],
    ['• Az üres mezők nem okoznak hibát, az import folytatódik'],
  ];

  const wsGuide = XLSX.utils.aoa_to_sheet(guideData);
  wsGuide['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Útmutató');

  // Fájl letöltése
  XLSX.writeFile(wb, 'projekt_import_sablon.xlsx');
}
