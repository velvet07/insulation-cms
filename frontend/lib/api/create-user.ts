import axios from 'axios';

const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.emermedia.eu';
const apiToken = process.env.NEXT_PUBLIC_STRAPI_API_TOKEN;

// Helper function to get available roles
export async function getRoles() {
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
    const response = await apiClient.get('/users-permissions/roles');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching roles:', error.response?.data || error.message);
    throw error;
  }
}

// Script to create a normal user in Strapi
// This uses the API token to create a user via the Users collection

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  confirmed?: boolean;
  blocked?: boolean;
  role?: number; // Role ID (1 = Authenticated, 2 = Public, etc. - check Strapi admin)
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
      const userPayload: any = {
        username: userData.username,
        email: userData.email,
        password: userData.password,
        confirmed: userData.confirmed ?? true,
        blocked: userData.blocked ?? false,
      };
      
      // If role is specified, add it to the payload
      if (userData.role !== undefined) {
        userPayload.role = userData.role;
      }
      
      const response = await apiClient.post('/users', {
        data: userPayload,
      });
      
      // If role was specified, we might need to update it separately
      // as Strapi sometimes requires role to be set via PUT after creation
      if (userData.role !== undefined && response.data?.data?.id) {
        try {
          const userId = response.data.data.documentId || response.data.data.id;
          await apiClient.put(`/users/${userId}`, {
            data: { role: userData.role },
          });
        } catch (roleError) {
          console.warn('Could not set role separately:', roleError);
          // Continue anyway, the user was created
        }
      }
      
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
