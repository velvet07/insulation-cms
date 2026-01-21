import axios, { InternalAxiosRequestConfig } from 'axios';
import type { User } from '@/types';
import { companiesApi } from './companies';

const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.emermedia.eu';

// Users-Permissions plugin requires JWT token (authenticated user) instead of API token
// Create a separate axios instance that uses JWT token from localStorage
const strapiApi = axios.create({
  baseURL: `${strapiUrl}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to use JWT token
strapiApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const authData = JSON.parse(authStorage);
        const jwtToken = authData?.state?.token;
        if (jwtToken) {
          config.headers.Authorization = `Bearer ${jwtToken}`;
          console.log('[usersApi] Using JWT token for request:', config.url);
        } else {
          console.warn('[usersApi] No JWT token available for request:', config.url);
        }
      }
    } catch (error) {
      console.error('[usersApi] Error reading JWT token:', error);
    }
  }
  return config;
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

    // NOTE: Users-Permissions plugin expects raw data, not wrapped in { data: ... }
    const response = await strapiApi.post('/users', userPayload);

    // If role was specified, update it separately (Strapi sometimes requires this)
    if (data.role !== undefined && response.data?.documentId) {
      try {
        // NOTE: Users-Permissions plugin expects raw data, not wrapped in { data: ... }
        await strapiApi.put(`/users/${response.data.documentId}`, {
          role: data.role,
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
      // NOTE: The Strapi users-permissions plugin might not allow updating the company field via API
      // We'll try to update it separately after updating other fields
      let companyToUpdate: number | null | undefined = undefined;
      if (data.company !== undefined) {
        if (data.company === null || data.company === '') {
          companyToUpdate = null; // Explicitly set to null to clear relation
        } else {
          // Determine if it's a documentId (string, not a simple numeric string) or numeric ID
          const isNumericString = typeof data.company === 'string' && /^\d+$/.test(data.company);
          const isDocumentId = typeof data.company === 'string' && !isNumericString;

          if (isDocumentId) {
            // It's a documentId (string format, not numeric) - convert to numeric ID
            try {
              console.log('[usersApi.update] Converting company documentId to numeric ID:', data.company);
              const company = await companiesApi.getOne(data.company);
              if (company && company.id) {
                console.log('[usersApi.update] Found company numeric ID:', company.id);
                companyToUpdate = company.id;
              } else {
                console.warn('[usersApi.update] Company not found or has no numeric ID, skipping company update');
                companyToUpdate = undefined;
              }
            } catch (companyError) {
              console.error('[usersApi.update] Error fetching company by documentId:', companyError);
              // Skip company update if fetch fails
              companyToUpdate = undefined;
            }
          } else if (isNumericString) {
            // It's a numeric string, convert to number
            companyToUpdate = Number(data.company);
          } else if (typeof data.company === 'number') {
            // It's already a number
            companyToUpdate = data.company;
          }
        }
      }

      // Check if we have any fields to update
      if (Object.keys(cleanData).length === 0) {
        console.warn('[usersApi.update] No fields to update (excluding company)');
        // If only company needs to be updated, skip the first request
        if (companyToUpdate === undefined) {
          // Nothing to update at all
          const currentUser = await usersApi.getOne(id);
          return currentUser;
        }
      } else {
        // First, update all fields except company
        console.log('[usersApi.update] Sending clean data (without company):', JSON.stringify(cleanData, null, 2));
        console.log('[usersApi.update] Request URL:', `/users/${id}`);
        console.log('[usersApi.update] Request method:', 'PUT');

        try {
          // NOTE: Users-Permissions plugin expects raw data, not wrapped in { data: ... }
          let response = await strapiApi.put(`/users/${id}`, cleanData);

          if (!response || !response.data) {
            throw new Error('Invalid response from server');
          }

          console.log('[usersApi.update] Update successful, response:', response.data);

          // If company needs to be updated, try updating it separately
          if (companyToUpdate !== undefined) {
            try {
              console.log('[usersApi.update] Updating company field separately:', companyToUpdate);
              const companyUpdateData: any = { company: companyToUpdate };
              // NOTE: Users-Permissions plugin expects raw data, not wrapped in { data: ... }
              response = await strapiApi.put(`/users/${id}`, companyUpdateData);

              if (!response || !response.data) {
                console.warn('[usersApi.update] Company update returned invalid response, but other fields were updated');
              } else {
                console.log('[usersApi.update] Company field updated successfully');
              }
            } catch (companyUpdateError: any) {
              console.error('[usersApi.update] Error updating company field separately:', companyUpdateError);
              console.warn('[usersApi.update] Company field could not be updated, but other fields were updated successfully');
              // Don't throw error - other fields were updated successfully
              // Re-fetch user to get updated data
              return await usersApi.getOne(id);
            }
          }

          return response.data;
        } catch (firstUpdateError: any) {
          // If first update fails, maybe it's a permission issue
          // Try to get more details from the error
          console.error('[usersApi.update] Error in first update attempt:', firstUpdateError);
          console.error('[usersApi.update] First update error status:', firstUpdateError.response?.status);
          console.error('[usersApi.update] First update error response:', firstUpdateError.response?.data);

          // Re-throw with more context
          const errorWithContext = new Error(
            '500-as hiba: A Strapi szerveren belső hiba történt. ' +
            'Ez valószínűleg jogosultsági probléma. Ellenőrizd a Strapi admin felületén, ' +
            'hogy az API token-nek van-e jogosultsága a user módosításához (Users-Permissions plugin → Roles → Public/Authenticated → User → update permission). ' +
            'Részletek: ' + (firstUpdateError.response?.data?.error?.message || firstUpdateError.message)
          );
          // Preserve the original error response
          (errorWithContext as any).response = firstUpdateError.response;
          throw errorWithContext;
        }
      }

      // If only company needs to be updated and first update was skipped
      if (companyToUpdate !== undefined) {
        try {
          console.log('[usersApi.update] Updating company field only:', companyToUpdate);
          const companyUpdateData: any = { company: companyToUpdate };
          // NOTE: Users-Permissions plugin expects raw data, not wrapped in { data: ... }
          const response = await strapiApi.put(`/users/${id}`, companyUpdateData);

          if (!response || !response.data) {
            throw new Error('Invalid response from server');
          }

          console.log('[usersApi.update] Company field updated successfully');
          return response.data;
        } catch (companyUpdateError: any) {
          console.error('[usersApi.update] Error updating company field:', companyUpdateError);
          throw companyUpdateError;
        }
      }

      // Should not reach here, but just in case
      return await usersApi.getOne(id);
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
