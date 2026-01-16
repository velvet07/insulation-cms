import type { Project } from '@/types';

/**
 * Tokenek, amik elérhetőek a dokumentum sablonokban
 */
export interface DocumentTokens {
  // Ügyfél adatok
  client_name?: string;
  client_address?: string;
  client_street?: string;
  client_city?: string;
  client_zip?: string;
  client_phone?: string;
  client_email?: string;
  
  // Születési adatok
  client_birth_place?: string;
  client_birth_date?: string;
  client_mother_name?: string;
  client_tax_id?: string;
  
  // Ingatlan adatok
  property_address?: string;
  property_street?: string;
  property_city?: string;
  property_zip?: string;
  property_address_same?: boolean;
  
  // Projekt adatok
  project_title?: string;
  area_sqm?: number;
  floor_material?: string;
  floor_material_extra?: string;
  insulation_option?: string;
  
  // Dátumok
  date?: string; // Aktuális dátum
  created_at?: string;
  updated_at?: string;
}

/**
 * Projekt adataiból készít token objektumot
 */
export function createTokensFromProject(project: Project): DocumentTokens {
  // Ügyfél cím összeállítása
  const clientAddress = project.client_zip && project.client_city && project.client_street
    ? `${project.client_zip} ${project.client_city}, ${project.client_street}`
    : project.client_address || '';

  // Ingatlan cím összeállítása
  const propertyAddress = project.property_address_same === true
    ? clientAddress
    : (project.property_zip && project.property_city && project.property_street
        ? `${project.property_zip} ${project.property_city}, ${project.property_street}`
        : clientAddress);

  // Födém anyaga szöveges formátum
  const floorMaterialLabels: Record<string, string> = {
    wood: 'Fa',
    prefab_rc: 'Előre gyártott vb. (betongerendás)',
    monolithic_rc: 'Monolit v.b.',
    rc_slab: 'Vasbeton tálcás',
    hollow_block: 'Horcsik',
    other: project.floor_material_extra || 'Egyéb',
  };
  const floorMaterial = project.floor_material
    ? floorMaterialLabels[project.floor_material] || project.floor_material
    : '';

  // Szigetelési opció szöveges formátum
  const insulationOptionLabels: Record<string, string> = {
    A: 'Opció A: 10 cm + 15 cm = 25 cm',
    B: 'Opció B: 12,5 cm + 12,5 cm = 25 cm',
  };
  const insulationOption = project.insulation_option
    ? insulationOptionLabels[project.insulation_option] || project.insulation_option
    : '';

  // Dátum formázás
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return {
    // Ügyfél adatok
    client_name: project.client_name || '',
    client_address: clientAddress,
    client_street: project.client_street || '',
    client_city: project.client_city || '',
    client_zip: project.client_zip || '',
    client_phone: project.client_phone || '',
    client_email: project.client_email || '',
    
    // Születési adatok
    client_birth_place: project.client_birth_place || '',
    client_birth_date: project.client_birth_date
      ? formatDate(project.client_birth_date)
      : '',
    client_mother_name: project.client_mother_name || '',
    client_tax_id: project.client_tax_id || '',
    
    // Ingatlan adatok
    property_address: propertyAddress,
    property_street: project.property_street || '',
    property_city: project.property_city || '',
    property_zip: project.property_zip || '',
    property_address_same: project.property_address_same || false,
    
    // Projekt adatok
    project_title: project.title || '',
    area_sqm: project.area_sqm || 0,
    floor_material: floorMaterial,
    floor_material_extra: project.floor_material_extra || '',
    insulation_option: insulationOption,
    
    // Dátumok
    date: new Date().toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    created_at: formatDate(project.createdAt),
    updated_at: formatDate(project.updatedAt),
  };
}

/**
 * Helyettesíti a tokeneket egy szövegben
 * Formátum: {token_name}
 */
export function replaceTokens(text: string, tokens: DocumentTokens): string {
  let result = text;
  
  // Helyettesítjük az összes tokent
  Object.entries(tokens).forEach(([key, value]) => {
    const tokenPattern = new RegExp(`\\{${key}\\}`, 'g');
    const stringValue = value !== undefined && value !== null ? String(value) : '';
    result = result.replace(tokenPattern, stringValue);
  });
  
  return result;
}

/**
 * Elérhető tokenek listája (UI-hoz)
 */
export const AVAILABLE_TOKENS = [
  { key: 'client_name', label: 'Ügyfél neve', description: 'Az ügyfél teljes neve' },
  { key: 'client_address', label: 'Ügyfél címe', description: 'Teljes cím (IRSZ, város, utca)' },
  { key: 'client_street', label: 'Ügyfél utca, házszám', description: 'Utca és házszám' },
  { key: 'client_city', label: 'Ügyfél város', description: 'Város neve' },
  { key: 'client_zip', label: 'Ügyfél IRSZ', description: 'Irányítószám' },
  { key: 'client_phone', label: 'Telefonszám', description: 'Ügyfél telefonszáma' },
  { key: 'client_email', label: 'Email cím', description: 'Ügyfél email címe' },
  { key: 'client_birth_place', label: 'Születési hely', description: 'Ahol az ügyfél született' },
  { key: 'client_birth_date', label: 'Születési idő', description: 'Születési dátum' },
  { key: 'client_mother_name', label: 'Anyja neve', description: 'Az ügyfél anyja neve' },
  { key: 'client_tax_id', label: 'Adóazonosító', description: '10 számjegyű adóazonosító' },
  { key: 'property_address', label: 'Ingatlan címe', description: 'Teljes ingatlan cím' },
  { key: 'property_street', label: 'Ingatlan utca, házszám', description: 'Ingatlan utca és házszám' },
  { key: 'property_city', label: 'Ingatlan város', description: 'Ingatlan város neve' },
  { key: 'property_zip', label: 'Ingatlan IRSZ', description: 'Ingatlan irányítószám' },
  { key: 'project_title', label: 'Projekt címe', description: 'A projekt teljes címe' },
  { key: 'area_sqm', label: 'Terület (m²)', description: 'A padlás alapterülete négyzetméterben' },
  { key: 'floor_material', label: 'Födém anyaga', description: 'A padlásfödém anyaga' },
  { key: 'insulation_option', label: 'Szigetelési opció', description: 'A választott szigetelési opció' },
  { key: 'date', label: 'Aktuális dátum', description: 'A mai dátum' },
  { key: 'created_at', label: 'Létrehozás dátuma', description: 'A projekt létrehozásának dátuma' },
  { key: 'updated_at', label: 'Módosítás dátuma', description: 'A projekt utolsó módosításának dátuma' },
];
