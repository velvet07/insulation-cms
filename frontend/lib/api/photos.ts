import { strapiApi, unwrapStrapiResponse, unwrapStrapiArrayResponse } from './strapi';
import type { Photo, StrapiResponse } from '@/types';

export interface PhotoFilters {
  project?: number | string;
  category?: number | string;
}

export const photosApi = {
  getAll: async (filters?: PhotoFilters) => {
    const params = new URLSearchParams();
    
    // Strapi v5: populate=* az összes reláció betöltéséhez
    params.append('populate', '*');
    params.append('sort[0]', 'order:asc');
    params.append('sort[1]', 'createdAt:desc');
    
    try {
      const response = await strapiApi.get<StrapiResponse<Photo[]>>(`/photos?${params.toString()}`);
      let photos = unwrapStrapiArrayResponse(response);
      
      // Frontend szűrés a relation mezőkre (Strapi v5 REST API korlátozás)
      if (filters?.project) {
        const projectId = filters.project.toString();
        photos = photos.filter((photo: any) => {
          const photoProjectId = photo.project?.documentId || photo.project?.id?.toString();
          return photoProjectId === projectId;
        });
      }
      if (filters?.category) {
        const categoryId = filters.category.toString();
        photos = photos.filter((photo: any) => {
          const photoCategoryId = photo.category?.documentId || photo.category?.id?.toString();
          return photoCategoryId === categoryId;
        });
      }
      
      return photos;
    } catch (error) {
      console.error('Error fetching photos:', error);
      throw error;
    }
  },

  getOne: async (id: number | string) => {
    try {
      const response = await strapiApi.get<StrapiResponse<Photo>>(`/photos/${id}?populate=*`);
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Fénykép nem található (ID: ${id})`);
      }
      throw error;
    }
  },

  upload: async (projectId: string | number, categoryId: string | number, files: File[], uploadedBy?: number) => {
    try {
      const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.emermedia.eu';
      const apiToken = process.env.NEXT_PUBLIC_STRAPI_API_TOKEN;
      
      // Upload files to Strapi Media Library first
      const uploadedFiles: any[] = [];
      
      for (const file of files) {
        const uploadFormData = new FormData();
        uploadFormData.append('files', file);
        
        const uploadResponse = await fetch(`${strapiUrl}/api/upload`, {
          method: 'POST',
          headers: {
            ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
          },
          body: uploadFormData,
        });
        
        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}));
          throw new Error(`Hiba történt a fájl feltöltése során: ${file.name} - ${errorData.error?.message || uploadResponse.statusText}`);
        }
        
        const uploadData = await uploadResponse.json();
        uploadedFiles.push(...uploadData);
      }
      
      // Create Photo entries for each uploaded file
      const createdPhotos: Photo[] = [];
      
      for (const uploadedFile of uploadedFiles) {
        const photoData = {
          name: uploadedFile.name,
          file: uploadedFile.id,
          category: categoryId,
          project: projectId,
          uploaded_by: uploadedBy,
          order: 0,
        };
        
        // Custom endpoint használata a relation mezők kezeléséhez
        const response = await strapiApi.post<StrapiResponse<Photo>>('/photos/create-with-relations', { data: photoData });
        createdPhotos.push(unwrapStrapiResponse(response));
      }
      
      return createdPhotos;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a fénykép feltöltése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  delete: async (id: number | string) => {
    try {
      await strapiApi.delete(`/photos/${id}`);
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a fénykép törlése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  update: async (id: number | string, data: Partial<Photo>) => {
    try {
      const cleanData: any = {};
      
      // Handle relation fields specially for Strapi v5
      Object.entries(data).forEach(([key, value]) => {
        if (value === undefined) return;
        
        // For relation fields (category, project), send as ID or documentId
        if (key === 'category' || key === 'project') {
          if (value === null) {
            cleanData[key] = null;
          } else if (typeof value === 'string' || typeof value === 'number') {
            // If it's already a string/number ID, use it directly
            cleanData[key] = value;
          } else if (typeof value === 'object' && value !== null) {
            // If it's an object, extract documentId or id
            const relationId = (value as any).documentId || (value as any).id;
            if (relationId) {
              cleanData[key] = relationId;
            }
          }
        } else {
          cleanData[key] = value;
        }
      });
      
      const response = await strapiApi.put<StrapiResponse<Photo>>(`/photos/${id}`, { data: cleanData });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || 
                           JSON.stringify(error.response.data) || 
                           'Hiba történt a fénykép frissítése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },
};
