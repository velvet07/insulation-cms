'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { projectsApi, type ProjectFilters } from '@/lib/api/projects';
import type { Project, Company } from '@/types';
import { companiesApi } from '@/lib/api/companies';
import { useAuthStore } from '@/lib/store/auth';
import { isAdminRole, isMainContractor } from '@/lib/utils/user-role';
import { usePermission } from '@/lib/contexts/permission-context';
import { Plus, Search, Eye, Edit, Trash2 } from 'lucide-react';

const statusLabels: Record<Project['status'], string> = {
  pending: 'Függőben',
  in_progress: 'Folyamatban',
  ready_for_review: 'Átnézésre vár',
  sent_back_for_revision: 'Visszaküldve javításra',
  approved: 'Jóváhagyva',
  completed: 'Befejezve',
  archived: 'Archivált',
};

const statusColors: Record<Project['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ready_for_review: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  sent_back_for_revision: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  archived: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
};

export default function ProjectsPage() {
  if (typeof window !== 'undefined') {
    console.error('🔴 [DEBUG] FRONTEND KÓD FUT! Ha ezt látod, a logolás működik.');
    document.title = 'DEBUG: Projektek';
  }
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { can } = usePermission();

  useEffect(() => {
    if (!can('projects', 'view_list')) {
      router.push('/dashboard');
    }
  }, [can, router]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Project['status'] | 'all'>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');

  // Build filters - if user is not admin, filter by company or assigned_to
  // Note: Owner filter is applied on frontend because "owner" can be either subcontractor or company
  // Default: exclude archived projects unless explicitly filtered
  console.error('🔧 [FILTER] Building filters...');
  console.error('  User:', { id: user?.id, email: user?.email, role: user?.role });
  console.error('  User Company:', user?.company);
  console.error('  Is Admin:', isAdminRole(user));
  console.error('  Is Main Contractor:', isMainContractor(user));

  const filters: ProjectFilters = {
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(search && { search }),
    // Exclude archived by default - only show if explicitly filtered
    ...(statusFilter !== 'archived' && { status_not: 'archived' }),
  };

  // If user is not admin (or role is undefined), filter by company or assigned_to
  if (!isAdminRole(user)) {
    console.error('  User is NOT admin, applying company/user filters...');
    if (user?.company) {
      const company = user.company as any;
      const companyId = company.documentId || company.id;
      console.error('  Company ID:', companyId, 'Type:', company.type);

      if (company.type === 'subcontractor' || (company.type as any) === 'Alvállalkozó') {
        // For subcontractor: show only projects where they are the assigned subcontractor
        filters.subcontractor = companyId;
        console.error('  ✓ Applied SUBCONTRACTOR filter:', companyId);
      } else {
        console.error('  ✓ Main Contractor detected - NO backend filter applied (will filter on frontend)');
      }
      // For main contractor: show ALL projects (no company filter)
      // This way they can see projects created by subcontractors under their management
    } else if (user?.id) {
      // If user has no company, show only projects assigned to this user
      filters.assigned_to = user.id;
      console.error('  ✓ Applied ASSIGNED_TO filter:', user.id);
    }
  } else {
    console.error('  User is ADMIN - no filters applied');
  }

  console.error('🎯 [FILTER] Final filters to send to API:', filters);

  const { data: allProjects = [], isLoading, error } = useQuery({
    queryKey: ['projects', filters],
    queryFn: () => projectsApi.getAll(filters),
  });

  // Get user company ID
  const userCompanyId = useMemo(() => {
    if (!user?.company) {
      console.error('💼 [COMPANY] User has no company');
      return null;
    }
    const id = typeof user.company === 'object' ? (user.company as any).documentId || (user.company as any).id : user.company;
    console.error('💼 [COMPANY] userCompanyId calculated:', id, 'from user.company:', user?.company);
    return id;
  }, [user]);

  // Fetch user's company details to get subcontractors list
  const { data: fetchedCompany, isLoading: isLoadingCompany } = useQuery({
    queryKey: ['company', userCompanyId, 'with-subs'],
    queryFn: async () => {
      console.error('🏢 [COMPANY] Fetching company details for:', userCompanyId);
      const res = await companiesApi.getOne(userCompanyId!, 'subcontractors');
      console.error('🏢 [COMPANY] Fetched company details:', res);
      console.error('🏢 [COMPANY] Subcontractors:', res?.subcontractors);
      console.error('🏢 [COMPANY] Subcontractors count:', res?.subcontractors?.length || 0);
      if (res?.subcontractors && res.subcontractors.length > 0) {
        console.error('🏢 [COMPANY] Subcontractor IDs:', res.subcontractors.map((s: any) => s.documentId || s.id));
      }
      return res;
    },
    enabled: !!userCompanyId,
  });

  const userCompany = fetchedCompany || (typeof user?.company === 'object' ? user.company : null);

  useEffect(() => {
    console.error('\n========================================');
    console.error('👤 [USER INFO] Current User:', user);
    console.error('👤 [USER INFO] User Company (Combined):', userCompany);
    console.error('👤 [USER INFO] Is Admin:', isAdminRole(user));
    console.error('👤 [USER INFO] Is Main Contractor:', isMainContractor(user));
    console.error('========================================\n');
  }, [user, userCompany]);

  // Frontend filtering for main contractors - show projects where they are company OR subcontractor OR project subcontractor is theirs
  const filteredProjects = useMemo(() => {
    console.error('\n🔍 [FRONTEND FILTER] Starting frontend filtering...');
    console.error('📊 [FRONTEND FILTER] Total projects from API:', allProjects.length);

    // userCompanyId is already calculated above
    const isSubcontractor = userCompany?.type === 'subcontractor' || (userCompany?.type as any) === 'Alvállalkozó';

    console.error('🔍 [FRONTEND FILTER] User Company ID:', userCompanyId);
    console.error('🔍 [FRONTEND FILTER] Is Subcontractor:', isSubcontractor);
    console.error('🔍 [FRONTEND FILTER] User Company Type:', userCompany?.type);

    // Admin sees all, subcontractors already filtered by backend, no company = no filter
    if (isAdminRole(user) || !userCompanyId || isSubcontractor) {
      console.error('✅ [FRONTEND FILTER] Returning ALL projects (Admin/NoCompany/Subcontractor)');
      console.error('   Reason:', isAdminRole(user) ? 'Admin' : !userCompanyId ? 'No Company' : 'Subcontractor');
      return allProjects;
    }

    console.error('🔍 [FRONTEND FILTER] Main Contractor detected - filtering projects...');
    console.error('🔍 [FRONTEND FILTER] Available subcontractors:', userCompany?.subcontractors?.length || 0);
    if (userCompany?.subcontractors && userCompany.subcontractors.length > 0) {
      console.error('🔍 [FRONTEND FILTER] Subcontractor IDs:', userCompany.subcontractors.map((s: any) => ({
        id: s.id,
        documentId: s.documentId,
        name: s.name
      })));
    }

    // Main contractor: show projects where they are company OR subcontractor OR project subcontractor is one of their subcontractors
    const filtered = allProjects.filter((project) => {
      const projCompanyId = project.company?.documentId || project.company?.id;
      const projSubcontractorId = project.subcontractor?.documentId || project.subcontractor?.id;

      const isDirectlyAssigned = projCompanyId?.toString() === userCompanyId.toString() ||
        projSubcontractorId?.toString() === userCompanyId.toString();

      let isSubcontractorAssigned = false;
      if (userCompany?.subcontractors && projSubcontractorId) {
        isSubcontractorAssigned = userCompany.subcontractors.some((sub: any) =>
          (sub.documentId || sub.id)?.toString() === projSubcontractorId.toString()
        );
      }

      const shouldInclude = isDirectlyAssigned || isSubcontractorAssigned;

      console.error(`  ${shouldInclude ? '✅' : '❌'} Project ${project.id} "${project.title}":`, {
        projCompanyId,
        projCompanyName: project.company?.name,
        projSubcontractorId,
        projSubcontractorName: project.subcontractor?.name,
        userCompanyId,
        isDirectlyAssigned,
        isSubcontractorAssigned,
        subcontractorsCount: userCompany?.subcontractors?.length,
        RESULT: shouldInclude ? 'INCLUDED' : 'EXCLUDED'
      });

      return shouldInclude;
    });

    console.error('\n📦 [FRONTEND FILTER] Filtered projects count:', filtered.length);
    console.error('========================================\n');
    return filtered;
  }, [allProjects, user, userCompany, userCompanyId]);

  // Extract unique owners from FILTERED projects
  const uniqueOwners = useMemo(() => {
    const ownerMap = new Map<string, Company>();

    filteredProjects.forEach((project) => {
      const owner = project.subcontractor || project.company;
      if (owner) {
        const ownerId = owner.documentId || owner.id;
        if (ownerId) {
          const idString = ownerId.toString();
          if (!ownerMap.has(idString)) {
            ownerMap.set(idString, owner);
          }
        }
      }
    });

    return Array.from(ownerMap.values()).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
  }, [filteredProjects]);

  // Filter by owner on frontend if ownerFilter is set
  // This is needed because "owner" can be either subcontractor (if exists) or company (if no subcontractor)
  const projects = ownerFilter === 'all'
    ? filteredProjects
    : filteredProjects.filter((project) => {
      // Owner is subcontractor if exists, otherwise company
      const ownerId = project.subcontractor?.documentId || project.subcontractor?.id ||
        project.company?.documentId || project.company?.id;
      const filterId = ownerFilter;
      // Compare both documentId and id formats (convert to string for comparison)
      return ownerId?.toString() === filterId;
    });

  const handleView = (project: Project) => {
    // Use documentId if available (Strapi v5), otherwise use id
    const identifier = project.documentId || project.id;
    router.push(`/dashboard/projects/${identifier}`);
  };

  const handleEdit = (project: Project) => {
    // Use documentId if available (Strapi v5), otherwise use id
    const identifier = project.documentId || project.id;
    router.push(`/dashboard/projects/${identifier}/edit`);
  };

  const handleDelete = async (project: Project) => {
    if (confirm('Biztosan törölni szeretné ezt a projektet?')) {
      try {
        // Use documentId if available (Strapi v5), otherwise use id
        const identifier = project.documentId || project.id;
        await projectsApi.delete(identifier);
        // Refetch projects
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      } catch (error: any) {
        console.error('Error deleting project:', error);
        const errorMessage = error?.message || 'Hiba történt a projekt törlése során.';
        alert(errorMessage);
        // Don't redirect on error
      }
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold text-red-600">Projektek (DEBUG MÓD)</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Kezelje a padlásfödém szigetelési projekteket
              </p>
            </div>
            {can('projects', 'create') && (
              <Button onClick={() => router.push('/dashboard/projects/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Új projekt
              </Button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Keresés (név, cím)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as Project['status'] | 'all')}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Státusz szűrő" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Összes státusz</SelectItem>
                <SelectItem value="pending">Függőben</SelectItem>
                <SelectItem value="in_progress">Folyamatban</SelectItem>
                <SelectItem value="ready_for_review">Átnézésre vár</SelectItem>
                <SelectItem value="approved">Jóváhagyva</SelectItem>
                <SelectItem value="completed">Befejezve</SelectItem>
                <SelectItem value="archived">Archivált</SelectItem>
              </SelectContent>
            </Select>
            {isAdminRole(user) && uniqueOwners.length > 0 && (
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Tulajdonos szűrő" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Összes tulajdonos</SelectItem>
                  {uniqueOwners.map((owner) => {
                    const ownerId = owner.documentId || owner.id;
                    return (
                      <SelectItem key={ownerId?.toString()} value={ownerId?.toString() || ''}>
                        {owner.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Projects Table */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Betöltés...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500">Hiba történt a projektek betöltése során.</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">Nincsenek projektek.</p>
            {can('projects', 'create') && (
              <Button onClick={() => router.push('/dashboard/projects/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Hozzon létre első projektet
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projekt neve</TableHead>
                  <TableHead>Ügyfél neve</TableHead>
                  <TableHead>Cím</TableHead>
                  <TableHead>Terület (m²)</TableHead>
                  <TableHead>Szigetelés</TableHead>
                  <TableHead>Státusz</TableHead>
                  <TableHead>Tulajdonos</TableHead>
                  <TableHead className="text-right">Műveletek</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <button
                        onClick={() => handleView(project)}
                        className="font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer text-left"
                      >
                        {project.title}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">{project.client_name}</TableCell>
                    <TableCell>
                      {project.client_street && project.client_city && project.client_zip
                        ? `${project.client_zip} ${project.client_city}, ${project.client_street}`
                        : project.client_address || '-'}
                    </TableCell>
                    <TableCell>{project.area_sqm ? `${project.area_sqm} m²` : '-'}</TableCell>
                    <TableCell>{project.insulation_option || '-'}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[project.status as Project['status']]}`}
                      >
                        {statusLabels[project.status as Project['status']]}
                      </span>
                    </TableCell>
                    <TableCell>
                      {project.subcontractor?.name || project.company?.name || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleView(project)}
                          title="Megtekintés"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {can('projects', 'edit') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(project)}
                            title="Szerkesztés"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {can('projects', 'delete') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(project)}
                            title="Törlés"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination - TODO: implement later */}
        {projects.length > 0 && (
          <div className="mt-4 text-sm text-gray-500 text-center">
            {projects.length} projekt találat
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
