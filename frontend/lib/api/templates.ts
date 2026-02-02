import { strapiApi, unwrapStrapiResponse, unwrapStrapiArrayResponse } from './strapi';
import type { Template, StrapiResponse } from '@/types';

export interface TemplateFilters {
  type?: Template['type'];
  tenant?: number;
  company?: string | number;
}

export const templatesApi = {
  getAll: async (filters?: TemplateFilters) => {
    const params = new URLSearchParams();
    
    if (filters?.type) {
      params.append('filters[type][$eq]', filters.type);
    }
    if (filters?.tenant) {
      params.append('filters[tenant][id][$eq]', filters.tenant.toString());
    }
    if (filters?.company) {
      // Strapi v5: filter by company documentId or id
      params.append('filters[company][documentId][$eq]', filters.company.toString());
    }

    params.append('populate', '*');
    params.append('sort', 'name:asc');
    
    try {
      const response = await strapiApi.get<StrapiResponse<Template[]>>(`/templates?${params.toString()}`);
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }
  },

  getOne: async (id: number | string) => {
    try {
      const response = await strapiApi.get<StrapiResponse<Template>>(`/templates/${id}?populate=*`);
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Sablon nem található (ID: ${id})`);
      }
      throw error;
    }
  },

  uploadFile: async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('files', file);

      const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.emermedia.eu';
      const apiToken = process.env.NEXT_PUBLIC_STRAPI_API_TOKEN;

      const response = await fetch(`${strapiUrl}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || 'Fájl feltöltése sikertelen');
      }

      const data = await response.json();
      // Strapi v5 returns array of files
      if (Array.isArray(data)) {
        return data[0];
      }
      // Fallback for different response formats
      return data?.data?.[0] || data?.data || data;
    } catch (error: any) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },

  create: async (data: Partial<Template>, file?: File) => {
    try {
      let templateFileId: number | undefined;

      // Ha van fájl, először töltsük fel
      if (file) {
        const uploadedFile = await templatesApi.uploadFile(file);
        templateFileId = uploadedFile.id;
      }

      const templateData: any = {
        name: data.name,
        type: data.type,
        tokens: data.tokens || [],
      };

      if (templateFileId) {
        templateData.template_file = templateFileId;
      }

      // Fővállalkozóhoz kötés
      if (data.company) {
        templateData.company = data.company;
      }

      const response = await strapiApi.post<StrapiResponse<Template>>('/templates', { data: templateData });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        
        // Részletesebb hibaüzenet kinyerése
        let errorMessage = 'Hiba történt a sablon létrehozása során';
        
        if (error.response.data?.error?.message) {
          errorMessage = error.response.data.error.message;
        } else if (error.response.data?.error?.details?.errors) {
          // Strapi validation errors
          const errors = error.response.data.error.details.errors;
          const errorMessages = errors.map((err: any) => err.message || err.path).join(', ');
          errorMessage = errorMessages || errorMessage;
        } else if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        }
        
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  update: async (id: number | string, data: Partial<Template>, file?: File) => {
    try {
      let templateFileId: number | undefined;

      // Ha van fájl, először töltsük fel
      if (file) {
        const uploadedFile = await templatesApi.uploadFile(file);
        templateFileId = uploadedFile.id;
      }

      const cleanData: any = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined)
      );

      if (templateFileId) {
        cleanData.template_file = templateFileId;
      }
      
      const response = await strapiApi.put<StrapiResponse<Template>>(`/templates/${id}`, { data: cleanData });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a sablon frissítése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  delete: async (id: number | string) => {
    try {
      await strapiApi.delete(`/templates/${id}`);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a sablon törlése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },
};
