import { strapiApi, unwrapStrapiResponse, unwrapStrapiArrayResponse } from './strapi';
import type { Project, StrapiResponse } from '@/types';

export interface ProjectFilters {
  status?: Project['status'];
  assigned_to?: number | string; // Support both numeric id and documentId (Strapi v5)
  tenant?: number;
  company?: number | string;
  search?: string;
}

export const projectsApi = {
  getAll: async (filters?: ProjectFilters) => {
    const params = new URLSearchParams();
    
    if (filters?.status) {
      params.append('filters[status][$eq]', filters.status);
    }
    if (filters?.assigned_to) {
      // Strapi v5 uses documentId, try both id and documentId
      const assignedToId = filters.assigned_to.toString();
      // Check if it's a documentId (Strapi v5 documentIds are typically long strings, may or may not contain hyphens)
      // If it's longer than 10 characters or contains hyphens, treat as documentId
      // Numeric IDs are typically short (1-9 digits)
      if (assignedToId.length > 10 || assignedToId.includes('-') || isNaN(Number(assignedToId))) {
        // It's a documentId (string)
        params.append('filters[assigned_to][documentId][$eq]', assignedToId);
      } else {
        // It's a numeric id
        params.append('filters[assigned_to][id][$eq]', assignedToId);
      }
    }
    if (filters?.tenant) {
      params.append('filters[tenant][id][$eq]', filters.tenant.toString());
    }
    if (filters?.company) {
      // Strapi v5 uses documentId, try both id and documentId
      const companyId = filters.company.toString();
      if (companyId.includes('-')) {
        // It's a documentId
        params.append('filters[company][documentId][$eq]', companyId);
      } else {
        // It's a numeric id
        params.append('filters[company][id][$eq]', companyId);
      }
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
      // Szűrjük ki az undefined értékeket ÉS a rendszer mezőket (amiket nem lehet frissíteni)
      const systemFields = ['id', 'documentId', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'];
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([key, value]) => 
          value !== undefined && !systemFields.includes(key)
        )
      );
      
      console.log('Updating project with ID:', id);
      console.log('Update data:', cleanData);
      
      const response = await strapiApi.put<StrapiResponse<Project>>(`/projects/${id}`, { data: cleanData });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      console.error('Full error object:', error);
      console.error('Error response:', error.response);
      console.error('Error response status:', error.response?.status);
      console.error('Error response headers:', error.response?.headers);
      
      if (error.response) {
        console.error('Strapi API Error - response.data:', error.response.data);
        console.error('Strapi API Error - response.status:', error.response.status);
        console.error('Strapi API Error - response.statusText:', error.response.statusText);
        console.error('Request data sent:', data);
        console.error('Request URL:', `/projects/${id}`);
        
        // Próbáljuk meg kinyerni a pontos hibaüzenetet
        if (error.response.data?.error) {
          console.error('Strapi API Error - error object:', error.response.data.error);
          if (error.response.data.error.message) {
            console.error('Strapi API Error - error message:', error.response.data.error.message);
          }
          if (error.response.data.error.details) {
            console.error('Strapi API Error - error details:', error.response.data.error.details);
          }
        }
        
        // Részletesebb hibaüzenet
        let errorMessage = 'Hiba történt a projekt frissítése során';
        
        // Próbáljuk meg kinyerni a hibaüzenetet különböző helyekről
        if (error.response.data?.error?.message) {
          errorMessage = error.response.data.error.message;
        } else if (error.response.data?.error) {
          errorMessage = typeof error.response.data.error === 'string' 
            ? error.response.data.error 
            : JSON.stringify(error.response.data.error);
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        } else if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data && Object.keys(error.response.data).length > 0) {
          errorMessage = JSON.stringify(error.response.data);
        } else {
          // Ha üres az error.response.data, nézzük meg a status kódot
          if (error.response.status === 400) {
            errorMessage = 'Érvénytelen adatok (400 Bad Request). Ellenőrizd, hogy minden mező helyes-e.';
          } else if (error.response.status === 404) {
            errorMessage = 'Projekt nem található (404 Not Found)';
          } else if (error.response.status === 403) {
            errorMessage = 'Nincs jogosultság a projekt frissítéséhez (403 Forbidden)';
          } else if (error.response.status === 401) {
            errorMessage = 'Hitelesítési hiba (401 Unauthorized)';
          } else {
            errorMessage = `Hiba történt (${error.response.status}): ${error.response.statusText || 'Ismeretlen hiba'}`;
          }
        }
        
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
