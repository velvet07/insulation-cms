import { strapiApi, unwrapStrapiResponse, unwrapStrapiArrayResponse } from './strapi';
import type { PhotoCategory, StrapiResponse } from '@/types';

export interface PhotoCategoryFilters {
  tenant?: number;
}

export const photoCategoriesApi = {
  getAll: async (filters?: PhotoCategoryFilters) => {
    const params = new URLSearchParams();
    
    if (filters?.tenant) {
      params.append('filters[tenant][id][$eq]', filters.tenant.toString());
    }
    
    params.append('populate', '*');
    params.append('sort', 'order:asc,name:asc');
    
    try {
      const response = await strapiApi.get<StrapiResponse<PhotoCategory[]>>(`/photo-categories?${params.toString()}`);
      return unwrapStrapiArrayResponse(response);
    } catch (error) {
      console.error('Error fetching photo categories:', error);
      throw error;
    }
  },

  getOne: async (id: number | string) => {
    try {
      const response = await strapiApi.get<StrapiResponse<PhotoCategory>>(`/photo-categories/${id}?populate=*`);
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Fénykép kategória nem található (ID: ${id})`);
      }
      throw error;
    }
  },

  create: async (data: Partial<PhotoCategory>) => {
    try {
      const response = await strapiApi.post<StrapiResponse<PhotoCategory>>('/photo-categories', { data });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a kategória létrehozása során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  update: async (id: number | string, data: Partial<PhotoCategory>) => {
    try {
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined)
      );
      
      const response = await strapiApi.put<StrapiResponse<PhotoCategory>>(`/photo-categories/${id}`, { data: cleanData });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a kategória frissítése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  delete: async (id: number | string) => {
    try {
      await strapiApi.delete(`/photo-categories/${id}`);
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a kategória törlése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },
};