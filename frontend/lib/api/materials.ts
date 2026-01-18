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
};
