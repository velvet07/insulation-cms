import { strapiApi, unwrapStrapiResponse, unwrapStrapiArrayResponse } from './strapi';
import type { Document, StrapiResponse } from '@/types';

export interface DocumentFilters {
  project?: number | string;
  type?: Document['type'];
  signed?: boolean;
}

export const documentsApi = {
  getAll: async (filters?: DocumentFilters) => {
    const params = new URLSearchParams();
    
    if (filters?.project) {
      // Strapi v5-ben a documentId-t használjuk, ha string, különben id-t
      // Próbáljuk meg mindkét formátumot
      const projectId = filters.project.toString();
      // Ha documentId formátum (string alfanumerikus), akkor documentId-vel szűrünk
      if (projectId.match(/^[a-z0-9]+$/)) {
        params.append('filters[project][documentId][$eq]', projectId);
      } else {
        params.append('filters[project][id][$eq]', projectId);
      }
    }
    if (filters?.type) {
      params.append('filters[type][$eq]', filters.type);
    }
    if (filters?.signed !== undefined) {
      params.append('filters[signed][$eq]', filters.signed.toString());
    }
    
    params.append('populate', '*');
    params.append('sort', 'createdAt:desc');
    
    try {
      const response = await strapiApi.get<StrapiResponse<Document[]>>(`/documents?${params.toString()}`);
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      
      // Részletesebb hibaüzenet kinyerése
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a dokumentumok lekérdezése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  getOne: async (id: number | string) => {
    try {
      const response = await strapiApi.get<StrapiResponse<Document>>(`/documents/${id}?populate=*`);
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Dokumentum nem található (ID: ${id})`);
      }
      throw error;
    }
  },

  create: async (data: Partial<Document>) => {
    try {
      // Strapi v5-ben a relation mezőket csak ID-vel küldjük
      // Szűrjük ki az undefined értékeket és a Strapi belső mezőket
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([key, value]) => {
          // Kiszűrjük a Strapi belső mezőket
          const strapiInternalFields = ['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt'];
          if (strapiInternalFields.includes(key)) {
            return false;
          }
          // Kiszűrjük az undefined értékeket
          return value !== undefined;
        })
      );

      const response = await strapiApi.post<StrapiResponse<Document>>('/documents', { data: cleanData });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        
        // Részletesebb hibaüzenet kinyerése
        let errorMessage = 'Hiba történt a dokumentum létrehozása során';
        
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

  update: async (id: number | string, data: Partial<Document>) => {
    try {
      // Szűrjük ki az undefined értékeket és a Strapi belső mezőket
      const cleanData: any = {};
      Object.entries(data).forEach(([key, value]) => {
        // Kihagyjuk a Strapi belső mezőket
        if (['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt'].includes(key)) {
          return;
        }
        // Csak a definiált értékeket küldjük
        if (value !== undefined) {
          cleanData[key] = value;
        }
      });
      
      const response = await strapiApi.put<StrapiResponse<Document>>(`/documents/${id}`, { data: cleanData });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a dokumentum frissítése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  delete: async (id: number | string) => {
    try {
      await strapiApi.delete(`/documents/${id}`);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a dokumentum törlése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  // Dokumentum generálás docxtemplater-rel
  generate: async (templateId: number | string, projectId: number | string) => {
    try {
      const response = await strapiApi.post<StrapiResponse<Document>>('/documents/generate', {
        data: {
          templateId,
          projectId,
        },
      });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a dokumentum generálása során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  // Dokumentum újragenerálása az aláírással
  regenerateWithSignature: async (documentId: number | string, signatureData: string) => {
    try {
      const response = await strapiApi.post<StrapiResponse<Document>>('/documents/regenerate-with-signature', {
        data: {
          documentId,
          signatureData,
        },
      });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a dokumentum újragenerálása során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  // Fájl feltöltése (kép vagy PDF)
  upload: async (projectId: number | string, file: File, type: Document['type'] = 'other') => {
    try {
      const formData = new FormData();
      formData.append('files', file);

      // Strapi file upload endpoint használata
      const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.emermedia.eu';
      const apiToken = process.env.NEXT_PUBLIC_STRAPI_API_TOKEN;
      
      const uploadResponse = await fetch(`${strapiUrl}/api/upload`, {
        method: 'POST',
        headers: {
          ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Fájl feltöltése sikertelen');
      }

      const uploadResult = await uploadResponse.json();
      const fileId = Array.isArray(uploadResult) ? uploadResult[0].id : uploadResult.id;

      if (!fileId) {
        throw new Error('A feltöltött fájl ID-ja nem található');
      }

      // Dokumentum létrehozása a feltöltött fájllal
      const response = await strapiApi.post<StrapiResponse<Document>>('/documents', {
        data: {
          project: projectId,
          type,
          file: fileId,
          file_name: file.name,
        },
      });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a fájl feltöltése során';
        throw new Error(errorMessage);
      }
      if (error.message) {
        throw error;
      }
      throw new Error('Hiba történt a fájl feltöltése során');
    }
  },
};
