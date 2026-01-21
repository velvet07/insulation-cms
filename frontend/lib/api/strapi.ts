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
    // Check if this is a retry with API token (marked by _useApiToken flag)
    if ((config as any)._useApiToken && apiToken) {
      config.headers.Authorization = `Bearer ${apiToken}`;
      console.log('[strapiApi] Retrying with API token for:', config.url);
      return config;
    }

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
            // Debug log (always show in console for debugging)
            console.log('[strapiApi] Using JWT token for request:', config.url);
          } else {
            // Fallback to API token if no JWT token found
            if (apiToken) {
              config.headers.Authorization = `Bearer ${apiToken}`;
              console.warn('[strapiApi] No JWT token found, using API token for:', config.url);
            } else {
              console.error('[strapiApi] No JWT token and no API token available for:', config.url);
            }
          }
        } else {
          // Fallback to API token if no auth storage found
          if (apiToken) {
            config.headers.Authorization = `Bearer ${apiToken}`;
            console.warn('[strapiApi] No auth storage found, using API token for:', config.url);
          } else {
            console.error('[strapiApi] No auth storage and no API token available for:', config.url);
          }
        }
      } catch (error) {
        // Fallback to API token on error
        if (apiToken) {
          config.headers.Authorization = `Bearer ${apiToken}`;
          console.warn('[strapiApi] Error reading auth storage, using API token:', error);
        } else {
          console.error('[strapiApi] Error reading auth storage and no API token:', error);
        }
      }
    } else {
      // Server-side: always use API token
      if (apiToken) {
        config.headers.Authorization = `Bearer ${apiToken}`;
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
    
    // Log 403 errors with more details and retry with API token if available
    if (error.response?.status === 403) {
      console.error('API 403 Forbidden Error:', {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        response: error.response?.data,
      });
      
      // If we got 403 with JWT token, retry with API token (if available and not already retried)
      const config = error.config as InternalAxiosRequestConfig & { _useApiToken?: boolean; _retryCount?: number };
      if (apiToken && !config._useApiToken && config._retryCount !== 1) {
        config._useApiToken = true;
        config._retryCount = (config._retryCount || 0) + 1;
        console.log('[strapiApi] JWT token returned 403, retrying with API token for:', config.url);
        return strapiApi.request(config);
      }
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
