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

// Helper function to handle Strapi responses
export function unwrapStrapiResponse<T>(response: { data: { data: T } }): T {
  return response.data.data;
}

// Helper function to handle Strapi array responses
export function unwrapStrapiArrayResponse<T>(response: { data: { data: T[] } }): T[] {
  return response.data.data;
}
