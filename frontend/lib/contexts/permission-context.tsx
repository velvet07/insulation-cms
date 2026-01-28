'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { isAdminRole, isSubcontractor, isMainContractor } from '@/lib/utils/user-role';
import { companiesApi } from '@/lib/api/companies';
import { useQuery } from '@tanstack/react-query';
import { permissionMatrixApi } from '@/lib/api/permission-matrix';

const PERMISSION_MATRIX_STORAGE_KEY = 'permission_matrix_v3';

// Types
export type PermissionAction = string;
export type PermissionModule =
    | 'projects'
    | 'materials'
    | 'settings'
    | 'calendar'
    | 'documents'
    | 'approved_projects';

export interface PermissionFeature {
    id: string;
    label: string;
    read?: string;
    write?: string;
    /**
     * Optional dependency for "write-only" actions (e.g. create).
     * If the write action is enabled, this read action will be enabled too.
     * If this read action is disabled, the write action will be disabled too.
     */
    requiresRead?: string;
}

export const PERMISSION_CONFIG: Record<PermissionModule, PermissionFeature[]> = {
    projects: [
        { id: 'list', label: 'Projekt lista', read: 'view_list' },
        { id: 'create', label: 'Projekt létrehozás', write: 'create', requiresRead: 'view_list' },
        { id: 'details', label: 'Projekt adatok', read: 'view_details', write: 'edit' },
        { id: 'photos', label: 'Fotók kezelése', read: 'view_photos', write: 'manage_photos' },
        { id: 'documents', label: 'Dokumentumok', read: 'view_project_documents', write: 'manage_documents' },
        { id: 'worksheet', label: 'Munkalap', read: 'view_worksheet', write: 'manage_worksheet' },
        { id: 'export_zip', label: 'Projekt export (ZIP)', write: 'export_zip' },
        { id: 'delete', label: 'Törlés', write: 'delete' },
        { id: 'approve', label: 'Jóváhagyás', write: 'approve' },
    ],
    materials: [
        { id: 'balance', label: 'Készlet/Egyenleg', read: 'view_list' },
        { id: 'pickup', label: 'Anyagfelvétel', write: 'pickup' },
        { id: 'transactions', label: 'Tranzakciók', read: 'view_transactions', write: 'edit_transaction' },
        { id: 'delete_trans', label: 'Tranzakció törlése', write: 'delete_transaction' },
        { id: 'settings', label: 'Beállítások', write: 'manage_settings' },
    ],
    settings: [
        { id: 'view', label: 'Beállítások megtekintése', read: 'view_list' },
        { id: 'companies', label: 'Cégek kezelése', read: 'view_companies', write: 'manage_companies' },
        { id: 'users', label: 'Felhasználók kezelése', read: 'view_users', write: 'manage_users' },
        { id: 'materials', label: 'Anyagtípusok', read: 'view_material_types', write: 'manage_material_types' },
        { id: 'photo_cats', label: 'Fotó kategóriák', read: 'view_photo_categories', write: 'manage_photo_categories' },
        { id: 'perms', label: 'Jogosultságok', read: 'view_permissions', write: 'manage_permissions' },
    ],
    calendar: [
        { id: 'view', label: 'Naptár megtekintése', read: 'view_calendar' },
        { id: 'manage', label: 'Ütemezés kezelése', write: 'manage_schedule' },
    ],
    documents: [
        { id: 'view', label: 'Dokumentumok megtekintése', read: 'view_list' },
        { id: 'templates', label: 'Sablonok kezelése', read: 'view_templates', write: 'manage_templates' },
    ],
    approved_projects: [
        { id: 'view', label: 'Jóváhagyott projektek', read: 'view_list' },
    ],
};

export interface Role {
    id: string;
    name: string;
    isSystem: boolean;
}

export interface PermissionMatrix {
    roles: Role[];
    permissions: Record<string, Record<string, Record<string, boolean>>>;
}

