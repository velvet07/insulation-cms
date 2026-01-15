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
import { formatDate } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';

const projectSchema = z.object({
  client_name: z.string().min(1, 'Az ügyfél neve kötelező'),
  client_address: z.string().min(1, 'Az ügyfél címe kötelező'),
  client_phone: z.string().optional(),
  client_email: z.string().email('Érvényes email cím szükséges').optional().or(z.literal('')),
  status: z.enum(['pending', 'in_progress', 'ready_for_review', 'approved', 'completed']),
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

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    values: project
      ? {
          client_name: project.client_name || '',
          client_address: project.client_address || '',
          client_phone: project.client_phone || '',
          client_email: project.client_email || '',
          title: project.title || '',
          area_sqm: project.area_sqm || 0,
          insulation_option: project.insulation_option || 'A',
          scheduled_date: formatDate(project.scheduled_date),
          status: project.status || 'pending',
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (data: ProjectFormValues) => {
      return projectsApi.update(projectId, {
        ...data,
        client_email: data.client_email || undefined,
        client_phone: data.client_phone || undefined,
      });
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

                  <FormField
                    control={form.control}
                    name="client_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ügyfél címe *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="1234 Fő utca, Budapest, 1234"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
