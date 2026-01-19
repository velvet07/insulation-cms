import axios, { AxiosInstance } from 'axios';

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
});

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
    
    // 404-es hibákat csendben kezeljük - ne logoljuk a konzolba
    // Még mindig reject-eljük, hogy a hívó oldalon kezelni lehessen
    // De jelezzük, hogy ez egy 404-es hiba, amit csendben kell kezelni
    if (error.response?.status === 404) {
      // Jelöljük meg, hogy ez egy csendben kezelendő 404-es hiba
      error._silent404 = true;
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
