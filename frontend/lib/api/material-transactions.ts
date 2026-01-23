import { strapiApi, unwrapStrapiResponse, unwrapStrapiArrayResponse } from './strapi';
import type { StrapiResponse } from '@/types';

type CompanyIdentifiers = { id?: number; documentId?: string };
const companyIdentifiersCache = new Map<string, CompanyIdentifiers>();

async function resolveCompanyIdentifiers(companyId: number | string): Promise<CompanyIdentifiers> {
  const key = companyId.toString();
  const cached = companyIdentifiersCache.get(key);
  if (cached) return cached;

  // If it's a numeric id, store it immediately
  if (/^\d+$/.test(key)) {
    const numeric = parseInt(key, 10);
    const identifiers: CompanyIdentifiers = { id: numeric };
    companyIdentifiersCache.set(key, identifiers);
    return identifiers;
  }

  try {
    const { companiesApi } = await import('./companies');
    const company = await companiesApi.getOne(key);
    const identifiers: CompanyIdentifiers = { id: company?.id, documentId: company?.documentId };
    companyIdentifiersCache.set(key, identifiers);
    return identifiers;
  } catch {
    const identifiers: CompanyIdentifiers = { documentId: key };
    companyIdentifiersCache.set(key, identifiers);
    return identifiers;
  }
}

