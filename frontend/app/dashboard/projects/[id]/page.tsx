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
import type { Project, ProjectAuditLogEntry } from '@/types';
import { ContractForm, type ContractDataFormValues } from './contract-form';
import { formatDate, formatPhoneNumber } from '@/lib/utils';
import { createAuditLogEntry, addAuditLogEntry } from '@/lib/utils/audit-log';
import { useAuthStore } from '@/lib/store/auth';
import { DocumentsTab } from './documents-tab';
import { PhotosTab } from './photos-tab';
import { photosApi } from '@/lib/api/photos';
import { photoCategoriesApi } from '@/lib/api/photo-categories';
import { documentsApi } from '@/lib/api/documents';
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
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Camera,
  FileText,
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
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<'info' | 'contract' | 'documents' | 'photos'>('info');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getOne(projectId),
    enabled: !!projectId,
    retry: 1,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => documentsApi.getAll({ project: projectId }),
    enabled: !!projectId,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ['photos', projectId],
    queryFn: () => photosApi.getAll({ project: projectId }),
    enabled: !!projectId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['photo-categories'],
    queryFn: () => photoCategoriesApi.getAll(),
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
      console.log('=== MENTÉS KEZDETE ===');
      console.log('Form adatok:', data);
      console.log('Project ID:', projectId);
      
      // Lekérjük a jelenlegi projektet, hogy megtartsuk a meglévő mezőket
      console.log('Projekt lekérése...');
      const currentProject = await projectsApi.getOne(projectId);
      console.log('Jelenlegi projekt:', currentProject);
      
      // Strapi belső mezők, amiket nem szabad elküldeni az update során
      const strapiInternalFields = ['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt'];
      
      // Szűrjük ki a Strapi belső mezőket a jelenlegi projektből
      const cleanCurrentProject = Object.fromEntries(
        Object.entries(currentProject).filter(([key]) => 
          !strapiInternalFields.includes(key)
        )
      ) as Partial<Project>;
      
      // Készítsük el az update adatokat: meglévő mezők + új form értékek
      const updateData: Partial<Project> = {
        // Megtartjuk az összes meglévő mezőt (belső mezők nélkül)
        ...cleanCurrentProject,
        // Frissítjük az összes form mezőt az új értékekkel
        area_sqm: data.area_sqm,
        client_birth_place: data.client_birth_place,
        client_birth_date: data.client_birth_date,
        client_mother_name: data.client_mother_name,
        client_tax_id: data.client_tax_id,
        property_address_same: data.property_address_same,
        floor_material: data.floor_material,
        floor_material_extra: data.floor_material_extra,
        client_street: data.client_street,
        client_city: data.client_city,
        client_zip: data.client_zip,
      };

      // Ha property_address_same === true, akkor másoljuk a client adatokat
      if (data.property_address_same) {
        updateData.property_street = data.client_street;
        updateData.property_city = data.client_city;
        updateData.property_zip = data.client_zip;
      } else {
        updateData.property_street = data.property_street || undefined;
        updateData.property_city = data.property_city || undefined;
        updateData.property_zip = data.property_zip || undefined;
      }

      // Opcionális mezők
      if (data.insulation_option) {
        updateData.insulation_option = data.insulation_option;
      } else {
        // Ha nincs érték, töröljük (undefined)
        updateData.insulation_option = undefined;
      }
      if (data.scheduled_date) {
        updateData.scheduled_date = data.scheduled_date;
      } else {
        updateData.scheduled_date = undefined;
      }

      // Ellenőrizzük, hogy volt-e már szerződés adat (az első mentés vagy módosítás)
      const hasExistingContractData = currentProject.client_birth_place || 
                                      currentProject.client_birth_date || 
                                      currentProject.client_tax_id;
      
      // Audit log bejegyzés hozzáadása - Szerződés adatok modul
      const auditLogEntry = createAuditLogEntry(
        hasExistingContractData ? 'contract_data_modified' : 'contract_data_filled',
        user,
        'Szerződés adatok modul'
      );
      
      // Hozzáadjuk az audit log bejegyzést a meglévő audit log-hoz
      updateData.audit_log = addAuditLogEntry(currentProject.audit_log, auditLogEntry);

      // Mezők, amik még nincsenek a Strapi szerveren (ezeket nem küldjük el)
      const fieldsNotOnServer = ['floor_material_extra', 'audit_log'];
      
      // Szűrjük ki az undefined értékeket ÉS a szerveren még nem létező mezőket
      const cleanUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([key, value]) => 
          value !== undefined && !fieldsNotOnServer.includes(key)
        )
      ) as Partial<Project>;
      
      // Ha floor_material !== 'other', akkor ne küldjük el a floor_material_extra-t
      if (data.floor_material !== 'other') {
        delete cleanUpdateData.floor_material_extra;
      }

      // Elküldjük az összes mezőt egyetlen update-ben
      console.log('Update adatok elküldése:', cleanUpdateData);
      try {
        const result = await projectsApi.update(projectId, cleanUpdateData);
        console.log('=== MENTÉS SIKERES ===');
        console.log('Eredmény:', result);
        return result;
      } catch (error: any) {
        console.error('=== MENTÉS HIBA ===');
        console.error('Hiba az adatok mentésekor:', error);
        console.error('Hiba részletek:', error.response?.data);
        throw error;
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
    console.log('=== FORM SUBMIT KEZDETE ===');
    console.log('Form értékek:', values);
    setIsSavingContract(true);
    try {
      console.log('Mutation hívás...');
      await updateContractMutation.mutateAsync(values);
      console.log('Mutation sikeres');
    } catch (error: any) {
      console.error('Mutation hiba:', error);
      throw error;
    } finally {
      setIsSavingContract(false);
      console.log('=== FORM SUBMIT VÉGE ===');
    }
  };

  const handleStatusChange = async (newStatus: Project['status']) => {
    if (!project) return;
    
    setIsUpdatingStatus(true);
    try {
      const auditLogEntry = createAuditLogEntry(
        'status_changed',
        user,
        'Státusz modul',
        `Státusz módosítva: ${statusLabels[project.status]} -> ${statusLabels[newStatus]}`
      );

      const updateData: Partial<Project> = {
        status: newStatus,
        audit_log: addAuditLogEntry(project.audit_log, auditLogEntry),
      };

      // Ha jóváhagyva/befejezve, állítsuk be a dátumot
      if (newStatus === 'approved') {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = user?.id;
      } else if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      // Szűrjük ki a szerveren még nem létező mezőket (audit_log-ot egyelőre csak akkor küldjük, ha tudjuk, hogy van)
      const fieldsNotOnServer = ['audit_log'];
      const cleanUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([key]) => !fieldsNotOnServer.includes(key))
      );

      await projectsApi.update(projectId, cleanUpdateData);
      
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      
      alert(`Státusz sikeresen módosítva: ${statusLabels[newStatus]}`);
    } catch (error: any) {
      console.error('Error updating status:', error);
      alert(error.message || 'Hiba történt a státusz frissítése során.');
    } finally {
      setIsUpdatingStatus(false);
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

  // Számítások az állapot összesítőhöz
  const contractFilled = !!(
    project.client_birth_place &&
    project.client_birth_date &&
    project.client_tax_id &&
    project.area_sqm &&
    project.insulation_option
  );

  const totalDocs = documents.length;
  const signedDocs = documents.filter(d => d.signed).length;
  const docsReady = totalDocs > 0 && totalDocs === signedDocs;

  const requiredCategories = categories.filter(c => c.required);
  const categoriesWithPhotos = requiredCategories.filter(cat => {
    const catId = (cat.documentId || cat.id).toString();
    return photos.some(p => (p.category?.documentId || p.category?.id?.toString()) === catId);
  });
  
  const photosReady = requiredCategories.length > 0 && 
                     categoriesWithPhotos.length === requiredCategories.length;

  const canBeSentForReview = project.status === 'in_progress' && 
                            contractFilled && 
                            docsReady && 
                            photosReady;

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
          <div className="mb-6 flex items-center justify-between">
            <span
              className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${statusColors[project.status]}`}
            >
              {statusLabels[project.status]}
            </span>

            <div className="flex gap-2">
              {project.status === 'pending' && (
                <Button 
                  size="sm" 
                  onClick={() => handleStatusChange('in_progress')}
                  disabled={isUpdatingStatus}
                >
                  Munka megkezdése
                </Button>
              )}
              {project.status === 'in_progress' && (
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => handleStatusChange('ready_for_review')}
                  disabled={isUpdatingStatus}
                >
                  Átnézésre küldés
                </Button>
              )}
              {project.status === 'ready_for_review' && (
                <>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => handleStatusChange('in_progress')}
                    disabled={isUpdatingStatus}
                  >
                    Visszaküldés javításra
                  </Button>
                  <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleStatusChange('approved')}
                    disabled={isUpdatingStatus}
                  >
                    Jóváhagyás
                  </Button>
                </>
              )}
              {project.status === 'approved' && (
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={() => handleStatusChange('completed')}
                  disabled={isUpdatingStatus}
                >
                  Projekt lezárása
                </Button>
              )}
              {project.status === 'completed' && (
                <span className="text-sm text-gray-500 italic">A projekt lezárult.</span>
              )}
            </div>
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
            {/* Projekt Állapot Összesítő */}
            <Card className="border-2 border-primary/10">
              <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Projekt Állapot Összesítő
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Szerződés adatok */}
                  <div className="flex flex-col items-center text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
                    <div className={`p-3 rounded-full mb-3 ${contractFilled ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                      {contractFilled ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
                    </div>
                    <h4 className="font-semibold mb-1">Szerződés adatok</h4>
                    <p className="text-xs text-gray-500 mb-2">Személyes adatok és terület</p>
                    {contractFilled ? (
                      <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">Kitöltve</span>
                    ) : (
                      <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-1 rounded">Hiányos</span>
                    )}
                  </div>

                  {/* Dokumentumok */}
                  <div className="flex flex-col items-center text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
                    <div className={`p-3 rounded-full mb-3 ${docsReady ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                      {docsReady ? <FileCheck className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                    </div>
                    <h4 className="font-semibold mb-1">Dokumentumok</h4>
                    <p className="text-xs text-gray-500 mb-2">{totalDocs} generálva, {signedDocs} aláírva</p>
                    {docsReady ? (
                      <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">Kész</span>
                    ) : (
                      <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-1 rounded">Aláírásra vár</span>
                    )}
                  </div>

                  {/* Fényképek */}
                  <div className="flex flex-col items-center text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
                    <div className={`p-3 rounded-full mb-3 ${photosReady ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                      {photosReady ? <Camera className="h-6 w-6" /> : <Camera className="h-6 w-6" />}
                    </div>
                    <h4 className="font-semibold mb-1">Fényképek</h4>
                    <p className="text-xs text-gray-500 mb-2">{categoriesWithPhotos.length}/{requiredCategories.length} kategória kész</p>
                    {photosReady ? (
                      <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">Minden fotó megvan</span>
                    ) : (
                      <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-1 rounded">Fotók hiányoznak</span>
                    )}
                  </div>
                </div>

                {canBeSentForReview && (
                  <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <p className="text-sm font-medium text-green-800 dark:text-green-300">
                        Minden kötelező elem megvan. A projekt küldhető jóváhagyásra!
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleStatusChange('ready_for_review')}
                      disabled={isUpdatingStatus}
                    >
                      Küldés jóváhagyásra
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

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
                      <p className="text-gray-900 dark:text-gray-100">{formatPhoneNumber(project.client_phone)}</p>
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
                  {project.floor_material && (
                    <div className="flex items-start gap-3">
                      <Package className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Födém anyaga</p>
                        <p className="font-medium">
                          {project.floor_material === 'wood' && 'Fa'}
                          {project.floor_material === 'prefab_rc' && 'Előre gyártott vb. (betongerendás)'}
                          {project.floor_material === 'monolithic_rc' && 'Monolit v.b.'}
                          {project.floor_material === 'rc_slab' && 'Vasbeton tálcás'}
                          {project.floor_material === 'hollow_block' && 'Horcsik'}
                          {project.floor_material === 'other' && (project.floor_material_extra || 'Egyéb')}
                          {!['wood', 'prefab_rc', 'monolithic_rc', 'rc_slab', 'hollow_block', 'other'].includes(project.floor_material) && project.floor_material}
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Ingatlan címe */}
                  {(project.property_address_same !== undefined || project.property_street || project.property_city || project.property_zip) && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Ingatlan címe</p>
                        <p className="font-medium">
                          {project.property_address_same === true || (!project.property_street && !project.property_city && !project.property_zip)
                            ? (project.client_street && project.client_city && project.client_zip
                                ? `${project.client_zip} ${project.client_city}, ${project.client_street}`
                                : project.client_address || '-')
                            : (project.property_zip && project.property_city && project.property_street
                                ? `${project.property_zip} ${project.property_city}, ${project.property_street}`
                                : '-')}
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
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
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
                </div>
                
                {/* Audit Log */}
                {project.audit_log && project.audit_log.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">Eseménytörténet</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {project.audit_log
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                        .map((entry, index) => {
                          const actionLabels: Record<string, string> = {
                            // Projekt modul
                            'project_created': 'Projekt létrehozva',
                            'project_modified': 'Projekt módosítva',
                            'project_deleted': 'Projekt törölve',
                            // Szerződés adatok modul
                            'contract_data_filled': 'Szerződés adatok kitöltve',
                            'contract_data_modified': 'Szerződés adatok módosítva',
                            // Dokumentumok modul
                            'document_generated': 'Dokumentum generálva',
                            'document_modified': 'Dokumentum módosítva',
                            'document_deleted': 'Dokumentum törölve',
                            'document_signed': 'Dokumentum aláírva',
                            // Fényképek modul
                            'photo_uploaded': 'Fénykép feltöltve',
                            'photo_deleted': 'Fénykép törölve',
                            // Státusz modul
                            'status_changed': 'Státusz módosítva',
                            // Anyagok modul
                            'material_added': 'Anyag hozzáadva',
                            'material_removed': 'Anyag eltávolítva',
                            // Naptár modul
                            'scheduled_date_set': 'Ütemezett dátum beállítva',
                            'scheduled_date_modified': 'Ütemezett dátum módosítva',
                          };
                          
                          const actionLabel = actionLabels[entry.action] || entry.action;
                          const timestamp = new Date(entry.timestamp);
                          const formattedDate = timestamp.toLocaleDateString('hu-HU', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          });
                          
                          return (
                            <div key={index} className="flex items-start gap-2 text-xs border-b border-gray-200 dark:border-gray-700 pb-2 last:border-b-0">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {entry.module && (
                                    <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                                      {entry.module}
                                    </span>
                                  )}
                                  <span className="font-medium text-gray-700 dark:text-gray-300">{actionLabel}</span>
                                  {entry.user && (
                                    <span className="text-gray-500 dark:text-gray-400">
                                      ({entry.user.email || entry.user.username || 'Ismeretlen felhasználó'})
                                    </span>
                                  )}
                                </div>
                                {entry.details && (
                                  <p className="text-gray-500 dark:text-gray-400 mt-1">{entry.details}</p>
                                )}
                                <p className="text-gray-400 dark:text-gray-500 mt-1">{formattedDate}</p>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
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

        {activeTab === 'documents' && project && (
          <Card>
            <CardHeader>
              <CardTitle>Dokumentumok</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentsTab project={project} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'photos' && project && (
          <Card>
            <CardHeader>
              <CardTitle>Fényképek</CardTitle>
            </CardHeader>
            <CardContent>
              <PhotosTab project={project} />
            </CardContent>
          </Card>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
