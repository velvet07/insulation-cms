'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useAuthStore } from '@/lib/store/auth';
import { isAdminRole } from '@/lib/utils/user-role';
import { projectsApi } from '@/lib/api/projects';
import { companiesApi } from '@/lib/api/companies';
import type { Company, Project } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function formatMoneyHuf(value: number) {
  if (!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(value);
}

function startOfWeekISO() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function startOfMonthISO() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isCompanyObject(value: any): value is Company {
  return !!value && typeof value === 'object' && ('id' in value || 'documentId' in value);
}

function resolveMainContractorForBilling(p: Project): Company | undefined {
  const companyRaw = (p as any).company;
  const subcontractorRaw = (p as any).subcontractor;

  const company = isCompanyObject(companyRaw) ? (companyRaw as any) : null;
  const subcontractor = isCompanyObject(subcontractorRaw) ? (subcontractorRaw as any) : null;

  // Most common: project.company is the main contractor.
  if (company?.type === 'main_contractor') return company as Company;

  // Legacy / alternative: project.company is a subcontractor -> use its parent_company.
  if (company?.type === 'subcontractor' && isCompanyObject(company?.parent_company)) return company.parent_company as Company;

  // If project.subcontractor is set and has a parent_company, attribute to that parent.
  if (subcontractor?.type === 'subcontractor' && isCompanyObject(subcontractor?.parent_company))
    return subcontractor.parent_company as Company;

  // If project.subcontractor is actually the main contractor (edge case).
  if (subcontractor?.type === 'main_contractor') return subcontractor as Company;

  // Fallback: if we at least have a company object, prefer showing it rather than dropping the project.
  if (company) return company as Company;

  return undefined;
}

export default function BillingPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = isAdminRole(user);

  const [from, setFrom] = useState<string>(startOfMonthISO());
  const [to, setTo] = useState<string>(todayISO());

  const { data: mainContractors = [] } = useQuery({
    queryKey: ['companies', 'main_contractors'],
    queryFn: () => companiesApi.getAll({ type: 'main_contractor' }),
    enabled: isAdmin,
  });

  const { data: startedProjects = [], isLoading } = useQuery({
    queryKey: ['billing', 'started-projects', from, to],
    queryFn: () => projectsApi.getStartedForBilling({ from, to }),
    enabled: isAdmin && !!from && !!to,
  });

  const summary = useMemo(() => {
    const byCompany = new Map<string, { company: Company; projects: Project[]; totalArea: number }>();

    for (const p of startedProjects) {
      const c = resolveMainContractorForBilling(p);
      if (!c) continue;
      const cid = (c.documentId || c.id).toString();
      const entry = byCompany.get(cid) || { company: c, projects: [], totalArea: 0 };
      entry.projects.push(p);
      entry.totalArea += Number(p.area_sqm || 0);
      byCompany.set(cid, entry);
    }

    // Ensure all main contractors show up (even zero)
    for (const c of mainContractors) {
      const cid = (c.documentId || c.id).toString();
      if (!byCompany.has(cid)) byCompany.set(cid, { company: c, projects: [], totalArea: 0 });
    }

    return Array.from(byCompany.values()).sort((a, b) => (a.company.name || '').localeCompare(b.company.name || ''));
  }, [startedProjects, mainContractors]);

  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <Card>
            <CardHeader>
              <CardTitle>Elszámolás</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">Ehhez az oldalhoz csak Admin fér hozzá.</p>
            </CardContent>
          </Card>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Elszámolás</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Megkezdett projektek (doksi generálás / doksi feltöltés / fotó feltöltés után).
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Időszak</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Ettől</label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Eddig</label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setFrom(startOfWeekISO()); setTo(todayISO()); }}>
                  Heti
                </Button>
                <Button variant="outline" onClick={() => { setFrom(startOfMonthISO()); setTo(todayISO()); }}>
                  Havi
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Összesítő (Fővállalkozónként)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fővállalkozó</TableHead>
                    <TableHead className="text-right">Megkezdett projektek</TableHead>
                    <TableHead className="text-right">Össz m²</TableHead>
                    <TableHead className="text-right">Ár (Ft/m²)</TableHead>
                    <TableHead className="text-right">Összeg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map(({ company, projects, totalArea }) => {
                    const price = Number(company.billing_price_per_sqm || 0);
                    const amount = totalArea * price;
                    return (
                      <TableRow key={(company.documentId || company.id).toString()}>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell className="text-right">{projects.length}</TableCell>
                        <TableCell className="text-right">{totalArea ? totalArea.toFixed(2) : '0'}</TableCell>
                        <TableCell className="text-right">{price ? price.toFixed(2) : '-'}</TableCell>
                        <TableCell className="text-right">{price ? formatMoneyHuf(amount) : '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Megkezdett projektek listája</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-gray-500">Betöltés...</p>
            ) : startedProjects.length === 0 ? (
              <p className="text-gray-500">Nincs megkezdett projekt a kiválasztott időszakban.</p>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Megkezdve</TableHead>
                      <TableHead>Projekt</TableHead>
                      <TableHead>Ügyfél</TableHead>
                      <TableHead className="text-right">m²</TableHead>
                      <TableHead>Fővállalkozó</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {startedProjects.map((p) => (
                      <TableRow key={(p.documentId || p.id).toString()}>
                        <TableCell>{p.started_at ? new Date(p.started_at).toLocaleDateString('hu-HU') : '-'}</TableCell>
                        <TableCell className="font-medium">{p.title}</TableCell>
                        <TableCell>{p.client_name}</TableCell>
                        <TableCell className="text-right">{p.area_sqm ? Number(p.area_sqm).toFixed(2) : '-'}</TableCell>
                        <TableCell>{resolveMainContractorForBilling(p)?.name || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

