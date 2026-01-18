'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { projectsApi } from '@/lib/api/projects';
import { companiesApi } from '@/lib/api/companies';
import { formatDate, formatPhoneNumber, cleanPhoneNumber } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth';
import { createAuditLogEntry, addAuditLogEntry } from '@/lib/utils/audit-log';
import { isAdminRole, isUserFoovallalkozo } from '@/lib/utils/user-role';
import type { Company } from '@/types';
import { ArrowLeft } from 'lucide-react';

const projectSchema = z.object({
  client_name: z.string().min(1, 'Az ügyfél neve kötelező'),
  client_street: z.string().min(1, 'Az utca, házszám kötelező'),
  client_city: z.string().min(1, 'A település kötelező'),
  client_zip: z.string().min(1, 'Az irányítószám kötelező'),
  client_phone: z.string().optional(),
  client_email: z.string().email('Érvényes email cím szükséges').optional().or(z.literal('')),
  status: z.enum(['pending', 'in_progress', 'ready_for_review', 'approved', 'completed']),
  subcontractor: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getOne(projectId),
    enabled: !!projectId,
  });

  const { user } = useAuthStore();

  // Check if user can edit subcontractor
  const getUserCompany = () => {
    if (!user?.company) return null;
    if (typeof user.company === 'object' && 'type' in user.company) {
      return user.company as Company;
    }
    return null;
  };

  const userCompany = getUserCompany();
  const isMainContractor = userCompany?.type === 'main_contractor';
  const isAdmin = isAdminRole(user);
  
  // Debug logging
  console.log('=== Edit Project - Permission Check ===');
  console.log('User:', user?.email || user?.username);
  console.log('User role:', user?.role);
  console.log('isAdmin:', isAdmin);
  console.log('User company:', userCompany);
  console.log('isMainContractor:', isMainContractor);
  console.log('Project:', project);
  console.log('Project company:', project?.company);
  console.log('Project company type:', project?.company && typeof project.company === 'object' && 'type' in project.company ? (project.company as Company).type : 'N/A');
  
  // Check if project belongs to main contractor (for subcontractor editing)
  const projectIsMainContractor = project && 
    project.company && 
    typeof project.company === 'object' && 
    'type' in project.company && 
    ((project.company as Company).type === 'main_contractor' || (project.company as Company).type === 'Main Contractor');
  
  // Admin can edit subcontractor for ALL projects (main contractor or not)
  // Main contractor can edit subcontractor only for main contractor projects
  const canEditSubcontractor = isAdmin || (projectIsMainContractor && isMainContractor);
  
  console.log('projectIsMainContractor:', projectIsMainContractor);
  console.log('canEditSubcontractor:', canEditSubcontractor);
  console.log('========================================');

  // Fetch available subcontractors
  const { data: subcontractors = [], isLoading: isLoadingSubcontractors, error: subcontractorsError } = useQuery({
    queryKey: ['companies', 'subcontractors'],
    queryFn: async () => {
      console.log('[Edit Project] Fetching subcontractors...');
      const result = await companiesApi.getAll({ type: 'subcontractor' });
      console.log('[Edit Project] Subcontractors fetched:', result);
      return result;
    },
    enabled: !!canEditSubcontractor,
  });

  if (subcontractorsError) {
    console.error('[Edit Project] Error fetching subcontractors:', subcontractorsError);
  }

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    values: project
      ? {
          client_name: project.client_name || '',
          client_street: project.client_street || '',
          client_city: project.client_city || '',
          client_zip: project.client_zip || '',
          client_phone: project.client_phone || '',
          client_email: project.client_email || '',
          title: project.title || '',
          area_sqm: project.area_sqm || 0,
          insulation_option: project.insulation_option || 'A',
          scheduled_date: formatDate(project.scheduled_date),
          status: project.status || 'pending',
          subcontractor: project.subcontractor && typeof project.subcontractor === 'object' && 'documentId' in project.subcontractor
            ? (project.subcontractor as Company).documentId || (project.subcontractor as Company).id?.toString() || ''
            : '',
        }
      : undefined,
  });
  
  const mutation = useMutation({
    mutationFn: async (data: ProjectFormValues) => {
      // Lekérjük a jelenlegi projektet az audit log-hoz
      const currentProject = await projectsApi.getOne(projectId);
      
      // Összeállítjuk a client_address mezőt a kompatibilitás miatt (ha még használjuk)
      const client_address = `${data.client_street}, ${data.client_city}, ${data.client_zip}`;
      
      // Audit log bejegyzés - Projekt modul
      const auditLogEntry = createAuditLogEntry(
        'project_modified',
        user,
        'Projekt alapadatok módosítva'
      );
      auditLogEntry.module = 'Projekt';
      
      // Hozzáadjuk az audit log bejegyzést
      const updatedAuditLog = addAuditLogEntry(currentProject.audit_log, auditLogEntry);
      
      const updateData: any = {
        ...data,
        client_address, // Kompatibilitás miatt
        client_email: data.client_email || undefined,
        client_phone: data.client_phone || undefined,
        audit_log: updatedAuditLog,
      };

      // Remove subcontractor from data spread, handle separately
      delete updateData.subcontractor;

      // Update subcontractor separately if provided and not empty
      if ('subcontractor' in data) {
        if (data.subcontractor && data.subcontractor !== 'none' && data.subcontractor !== '') {
          // Strapi v5: use documentId if it's a documentId format, otherwise use numeric id
          const subcontractorId = typeof data.subcontractor === 'string' && data.subcontractor.includes('-')
            ? data.subcontractor
            : parseInt(data.subcontractor.toString());
          updateData.subcontractor = subcontractorId;
          console.log('[Edit Project] Setting subcontractor:', subcontractorId);
        } else {
          // Explicitly set to null to remove subcontractor
          // Note: In Strapi v5, setting to null should work for relations
          updateData.subcontractor = null;
          console.log('[Edit Project] Removing subcontractor (setting to null)');
        }
      }
      
      console.log('[Edit Project] Update data before API call:', JSON.stringify(updateData, null, 2));
      return projectsApi.update(projectId, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      router.push(`/dashboard/projects/${projectId}`);
    },
    onError: (error) => {
      console.error('Error updating project:', error);
      alert('Hiba történt a projekt frissítése során.');
    },
  });

  const onSubmit = async (values: ProjectFormValues) => {
    setIsSubmitting(true);
    try {
      await mutation.mutateAsync(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="text-center py-12">
            <p className="text-gray-500">Betöltés...</p>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (!project) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="text-center py-12">
            <p className="text-red-500">Projekt nem található.</p>
            <Button onClick={() => router.push('/dashboard/projects')} className="mt-4">
              Vissza a projektekhez
            </Button>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Vissza
          </Button>
          <h2 className="text-3xl font-bold">Projekt szerkesztése</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Módosítsa a projekt adatait
          </p>
        </div>

        <div className="max-w-3xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Client Information */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold mb-4">Ügyfél adatok</h3>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="client_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ügyfél neve *</FormLabel>
                        <FormControl>
                          <Input placeholder="Kovács János" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="client_zip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Irányítószám *</FormLabel>
                          <FormControl>
                            <Input placeholder="1234" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="client_city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Település *</FormLabel>
                          <FormControl>
                            <Input placeholder="Budapest" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="client_street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Utca, házszám *</FormLabel>
                          <FormControl>
                            <Input placeholder="Fő utca 1." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="client_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefonszám</FormLabel>
                          <FormControl>
                            <Input
                              type="tel"
                              placeholder="+36 20 123 4567"
                              value={field.value ? formatPhoneNumber(field.value) : ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Távolítsuk el a +36 előtagot és formázást a mentéshez
                                const cleaned = cleanPhoneNumber(value);
                                field.onChange(cleaned || undefined);
                              }}
                              onBlur={field.onBlur}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="client_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email cím</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="email@example.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Project Status */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold mb-4">Projekt státusz</h3>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Státusz *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Válasszon státuszt" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending">Függőben</SelectItem>
                            <SelectItem value="in_progress">Folyamatban</SelectItem>
                            <SelectItem value="ready_for_review">Átnézésre vár</SelectItem>
                            <SelectItem value="approved">Jóváhagyva</SelectItem>
                            <SelectItem value="completed">Befejezve</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          A projekt aktuális állapota
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Subcontractor (only for main contractors or admins) */}
              {canEditSubcontractor && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold mb-4">Kivitelező</h3>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="subcontractor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alvállalkozó (Kivitelező)</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || 'none'}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Válasszon kivitelezőt..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Nincs kivitelező</SelectItem>
                              {subcontractors.map((subcontractor) => {
                                const subId = subcontractor.documentId || subcontractor.id?.toString() || '';
                                return (
                                  <SelectItem key={subId} value={subId}>
                                    {subcontractor.name}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Válasszon alvállalkozót a projekt kivitelezéséhez, vagy távolítsa el a jelenlegi kivitelezőt.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {subcontractors.length === 0 && (
                      <p className="text-sm text-gray-500">
                        Nincs elérhető alvállalkozó. Kérjük, először hozzon létre alvállalkozó céget a Beállítások menüben.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  Mégse
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Mentés...' : 'Változások mentése'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
