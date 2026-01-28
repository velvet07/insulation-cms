'use client';

import { useState, useMemo, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import { calendarEventsApi } from '@/lib/api/calendar-events';
import type { Project } from '@/types';
import { Calendar, momentLocalizer, View, Event } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar as CalendarIcon, ExternalLink, Download, Save, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/lib/contexts/permission-context';
import { formatDate, formatPhoneNumber } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  generateGoogleCalendarUrl,
  downloadAppleCalendarFile,
  generateCalendarEventFromProject,
} from '@/lib/utils/calendar-export';
import { useAuthStore } from '@/lib/store/auth';
import { companiesApi } from '@/lib/api/companies';
import { isAdminRole, isMainContractor } from '@/lib/utils/user-role';

// Moment magyar nyelv beállítása
import 'moment/locale/hu';
moment.locale('hu');

const localizer = momentLocalizer(moment);

// Projekt alapú esemény típus
interface ProjectEvent extends Event {
  project: Project;
  resource: Project;
}

export default function CalendarPage() {
  const router = useRouter();
  const { can } = usePermission();
  const canViewCalendar = can('calendar', 'view_calendar');
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('month');
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!canViewCalendar) {
      router.push('/dashboard');
    }
  }, [canViewCalendar, router]);
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<ProjectEvent | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleStartTime, setScheduleStartTime] = useState('08:00');
  const [scheduleEndTime, setScheduleEndTime] = useState('16:00');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Use the same visibility rules as the Projects page:
  // - Admin: all projects
  // - Subcontractor: only projects where subcontractor == their company
  // - Main contractor: projects where they are company OR subcontractor OR subcontractor is one of their subcontractors
  const userCompanyId = useMemo(() => {
    if (!user?.company) return null;
    return typeof user.company === 'object' ? (user.company as any).documentId || (user.company as any).id : user.company;
  }, [user]);

  const { data: fetchedCompany } = useQuery({
    queryKey: ['company', userCompanyId, 'with-subs'],
    queryFn: () => companiesApi.getOne(userCompanyId!, 'subcontractors'),
    enabled: !!userCompanyId && !isAdminRole(user),
    staleTime: 1000 * 60 * 30,
  });

  const baseFilters = useMemo(() => {
    // Match Projects page default: exclude archived by default
    const filters: any = { status_not: 'archived' };

    if (!isAdminRole(user)) {
      const directCompany = typeof user?.company === 'object' ? (user.company as any) : null;
      const companyId = directCompany?.documentId || directCompany?.id || userCompanyId;
      const companyType = directCompany?.type || (fetchedCompany as any)?.type;

      if (companyType === 'subcontractor' || companyType === 'Alvállalkozó') {
        if (companyId) filters.subcontractor = companyId;
      } else if (!directCompany && !userCompanyId && user?.id) {
        // No company: show only projects assigned to this user (same as Projects page)
        filters.assigned_to = user.id;
      }
    }

    return filters;
  }, [user, userCompanyId, fetchedCompany]);

  const canQueryProjects = useMemo(() => {
    if (!canViewCalendar) return false;
    if (isAdminRole(user)) return true;
    if (!userCompanyId) return true;
    // If company is already populated (has type), we can build correct filters immediately.
    if (typeof user?.company === 'object') return true;
    // Otherwise wait until we resolved the company (so subcontractors don't briefly fetch all projects).
    return !!fetchedCompany;
  }, [canViewCalendar, user, userCompanyId, fetchedCompany]);

  // Projektek lekérése (csak a látható halmazhoz szükségesek)
  const { data: allProjects = [], isLoading } = useQuery({
    queryKey: ['calendar-projects', baseFilters],
    queryFn: () => projectsApi.getAll(baseFilters),
    enabled: canQueryProjects,
  });

  const userCompany = fetchedCompany || (typeof user?.company === 'object' ? user.company : null);

  const projects: Project[] = useMemo(() => {
    // Admin sees all, subcontractors are already filtered by backend, no company = no extra filter
    const isSubcontractor =
      (userCompany as any)?.type === 'subcontractor' || ((userCompany as any)?.type as any) === 'Alvállalkozó';
    if (isAdminRole(user) || !userCompanyId || isSubcontractor) return allProjects;

    // Main contractor: show projects where they are company OR subcontractor OR project subcontractor is theirs
    const mainId = userCompanyId.toString();
    return allProjects.filter((project) => {
      const projCompanyId = (project.company as any)?.documentId || (project.company as any)?.id;
      const projSubcontractorId = (project.subcontractor as any)?.documentId || (project.subcontractor as any)?.id;

      const isDirectlyAssigned =
        (projCompanyId?.toString() === mainId) || (projSubcontractorId?.toString() === mainId);

      let isSubcontractorAssigned = false;
      const subs = (userCompany as any)?.subcontractors;
      if (Array.isArray(subs) && projSubcontractorId) {
        isSubcontractorAssigned = subs.some(
          (sub: any) => (sub.documentId || sub.id)?.toString() === projSubcontractorId.toString()
        );
      }

      return isDirectlyAssigned || isSubcontractorAssigned;
    });
  }, [allProjects, user, userCompany, userCompanyId]);

  // Projektekből naptár események generálása
  const events: ProjectEvent[] = useMemo(() => {
    return projects
      .filter((project: Project) => project.scheduled_date)
      .map((project: Project) => {
        const scheduledDate = new Date(project.scheduled_date!);

        // Alapértelmezett időtartam: 8:00-16:00
        const start = new Date(scheduledDate);
        start.setHours(8, 0, 0, 0);

        const end = new Date(scheduledDate);
        end.setHours(16, 0, 0, 0);

        // Esemény cím összeállítása
        const title = project.title || `Projekt: ${project.client_name || 'Névtelen'}`;

        return {
          id: project.documentId || project.id,
          title,
          start,
          end,
          resource: project,
          project,
        } as ProjectEvent;
      });
  }, [projects]);

  // Naptár stílusok
  const eventStyleGetter = (event: ProjectEvent) => {
    const statusColors: Record<Project['status'], string> = {
      pending: '#f59e0b', // yellow
      in_progress: '#3b82f6', // blue
      ready_for_review: '#8b5cf6', // purple
      sent_back_for_revision: '#ef4444', // red
      approved: '#10b981', // green
      completed: '#6b7280', // gray
      archived: '#94a3b8', // slate
    };

    const backgroundColor = statusColors[event.project.status] || '#6b7280';

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    };
  };

  // Esemény kattintás kezelése
  const handleSelectEvent = (event: ProjectEvent) => {
    setSelectedEvent(event);

    // Betöltjük a jelenlegi dátumot és időt
    if (event.start) {
      const startDate = new Date(event.start);
      const year = startDate.getFullYear();
      const month = String(startDate.getMonth() + 1).padStart(2, '0');
      const day = String(startDate.getDate()).padStart(2, '0');
      setScheduleDate(`${year}-${month}-${day}`);

      const hours = startDate.getHours();
      const minutes = startDate.getMinutes();
      setScheduleStartTime(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
    }

    if (event.end) {
      const endDate = new Date(event.end);
      const endHours = endDate.getHours();
      const endMinutes = endDate.getMinutes();
      setScheduleEndTime(`${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`);
    }

    setIsExportDialogOpen(true);
  };

  // Navigálás a projekt részletekhez
  const handleNavigateToProject = () => {
    if (!selectedEvent) return;

    const projectId = selectedEvent.project.documentId || selectedEvent.project.id;
    router.push(`/dashboard/projects/${projectId}`);
    setIsExportDialogOpen(false);
  };

  // Google Calendar export
  const handleGoogleCalendarExport = () => {
    if (!selectedEvent) return;

    const calendarData = generateCalendarEventFromProject(selectedEvent.project);

    // Ha van scheduled_date, az időt is beállítjuk az esemény alapján
    if (selectedEvent.start && selectedEvent.end) {
      calendarData.startDate = selectedEvent.start;
      calendarData.endDate = selectedEvent.end;
    }

    const googleUrl = generateGoogleCalendarUrl(calendarData);
    window.open(googleUrl, '_blank');
    setIsExportDialogOpen(false);
  };

  // Apple Calendar export
  const handleAppleCalendarExport = () => {
    if (!selectedEvent) return;

    const calendarData = generateCalendarEventFromProject(selectedEvent.project);

    // Ha van scheduled_date, az időt is beállítjuk az esemény alapján
    if (selectedEvent.start && selectedEvent.end) {
      calendarData.startDate = selectedEvent.start;
      calendarData.endDate = selectedEvent.end;
    }

    const filename = `${selectedEvent.project.title || 'event'}_${formatDate(selectedEvent.start).replace(/-/g, '')}.ics`;
    downloadAppleCalendarFile(calendarData, filename);
    setIsExportDialogOpen(false);
  };

  // Ütemezés mentése
  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEvent || !scheduleDate) {
        throw new Error('Dátum megadása kötelező');
      }

      const projectId = selectedEvent.project.documentId || selectedEvent.project.id;

      // Dátum és idő kombinálása - az időt is eltároljuk a scheduled_date-ben
      // A Strapi date mező fogadja el a datetime formátumot is, de csak a dátum részt használja
      // Az időt a frontend-en kezeljük
      const updateData = {
        scheduled_date: scheduleDate, // Dátum formátum: YYYY-MM-DD
      };

      await projectsApi.update(projectId, updateData);

      // A dátum és idő változását a naptárban azonnal frissítjük az events-ben
      // a queryClient.invalidateQueries miatt újratöltődik
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', selectedEvent?.project.documentId || selectedEvent?.project.id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      console.log('Ütemezés sikeresen mentve');
      setIsExportDialogOpen(false);
    },
    onError: (error: any) => {
      console.error('Hiba az ütemezés mentésekor:', error);
    },
  });

  const handleSaveSchedule = async () => {
    if (!scheduleDate) return;

    setIsSavingSchedule(true);
    try {
      await saveScheduleMutation.mutateAsync();
    } catch (error) {
      // Hiba kezelés már a mutation-ben van
    } finally {
      setIsSavingSchedule(false);
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Naptár</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Tekintse meg az ütemezett eseményeket és projekteket
          </p>
        </div>

        <Card className="mb-6">
          <CardContent className="p-0">
            <div style={{ height: '600px' }} className="p-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Betöltés...</p>
                </div>
              ) : (
                <Calendar
                  localizer={localizer}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  view={view}
                  onView={setView}
                  date={date}
                  onNavigate={setDate}
                  onSelectEvent={handleSelectEvent}
                  eventPropGetter={eventStyleGetter}
                  messages={{
                    next: 'Következő',
                    previous: 'Előző',
                    today: 'Ma',
                    month: 'Hónap',
                    week: 'Hét',
                    day: 'Nap',
                    agenda: 'Naptár',
                    date: 'Dátum',
                    time: 'Idő',
                    event: 'Esemény',
                    noEventsInRange: 'Nincs esemény ebben az időszakban.',
                  }}
                  style={{ height: '100%' }}
                  className="rbc-calendar"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Státusz jelmagyarázat */}
        <Card>
          <CardHeader>
            <CardTitle>Státusz jelmagyarázat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500"></div>
                <span className="text-sm">Függőben</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-500"></div>
                <span className="text-sm">Folyamatban</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-purple-500"></div>
                <span className="text-sm">Átnézésre vár</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span className="text-sm">Jóváhagyva</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-500"></div>
                <span className="text-sm">Befejezve</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Export dialógus */}
        <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedEvent?.title}</DialogTitle>
              <DialogDescription>
                Módosítsa az ütemezést vagy exportálja az eseményt a külső naptárba.
              </DialogDescription>
            </DialogHeader>

            {selectedEvent && (
              <div className="space-y-4 py-4">
                {/* Ütemezés módosítása */}
                <div className="space-y-4 border-b pb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <h4 className="font-medium text-sm">Ütemezés módosítása</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="schedule-date" className="text-sm mb-2 block">
                        Dátum
                      </Label>
                      <Input
                        id="schedule-date"
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <Label htmlFor="schedule-start-time" className="text-sm mb-2 block">
                        Kezdés
                      </Label>
                      <Input
                        id="schedule-start-time"
                        type="time"
                        value={scheduleStartTime}
                        onChange={(e) => setScheduleStartTime(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <Label htmlFor="schedule-end-time" className="text-sm mb-2 block">
                        Vég
                      </Label>
                      <Input
                        id="schedule-end-time"
                        type="time"
                        value={scheduleEndTime}
                        onChange={(e) => setScheduleEndTime(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </div>
                  {can('calendar', 'manage_schedule') && (
                    <Button
                      onClick={handleSaveSchedule}
                      disabled={isSavingSchedule || !scheduleDate}
                      size="sm"
                      className="w-full sm:w-auto flex items-center justify-center"
                    >
                      <Save className="mr-2 h-4 w-4 shrink-0" />
                      <span>{isSavingSchedule ? 'Mentés...' : 'Ütemezés mentése'}</span>
                    </Button>
                  )}
                </div>

                {/* Projekt információk */}
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Ügyfél:</span>{' '}
                    {selectedEvent.project.client_name || '-'}
                  </div>
                  {selectedEvent.project.client_phone && (
                    <div>
                      <span className="font-medium">Telefonszám:</span>{' '}
                      {formatPhoneNumber(selectedEvent.project.client_phone)}
                    </div>
                  )}
                  {selectedEvent.project.client_email && (
                    <div>
                      <span className="font-medium">Email:</span>{' '}
                      {selectedEvent.project.client_email}
                    </div>
                  )}
                  {selectedEvent.project.area_sqm && (
                    <div>
                      <span className="font-medium">Terület:</span>{' '}
                      {selectedEvent.project.area_sqm} m²
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-2 mt-4 px-0">
              <Button
                variant="outline"
                onClick={handleNavigateToProject}
                size="sm"
                className="w-full sm:flex-1 flex items-center justify-center min-w-0"
              >
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate text-xs sm:text-sm">Projekt részletei</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleGoogleCalendarExport}
                size="sm"
                className="w-full sm:flex-1 flex items-center justify-center min-w-0"
              >
                <ExternalLink className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate text-xs sm:text-sm">Google Naptár</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleAppleCalendarExport}
                size="sm"
                className="w-full sm:flex-1 flex items-center justify-center min-w-0"
              >
                <Download className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate text-xs sm:text-sm">Apple Naptár</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
