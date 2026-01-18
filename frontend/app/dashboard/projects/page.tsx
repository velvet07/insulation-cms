'use client';

import { useState } from 'react';
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
import type { Project } from '@/types';
import { useAuthStore } from '@/lib/store/auth';
import { isAdminRole } from '@/lib/utils/user-role';
import { Plus, Search, Eye, Edit, Trash2 } from 'lucide-react';

const statusLabels: Record<Project['status'], string> = {
  pending: 'Függőben',
  in_progress: 'Folyamatban',
  ready_for_review: 'Átnézésre vár',
  approved: 'Jóváhagyva',
  completed: 'Befejezve',
};

const statusColors: Record<Project['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ready_for_review: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

export default function ProjectsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Project['status'] | 'all'>('all');

  // Build filters - if user is not admin, filter by tenant or company
  const filters: ProjectFilters = {
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(search && { search }),
  };

  // If user is not admin, filter by tenant or company
  if (!isAdminRole(user)) {
    if (user?.tenant?.id || user?.tenant?.documentId) {
      filters.tenant = parseInt(user.tenant.documentId || user.tenant.id.toString());
    }
    // TODO: Add company filter when company is implemented on projects
  }

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['projects', filters],
    queryFn: () => projectsApi.getAll(filters),
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
              <h2 className="text-3xl font-bold">Projektek</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Kezelje a padlásfödém szigetelési projekteket
              </p>
            </div>
            <Button onClick={() => router.push('/dashboard/projects/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Új projekt
            </Button>
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
              </SelectContent>
            </Select>
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
            <Button onClick={() => router.push('/dashboard/projects/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Hozzon létre első projektet
            </Button>
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
                  <TableHead>Hozzárendelve</TableHead>
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
                      {project.assigned_to?.email || project.assigned_to?.username || '-'}
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(project)}
                          title="Szerkesztés"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(project)}
                          title="Törlés"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
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
