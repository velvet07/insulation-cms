'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import type { Project, ProjectAuditLogEntry, Company } from '@/types';
import { ContractForm, type ContractDataFormValues } from './contract-form';
import { formatDate, formatPhoneNumber } from '@/lib/utils';
import { createAuditLogEntry, addAuditLogEntry } from '@/lib/utils/audit-log';
import {
  generateGoogleCalendarUrl,
  downloadAppleCalendarFile,
  generateCalendarEventFromProject,
} from '@/lib/utils/calendar-export';
import { useAuthStore } from '@/lib/store/auth';
import { DocumentsTab } from './documents-tab';
import { PhotosTab } from './photos-tab';
import { photosApi } from '@/lib/api/photos';
import { photoCategoriesApi } from '@/lib/api/photo-categories';
import { documentsApi } from '@/lib/api/documents';
import { companiesApi } from '@/lib/api/companies';
import { isAdminRole } from '@/lib/utils/user-role';
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
  Building2,
  Clock,
  ExternalLink,
  Download,
  Save,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const statusLabels: Record<Project['status'], string> = {
  pending: 'Függőben',
  in_progress: 'Folyamatban',
  ready_for_review: 'Átnézésre vár',
  sent_back_for_revision: 'Visszaküldve javításra',
  approved: 'Jóváhagyva',
  completed: 'Befejezve',
  archived: 'Archivált',
};

