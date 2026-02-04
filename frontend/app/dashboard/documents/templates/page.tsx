'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/lib/store/auth';
import { usePermission } from '@/lib/contexts/permission-context';
import { isAdminRole } from '@/lib/utils/user-role';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { templatesApi } from '@/lib/api/templates';
import { TEMPLATE_TYPE_LABELS, type Template, type TemplateType, type Company } from '@/types';
import { Plus, Edit, Trash2, FileText } from 'lucide-react';

export default function TemplatesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { can } = usePermission();
  const isAdmin = isAdminRole(user);

  // Check permission - redirect if user cannot view templates
  if (!can('documents', 'view_list')) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-gray-500">Nincs jogosultságod az oldal megtekintéséhez.</p>
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  // Check if user can manage templates
  const canManageTemplates = can('documents', 'manage_templates');

  // Get user's company (for filtering templates)
  const getUserCompanyId = (): string | undefined => {
    if (!user?.company) return undefined;
    if (typeof user.company === 'object' && user.company !== null) {
      return (user.company as Company).documentId || String((user.company as Company).id);
    }
    return String(user.company);
  };

  const userCompanyId = getUserCompanyId();

  // Fetch templates - filter by user's company if not admin
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates', userCompanyId, isAdmin],
    queryFn: () => {
      // Admin sees all templates, others see only their company's templates
      if (isAdmin) {
        return templatesApi.getAll();
      }
      return templatesApi.getAll(userCompanyId ? { company: userCompanyId } : undefined);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      return templatesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (error: any) => {
      console.error('Error deleting template:', error);
      alert(error?.message || 'Hiba történt a sablon törlése során.');
    },
  });

  const handleEdit = (template: Template) => {
    const identifier = template.documentId || template.id;
    router.push(`/dashboard/documents/templates/${identifier}`);
  };

  const handleDelete = (template: Template) => {
    if (confirm(`Biztosan törölni szeretné a "${template.name}" sablont?`)) {
      const identifier = template.documentId || template.id;
      deleteMutation.mutate(identifier);
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold">Dokumentum sablonok</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Dokumentum sablonok kezelése és szerkesztése
              </p>
            </div>
            {canManageTemplates && (
              <Button onClick={() => router.push('/dashboard/documents/templates/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Új sablon
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Sablonok betöltése...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">Még nincsenek sablonok.</p>
              {canManageTemplates && (
                <Button onClick={() => router.push('/dashboard/documents/templates/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Első sablon létrehozása
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Név</TableHead>
                    <TableHead>Típus</TableHead>
                    {isAdmin && <TableHead>Fővállalkozó</TableHead>}
                    <TableHead>Fájl</TableHead>
                    <TableHead>Tokenek</TableHead>
                    <TableHead className="text-right">Műveletek</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>{TEMPLATE_TYPE_LABELS[template.type as TemplateType] || template.type}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          {template.company && typeof template.company === 'object'
                            ? (template.company as Company).name
                            : <span className="text-gray-400">-</span>}
                        </TableCell>
                      )}
                      <TableCell>
                        {template.template_file ? (
                          <span className="text-green-600 dark:text-green-400">
                            ✓ {typeof template.template_file === 'object' && template.template_file.name
                              ? template.template_file.name
                              : 'Feltöltve'}
                          </span>
                        ) : (
                          <span className="text-gray-400">Nincs fájl</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {template.tokens && template.tokens.length > 0 ? (
                          <span className="text-sm text-gray-500">
                            {template.tokens.length} token
                          </span>
                        ) : (
                          <span className="text-gray-400">Nincs</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canManageTemplates && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(template)}
                              title="Szerkesztés"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(template)}
                              title="Törlés"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
