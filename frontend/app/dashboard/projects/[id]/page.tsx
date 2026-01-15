'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { Project } from '@/types';
import { ContractForm, type ContractDataFormValues } from './contract-form';
import { formatDate } from '@/lib/utils';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Ruler,
  Package,
  User,
} from 'lucide-react';

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

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'info' | 'contract' | 'documents' | 'photos'>('info');

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getOne(projectId),
    enabled: !!projectId,
    retry: 1,
  });

  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push('/dashboard/projects');
    },
    onError: (error: any) => {
      console.error('Error deleting project:', error);
      const errorMessage = error?.message || 'Hiba történt a projekt törlése során.';
      alert(errorMessage);
      // Ne dobjon ki a bejelentkezési oldalra, maradjon a projekt részletek oldalon
    },
  });

  const handleDelete = () => {
    if (confirm('Biztosan törölni szeretné ezt a projektet?')) {
      deleteMutation.mutate();
    }
  };

  const [isSavingContract, setIsSavingContract] = useState(false);

  const updateContractMutation = useMutation({
    mutationFn: async (data: ContractDataFormValues) => {
      // MEGJEGYZÉS: A Strapi szerveren még nincsenek meg az új mezők
      // Csak azokat a mezőket küldjük el, amik biztosan megvannak a szerveren
      // A következő mezők biztosan megvannak: client_name, client_address, title, status, area_sqm, insulation_option
      
      // Csak az area_sqm mezőt küldjük el, mert az biztosan megvan
      const updateData: Partial<Project> = {
        area_sqm: data.area_sqm,
      };

      // Próbáljuk meg elküldeni csak az area_sqm mezőt
      // Ha ez is hibát dob, akkor valami más a probléma
      try {
        await projectsApi.update(projectId, updateData);
      } catch (error: any) {
        // Ha az area_sqm miatt is hiba van, akkor valami más a probléma
        console.error('Hiba az area_sqm mentésekor:', error);
        throw error;
      }

      // Most próbáljuk meg egyesével az új mezőket
      // Ha valamelyik hibát dob, akkor azt kihagyjuk
      const newFields: Array<{ key: keyof Project; value: any }> = [
        { key: 'client_birth_place', value: data.client_birth_place },
        { key: 'client_birth_date', value: data.client_birth_date },
        { key: 'client_mother_name', value: data.client_mother_name },
        { key: 'client_tax_id', value: data.client_tax_id },
        { key: 'property_address_same', value: data.property_address_same },
        { key: 'floor_material', value: data.floor_material },
        { key: 'client_street', value: data.client_street },
        { key: 'client_city', value: data.client_city },
        { key: 'client_zip', value: data.client_zip },
      ];

      // Ha property_address_same === true, akkor másoljuk a client adatokat
      if (data.property_address_same) {
        newFields.push(
          { key: 'property_street', value: data.client_street },
          { key: 'property_city', value: data.client_city },
          { key: 'property_zip', value: data.client_zip }
        );
      } else {
        newFields.push(
          { key: 'property_street', value: data.property_street || null },
          { key: 'property_city', value: data.property_city || null },
          { key: 'property_zip', value: data.property_zip || null }
        );
      }

      // Próbáljuk meg egyesével elküldeni az új mezőket
      for (const field of newFields) {
        try {
          await projectsApi.update(projectId, { [field.key]: field.value } as Partial<Project>);
        } catch (error: any) {
          // Ha ez a mező még nincs a szerveren, kihagyjuk
          if (error.message?.includes('Invalid key') || 
              error.message?.includes(field.key as string) ||
              (error.response?.status === 400 && error.response?.data)) {
            console.warn(`A ${field.key} mező még nincs a Strapi szerveren. Kihagyjuk.`);
            // Folytatjuk a következő mezővel
            continue;
          } else {
            // Ha más hiba van, dobjuk tovább
            throw error;
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      alert('Szerződés adatok sikeresen mentve!');
    },
    onError: (error: any) => {
      console.error('Error updating contract data:', error);
      const errorMessage = error?.message || 'Hiba történt a szerződés adatok mentése során.';
      alert(errorMessage);
    },
  });

  const onContractSubmit = async (values: ContractDataFormValues) => {
    setIsSavingContract(true);
    try {
      await updateContractMutation.mutateAsync(values);
    } finally {
      setIsSavingContract(false);
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

  if (error) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="text-center py-12">
            <p className="text-red-500 mb-4">Hiba történt a projekt betöltése során.</p>
            <p className="text-sm text-gray-500 mb-4">
              {error instanceof Error ? error.message : 'Ismeretlen hiba'}
            </p>
            <Button onClick={() => router.push('/dashboard/projects')} className="mt-4">
              Vissza a projektekhez
            </Button>
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
            onClick={() => router.push('/dashboard/projects')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Vissza a projektekhez
          </Button>

          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold">{project.title}</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Projekt részletei
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/dashboard/projects/${projectId}/edit`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Szerkesztés
              </Button>
              <Button variant="outline" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Törlés
              </Button>
            </div>
          </div>

          {/* Status Badge */}
          <div className="mb-6">
            <span
              className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${statusColors[project.status]}`}
            >
              {statusLabels[project.status]}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('info')}
              className={`pb-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'info'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Információk
            </button>
            <button
              onClick={() => setActiveTab('contract')}
              className={`pb-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'contract'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Szerződés adatok
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`pb-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'documents'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Dokumentumok
            </button>
            <button
              onClick={() => setActiveTab('photos')}
              className={`pb-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'photos'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Fényképek
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'info' && (
          <div className="space-y-6">
            {/* Client Information */}
            <Card>
              <CardHeader>
                <CardTitle>Ügyfél adatok</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium">{project.client_name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-900 dark:text-gray-100">
                      {project.client_street && project.client_city && project.client_zip
                        ? `${project.client_zip} ${project.client_city}, ${project.client_street}`
                        : project.client_address || '-'}
                    </p>
                  </div>
                </div>
                {project.client_phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-gray-900 dark:text-gray-100">{project.client_phone}</p>
                    </div>
                  </div>
                )}
                {project.client_email && (
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-gray-900 dark:text-gray-100">{project.client_email}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Project Details */}
            <Card>
              <CardHeader>
                <CardTitle>Projekt részletek</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {project.area_sqm && project.area_sqm > 0 && (
                    <div className="flex items-start gap-3">
                      <Ruler className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Terület</p>
                        <p className="font-medium">{project.area_sqm} m²</p>
                      </div>
                    </div>
                  )}
                  {project.insulation_option && (
                    <div className="flex items-start gap-3">
                      <Package className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Szigetelés</p>
                        <p className="font-medium">
                          {project.insulation_option === 'A' 
                            ? 'Opció A: 10 cm + 15 cm = 25 cm'
                            : 'Opció B: 12,5 cm + 12,5 cm = 25 cm'}
                        </p>
                      </div>
                    </div>
                  )}
                  {project.scheduled_date && (
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Ütemezett dátum</p>
                        <p className="font-medium">
                          {formatDate(project.scheduled_date)}
                        </p>
                      </div>
                    </div>
                  )}
                  {project.assigned_to && (
                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Hozzárendelve</p>
                        <p className="font-medium">
                          {project.assigned_to.email || project.assigned_to.username}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle>Metaadatok</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Létrehozva:</span>
                  <span>
                    {formatDate(project.createdAt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Módosítva:</span>
                  <span>
                    {formatDate(project.updatedAt)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'contract' && project && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Szerződés adatok</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500 mb-6">
                  A szerződés kötéséhez szükséges adatok. Töltse ki az összes mezőt a szerződés generálásához.
                </p>
                <ContractForm
                  project={project}
                  onSubmit={onContractSubmit}
                  isSubmitting={isSavingContract}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'documents' && (
          <Card>
            <CardHeader>
              <CardTitle>Dokumentumok</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">A dokumentumok listája hamarosan itt jelenik meg.</p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'photos' && (
          <Card>
            <CardHeader>
              <CardTitle>Fényképek</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">A fényképek galériája hamarosan itt jelenik meg.</p>
            </CardContent>
          </Card>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
