import { strapiApi, unwrapStrapiResponse, unwrapStrapiArrayResponse } from './strapi';
import type { Project, StrapiResponse } from '@/types';

let supportsStartedForBillingRoute: boolean | null = null;
import { debugLog } from '@/lib/utils/debug-flag';

// Bump key to avoid getting stuck on an old cached "false" after backend deploys.
const STARTED_FOR_BILLING_SUPPORT_KEY = 'supportsStartedForBillingRoute_v2';

function getStoredStartedForBillingSupport(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STARTED_FOR_BILLING_SUPPORT_KEY);
    if (v === 'true') return true;
    if (v === 'false') return false;
    return null;
  } catch {
    return null;
  }
}

function setStoredStartedForBillingSupport(value: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STARTED_FOR_BILLING_SUPPORT_KEY, value ? 'true' : 'false');
  } catch {
    // ignore
  }
}

function is404Error(e: any): boolean {
  const status = e?.response?.status;
  if (status === 404) return true;
  const msg = safeString(e?.message);
  return msg.includes('404') && msg.toLowerCase().includes('not found');
}

function safeString(v: any) {
  return (v ?? '').toString();
}

export interface ProjectFilters {
  status?: Project['status'];
  status_not?: Project['status']; // Exclude specific status
  assigned_to?: number | string; // Support both numeric id and documentId (Strapi v5)
  tenant?: number;
  company?: number | string;
  subcontractor?: number | string; // Support both numeric id and documentId (Strapi v5)
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    pagination: PaginationMeta;
  };
}

