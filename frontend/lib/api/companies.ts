import { strapiApi, unwrapStrapiResponse, unwrapStrapiArrayResponse } from './strapi';
import type { Company, StrapiResponse } from '@/types';

export interface CompanyFilters {
  type?: Company['type'];
  parent_company?: number;
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
        params.append('filters[parent_company][id][$eq]', filters.parent_company.toString());
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
      console.log('🏢 [COMPANY API] getOne called with id:', id, 'populate:', populate);
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
      console.log('📡 [COMPANY API] Calling:', apiUrl);

      const response = await strapiApi.get<StrapiResponse<Company>>(apiUrl);
      const unwrapped = unwrapStrapiResponse(response);

      console.log('✅ [COMPANY API] Response received:', {
        id: unwrapped?.id,
        documentId: unwrapped?.documentId,
        name: unwrapped?.name,
        type: unwrapped?.type,
        hasSubcontractors: !!(unwrapped as any)?.subcontractors,
        subcontractorsCount: (unwrapped as any)?.subcontractors?.length || 0
      });

      if ((unwrapped as any)?.subcontractors) {
        console.log('📋 [COMPANY API] Subcontractors:', (unwrapped as any).subcontractors);
      }

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
