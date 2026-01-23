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

export interface MaterialBalance {
  id?: number;
  documentId?: string;
  user?: any;
  company?: any;
  material?: any;
  total_picked_up?: {
    pallets?: number;
    rolls?: number;
  };
  total_used?: {
    pallets?: number;
    rolls?: number;
  };
  balance?: {
    pallets?: number;
    rolls?: number;
  };
  status?: 'surplus' | 'balanced' | 'deficit';
  createdAt?: string;
  updatedAt?: string;
}

export interface MaterialBalanceFilters {
  user?: number | string;
  company?: number | string;
  material?: number | string;
  status?: MaterialBalance['status'];
}

export const materialBalancesApi = {
  getAll: async (filters?: MaterialBalanceFilters) => {
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
    if (filters?.status) {
      params.append('filters[status][$eq]', filters.status);
    }

    const baseParams = new URLSearchParams(params);
    baseParams.append('populate', '*');
    baseParams.append('sort', 'updatedAt:desc');

    try {
      const apiUrl = `/material-balances?${baseParams.toString()}`;
      const response = await strapiApi.get<StrapiResponse<MaterialBalance[]>>(apiUrl);
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      const err: any = error;
      const status = err?.response?.status;
      const details = err?.response?.data;

      // If Strapi rejects query params (common), retry with a minimal query.
      if (status === 400) {
        try {
          const fallbackParams = new URLSearchParams(params);
          // no populate, no sort
          const fallbackUrl = `/material-balances?${fallbackParams.toString()}`;
          const retry = await strapiApi.get<StrapiResponse<MaterialBalance[]>>(fallbackUrl);
          if (retry.data && Array.isArray((retry.data as any).data)) {
            return (retry.data as any).data;
          }
          if (Array.isArray(retry.data as any)) {
            return retry.data as any;
          }
          return [];
        } catch (error2) {
          // If filters are rejected, last resort: fetch without filters and filter client-side.
          try {
            const unfilteredUrl = '/material-balances?populate=*';
            const unfiltered = await strapiApi.get<StrapiResponse<MaterialBalance[]>>(unfilteredUrl);
            const items: any[] = Array.isArray((unfiltered.data as any)?.data)
              ? (unfiltered.data as any).data
              : Array.isArray(unfiltered.data as any)
                ? (unfiltered.data as any)
                : [];

            if (companyIdentifiers) {
              const wantId = companyIdentifiers.id?.toString();
              const wantDoc = companyIdentifiers.documentId?.toString();
              return items.filter((it) => {
                const c = (it as any).company;
                const cid = c?.id?.toString();
                const cdoc = c?.documentId?.toString();
                return (wantId && cid === wantId) || (wantDoc && cdoc === wantDoc);
              });
            }

            return items as any;
          } catch {
            // If even that fails, return empty to avoid console spam in dev.
            return [];
          }
        }
      }

      console.error('Error fetching material balances:', {
        status,
        url: `/material-balances?${baseParams.toString()}`,
        details,
      });
      throw error;
    }
  },

  getOne: async (id: number | string) => {
    try {
      const response = await strapiApi.get<StrapiResponse<MaterialBalance>>(`/material-balances/${id}?populate=*`);
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Anyagegyenleg nem található (ID: ${id})`);
      }
      throw error;
    }
  },

  getByUser: async (userId: number | string) => {
    return materialBalancesApi.getAll({ user: userId });
  },

  getByCompany: async (companyId: number | string) => {
    return materialBalancesApi.getAll({ company: companyId });
  },
};
