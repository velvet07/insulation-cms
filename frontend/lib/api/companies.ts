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

    params.append('populate', '*');
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

  getOne: async (id: number | string) => {
    try {
      const response = await strapiApi.get<StrapiResponse<Company>>(`/companies/${id}?populate=*`);
      return unwrapStrapiResponse(response);
    } catch (error: any) {
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
