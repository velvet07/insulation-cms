import axios from 'axios';
import type { User } from '@/types';
import { debugLog } from '@/lib/utils/debug-flag';

const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.emermedia.eu';

// Separate axios instance for auth endpoints (no API token needed)
const authApiClient = axios.create({
  baseURL: `${strapiUrl}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable cookies for CORS
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

      // After login, always fetch full user data with role and company
      try {
        const fullUser = await authApi.getMe(loginResponse.jwt);
        debugLog('api', '[authApi.login] Full user data fetched');
        loginResponse.user = fullUser;
      } catch (error) {
        debugLog('api', '[authApi.login] Failed to fetch full user data, using login response');
        // Fallback: try to transform role from login response if available
        if (loginResponse.user && typeof loginResponse.user.role === 'object' && loginResponse.user.role !== null) {
          const roleType = (loginResponse.user.role as any).type;
          const roleName = (loginResponse.user.role as any).name?.toLowerCase() || '';

          // Transform role object to string
          if (roleName.includes('admin') || roleType === 'admin') {
            (loginResponse.user as any).role = 'admin';
          } else if (roleName.includes('foovallalkozo') || roleName.includes('fővállalkozó')) {
            (loginResponse.user as any).role = 'foovallalkozo';
          } else if (roleName.includes('alvallalkozo') || roleName.includes('alvállalkozó')) {
            (loginResponse.user as any).role = 'alvallalkozo';
          } else if (roleName.includes('manager')) {
            (loginResponse.user as any).role = 'manager';
          } else if (roleName.includes('worker')) {
            (loginResponse.user as any).role = 'worker';
          }
        }

        // Try to populate company data if it's just an ID
        if (loginResponse.user && loginResponse.user.company) {
          // If company is just an ID, fetch the full company object
          if (typeof loginResponse.user.company === 'string' || typeof loginResponse.user.company === 'number') {
            try {
              const companyId = loginResponse.user.company;
              // Import companiesApi here to avoid circular dependency
              const { companiesApi } = await import('./companies');
              const company = await companiesApi.getOne(companyId);
              (loginResponse.user as any).company = company;
            } catch (companyError) {
              debugLog('api', 'Failed to fetch company data after login');
              // Don't fail login if company fetch fails
            }
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
    // Try to get user with populate using JWT token directly
    let userResponse;
    try {
      // Try with populate=* first (simplest format)
      userResponse = await authApiClient.get<User>('/users/me?populate=*', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      debugLog('api', '[getMe] Successfully fetched user with populate=*');
    } catch (error: any) {
      debugLog('api', '[getMe] populate=* failed, trying without populate', error?.response?.status);
      try {
        // Fallback to simple request without populate
        userResponse = await authApiClient.get<User>('/users/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        debugLog('api', '[getMe] Fetched user without populate');
      } catch (error2: any) {
        debugLog('api', '[getMe] Both requests failed');
        throw error2 || error;
      }
    }

    // Strapi responses may be:
    // - plain user object (users-permissions)
    // - { data: { id, attributes } } (content API style)
    // - { data: user } (some proxies/wrappers)
    const unwrapEntity = (entity: any) => {
      if (!entity) return entity;
      const candidate = entity?.data ?? entity;
      if (candidate?.attributes && (candidate?.id || candidate?.documentId)) {
        return {
          id: candidate.id,
          documentId: candidate.documentId,
          ...candidate.attributes,
        };
      }
      return candidate;
    };

    let user: any = unwrapEntity(userResponse.data as any);
    const userId = user.documentId || user.id;

    // If /users/me doesn't include relations (common when role lacks permissions),
    // fall back to the /users/:id endpoint using API token to fetch full relations.
    // This is needed for the frontend permission system (e.g., Projects filtering for Main Contractor).
    if (user?.id && (!user?.company || !user?.role)) {
      try {
        const { usersApi } = await import('./users');
        const fullUser = await usersApi.getOne(user.id);
        user = unwrapEntity(fullUser);
        debugLog('api', '[getMe] Fetched full user via /users/:id fallback');
      } catch (error) {
        debugLog('api', '[getMe] /users/:id fallback failed');
      }
    }

    // Normalize nested relations that may come in as { data: ... }
    if (user?.company) user.company = unwrapEntity(user.company);
    if (user?.tenant) user.tenant = unwrapEntity(user.tenant);
    if (user?.role) user.role = unwrapEntity(user.role);

    // Transform role if it's an object
    if (user && typeof user.role === 'object' && user.role !== null) {
      const roleType = (user.role as any).type;
      const roleName = (user.role as any).name?.toLowerCase() || '';
      const roleId = (user.role as any).id;

      // NOTE: numeric role ids (e.g. 1/2) belong to users-permissions roles (Public/Authenticated/custom),
      // they are NOT admin indicators. Only treat explicit admin roles as admin.
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

    // If company is just an ID, fetch it separately
    if (user.company && (typeof user.company === 'string' || typeof user.company === 'number')) {
      try {
        const { companiesApi } = await import('./companies');
        const company = await companiesApi.getOne(user.company);
        (user as any).company = company;

        // If company has parent_company, fetch it too
        if (company.parent_company && (typeof company.parent_company === 'string' || typeof company.parent_company === 'number')) {
          try {
            const parentCompany = await companiesApi.getOne(company.parent_company);
            (user as any).company.parent_company = parentCompany;
          } catch (error) {
            debugLog('api', '[getMe] Failed to fetch parent company');
          }
        }
        debugLog('api', '[getMe] Fetched company data separately');
      } catch (error) {
        debugLog('api', '[getMe] Failed to fetch company data');
      }
    }

    debugLog('api', '[getMe] Final user object:', {
      id: user.id,
      role: user.role,
      companyType: (user.company as any)?.type,
      hasCompany: !!user.company
    });

    return user;
  },

  // Keep the old getMe implementation as fallback but simplified
  _getMeOld: async (token: string): Promise<User> => {
    // Strapi v5 /users/me endpoint - try different populate formats
    let response;
    try {
      // Try with populate=* first (most compatible)
      response = await authApiClient.get<User>('/users/me?populate=*', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error: any) {
      try {
        // Try without populate
        response = await authApiClient.get<User>('/users/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error2: any) {
        debugLog('api', '[getMe] Both requests failed');
        throw error2 || error;
      }
    }

    // Transform role to our format if needed
    const user = response.data;

    debugLog('api', '[getMe] Raw user response:', user);
    debugLog('api', '[getMe] User role:', user?.role);
    debugLog('api', '[getMe] User company:', user?.company);

    // If role is an object, extract the role name/type
    if (user && typeof user.role === 'object' && user.role !== null) {
      // Map Strapi role type to our role string
      const roleType = (user.role as any).type;
      const roleName = (user.role as any).name?.toLowerCase() || '';
      const roleId = (user.role as any).id;

      debugLog('api', '[getMe] Role details:', { roleType, roleName, roleId });

      // Check if role name contains 'admin' or type is 'admin' or id is 1 (Strapi default admin)
      // NOTE: numeric role ids (e.g. 1/2) belong to users-permissions roles (Public/Authenticated/custom),
      // they are NOT admin indicators. Only treat explicit admin roles as admin.
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
      } else {
        // Keep role as object if we can't map it
        debugLog('api', '[getMe] Unknown role type, keeping as object:', user.role);
      }
    } else if (user && typeof user.role === 'string') {
      // Role is already a string, keep it
      debugLog('api', '[getMe] Role is already string:', user.role);
    } else {
      debugLog('api', '[getMe] Role is undefined or null');
    }

    // Fetch company data if it's just an ID
    if (user && user.company) {
      if (typeof user.company === 'string' || typeof user.company === 'number') {
        try {
          const companyId = user.company;
          const { companiesApi } = await import('./companies');
          const company = await companiesApi.getOne(companyId);
          debugLog('api', '[getMe] Fetched company:', company);
          (user as any).company = company;

          // If company has parent_company, fetch it too
          if (company.parent_company) {
            if (typeof company.parent_company === 'string' || typeof company.parent_company === 'number') {
              try {
                const parentCompany = await companiesApi.getOne(company.parent_company);
                (user as any).company.parent_company = parentCompany;
              } catch (error) {
                debugLog('api', '[getMe] Failed to fetch parent company');
              }
            }
          }
        } catch (error) {
          debugLog('api', '[getMe] Failed to fetch company data');
          // Don't fail if company fetch fails
        }
      }
    }

    debugLog('api', '[getMe] Final user object:', user);

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

  // Confirm email and get reset token (for invite flow)
  confirmEmailAndRequestReset: async (confirmation: string): Promise<{ success: boolean; code: string; message: string }> => {
    const response = await authApiClient.post<{ success: boolean; code: string; message: string }>(
      '/auth/confirm-and-request-reset',
      { confirmation }
    );
    return response.data;
  },
};
