import { strapiApi } from './strapi';
import type { User } from '@/types';

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
    const response = await strapiApi.post<LoginResponse>('/auth/local', credentials);
    return response.data;
  },

  register: async (data: {
    username: string;
    email: string;
    password: string;
  }): Promise<LoginResponse> => {
    const response = await strapiApi.post<LoginResponse>('/auth/local/register', data);
    return response.data;
  },

  getMe: async (token: string): Promise<User> => {
    const response = await strapiApi.get<User>('/users/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  forgotPassword: async (email: string): Promise<void> => {
    await strapiApi.post('/auth/forgot-password', { email });
  },

  resetPassword: async (data: {
    code: string;
    password: string;
    passwordConfirmation: string;
  }): Promise<LoginResponse> => {
    const response = await strapiApi.post<LoginResponse>('/auth/reset-password', data);
    return response.data;
  },
};
