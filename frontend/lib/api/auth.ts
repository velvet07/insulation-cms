import axios from 'axios';
import type { User } from '@/types';

const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.emermedia.eu';

// Separate axios instance for auth endpoints (no API token needed)
const authApiClient = axios.create({
  baseURL: `${strapiUrl}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface LoginResponse {
  jwt: string;
  user: User;
}

export interface LoginCredentials {
  identifier: string; // email or username
  password: string;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    try {
      const response = await authApiClient.post<LoginResponse | { data: LoginResponse }>('/auth/local', credentials);
      // Strapi v5 might wrap the response differently
      if (response.data && 'jwt' in response.data && 'user' in response.data) {
        return response.data as LoginResponse;
      }
      // If response is wrapped in data property
      if (response.data && typeof response.data === 'object' && 'data' in response.data) {
        return (response.data as { data: LoginResponse }).data;
      }
      return response.data as LoginResponse;
    } catch (error: any) {
      // Better error handling
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || 
                           error.response.data?.message || 
                           'Bejelentkezési hiba';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  register: async (data: {
    username: string;
    email: string;
    password: string;
  }): Promise<LoginResponse> => {
    const response = await authApiClient.post<LoginResponse>('/auth/local/register', data);
    return response.data;
  },

  getMe: async (token: string): Promise<User> => {
    // Try different populate formats for Strapi v5
    let response;
    try {
      response = await authApiClient.get<User>('/users/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          populate: ['company', 'role'],
        },
      });
    } catch (error: any) {
      // If array format doesn't work, try string format
      if (error.response?.status === 400 || error.response?.status === 422) {
        response = await authApiClient.get<User>('/users/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            populate: 'company,role',
          },
        });
      } else {
        throw error;
      }
    }
    
    // Transform role to our format if needed
    const user = response.data;
    if (user && typeof user.role === 'object' && user.role !== null && 'type' in user.role) {
      // Map Strapi role type to our role string
      const roleType = (user.role as any).type;
      const roleName = (user.role as any).name?.toLowerCase() || '';
      
      // Check if role name contains 'admin' or type is 'admin'
      if (roleName.includes('admin') || roleType === 'admin') {
        (user as any).role = 'admin';
      } else if (roleName.includes('foovallalkozo') || roleName.includes('fővállalkozó')) {
        (user as any).role = 'foovallalkozo';
      } else if (roleName.includes('alvallalkozo') || roleName.includes('alvállalkozó')) {
        (user as any).role = 'alvallalkozo';
      } else if (roleName.includes('manager')) {
        (user as any).role = 'manager';
      } else if (roleName.includes('worker')) {
        (user as any).role = 'worker';
      }
    }
    
    return user;
  },

  forgotPassword: async (email: string): Promise<void> => {
    await authApiClient.post('/auth/forgot-password', { email });
  },

  resetPassword: async (data: {
    code: string;
    password: string;
    passwordConfirmation: string;
  }): Promise<LoginResponse> => {
    const response = await authApiClient.post<LoginResponse>('/auth/reset-password', data);
    return response.data;
  },
};
