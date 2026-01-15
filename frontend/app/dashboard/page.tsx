'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import type { Project } from '@/types';
import { Plus, Eye } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll(),
  });

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
            <Button onClick={() => router.push('/dashboard/projects/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Új projekt
            </Button>
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
