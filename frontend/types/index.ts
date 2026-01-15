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

// User Types
export interface User extends StrapiEntity {
  email: string;
  username?: string;
  name?: string;
  phone?: string;
  role: 'admin' | 'foovallalkozo' | 'alvallalkozo' | 'manager' | 'worker';
  tenant?: Tenant;
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
  status: 'pending' | 'in_progress' | 'ready_for_review' | 'approved' | 'completed';
  insulation_option?: 'A' | 'B';
  assigned_to?: User;
  tenant?: Tenant;
  scheduled_date?: string;
  documents_generated_count?: number;
  billing_amount?: number;
  completed_at?: string;
  approved_at?: string;
  approved_by?: User;
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
  floor_material?: 'wood' | 'prefab_rc' | 'monolithic_rc' | 'rc_slab' | 'hollow_block' | 'other'; // Padlásfödém anyaga
  floor_material_extra?: string; // Egyéb födém anyaga
}

// Document Types
export interface Document extends StrapiEntity {
  type: 'contract' | 'worksheet' | 'invoice' | 'completion_certificate' | 'other';
  file_url?: string;
  file_name?: string;
  file_size?: number;
  signed: boolean;
  signature_data?: Record<string, unknown>;
  signed_at?: string;
  project?: Project;
  uploaded_by?: User;
}

// Template Types
export interface Template extends StrapiEntity {
  name: string;
  type: 'contract' | 'worksheet' | 'invoice';
  template_file?: string;
  tokens?: string[];
  tenant?: Tenant;
}

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
