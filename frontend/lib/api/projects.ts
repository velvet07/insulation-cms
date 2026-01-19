import { strapiApi, unwrapStrapiResponse, unwrapStrapiArrayResponse } from './strapi';
import type { Project, StrapiResponse } from '@/types';

export interface ProjectFilters {
  status?: Project['status'];
  assigned_to?: number | string; // Support both numeric id and documentId (Strapi v5)
  tenant?: number;
  company?: number | string;
  subcontractor?: number | string; // Support both numeric id and documentId (Strapi v5)
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
    if (filters?.subcontractor) {
      // Strapi v5 uses documentId, try both id and documentId
      const subcontractorId = filters.subcontractor.toString();
      if (subcontractorId.includes('-') || subcontractorId.length > 10 || isNaN(Number(subcontractorId))) {
        // It's a documentId (string)
        params.append('filters[subcontractor][documentId][$eq]', subcontractorId);
      } else {
        // It's a numeric id
        params.append('filters[subcontractor][id][$eq]', subcontractorId);
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
      
      // Mély szűrés: kiszűrjük a rendszer mezőket, de ellenőrizzük az objektumok belsejét is
      const cleanData: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Ne küldjük el undefined értékeket
        if (value === undefined) continue;
        
        // Ne küldjük el a rendszer mezőket
        if (systemFields.includes(key)) continue;
        
        // Ha az érték objektum, de nem relation mező (amit Strapi kezel), akkor ellenőrizzük
        // de csak akkor, ha nem egy egyszerű érték (string, number, boolean, null)
        if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          // Ha az objektum tartalmazza a documentId mezőt, akkor valószínűleg relation objektum
          // vagy nested objektum, amit nem szabad elküldeni így
          // A relation mezőket csak ID formában küldjük el, nem objektumként
          if ('documentId' in value || 'id' in value || 'createdAt' in value) {
            // Ez egy relation objektum vagy Strapi entitás - ne küldjük el így
            continue;
          }
        }
        
        cleanData[key] = value;
      }
      
      const response = await strapiApi.put<StrapiResponse<Project>>(`/projects/${id}`, { data: cleanData });
      // Ha a response null (404-es hiba volt, de az interceptor elnyelte), akkor null-lal térünk vissza
      if (!response || !response.data || !response.data.data) {
        return null as any;
      }
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      // 404-es hibák esetén ne dobjunk hibát - csendben kihagyjuk (projekt lehet törölve lett)
      if (error.response?.status === 404 || error._silent404) {
        // Visszatérünk null-lal, hogy a hívó oldalon tudja, hogy nem sikerült
        // De nem dobunk hibát, hogy ne jelenjen meg a konzolban
        return null as any;
      }
      
      if (error.response) {
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
