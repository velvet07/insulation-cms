import { strapiApi, unwrapStrapiResponse, unwrapStrapiArrayResponse } from './strapi';
import type { StrapiResponse } from '@/types';

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

    if (filters?.user) {
      const userId = filters.user.toString();
      if (userId.includes('-') || userId.length > 10 || isNaN(Number(userId))) {
        params.append('filters[user][documentId][$eq]', userId);
      } else {
        params.append('filters[user][id][$eq]', userId);
      }
    }
    if (filters?.company) {
      const companyId = filters.company.toString();
      if (companyId.includes('-') || companyId.length > 10 || isNaN(Number(companyId))) {
        params.append('filters[company][documentId][$eq]', companyId);
      } else {
        params.append('filters[company][id][$eq]', companyId);
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

    params.append('populate', '*');
    params.append('sort', 'updatedAt:desc');

    try {
      const response = await strapiApi.get<StrapiResponse<MaterialBalance[]>>(`/material-balances?${params.toString()}`);
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching material balances:', error);
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
