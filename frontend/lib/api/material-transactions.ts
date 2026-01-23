import { strapiApi, unwrapStrapiResponse, unwrapStrapiArrayResponse } from './strapi';
import type { StrapiResponse } from '@/types';

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

    params.append('populate', '*');
    params.append('sort', 'pickup_date:desc,used_date:desc,createdAt:desc');

    try {
      const response = await strapiApi.get<StrapiResponse<MaterialTransaction[]>>(`/material-transactions?${params.toString()}`);
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching material transactions:', error);
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
      const response = await strapiApi.post<StrapiResponse<MaterialTransaction>>('/material-transactions', { data });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message ||
          JSON.stringify(error.response.data) ||
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
