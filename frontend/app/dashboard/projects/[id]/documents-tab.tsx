'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { documentsApi } from '@/lib/api/documents';
import { templatesApi } from '@/lib/api/templates';
import { DOCUMENT_TYPE_LABELS, TEMPLATE_TYPE_LABELS, type Document, type Template, type Project } from '@/types';
import { Plus, Download, Trash2, FileText, Loader2, PenTool } from 'lucide-react';
import { SignaturePad } from '@/components/ui/signature-pad';
import { useAuthStore } from '@/lib/store/auth';
import { createAuditLogEntry, addAuditLogEntry } from '@/lib/utils/audit-log';
import { projectsApi } from '@/lib/api/projects';

interface DocumentsTabProps {
  project: Project;
}

export function DocumentsTab({ project }: DocumentsTabProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [selectedDocumentForSignature, setSelectedDocumentForSignature] = useState<Document | null>(null);

  const projectId = project.documentId || project.id;

  const { data: documents = [], isLoading: isLoadingDocuments } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => documentsApi.getAll({ project: projectId }),
    enabled: !!projectId,
  });

  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.getAll(),
  });

  const generateMutation = useMutation({
    mutationFn: async (templateIds: string | string[]) => {
      const ids = Array.isArray(templateIds) ? templateIds : [templateIds];
      const results = [];

      for (const templateId of ids) {
        const template = templates.find((t) => (t.documentId || t.id).toString() === templateId);
        if (!template) continue;

        try {
          const document = await documentsApi.generate(templateId, projectId);
          results.push(document);

          // Audit log minden dokumentumhoz
          const auditLogEntry = createAuditLogEntry(
            'document_generated',
            user,
            `Dokumentum generálva: ${template.name}`
          );
          auditLogEntry.module = 'Dokumentumok';
          
          const currentProject = await projectsApi.getOne(projectId);
          const updatedAuditLog = addAuditLogEntry(currentProject.audit_log, auditLogEntry);
          
          await projectsApi.update(projectId, {
            audit_log: updatedAuditLog,
            documents_generated_count: (currentProject.documents_generated_count || 0) + 1,
          });
        } catch (error) {
          console.error(`Error generating document for template ${templateId}:`, error);
        }
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setIsGenerateDialogOpen(false);
      setSelectedTemplateId('');
    },
    onError: (error: any) => {
      console.error('Error generating document:', error);
    },
  });

  const handleGenerateAll = () => {
    if (confirm('Biztosan le szeretné generálni az összes elérhető sablont?')) {
      const allTemplateIds = templates.map(t => (t.documentId || t.id).toString());
      generateMutation.mutate(allTemplateIds);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (documentId: number | string) => {
      // Audit log bejegyzés - Dokumentumok modul
      const auditLogEntry = createAuditLogEntry(
        'document_deleted',
        user,
        'Dokumentum törölve'
      );
      auditLogEntry.module = 'Dokumentumok';

      // Frissítjük a projekt audit log-ját
      const currentProject = await projectsApi.getOne(projectId);
      const updatedAuditLog = addAuditLogEntry(currentProject.audit_log, auditLogEntry);

      // Töröljük a dokumentumot
      await documentsApi.delete(documentId);

      // Frissítjük a projektet az audit log-gal
      // Ha a szerveren nincs audit_log mező, akkor kihagyjuk a frissítést
      try {
        await projectsApi.update(projectId, {
          audit_log: updatedAuditLog,
        });
      } catch (error: any) {
        // Ha "Invalid key audit_log" hibát kapunk, akkor csak logoljuk, de nem dobjuk tovább
        if (error?.message?.includes('Invalid key audit_log') || 
            error?.response?.data?.error?.message?.includes('Invalid key audit_log')) {
          console.warn('audit_log mező nem létezik a szerveren, audit log frissítés kihagyva');
          // Nem dobjuk tovább a hibát, mert a dokumentum már törölve lett
        } else {
          // Ha más hiba van, dobjuk tovább
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (error: any) => {
      console.error('Error deleting document:', error);
      // Hiba esetén sem alert, csak console log
    },
  });

  const handleGenerate = () => {
    if (!selectedTemplateId) {
      // Nincs alert, csak return
      return;
    }
    generateMutation.mutate(selectedTemplateId);
  };

  const handleDelete = (document: Document) => {
    if (confirm(`Biztosan törölni szeretné ezt a dokumentumot: ${document.file_name || 'Névtelen'}?`)) {
      const identifier = document.documentId || document.id;
      deleteMutation.mutate(identifier);
    }
  };

  const handleSign = (document: Document) => {
    setSelectedDocumentForSignature(document);
    setIsSignatureDialogOpen(true);
  };

  const saveSignature = async (signatureData: string) => {
    if (!selectedDocumentForSignature) return;

    try {
      // Strapi v5-ben a documentId-t használjuk, ha van, különben az id-t
      const documentId = selectedDocumentForSignature.documentId || selectedDocumentForSignature.id;
      if (!documentId) {
        throw new Error('Dokumentum ID nem található');
      }

      // Újrageneráljuk a dokumentumot az aláírással
      try {
        await documentsApi.regenerateWithSignature(documentId, signatureData);
      } catch (error: any) {
        // Ha a hiba csak a response formátummal kapcsolatos (ctx.ok), de a művelet sikeres volt,
        // akkor is invalidáljuk a query-ket, mert a backend valószínűleg elvégezte a műveletet
        console.warn('Warning during signature regeneration (may have succeeded):', error);
        // Folytatjuk, hogy invalidáljuk a query-ket
      }

      // Audit log bejegyzés
      const auditLogEntry = createAuditLogEntry(
        'document_signed',
        user,
        `Dokumentum aláírva: ${selectedDocumentForSignature.file_name}`
      );
      auditLogEntry.module = 'Dokumentumok';

      try {
        const currentProject = await projectsApi.getOne(projectId);
        const updatedAuditLog = addAuditLogEntry(currentProject.audit_log, auditLogEntry);

        try {
          await projectsApi.update(projectId, {
            audit_log: updatedAuditLog,
          });
        } catch (error: any) {
          if (!error?.message?.includes('Invalid key audit_log')) {
            console.error('Error updating audit log:', error);
          }
        }
      } catch (error: any) {
        console.warn('Error updating audit log:', error);
      }

      // Mindig invalidáljuk a query-ket, hogy frissüljön a UI
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setIsSignatureDialogOpen(false);
      setSelectedDocumentForSignature(null);
      // Sikeres aláírás - nincs alert
    } catch (error: any) {
      console.error('Error saving signature:', error);
      // Még hiba esetén is invalidáljuk a query-ket, mert lehet, hogy a backend elvégezte
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    }
  };

  const handleDownload = async (document: Document) => {
    // Ha van file URL, akkor letöltjük
    let fileUrl = document.file?.url || document.file_url;
    
    // Ha nincs file URL, próbáljuk meg lekérni a dokumentumot a file mezővel
    if (!fileUrl) {
      const documentId = document.documentId || document.id;
      if (documentId) {
        try {
          const doc = await documentsApi.getOne(documentId);
          fileUrl = doc.file?.url || doc.file_url;
        } catch (error) {
          console.error('Error fetching document:', error);
        }
      }
    }
    
    if (fileUrl) {
      const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.emermedia.eu';
      const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${strapiUrl}${fileUrl}`;
      window.open(fullUrl, '_blank');
    } else {
      // Nincs alert, csak console log
      console.warn('A dokumentum fájl még nem elérhető. Ez egy placeholder dokumentum.');
    }
  };

  // Szűrjük a sablonokat a projekt típusa szerint (ha szükséges)
  const availableTemplates = templates;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Dokumentumok</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Generáljon dokumentumokat sablonokból vagy töltse fel saját dokumentumokat.
          </p>
        </div>
        <div className="flex gap-2">
          {templates.length > 0 && (
            <Button variant="outline" onClick={handleGenerateAll} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Összes generálása
            </Button>
          )}
          <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Dokumentum generálása
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dokumentum generálása</DialogTitle>
              <DialogDescription>
                Válasszon egy sablont a dokumentum generálásához. A sablonban lévő tokeneket
                automatikusan helyettesítjük a projekt adataival.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Sablon kiválasztása *</label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Válasszon sablont" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingTemplates ? (
                      <div className="p-4 text-center text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                        Sablonok betöltése...
                      </div>
                    ) : availableTemplates.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">
                        Nincsenek elérhető sablonok. Kérjük, hozzon létre sablonokat a{' '}
                        <a href="/dashboard/documents/templates" className="text-blue-600 hover:underline">
                          Sablonok
                        </a>{' '}
                        oldalon.
                      </div>
                    ) : (
                      availableTemplates.map((template) => (
                        <SelectItem
                          key={template.documentId || template.id}
                          value={(template.documentId || template.id).toString()}
                        >
                          {template.name} ({TEMPLATE_TYPE_LABELS[template.type as keyof typeof TEMPLATE_TYPE_LABELS] || template.type})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              {selectedTemplateId && (
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-md">
                  <p className="text-sm font-medium mb-2">Elérhető tokenek:</p>
                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    <p>• {'{client_name}'} - Ügyfél neve</p>
                    <p>• {'{client_address}'} - Ügyfél címe</p>
                    <p>• {'{client_phone}'} - Telefonszám</p>
                    <p>• {'{client_email}'} - Email cím</p>
                    <p>• {'{client_birth_place}'} - Születési hely</p>
                    <p>• {'{client_birth_date}'} - Születési idő</p>
                    <p>• {'{client_mother_name}'} - Anyja neve</p>
                    <p>• {'{client_tax_id}'} - Adóazonosító</p>
                    <p>• {'{property_address}'} - Ingatlan címe</p>
                    <p>• {'{area_sqm}'} - Terület (m²)</p>
                    <p>• {'{floor_material}'} - Födém anyaga</p>
                    <p>• {'{date}'} - Aktuális dátum</p>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsGenerateDialogOpen(false);
                  setSelectedTemplateId('');
                }}
              >
                Mégse
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!selectedTemplateId || generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generálás...
                  </>
                ) : (
                  'Generálás'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {isLoadingDocuments ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">Dokumentumok betöltése...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500 mb-4">Még nincsenek dokumentumok ehhez a projekthez.</p>
          <Button onClick={() => setIsGenerateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Első dokumentum generálása
          </Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Név</TableHead>
                <TableHead>Típus</TableHead>
                <TableHead>Státusz</TableHead>
                <TableHead>Létrehozva</TableHead>
                <TableHead className="text-right">Műveletek</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => (
                <TableRow key={document.id}>
                  <TableCell className="font-medium">
                    {document.file_name || `Dokumentum ${document.id}`}
                  </TableCell>
                  <TableCell>{DOCUMENT_TYPE_LABELS[document.type as keyof typeof DOCUMENT_TYPE_LABELS] || document.type}</TableCell>
                  <TableCell>
                    {document.signed ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Aláírva
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                        Nincs aláírva
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(document.createdAt).toLocaleDateString('hu-HU')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {!document.signed && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSign(document)}
                          title="Aláírás"
                        >
                          <PenTool className="h-4 w-4 text-blue-500" />
                        </Button>
                      )}
                      {document.signed && document.signature_data && typeof document.signature_data === 'string' && (
                        <div className="flex items-center gap-2">
                          <img 
                            src={document.signature_data} 
                            alt="Aláírás" 
                            className="h-8 w-auto border border-gray-300 rounded"
                          />
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(document)}
                        title="Letöltés"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(document)}
                        title="Törlés"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Aláírás Dialog */}
      <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dokumentum aláírása</DialogTitle>
            <DialogDescription>
              Kérjük, írja alá a dokumentumot az alábbi mezőben. Tableten vagy érintőképernyős eszközön
              ujjal vagy stylus-szal is aláírhat.
            </DialogDescription>
          </DialogHeader>
          {selectedDocumentForSignature && (
            <SignaturePad
              onSave={saveSignature}
              onCancel={() => {
                setIsSignatureDialogOpen(false);
                setSelectedDocumentForSignature(null);
              }}
              initialSignature={
                selectedDocumentForSignature.signature_data
                  ? (typeof selectedDocumentForSignature.signature_data === 'string'
                      ? selectedDocumentForSignature.signature_data
                      : (selectedDocumentForSignature.signature_data as any)?.image)
                  : null
              }
              width={600}
              height={200}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
