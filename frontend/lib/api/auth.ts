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
      
      // Extract login response
      let loginResponse: LoginResponse;
      if (response.data && 'jwt' in response.data && 'user' in response.data) {
        loginResponse = response.data as LoginResponse;
      } else if (response.data && typeof response.data === 'object' && 'data' in response.data) {
        loginResponse = (response.data as { data: LoginResponse }).data;
      } else {
        loginResponse = response.data as LoginResponse;
      }

      // After login, try to fetch full user data with role and company populated
      // But don't fail if it doesn't work - use the user from login response
      try {
        const fullUser = await authApi.getMe(loginResponse.jwt);
        // Only update if we got better data (role populated)
        if (fullUser && (typeof fullUser.role === 'object' || fullUser.company)) {
          loginResponse.user = fullUser;
        }
      } catch (meError: any) {
        // Silently ignore - we'll use the user from login response
        // The role might still be available in the login response
        console.warn('Could not fetch full user data, using login response');
        
        // Try to extract role from login response if it's there
        if (loginResponse.user && typeof loginResponse.user.role === 'object' && loginResponse.user.role !== null) {
          const roleType = (loginResponse.user.role as any).type;
          const roleName = (loginResponse.user.role as any).name?.toLowerCase() || '';
          
          if (roleName.includes('admin') || roleType === 'admin') {
            (loginResponse.user as any).role = 'admin';
          } else if (roleName.includes('foovallalkozo') || roleName.includes('fővállalkozó')) {
            (loginResponse.user as any).role = 'foovallalkozo';
          } else if (roleName.includes('alvallalkozo') || roleName.includes('alvállalkozó')) {
            (loginResponse.user as any).role = 'alvallalkozo';
          }
        }
      }

      return loginResponse;
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
    // Strapi v5 /users/me might not support populate, so try without it first
    let response;
    try {
      // First try with populate using object format (Strapi v5 style)
      response = await authApiClient.get<User>('/users/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          populate: {
            company: true,
            role: true,
          },
        },
      });
    } catch (error: any) {
      // If that fails, try without populate
      if (error.response?.status === 400 || error.response?.status === 422) {
        try {
          response = await authApiClient.get<User>('/users/me', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (innerError) {
          throw error; // Throw original error if this also fails
        }
      } else {
        throw error;
      }
    }
    
    // Transform role to our format if needed
    const user = response.data;
    
    // If role is not populated, it might be just an ID
    // In that case, we can't determine the role name, so check the role from login response
    if (user && typeof user.role === 'object' && user.role !== null) {
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