interface PermissionContextType {
    can: (module: PermissionModule, action: PermissionAction) => boolean;
    role: string | null;
    matrix: PermissionMatrix;
    updateMatrix: (newMatrix: PermissionMatrix) => void;
    isLoading: boolean;
}

// Default Matrix
const DEFAULT_MATRIX: PermissionMatrix = {
    roles: [
        { id: 'admin', name: 'Admin', isSystem: true },
        { id: 'main_contractor', name: 'Fővállalkozó', isSystem: false },
        { id: 'subcontractor', name: 'Alvállalkozó', isSystem: false },
        { id: 'guest', name: 'Vendég (Nincs cég)', isSystem: true },
    ],
    permissions: {
        admin: {
            // Admin has full access by default logic
        },
        main_contractor: {
            projects: {
                view_list: true, create: true, edit: true, delete: false,
                view_details: true, view_photos: true, view_project_documents: true,
                view_worksheet: true, manage_photos: true, manage_documents: true,
                manage_worksheet: true, approve: true,
                export_zip: true
            },
            materials: {
                view_list: true, pickup: true, view_transactions: true,
                edit_transaction: true, delete_transaction: true, manage_settings: true
            },
            settings: {
                view_list: true, view_companies: true, view_users: true,
                view_material_types: true, view_photo_categories: true, view_permissions: false,
                manage_companies: true, manage_users: true,
                manage_material_types: true, manage_photo_categories: true, manage_permissions: false
            },
            calendar: { view_calendar: true, manage_schedule: true },
            documents: { view_list: true, view_templates: true, manage_templates: true },
            approved_projects: { view_list: true },
        },
        subcontractor: {
            projects: {
                view_list: true, create: true, edit: true, delete: true,
                view_details: true, view_photos: true, view_project_documents: true,
                view_worksheet: true, manage_photos: true, manage_documents: true,
                manage_worksheet: true, approve: false,
                export_zip: false
            },
            materials: {
                view_list: true, pickup: true, view_transactions: false,
                edit_transaction: false, delete_transaction: false, manage_settings: false
            },
            settings: {
                view_list: true, view_companies: false, view_users: true,
                view_material_types: false, view_photo_categories: false, view_permissions: false,
                manage_companies: false, manage_users: true,
                manage_material_types: false, manage_photo_categories: false, manage_permissions: false
            },
            calendar: { view_calendar: true },
            documents: { view_list: false, view_templates: false, manage_templates: false },
            approved_projects: { view_list: false },
        },
        guest: {
            // Guest has basic view permissions so they can navigate
            projects: { view_list: true, view_details: true, view_photos: true, view_project_documents: true, view_worksheet: true, export_zip: false },
            materials: { view_list: true },
            settings: { view_list: true },
            calendar: { view_calendar: true },
            documents: { view_list: true },
            approved_projects: { view_list: false },
        },
    },
};

function mergeMatrixWithDefaults(parsed: any): PermissionMatrix {
    // Merge with default roles to ensure new roles (like guest) are present
    const mergedMatrix: PermissionMatrix = { ...DEFAULT_MATRIX };

    // Restore saved permissions for existing roles
    if (parsed?.permissions) {
        Object.keys(parsed.permissions).forEach((roleId) => {
            if (mergedMatrix.permissions[roleId]) {
                mergedMatrix.permissions[roleId] = {
                    ...mergedMatrix.permissions[roleId],
                    ...parsed.permissions[roleId],
                };
            }
        });
    }

    // Restore saved roles (if any custom ones were added)
    if (parsed?.roles) {
        const defaultRoleIds = DEFAULT_MATRIX.roles.map((r) => r.id);
        const customRoles = parsed.roles.filter((r: Role) => !defaultRoleIds.includes(r.id));
        mergedMatrix.roles = [...DEFAULT_MATRIX.roles, ...customRoles];

        // Also restore permissions for custom roles
        customRoles.forEach((r: Role) => {
            if (parsed.permissions?.[r.id]) {
                mergedMatrix.permissions[r.id] = parsed.permissions[r.id];
            }
        });
    }

    return mergedMatrix;
}

