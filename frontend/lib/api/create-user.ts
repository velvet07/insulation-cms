import axios from 'axios';

const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.emermedia.eu';
const apiToken = process.env.NEXT_PUBLIC_STRAPI_API_TOKEN;

// Script to create a normal user in Strapi
// This uses the API token to create a user via the Users collection

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  confirmed?: boolean;
  blocked?: boolean;
}

export async function createStrapiUser(userData: CreateUserData) {
  if (!apiToken) {
    throw new Error('NEXT_PUBLIC_STRAPI_API_TOKEN is not set');
  }

  const apiClient = axios.create({
    baseURL: `${strapiUrl}/api`,
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
  });

  try {
    // In Strapi v5, we might need to use the register endpoint with API token
    // Or create via Users collection - try both approaches
    
    // First, try to create via Users collection (if API token has permission)
    try {
      const response = await apiClient.post('/users', {
        data: {
          username: userData.username,
          email: userData.email,
          password: userData.password,
          confirmed: userData.confirmed ?? true,
          blocked: userData.blocked ?? false,
        },
      });
      return response.data;
    } catch (usersError: any) {
      // If that fails, try using the register endpoint with API token
      // Note: This might not work if registration is disabled
      console.warn('Users endpoint failed, trying register endpoint:', usersError.response?.data);
      
      // For Strapi v5, we might need to use a different approach
      // Let's try the register endpoint but with API token
      const registerClient = axios.create({
        baseURL: `${strapiUrl}/api`,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const registerResponse = await registerClient.post('/auth/local/register', {
        username: userData.username,
        email: userData.email,
        password: userData.password,
      });
      
      return registerResponse.data;
    }
  } catch (error: any) {
    console.error('Error creating user:', error.response?.data || error.message);
    throw error;
  }
}
