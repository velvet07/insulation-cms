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

// Request interceptor: Use API token by default (full access, works reliably)
strapiApi.interceptors.request.use(
  (config: InternalAxiosRequestConfig & { _useJwtToken?: boolean; _retryCount?: number }) => {
    // Check if this is a retry with JWT token (marked by _useJwtToken flag)
    if (config._useJwtToken && typeof window !== 'undefined') {
      try {
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          const authData = JSON.parse(authStorage);
          const jwtToken = authData?.state?.token;
          if (jwtToken) {
            config.headers.Authorization = `Bearer ${jwtToken}`;
            console.log('[strapiApi] Retrying with JWT token for:', config.url);
            return config;
          }
        }
      } catch (error) {
        console.error('[strapiApi] Error reading auth storage for retry:', error);
      }
    }

    // Use API token by default if available (full access, works reliably)
    if (apiToken) {
      config.headers.Authorization = `Bearer ${apiToken}`;
      console.log('[strapiApi] Using API token for request:', config.url);
    } else if (typeof window !== 'undefined') {
      // Fallback to JWT token only if no API token is available
      try {
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          const authData = JSON.parse(authStorage);
          const jwtToken = authData?.state?.token;
          
          if (jwtToken) {
            config.headers.Authorization = `Bearer ${jwtToken}`;
            console.log('[strapiApi] No API token, using JWT token for request:', config.url);
          } else {
            console.error('[strapiApi] No API token and no JWT token available for:', config.url);
          }
        } else {
          console.error('[strapiApi] No API token and no auth storage found for:', config.url);
        }
      } catch (error) {
        console.error('[strapiApi] Error reading auth storage:', error);
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
    
    // Log 403 errors with more details and retry with JWT token if API token failed
    if (error.response?.status === 403) {
      console.error('API 403 Forbidden Error:', {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        response: error.response?.data,
      });
      
      // If we got 403 with API token, retry with JWT token (if available and not already retried)
      const config = error.config as InternalAxiosRequestConfig & { _useJwtToken?: boolean; _retryCount?: number };
      if (typeof window !== 'undefined' && !config._useJwtToken && config._retryCount !== 1) {
        try {
          const authStorage = localStorage.getItem('auth-storage');
          if (authStorage) {
            const authData = JSON.parse(authStorage);
            const jwtToken = authData?.state?.token;
            if (jwtToken) {
              config._useJwtToken = true;
              config._retryCount = (config._retryCount || 0) + 1;
              console.log('[strapiApi] API token returned 403, retrying with JWT token for:', config.url);
              return strapiApi.request(config);
            }
          }
        } catch (error) {
          console.error('[strapiApi] Error reading auth storage for retry:', error);
        }
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
