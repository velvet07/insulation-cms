'use client';

import { useMemo, useEffect } from 'react';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import type { Project } from '@/types';
import { useAuthStore } from '@/lib/store/auth';
import { isAdminRole } from '@/lib/utils/user-role';
import { usePermission } from '@/lib/contexts/permission-context';
import { companiesApi } from '@/lib/api/companies';
import { getRelationId } from '@/lib/utils/relation-id';
import { Plus, Eye } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const { can } = usePermission();
  const isAdmin = isAdminRole(user);

  // Get user company ID
  const userCompanyId = useMemo(() => {
    if (!user?.company) return null;
    if (typeof user.company === 'object') return (user.company as any).documentId || (user.company as any).id;
    return user.company;
  }, [user]);

  // Fetch user's company details to get subcontractors list and type
  const { data: fetchedCompany, isLoading: isLoadingCompany } = useQuery({
    queryKey: ['company', userCompanyId, 'with-subs'],
    queryFn: () => companiesApi.getOne(userCompanyId!, 'subcontractors'),
    enabled: !!userCompanyId,
  });

  // Use fetched company data (has type field), falling back to user.company from auth store
  const userCompany = fetchedCompany || (typeof user?.company === 'object' ? user.company : null);
  const isSubcontractorCompany = (userCompany as any)?.type === 'subcontractor';

  // Build filters for data isolation
  const filters: any = useMemo(() => {
    console.log('\n========================================');
    console.log('📊 [DASHBOARD] Building filters...');
    console.log('📊 [DASHBOARD] userCompanyId:', userCompanyId);
    console.log('📊 [DASHBOARD] fetchedCompany type:', (fetchedCompany as any)?.type);
    console.log('📊 [DASHBOARD] userCompany type:', (userCompany as any)?.type);
    console.log('📊 [DASHBOARD] isSubcontractorCompany:', isSubcontractorCompany);
    console.log('📊 [DASHBOARD] isAdmin:', isAdmin);
    console.log('📊 [DASHBOARD] isLoadingCompany:', isLoadingCompany);
    console.log('========================================\n');

    const f: any = {};
    if (!isAdmin) {
      if (isSubcontractorCompany && userCompanyId) {
        f.subcontractor = userCompanyId;
        console.log('🔒 [DASHBOARD FILTERS] Subcontractor filter applied:', userCompanyId);
      } else if (!userCompanyId && user?.id) {
        f.assigned_to = user.id;
        console.log('🔒 [DASHBOARD FILTERS] Assigned_to filter applied:', user.id);
      } else {
        console.log('🔒 [DASHBOARD FILTERS] Main contractor - no backend filter');
      }
    } else {
      console.log('🔒 [DASHBOARD FILTERS] Admin - no filters applied');
    }
    console.log('🔒 [DASHBOARD FILTERS] Final filters:', f);
    return f;
  }, [isAdmin, isSubcontractorCompany, userCompanyId, user?.id]);

  // Only fetch when we can build a safe filter (never empty filters for non-admin).
  // Admin: always. With company: when company loaded so we know type (subcontractor vs main). Without company: when we have user.id for assigned_to.
  const canFetchProjects =
    isAdmin ||
    (userCompanyId != null && !isLoadingCompany) ||
    (userCompanyId == null && !!user?.id);

  // Debug: log key state changes
  useEffect(() => {
    console.log('\n🏠 [DASHBOARD STATE UPDATE]');
    console.log('  user.company (raw from auth):', user?.company);
    console.log('  user.company.type (raw):', typeof user?.company === 'object' ? (user.company as any)?.type : 'N/A');
    console.log('  userCompanyId:', userCompanyId);
    console.log('  fetchedCompany:', fetchedCompany);
    console.log('  fetchedCompany.type:', (fetchedCompany as any)?.type);
    console.log('  userCompany (combined):', userCompany);
    console.log('  userCompany.type:', (userCompany as any)?.type);
    console.log('  isSubcontractorCompany:', isSubcontractorCompany);
    console.log('  isLoadingCompany:', isLoadingCompany);
    console.log('  canFetchProjects:', canFetchProjects);
  }, [user, userCompanyId, fetchedCompany, userCompany, isSubcontractorCompany, isLoadingCompany, canFetchProjects]);

  const { data: projectsResponse, isLoading } = useQuery({
    queryKey: ['projects', filters],
    queryFn: () => projectsApi.getAll(filters),
    enabled: canFetchProjects,
  });
  const allProjects = projectsResponse?.data || [];

  // Frontend filtering for main contractors
  const projects = useMemo(() => {
    console.log('\n🏠 [DASHBOARD FRONTEND FILTER]');
    console.log('  Total projects from API:', allProjects.length);
    console.log('  isAdmin:', isAdmin);
    console.log('  userCompanyId:', userCompanyId);
    console.log('  isSubcontractorCompany:', isSubcontractorCompany);

    if (isAdmin || !userCompanyId) {
      console.log('  → Returning ALL projects (reason:', isAdmin ? 'Admin' : 'No Company', ')');
      return allProjects;
    }

    // Subcontractor: show only (1) where subcontractor = my company, or (2) where subcontractor is empty and company = my company.
    if (isSubcontractorCompany) {
      const myDocId = userCompanyId.toString();
      const myNumericId = (userCompany as any)?.id != null ? String((userCompany as any).id) : null;
      const match = (id: string | null) => !!(id && (id === myDocId || (myNumericId && id === myNumericId)));
      const filtered = allProjects.filter((project: Project) => {
        const projSubcontractorId = getRelationId(project.subcontractor);
        const projCompanyId = getRelationId(project.company);
        const hasSubcontractor = projSubcontractorId != null && projSubcontractorId !== '';
        if (hasSubcontractor) return match(projSubcontractorId);
        return match(projCompanyId);
      });
      console.log('  → Subcontractor filter:', filtered.length, 'of', allProjects.length);
      return filtered;
    }

    // Main contractor: filter to show projects where:
    // 1. They are the project's company
    // 2. They are the project's subcontractor
    // 3. The project's subcontractor belongs to them (subcontractor.parent_company matches)
    // 4. The project's subcontractor is in their subcontractors list
    console.log('  → Main contractor filtering...');
    const filtered = allProjects.filter((project: Project) => {
      const projCompanyId = project.company?.documentId || project.company?.id;
      const projSubcontractorId = project.subcontractor?.documentId || project.subcontractor?.id;
      const projSubcontractorParentId = (project.subcontractor as any)?.parent_company?.documentId ||
        (project.subcontractor as any)?.parent_company?.id;

      // Direct assignment
      if (projCompanyId?.toString() === userCompanyId.toString() ||
        projSubcontractorId?.toString() === userCompanyId.toString()) {
        return true;
      }

      // Check if project subcontractor's parent_company is this main contractor
      if (projSubcontractorParentId?.toString() === userCompanyId.toString()) {
        return true;
      }

      // Check if project subcontractor is in our subcontractors list (fallback)
      if ((userCompany as any)?.subcontractors && projSubcontractorId) {
        return (userCompany as any).subcontractors.some((sub: any) =>
          (sub.documentId || sub.id)?.toString() === projSubcontractorId.toString()
        );
      }

      return false;
    });
    console.log('  → Main contractor filtered count:', filtered.length);
    return filtered;
  }, [allProjects, isAdmin, userCompanyId, isSubcontractorCompany, userCompany]);

  // Számoljuk a projekteket státusz szerint
  const totalProjects = projects.length;
  const inProgressProjects = projects.filter(
    (p: Project) => p.status === 'in_progress'
  ).length;
  const completedProjects = projects.filter(
    (p: Project) => p.status === 'completed'
  ).length;

  // Legutóbbi projektek (max 5)
  const recentProjects = projects
    .sort((a: Project, b: Project) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5);

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-3xl font-bold">Dashboard</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Áttekintés a projektekről és statisztikákról
              </p>
            </div>
            {can('projects', 'create') && (
              <Button onClick={() => router.push('/dashboard/projects/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Új projekt
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Összes projekt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : totalProjects}
              </div>
              <p className="text-xs text-gray-500 mt-1">Összesen</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Folyamatban</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : inProgressProjects}
              </div>
              <p className="text-xs text-gray-500 mt-1">Aktív projektek</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Befejezett</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : completedProjects}
              </div>
              <p className="text-xs text-gray-500 mt-1">Befejezett projektek</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dokumentumok</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-gray-500 mt-1">Összes dokumentum</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Legutóbbi projektek</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-gray-500">Betöltés...</p>
              ) : recentProjects.length === 0 ? (
                <p className="text-sm text-gray-500">Még nincsenek projektek</p>
              ) : (
                <div className="space-y-3">
                  {recentProjects.map((project: Project) => {
                    const identifier = project.documentId || project.id;
                    return (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => router.push(`/dashboard/projects/${identifier}`)}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">{project.title}</p>
                          <p className="text-xs text-gray-500">
                            {project.client_name} • {project.client_address}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/projects/${identifier}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Közelgő események</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">Nincsenek ütemezett események</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
