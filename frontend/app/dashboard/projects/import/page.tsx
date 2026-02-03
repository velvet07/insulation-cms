'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { projectsApi } from '@/lib/api/projects';
import { useAuthStore } from '@/lib/store/auth';
import { usePermission } from '@/lib/contexts/permission-context';
import { createAuditLogEntry } from '@/lib/utils/audit-log';
import {
  readExcelFile,
  getSheetData,
  suggestColumnMapping,
  generatePreview,
  downloadImportTemplate,
  IMPORTABLE_FIELDS,
  type ColumnMapping,
  type PreviewRow,
} from '@/lib/utils/excel-import';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Download,
  HelpCircle,
} from 'lucide-react';

type ImportStep = 'upload' | 'sheet' | 'mapping' | 'preview' | 'importing' | 'complete';

export default function ProjectImportPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { can } = usePermission();

  // State
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Redirect if no permission
  if (!can('projects', 'create')) {
    router.push('/dashboard/projects');
    return null;
  }

  // File upload handler
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError(null);
    setFile(selectedFile);

    try {
      const result = await readExcelFile(selectedFile);
      setWorkbook(result.workbook);
      setSheetNames(result.sheetNames);

      if (result.sheetNames.length === 1) {
        // Ha csak egy sheet van, automatikusan kiválasztjuk
        setSelectedSheet(result.sheetNames[0]);
        loadSheetData(result.workbook, result.sheetNames[0]);
        setStep('mapping');
      } else {
        setStep('sheet');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt a fájl beolvasása közben.');
    }
  }, []);

  // Sheet data betöltése
  const loadSheetData = useCallback((wb: XLSX.WorkBook, sheetName: string) => {
    try {
      const data = getSheetData(wb, sheetName);
      setHeaders(data.headers);
      setRows(data.rows);
      const suggestedMapping = suggestColumnMapping(data.headers);
      setColumnMapping(suggestedMapping);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // Sheet kiválasztása
  const handleSheetSelect = useCallback((sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbook) {
      loadSheetData(workbook, sheetName);
      setStep('mapping');
    }
  }, [workbook, loadSheetData]);

  // Mapping módosítása
  const updateMapping = useCallback((excelColumn: string, projectField: string | null) => {
    setColumnMapping(prev => prev.map(m =>
      m.excelColumn === excelColumn ? { ...m, projectField } : m
    ));
  }, []);

  // Preview generálása
  const handleGeneratePreview = useCallback(() => {
    const previewData = generatePreview(rows, columnMapping);
    setPreview(previewData);
    setStep('preview');
  }, [rows, columnMapping]);

  // Import statistics
  const previewStats = useMemo(() => {
    const valid = preview.filter(p => p.isValid).length;
    const invalid = preview.filter(p => !p.isValid).length;
    const withWarnings = preview.filter(p => p.warnings.length > 0).length;
    return { valid, invalid, withWarnings, total: preview.length };
  }, [preview]);

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      const validRows = preview.filter(p => p.isValid);
      const errors: string[] = [];
      let imported = 0;

      // Get user company info for the projects
      const userCompany = user?.company as any;
      const companyId = userCompany?.documentId || userCompany?.id;

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        setImportProgress(Math.round(((i + 1) / validRows.length) * 100));

        try {
          // Create audit log entry
          const auditLogEntry = createAuditLogEntry(
            'project_created',
            user,
            `Projekt importálva Excelből: ${row.data.title || row.data.client_name}`
          );
          auditLogEntry.module = 'Projekt';

          // Prepare project data
          const projectData: any = {
            ...row.data,
            status: 'pending',
            audit_log: [auditLogEntry],
          };

          // Add company if user has one
          if (companyId) {
            projectData.company = companyId;
          }

          await projectsApi.create(projectData);
          imported++;
        } catch (err: any) {
          errors.push(`Sor ${row.rowIndex}: ${err.message || 'Ismeretlen hiba'}`);
        }
      }

      return { imported, failed: validRows.length - imported, errors };
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep('complete');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err: any) => {
      setError(err.message || 'Hiba történt az importálás során.');
      setStep('preview');
    },
  });

  // Start import
  const handleStartImport = useCallback(() => {
    setStep('importing');
    setImportProgress(0);
    importMutation.mutate();
  }, [importMutation]);

  // Download sample template
  const handleDownloadTemplate = useCallback(() => {
    downloadImportTemplate();
  }, []);

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 'upload':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Excel fájl feltöltése
              </CardTitle>
              <CardDescription>
                Töltsön fel egy Excel (.xlsx) fájlt a projektek importálásához
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="max-w-xs mx-auto"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Támogatott formátumok: .xlsx, .xls
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="outline" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Sablon letöltése
                </Button>
                <Button variant="ghost" onClick={() => router.push('/dashboard/projects')}>
                  Mégse
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'sheet':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Munkalap kiválasztása</CardTitle>
              <CardDescription>
                A fájl több munkalapot tartalmaz. Válassza ki, melyiket szeretné importálni.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                {sheetNames.map(name => (
                  <Button
                    key={name}
                    variant={selectedSheet === name ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => handleSheetSelect(name)}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    {name}
                  </Button>
                ))}
              </div>
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Vissza
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'mapping':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Oszlop megfeleltetés</CardTitle>
              <CardDescription>
                Párosítsa az Excel oszlopokat a projekt mezőkkel. A csillaggal (*) jelölt mezők kötelezőek.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {columnMapping.map(({ excelColumn, projectField }) => (
                  <div key={excelColumn} className="flex items-center gap-4">
                    <div className="w-1/3">
                      <Label className="text-sm font-medium">{excelColumn}</Label>
                      <p className="text-xs text-gray-500 truncate">
                        Pl: {rows[0]?.[excelColumn] || '-'}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <div className="w-2/3">
                      <Select
                        value={projectField || '_none'}
                        onValueChange={(v) => updateMapping(excelColumn, v === '_none' ? null : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Válasszon mezőt..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">-- Kihagyás --</SelectItem>
                          {IMPORTABLE_FIELDS.map(field => (
                            <SelectItem key={field.key} value={field.key}>
                              {field.label} {field.required && '*'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-4 mt-4 border-t">
                <Button variant="outline" onClick={() => setStep(sheetNames.length > 1 ? 'sheet' : 'upload')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Vissza
                </Button>
                <Button onClick={handleGeneratePreview}>
                  Előnézet
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'preview':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Import előnézet</CardTitle>
              <CardDescription>
                Ellenőrizze az adatokat az importálás előtt
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Statistics */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">{previewStats.total}</div>
                  <div className="text-sm text-gray-500">Összes sor</div>
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{previewStats.valid}</div>
                  <div className="text-sm text-gray-500">Érvényes</div>
                </div>
                <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">{previewStats.invalid}</div>
                  <div className="text-sm text-gray-500">Hibás</div>
                </div>
                <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-600">{previewStats.withWarnings}</div>
                  <div className="text-sm text-gray-500">Figyelmeztetés</div>
                </div>
              </div>

              {/* Preview table */}
              <div className="max-h-[400px] overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Sor</TableHead>
                      <TableHead className="w-20">Státusz</TableHead>
                      <TableHead>Projekt neve</TableHead>
                      <TableHead>Ügyfél neve</TableHead>
                      <TableHead>Terület</TableHead>
                      <TableHead>Hibák / Figyelmeztetések</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 100).map((row) => (
                      <TableRow key={row.rowIndex} className={!row.isValid ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                        <TableCell>{row.rowIndex}</TableCell>
                        <TableCell>
                          {row.isValid ? (
                            <Badge variant="outline" className="bg-green-100 text-green-700">
                              <Check className="h-3 w-3 mr-1" /> OK
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-100 text-red-700">
                              <X className="h-3 w-3 mr-1" /> Hiba
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{row.data.title || '-'}</TableCell>
                        <TableCell>{row.data.client_name || '-'}</TableCell>
                        <TableCell>{row.data.area_sqm ? `${row.data.area_sqm} m²` : '-'}</TableCell>
                        <TableCell className="max-w-xs">
                          {row.errors.length > 0 && (
                            <div className="text-red-600 text-sm">
                              {row.errors.map((e, i) => <div key={i}>• {e}</div>)}
                            </div>
                          )}
                          {row.warnings.length > 0 && (
                            <div className="text-yellow-600 text-sm">
                              {row.warnings.map((w, i) => <div key={i}>• {w}</div>)}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.length > 100 && (
                  <div className="p-2 text-center text-sm text-gray-500 bg-gray-50">
                    ... és még {preview.length - 100} sor
                  </div>
                )}
              </div>

              {previewStats.invalid > 0 && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Hibás sorok</AlertTitle>
                  <AlertDescription>
                    {previewStats.invalid} sor hibás és nem lesz importálva. Javítsa ki az Excel fájlban és töltse fel újra, vagy folytassa csak az érvényes sorokkal.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between pt-4 mt-4 border-t">
                <Button variant="outline" onClick={() => setStep('mapping')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Vissza
                </Button>
                <Button
                  onClick={handleStartImport}
                  disabled={previewStats.valid === 0}
                >
                  {previewStats.valid} projekt importálása
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'importing':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Importálás folyamatban...
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={importProgress} className="h-3" />
              <p className="text-center text-gray-500">
                {importProgress}% - Kérjük, ne zárja be az oldalt
              </p>
            </CardContent>
          </Card>
        );

      case 'complete':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                Importálás befejezve
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">{importResult?.imported || 0}</div>
                  <div className="text-sm text-gray-500">Sikeresen importálva</div>
                </div>
                <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-600">{importResult?.failed || 0}</div>
                  <div className="text-sm text-gray-500">Sikertelen</div>
                </div>
              </div>

              {importResult?.errors && importResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Hibák az importálás során</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 mt-2">
                      {importResult.errors.slice(0, 10).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {importResult.errors.length > 10 && (
                        <li>... és még {importResult.errors.length - 10} hiba</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-center gap-4 pt-4">
                <Button variant="outline" onClick={() => {
                  setStep('upload');
                  setFile(null);
                  setWorkbook(null);
                  setPreview([]);
                  setImportResult(null);
                }}>
                  Új import
                </Button>
                <Button onClick={() => router.push('/dashboard/projects')}>
                  Vissza a projektekhez
                </Button>
              </div>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/projects')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-3xl font-bold">Projektek importálása</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Projektek tömeges importálása Excel fájlból
              </p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {(['upload', 'mapping', 'preview', 'complete'] as const).map((s, i) => {
              const stepProgress = (['upload', 'sheet'].includes(step) ? 0 : ['mapping'].includes(step) ? 1 : ['preview', 'importing'].includes(step) ? 2 : 3);
              const isCurrent = step === s || (step === 'sheet' && s === 'upload') || (step === 'importing' && s === 'preview');
              const isCompleted = stepProgress > i;

              return (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                  }`}>
                    {i + 1}
                  </div>
                  {i < 3 && <div className={`w-12 h-1 ${stepProgress > i ? 'bg-green-600' : 'bg-gray-200'}`} />}
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Hiba</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {renderStepContent()}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
