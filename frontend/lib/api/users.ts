import axios from 'axios';
import type { User } from '@/types';

const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.emermedia.eu';
const apiToken = process.env.NEXT_PUBLIC_STRAPI_API_TOKEN;

const strapiApi = axios.create({
  baseURL: `${strapiUrl}/api`,
  headers: {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  },
});

export const usersApi = {
  // Get all users
  getAll: async (): Promise<User[]> => {
    const response = await strapiApi.get('/users?populate=*');
    return response.data || [];
  },

  // Get user by ID
  getOne: async (id: string | number): Promise<User> => {
    const response = await strapiApi.get(`/users/${id}?populate=*`);
    return response.data;
  },

  // Create user
  create: async (data: {
    username: string;
    email: string;
    password: string;
    confirmed?: boolean;
    blocked?: boolean;
    role?: number | string;
    company?: number | string | null;
  }): Promise<User> => {
    const userPayload: any = {
      username: data.username,
      email: data.email,
      password: data.password,
      confirmed: data.confirmed ?? true,
      blocked: data.blocked ?? false,
    };

    if (data.role !== undefined) {
      userPayload.role = data.role;
    }

    if (data.company !== undefined) {
      userPayload.company = data.company;
    }

    const response = await strapiApi.post('/users', { data: userPayload });
    
    // If role was specified, update it separately (Strapi sometimes requires this)
    if (data.role !== undefined && response.data?.documentId) {
      try {
        await strapiApi.put(`/users/${response.data.documentId}`, {
          data: { role: data.role },
        });
      } catch (roleError) {
        console.warn('Could not set role separately:', roleError);
      }
    }

    return response.data;
  },

  // Update user
  update: async (id: string | number, data: {
    username?: string;
    email?: string;
    password?: string;
    confirmed?: boolean;
    blocked?: boolean;
    role?: number | string;
    company?: number | string | null;
  }): Promise<User> => {
    const systemFields = ['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt'];
    const cleanData: any = {};
    
    try {
      
      // Handle simple fields
      if (data.username !== undefined) cleanData.username = data.username;
      if (data.email !== undefined) cleanData.email = data.email;
      if (data.password !== undefined) cleanData.password = data.password;
      if (data.confirmed !== undefined) cleanData.confirmed = data.confirmed;
      if (data.blocked !== undefined) cleanData.blocked = data.blocked;
      
      // Handle relation fields: send only ID or null
      // For role: Strapi users-permissions role is a relation, send as number ID
      if (data.role !== undefined) {
        if (data.role === null || data.role === '') {
          // Don't send if null/empty
        } else {
          // Ensure role is a number
          cleanData.role = typeof data.role === 'string' ? parseInt(data.role) : data.role;
        }
      }
      
      // For company: Strapi relation field
      // NOTE: Strapi users-permissions plugin might require numeric ID instead of documentId
      // Try to convert documentId to numeric ID by fetching the company first
      if (data.company !== undefined) {
        if (data.company === null || data.company === '') {
          cleanData.company = null; // Explicitly set to null to clear relation
        } else {
          // Try to use numeric ID if possible (users-permissions plugin might prefer this)
          if (typeof data.company === 'string' && data.company.includes('-')) {
            // It's a documentId (UUID format) - try to convert to numeric ID
            // For now, try sending documentId as-is, but log a warning
            console.warn('[usersApi.update] Sending company as documentId:', data.company);
            console.warn('[usersApi.update] If this fails with 500 error, we may need to convert documentId to numeric ID');
            cleanData.company = data.company;
          } else if (typeof data.company === 'string' && !isNaN(Number(data.company))) {
            // It's a numeric string, convert to number
            cleanData.company = Number(data.company);
          } else if (typeof data.company === 'number') {
            // It's already a number
            cleanData.company = data.company;
          } else {
            // Keep as-is (string documentId)
            cleanData.company = data.company;
          }
        }
      }

      console.log('[usersApi.update] Sending clean data:', JSON.stringify(cleanData, null, 2));
      const response = await strapiApi.put(`/users/${id}`, { data: cleanData });
      
      if (!response || !response.data) {
        throw new Error('Invalid response from server');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('[usersApi.update] Error:', error);
      console.error('[usersApi.update] Error status:', error.response?.status);
      console.error('[usersApi.update] Error response:', error.response?.data);
      console.error('[usersApi.update] Error response (full):', JSON.stringify(error.response?.data, null, 2));
      console.error('[usersApi.update] Update data sent:', data);
      
      let errorMessage = 'Hiba történt a felhasználó frissítése során';
      
      // Try to get detailed error message
      if (error.response?.data?.error) {
        const strapiError = error.response.data.error;
        if (strapiError.message) {
          errorMessage = `Strapi hiba: ${strapiError.message}`;
        }
        if (strapiError.details) {
          console.error('[usersApi.update] Strapi error details:', strapiError.details);
          if (typeof strapiError.details === 'object') {
            errorMessage += '\n' + JSON.stringify(strapiError.details, null, 2);
          }
        }
      } else if (error.response?.data?.message) {
        errorMessage = `Strapi hiba: ${error.response.data.message}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // If 500 error, it might be a server-side issue
      if (error.response?.status === 500) {
        errorMessage += '\n\n500-as hiba: A Strapi szerveren belső hiba történt. Lehet, hogy a relation mezők (role, company) módosítása nincs jogosultsághoz kötve, vagy rossz formátumú adatokat küldünk.';
      }
      
      throw new Error(errorMessage);
    }
  },

  // Delete user
  delete: async (id: string | number): Promise<void> => {
    await strapiApi.delete(`/users/${id}`);
  },
};
