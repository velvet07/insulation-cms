import axios from 'axios';
import type { User } from '@/types';
import { companiesApi } from './companies';

const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.emermedia.eu';
const apiToken = process.env.NEXT_PUBLIC_STRAPI_API_TOKEN;

// Use API token with full access for user management operations
// The API token should have permissions to manage users in Strapi admin
const strapiApi = axios.create({
  baseURL: `${strapiUrl}/api`,
  headers: {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  },
});

console.log('[usersApi] Initialized with API token for user management');

export const usersApi = {
  // Get all users with optional filtering
  getAll: async (filters?: { company?: number | string | (number | string)[] | 'null'; role?: number | string }): Promise<User[]> => {
    const params = new URLSearchParams();
    params.append('populate', '*');

    if (filters?.company) {
      if (filters.company === 'null') {
        params.append('filters[company][id][$null]', 'true');
      } else if (Array.isArray(filters.company)) {
        filters.company.forEach((id, index) => {
          params.append(`filters[company][id][$in][${index}]`, id.toString());
        });
      } else {
        params.append('filters[company][id][$eq]', filters.company.toString());
      }
    }

    if (filters?.role) {
      params.append('filters[role][id][$eq]', filters.role.toString());
    }

    const response = await strapiApi.get(`/users?${params.toString()}`);
    return response.data || [];
  },

  // Get user by ID
  // IMPORTANT: Strapi v5 Users-Permissions plugin requires numeric ID for /users endpoints
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

    // NOTE: Users-Permissions plugin expects raw data, not wrapped in { data: ... }
    const response = await strapiApi.post('/users', userPayload);
    const newUser = response.data;

    // If company was specified, update it separately using the custom endpoint
    if (data.company !== undefined && newUser?.id) {
      try {
        await usersApi.assignUserToCompany(newUser.id, data.company);
      } catch (companyError) {
        console.warn('Could not assign company during creation:', companyError);
      }
    }

    // If role was specified, update it separately (Strapi sometimes requires this)
    if (data.role !== undefined && newUser?.id) {
      try {
        await strapiApi.put(`/users/${newUser.id}`, {
          role: data.role,
        });
      } catch (roleError) {
        console.warn('Could not set role separately:', roleError);
      }
    }

    return newUser;
  },

  // Assign user to company using the company endpoint (relation connect)
  // This is a workaround because the Users-Permissions plugin doesn't allow 
  // updating the company relation directly on the user endpoint.
  assignUserToCompany: async (userId: string | number, companyId: string | number | null): Promise<User> => {
    console.log(`[usersApi.assignUserToCompany] Assigning user ${userId} to company ${companyId}`);

    if (!companyId) {
      // If no companyId, we might need to disconnect the user from their current company
      // For now, we'll just return the user, but in a full implementation we'd find the company and disconnect
      return await usersApi.getOne(userId);
    }

    // Use the company endpoint to connect the user
    // Strapi v5 relation connect syntax: { data: { user: { connect: [id] } } }
    await companiesApi.update(companyId, {
      user: {
        connect: [userId]
      }
    } as any);

    // Return the updated user
    return await usersApi.getOne(userId);
  },

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

    // Handle simple fields
    if (data.username !== undefined) cleanData.username = data.username;
    if (data.email !== undefined) cleanData.email = data.email;
    if (data.password !== undefined) cleanData.password = data.password;
    if (data.confirmed !== undefined) cleanData.confirmed = data.confirmed;
    if (data.blocked !== undefined) cleanData.blocked = data.blocked;

    // Handle role
    if (data.role !== undefined && data.role !== null && data.role !== '') {
      cleanData.role = typeof data.role === 'string' ? parseInt(data.role) : data.role;
    }

    try {
      let updatedUser: User | null = null;

      // 1. Update basic fields if any
      if (Object.keys(cleanData).length > 0) {
        console.log('[usersApi.update] Updating basic fields:', cleanData);
        const response = await strapiApi.put(`/users/${id}`, cleanData);
        updatedUser = response.data;
      }

      // 2. Update company separately using custom endpoint if provided
      if (data.company !== undefined) {
        console.log('[usersApi.update] Updating company separately');
        updatedUser = await usersApi.assignUserToCompany(id, data.company);
      }

      // If no updates were made, just fetch the user
      if (!updatedUser) {
        updatedUser = await usersApi.getOne(id);
      }

      return updatedUser;
    } catch (error: any) {
      console.error('[usersApi.update] Error:', error);
      throw error;
    }
  },

  // Delete user
  delete: async (id: string | number): Promise<void> => {
    await strapiApi.delete(`/users/${id}`);
  },
};
