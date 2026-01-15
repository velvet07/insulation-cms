import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formázza a dátumot yyyy-mm-dd formátumban
 * @param date - Dátum string, Date objektum vagy undefined
 * @returns yyyy-mm-dd formátumú string vagy üres string
 */
export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return '';

  try {
    // Ha már yyyy-mm-dd formátumban van, térj vissza vele
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '';

    // Használj UTC dátumot, hogy ne legyen timezone probléma
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

/**
 * Formázza a telefonszámot +36 XX XXX XXXX formátumban
 * @param phone - Telefonszám string (lehet +36-tal vagy anélkül)
 * @returns Formázott telefonszám string vagy üres string
 */
export function formatPhoneNumber(phone: string | undefined | null): string {
  if (!phone) return '';

  // Távolítsuk el az összes nem szám karaktert (kivéve a + jelet az elején)
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Ha +36-tal kezdődik, távolítsuk el
  if (cleaned.startsWith('+36')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('36')) {
    cleaned = cleaned.substring(2);
  }
  
  // Csak számokat tartalmazhat
  cleaned = cleaned.replace(/\D/g, '');
  
  // Ha üres, térj vissza üres stringgel
  if (!cleaned) return '';
  
  // Formázás: +36 XX XXX XXXX
  // Első 2 számjegy (20, 30, 70, stb.)
  if (cleaned.length <= 2) {
    return `+36 ${cleaned}`;
  }
  // Első 2 + következő 3 számjegy
  if (cleaned.length <= 5) {
    return `+36 ${cleaned.substring(0, 2)} ${cleaned.substring(2)}`;
  }
  // Teljes formátum: +36 XX XXX XXXX
  if (cleaned.length <= 9) {
    return `+36 ${cleaned.substring(0, 2)} ${cleaned.substring(2, 5)} ${cleaned.substring(5)}`;
  }
  
  // Ha több mint 9 számjegy, vágjuk le
  return `+36 ${cleaned.substring(0, 2)} ${cleaned.substring(2, 5)} ${cleaned.substring(5, 9)}`;
}

/**
 * Eltávolítja a +36 előtagot és formázást a telefonszámból, csak a számokat hagyja meg
 * @param phone - Formázott telefonszám string
 * @returns Csak számokat tartalmazó string (a +36 nélkül)
 */
export function cleanPhoneNumber(phone: string | undefined | null): string {
  if (!phone) return '';
  
  // Távolítsuk el az összes nem szám karaktert
  let cleaned = phone.replace(/\D/g, '');
  
  // Ha 36-tal kezdődik, távolítsuk el
  if (cleaned.startsWith('36')) {
    cleaned = cleaned.substring(2);
  }
  
  return cleaned;
}
