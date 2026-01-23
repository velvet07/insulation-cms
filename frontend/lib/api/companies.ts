import { strapiApi, unwrapStrapiResponse, unwrapStrapiArrayResponse } from './strapi';
import type { Company, StrapiResponse } from '@/types';
import { debugLog } from '@/lib/utils/debug-flag';

export interface CompanyFilters {
  type?: Company['type'];
  // Supports numeric id, Strapi v5 documentId, or 'null' to filter missing parent.
  parent_company?: number | string | 'null';
  search?: string;
}

export const companiesApi = {
  getAll: async (filters?: CompanyFilters) => {
    const params = new URLSearchParams();

    if (filters?.type) {
      params.append('filters[type][$eq]', filters.type);
    }
    if (filters?.parent_company) {
      if (filters.parent_company === 'null' as any) {
        params.append('filters[parent_company][id][$null]', 'true');
      } else {
        const parentCompanyId = filters.parent_company.toString();
        // Strapi v5 supports documentId filtering; using id with a documentId string can cause server errors.
        const looksLikeDocumentId =
          parentCompanyId.length > 10 || parentCompanyId.includes('-') || isNaN(Number(parentCompanyId));
        if (looksLikeDocumentId) {
          params.append('filters[parent_company][documentId][$eq]', parentCompanyId);
        } else {
          params.append('filters[parent_company][id][$eq]', parentCompanyId);
        }
      }
    }
    if (filters?.search) {
      params.append('filters[name][$contains]', filters.search);
    }

    // Don't populate parent_company to avoid circular references
    params.append('sort', 'name:asc');

    try {
      const response = await strapiApi.get<StrapiResponse<Company[]>>(`/companies?${params.toString()}`);
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching companies:', error);
      throw error;
    }
  },

  getOne: async (id: number | string, populate?: string | string[]) => {
    try {
      debugLog('companies', 'getOne called with id:', id, 'populate:', populate);
      const params = new URLSearchParams();
      if (populate) {
        if (Array.isArray(populate)) {
          populate.forEach((p, i) => params.append(`populate[${i}]`, p));
        } else {
          params.append('populate', populate);
        }
      }

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const apiUrl = `/companies/${id}${queryString}`;
      debugLog('companies', 'Calling:', apiUrl);

      const response = await strapiApi.get<StrapiResponse<Company>>(apiUrl);
      const unwrapped = unwrapStrapiResponse(response);

      debugLog('companies', 'Response received:', {
        id: unwrapped?.id,
        documentId: unwrapped?.documentId,
        name: unwrapped?.name,
        type: unwrapped?.type,
        hasSubcontractors: !!(unwrapped as any)?.subcontractors,
        subcontractorsCount: (unwrapped as any)?.subcontractors?.length || 0
      });

      // NOTE: avoid dumping full subcontractor arrays by default (too noisy)

      return unwrapped;
    } catch (error: any) {
      console.error('❌ [COMPANY API] Error:', error);
      if (error.response?.status === 404) {
        throw new Error(`Cég nem található (ID: ${id})`);
      }
      throw error;
    }
  },

  create: async (data: Partial<Company>) => {
    try {
      const response = await strapiApi.post<StrapiResponse<Company>>('/companies', { data });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message ||
          JSON.stringify(error.response.data) ||
          'Hiba történt a cég létrehozása során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  update: async (id: number | string, data: Partial<Company>) => {
    try {
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined)
      );

      const response = await strapiApi.put<StrapiResponse<Company>>(`/companies/${id}`, { data: cleanData });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message ||
          JSON.stringify(error.response.data) ||
          'Hiba történt a cég frissítése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  delete: async (id: number | string) => {
    try {
      await strapiApi.delete(`/companies/${id}`);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message ||
          'Hiba történt a cég törlése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },
};
