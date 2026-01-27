'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { projectsApi } from '@/lib/api/projects';
import { useAuthStore } from '@/lib/store/auth';
import { usePermission } from '@/lib/contexts/permission-context';
import type { Project } from '@/types';
import { CheckCircle2, Copy, FileText, Loader2 } from 'lucide-react';

export default function ApprovedProjectsPage() {
  const user = useAuthStore((state) => state.user);
  const { can } = usePermission();
  const router = useRouter();
  const queryClient = useQueryClient();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const monthStartStr = useMemo(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    return start.toISOString().split('T')[0];
  }, []);

  const [fromDate, setFromDate] = useState<string>(monthStartStr);
  const [toDate, setToDate] = useState<string>(todayStr);

  type TigMarkMap = Record<string, { markedAt: string }>;
  const [tigMarks, setTigMarks] = useState<TigMarkMap>({});

  const [isListDialogOpen, setIsListDialogOpen] = useState(false);
  const [generatedListText, setGeneratedListText] = useState('');
  const [generatedListTitle, setGeneratedListTitle] = useState('');

  const [selectedForCompletion, setSelectedForCompletion] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!can('approved_projects', 'view_list')) {
      router.push('/dashboard');
    }
  }, [can, router]);

  // Fetch approved projects - hooks must be called before any conditional returns
  const { data: approvedProjects = [], isLoading } = useQuery({
    queryKey: ['projects', 'approved'],
    queryFn: () => projectsApi.getAll({ status: 'approved' }),
    enabled: can('approved_projects', 'view_list'),
  });

  const completeProjectsMutation = useMutation({
    mutationFn: async (projects: Project[]) => {
      const completedAt = new Date().toISOString();
      const toComplete = projects.filter((p) => p.status === 'approved');
      const promises = toComplete.map((p) => {
        const identifier = p.documentId || p.id;
        if (!identifier) return Promise.reject(new Error('Projekt azonosító hiányzik'));
        return projectsApi.update(identifier, {
          status: 'completed',
          completed_at: completedAt,
        });
      });
      await Promise.all(promises);
      return { count: toComplete.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'approved'] });
    },
    onError: (error: any) => {
      alert(`Hiba: ${error?.message || 'Hiba történt a projekt lezárása során.'}`);
    },
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const normalizeDate = (s: string) => (s || '').slice(0, 10);
  const toUtcMs = (dateStr: string) => {
    const [y, m, d] = normalizeDate(dateStr).split('-').map((p) => parseInt(p, 10));
    if (!y || !m || !d) return NaN;
    return Date.UTC(y, m - 1, d);
  };

  const tigStorageKey = useMemo(() => {
    const companyKey =
      (user?.company && typeof user.company === 'object' && ((user.company as any).id || (user.company as any).documentId)) ||
      'unknown';
    return `tig_marked_v1_${String(companyKey)}`;
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(tigStorageKey);
      if (!raw) {
        setTigMarks({});
        return;
      }
      const parsed = JSON.parse(raw);
      setTigMarks(parsed && typeof parsed === 'object' ? (parsed as TigMarkMap) : {});
    } catch {
      setTigMarks({});
    }
  }, [tigStorageKey]);

  const persistTigMarks = (next: TigMarkMap) => {
    setTigMarks(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(tigStorageKey, JSON.stringify(next));
    }
  };

  const isTigMarked = (projectId: string) => !!tigMarks[projectId];

  const setTigMarked = (projectId: string, marked: boolean) => {
    const next = { ...tigMarks };
    if (marked) next[projectId] = { markedAt: new Date().toISOString() };
    else delete next[projectId];
    persistTigMarks(next);
  };

  const toggleSelectedForCompletion = (projectId: string, checked: boolean) => {
    setSelectedForCompletion((prev) => {
      const next = new Set(prev);
      if (checked) next.add(projectId);
      else next.delete(projectId);
      return next;
    });
  };

  const filteredProjects = useMemo(() => {
    const fromMs = toUtcMs(fromDate);
    const toMs = toUtcMs(toDate);
    return (approvedProjects || []).filter((p) => {
      const d = normalizeDate(p.approved_at || '');
      const ms = toUtcMs(d);
      if (!Number.isFinite(ms)) return false;
      if (Number.isFinite(fromMs) && ms < fromMs) return false;
      if (Number.isFinite(toMs) && ms > toMs) return false;
      return true;
    });
  }, [approvedProjects, fromDate, toDate]);

  type Group = {
    approvedDate: string; // YYYY-MM-DD
    companyId: string;
    companyName: string;
    projects: Project[];
    totalArea: number;
    markedCount: number;
  };

  const groupsByDate = useMemo(() => {
    const byKey = new Map<string, Group>();

    filteredProjects.forEach((project) => {
      const approvedDate = normalizeDate(project.approved_at || '');
      const subcontractor = project.subcontractor;
      const companyId = String(subcontractor?.documentId || subcontractor?.id || 'no-subcontractor');
      const companyName = subcontractor?.name || 'Nincs alvállalkozó';
      const key = `${approvedDate}__${companyId}`;

      if (!byKey.has(key)) {
        byKey.set(key, {
          approvedDate,
          companyId,
          companyName,
          projects: [],
          totalArea: 0,
          markedCount: 0,
        });
      }

      const g = byKey.get(key)!;
      g.projects.push(project);
      g.totalArea += project.area_sqm || 0;
    });

    // Compute marked counts
    byKey.forEach((g) => {
      g.markedCount = g.projects.reduce((acc, p) => acc + (isTigMarked(String(p.documentId || p.id)) ? 1 : 0), 0);
    });

    const groups = Array.from(byKey.values());
    groups.sort((a, b) => {
      const d = toUtcMs(b.approvedDate) - toUtcMs(a.approvedDate);
      if (d !== 0) return d;
      return a.companyName.localeCompare(b.companyName, 'hu-HU');
    });

    const byDate: Record<string, Group[]> = {};
    groups.forEach((g) => {
      if (!byDate[g.approvedDate]) byDate[g.approvedDate] = [];
      byDate[g.approvedDate].push(g);
    });
    return byDate;
  }, [filteredProjects, tigMarks]);

  const buildTextList = (approvedDate: string, companyName: string, projects: Project[]) => {
    const lines: string[] = [];
    const totalSqm = projects.reduce((acc, p) => acc + (p.area_sqm || 0), 0);
    lines.push('Teljesítési igazolás – Projekt lista');
    lines.push(`Cég: ${companyName}`);
    lines.push(`Jóváhagyás dátuma: ${formatDate(approvedDate)}`);
    lines.push('');
    projects.forEach((p) => {
      const sqm = p.area_sqm ?? 0;
      lines.push(`- ${p.title} | ${p.client_address} | ${sqm} m²`);
    });
    lines.push('');
    lines.push(`Összesen: ${totalSqm.toLocaleString('hu-HU')} m²`);
    lines.push(`Projektek száma: ${projects.length}`);
    return { text: lines.join('\n'), totalSqm };
  };

  const handleGenerateTextList = (group: Group) => {
    const projects = [...group.projects].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'hu-HU'));
    const { text } = buildTextList(group.approvedDate, group.companyName, projects);
    setGeneratedListTitle(`${formatDate(group.approvedDate)} • ${group.companyName}`);
    setGeneratedListText(text);
    setIsListDialogOpen(true);

    // Mark all projects in the group as "certificate created"
    const next = { ...tigMarks };
    projects.forEach((p) => {
      const id = String(p.documentId || p.id);
      next[id] = { markedAt: new Date().toISOString() };
    });
    persistTigMarks(next);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedListText);
    } catch {
      // Fallback: leave text selectable in textarea
      alert('A vágólapra másolás nem sikerült. Jelölje ki és másolja manuálisan.');
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-3xl font-bold">Jóváhagyott projektek</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Dátum szerinti listázás és teljesítési igazolás (szöveges lista)
                </p>
              </div>
            </div>
          </div>

          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <Label htmlFor="from-date" className="text-sm">Dátumtól</Label>
                  <Input id="from-date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-44" />
                </div>
                <div>
                  <Label htmlFor="to-date" className="text-sm">Dátumig</Label>
                  <Input id="to-date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-44" />
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
                <p className="text-gray-500 mt-2">Betöltés...</p>
              </CardContent>
            </Card>
          ) : Object.keys(groupsByDate).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <CheckCircle2 className="mx-auto h-12 w-12 mb-2 text-gray-400" />
                <p className="text-sm">Nincs jóváhagyott projekt a megadott dátumtartományban.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupsByDate).map(([approvedDate, groups]) => (
                <Card key={approvedDate}>
                  <CardHeader>
                    <CardTitle>{formatDate(approvedDate)}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {groups.map((g) => (
                      <Card key={`${g.approvedDate}__${g.companyId}`}>
                        <CardHeader>
                          <div className="flex items-center justify-between gap-4">
                            <CardTitle className="text-base">
                              {g.companyName} ({g.projects.length} projekt, összesen {g.totalArea.toLocaleString('hu-HU')} m²)
                              {g.markedCount > 0 && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                  • Jelölve: {g.markedCount}/{g.projects.length}
                                </span>
                              )}
                            </CardTitle>
                            {(() => {
                              const groupProjectIds = g.projects.map((p) => String(p.documentId || p.id));
                              const selectedCount = groupProjectIds.reduce((acc, id) => acc + (selectedForCompletion.has(id) ? 1 : 0), 0);
                              const allSelected = groupProjectIds.length > 0 && selectedCount === groupProjectIds.length;
                              const someSelected = selectedCount > 0 && !allSelected;

                              return (
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-2 mr-2">
                                    <Checkbox
                                      checked={allSelected}
                                      onCheckedChange={(checked) => {
                                        const shouldSelectAll = checked === true;
                                        setSelectedForCompletion((prev) => {
                                          const next = new Set(prev);
                                          groupProjectIds.forEach((id) => {
                                            if (shouldSelectAll) next.add(id);
                                            else next.delete(id);
                                          });
                                          return next;
                                        });
                                      }}
                                      ref={(el) => {
                                        if (el) {
                                          (el as any).indeterminate = someSelected;
                                        }
                                      }}
                                    />
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Kijelölés</span>
                                  </div>

                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={selectedCount === 0 || completeProjectsMutation.isPending}
                                    onClick={() => {
                                      if (selectedCount === 0) return;
                                      if (confirm(`Biztosan befejezetté jelölöd a kijelölt ${selectedCount} projektet?`)) {
                                        const selectedProjects = g.projects.filter((p) => selectedForCompletion.has(String(p.documentId || p.id)));
                                        completeProjectsMutation.mutate(selectedProjects, {
                                          onSuccess: () => {
                                            setSelectedForCompletion((prev) => {
                                              const next = new Set(prev);
                                              selectedProjects.forEach((p) => next.delete(String(p.documentId || p.id)));
                                              return next;
                                            });
                                          },
                                        });
                                      }
                                    }}
                                  >
                                    Befejezés ({selectedCount})
                                  </Button>

                                  <Button type="button" variant="outline" size="sm" onClick={() => handleGenerateTextList(g)}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Szöveges lista generálása
                                  </Button>
                                </div>
                              );
                            })()}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-16 text-center">Kijelölés</TableHead>
                                <TableHead className="w-16 text-center">TIG</TableHead>
                                <TableHead>Projekt neve</TableHead>
                                <TableHead>Cím</TableHead>
                                <TableHead className="text-right">Terület (m²)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {g.projects.map((project) => {
                                const projectId = String(project.documentId || project.id);
                                const marked = isTigMarked(projectId);
                                const selected = selectedForCompletion.has(projectId);
                                return (
                                  <TableRow key={projectId}>
                                    <TableCell className="text-center">
                                      <Checkbox
                                        checked={selected}
                                        onCheckedChange={(checked) => toggleSelectedForCompletion(projectId, checked === true)}
                                      />
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Checkbox
                                        checked={marked}
                                        onCheckedChange={(checked) => setTigMarked(projectId, checked === true)}
                                      />
                                    </TableCell>
                                    <TableCell className="font-medium">{project.title}</TableCell>
                                    <TableCell>{project.client_address}</TableCell>
                                    <TableCell className="text-right">{project.area_sqm ? `${project.area_sqm} m²` : '-'}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Dialog open={isListDialogOpen} onOpenChange={setIsListDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Szöveges lista</DialogTitle>
              <DialogDescription>{generatedListTitle}</DialogDescription>
            </DialogHeader>
            <Textarea value={generatedListText} readOnly className="min-h-[320px] font-mono text-xs" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" />
                Másolás
              </Button>
              <Button type="button" onClick={() => setIsListDialogOpen(false)}>Bezárás</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