const statusColors: Record<Project['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ready_for_review: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  sent_back_for_revision: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  archived: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
};

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<'info' | 'contract' | 'documents' | 'photos'>('info');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isSubcontractorDialogOpen, setIsSubcontractorDialogOpen] = useState(false);
  const [isRevisionDialogOpen, setIsRevisionDialogOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleStartTime, setScheduleStartTime] = useState('08:00');
  const [scheduleEndTime, setScheduleEndTime] = useState('16:00');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getOne(projectId),
    enabled: !!projectId,
    retry: 1,
  });

  // Betöltjük a meglévő ütemezést
  useEffect(() => {
    if (project?.scheduled_date) {
      // scheduled_date lehet date vagy datetime formátumban
      const scheduledDate = new Date(project.scheduled_date);
      if (!isNaN(scheduledDate.getTime())) {
        // Dátum formázása YYYY-MM-DD formátumban
        const year = scheduledDate.getFullYear();
        const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
        const day = String(scheduledDate.getDate()).padStart(2, '0');
        setScheduleDate(`${year}-${month}-${day}`);
        
        // Alapértelmezett időtartam: 8:00-16:00
        // Ha a dátum tartalmaz időt (nem csak dátum), akkor azt használjuk
        const hours = scheduledDate.getHours();
        const minutes = scheduledDate.getMinutes();
        if (hours !== 0 || minutes !== 0) {
          setScheduleStartTime(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
          // Vég idő: +8 óra
          const endDate = new Date(scheduledDate);
          endDate.setHours(hours + 8);
          setScheduleEndTime(`${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`);
        }
      }
    } else {
      // Ha nincs scheduled_date, töröljük a mezőket
      setScheduleDate('');
      setScheduleStartTime('08:00');
      setScheduleEndTime('16:00');
    }
  }, [project?.scheduled_date]);

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

  // Check if user is main contractor (from their company)
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
  // Admin vagy main contractor szerkesztheti a subcontractor-t
  const canEditSubcontractor = (isAdmin || isMainContractor) && project && 
    project.company && 
    typeof project.company === 'object' && 
    'type' in project.company && 
    project.company.type === 'main_contractor';
  
  // Fetch available subcontractors (only if user is main contractor and can edit)
  const { data: subcontractors = [] } = useQuery({
    queryKey: ['companies', 'subcontractors'],
    queryFn: () => companiesApi.getAll({ type: 'subcontractor' }),
    enabled: !!canEditSubcontractor,
  });

  // Subcontractor update mutation
  const updateSubcontractorMutation = useMutation({
    mutationFn: async (subcontractorId: string | null) => {
      // In Strapi v5, relations are updated by sending the documentId or id
      const updateData: any = {
        subcontractor: subcontractorId 
          ? (subcontractorId.includes('-') ? subcontractorId : parseInt(subcontractorId)) 
          : null,
      };
      return projectsApi.update(projectId, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsSubcontractorDialogOpen(false);
      // Sikeres frissítés - nincs felugró ablak
      console.log('Kivitelező sikeresen frissítve');
    },
    onError: (error: any) => {
      console.error('Error updating subcontractor:', error);
      console.error('Hiba üzenet:', error.message || 'Hiba történt a kivitelező frissítése során.');
      // Hiba esetén csak console-ba írunk, nincs felugró ablak
    },
  });

  const handleSubcontractorChange = async (subcontractorId: string) => {
    if (subcontractorId === 'none') {
      updateSubcontractorMutation.mutate(null);
    } else {
      updateSubcontractorMutation.mutate(subcontractorId);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push('/dashboard/projects');
    },
    onError: (error: any) => {
      console.error('Error deleting project:', error);
      const errorMessage = error?.message || 'Hiba történt a projekt törlése során.';
      console.error('Hiba üzenet:', errorMessage);
      // Hiba esetén csak console-ba írunk, nincs felugró ablak
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
      // Lekérjük a jelenlegi projektet, hogy megtartsuk a meglévő mezőket
      const currentProject = await projectsApi.getOne(projectId);
      
      // Strapi belső mezők, amiket nem szabad elküldeni az update során
      const strapiInternalFields = ['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt'];
      
      // Relation mezők, amiket külön kezelünk (csak ID-t küldünk, ha szükséges)
      const relationFields = ['company', 'subcontractor', 'assigned_to', 'approved_by', 'tenant', 'documents', 'photos'];
      
      // Szűrjük ki a Strapi belső mezőket ÉS a relation mezőket a jelenlegi projektből
      // (relation mezőket külön kezeljük, ha szükséges)
      const cleanCurrentProject = Object.fromEntries(
        Object.entries(currentProject).filter(([key]) => 
          !strapiInternalFields.includes(key) && !relationFields.includes(key)
        )
      ) as Partial<Project>;
      
      // Helper függvény: üres stringeket undefined-ra konvertál
      const normalizeValue = (value: any): any => {
        if (value === null || value === '') {
          return undefined;
        }
        return value;
      };

      // Készítsük el az update adatokat: meglévő mezők + új form értékek
      const updateData: Partial<Project> = {
        // Megtartjuk az összes meglévő mezőt (belső mezők és relation mezők nélkül)
        ...cleanCurrentProject,
        // Frissítjük az összes form mezőt az új értékekkel (üres stringeket undefined-ra konvertáljuk)
        area_sqm: normalizeValue(data.area_sqm) || undefined,
        client_birth_place: normalizeValue(data.client_birth_place),
        client_birth_date: normalizeValue(data.client_birth_date), // Üres string -> undefined (Strapi date mező nem fogad el üres stringet)
        client_mother_name: normalizeValue(data.client_mother_name),
        client_tax_id: normalizeValue(data.client_tax_id),
        property_address_same: data.property_address_same ?? undefined,
        floor_material: normalizeValue(data.floor_material),
        floor_material_extra: normalizeValue(data.floor_material_extra),
        client_street: normalizeValue(data.client_street),
        client_city: normalizeValue(data.client_city),
        client_zip: normalizeValue(data.client_zip),
      };

      // Ha property_address_same === true, akkor másoljuk a client adatokat
      if (data.property_address_same) {
        updateData.property_street = normalizeValue(data.client_street);
        updateData.property_city = normalizeValue(data.client_city);
        updateData.property_zip = normalizeValue(data.client_zip);
      } else {
        updateData.property_street = normalizeValue(data.property_street);
        updateData.property_city = normalizeValue(data.property_city);
        updateData.property_zip = normalizeValue(data.property_zip);
      }

      // Opcionális mezők
      updateData.scheduled_date = normalizeValue(data.scheduled_date); // Üres string -> undefined (Strapi date mező nem fogad el üres stringet)

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
      // ÉS rendszer mezők, amiket nem lehet frissíteni (Strapi automatikusan kezeli)
      // Note: floor_material_extra már hozzá lett adva a schema-hoz, de még a listában van - később eltávolíthatjuk
      const fieldsNotOnServer = ['audit_log'];
      const systemFields = ['id', 'documentId', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'];
      
      // Szűrjük ki az undefined értékeket ÉS a szerveren még nem létező mezőket ÉS a rendszer mezőket
      const cleanUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([key, value]) => {
          // Ne küldjük el undefined értékeket
          if (value === undefined) return false;
          // Ne küldjük el a szerveren még nem létező mezőket
          if (fieldsNotOnServer.includes(key)) return false;
          // Ne küldjük el a rendszer mezőket (Strapi automatikusan kezeli)
          if (systemFields.includes(key)) return false;
          return true;
        })
      ) as Partial<Project>;
      
      // Ha floor_material !== 'other', akkor ne küldjük el a floor_material_extra-t
      if (data.floor_material !== 'other') {
        delete cleanUpdateData.floor_material_extra;
      }

      // Elküldjük az összes mezőt egyetlen update-ben
      try {
        const result = await projectsApi.update(projectId, cleanUpdateData);
        return result;
      } catch (error: any) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      // Sikeres mentés - nincs felugró ablak
    },
    onError: (error: any) => {
      // Hiba esetén csak console-ba írunk, nincs felugró ablak
    },
  });

  const onContractSubmit = async (values: ContractDataFormValues) => {
    setIsSavingContract(true);
    try {
      await updateContractMutation.mutateAsync(values);
    } catch (error: any) {
      throw error;
    } finally {
      setIsSavingContract(false);
    }
  };

  const handleStatusChange = async (newStatus: Project['status']) => {
    if (!project) return;
    
    setIsUpdatingStatus(true);
    try {
      const auditLogEntry = createAuditLogEntry(
        'status_changed',
        user,
        `Státusz módosítva: ${statusLabels[project.status]} -> ${statusLabels[newStatus]}`
      );

      const updateData: any = {
        status: newStatus,
        audit_log: addAuditLogEntry(project.audit_log, auditLogEntry),
      };

      // Ha jóváhagyva/befejezve, állítsuk be a dátumot
      if (newStatus === 'approved') {
        updateData.approved_at = new Date().toISOString();
        // Strapi relation mezőket ID-val vagy documentId-val frissítjük
        // Strapi v5-ben a relation mezőket documentId-val kell küldeni, ha van
        if (user?.documentId) {
          updateData.approved_by = user.documentId;
        } else if (user?.id) {
          updateData.approved_by = user.id;
        }
        // Jóváhagyás után ne küldjük el a revision mezőket (így a Strapi megtartja az eredeti értékeket)
        // Ha törölni akarjuk, akkor üres stringet vagy null-t kellene küldeni, de az nem működik
        // Ezért egyszerűen nem küldjük el őket
      } else if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      // Szűrjük ki a szerveren még nem létező mezőket (audit_log-ot egyelőre csak akkor küldjük, ha tudjuk, hogy van)
      // És ne küldjük el null értékeket
      const fieldsNotOnServer = ['audit_log'];
      const cleanUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([key, value]) => {
          // Ne küldjük el a szerveren még nem létező mezőket
          if (fieldsNotOnServer.includes(key)) return false;
          // Ne küldjük el null értékeket (Strapi nem szereti)
          if (value === null) return false;
          return true;
        })
      );

      await projectsApi.update(projectId, cleanUpdateData);
      
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      
      // Sikeres státusz módosítás - nincs felugró ablak
    } catch (error: any) {
      // Hiba esetén logoljuk a részleteket
      console.error('Hiba a státusz módosítása során:', error);
      console.error('Update data:', updateData);
      if (error.response) {
        console.error('Strapi API Error Response:', error.response.data);
      }
      // Hibaüzenet megjelenítése a felhasználónak
      const errorMessage = error.message || 'Hiba történt a státusz módosítása során.';
      alert(errorMessage);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSendBackForRevision = async () => {
    if (!project || !revisionNotes.trim()) {
      alert('Kérjük, adja meg a javítási megjegyzést!');
      return;
    }

    setIsUpdatingStatus(true);
    try {
      const auditLogEntry = createAuditLogEntry(
        'status_changed',
        user,
        `Projekt visszaküldve javításra: ${revisionNotes}`
      );

      const updateData: any = {
        status: 'sent_back_for_revision',
        revision_notes: revisionNotes.trim(),
        sent_back_at: new Date().toISOString(),
        audit_log: addAuditLogEntry(project.audit_log, auditLogEntry),
      };

      // Relation mezőket csak akkor küldjük el, ha van értékük
      // Strapi v5-ben a relation mezőket documentId-val kell küldeni, ha van
      if (user?.documentId) {
        updateData.sent_back_by = user.documentId;
      } else if (user?.id) {
        updateData.sent_back_by = user.id;
      }

      // Szűrjük ki a szerveren még nem létező mezőket és null értékeket
      const fieldsNotOnServer = ['audit_log'];
      const cleanUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([key, value]) => {
          // Ne küldjük el a szerveren még nem létező mezőket
          if (fieldsNotOnServer.includes(key)) return false;
          // Ne küldjük el null értékeket
          if (value === null) return false;
          // Ne küldjük el undefined értékeket
          if (value === undefined) return false;
          return true;
        })
      );

      console.log('[handleSendBackForRevision] Sending update data:', JSON.stringify(cleanUpdateData, null, 2));
      
      await projectsApi.update(projectId, cleanUpdateData);
      
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      
      setIsRevisionDialogOpen(false);
      setRevisionNotes('');
    } catch (error: any) {
      console.error('[handleSendBackForRevision] Hiba:', error);
      console.error('[handleSendBackForRevision] Error response:', error.response?.data);
      console.error('[handleSendBackForRevision] Error status:', error.response?.status);
      console.error('[handleSendBackForRevision] Update data that was sent:', cleanUpdateData);
      
      // Részletesebb hibaüzenet
      let errorMessage = 'Hiba történt a projekt visszaküldése során.';
      if (error.response?.data?.error?.message) {
        errorMessage = `Strapi hiba: ${error.response.data.error.message}`;
      } else if (error.response?.data?.message) {
        errorMessage = `Strapi hiba: ${error.response.data.message}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Ha 400-as hiba, lehet hogy a mezők még nincsenek a Strapi-ben
      if (error.response?.status === 400) {
        errorMessage += '\n\nLehet, hogy a Strapi szerveren még nincsenek az új mezők (revision_notes, sent_back_at, sent_back_by) vagy az új státusz (sent_back_for_revision).\nKérjük, frissítse a Strapi szervert a docs/PROJECT_SCHEMA_UPDATE.md útmutató alapján.';
      }
      
      alert(errorMessage);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Ütemezés mentése
  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      if (!scheduleDate) {
        throw new Error('Dátum megadása kötelező');
      }

      // Dátum és idő kombinálása
      const [startHour, startMinute] = scheduleStartTime.split(':').map(Number);
      const scheduledDateTime = new Date(`${scheduleDate}T${scheduleStartTime}:00`);
      
      const auditLogEntry = createAuditLogEntry(
        project?.scheduled_date ? 'scheduled_date_modified' : 'scheduled_date_set',
        user,
        `Ütemezett dátum: ${scheduleDate} ${scheduleStartTime}-${scheduleEndTime}`
      );

      const updateData: any = {
        scheduled_date: scheduleDate, // Csak dátumot küldünk (date típus)
        audit_log: addAuditLogEntry(project?.audit_log || [], auditLogEntry),
      };

      // Szűrjük ki a szerveren még nem létező mezőket
      const fieldsNotOnServer = ['audit_log'];
      const cleanUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([key]) => !fieldsNotOnServer.includes(key))
      );

      await projectsApi.update(projectId, cleanUpdateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      console.log('Ütemezés sikeresen mentve');
    },
    onError: (error: any) => {
      console.error('Hiba az ütemezés mentésekor:', error);
    },
  });

  const handleSaveSchedule = async () => {
    setIsSavingSchedule(true);
    try {
      await saveScheduleMutation.mutateAsync();
    } catch (error) {
      // Hiba kezelés
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // Calendar export funkciók
  const handleGoogleCalendarExport = () => {
    if (!project) return;
    
    // Ha nincs scheduled_date, nincs mit exportálni
    if (!project.scheduled_date && !scheduleDate) {
      return;
    }
    
    // Ha van scheduleDate a form-ban, azt használjuk, különben a project.scheduled_date-et
    const dateToUse = scheduleDate || project.scheduled_date;
    const tempProject = { ...project, scheduled_date: dateToUse };
    
    const calendarData = generateCalendarEventFromProject(tempProject);
    
    // Ha van idő beállítva a form-ban, azt használjuk
    if (scheduleDate && scheduleStartTime && scheduleEndTime) {
      const [startHour, startMinute] = scheduleStartTime.split(':').map(Number);
      const [endHour, endMinute] = scheduleEndTime.split(':').map(Number);
      const startDate = new Date(`${scheduleDate}T${scheduleStartTime}:00`);
      const endDate = new Date(`${scheduleDate}T${scheduleEndTime}:00`);
      calendarData.startDate = startDate;
      calendarData.endDate = endDate;
    }
    
    const googleUrl = generateGoogleCalendarUrl(calendarData);
    window.open(googleUrl, '_blank');
  };

  const handleAppleCalendarExport = () => {
    if (!project) return;
    
    if (!project.scheduled_date && !scheduleDate) {
      return;
    }
    
    const dateToUse = scheduleDate || project.scheduled_date;
    const tempProject = { ...project, scheduled_date: dateToUse };
    
    const calendarData = generateCalendarEventFromProject(tempProject);
    
    // Ha van idő beállítva a form-ban, azt használjuk
    if (scheduleDate && scheduleStartTime && scheduleEndTime) {
      const startDate = new Date(`${scheduleDate}T${scheduleStartTime}:00`);
      const endDate = new Date(`${scheduleDate}T${scheduleEndTime}:00`);
      calendarData.startDate = startDate;
      calendarData.endDate = endDate;
    }
    
    const filename = `${project.title || 'event'}_${formatDate(dateToUse).replace(/-/g, '')}.ics`;
    downloadAppleCalendarFile(calendarData, filename);
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
  // Ellenőrizzük, hogy minden kötelező szerződés adat megvan-e és nem üres
  
  // Helper függvény: ellenőrzi, hogy a mező létezik-e és nem üres
  const isFieldFilled = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (typeof value === 'number') return value > 0;
    return !!value;
  };

  const hasClientBirthPlace = isFieldFilled(project.client_birth_place);
  const hasClientBirthDate = isFieldFilled(project.client_birth_date);
  const hasClientTaxId = isFieldFilled(project.client_tax_id);
  const hasAreaSqm = isFieldFilled(project.area_sqm);
  // insulation_option opcionális mező, nem kötelező a contractFilled-hez
  const hasFloorMaterial = !!project.floor_material;

  // Ingatlan cím ellenőrzése
  // Ha property_address_same === true, akkor az ingatlan cím mezőket automatikusan kitöltöttnek tekintjük
  // Ha property_address_same === false vagy undefined, akkor a property mezőket kell ellenőrizni
  const propertyAddressSame = project.property_address_same === true;
  const hasClientAddress = isFieldFilled(project.client_street) && 
                           isFieldFilled(project.client_city) && 
                           isFieldFilled(project.client_zip);
  const hasPropertyAddress = propertyAddressSame
    ? hasClientAddress // Ha megegyezik, akkor a client cím mezők alapján ellenőrizünk
    : (isFieldFilled(project.property_street) && 
       isFieldFilled(project.property_city) && 
       isFieldFilled(project.property_zip));

  // A szerződő cím mindig kötelező az összesítőben
  const contractFilled = !!(
    hasClientBirthPlace &&
    hasClientBirthDate &&
    hasClientTaxId &&
    hasAreaSqm &&
    hasFloorMaterial &&
    hasClientAddress && // Szerződő cím kötelező
    hasPropertyAddress // Ingatlan cím ellenőrzése (már tartalmazza a client cím ellenőrzését ha property_address_same === true)
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
              {project.status === 'ready_for_review' && (isMainContractor || isAdmin) && (
                <>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setIsRevisionDialogOpen(true)}
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
              {project.status === 'sent_back_for_revision' && !isMainContractor && !isAdmin && (
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => handleStatusChange('ready_for_review')}
                  disabled={isUpdatingStatus}
                >
                  Jóváhagyásra küldés
                </Button>
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

        {/* Revision Notes Alert - csak sent_back_for_revision vagy ready_for_review státuszban */}
        {(project.status === 'sent_back_for_revision' || project.status === 'ready_for_review') && 
         project.revision_notes && (
          <div className="mb-6">
            <Card className="border-2 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">
                      Visszaküldés javításra - Javítási megjegyzés
                    </h3>
                    <p className="text-red-700 dark:text-red-400 whitespace-pre-wrap">
                      {project.revision_notes}
                    </p>
                    {project.sent_back_at && (
                      <p className="text-xs text-red-600 dark:text-red-500 mt-2">
                        Visszaküldve: {formatDate(project.sent_back_at)}
                        {project.sent_back_by && typeof project.sent_back_by === 'object' && (
                          <span className="ml-2">
                            ({project.sent_back_by.email || project.sent_back_by.username})
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Revision Dialog */}
        <Dialog open={isRevisionDialogOpen} onOpenChange={setIsRevisionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Visszaküldés javításra</DialogTitle>
              <DialogDescription>
                Kérjük, adja meg a javítási megjegyzést, hogy mit kell javítani a projekten.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                placeholder="Például: A szerződés adatok hiányosak, kérjük töltse ki a hiányzó mezőket..."
                className="min-h-[120px]"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsRevisionDialogOpen(false);
                  setRevisionNotes('');
                }}
                disabled={isUpdatingStatus}
              >
                Mégse
              </Button>
              <Button
                onClick={handleSendBackForRevision}
                disabled={isUpdatingStatus || !revisionNotes.trim()}
                className="bg-red-600 hover:bg-red-700"
              >
                {isUpdatingStatus ? 'Feldolgozás...' : 'Visszaküldés javításra'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

                {canBeSentForReview && !isMainContractor && !isAdmin && (
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
                  {/* Main Contractor (Fővállalkozó) */}
                  {project.company && typeof project.company === 'object' && 'name' in project.company && (
                    <div className="flex items-start gap-3">
                      <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Fővállalkozó</p>
                        <p className="font-medium">
                          {(project.company as Company).name}
                          {(project.company as Company).type === 'main_contractor' && (
                            <span className="ml-2 text-xs text-gray-500">(Fővállalkozó)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Subcontractor (Kivitelező) */}
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Kivitelező</p>
                          {project.subcontractor && typeof project.subcontractor === 'object' && 'name' in project.subcontractor ? (
                            <p className="font-medium">
                              {(project.subcontractor as Company).name}
                              <span className="ml-2 text-xs text-gray-500">(Alvállalkozó)</span>
                            </p>
                          ) : (
                            <p className="font-medium text-gray-400 italic">Nincs kivitelező beállítva</p>
                          )}
                        </div>
                        {canEditSubcontractor && (
                          <Dialog open={isSubcontractorDialogOpen} onOpenChange={setIsSubcontractorDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4 mr-1" />
                                {project.subcontractor && typeof project.subcontractor === 'object' && 'name' in project.subcontractor ? 'Módosítás' : 'Beállítás'}
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Kivitelező beállítása</DialogTitle>
                                <DialogDescription>
                                  Válasszon alvállalkozót a projekt kivitelezéséhez, vagy távolítsa el a jelenlegi kivitelezőt.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="py-4">
                                <Select
                                  value={
                                    project.subcontractor && typeof project.subcontractor === 'object' && 'name' in project.subcontractor
                                      ? ((project.subcontractor as Company).documentId || (project.subcontractor as Company).id?.toString() || 'none')
                                      : 'none'
                                  }
                                  onValueChange={handleSubcontractorChange}
                                  disabled={updateSubcontractorMutation.isPending}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Válasszon kivitelezőt..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Nincs kivitelező</SelectItem>
                                    {subcontractors.map((subcontractor) => {
                                      const subId = subcontractor.documentId || subcontractor.id?.toString() || '';
                                      return (
                                        <SelectItem 
                                          key={subId} 
                                          value={subId}
                                        >
                                          {subcontractor.name}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              </div>
                              {subcontractors.length === 0 && (
                                <p className="text-sm text-gray-500 mt-2">
                                  Nincs elérhető alvállalkozó. Kérjük, először hozzon létre alvállalkozó céget a Beállítások menüben.
                                </p>
                              )}
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => setIsSubcontractorDialogOpen(false)}
                                  disabled={updateSubcontractorMutation.isPending}
                                >
                                  Mégse
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ütemezés */}
            <Card>
              <CardHeader>
                <CardTitle>Ütemezés</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Dátum</label>
                    <Input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Kezdés</label>
                    <Input
                      type="time"
                      value={scheduleStartTime}
                      onChange={(e) => setScheduleStartTime(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Vég</label>
                    <Input
                      type="time"
                      value={scheduleEndTime}
                      onChange={(e) => setScheduleEndTime(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-3 pt-2 border-t">
                  <Button
                    onClick={handleSaveSchedule}
                    disabled={isSavingSchedule || !scheduleDate}
                    size="sm"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Mentés
                  </Button>
                  
                  {(project?.scheduled_date || scheduleDate) && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGoogleCalendarExport}
                        disabled={!scheduleDate && !project?.scheduled_date}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Google Naptár
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAppleCalendarExport}
                        disabled={!scheduleDate && !project?.scheduled_date}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Apple Naptár
                      </Button>
                    </>
                  )}
                </div>
                
                {project?.scheduled_date && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Ütemezett: {formatDate(project.scheduled_date)}
                      {scheduleStartTime && scheduleEndTime && ` ${scheduleStartTime} - ${scheduleEndTime}`}
                    </span>
                  </div>
                )}
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
                            'material_modified': 'Anyag módosítva',
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
