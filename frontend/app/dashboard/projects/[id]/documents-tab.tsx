'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
import { companiesApi } from '@/lib/api/companies';
import { DOCUMENT_TYPE_LABELS, TEMPLATE_TYPE_LABELS, type Document, type Template, type Project, type Company } from '@/types';
import { Plus, Download, Trash2, FileText, Loader2, PenTool, X, Check, Upload, Edit } from 'lucide-react';
import { SignaturePad } from '@/components/ui/signature-pad';
import dynamic from 'next/dynamic';

// Dynamically import PdfViewer to avoid SSR issues with DOMMatrix
const PdfViewer = dynamic(() => import('@/components/ui/pdf-viewer').then(mod => ({ default: mod.PdfViewer })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96"><p className="text-gray-500">PDF betöltése...</p></div>
});
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
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [selectedDocumentForSignature, setSelectedDocumentForSignature] = useState<Document | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadType, setUploadType] = useState<Document['type']>('other');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());
  const [isTypeChangeDialogOpen, setIsTypeChangeDialogOpen] = useState(false);
  const [newDocumentType, setNewDocumentType] = useState<Document['type']>('other');


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

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companiesApi.getAll(),
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
      setSelectedTemplateIds([]);
    },
    onError: (error: any) => {
      console.error('Error generating document:', error);
    },
  });

  const handleGenerateAll = () => {
    // Ellenőrizzük, hogy van-e olyan template, amihez figyelmeztetés kell
    if (isContractDataIncomplete) {
      const needsWarning = templates.some(template => 
        !allowedTemplatesWithoutWarning.includes(template.type)
      );

      if (needsWarning) {
        const confirmed = confirm(
          'FIGYELEM! A szerződés adatok hiányosak. A generált dokumentum nem fog tartalmazni minden adatot!\n\n' +
          'Folytatja a generálást?'
        );
        if (!confirmed) {
          return;
        }
      }
    }

    if (confirm('Biztosan le szeretné generálni az összes elérhető sablont?')) {
      const allTemplateIds = templates.map(t => (t.documentId || t.id).toString());
      generateMutation.mutate(allTemplateIds);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async ({ files, type }: { files: File[]; type: Document['type'] }) => {
      const created: Document[] = [];
      for (const file of files) {
        const document = await documentsApi.upload(projectId, file, type || 'other');
        created.push(document);

        // Audit log bejegyzés (fájlonként)
        const auditLogEntry = createAuditLogEntry(
          'document_uploaded',
          user,
          `Dokumentum feltöltve: ${file.name}`
        );
        auditLogEntry.module = 'Dokumentumok';

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
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setIsUploadDialogOpen(false);
      setUploadFiles([]);
      setUploadType('other');
    },
    onError: (error: any) => {
      console.error('Error uploading file:', error);
    },
  });

  const documentTypeUpdateMutation = useMutation({
    mutationFn: async ({ documentId, type }: { documentId: string; type: Document['type'] }) => {
      await documentsApi.update(documentId, { type });

      const auditLogEntry = createAuditLogEntry(
        'document_modified',
        user,
        `Dokumentum típusa módosítva: ${DOCUMENT_TYPE_LABELS[type as keyof typeof DOCUMENT_TYPE_LABELS] || type}`
      );
      auditLogEntry.module = 'Dokumentumok';

      try {
        const currentProject = await projectsApi.getOne(projectId);
        const updatedAuditLog = addAuditLogEntry(currentProject.audit_log, auditLogEntry);
        await projectsApi.update(projectId, {
          audit_log: updatedAuditLog,
        });
      } catch (error: any) {
        if (!error?.message?.includes('Invalid key audit_log')) {
          console.error('Error updating audit log:', error);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (error: any) => {
      console.error('Error updating document type:', error);
    },
  });

  const documentCompanyUpdateMutation = useMutation({
    mutationFn: async ({ documentId, companyId }: { documentId: string; companyId: string | null }) => {
      await documentsApi.update(documentId, {
        company: companyId === null || companyId === '' ? null : companyId,
      });

      const auditLogEntry = createAuditLogEntry(
        'document_modified',
        user,
        'Dokumentum tulajdonosa módosítva'
      );
      auditLogEntry.module = 'Dokumentumok';

      try {
        const currentProject = await projectsApi.getOne(projectId);
        const updatedAuditLog = addAuditLogEntry(currentProject.audit_log, auditLogEntry);
        await projectsApi.update(projectId, {
          audit_log: updatedAuditLog,
        });
      } catch (error: any) {
        if (!error?.message?.includes('Invalid key audit_log')) {
          console.error('Error updating audit log:', error);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (error: any) => {
      console.error('Error updating document company:', error);
    },
  });

  const bulkTypeUpdateMutation = useMutation({
    mutationFn: async ({ documentIds, type }: { documentIds: string[]; type: Document['type'] }) => {
      await Promise.all(documentIds.map((id) => documentsApi.update(id, { type })));

      const auditLogEntry = createAuditLogEntry(
        'document_modified',
        user,
        `${documentIds.length} feltöltött dokumentum típusa módosítva: ${DOCUMENT_TYPE_LABELS[type as keyof typeof DOCUMENT_TYPE_LABELS] || type}`
      );
      auditLogEntry.module = 'Dokumentumok';

      try {
        const currentProject = await projectsApi.getOne(projectId);
        const updatedAuditLog = addAuditLogEntry(currentProject.audit_log, auditLogEntry);
        await projectsApi.update(projectId, {
          audit_log: updatedAuditLog,
        });
      } catch (error: any) {
        if (!error?.message?.includes('Invalid key audit_log')) {
          console.error('Error updating audit log:', error);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setSelectedDocumentIds(new Set());
      setIsTypeChangeDialogOpen(false);
      setNewDocumentType('other');
    },
    onError: (error: any) => {
      console.error('Error bulk updating document type:', error);
    },
  });

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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      const auditLogEntry = createAuditLogEntry(
        'document_deleted',
        user,
        `${documentIds.length} dokumentum törölve`
      );
      auditLogEntry.module = 'Dokumentumok';

      await Promise.all(documentIds.map((id) => documentsApi.delete(id)));

      try {
        const currentProject = await projectsApi.getOne(projectId);
        const updatedAuditLog = addAuditLogEntry(currentProject.audit_log, auditLogEntry);
        await projectsApi.update(projectId, {
          audit_log: updatedAuditLog,
        });
      } catch (error: any) {
        if (!error?.message?.includes('Invalid key audit_log')) {
          console.error('Error updating audit log:', error);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setSelectedDocumentIds(new Set());
    },
    onError: (error: any) => {
      console.error('Error bulk deleting documents:', error);
    },
  });

  // Ellenőrizzük, hogy a szerződés adatok hiányosak-e
  const isContractDataIncomplete = !(
    project.client_birth_place &&
    project.client_birth_date &&
    project.client_tax_id &&
    project.area_sqm
  );

  // Engedélyezett template típusok, amikhez NINCS figyelmeztetés hiányos adatoknál
  const allowedTemplatesWithoutWarning: string[] = ['felmerolap', 'teljesitesi_igazolo', 'egyeb'];

  const handleGenerate = () => {
    if (selectedTemplateIds.length === 0) {
      // Nincs alert, csak return
      return;
    }

    // Ellenőrizzük, hogy van-e olyan template, amihez figyelmeztetés kell
    if (isContractDataIncomplete) {
      const selectedTemplates = templates.filter(t => 
        selectedTemplateIds.includes((t.documentId || t.id).toString())
      );
      const needsWarning = selectedTemplates.some(template => 
        !allowedTemplatesWithoutWarning.includes(template.type)
      );

      if (needsWarning) {
        const confirmed = confirm(
          'FIGYELEM! A szerződés adatok hiányosak. A generált dokumentum nem fog tartalmazni minden adatot!\n\n' +
          'Folytatja a generálást?'
        );
        if (!confirmed) {
          return;
        }
      }
    }

    generateMutation.mutate(selectedTemplateIds);
  };

  const handleTemplateToggle = (templateId: string) => {
    setSelectedTemplateIds((prev) => {
      if (prev.includes(templateId)) {
        return prev.filter((id) => id !== templateId);
      } else {
        return [...prev, templateId];
      }
    });
  };

  const handleSelectAllTemplates = () => {
    if (selectedTemplateIds.length === availableTemplates.length) {
      setSelectedTemplateIds([]);
    } else {
      setSelectedTemplateIds(availableTemplates.map(t => (t.documentId || t.id).toString()));
    }
  };

  const handleDelete = (document: Document) => {
    if (confirm(`Biztosan törölni szeretné ezt a dokumentumot: ${document.file_name || 'Névtelen'}?`)) {
      const identifier = document.documentId || document.id;
      deleteMutation.mutate(identifier);
    }
  };

  const documentById = useMemo(() => {
    const m = new Map<string, Document>();
    for (const d of documents) {
      const id = (d.documentId || d.id).toString();
      m.set(id, d);
    }
    return m;
  }, [documents]);

  const selectedUploadedDocumentIds = useMemo(() => {
    const ids: string[] = [];
    for (const id of selectedDocumentIds) {
      const d = documentById.get(id);
      if (d?.requires_signature === false) ids.push(id);
    }
    return ids;
  }, [selectedDocumentIds, documentById]);

  const handleToggleDocumentSelection = (id: string) => {
    setSelectedDocumentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllDocuments = (checked: boolean | 'indeterminate') => {
    if (checked) {
      const allIds = documents.map((d) => (d.documentId || d.id).toString());
      setSelectedDocumentIds(new Set(allIds));
    } else {
      setSelectedDocumentIds(new Set());
    }
  };

  const handleBulkDelete = () => {
    if (selectedDocumentIds.size === 0) return;
    if (confirm(`Biztosan törölni szeretné a kijelölt ${selectedDocumentIds.size} dokumentumot?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedDocumentIds));
    }
  };

  const handleSign = (document: Document) => {
    setSelectedDocumentForSignature(document);
    
    // Scroll to signature section
    setTimeout(() => {
      const signatureSection = window.document.getElementById('signature-section');
      if (signatureSection) {
        signatureSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const getDocumentUrl = (document: Document): string | null => {
    // Próbáljuk meg több módon is a fájl URL-t
    let fileUrl = document.file?.url || document.file_url;
    
    // Ha a file objektum van, próbáljuk meg közvetlenül a url-t
    if (document.file && typeof document.file === 'object' && 'url' in document.file) {
      fileUrl = document.file.url;
    }
    
    if (!fileUrl) {
      console.warn('Document file URL not found:', document);
      return null;
    }
    
    const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.emermedia.eu';
    
    // Ha már teljes URL, használjuk azt
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return fileUrl;
    }
    
    // Ha relatív URL, hozzáadjuk a Strapi URL-t
    // Eltávolítjuk a dupla slash-okat
    const cleanUrl = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
    const fullUrl = `${strapiUrl}${cleanUrl}`;
    return fullUrl;
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
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Fájl feltöltése
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Fájl feltöltése</DialogTitle>
                <DialogDescription>
                  Töltsön fel scannelt képet/PDF-et. Válassza ki, hogy melyik dokumentum kategóriához tartozzon.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Dokumentum kategória *</label>
                  <Select value={uploadType} onValueChange={(v) => setUploadType(v as Document['type'])}>
                    <SelectTrigger>
                      <SelectValue placeholder="Válasszon kategóriát" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Fájl kiválasztása *</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) setUploadFiles(files);
                    }}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
                {uploadFiles.length > 0 && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                    <p className="text-sm font-medium">{uploadFiles.length} fájl kiválasztva</p>
                    <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      {uploadFiles.slice(0, 6).map((f) => (
                        <div key={`${f.name}-${f.size}`}>{f.name}</div>
                      ))}
                      {uploadFiles.length > 6 && (
                        <div>… és még {uploadFiles.length - 6} fájl</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsUploadDialogOpen(false);
                    setUploadFiles([]);
                    setUploadType('other');
                  }}
                >
                  Mégse
                </Button>
                <Button
                  onClick={() => {
                    if (uploadFiles.length === 0) return;
                    uploadMutation.mutate({ files: uploadFiles, type: uploadType });
                  }}
                  disabled={uploadFiles.length === 0 || uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Feltöltés...
                    </>
                  ) : (
                    `Feltöltés (${uploadFiles.length})`
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Sablon kiválasztása *</label>
                  {availableTemplates.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAllTemplates}
                      className="text-xs h-7"
                    >
                      {selectedTemplateIds.length === availableTemplates.length ? 'Összes kijelölés törlése' : 'Összes kijelölése'}
                    </Button>
                  )}
                </div>
                {isLoadingTemplates ? (
                  <div className="p-4 text-center text-sm text-gray-500 border rounded-md">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                    Sablonok betöltése...
                  </div>
                ) : availableTemplates.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500 border rounded-md">
                    Nincsenek elérhető sablonok. Kérjük, hozzon létre sablonokat a{' '}
                    <a href="/dashboard/documents/templates" className="text-blue-600 hover:underline">
                      Sablonok
                    </a>{' '}
                    oldalon.
                  </div>
                ) : (
                  <div className="border rounded-md max-h-60 overflow-y-auto space-y-2 p-3">
                    {availableTemplates.map((template) => {
                      const templateId = (template.documentId || template.id).toString();
                      const isSelected = selectedTemplateIds.includes(templateId);
                      return (
                        <label
                          key={templateId}
                          className="flex items-center space-x-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-900 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleTemplateToggle(templateId)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm flex-1">
                            {template.name} ({TEMPLATE_TYPE_LABELS[template.type as keyof typeof TEMPLATE_TYPE_LABELS] || template.type})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsGenerateDialogOpen(false);
                  setSelectedTemplateIds([]);
                }}
              >
                Mégse
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={selectedTemplateIds.length === 0 || generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generálás...
                  </>
                ) : (
                  `Generálás${selectedTemplateIds.length > 0 ? ` (${selectedTemplateIds.length})` : ''}`
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
          {/* Bulk selection toolbar */}
          {documents.length > 0 && (
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={documents.length > 0 && selectedDocumentIds.size === documents.length}
                    onCheckedChange={handleSelectAllDocuments}
                  />
                  <span className="text-sm">Összes kijelölése</span>
                </label>
                {selectedDocumentIds.size > 0 && (
                  <span className="text-sm text-gray-500">{selectedDocumentIds.size} kijelölve</span>
                )}
              </div>
              {selectedDocumentIds.size > 0 && (
                <div className="flex gap-2">
                  {selectedUploadedDocumentIds.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsTypeChangeDialogOpen(true)}
                      disabled={bulkTypeUpdateMutation.isPending}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Típus módosítása ({selectedUploadedDocumentIds.length})
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {bulkDeleteMutation.isPending ? 'Törlés...' : `${selectedDocumentIds.size} dokumentum törlése`}
                  </Button>
                </div>
              )}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Név</TableHead>
                <TableHead>Típus</TableHead>
                <TableHead>Tulajdonos</TableHead>
                <TableHead>Státusz</TableHead>
                <TableHead>Létrehozva</TableHead>
                <TableHead className="text-right">Műveletek</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => {
                const documentId = (document.documentId || document.id).toString();
                const isUploaded = document.requires_signature === false;
                return (
                <TableRow key={documentId}>
                  <TableCell>
                    <Checkbox
                      checked={selectedDocumentIds.has(documentId)}
                      onCheckedChange={() => handleToggleDocumentSelection(documentId)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {document.file_name || `Dokumentum ${document.id}`}
                  </TableCell>
                  <TableCell>
                    {isUploaded ? (
                      <Select
                        value={document.type}
                        onValueChange={(v) => {
                          const nextType = v as Document['type'];
                          documentTypeUpdateMutation.mutate({ documentId, type: nextType });
                        }}
                        disabled={documentTypeUpdateMutation.isPending}
                      >
                        <SelectTrigger className="w-56">
                          <SelectValue placeholder="Válasszon típust" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      DOCUMENT_TYPE_LABELS[document.type as keyof typeof DOCUMENT_TYPE_LABELS] || document.type
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={
                        document.company == null || document.company === undefined
                          ? '__none__'
                          : typeof document.company === 'object' && document.company !== null
                            ? (document.company as Company).documentId || String((document.company as Company).id)
                            : String(document.company)
                      }
                      onValueChange={(v) => {
                        documentCompanyUpdateMutation.mutate({
                          documentId,
                          companyId: v === '__none__' ? null : v,
                        });
                      }}
                      disabled={documentCompanyUpdateMutation.isPending}
                    >
                      <SelectTrigger className="w-48 min-w-[12rem]">
                        <SelectValue placeholder="Tulajdonos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Nincs —</SelectItem>
                        {companies.map((c) => {
                          const id = c.documentId || String(c.id);
                          return (
                            <SelectItem key={id} value={id}>
                              {c.name}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {isUploaded ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Rendben
                      </span>
                    ) : document.signed ? (
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
                      {!isUploaded && !document.signed && (
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
              )})}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Bulk type change dialog (feltöltött dokumentumokhoz) */}
      <Dialog open={isTypeChangeDialogOpen} onOpenChange={setIsTypeChangeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dokumentum típus módosítása</DialogTitle>
            <DialogDescription>
              Csak a feltöltött (nem aláírandó) dokumentumok típusát módosítja. ({selectedUploadedDocumentIds.length} db)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Új dokumentum típus *</label>
              <Select value={newDocumentType} onValueChange={(v) => setNewDocumentType(v as Document['type'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Válasszon típust" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsTypeChangeDialogOpen(false);
                setNewDocumentType('other');
              }}
            >
              Mégse
            </Button>
            <Button
              onClick={() => {
                if (selectedUploadedDocumentIds.length === 0) return;
                bulkTypeUpdateMutation.mutate({ documentIds: selectedUploadedDocumentIds, type: newDocumentType });
              }}
              disabled={selectedUploadedDocumentIds.length === 0 || bulkTypeUpdateMutation.isPending}
            >
              {bulkTypeUpdateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mentés...
                </>
              ) : (
                `Mentés (${selectedUploadedDocumentIds.length})`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aláírás Section (nem Dialog) */}
      {selectedDocumentForSignature && (
        <div id="signature-section" className="border-t pt-6 mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Dokumentum aláírása</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Tekintse meg a dokumentumot, majd ha minden rendben, írja alá az alábbi mezőben.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedDocumentForSignature(null)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* PDF Preview - teljes szélességű */}
          <div className="border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
            <div className="p-4 border-b bg-white dark:bg-gray-800">
              <p className="text-sm font-medium">
                {selectedDocumentForSignature.file_name || 'Dokumentum megtekintése'}
              </p>
            </div>
              <div className="bg-gray-100 dark:bg-gray-900 p-4" style={{ minHeight: '600px' }}>
                {(() => {
                  const documentUrl = getDocumentUrl(selectedDocumentForSignature);
                  if (!documentUrl) {
                    return (
                      <div className="flex items-center justify-center h-full text-gray-500 p-8" style={{ minHeight: '600px' }}>
                        <p>A dokumentum fájl még nem elérhető.</p>
                      </div>
                    );
                  }
                  
                  // PDF megjelenítés react-pdf-vel (PDF.js)
                  return (
                    <PdfViewer url={documentUrl} className="min-h-[600px]" />
                  );
                })()}
              </div>
          </div>

          {/* Aláírási mező - középre igazítva max-w-2xl */}
          <div className="max-w-2xl mx-auto">
            <div className="border rounded-lg p-6 bg-white dark:bg-gray-800">
              <h4 className="text-md font-semibold mb-4">Aláírás</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Tableten vagy érintőképernyős eszközön ujjal vagy stylus-szal is aláírhat.
              </p>
              <SignaturePad
                onSave={saveSignature}
                onCancel={() => setSelectedDocumentForSignature(null)}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
