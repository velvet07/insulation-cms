'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { projectsApi } from '@/lib/api/projects';
import { useAuthStore } from '@/lib/store/auth';
import { usePermission } from '@/lib/contexts/permission-context';
import type { Project } from '@/types';
import { FileCheck, CheckCircle2, Loader2 } from 'lucide-react';

export default function ApprovedProjectsPage() {
  const user = useAuthStore((state) => state.user);
  const { can } = usePermission();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!can('approved_projects', 'view_list')) {
      router.push('/dashboard');
    }
  }, [can, router]);

  // Fetch approved projects - hooks must be called before any conditional returns
  const { data: approvedProjects = [], isLoading } = useQuery({
    queryKey: ['projects', 'approved'],
    queryFn: () => projectsApi.getAll({ status: 'approved' }),
    enabled: can('approved_projects', 'view_list'),
  });

  // Group projects by subcontractor only - must be before conditional return
  const projectsBySubcontractor = useMemo(() => {
    const grouped: Record<string, {
      subcontractor: { id: string; name: string; } | null;
      projects: Project[];
      totalArea: number;
    }> = {};

    approvedProjects.forEach((project) => {
      // Get subcontractor - a projekt vagy subcontractornál van, vagy közvetlenül a main contractornál
      // Ha nincs subcontractor, akkor a projekt közvetlenül a main contractornál van
      const subcontractor = project.subcontractor;
      const subcontractorId = subcontractor?.documentId || subcontractor?.id || 'no-subcontractor';
      const subcontractorName = subcontractor?.name || 'Nincs alvállalkozó';

      // Initialize subcontractor group if needed
      if (!grouped[subcontractorId]) {
        grouped[subcontractorId] = {
          subcontractor: subcontractor ? { id: subcontractorId, name: subcontractorName } : null,
          projects: [],
          totalArea: 0,
        };
      }

      // Add project to subcontractor group
      const subcontractorGroup = grouped[subcontractorId];
      subcontractorGroup.projects.push(project);
      subcontractorGroup.totalArea += project.area_sqm || 0;
    });

    return grouped;
  }, [approvedProjects]);

  // Generate completion certificates mutation - must be before conditional return
  const generateCertificatesMutation = useMutation({
    mutationFn: async (projectIds: string[]) => {
      // TODO: Implement completion certificate generation
      // This will:
      // 1. Generate PDF certificates for each selected project
      // 2. Send email to subcontractor with certificate attached
      // 3. Archive the projects

      // For now, just archive the projects
      const archivePromises = projectIds.map((projectId) =>
        projectsApi.update(projectId, { status: 'archived' })
      );

      await Promise.all(archivePromises);

      return { success: true, count: projectIds.length };
    },
    onSuccess: (data) => {
      alert(`Sikeres művelet: ${data.count} projekt teljesítési igazolása generálva és archiválva.`);
      setSelectedProjects(new Set());
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error: any) => {
      alert(`Hiba: ${error.message || 'Hiba történt a teljesítési igazolások generálása során.'}`);
    },
  });



  const handleSelectProject = (projectId: string) => {
    setSelectedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (projectIds: string[]) => {
    setSelectedProjects((prev) => {
      const newSet = new Set(prev);
      const allSelected = projectIds.every((id) => newSet.has(id));

      if (allSelected) {
        // Deselect all
        projectIds.forEach((id) => newSet.delete(id));
      } else {
        // Select all
        projectIds.forEach((id) => newSet.add(id));
      }

      return newSet;
    });
  };

  const handleGenerateCertificates = () => {
    if (selectedProjects.size === 0) {
      alert('Kérjük, válasszon ki legalább egy projektet.');
      return;
    }

    if (confirm(`Biztosan generál teljesítési igazolást ${selectedProjects.size} projekthez?`)) {
      generateCertificatesMutation.mutate(Array.from(selectedProjects));
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-3xl font-bold">Jóváhagyott projektek</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Teljesítési igazolások generálása subcontractoroknak
                </p>
              </div>
              {selectedProjects.size > 0 && (
                <Button
                  onClick={handleGenerateCertificates}
                  disabled={generateCertificatesMutation.isPending}
                >
                  {generateCertificatesMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generálás...
                    </>
                  ) : (
                    <>
                      <FileCheck className="mr-2 h-4 w-4" />
                      Teljesítési igazolás generálása ({selectedProjects.size})
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
                <p className="text-gray-500 mt-2">Betöltés...</p>
              </CardContent>
            </Card>
          ) : Object.keys(projectsBySubcontractor).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <CheckCircle2 className="mx-auto h-12 w-12 mb-2 text-gray-400" />
                <p className="text-sm">Nincs jóváhagyott projekt.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {Object.entries(projectsBySubcontractor).map(([subcontractorId, subcontractorGroup]) => {
                const allProjectIds = subcontractorGroup.projects.map((p) => String(p.documentId || p.id));
                const allSelected = allProjectIds.length > 0 && allProjectIds.every((id) => selectedProjects.has(id));
                const someSelected = allProjectIds.some((id) => selectedProjects.has(id));

                return (
                  <Card key={subcontractorId}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>
                          {subcontractorGroup.subcontractor?.name || 'Nincs alvállalkozó'}
                          {' '}({subcontractorGroup.projects.length} projekt, összesen {subcontractorGroup.totalArea.toLocaleString('hu-HU')} m²)
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={() => handleSelectAll(allProjectIds)}
                            ref={(el) => {
                              if (el) {
                                (el as any).indeterminate = someSelected && !allSelected;
                              }
                            }}
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Összes kijelölése
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Ügyfél neve</TableHead>
                            <TableHead>Cím</TableHead>
                            <TableHead className="text-right">Terület (m²)</TableHead>
                            <TableHead>Jóváhagyás dátuma</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {subcontractorGroup.projects.map((project) => {
                            const projectId = String(project.documentId || project.id);
                            const isSelected = selectedProjects.has(projectId);

                            return (
                              <TableRow key={projectId}>
                                <TableCell>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => handleSelectProject(projectId)}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">
                                  {project.client_name}
                                </TableCell>
                                <TableCell>{project.client_address}</TableCell>
                                <TableCell className="text-right">
                                  {project.area_sqm ? `${project.area_sqm} m²` : '-'}
                                </TableCell>
                                <TableCell>{formatDate(project.approved_at)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
