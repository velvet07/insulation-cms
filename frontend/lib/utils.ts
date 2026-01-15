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
