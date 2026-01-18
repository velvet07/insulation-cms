import { strapiApi, unwrapStrapiResponse, unwrapStrapiArrayResponse } from './strapi';
import type { StrapiResponse } from '@/types';

export interface Material {
  id?: number;
  documentId?: string;
  name: string;
  category: 'insulation' | 'vapor_barrier' | 'breathable_membrane';
  thickness_cm?: 'cm10' | 'cm12_5' | 'cm15';
  coverage_per_roll: number;
  rolls_per_pallet?: number;
  current_stock?: {
    pallets?: number;
    rolls?: number;
  };
  tenant?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface MaterialFilters {
  category?: Material['category'];
  tenant?: number | string;
}

export const materialsApi = {
  getAll: async (filters?: MaterialFilters) => {
    const params = new URLSearchParams();
    
    if (filters?.category) {
      params.append('filters[category][$eq]', filters.category);
    }
    if (filters?.tenant) {
      const tenantId = filters.tenant.toString();
      if (tenantId.includes('-') || tenantId.length > 10 || isNaN(Number(tenantId))) {
        params.append('filters[tenant][documentId][$eq]', tenantId);
      } else {
        params.append('filters[tenant][id][$eq]', tenantId);
      }
    }
    
    params.append('populate', '*');
    params.append('sort', 'category:asc,name:asc');
    
    try {
      const response = await strapiApi.get<StrapiResponse<Material[]>>(`/materials?${params.toString()}`);
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching materials:', error);
      throw error;
    }
  },

  getOne: async (id: number | string) => {
    try {
      const response = await strapiApi.get<StrapiResponse<Material>>(`/materials/${id}?populate=*`);
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Anyag nem található (ID: ${id})`);
      }
      throw error;
    }
  },

  create: async (data: Partial<Material>) => {
    try {
      const response = await strapiApi.post<StrapiResponse<Material>>('/materials', { data });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt az anyag létrehozása során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  update: async (id: number | string, data: Partial<Material>) => {
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
      
      const response = await strapiApi.put<StrapiResponse<Material>>(`/materials/${id}`, { data: cleanData });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt az anyag frissítése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  delete: async (id: number | string) => {
    try {
      await strapiApi.delete(`/materials/${id}`);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt az anyag törlése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },
};