function loadMatrixFromLocalStorage(): PermissionMatrix | null {
    if (typeof window === 'undefined') return null;
    const saved = window.localStorage.getItem(PERMISSION_MATRIX_STORAGE_KEY);
    if (!saved) return null;
    try {
        const parsed = JSON.parse(saved);
        return mergeMatrixWithDefaults(parsed);
    } catch (e) {
        console.error('Failed to parse permission matrix', e);
        return null;
    }
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function PermissionProvider({ children }: { children: React.ReactNode }) {
    const user = useAuthStore((state) => state.user);
    const [matrix, setMatrix] = useState<PermissionMatrix>(DEFAULT_MATRIX);
    const [resolvedCompany, setResolvedCompany] = useState<any | null>(null);
    const lastServerMatrixJsonRef = React.useRef<string | null>(null);

    // Load matrix from localStorage on mount (mock persistence)
    useEffect(() => {
        const loaded = loadMatrixFromLocalStorage();
        if (loaded) setMatrix(loaded);
    }, []);

    // Load matrix from backend (shared across users/browsers).
    // Falls back to localStorage if backend route isn't available.
    useEffect(() => {
        let cancelled = false;

        const loadFromServer = async () => {
            try {
                const serverMatrix = await permissionMatrixApi.get();
                if (!serverMatrix) return;
                if (cancelled) return;
                const json = JSON.stringify(serverMatrix);
                if (lastServerMatrixJsonRef.current === json) return;
                lastServerMatrixJsonRef.current = json;

                setMatrix(mergeMatrixWithDefaults(serverMatrix));
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem(PERMISSION_MATRIX_STORAGE_KEY, JSON.stringify(serverMatrix));
                }
            } catch {
                // ignore - keep localStorage/default
            }
        };

        loadFromServer();

        const onFocus = () => {
            // Refresh when user returns to the tab (helps propagate admin changes).
            loadFromServer();
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('focus', onFocus);
            document.addEventListener('visibilitychange', onFocus);
        }

        return () => {
            cancelled = true;
            if (typeof window !== 'undefined') {
                window.removeEventListener('focus', onFocus);
                document.removeEventListener('visibilitychange', onFocus);
            }
        };
    }, []);

    // Periodic refresh so role changes apply to other users without reload.
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let cancelled = false;
        const tick = async () => {
            if (cancelled) return;
            // Only poll when tab is visible to reduce load.
            if (document.visibilityState !== 'visible') return;
            try {
                const serverMatrix = await permissionMatrixApi.get();
                if (!serverMatrix) return;
                const json = JSON.stringify(serverMatrix);
                if (lastServerMatrixJsonRef.current === json) return;
                lastServerMatrixJsonRef.current = json;
                setMatrix(mergeMatrixWithDefaults(serverMatrix));
                window.localStorage.setItem(PERMISSION_MATRIX_STORAGE_KEY, json);
            } catch {
                // ignore
            }
        };

        const id = window.setInterval(() => {
            tick();
        }, 10000);

        return () => {
            cancelled = true;
            window.clearInterval(id);
        };
    }, []);

    // Keep matrix in sync across tabs/windows (storage event doesn't fire in the same tab).
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const onStorage = (e: StorageEvent) => {
            if (e.key !== PERMISSION_MATRIX_STORAGE_KEY) return;
            const loaded = loadMatrixFromLocalStorage();
            if (loaded) setMatrix(loaded);
        };

        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const updateMatrix = (newMatrix: PermissionMatrix) => {
        setMatrix(newMatrix);
        if (typeof window !== 'undefined') {
            localStorage.setItem(PERMISSION_MATRIX_STORAGE_KEY, JSON.stringify(newMatrix));
        }
        // Best-effort server persistence so changes apply to other users/browsers.
        permissionMatrixApi.set(newMatrix).catch(() => {
            // ignore; local persistence still works
        });
    };

    // Determine user role
    const userCompanyId = useMemo(() => {
        if (!user?.company) return null;
        if (typeof user.company === 'object') return user.company.documentId || user.company.id;
        return user.company;
    }, [user]);

    // Resolve company object when user.company is only an id/documentId (common with persisted auth state).
    // This is needed for reliable role detection (main_contractor vs subcontractor).
    useEffect(() => {
        let cancelled = false;

        const resolve = async () => {
            if (!userCompanyId) {
                if (!cancelled) setResolvedCompany(null);
                return;
            }

            const directCompany = typeof user?.company === 'object' && user.company !== null ? user.company : null;
            if (directCompany && 'type' in (directCompany as any)) {
                if (!cancelled) setResolvedCompany(directCompany);
                return;
            }

            try {
                const company = await companiesApi.getOne(userCompanyId);
                if (!cancelled) setResolvedCompany(company);
            } catch {
                if (!cancelled) setResolvedCompany(null);
            }
        };

        resolve();
        return () => {
            cancelled = true;
        };
    }, [userCompanyId, user?.company]);

    // DISABLED: Company fetch causes infinite loop
    // const { data: fetchedCompany, isLoading: isLoadingCompany } = useQuery({
    //     queryKey: ['company-permissions', userCompanyId],
    //     queryFn: () => companiesApi.getOne(userCompanyId!),
    //     enabled: !!userCompanyId,
    //     staleTime: 1000 * 60 * 30,
    //     retry: false,
    //     refetchOnMount: false,
    //     refetchOnWindowFocus: false,
    // });

    const currentRoleId = useMemo(() => {
        if (!user) return null;
        if (isAdminRole(user)) return 'admin';

        // Prefer resolved company (covers persisted auth where company is only an id)
        const effectiveCompany =
            resolvedCompany || (typeof user.company === 'object' && user.company !== null ? user.company : null);

        if (effectiveCompany?.type === 'main_contractor' || (effectiveCompany?.type as any) === 'Fővállalkozó') {
            return 'main_contractor';
        }
        if (effectiveCompany?.type === 'subcontractor' || (effectiveCompany?.type as any) === 'Alvállalkozó') {
            return 'subcontractor';
        }

        // Fallback: role helpers (also check role strings/objects)
        if (isMainContractor(user)) return 'main_contractor';
        if (isSubcontractor(user)) return 'subcontractor';

        // Use user.company directly - no fetched company
        const userCompany = typeof user.company === 'object' ? user.company : null;
        if (userCompany?.type === 'main_contractor' || (userCompany?.type as any) === 'Fővállalkozó') {
            return 'main_contractor';
        }
        if (userCompany?.type === 'subcontractor' || (userCompany?.type as any) === 'Alvállalkozó') {
            return 'subcontractor';
        }

        return 'guest';
    }, [user, resolvedCompany]);

    const can = (module: PermissionModule, action: PermissionAction): boolean => {
        if (!currentRoleId) return false;
        if (currentRoleId === 'admin') return true; // Admin superuser

        const rolePermissions = matrix.permissions[currentRoleId];
        if (!rolePermissions) return false;

        const modulePermissions = rolePermissions[module];
        if (!modulePermissions) return false;

        return !!modulePermissions[action];
    };

    return (
        <PermissionContext.Provider value={{ can, role: currentRoleId, matrix, updateMatrix, isLoading: false }}>
            {children}
        </PermissionContext.Provider>
    );
}

export function usePermission() {
    const context = useContext(PermissionContext);
    if (context === undefined) {
        throw new Error('usePermission must be used within a PermissionProvider');
    }
    return context;
}
