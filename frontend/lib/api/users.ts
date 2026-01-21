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
    const cleanData: any = {};
    
    if (data.username !== undefined) cleanData.username = data.username;
    if (data.email !== undefined) cleanData.email = data.email;
    if (data.password !== undefined) cleanData.password = data.password;
    if (data.confirmed !== undefined) cleanData.confirmed = data.confirmed;
    if (data.blocked !== undefined) cleanData.blocked = data.blocked;
    if (data.role !== undefined) cleanData.role = data.role;
    if (data.company !== undefined) {
      cleanData.company = data.company; // null to remove, ID to set
    }

    const response = await strapiApi.put(`/users/${id}`, { data: cleanData });
    return response.data;
  },

  // Delete user
  delete: async (id: string | number): Promise<void> => {
    await strapiApi.delete(`/users/${id}`);
  },
};
