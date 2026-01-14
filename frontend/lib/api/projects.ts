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
    
    const response = await strapiApi.get<StrapiResponse<Project[]>>(`/projects?${params.toString()}`);
    return unwrapStrapiArrayResponse(response);
  },

  getOne: async (id: number | string) => {
    const response = await strapiApi.get<StrapiResponse<Project>>(`/projects/${id}?populate=*`);
    return unwrapStrapiResponse(response);
  },

  create: async (data: Partial<Project>) => {
    const response = await strapiApi.post<StrapiResponse<Project>>('/projects', { data });
    return unwrapStrapiResponse(response);
  },

  update: async (id: number | string, data: Partial<Project>) => {
    const response = await strapiApi.put<StrapiResponse<Project>>(`/projects/${id}`, { data });
    return unwrapStrapiResponse(response);
  },

  delete: async (id: number | string) => {
    await strapiApi.delete(`/projects/${id}`);
  },
};
