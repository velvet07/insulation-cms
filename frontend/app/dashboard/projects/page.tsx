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
import { projectsApi, type ProjectFilters, type PaginationMeta } from '@/lib/api/projects';
import type { Project, Company } from '@/types';
import { companiesApi } from '@/lib/api/companies';
import { useAuthStore } from '@/lib/store/auth';
import { isAdminRole, isMainContractor } from '@/lib/utils/user-role';
import { usePermission } from '@/lib/contexts/permission-context';
import { Plus, Search, Eye, Edit, Trash2, Download, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

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

// Generate page numbers with ellipsis for pagination
function generatePageNumbers(currentPage: number, pageCount: number): (number | string)[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const pages: (number | string)[] = [];

  // Always show first page
  pages.push(1);

  if (currentPage > 3) {
    pages.push('...');
  }

  // Show pages around current page
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(pageCount - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    if (!pages.includes(i)) {
      pages.push(i);
    }
  }

  if (currentPage < pageCount - 2) {
    pages.push('...');
  }

  // Always show last page
  if (!pages.includes(pageCount)) {
    pages.push(pageCount);
  }

  return pages;
}

export default function ProjectsPage() {
  const debugLogs =
    typeof window !== 'undefined' &&
    (localStorage.getItem('debug_projects') === '1' || localStorage.getItem('debug') === '1');

  const debug = (...args: unknown[]) => {
    if (!debugLogs) return;
    // Using console.debug so it can be filtered in DevTools.
    console.debug(...args);
  };

  if (typeof window !== 'undefined') {
    debug('🔴 [DEBUG] FRONTEND KÓD FUT! Ha ezt látod, a logolás működik.');
  }
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAdmin = isAdminRole(user);
  const { can } = usePermission();
  const canExportZip = can('projects', 'export_zip');
  const canViewList = can('projects', 'view_list');

  useEffect(() => {
    if (!canViewList) {
      router.push('/dashboard');
    }
  }, [canViewList, router]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Project['status'] | 'all'>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Build filters - if user is not admin, filter by company or assigned_to
  // Note: Owner filter is applied on frontend because "owner" can be either subcontractor or company
  // Default: exclude archived projects unless explicitly filtered
  debug('🔧 [FILTER] Building filters...');
  debug('  User:', { id: user?.id, email: user?.email, role: user?.role });
  debug('  User Company:', user?.company);
  debug('  Is Admin:', isAdmin);
  debug('  Is Main Contractor:', isMainContractor(user));

  const filters: ProjectFilters = {
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(search && { search }),
    // Exclude archived by default - only show if explicitly filtered
    ...(statusFilter !== 'archived' && { status_not: 'archived' }),
    page: currentPage,
    pageSize,
  };

  // If user is not admin (or role is undefined), filter by company or assigned_to
  if (!isAdmin) {
    debug('  User is NOT admin, applying company/user filters...');
    if (user?.company) {
      const company = user.company as any;
      const companyId = company.documentId || company.id;
      debug('  Company ID:', companyId, 'Type:', company.type);

      if (company.type === 'subcontractor' || (company.type as any) === 'Alvállalkozó') {
        // For subcontractor: show only projects where they are the assigned subcontractor
        filters.subcontractor = companyId;
        debug('  ✓ Applied SUBCONTRACTOR filter:', companyId);
      } else {
        debug('  ✓ Main Contractor detected - NO backend filter applied (will filter on frontend)');
      }
      // For main contractor: show ALL projects (no company filter)
      // This way they can see projects created by subcontractors under their management
    } else if (user?.id) {
      // If user has no company, show only projects assigned to this user
      filters.assigned_to = user.id;
      debug('  ✓ Applied ASSIGNED_TO filter:', user.id);
    }
  } else {
    debug('  User is ADMIN - no filters applied');
  }

  debug('🎯 [FILTER] Final filters to send to API:', filters);

  const { data: projectsResponse, isLoading, error } = useQuery({
    queryKey: ['projects', filters],
    queryFn: () => projectsApi.getAll(filters),
  });

  const allProjects = projectsResponse?.data || [];
  const paginationMeta: PaginationMeta = projectsResponse?.meta?.pagination || {
    page: currentPage,
    pageSize,
    pageCount: 1,
    total: 0,
  };

  // Reset to page 1 when filters change (except page itself)
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, ownerFilter]);

  // Get user company ID
  const userCompanyId = useMemo(() => {
    if (!user?.company) {
      debug('💼 [COMPANY] User has no company');
      return null;
    }
    const id = typeof user.company === 'object' ? (user.company as any).documentId || (user.company as any).id : user.company;
    debug('💼 [COMPANY] userCompanyId calculated:', id, 'from user.company:', user?.company);
    return id;
  }, [user]);

  // Fetch user's company details to get subcontractors list
  const { data: fetchedCompany, isLoading: isLoadingCompany } = useQuery({
    queryKey: ['company', userCompanyId, 'with-subs'],
    queryFn: async () => {
      debug('🏢 [COMPANY] Fetching company details for:', userCompanyId);
      const res = await companiesApi.getOne(userCompanyId!, 'subcontractors');
      debug('🏢 [COMPANY] Fetched company details:', res);
      debug('🏢 [COMPANY] Subcontractors count:', res?.subcontractors?.length || 0);
      return res;
    },
    enabled: !!userCompanyId,
  });

  const userCompany = fetchedCompany || (typeof user?.company === 'object' ? user.company : null);

  useEffect(() => {
    debug('\n========================================');
    debug('👤 [USER INFO] Current User:', user);
    debug('👤 [USER INFO] User Company (Combined):', userCompany);
    debug('👤 [USER INFO] Is Admin:', isAdmin);
    debug('👤 [USER INFO] Is Main Contractor:', isMainContractor(user));
    debug('========================================\n');
  }, [user, userCompany, isAdmin]);

  // Frontend filtering for main contractors - show projects where they are company OR subcontractor OR project subcontractor is theirs
  const filteredProjects = useMemo(() => {
    // TEMP DEBUG - always log
    console.log('[PROJECTS DEBUG] ====== FILTERING START ======');
    console.log('[PROJECTS DEBUG] allProjects.length:', allProjects.length);
    console.log('[PROJECTS DEBUG] userCompanyId:', userCompanyId);
    console.log('[PROJECTS DEBUG] userCompany:', userCompany);
    console.log('[PROJECTS DEBUG] userCompany.type:', userCompany?.type);
    console.log('[PROJECTS DEBUG] userCompany.subcontractors:', userCompany?.subcontractors);
    console.log('[PROJECTS DEBUG] isAdmin:', isAdmin);

    debug('\n🔍 [FRONTEND FILTER] Starting frontend filtering...');
    debug('📊 [FRONTEND FILTER] Total projects from API:', allProjects.length);

    // userCompanyId is already calculated above
    const isSubcontractor = userCompany?.type === 'subcontractor' || (userCompany?.type as any) === 'Alvállalkozó';

    console.log('[PROJECTS DEBUG] isSubcontractor:', isSubcontractor);

    debug('🔍 [FRONTEND FILTER] User Company ID:', userCompanyId);
    debug('🔍 [FRONTEND FILTER] Is Subcontractor:', isSubcontractor);
    debug('🔍 [FRONTEND FILTER] User Company Type:', userCompany?.type);

    // Check if user is main contractor
    const isMainContractor = userCompany?.type === 'main_contractor';

    // Admin, main contractor, and users without company see all projects
    // Main contractor sees all because they need oversight of all work
    // Subcontractor projects are filtered by backend
    if (isAdmin || !userCompanyId || isSubcontractor || isMainContractor) {
      console.log('[PROJECTS DEBUG] Returning ALL - reason:',
        isAdmin ? 'admin' :
        isMainContractor ? 'main contractor (sees all)' :
        !userCompanyId ? 'no company' : 'subcontractor');
      debug('✅ [FRONTEND FILTER] Returning ALL projects (Admin/NoCompany/Subcontractor/MainContractor)');
      debug('   Reason:', isAdmin ? 'Admin' : isMainContractor ? 'Main Contractor' : !userCompanyId ? 'No Company' : 'Subcontractor');
      return allProjects;
    }

    console.log('[PROJECTS DEBUG] Main contractor filtering...');
    debug('🔍 [FRONTEND FILTER] Main Contractor detected - filtering projects...');
    debug('🔍 [FRONTEND FILTER] Available subcontractors:', userCompany?.subcontractors?.length || 0);

    // Log first project details
    if (allProjects.length > 0) {
      const p = allProjects[0];
      console.log('[PROJECTS DEBUG] First project:', {
        id: p.id,
        company: p.company,
        subcontractor: p.subcontractor,
        'subcontractor.parent_company': (p.subcontractor as any)?.parent_company
      });
    }

    // Main contractor: show projects where:
    // 1. They are the project's company
    // 2. They are the project's subcontractor (rare but possible)
    // 3. The project's subcontractor belongs to them (subcontractor.parent_company matches)
    // 4. The project's subcontractor is in their subcontractors list
    const filtered = allProjects.filter((project) => {
      const projCompanyId = project.company?.documentId || project.company?.id;
      const projSubcontractorId = project.subcontractor?.documentId || project.subcontractor?.id;
      const projSubcontractorParentId = project.subcontractor?.parent_company?.documentId ||
        project.subcontractor?.parent_company?.id;

      console.log(`[PROJECTS DEBUG] Project ${project.id}:`, {
        projCompanyId,
        projSubcontractorId,
        projSubcontractorParentId,
        userCompanyId: userCompanyId?.toString()
      });

      // Check if main contractor is directly assigned as company or subcontractor
      const isDirectlyAssigned = projCompanyId?.toString() === userCompanyId.toString() ||
        projSubcontractorId?.toString() === userCompanyId.toString();

      // Check if project's subcontractor belongs to this main contractor (via parent_company)
      const isSubcontractorBelongsToUs = projSubcontractorParentId?.toString() === userCompanyId.toString();

      // Check if project's subcontractor is in our subcontractors list
      let isInOurSubcontractorsList = false;
      if (userCompany?.subcontractors && projSubcontractorId) {
        isInOurSubcontractorsList = userCompany.subcontractors.some((sub: any) =>
          (sub.documentId || sub.id)?.toString() === projSubcontractorId.toString()
        );
      }

      const shouldInclude = isDirectlyAssigned || isSubcontractorBelongsToUs || isInOurSubcontractorsList;
      console.log(`[PROJECTS DEBUG] Project ${project.id}: ${shouldInclude ? 'INCLUDED' : 'EXCLUDED'} (direct=${isDirectlyAssigned}, parent=${isSubcontractorBelongsToUs}, list=${isInOurSubcontractorsList})`);

      return shouldInclude;
    });

    console.log('[PROJECTS DEBUG] Filtered count:', filtered.length);
    console.log('[PROJECTS DEBUG] ====== FILTERING END ======');
    debug('\n📦 [FRONTEND FILTER] Filtered projects count:', filtered.length);
    debug('========================================\n');
    return filtered;
  }, [allProjects, user, userCompany, userCompanyId, isAdmin]);

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

  // keep selection in sync with current filtered list (drop ids that are no longer visible)
  useEffect(() => {
    if (!canExportZip) {
      // If user can't export, we don't keep/collect selections.
      setSelectedProjectIds((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    setSelectedProjectIds((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(projects.map((p) => (p.documentId || p.id).toString()));
      const next = new Set(Array.from(prev).filter((id) => visible.has(id)));
      // Avoid infinite re-render loop: only update state if selection actually changed.
      if (next.size === prev.size) {
        let same = true;
        for (const id of next) {
          if (!prev.has(id)) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return next;
    });
  }, [projects, canExportZip]);

  const toggleSelectAll = () => {
    if (!canExportZip) return;
    const visibleIds = projects.map((p) => (p.documentId || p.id).toString());
    setSelectedProjectIds((prev) => {
      if (visibleIds.length > 0 && prev.size === visibleIds.length) {
        return new Set();
      }
      return new Set(visibleIds);
    });
  };

  const toggleSelectOne = (id: string) => {
    if (!canExportZip) return;
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkExport = async () => {
    if (!canExportZip) return;
    if (selectedProjectIds.size === 0) return;
    setIsExporting(true);
    try {
      const ids = Array.from(selectedProjectIds);
      const { blob, filename } = await projectsApi.bulkExport(ids);
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = filename;
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

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
              <h2 className="text-3xl font-bold">Projektek</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Kezelje a padlásfödém szigetelési projekteket
              </p>
            </div>
            <div className="flex gap-2">
              {canExportZip && (
                <Button
                  variant="outline"
                  onClick={handleBulkExport}
                  disabled={selectedProjectIds.size === 0 || isExporting}
                  title="Kiválasztott projektek exportálása ZIP-be"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isExporting ? 'Export...' : `Export ZIP (${selectedProjectIds.size})`}
                </Button>
              )}
              {can('projects', 'create') && (
                <>
                  <Button variant="outline" onClick={() => router.push('/dashboard/projects/import')}>
                    <Upload className="mr-2 h-4 w-4" />
                    Import
                  </Button>
                  <Button onClick={() => router.push('/dashboard/projects/new')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Új projekt
                  </Button>
                </>
              )}
            </div>
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
            {isAdmin && uniqueOwners.length > 0 && (
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
                  {canExportZip && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={projects.length > 0 && selectedProjectIds.size === projects.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Összes kijelölése"
                      />
                    </TableHead>
                  )}
                  <TableHead>Projekt neve</TableHead>
                  <TableHead>Ügyfél neve</TableHead>
                  <TableHead>Cím</TableHead>
                  <TableHead>Terület (m²)</TableHead>
                  <TableHead>Szigetelés</TableHead>
                  <TableHead>Státusz</TableHead>
                  <TableHead>Tulajdonos</TableHead>
                  {isAdmin && <TableHead>Fővállalkozó</TableHead>}
                  <TableHead className="text-right">Műveletek</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    {canExportZip && (
                      <TableCell>
                        <Checkbox
                          checked={selectedProjectIds.has((project.documentId || project.id).toString())}
                          onCheckedChange={() => toggleSelectOne((project.documentId || project.id).toString())}
                          aria-label="Projekt kijelölése"
                        />
                      </TableCell>
                    )}
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
                    {isAdmin && (
                      <TableCell>
                        {project.subcontractor ? (project.subcontractor.parent_company?.name ?? '-') : '-'}
                      </TableCell>
                    )}
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

        {/* Pagination */}
        {paginationMeta.total > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Összesen {paginationMeta.total} projekt
              {paginationMeta.pageCount > 1 && (
                <span> • {currentPage}. oldal / {paginationMeta.pageCount}</span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Oldalméret:</span>
                <Select value={pageSize.toString()} onValueChange={(value) => { setPageSize(Number(value)); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {paginationMeta.pageCount > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    title="Első oldal"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <ChevronLeft className="h-4 w-4 -ml-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    title="Előző oldal"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1 px-2">
                    {generatePageNumbers(currentPage, paginationMeta.pageCount).map((pageNum, idx) => (
                      pageNum === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                      ) : (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? 'default' : 'outline'}
                          size="icon"
                          onClick={() => setCurrentPage(pageNum as number)}
                          className="w-8 h-8"
                        >
                          {pageNum}
                        </Button>
                      )
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage((prev) => Math.min(paginationMeta.pageCount, prev + 1))}
                    disabled={currentPage === paginationMeta.pageCount}
                    title="Következő oldal"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(paginationMeta.pageCount)}
                    disabled={currentPage === paginationMeta.pageCount}
                    title="Utolsó oldal"
                  >
                    <ChevronRight className="h-4 w-4" />
                    <ChevronRight className="h-4 w-4 -ml-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
