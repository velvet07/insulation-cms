import type { Project } from '@/types';
import { formatPhoneNumber } from '@/lib/utils';

interface CalendarEventData {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Google Calendar export URL generálása
 */
export function generateGoogleCalendarUrl(data: CalendarEventData): string {
  const start = formatDateForCalendar(data.startDate);
  const end = formatDateForCalendar(data.endDate);
  
  // URLSearchParams automatikusan encode-olja az értékeket, nem kell encodeURIComponent
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: data.title,
    details: data.description,
    location: data.location,
    dates: `${start}/${end}`,
  });
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Apple Calendar export URL generálása (ics fájl letöltéshez)
 */
export function generateAppleCalendarUrl(data: CalendarEventData): string {
  const icsContent = generateICSContent(data);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  return url;
}

/**
 * ICS fájl tartalom generálása
 */
function generateICSContent(data: CalendarEventData): string {
  const formatDateForICS = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  const start = formatDateForICS(data.startDate);
  const end = formatDateForICS(data.endDate);
  const now = formatDateForICS(new Date());
  
  // ICS fájl formátum
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Insulation CRM//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `DTSTAMP:${now}`,
    `SUMMARY:${escapeICSValue(data.title)}`,
    `DESCRIPTION:${escapeICSValue(data.description)}`,
    `LOCATION:${escapeICSValue(data.location)}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * ICS fájlban használt értékek escape-elése
 */
function escapeICSValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, ' '); // Newline karaktereket szóközre cseréljük az ICS fájlban
}

/**
 * Dátum formázása naptár exportokhoz (YYYYMMDDTHHMMSS)
 */
function formatDateForCalendar(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Projektből naptár esemény adatok generálása
 */
export function generateCalendarEventFromProject(project: Project): CalendarEventData {
  const scheduledDate = project.scheduled_date 
    ? new Date(project.scheduled_date) 
    : new Date();
  
  // Alapértelmezett időtartam: 8:00-16:00
  const startDate = new Date(scheduledDate);
  startDate.setHours(8, 0, 0, 0);
  
  const endDate = new Date(scheduledDate);
  endDate.setHours(16, 0, 0, 0);
  
  // Leírás összeállítása
  const descriptionParts: string[] = [];
  
  if (project.client_name) {
    descriptionParts.push(`Név: ${project.client_name}`);
  }
  if (project.client_phone) {
    const formattedPhone = formatPhoneNumber(project.client_phone);
    descriptionParts.push(`Telefonszám: ${formattedPhone}`);
  }
  if (project.client_email) {
    descriptionParts.push(`Email: ${project.client_email}`);
  }
  if (project.area_sqm) {
    descriptionParts.push(`Négyzetméter: ${project.area_sqm} m²`);
  }
  if (project.floor_material) {
    const floorMaterialLabels: Record<string, string> = {
      wood: 'Fa',
      prefab_rc: 'Előre gyártott vb. (betongerendás)',
      monolithic_rc: 'Monolit v.b.',
      rc_slab: 'Vasbeton tálcás',
      hollow_block: 'Horcsik',
      other: project.floor_material_extra || 'Egyéb',
    };
    descriptionParts.push(`Födém típus: ${floorMaterialLabels[project.floor_material] || project.floor_material}`);
  }
  
  const description = descriptionParts.join('\n');
  
  // Cím összeállítása
  let location = project.client_address || '';
  if (project.property_street && project.property_city && project.property_zip) {
    location = `${project.property_zip} ${project.property_city}, ${project.property_street}`;
  } else if (project.client_street && project.client_city && project.client_zip) {
    location = `${project.client_zip} ${project.client_city}, ${project.client_street}`;
  }
  
  return {
    title: project.title || `Projekt: ${project.client_name || 'Névtelen'}`,
    description,
    location,
    startDate,
    endDate,
  };
}

/**
 * Apple Calendar fájl letöltése
 */
export function downloadAppleCalendarFile(data: CalendarEventData, filename: string = 'event.ics'): void {
  const icsContent = generateICSContent(data);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Cleanup
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
