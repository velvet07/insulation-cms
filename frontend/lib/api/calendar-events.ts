import { strapiApi, unwrapStrapiResponse, unwrapStrapiArrayResponse } from './strapi';
import type { CalendarEvent, StrapiResponse } from '@/types';

export interface CalendarEventFilters {
  scheduled_date?: {
    $gte?: string;
    $lte?: string;
    $eq?: string;
  };
  project?: number | string;
  assigned_to?: number | string;
  status?: CalendarEvent['status'];
}

export const calendarEventsApi = {
  getAll: async (filters?: CalendarEventFilters) => {
    const params = new URLSearchParams();
    
    if (filters?.scheduled_date?.$gte) {
      params.append('filters[scheduled_date][$gte]', filters.scheduled_date.$gte);
    }
    if (filters?.scheduled_date?.$lte) {
      params.append('filters[scheduled_date][$lte]', filters.scheduled_date.$lte);
    }
    if (filters?.scheduled_date?.$eq) {
      params.append('filters[scheduled_date][$eq]', filters.scheduled_date.$eq);
    }
    if (filters?.project) {
      const projectId = filters.project.toString();
      if (projectId.includes('-') || projectId.length > 10 || isNaN(Number(projectId))) {
        params.append('filters[project][documentId][$eq]', projectId);
      } else {
        params.append('filters[project][id][$eq]', projectId);
      }
    }
    if (filters?.assigned_to) {
      const assignedToId = filters.assigned_to.toString();
      if (assignedToId.length > 10 || assignedToId.includes('-') || isNaN(Number(assignedToId))) {
        params.append('filters[assigned_to][documentId][$eq]', assignedToId);
      } else {
        params.append('filters[assigned_to][id][$eq]', assignedToId);
      }
    }
    if (filters?.status) {
      params.append('filters[status][$eq]', filters.status);
    }
    
    params.append('populate', '*');
    params.append('sort', 'scheduled_date:asc');
    
    try {
      const response = await strapiApi.get<StrapiResponse<CalendarEvent[]>>(`/calendar-events?${params.toString()}`);
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw error;
    }
  },

  getOne: async (id: number | string) => {
    try {
      const response = await strapiApi.get<StrapiResponse<CalendarEvent>>(`/calendar-events/${id}?populate=*`);
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Naptár esemény nem található (ID: ${id})`);
      }
      throw error;
    }
  },

  create: async (data: Partial<CalendarEvent>) => {
    try {
      const response = await strapiApi.post<StrapiResponse<CalendarEvent>>('/calendar-events', { data });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a naptár esemény létrehozása során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  update: async (id: number | string, data: Partial<CalendarEvent>) => {
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
      
      const response = await strapiApi.put<StrapiResponse<CalendarEvent>>(`/calendar-events/${id}`, { data: cleanData });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        let errorMessage = 'Hiba történt a naptár esemény frissítése során';
        
        if (error.response.data?.error?.message) {
          errorMessage = error.response.data.error.message;
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        }
        
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  delete: async (id: number | string) => {
    try {
      await strapiApi.delete(`/calendar-events/${id}`);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a naptár esemény törlése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },
};
