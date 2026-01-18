'use client';

import { useState, useEffect } from 'react';
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
  
  // Check if project belongs to main contractor (for subcontractor editing)
  const projectIsMainContractor = project && 
    project.company && 
    typeof project.company === 'object' && 
    'type' in project.company && 
    ((project.company as Company).type === 'main_contractor' || (project.company as Company).type === 'Main Contractor');
  
  // Admin can edit subcontractor for ALL projects (main contractor or not)
  // Main contractor can edit subcontractor only for main contractor projects
  const canEditSubcontractor = isAdmin || (projectIsMainContractor && isMainContractor);

  // Fetch available subcontractors
  const { data: subcontractors = [], isLoading: isLoadingSubcontractors } = useQuery({
    queryKey: ['companies', 'subcontractors'],
    queryFn: async () => {
      return await companiesApi.getAll({ type: 'subcontractor' });
    },
    enabled: !!canEditSubcontractor,
  });

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      client_name: '',
      client_street: '',
      client_city: '',
      client_zip: '',
      client_phone: '',
      client_email: '',
      status: 'pending',
      subcontractor: '',
    },
  });

  // Reset form when project data is loaded
  useEffect(() => {
    if (project) {
      // Parse client_address if client_street, client_city, client_zip are not available
      let client_street = project.client_street || '';
      let client_city = project.client_city || '';
      let client_zip = project.client_zip || '';

      // If address fields are empty but client_address exists, try to parse it
      if (!client_street && !client_city && !client_zip && project.client_address) {
        // Simple parsing: "street, city, zip" format
        const addressParts = project.client_address.split(',').map(part => part.trim());
        if (addressParts.length >= 3) {
          client_street = addressParts[0] || '';
          client_city = addressParts[1] || '';
          client_zip = addressParts[2] || '';
        } else if (addressParts.length === 2) {
          client_street = addressParts[0] || '';
          client_city = addressParts[1] || '';
        }
      }

      // Get subcontractor ID
      const subcontractorId = project.subcontractor && typeof project.subcontractor === 'object' && 'documentId' in project.subcontractor
        ? (project.subcontractor as Company).documentId || (project.subcontractor as Company).id?.toString() || ''
        : '';

      form.reset({
        client_name: project.client_name || '',
        client_street,
        client_city,
        client_zip,
        client_phone: project.client_phone || '',
        client_email: project.client_email || '',
        status: project.status || 'pending',
        subcontractor: subcontractorId,
      });
    }
  }, [project, form]);
  
  const mutation = useMutation({
    mutationFn: async (data: ProjectFormValues) => {
      // Összeállítjuk a client_address mezőt a kompatibilitás miatt (ha még használjuk)
      const client_address = `${data.client_street}, ${data.client_city}, ${data.client_zip}`;
      
      // Note: audit_log frissítés ideiglenesen kikapcsolva, amíg a Strapi szerver
      // nem lett újraindítva az audit_log mezőt tartalmazó schema-val
      // TODO: Engedélyezni az audit_log frissítést, miután a Strapi szerver újraindult
      
      const updateData: any = {
        ...data,
        client_address, // Kompatibilitás miatt
        client_email: data.client_email || undefined,
        client_phone: data.client_phone || undefined,
      };

      // Remove subcontractor from data spread, handle separately
      delete updateData.subcontractor;

      // Update subcontractor separately if provided and not empty
      if ('subcontractor' in data) {
        if (data.subcontractor && data.subcontractor !== 'none' && data.subcontractor !== '' && data.subcontractor !== null) {
          // Strapi v5: accept both documentId (string) and numeric id
          const subcontractorStr = data.subcontractor.toString();
          
          // Strapi v5 documentIds can be strings with or without hyphens
          // If it's a long string (likely documentId), use as-is
          // If it's a short numeric string, try to parse as number
          if (subcontractorStr.length > 10) {
            // Likely a documentId (e.g., "p4fa1a0874bmeddcclcbj393")
            updateData.subcontractor = subcontractorStr;
          } else {
            // Try to parse as number
            const parsedId = parseInt(subcontractorStr, 10);
            if (isNaN(parsedId)) {
              // Skip setting subcontractor if ID is invalid
              delete updateData.subcontractor;
            } else {
              updateData.subcontractor = parsedId;
            }
          }
        } else {
          // Explicitly set to null to remove subcontractor
          // Note: In Strapi v5, setting to null should work for relations
          updateData.subcontractor = null;
        }
      }
      
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
