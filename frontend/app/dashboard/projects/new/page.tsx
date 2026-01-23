'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { useAuthStore } from '@/lib/store/auth';
import { createAuditLogEntry } from '@/lib/utils/audit-log';
import { usePermission } from '@/lib/contexts/permission-context';
import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';

const projectSchema = z.object({
  client_name: z.string().min(1, 'Az ügyfél neve kötelező'),
  client_street: z.string().min(1, 'Az utca, házszám kötelező'),
  client_city: z.string().min(1, 'A település kötelező'),
  client_zip: z.string().min(1, 'Az irányítószám kötelező'),
  client_phone: z.string().optional(),
  client_email: z.string().email('Érvényes email cím szükséges').optional().or(z.literal('')),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export default function NewProjectPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { can } = usePermission();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check permission - redirect if user cannot create projects
  useEffect(() => {
    if (!can('projects', 'create')) {
      router.push('/dashboard/projects');
    }
  }, [can, router]);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      client_name: '',
      client_street: '',
      client_city: '',
      client_zip: '',
      client_phone: '',
      client_email: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: ProjectFormValues & { title: string; client_address?: string; area_sqm?: number; status: 'pending' | 'in_progress' | 'ready_for_review' | 'approved' | 'completed' }) => {
      // Audit log bejegyzés a projekt létrehozásához - Projekt modul
      const auditLogEntry = createAuditLogEntry(
        'project_created',
        user,
        `Projekt létrehozva: ${data.title}`
      );
      auditLogEntry.module = 'Projekt';

      // Get user's company safely
      const getUserCompany = () => {
        if (!user?.company) return null;
        if (typeof user.company === 'object' && 'type' in user.company) {
          return user.company as { type: 'main_contractor' | 'subcontractor'; documentId?: string; id?: number; parent_company?: { documentId?: string; id?: number } };
        }
        // If company is just an ID or documentId
        if (typeof user.company === 'string' || typeof user.company === 'number') {
          return null; // Need to fetch company data separately
        }
        return null;
      };

      const userCompany = getUserCompany();

      // Set company and subcontractor based on user's company
      const projectData: any = {
        ...data,
        status: 'pending',
        client_email: data.client_email || undefined,
        client_phone: data.client_phone || undefined,
        // Note: audit_log frissítés ideiglenesen kikapcsolva, amíg a Strapi szerver
        // nem lett újraindítva az audit_log mezőt tartalmazó schema-val
        // TODO: Engedélyezni az audit_log frissítést, miután a Strapi szerver újraindult
        // audit_log: [auditLogEntry],
      };

      // Automatikusan beállítjuk a company mezőt a user cégére alapozva
      if (userCompany) {
        if (userCompany.type === 'main_contractor') {
          // Ha main contractor a user, akkor a projekt is main contractorhoz tartozik
          const companyId = userCompany.documentId || userCompany.id;
          if (companyId) {
            // Strapi v5: use documentId if it's a string (with or without hyphens), otherwise numeric id
            if (typeof companyId === 'string') {
              // If it's a string (documentId), use as-is (even if it doesn't contain hyphens)
              projectData.company = companyId;
              console.log('Setting company for main contractor (documentId):', projectData.company);
            } else {
              // If it's a number, use as-is
              projectData.company = companyId;
              console.log('Setting company for main contractor (numeric id):', projectData.company);
            }
          }
        } else if (userCompany.type === 'subcontractor') {
          // Ha subcontractor a user, akkor:
          // - project.company = parent_company (main contractor)
          // - project.subcontractor = user.company (subcontractor)
          const parentCompany = userCompany.parent_company;
          const subcontractorId = userCompany.documentId || userCompany.id;

          if (parentCompany) {
            const parentId = parentCompany.documentId || parentCompany.id;
            if (parentId) {
              // Strapi v5: use documentId if it's a string, otherwise numeric id
              if (typeof parentId === 'string') {
                projectData.company = parentId;
                console.log('Setting company (parent) for subcontractor (documentId):', projectData.company);
              } else {
                projectData.company = parentId;
                console.log('Setting company (parent) for subcontractor (numeric id):', projectData.company);
              }
            }
          }

          if (subcontractorId) {
            // Strapi v5: use documentId if it's a string, otherwise numeric id
            if (typeof subcontractorId === 'string') {
              projectData.subcontractor = subcontractorId;
              console.log('Setting subcontractor (documentId):', projectData.subcontractor);
            } else {
              projectData.subcontractor = subcontractorId;
              console.log('Setting subcontractor (numeric id):', projectData.subcontractor);
            }
          }
        }
      } else {
        console.warn('User company not found or not properly populated. User:', user);
        console.warn('User company type:', typeof user?.company);
        console.warn('User company value:', user?.company);

        // If user has no company, assign the project to this user
        // This ensures the user can see their own projects even without a company
        const userId = user?.documentId || user?.id;
        if (userId) {
          projectData.assigned_to = userId;
          console.log('Setting assigned_to to user (no company):', userId);
        }
      }

      console.log('Final project data before creation:', JSON.stringify(projectData, null, 2));

      return projectsApi.create(projectData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push('/dashboard/projects');
    },
    onError: (error) => {
      console.error('Error creating project:', error);
      alert('Hiba történt a projekt létrehozása során.');
    },
  });

  const generateProjectTitle = (clientName: string, city: string): string => {
    // Generáljuk az azonosítót: yyyy mmdd hhmmss (szóközökkel tagolva)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const identifier = `${year} ${month}${day} ${hours}${minutes}${seconds}`;

    return `${clientName} - ${city} - ${identifier}`;
  };

  const onSubmit = async (values: ProjectFormValues) => {
    setIsSubmitting(true);
    try {
      const title = generateProjectTitle(values.client_name, values.client_city);
      // Összeállítjuk a client_address mezőt a kompatibilitás miatt (ha még használjuk)
      const client_address = `${values.client_street}, ${values.client_city}, ${values.client_zip}`;
      await mutation.mutateAsync({
        ...values,
        client_address, // Kompatibilitás miatt
        title,
        area_sqm: 0, // Alapértelmezett érték, később frissíthető a szerződés adatokban
        status: 'pending',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <h2 className="text-3xl font-bold">Új projekt létrehozása</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Adja meg az ügyfél alapvető adatait. A projekt neve automatikusan generálódik.
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
                              {...field}
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
                  {isSubmitting ? 'Mentés...' : 'Projekt létrehozása'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
