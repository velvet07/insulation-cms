'use client';

import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, FileEdit, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth';
import { useEffect } from 'react';
import { usePermission } from '@/lib/contexts/permission-context';

export default function DocumentsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const { can } = usePermission();

  useEffect(() => {
    if (!can('documents', 'view_list')) {
      router.push('/dashboard');
    }
  }, [can, router]);

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Dokumentumok</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Kezelje a projekt dokumentumokat és sablonokat
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/dashboard/documents/templates')}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FileEdit className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <CardTitle>Dokumentum sablonok</CardTitle>
                  <CardDescription>
                    Dokumentum sablonok kezelése és szerkesztése
                  </CardDescription>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Hozzon létre, szerkesszen vagy töröljön dokumentum sablonokat. A sablonok DOCX formátumban
                tárolódnak, és tokenekkel ({'{token_name}'}) helyettesíthetők a projekt adataival.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <CardTitle>Összes dokumentum</CardTitle>
                  <CardDescription>
                    Az összes projekt dokumentumainak áttekintése
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Az összes projekt dokumentumainak listája hamarosan itt jelenik meg.
              </p>
              <Button variant="outline" disabled>
                Hamarosan elérhető
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Gyors műveletek</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button onClick={() => router.push('/dashboard/documents/templates')}>
                  <FileEdit className="mr-2 h-4 w-4" />
                  Sablonok kezelése
                </Button>
                <Button variant="outline" onClick={() => router.push('/dashboard/projects')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Projektek megtekintése
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
