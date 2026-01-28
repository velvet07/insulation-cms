import { strapiApi } from './strapi';
import type { PermissionMatrix } from '@/lib/contexts/permission-context';

function unwrapMatrix(payload: any): PermissionMatrix | null {
  if (!payload) return null;
  // backend returns { data: matrix }
  if (payload.data && payload.data.roles && payload.data.permissions) return payload.data as PermissionMatrix;
  // or returns matrix directly
  if (payload.roles && payload.permissions) return payload as PermissionMatrix;
  return null;
}

export const permissionMatrixApi = {
  get: async (): Promise<PermissionMatrix | null> => {
    const res = await strapiApi.get('/permission-matrix');
    return unwrapMatrix(res?.data);
  },
  set: async (matrix: PermissionMatrix): Promise<void> => {
    await strapiApi.put('/permission-matrix', { data: matrix });
  },
};

