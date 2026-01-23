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

    const baseParams = new URLSearchParams(params);
    // Strapi v5 nested populate format: populate[user][populate][company]=*
    baseParams.append('populate[user][populate][company]', '*');
    baseParams.append('populate', '*');
    // Strapi multi-sort format
    baseParams.append('sort[0]', 'pickup_date:desc');
    baseParams.append('sort[1]', 'used_date:desc');
    baseParams.append('sort[2]', 'createdAt:desc');

    try {
      const apiUrl = `/material-transactions?${baseParams.toString()}`;
      const response = await strapiApi.get<StrapiResponse<MaterialTransaction[]>>(apiUrl);
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

      // If Strapi rejects nested populate (400), try with simple populate=*
      if (status === 400 && baseParams.toString().includes('populate[user]')) {
        try {
          const simpleParams = new URLSearchParams(params);
          simpleParams.append('populate', '*');
          simpleParams.append('sort[0]', 'pickup_date:desc');
          simpleParams.append('sort[1]', 'used_date:desc');
          simpleParams.append('sort[2]', 'createdAt:desc');
          const simpleUrl = `/material-transactions?${simpleParams.toString()}`;
          const simpleResponse = await strapiApi.get<StrapiResponse<MaterialTransaction[]>>(simpleUrl);
          if (simpleResponse.data && Array.isArray(simpleResponse.data.data)) {
            return simpleResponse.data.data;
          }
          if (Array.isArray(simpleResponse.data)) {
            return simpleResponse.data;
          }
          return [];
        } catch (simpleError) {
          // Continue to fallback logic below
        }
      }

      // If Strapi rejects query params (common), retry with a minimal query.
      if (status === 400) {
        try {
          // 1) Keep filters, simplify sorting and populate
          const fallbackParams1 = new URLSearchParams(params);
          fallbackParams1.append('populate[user][populate][company]', '*');
          fallbackParams1.append('sort', 'createdAt:desc');
          const fallbackUrl1 = `/material-transactions?${fallbackParams1.toString()}`;
          const retry1 = await strapiApi.get<StrapiResponse<MaterialTransaction[]>>(fallbackUrl1);
          if (retry1.data && Array.isArray((retry1.data as any).data)) {
            return (retry1.data as any).data;
          }
          if (Array.isArray(retry1.data as any)) {
            return retry1.data as any;
          }

          // 2) Keep only filters
          const fallbackParams2 = new URLSearchParams(params);
          const fallbackUrl2 = `/material-transactions?${fallbackParams2.toString()}`;
          const retry2 = await strapiApi.get<StrapiResponse<MaterialTransaction[]>>(fallbackUrl2);
          if (retry2.data && Array.isArray((retry2.data as any).data)) {
            return (retry2.data as any).data;
          }
          if (Array.isArray(retry2.data as any)) {
            return retry2.data as any;
          }
          return [];
        } catch (error2) {
          // If filters are rejected, last resort: fetch without filters and filter client-side.
          try {
            const unfilteredUrl = '/material-transactions?populate[user][populate][company]=*&populate=*';
            const unfiltered = await strapiApi.get<StrapiResponse<MaterialTransaction[]>>(unfilteredUrl);
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