export interface MaterialTransaction {
  id?: number;
  documentId?: string;
  type: 'pickup' | 'usage';
  pickup_date?: string;
  used_date?: string;
  material?: any;
  user?: any;
  company?: any;
  project?: any;
  quantity_pallets?: number;
  quantity_rolls?: number;
  delivery_note?: any;
  calculated_usage?: Record<string, any>;
  notes?: string;
  tenant?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface MaterialTransactionFilters {
  user?: number | string;
  company?: number | string;
  material?: number | string;
  type?: MaterialTransaction['type'];
  project?: number | string;
  pickup_date?: {
    $gte?: string;
    $lte?: string;
    $eq?: string;
  };
  used_date?: {
    $gte?: string;
    $lte?: string;
    $eq?: string;
  };
}

export const materialTransactionsApi = {
  getAll: async (filters?: MaterialTransactionFilters) => {
    const params = new URLSearchParams();
    const companyIdentifiers = filters?.company ? await resolveCompanyIdentifiers(filters.company) : null;

    if (filters?.user) {
      const userId = filters.user.toString();
      if (userId.includes('-') || userId.length > 10 || isNaN(Number(userId))) {
        params.append('filters[user][documentId][$eq]', userId);
      } else {
        params.append('filters[user][id][$eq]', userId);
      }
    }
    if (filters?.company) {
      // Prefer numeric id filtering; if Strapi rejects, we'll fall back to alternate approaches.
      if (companyIdentifiers?.id !== undefined) {
        params.append('filters[company][id][$eq]', companyIdentifiers.id.toString());
      } else if (companyIdentifiers?.documentId) {
        params.append('filters[company][documentId][$eq]', companyIdentifiers.documentId);
      }
    }
    if (filters?.material) {
      const materialId = filters.material.toString();
      if (materialId.includes('-') || materialId.length > 10 || isNaN(Number(materialId))) {
        params.append('filters[material][documentId][$eq]', materialId);
      } else {
        params.append('filters[material][id][$eq]', materialId);
      }
    }
    if (filters?.type) {
      params.append('filters[type][$eq]', filters.type);
    }
    if (filters?.project) {
      const projectId = filters.project.toString();
      if (projectId.includes('-') || projectId.length > 10 || isNaN(Number(projectId))) {
        params.append('filters[project][documentId][$eq]', projectId);
      } else {
        params.append('filters[project][id][$eq]', projectId);
      }
    }
    if (filters?.pickup_date?.$gte) {
      params.append('filters[pickup_date][$gte]', filters.pickup_date.$gte);
    }
    if (filters?.pickup_date?.$lte) {
      params.append('filters[pickup_date][$lte]', filters.pickup_date.$lte);
    }
    if (filters?.pickup_date?.$eq) {
      params.append('filters[pickup_date][$eq]', filters.pickup_date.$eq);
    }
    if (filters?.used_date?.$gte) {
      params.append('filters[used_date][$gte]', filters.used_date.$gte);
    }
    if (filters?.used_date?.$lte) {
      params.append('filters[used_date][$lte]', filters.used_date.$lte);
    }
    if (filters?.used_date?.$eq) {
      params.append('filters[used_date][$eq]', filters.used_date.$eq);
    }

    // Try multiple approaches, starting with simplest and working up
    // Since Strapi v5 often rejects complex populate/sort formats, we start simple
    const attempts = [
      // Attempt 1: No parameters at all (most compatible, but may not populate relations)
      () => {
        return '/material-transactions';
      },
      // Attempt 2: Just populate=* (most compatible with relations)
      () => {
        return '/material-transactions?populate=*';
      },
      // Attempt 3: With simple sort
      () => {
        return '/material-transactions?populate=*&sort=createdAt:desc';
      },
      // Attempt 4: With filters (if any), simple populate
      () => {
        if (params.toString()) {
          const filteredParams = new URLSearchParams(params);
          filteredParams.append('populate', '*');
          return `/material-transactions?${filteredParams.toString()}`;
        }
        return null; // Skip if no filters
      },
      // Attempt 5: With filters and sort
      () => {
        if (params.toString()) {
          const filteredParams = new URLSearchParams(params);
          filteredParams.append('populate', '*');
          filteredParams.append('sort', 'createdAt:desc');
          return `/material-transactions?${filteredParams.toString()}`;
        }
        return null; // Skip if no filters
      },
    ];

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      try {
        const apiUrl = attempt();
        if (!apiUrl) continue; // Skip null attempts
        
        const response = await strapiApi.get<StrapiResponse<MaterialTransaction[]>>(apiUrl);
        let items: any[] = [];
        if (response.data && Array.isArray(response.data.data)) {
          items = response.data.data;
        } else if (Array.isArray(response.data)) {
          items = response.data;
        }
        
        // If we got data, check if relations are populated
        // If first attempt (no params) worked but relations might be missing, try populate=* too
        if (items.length > 0) {
          const hasRelations = items.some((item: any) => 
            item.user || item.material || item.company
          );
          
          // If no relations and this was the first attempt, try populate=* next
          if (!hasRelations && i === 0 && attempts.length > 1) {
            continue; // Try next attempt with populate=*
          }
          
          // Return data if we have it (with or without relations)
          return items;
        }
        
        // If no data but this was the first attempt, try next
        if (i === 0 && attempts.length > 1) {
          continue;
        }
        
        // No data and not first attempt, return empty
        return [];
      } catch (error) {
        const err: any = error;
        const status = err?.response?.status;
        // If it's not a 400, or if this is the last attempt, return empty
        if (status !== 400) {
          // Non-400 error (401, 403, 500, etc.) - don't retry
          if (i === attempts.length - 1) {
            return [];
          }
          continue;
        }
        // 400 error - try next attempt
        if (i === attempts.length - 1) {
          // Last attempt failed - return empty to avoid console spam
          return [];
        }
        continue; // Try next attempt
      }
    }

    // If all attempts failed, return empty array
    return [];

      console.error('Error fetching material transactions:', {
        status,
        url: `/material-transactions?${baseParams.toString()}`,
        details,
      });
      throw error;
    }
  },

  getOne: async (id: number | string) => {
    try {
      const response = await strapiApi.get<StrapiResponse<MaterialTransaction>>(`/material-transactions/${id}?populate=*`);
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Anyag tranzakció nem található (ID: ${id})`);
      }
      throw error;
    }
  },

  create: async (data: Partial<MaterialTransaction>) => {
    try {
      const normalizeRelations = (input: any) => {
        const out: any = { ...input };
        // Relations/media fields that Strapi v5 commonly expects via connect syntax
        const relationKeys = ['company', 'material', 'user', 'project', 'tenant', 'delivery_note'];
        relationKeys.forEach((key) => {
          const value = out[key];
          if (value === undefined) return;
          if (value === null) return;
          if (typeof value === 'object') return; // already in connect/set form
          out[key] = { connect: [value] };
        });
        return out;
      };

      const normalized = normalizeRelations(data);
      const post = (payload: any) =>
        strapiApi.post<StrapiResponse<MaterialTransaction>>('/material-transactions', { data: payload });

      const isInvalidKeyCompany = (err: any) => {
        const message = err?.response?.data?.error?.message || err?.message || '';
        const messageStr = typeof message === 'string' ? message.toLowerCase() : '';
        return messageStr.includes('invalid key company') || messageStr.includes('invalid key') && messageStr.includes('company');
      };

      // 1) Try Strapi v5 connect syntax
      try {
        const response = await post(normalized);
        return unwrapStrapiResponse(response);
      } catch (error1: any) {
        // If backend schema doesn't accept company yet, retry without it (keeps pickup usable).
        if (isInvalidKeyCompany(error1) && 'company' in normalized) {
          const retryData = { ...normalized };
          delete retryData.company;
          const retryResponse = await post(retryData);
          return unwrapStrapiResponse(retryResponse);
        }

        // 2) Fallback: try legacy scalar relation payload
        try {
          const response2 = await post(data);
          return unwrapStrapiResponse(response2);
        } catch (error2: any) {
          if (isInvalidKeyCompany(error2) && (data as any)?.company !== undefined) {
            const retryData2: any = { ...(data as any) };
            delete retryData2.company;
            const retryResponse2 = await post(retryData2);
            return unwrapStrapiResponse(retryResponse2);
          }
          throw error2;
        }
      }
    } catch (error: any) {
      if (error.response) {
        const strapiError = error.response.data?.error;
        const errorMessage = strapiError?.message ||
          strapiError?.details?.message ||
          error.response.data?.message ||
          (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data)) ||
          'Hiba történt az anyag tranzakció létrehozása során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  update: async (id: number | string, data: Partial<MaterialTransaction>) => {
    try {
      const systemFields = ['id', 'documentId', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'];

      const cleanData: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue;
        if (systemFields.includes(key)) continue;

        if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          if ('documentId' in value || 'id' in value || 'createdAt' in value) {
            continue;
          }
        }

        cleanData[key] = value;
      }

      const response = await strapiApi.put<StrapiResponse<MaterialTransaction>>(`/material-transactions/${id}`, { data: cleanData });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message ||
          JSON.stringify(error.response.data) ||
          'Hiba történt az anyag tranzakció frissítése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  delete: async (id: number | string) => {
    try {
      await strapiApi.delete(`/material-transactions/${id}`);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message ||
          JSON.stringify(error.response.data) ||
          'Hiba történt az anyag tranzakció törlése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  getPickupsByUser: async (userId: number | string) => {
    return materialTransactionsApi.getAll({ user: userId, type: 'pickup' });
  },

  getPickupsByCompany: async (companyId: number | string) => {
    return materialTransactionsApi.getAll({ company: companyId, type: 'pickup' });
  },

  getByCompany: async (companyId: number | string) => {
    return materialTransactionsApi.getAll({ company: companyId });
  },
};
