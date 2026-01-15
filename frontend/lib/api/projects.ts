import { strapiApi, unwrapStrapiResponse, unwrapStrapiArrayResponse } from './strapi';
import type { Project, StrapiResponse } from '@/types';

export interface ProjectFilters {
  status?: Project['status'];
  assigned_to?: number;
  tenant?: number;
  search?: string;
}

export const projectsApi = {
  getAll: async (filters?: ProjectFilters) => {
    const params = new URLSearchParams();
    
    if (filters?.status) {
      params.append('filters[status][$eq]', filters.status);
    }
    if (filters?.assigned_to) {
      params.append('filters[assigned_to][id][$eq]', filters.assigned_to.toString());
    }
    if (filters?.tenant) {
      params.append('filters[tenant][id][$eq]', filters.tenant.toString());
    }
    if (filters?.search) {
      params.append('filters[$or][0][client_name][$contains]', filters.search);
      params.append('filters[$or][1][client_address][$contains]', filters.search);
    }
    
    params.append('populate', '*');
    params.append('sort', 'createdAt:desc');
    
    try {
      const response = await strapiApi.get<StrapiResponse<Project[]>>(`/projects?${params.toString()}`);
      // Handle both Strapi v4 and v5 response formats
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
  },

  getOne: async (id: number | string) => {
    try {
      // Strapi v5 uses documentId, but we can try both
      const response = await strapiApi.get<StrapiResponse<Project>>(`/projects/${id}?populate=*`);
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Try with documentId if regular id doesn't work
        console.error('Project not found with id:', id);
        throw new Error(`Projekt nem található (ID: ${id})`);
      }
      throw error;
    }
  },

  create: async (data: Partial<Project>) => {
    try {
      const response = await strapiApi.post<StrapiResponse<Project>>('/projects', { data });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      // Részletesebb hibaüzenet
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a projekt létrehozása során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  update: async (id: number | string, data: Partial<Project>) => {
    try {
      const response = await strapiApi.put<StrapiResponse<Project>>(`/projects/${id}`, { data });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a projekt frissítése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  delete: async (id: number | string) => {
    try {
      await strapiApi.delete(`/projects/${id}`);
    } catch (error: any) {
      // Részletesebb hibaüzenet
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a projekt törlése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },
};
