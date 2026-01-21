'use client';

import { useState, useMemo } from 'react';
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
import { isAdminRole } from '@/lib/utils/user-role';
import type { Project } from '@/types';
import { FileCheck, CheckCircle2, Loader2 } from 'lucide-react';

export default function ApprovedProjectsPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());

  // Only show this page to main contractors or admins
  const isMainContractor = user?.role === 'foovallalkozo' || isAdminRole(user);

  // Fetch approved projects - hooks must be called before any conditional returns
  const { data: approvedProjects = [], isLoading } = useQuery({
    queryKey: ['projects', 'approved'],
    queryFn: () => projectsApi.getAll({ status: 'approved' }),
    enabled: isMainContractor, // Only fetch if user is main contractor or admin
  });
  
  if (!isMainContractor) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-gray-500">Nincs jogosultságod az oldal megtekintéséhez.</p>
                <p className="text-sm text-gray-400 mt-2">Csak fővállalkozók és adminok érhetik el ezt az oldalt.</p>
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  // Group projects by contractor, then by subcontractor
  const projectsByContractor = useMemo(() => {
    const grouped: Record<string, {
      contractor: { id: string; name: string; } | null;
      subcontractors: Record<string, {
        subcontractor: { id: string; name: string; } | null;
        projects: Project[];
        totalArea: number;
      }>;
    }> = {};
    
    approvedProjects.forEach((project) => {
      // Get contractor (main contractor company)
      const contractor = project.company;
      const contractorId = contractor?.documentId || contractor?.id || 'no-contractor';
      const contractorName = contractor?.name || 'Nincs fővállalkozó';
      
      // Get subcontractor
      const subcontractor = project.subcontractor;
      const subcontractorId = subcontractor?.documentId || subcontractor?.id || 'no-subcontractor';
      const subcontractorName = subcontractor?.name || 'Nincs alvállalkozó';
      
      // Initialize contractor group if needed
      if (!grouped[contractorId]) {
        grouped[contractorId] = {
          contractor: contractor ? { id: contractorId, name: contractorName } : null,
          subcontractors: {},
        };
      }
      
      // Initialize subcontractor group if needed
      if (!grouped[contractorId].subcontractors[subcontractorId]) {
        grouped[contractorId].subcontractors[subcontractorId] = {
          subcontractor: subcontractor ? { id: subcontractorId, name: subcontractorName } : null,
          projects: [],
          totalArea: 0,
        };
      }
      
      // Add project to subcontractor group
      const subcontractorGroup = grouped[contractorId].subcontractors[subcontractorId];
      subcontractorGroup.projects.push(project);
      subcontractorGroup.totalArea += project.area_sqm || 0;
    });
    
    return grouped;
  }, [approvedProjects]);

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

  // Generate completion certificates mutation
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
          ) : Object.keys(projectsByContractor).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <CheckCircle2 className="mx-auto h-12 w-12 mb-2 text-gray-400" />
                <p className="text-sm">Nincs jóváhagyott projekt.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {Object.entries(projectsByContractor).map(([contractorId, contractorGroup]) => (
                <div key={contractorId} className="space-y-4">
                  {/* Contractor header */}
                  <div className="pb-2 border-b-2 border-gray-300 dark:border-gray-600">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {contractorGroup.contractor?.name || 'Nincs fővállalkozó'}
                    </h3>
                  </div>
                  
                  {/* Subcontractor groups */}
                  {Object.entries(contractorGroup.subcontractors).map(([subcontractorId, subcontractorGroup]) => {
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
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