export const projectsApi = {
  getAll: async (filters?: ProjectFilters): Promise<PaginatedResponse<Project>> => {
    debugLog('projects', 'projectsApi.getAll called with filters:', filters);
    const params = new URLSearchParams();

    if (filters?.status) {
      params.append('filters[status][$eq]', filters.status);
      debugLog('projects', '✓ Added status filter:', filters.status);
    }
    if (filters?.status_not) {
      params.append('filters[status][$ne]', filters.status_not);
      debugLog('projects', '✓ Added status_not filter:', filters.status_not);
    }
    if (filters?.assigned_to) {
      // Strapi v5 uses documentId, try both id and documentId
      const assignedToId = filters.assigned_to.toString();
      // Check if it's a documentId (Strapi v5 documentIds are typically long strings, may or may not contain hyphens)
      // If it's longer than 10 characters or contains hyphens, treat as documentId
      // Numeric IDs are typically short (1-9 digits)
      if (assignedToId.length > 10 || assignedToId.includes('-') || isNaN(Number(assignedToId))) {
        // It's a documentId (string)
        params.append('filters[assigned_to][documentId][$eq]', assignedToId);
        debugLog('projects', '✓ Added assigned_to filter (documentId):', assignedToId);
      } else {
        // It's a numeric id
        params.append('filters[assigned_to][id][$eq]', assignedToId);
        debugLog('projects', '✓ Added assigned_to filter (id):', assignedToId);
      }
    }
    if (filters?.tenant) {
      params.append('filters[tenant][id][$eq]', filters.tenant.toString());
      debugLog('projects', '✓ Added tenant filter:', filters.tenant);
    }
    if (filters?.company) {
      // Strapi v5 uses documentId, try both id and documentId
      const companyId = filters.company.toString();
      if (companyId.includes('-') || companyId.length > 10 || isNaN(Number(companyId))) {
        // It's a documentId
        params.append('filters[company][documentId][$eq]', companyId);
        debugLog('projects', '✓ Added company filter (documentId):', companyId);
      } else {
        // It's a numeric id
        params.append('filters[company][id][$eq]', companyId);
        debugLog('projects', '✓ Added company filter (id):', companyId);
      }
    }
    // Track $and index for combining multiple OR conditions
    let andIndex = 0;

    if (filters?.subcontractor) {
      // Strapi v5 uses documentId, try both id and documentId
      // For subcontractor users: show projects where company OR subcontractor matches their company
      const subcontractorId = filters.subcontractor.toString();
      const isDocumentId = subcontractorId.includes('-') || subcontractorId.length > 10 || isNaN(Number(subcontractorId));
      const idField = isDocumentId ? 'documentId' : 'id';

      // Use $and[$or] to match either company OR subcontractor
      params.append(`filters[$and][${andIndex}][$or][0][company][${idField}][$eq]`, subcontractorId);
      params.append(`filters[$and][${andIndex}][$or][1][subcontractor][${idField}][$eq]`, subcontractorId);
      debugLog('projects', '✓ Added OR filter (company OR subcontractor):', subcontractorId);
      andIndex++;
    }
    if (filters?.search) {
      // Use $and[$or] for search to not conflict with subcontractor filter
      params.append(`filters[$and][${andIndex}][$or][0][client_name][$contains]`, filters.search);
      params.append(`filters[$and][${andIndex}][$or][1][client_address][$contains]`, filters.search);
      debugLog('projects', '✓ Added search filter:', filters.search);
      andIndex++;
    }

    // Pagination parameters
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 25;
    params.append('pagination[page]', page.toString());
    params.append('pagination[pageSize]', pageSize.toString());
    debugLog('projects', '✓ Added pagination:', { page, pageSize });

    // Populate all direct relations plus nested parent_company for subcontractor
    // Using deep populate syntax for Strapi v5
    params.append('populate[company]', '*');
    params.append('populate[subcontractor]', '*');
    params.append('populate[subcontractor][populate][parent_company]', '*');
    params.append('populate[assigned_to]', '*');
    params.append('populate[approved_by]', '*');
    params.append('populate[sent_back_by]', '*');
    params.append('populate[tenant]', '*');
    params.append('populate[documents]', '*');
    params.append('populate[photos]', '*');
    params.append('sort', 'createdAt:desc');

    const apiUrl = `/projects?${params.toString()}`;
    debugLog('projects', 'Calling Strapi API:', apiUrl);
    // Always log for debugging subcontractor filter issue
    console.log('📡 [PROJECTS API] Calling:', apiUrl);
    console.log('📡 [PROJECTS API] Filters received:', filters);

    try {
      const response = await strapiApi.get<StrapiResponse<Project[]>>(apiUrl);
      debugLog('projects', 'Response received:', {
        hasData: !!response.data,
        isArray: Array.isArray(response.data),
        hasDataData: response.data && Array.isArray(response.data.data),
        dataDataLength: response.data && Array.isArray(response.data.data) ? response.data.data.length : 0,
        dataLength: Array.isArray(response.data) ? response.data.length : 0,
        meta: (response.data as any)?.meta
      });

      // Handle both Strapi v4 and v5 response formats with pagination metadata
      const payload = response.data as any;

      // Extract pagination metadata from Strapi response
      const paginationMeta: PaginationMeta = payload?.meta?.pagination || {
        page,
        pageSize,
        pageCount: 1,
        total: 0,
      };

      let data: Project[] = [];
      if (payload && Array.isArray(payload.data)) {
        data = payload.data;
        // Update total if not in meta
        if (!payload?.meta?.pagination) {
          paginationMeta.total = data.length;
          paginationMeta.pageCount = Math.ceil(data.length / pageSize);
        }
        debugLog('projects', 'Returning', data.length, 'projects (v4/v5 data format)', paginationMeta);
      } else if (payload && Array.isArray(payload.results)) {
        // Strapi v5 document service format uses "results" instead of "data"
        data = payload.results;
        // Update pagination from response if available
        if (payload.pagination) {
          paginationMeta.page = payload.pagination.page || page;
          paginationMeta.pageSize = payload.pagination.pageSize || pageSize;
          paginationMeta.pageCount = payload.pagination.pageCount || 1;
          paginationMeta.total = payload.pagination.total || data.length;
        } else {
          paginationMeta.total = data.length;
          paginationMeta.pageCount = Math.ceil(data.length / pageSize);
        }
        debugLog('projects', 'Returning', data.length, 'projects (v5 results format)', paginationMeta);
      } else if (Array.isArray(payload)) {
        data = payload;
        paginationMeta.total = data.length;
        paginationMeta.pageCount = Math.ceil(data.length / pageSize);
        debugLog('projects', 'Returning', data.length, 'projects (array format)', paginationMeta);
      } else {
        debugLog('projects', 'Unexpected response format, returning empty array', payload);
      }

      console.log('📡 [PROJECTS API] Returning', data.length, 'projects');
      return {
        data,
        meta: {
          pagination: paginationMeta,
        },
      };
    } catch (error) {
      console.error('❌ [API] Error fetching projects:', error);
      throw error;
    }
  },

  getOne: async (id: number | string) => {
    try {
      // Strapi v5 uses documentId, but we can try both
      const response = await strapiApi.get<StrapiResponse<Project>>(`/projects/${id}?populate=*`);
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Fallback: Strapi v5 REST often expects numeric id in /:id.
        // If caller passed documentId, resolve via filter.
        const idStr = id?.toString?.() || String(id);
        if (idStr && (idStr.length > 10 || idStr.includes('-') || isNaN(Number(idStr)))) {
          try {
            const params = new URLSearchParams();
            params.append('filters[documentId][$eq]', idStr);
            params.append('populate', '*');
            const res = await strapiApi.get<StrapiResponse<Project[]>>(`/projects?${params.toString()}`);
            const payload: any = res.data as any;
            const arr: Project[] = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
            if (arr.length > 0) return arr[0];
          } catch {
            // ignore and throw below
          }
        }

        console.error('Project not found with id:', id);
        throw new Error(`Projekt nem található (ID: ${id})`);
      }
      throw error;
    }
  },

  create: async (data: Partial<Project>) => {
    try {
      const response = await strapiApi.post<StrapiResponse<Project>>('/projects', { data });
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      // Részletesebb hibaüzenet
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message ||
          JSON.stringify(error.response.data) ||
          'Hiba történt a projekt létrehozása során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  update: async (id: number | string, data: Partial<Project>) => {
    try {
      // Szűrjük ki az undefined értékeket ÉS a rendszer mezőket (amiket nem lehet frissíteni)
      const systemFields = ['id', 'documentId', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'];

      // Mély szűrés: kiszűrjük a rendszer mezőket, de ellenőrizzük az objektumok belsejét is
      const cleanData: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Ne küldjük el undefined értékeket
        if (value === undefined) continue;

        // Ne küldjük el a rendszer mezőket
        if (systemFields.includes(key)) continue;

        // Ha az érték objektum, de nem relation mező (amit Strapi kezel), akkor ellenőrizzük
        // de csak akkor, ha nem egy egyszerű érték (string, number, boolean, null)
        if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          // Ha az objektum tartalmazza a documentId mezőt, akkor valószínűleg relation objektum
          // vagy nested objektum, amit nem szabad elküldeni így
          // A relation mezőket csak ID formában küldjük el, nem objektumként
          if ('documentId' in value || 'id' in value || 'createdAt' in value) {
            // Ez egy relation objektum vagy Strapi entitás - ne küldjük el így
            continue;
          }
        }

        cleanData[key] = value;
      }

      const response = await strapiApi.put<StrapiResponse<Project>>(`/projects/${id}`, { data: cleanData });
      // Ha a response null (404-es hiba volt, de az interceptor elnyelte), akkor null-lal térünk vissza
      if (!response || !response.data || !response.data.data) {
        return null as any;
      }
      return unwrapStrapiResponse(response);
    } catch (error: any) {
      // 404-es hibák esetén ne dobjunk hibát - csendben kihagyjuk (projekt lehet törölve lett)
      if (error.response?.status === 404 || error._silent404) {
        // Visszatérünk null-lal, hogy a hívó oldalon tudja, hogy nem sikerült
        // De nem dobunk hibát, hogy ne jelenjen meg a konzolban
        return null as any;
      }

      if (error.response) {
        // Részletesebb hibaüzenet
        let errorMessage = 'Hiba történt a projekt frissítése során';

        // Próbáljuk meg kinyerni a hibaüzenetet különböző helyekről
        if (error.response.data?.error?.message) {
          errorMessage = error.response.data.error.message;
        } else if (error.response.data?.error) {
          errorMessage = typeof error.response.data.error === 'string'
            ? error.response.data.error
            : JSON.stringify(error.response.data.error);
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        } else if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data && Object.keys(error.response.data).length > 0) {
          errorMessage = JSON.stringify(error.response.data);
        } else {
          // Ha üres az error.response.data, nézzük meg a status kódot
          if (error.response.status === 400) {
            errorMessage = 'Érvénytelen adatok (400 Bad Request). Ellenőrizd, hogy minden mező helyes-e.';
          } else if (error.response.status === 403) {
            errorMessage = 'Nincs jogosultság a projekt frissítéséhez (403 Forbidden)';
          } else if (error.response.status === 401) {
            errorMessage = 'Hitelesítési hiba (401 Unauthorized)';
          } else {
            errorMessage = `Hiba történt (${error.response.status}): ${error.response.statusText || 'Ismeretlen hiba'}`;
          }
        }

        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  delete: async (id: number | string) => {
    try {
      await strapiApi.delete(`/projects/${id}`);
    } catch (error: any) {
      // Részletesebb hibaüzenet
      if (error.response) {
        console.error('Strapi API Error:', error.response.data);
        const errorMessage = error.response.data?.error?.message ||
          JSON.stringify(error.response.data) ||
          'Hiba történt a projekt törlése során';
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  /**
   * Bulk export projects to ZIP (server-side streaming).
   * Returns a Blob + suggested filename.
   */
  bulkExport: async (projectIds: Array<number | string>) => {
    const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.emermedia.eu';
    const apiToken = process.env.NEXT_PUBLIC_STRAPI_API_TOKEN;

    const response = await fetch(`${strapiUrl}/api/projects/bulk-export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      },
      body: JSON.stringify({ data: { projectIds } }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || `Bulk export sikertelen (${response.status})`);
    }

    const contentDisposition = response.headers.get('content-disposition') || '';
    const filenameMatch = contentDisposition.match(/filename="([^"]+)"/i);
    const filename = filenameMatch?.[1] || 'export.zip';

    const blob = await response.blob();
    return { blob, filename };
  },

  /**
   * Billing: get "started" projects within date range.
   * A projekt "megkezdett", ha volt benne dokumentum generálás / dokumentum feltöltés / fotó feltöltés.
   * (Backend kiszámolja a legelső aktivitást, és backfill-eli a started_at mezőt is.)
   */
  getStartedForBilling: async (paramsInput: { from?: string; to?: string; company?: number | string }) => {
    // Prefer new backend route, but gracefully fallback on older servers.
    const params = new URLSearchParams();
    if (paramsInput.from) params.append('from', paramsInput.from);
    if (paramsInput.to) params.append('to', paramsInput.to);
    if (paramsInput.company) params.append('company', paramsInput.company.toString());

    const callNew = async () => {
      const response = await strapiApi.get<StrapiResponse<Project[]>>(`/projects/started-for-billing?${params.toString()}`);
      const payload: any = response.data as any;
      if (payload && Array.isArray(payload.data)) return payload.data as Project[];
      if (payload && Array.isArray(payload.data?.data)) return payload.data.data as Project[];
      if (Array.isArray(payload)) return payload as Project[];
      return [];
    };

    const callLegacy = async () => {
      const legacyParams = new URLSearchParams();
      legacyParams.append('filters[started_at][$notNull]', 'true');

      if (paramsInput.from) {
        legacyParams.append('filters[started_at][$gte]', new Date(paramsInput.from).toISOString());
      }
      if (paramsInput.to) {
        const end = new Date(paramsInput.to);
        end.setHours(23, 59, 59, 999);
        legacyParams.append('filters[started_at][$lte]', end.toISOString());
      }
      if (paramsInput.company) {
        const companyId = paramsInput.company.toString();
        if (companyId.includes('-') || companyId.length > 10 || isNaN(Number(companyId))) {
          legacyParams.append('filters[company][documentId][$eq]', companyId);
        } else {
          legacyParams.append('filters[company][id][$eq]', companyId);
        }
      }

      legacyParams.append('populate', '*');
      legacyParams.append('sort', 'started_at:asc');

      const response = await strapiApi.get<StrapiResponse<Project[]>>(`/projects?${legacyParams.toString()}`);
      const payload: any = response.data as any;
      if (payload && Array.isArray(payload.data)) return payload.data as Project[];
      if (Array.isArray(payload)) return payload as Project[];
      return [];
    };

    // Cache support decision across reloads to avoid repeated 404 spam in console.
    if (supportsStartedForBillingRoute === null) {
      const stored = getStoredStartedForBillingSupport();
      if (stored !== null) supportsStartedForBillingRoute = stored;
    }

    if (supportsStartedForBillingRoute === false) {
      return callLegacy();
    }

    try {
      const result = await callNew();
      supportsStartedForBillingRoute = true;
      setStoredStartedForBillingSupport(true);
      return result;
    } catch (e: any) {
      if (is404Error(e)) {
        supportsStartedForBillingRoute = false;
        setStoredStartedForBillingSupport(false);
        return callLegacy();
      }
      throw e;
    }
  },
};
