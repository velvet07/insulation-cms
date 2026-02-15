// Strapi API Response Types
export interface StrapiResponse<T> {
  data: T;
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface StrapiEntity {
  id: number;
  documentId?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

// Company Types
export interface Company extends StrapiEntity {
  name: string;
  type: 'main_contractor' | 'subcontractor';
  is_active?: boolean;
  tax_number?: string;
  address?: string;
  billing_price_per_sqm?: number;
  parent_company?: Company;
  subcontractors?: Company[];
  user?: User[];
  projects?: Project[];
}

// User Role Types
export interface UserRole extends StrapiEntity {
  name: string;
  type: string;
  description?: string;
}

// User Types
export interface User extends StrapiEntity {
  email: string;
  username?: string;
  name?: string;
  phone?: string;
  confirmed?: boolean;
  blocked?: boolean;
  role?: UserRole | 'admin' | 'foovallalkozo' | 'alvallalkozo' | 'manager' | 'worker' | string;
  tenant?: Tenant;
  company?: Company;
}

// Tenant Types
export interface Tenant extends StrapiEntity {
  name: string;
  subdomain: string;
  mode: 'b2b' | 'standalone';
  export_structure_template?: Record<string, unknown>;
  material_norms?: Record<string, unknown>;
}

// Project Types
export interface Project extends StrapiEntity {
  client_name: string;
  client_address: string;
  client_phone?: string;
  client_email?: string;
  title: string;
  area_sqm?: number;
  status: 'pending' | 'in_progress' | 'scheduled' | 'execution_completed' | 'ready_for_review' | 'sent_back_for_revision' | 'approved' | 'completed' | 'archived';
  insulation_option?: 'A' | 'B';
  assigned_to?: User;
  tenant?: Tenant;
  company?: Company;
  subcontractor?: Company;
  scheduled_date?: string;
  documents_generated_count?: number;
  billing_amount?: number;
  completed_at?: string;
  approved_at?: string;
  started_at?: string;
  approved_by?: User;
  revision_notes?: string; // Jegyzet a visszaküldés javításra esetén
  sent_back_at?: string; // Dátum amikor visszaküldték javításra
  sent_back_by?: User; // Ki küldte vissza javításra
  // Szerződés adatok
  client_street?: string; // Utca, házszám
  client_city?: string; // Város
  client_zip?: string; // IRSZ
  client_birth_place?: string; // Születési hely
  client_birth_date?: string; // Születési idő
  client_mother_name?: string; // Anyja neve
  client_tax_id?: string; // Adóazonosító
  property_address_same?: boolean; // Az ingatlan címe megegyezik a szerződő címével?
  property_street?: string; // Ingatlan utca, házszám
  property_city?: string; // Ingatlan város
  property_zip?: string; // Ingatlan IRSZ
  property_hrsz?: string; // Helyrajzi szám
  floor_material?: 'wood' | 'prefab_rc' | 'monolithic_rc' | 'rc_slab' | 'hollow_block' | 'other'; // Padlásfödém anyaga
  floor_material_extra?: string; // Egyéb födém anyaga
  hem_value?: string; // HEM érték (GJ)
  audit_log?: ProjectAuditLogEntry[]; // Audit log az események követésére
}

// Project Audit Log Types
export interface ProjectAuditLogEntry {
  action: 
    // Projekt modul
    | 'project_created' 
    | 'project_modified' 
    | 'project_deleted'
    // Szerződés adatok modul
    | 'contract_data_filled' 
    | 'contract_data_modified'
    // Dokumentumok modul
    | 'document_generated' 
    | 'document_modified'
    | 'document_deleted'
    | 'document_signed'
    | 'document_uploaded'
    // Fényképek modul
    | 'photo_uploaded' 
    | 'photo_deleted'
    | 'photo_category_changed'
    // Státusz modul
    | 'status_changed'
    // Anyagok modul
    | 'material_added'
    | 'material_removed'
    | 'material_modified'
    // Naptár modul (jövőbeli)
    | 'scheduled_date_set'
    | 'scheduled_date_modified';
  timestamp: string;
  user?: {
    email?: string;
    username?: string;
  };
  details?: string; // További részletek (pl. modul neve, régi/új értékek)
  module?: string; // Modul neve (pl. 'Szerződés adatok', 'Dokumentumok', 'Fényképek', stb.)
}

// Digital Signature Types (eIDAS/AES PAdES)
export interface DigitalSignatureRecord {
  signer_role: 'contractor' | 'client';
  signer_name: string;
  signer_email: string;
  signed_at: string;
  certificate_fingerprint: string;
  document_hash_before_sign: string;
  visual_signature_included: boolean;
}

export interface PadesSignRequest {
  documentId: string | number;
  signerRole: 'contractor' | 'client';
  signerName: string;
  signerEmail: string;
  companyName?: string;
  visualSignature?: string; // base64 PNG
}

export interface SignatureVerificationResult {
  valid: boolean;
  signatures: Array<{
    signer_name: string;
    signer_email: string;
    signer_role: string;
    signed_at: string;
    certificate_valid: boolean;
    certificate_fingerprint: string;
    document_integrity: boolean;
    visual_signature_included: boolean;
  }>;
  document_status: string;
  verification_date: string;
}

// Document Types
export type DocumentType = 
  | 'felmerolap'
  | 'vallalkozasi_szerzodes'
  | 'megallapodas'
  | 'szerzodes_energiahatékonysag'
  | 'adatkezelesi_hozzajarulas'
  | 'teljesitesi_igazolo'
  | 'munkaterul_atadas'
  | 'other';

export interface Document extends StrapiEntity {
  type: DocumentType;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  signed: boolean;
  requires_signature?: boolean;
  /** Generáláskor a sablon DOCX alapján; ha nincs (régi doc), a template mezők számítanak. */
  requires_signature1?: boolean;
  requires_signature2?: boolean;
  signature_data?: string | { signature1: string; signature2: string }; // Base64 encoded image (single) vagy objektum (dual)
  signed_at?: string;
  digital_signatures?: DigitalSignatureRecord[];
  signature_version?: 'legacy_visual' | 'pades_aes';
  project?: Project;
  company?: Company | string | number | null; // Tulajdonos (céges dokumentum); null = nincs beállítva
  uploaded_by?: User;
  template?: Template;
  file?: {
    url?: string;
    name?: string;
    size?: number;
  };
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  felmerolap: 'Felmérőlap',
  vallalkozasi_szerzodes: 'Vállalkozási szerződés',
  megallapodas: 'Megállapodás',
  szerzodes_energiahatékonysag: 'Szerződés energiahatékonyság-javító intézkedési munkálatokra',
  adatkezelesi_hozzajarulas: 'Adatkezelési hozzájárulás nyilatkozat',
  teljesitesi_igazolo: 'Teljesítésit igazoló jegyzőkönyv (TIG)',
  munkaterul_atadas: 'Munkaterül átadás-átvételi jegyzőkönyv',
  other: 'Egyéb',
};

// Template Types
export type TemplateType = 
  | 'felmerolap'
  | 'vallalkozasi_szerzodes'
  | 'megallapodas'
  | 'szerzodes_energiahatékonysag'
  | 'adatkezelesi_hozzajarulas'
  | 'teljesitesi_igazolo'
  | 'munkaterul_atadas'
  | 'other';

export interface Template extends StrapiEntity {
  name: string;
  type: TemplateType;
  template_file?: string | {
    id?: number;
    documentId?: string;
    name?: string;
    url?: string;
    size?: number;
  };
  tokens?: string[]; // Elérhető tokenek listája
  tenant?: Tenant;
  company?: Company | string | number; // Fővállalkozó (main_contractor)
  /** Ha false, a sablonban nincs {%signature1} – csak ügyfél aláír. Alapértelmezett true. */
  require_signature1?: boolean;
  /** Ha false, a sablonban nincs {%signature2} – csak fővállalkozó aláír. Alapértelmezett true. */
  require_signature2?: boolean;
}

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  felmerolap: 'Felmérőlap',
  vallalkozasi_szerzodes: 'Vállalkozási szerződés',
  megallapodas: 'Megállapodás',
  szerzodes_energiahatékonysag: 'Szerződés energiahatékonyság-javító intézkedési munkálatokra',
  adatkezelesi_hozzajarulas: 'Adatkezelési hozzájárulás nyilatkozat',
  teljesitesi_igazolo: 'Teljesítésit igazoló jegyzőkönyv (TIG)',
  munkaterul_atadas: 'Munkaterül átadás-átvételi jegyzőkönyv',
  other: 'Egyéb',
};

// Billing Record Types
export interface BillingRecord extends StrapiEntity {
  billing_month: string; // "2025-01"
  area_sqm: number;
  document_count: number;
  amount_net: number;
  amount_vat: number;
  amount_gross: number;
  generated_at: string;
  invoice_generated: boolean;
  invoice_number?: string;
  tenant?: Tenant;
  project?: Project;
}

// Calendar Event Types
export interface CalendarEvent extends StrapiEntity {
  scheduled_date: string;
  start_time?: string;
  end_time?: string;
  assigned_to?: User[];
  materials_required?: Record<string, unknown>;
  status: 'planned' | 'in_progress' | 'completed';
  notes?: string;
  tenant?: Tenant;
  project?: Project;
}

// Material Types
export interface Material extends StrapiEntity {
  category: 'insulation' | 'vapor_barrier' | 'breathable_membrane';
  thickness_cm?: 'cm10' | 'cm12_5' | 'cm15' | null;
  coverage_per_roll?: number;
  rolls_per_pallet?: number;
  name: string;
  current_stock?: Record<string, unknown>;
  tenant?: Tenant;
}

// Material Transaction Types
export interface MaterialTransaction extends StrapiEntity {
  type: 'pickup' | 'usage';
  pickup_date?: string;
  delivery_note?: string;
  quantity_pallets?: number;
  quantity_rolls?: number;
  project?: Project;
  used_date?: string;
  calculated_usage?: Record<string, unknown>;
  notes?: string;
  tenant?: Tenant;
  user?: User;
  material?: Material;
}

// Material Balance Types
export interface MaterialBalance extends StrapiEntity {
  total_picked_up?: Record<string, unknown>;
  total_used?: Record<string, unknown>;
  balance?: Record<string, unknown>;
  status: 'surplus' | 'balanced' | 'deficit';
  user?: User;
  material?: Material;
}

// Photo Category Types
export interface PhotoCategory extends StrapiEntity {
  name: string;
  slug?: string;
  order?: number;
  required?: boolean;
  tenant?: Tenant;
}

// Photo Types
export interface Photo extends StrapiEntity {
  name?: string;
  file?: {
    id?: number;
    documentId?: string;
    name?: string;
    url?: string;
    mime?: string;
    size?: number;
    width?: number;
    height?: number;
    formats?: {
      thumbnail?: {
        url?: string;
        width?: number;
        height?: number;
      };
      small?: {
        url?: string;
        width?: number;
        height?: number;
      };
      medium?: {
        url?: string;
        width?: number;
        height?: number;
      };
      large?: {
        url?: string;
        width?: number;
        height?: number;
      };
    };
  };
  category?: PhotoCategory;
  project?: Project;
  uploaded_by?: User;
  order?: number;
}
