import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.emermedia.eu';
const apiToken = process.env.NEXT_PUBLIC_STRAPI_API_TOKEN;

if (!apiToken) {
  console.warn('NEXT_PUBLIC_STRAPI_API_TOKEN is not set');
}

export const strapiApi: AxiosInstance = axios.create({
  baseURL: `${strapiUrl}/api`,
  headers: {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable cookies for CORS
});

// Request interceptor to add JWT token from auth store
strapiApi.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Only add JWT token on client side
    if (typeof window !== 'undefined') {
      try {
        // Get token from localStorage (same as auth store uses)
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          const authData = JSON.parse(authStorage);
          const jwtToken = authData?.state?.token;
          
          if (jwtToken) {
            // Add JWT token to Authorization header
            // JWT token takes precedence over API token for user-specific endpoints
            config.headers.Authorization = `Bearer ${jwtToken}`;
            // Debug log (only in development)
            if (process.env.NODE_ENV === 'development') {
              console.log('[strapiApi] Using JWT token for request:', config.url);
            }
          } else {
            // Debug log if no JWT token found
            if (process.env.NODE_ENV === 'development') {
              console.warn('[strapiApi] No JWT token found, using API token for:', config.url);
            }
          }
        } else {
          // Debug log if no auth storage found
          if (process.env.NODE_ENV === 'development') {
            console.warn('[strapiApi] No auth storage found, using API token for:', config.url);
          }
        }
      } catch (error) {
        // Silently fail if we can't read from localStorage
        console.warn('Failed to read auth token from storage:', error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
strapiApi.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't redirect on 401 for API token errors - these are expected for some operations
    // Only redirect if it's a user JWT token issue (which we handle in auth.ts)
    if (error.response?.status === 401) {
      // Log but don't redirect - let the calling code handle it
      console.error('API 401 Error:', error.response?.data);
    }
    
    // Log 403 errors with more details
    if (error.response?.status === 403) {
      console.error('API 403 Forbidden Error:', {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        response: error.response?.data,
      });
    }
    
    // 404-es hibákat projekt frissítéseknél csendben kezeljük
    // Ha projekt frissítés 404-et ad (projekt törölve lett), akkor egy sikeres válasszal térünk vissza
    // így a böngésző nem logolja hibának
    if (error.response?.status === 404) {
      const method = error.config?.method?.toLowerCase();
      const url = error.config?.url || error.config?.baseURL || '';
      const fullUrl = error.request?.responseURL || url;
      
      // Ellenőrizzük, hogy ez projekt frissítés PUT kérés-e
      // A URL lehet '/projects/123' vagy 'https://cms.emermedia.eu/api/projects/123'
      if (method === 'put' && (url.includes('/projects/') || fullUrl.includes('/projects/'))) {
        // Jelöljük meg, hogy ez egy csendben kezelendő 404-es hiba
        error._silent404 = true;
        // Elnyeljük a hibát, és egy sikeres válasszal térünk vissza
        // Így a böngésző nem logolja hibának
        // VISSZAIGAZÍTÁS: A böngésző konzol még mindig logolhatja a hálózati hibákat,
        // de legalább nem dobunk exception-t, így a kód nem fog hibát jelezni
        return Promise.resolve({
          data: { data: null },
          status: 200,
          statusText: 'OK',
          headers: error.response?.headers || {},
          config: error.config,
        });
      }
    }
    
    return Promise.reject(error);
  }
);

// Helper function to handle Strapi responses
export function unwrapStrapiResponse<T>(response: { data: { data: T } }): T {
  return response.data.data;
}

// Helper function to handle Strapi array responses
export function unwrapStrapiArrayResponse<T>(response: { data: { data: T[] } }): T[] {
  return response.data.data;
}
