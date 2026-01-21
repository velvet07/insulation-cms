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
    try {
      const systemFields = ['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt'];
      const cleanData: any = {};
      
      // Handle simple fields
      if (data.username !== undefined) cleanData.username = data.username;
      if (data.email !== undefined) cleanData.email = data.email;
      if (data.password !== undefined) cleanData.password = data.password;
      if (data.confirmed !== undefined) cleanData.confirmed = data.confirmed;
      if (data.blocked !== undefined) cleanData.blocked = data.blocked;
      
      // Handle relation fields: send only ID or null
      if (data.role !== undefined) {
        if (data.role === null || data.role === undefined) {
          // Don't send if null/undefined
        } else {
          cleanData.role = data.role;
        }
      }
      
      if (data.company !== undefined) {
        if (data.company === null || data.company === '') {
          cleanData.company = null; // Explicitly set to null to clear relation
        } else {
          // Convert to string or number as needed
          cleanData.company = typeof data.company === 'string' 
            ? (data.company.includes('-') ? data.company : parseInt(data.company))
            : data.company;
        }
      }

      const response = await strapiApi.put(`/users/${id}`, { data: cleanData });
      
      if (!response || !response.data) {
        throw new Error('Invalid response from server');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('[usersApi.update] Error:', error);
      console.error('[usersApi.update] Error response:', error.response?.data);
      console.error('[usersApi.update] Update data:', data);
      
      let errorMessage = 'Hiba történt a felhasználó frissítése során';
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  },

  // Delete user
  delete: async (id: string | number): Promise<void> => {
    await strapiApi.delete(`/users/${id}`);
  },
};
