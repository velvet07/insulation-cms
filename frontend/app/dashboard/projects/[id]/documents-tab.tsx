'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
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
import { DOCUMENT_TYPE_LABELS, TEMPLATE_TYPE_LABELS, type Document, type Template, type Project, type Company, type DigitalSignatureRecord, type SignatureVerificationResult } from '@/types';
import { Plus, Download, Trash2, FileText, Loader2, PenTool, X, Check, Upload, Edit, Shield, ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { SignaturePad, SignaturePadHandle } from '@/components/ui/signature-pad';
import { SignerIdentityForm } from '@/components/ui/signer-identity-form';
import dynamic from 'next/dynamic';

// Dynamically import PdfViewer to avoid SSR issues with DOMMatrix
const PdfViewer = dynamic(() => import('@/components/ui/pdf-viewer').then(mod => ({ default: mod.PdfViewer })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96"><p className="text-gray-500">PDF betöltése...</p></div>
});
import { useAuthStore } from '@/lib/store/auth';
import { createAuditLogEntry, addAuditLogEntry } from '@/lib/utils/audit-log';
import { projectsApi } from '@/lib/api/projects';
import { isAdminRole } from '@/lib/utils/user-role';

// PAdES aláírási flow state machine
type SigningStep =
  | 'idle'
  | 'contractor_identity'    // fővállalkozó adatai form
  | 'contractor_signature'   // fővállalkozó rajzol
  | 'contractor_signing'     // API hívás folyamatban
  | 'client_identity'        // ügyfél adatai form
  | 'client_signature'       // ügyfél rajzol
  | 'client_signing'         // API hívás folyamatban
  | 'complete';              // mindkét aláírás kész

interface SignerData {
  name: string;
  email: string;
}

interface DocumentsTabProps {
  project: Project;
}

export function DocumentsTab({ project }: DocumentsTabProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = isAdminRole(user);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [selectedDocumentForSignature, setSelectedDocumentForSignature] = useState<Document | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadType, setUploadType] = useState<Document['type']>('other');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());
  const [isTypeChangeDialogOpen, setIsTypeChangeDialogOpen] = useState(false);
  const [newDocumentType, setNewDocumentType] = useState<Document['type']>('other');
  const [selectedDocumentForPreview, setSelectedDocumentForPreview] = useState<Document | null>(null);
  const signature1Ref = useRef<SignaturePadHandle>(null);
  const signature2Ref = useRef<SignaturePadHandle>(null);
  const [hasSignature1, setHasSignature1] = useState(false);
  const [hasSignature2, setHasSignature2] = useState(false);

  // PAdES signing flow state
  const [signingStep, setSigningStep] = useState<SigningStep>('idle');
  const [contractorData, setContractorData] = useState<SignerData | null>(null);
  const [clientData, setClientData] = useState<SignerData | null>(null);
  const [signingError, setSigningError] = useState<string | null>(null);

  // Verifikáció state
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [verifyingDocumentId, setVerifyingDocumentId] = useState<string | number | null>(null);
  const [verificationResult, setVerificationResult] = useState<SignatureVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const projectId = project.documentId || project.id;

  const normalizeId = (value?: string | number | null) => {
    if (value === undefined || value === null) return undefined;
    return String(value);
  };

  const getCompanyId = (company?: Company | string | number | null) => {
    if (!company) return undefined;
    if (typeof company === 'object') {
      return normalizeId(company.documentId || company.id);
    }
    return normalizeId(company);
  };

  const projectCompanyId = useMemo(() => getCompanyId(project.company || null), [project.company]);

  const mainContractorId = useMemo(() => {
    if (projectCompanyId) return projectCompanyId;
    const userCompany = user?.company;
    if (!userCompany) return undefined;
    if (typeof userCompany === 'object' && userCompany !== null) {
      if (userCompany.type === 'subcontractor' && userCompany.parent_company) {
        return getCompanyId(userCompany.parent_company);
      }
      return getCompanyId(userCompany);
    }
    return getCompanyId(userCompany);
  }, [projectCompanyId, user?.company]);

  const { data: documents = [], isLoading: isLoadingDocuments } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => documentsApi.getAll({ project: projectId }),
    enabled: !!projectId,
  });

  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.getAll(),
  });

  const availableTemplates = useMemo(() => {
    if (isAdmin) return templates;
    if (!mainContractorId) return [];
    return templates.filter((template) => {
      const templateCompanyId = getCompanyId(template.company || null);
      return templateCompanyId === mainContractorId;
    });
  }, [templates, isAdmin, mainContractorId]);

  const signingTemplate = useMemo(
    () => (selectedDocumentForSignature ? templates.find((t) => t.type === selectedDocumentForSignature.type) : null),
    [selectedDocumentForSignature, templates]
  );
  // Dokumentumra generáláskor mentve (sablon tokenek alapján); ha nincs (régi doc), template alapján
  const requireSig1 = selectedDocumentForSignature?.requires_signature1 ?? (signingTemplate?.require_signature1 !== false);
  const requireSig2 = selectedDocumentForSignature?.requires_signature2 ?? (signingTemplate?.require_signature2 !== false);

  const generateMutation = useMutation({
    mutationFn: async (templateIds: string | string[]) => {
      const ids = Array.isArray(templateIds) ? templateIds : [templateIds];
      const results = [];
      const errors: Array<{ templateName: string; error: string }> = [];

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
        } catch (error: any) {
          console.error(`Error generating document for template ${templateId}:`, error);
          const errorMessage = error?.message || 'Ismeretlen hiba';
          errors.push({ 
            templateName: template.name, 
            error: errorMessage 
          });
        }
      }
      
      // Ha voltak hibák, jelezzük őket
      if (errors.length > 0) {
        const errorList = errors.map(e => `- ${e.templateName}: ${e.error}`).join('\n');
        throw new Error(`Néhány dokumentum generálása sikertelen volt:\n\n${errorList}`);
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
      alert(error?.message || 'Hiba történt a dokumentumok generálása során');
    },
  });

  const handleGenerateAll = () => {
    // Ellenőrizzük, hogy van-e olyan template, amihez figyelmeztetés kell
    if (isContractDataIncomplete) {
      const needsWarning = availableTemplates.some(template => 
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
      const allTemplateIds = availableTemplates.map(t => (t.documentId || t.id).toString());
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

    // Ellenőrizzük, hogy már létezik-e azonos típusú dokumentum
    const selectedTemplates = availableTemplates.filter(t => 
      selectedTemplateIds.includes((t.documentId || t.id).toString())
    );
    
    const duplicateTypes: string[] = [];
    selectedTemplates.forEach(template => {
      const existingDoc = documents.find(doc => doc.type === template.type);
      if (existingDoc) {
        const typeLabel = TEMPLATE_TYPE_LABELS[template.type as keyof typeof TEMPLATE_TYPE_LABELS] || template.type;
        duplicateTypes.push(typeLabel);
      }
    });

    if (duplicateTypes.length > 0) {
      const confirmed = confirm(
        `FIGYELEM! Az alábbi típusú dokumentumok már léteznek:\n\n${duplicateTypes.map(t => `- ${t}`).join('\n')}\n\n` +
        'Folytatja a generálást? (Duplikátumok fognak létrejönni)'
      );
      if (!confirmed) {
        return;
      }
    }

    // Ellenőrizzük, hogy van-e olyan template, amihez figyelmeztetés kell
    if (isContractDataIncomplete) {
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

  const handleSign = useCallback((document: Document) => {
    const templateForDoc = templates.find((t) => t.type === document.type);
    const requireSig1 = document.requires_signature1 ?? (templateForDoc?.require_signature1 !== false);
    const requireSig2 = document.requires_signature2 ?? (templateForDoc?.require_signature2 !== false);
    if (!requireSig1 && !requireSig2) {
      return; // Nem jelenítjük meg a gombot, de extra védelmeként
    }

    setSelectedDocumentForSignature(document);
    setSigningError(null);

    const hasClientSig = document.digital_signatures?.some(
      (s: DigitalSignatureRecord) => s.signer_role === 'client'
    );
    const hasContractorSig = document.digital_signatures?.some(
      (s: DigitalSignatureRecord) => s.signer_role === 'contractor'
    );

    if (requireSig1 && !requireSig2) {
      setSigningStep(hasContractorSig ? 'complete' : 'contractor_identity');
    } else if (requireSig2 && !requireSig1) {
      setSigningStep(hasClientSig ? 'complete' : 'client_identity');
    } else {
      setSigningStep(hasClientSig ? 'contractor_identity' : 'client_identity');
    }

    setTimeout(() => {
      const signatureSection = window.document.getElementById('signature-section');
      if (signatureSection) {
        signatureSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }, [templates]);

  const resetSigningFlow = useCallback(() => {
    setSelectedDocumentForSignature(null);
    setSigningStep('idle');
    setContractorData(null);
    setClientData(null);
    setSigningError(null);
    setHasSignature1(false);
    setHasSignature2(false);
  }, []);

  // PAdES signing mutation
  const padesSignMutation = useMutation({
    mutationFn: async ({
      documentId,
      signerRole,
      signerName,
      signerEmail,
      visualSignature,
    }: {
      documentId: string | number;
      signerRole: 'contractor' | 'client';
      signerName: string;
      signerEmail: string;
      visualSignature?: string;
    }) => {
      // Cég neve a projektből
      const companyName =
        project.company && typeof project.company === 'object'
          ? (project.company as Company).name
          : undefined;

      return documentsApi.signPades({
        documentId,
        signerRole,
        signerName,
        signerEmail,
        companyName,
        visualSignature: visualSignature || undefined,
      });
    },
    onSuccess: async (_result: Document, variables: { documentId: string | number; signerRole: 'contractor' | 'client'; signerName: string; signerEmail: string; visualSignature?: string }) => {
      // Audit log bejegyzés
      const roleLabel = variables.signerRole === 'contractor' ? 'Fővállalkozó' : 'Ügyfél';
      const auditLogEntry = createAuditLogEntry(
        'document_signed',
        user,
        `Dokumentum digitálisan aláírva (PAdES/AES): ${selectedDocumentForSignature?.file_name} — Aláíró: ${variables.signerName} (${variables.signerEmail}), Szerep: ${roleLabel}`
      );
      auditLogEntry.module = 'Dokumentumok';

      try {
        const currentProject = await projectsApi.getOne(projectId);
        const updatedAuditLog = addAuditLogEntry(currentProject.audit_log, auditLogEntry);
        await projectsApi.update(projectId, { audit_log: updatedAuditLog });
      } catch (error: unknown) {
        const err = error as { message?: string };
        if (!err?.message?.includes('Invalid key audit_log')) {
          console.error('Error updating audit log:', error);
        }
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });

      // Következő lépés: dokumentumra mentett (sablon tokenek) vagy template alapján
      const tpl = templates.find((t) => t.type === selectedDocumentForSignature?.type);
      const requireSig1 = selectedDocumentForSignature?.requires_signature1 ?? (tpl?.require_signature1 !== false);
      if (variables.signerRole === 'client') {
        if (requireSig1) {
          setSigningStep('contractor_identity');
        } else {
          setSigningStep('complete');
          setTimeout(() => resetSigningFlow(), 3000);
        }
      } else {
        setSigningStep('complete');
        setTimeout(() => resetSigningFlow(), 3000);
      }
    },
    onError: (error: unknown) => {
      const err = error as { message?: string };
      console.error('PAdES signing error:', error);
      setSigningError(err?.message || 'Hiba történt a digitális aláírás során');
      // Visszalépünk az identitás lépésre
      if (signingStep === 'client_signing') {
        setSigningStep('client_identity');
      } else if (signingStep === 'contractor_signing') {
        setSigningStep('contractor_identity');
      }
    },
  });

  const handleContractorIdentitySubmit = useCallback(
    (data: SignerData) => {
      setContractorData(data);
      setSigningStep('contractor_signature');
      setSigningError(null);
    },
    []
  );

  const handleClientIdentitySubmit = useCallback(
    (data: SignerData) => {
      setClientData(data);
      setSigningStep('client_signature');
      setSigningError(null);
    },
    []
  );

  const handleContractorSign = useCallback(() => {
    if (!selectedDocumentForSignature || !contractorData) return;
    const sig = signature1Ref.current?.getSignatureData();
    const documentId = selectedDocumentForSignature.documentId || selectedDocumentForSignature.id;

    setSigningStep('contractor_signing');
    padesSignMutation.mutate({
      documentId,
      signerRole: 'contractor',
      signerName: contractorData.name,
      signerEmail: contractorData.email,
      visualSignature: sig || undefined,
    });
  }, [selectedDocumentForSignature, contractorData, padesSignMutation]);

  const handleClientSign = useCallback(() => {
    if (!selectedDocumentForSignature || !clientData) return;
    const sig = signature2Ref.current?.getSignatureData();
    const documentId = selectedDocumentForSignature.documentId || selectedDocumentForSignature.id;

    setSigningStep('client_signing');
    padesSignMutation.mutate({
      documentId,
      signerRole: 'client',
      signerName: clientData.name,
      signerEmail: clientData.email,
      visualSignature: sig || undefined,
    });
  }, [selectedDocumentForSignature, clientData, padesSignMutation]);

  // Verifikáció
  const handleVerifySignatures = useCallback(async (documentId: string | number) => {
    setVerifyingDocumentId(documentId);
    setVerifyDialogOpen(true);
    setIsVerifying(true);
    setVerifyError(null);
    setVerificationResult(null);

    try {
      const result = await documentsApi.verifySignatures(documentId);
      setVerificationResult(result);
    } catch (error: unknown) {
      const err = error as { message?: string };
      setVerifyError(err?.message || 'Hiba történt az aláírás ellenőrzése során');
    } finally {
      setIsVerifying(false);
    }
  }, []);

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
          {availableTemplates.length > 0 && (
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
                
                // Ellenőrizzük, hogy van-e duplikátum ugyanabból a típusból
                const typeCount = documents.filter(d => d.type === document.type).length;
                const isDuplicate = typeCount > 1;
                
                return (
                <TableRow 
                  key={documentId}
                  className={isDuplicate ? 'bg-amber-50 dark:bg-amber-950/20' : ''}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedDocumentIds.has(documentId)}
                      onCheckedChange={() => handleToggleDocumentSelection(documentId)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <button
                      onClick={() => setSelectedDocumentForPreview(document)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline text-left"
                      title="Kattintson az előnézet megjelenítéséhez"
                    >
                      {document.file_name || `Dokumentum ${document.id}`}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isDuplicate && (
                        <span 
                          className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200"
                          title={`${typeCount} db azonos típusú dokumentum`}
                        >
                          {typeCount}×
                        </span>
                      )}
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
                    </div>
                  </TableCell>
                  <TableCell>
                    {document.company && typeof document.company === 'object'
                      ? (document.company as Company).name
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {isUploaded ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Rendben
                      </span>
                    ) : document.signature_version === 'pades_aes' ? (
                      (() => {
                        const sigCount = document.digital_signatures?.length || 0;
                        const tplForStatus = templates.find((t) => t.type === document.type);
                        const req1 = document.requires_signature1 ?? (tplForStatus?.require_signature1 !== false);
                        const req2 = document.requires_signature2 ?? (tplForStatus?.require_signature2 !== false);
                        const totalRequired = (req1 ? 1 : 0) + (req2 ? 1 : 0);
                        const isFullySigned = sigCount >= totalRequired || document.signed;
                        if (isFullySigned) {
                          return (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                              title={
                                document.digital_signatures
                                  ?.map((s: DigitalSignatureRecord) => `${s.signer_name} (${s.signer_email}) — ${new Date(s.signed_at).toLocaleString('hu-HU')}`)
                                  .join('\n') || ''
                              }
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Digitálisan aláírt (AES)
                            </span>
                          );
                        }
                        return (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                            title={
                              document.digital_signatures
                                ?.map((s: DigitalSignatureRecord) => `${s.signer_name} (${s.signer_role === 'contractor' ? 'Fővállalkozó' : 'Ügyfél'})`)
                                .join(', ') || ''
                            }
                          >
                            <Shield className="h-3.5 w-3.5" />
                            Részben aláírt ({sigCount}/{totalRequired})
                          </span>
                        );
                      })()
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
                      {/* Aláírás gomb: csak ha a sablon igényel aláírást, és nincs feltöltött / teljesen aláírt */}
                      {!isUploaded && !document.signed && (() => {
                        const tpl = templates.find((t) => t.type === document.type);
                        const req1 = document.requires_signature1 ?? (tpl?.require_signature1 !== false);
                        const req2 = document.requires_signature2 ?? (tpl?.require_signature2 !== false);
                        const needsSign = req1 || req2;
                        return needsSign ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSign(document)}
                            title={
                              document.signature_version === 'pades_aes' && (document.digital_signatures?.length || 0) > 0
                                ? 'Fővállalkozó aláírása (folytatás)'
                                : 'Digitális aláírás (PAdES/AES)'
                            }
                          >
                            <PenTool className="h-4 w-4 text-blue-500" />
                          </Button>
                        ) : null;
                      })()}
                      {/* Verifikáció gomb: PAdES aláírt dokumentumoknál */}
                      {document.signature_version === 'pades_aes' && (document.digital_signatures?.length || 0) > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleVerifySignatures(document.documentId || document.id)}
                          title="Aláírás ellenőrzése"
                        >
                          <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        </Button>
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

      {/* Dokumentum Előnézet Section */}
      {selectedDocumentForPreview && (
        <div id="preview-section" className="border-t pt-6 mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Dokumentum megtekintése</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {selectedDocumentForPreview.file_name || 'Dokumentum'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedDocumentForPreview(null)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* PDF Preview - teljes szélességű */}
          <div className="border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
            <div className="p-4 border-b bg-white dark:bg-gray-800 flex items-center justify-between">
              <p className="text-sm font-medium">
                {selectedDocumentForPreview.file_name || 'Dokumentum megtekintése'}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(selectedDocumentForPreview)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Letöltés
                </Button>
                {!selectedDocumentForPreview.signed && selectedDocumentForPreview.requires_signature !== false && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedDocumentForPreview(null);
                      setSelectedDocumentForSignature(selectedDocumentForPreview);
                    }}
                  >
                    <PenTool className="mr-2 h-4 w-4" />
                    Aláírás
                  </Button>
                )}
              </div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-900 p-4" style={{ minHeight: '600px' }}>
              {(() => {
                const documentUrl = getDocumentUrl(selectedDocumentForPreview);
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
        </div>
      )}

      {/* PAdES Aláírási Section (State Machine) */}
      {selectedDocumentForSignature && signingStep !== 'idle' && (
        <div id="signature-section" className="border-t pt-6 mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Dokumentum digitális aláírása (PAdES/AES)
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {selectedDocumentForSignature.file_name} — eIDAS AES kompatibilis kriptográfiai aláírás
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={resetSigningFlow}
              className="h-8 w-8"
              disabled={signingStep === 'contractor_signing' || signingStep === 'client_signing'}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress indicator – csak a sablon által igényelt lépések */}
          <div className="flex items-center gap-2 text-sm">
            {requireSig2 && (
              <>
                <div className={`flex items-center gap-1 ${
                  signingStep.startsWith('client') ? 'text-blue-600 font-medium' : 
                  signingStep === 'contractor_identity' || signingStep === 'contractor_signature' || signingStep === 'contractor_signing' || signingStep === 'complete'
                    ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {signingStep === 'contractor_identity' || signingStep === 'contractor_signature' || signingStep === 'contractor_signing' || signingStep === 'complete' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold">1</span>
                  )}
                  Ügyfél
                </div>
                {requireSig1 && <div className="w-8 h-px bg-gray-300 dark:bg-gray-600" />}
              </>
            )}
            {requireSig1 && (
              <div className={`flex items-center gap-1 ${
                signingStep.startsWith('contractor') ? 'text-blue-600 font-medium' : 
                signingStep === 'complete' ? 'text-green-600' : 'text-gray-400'
              }`}>
                {signingStep === 'complete' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold">{requireSig2 ? '2' : '1'}</span>
                )}
                Fővállalkozó
              </div>
            )}
          </div>

          {/* Hibaüzenet */}
          {signingError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">{signingError}</p>
            </div>
          )}

          {/* PDF Preview */}
          <div className="border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
            <div className="p-4 border-b bg-white dark:bg-gray-800">
              <p className="text-sm font-medium">
                {selectedDocumentForSignature.file_name || 'Dokumentum megtekintése'}
              </p>
            </div>
            <div className="bg-gray-100 dark:bg-gray-900 p-4" style={{ minHeight: '400px' }}>
              {(() => {
                const documentUrl = getDocumentUrl(selectedDocumentForSignature);
                if (!documentUrl) {
                  return (
                    <div className="flex items-center justify-center h-full text-gray-500 p-8" style={{ minHeight: '400px' }}>
                      <p>A dokumentum fájl még nem elérhető.</p>
                    </div>
                  );
                }
                return <PdfViewer url={documentUrl} className="min-h-[400px]" />;
              })()}
            </div>
          </div>

          {/* Step: Client Identity (ELSŐ lépés) */}
          {signingStep === 'client_identity' && (
            <div className="max-w-lg mx-auto">
              <SignerIdentityForm
                signerRole="client"
                defaultName={project.client_name || ''}
                defaultEmail={project.client_email || ''}
                onSubmit={handleClientIdentitySubmit}
                onCancel={resetSigningFlow}
              />
            </div>
          )}

          {/* Step: Client Signature */}
          {signingStep === 'client_signature' && clientData && (
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="border rounded-lg p-6 bg-white dark:bg-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-md font-semibold">Ügyfél vizuális aláírása</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Aláíró: {clientData.name} ({clientData.email})
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSigningStep('client_identity')}
                  >
                    Adatok módosítása
                  </Button>
                </div>
                <SignaturePad
                  ref={signature2Ref}
                  onChange={(has) => setHasSignature2(has)}
                  width={500}
                  height={150}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetSigningFlow}>
                  <X className="mr-2 h-4 w-4" />
                  Mégse
                </Button>
                <Button onClick={handleClientSign}>
                  <Shield className="mr-2 h-4 w-4" />
                  Ügyfél aláírása (PAdES)
                </Button>
              </div>
            </div>
          )}

          {/* Step: Client Signing (loading) */}
          {signingStep === 'client_signing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ügyfél digitális aláírása folyamatban...
              </p>
              <p className="text-xs text-gray-400">
                Tanúsítvány generálás → PDF hash → PAdES aláírás alkalmazása
              </p>
            </div>
          )}

          {/* Step: Contractor Identity (MÁSODIK lépés) */}
          {signingStep === 'contractor_identity' && (
            <div className="max-w-lg mx-auto space-y-4">
              {/* Ügyfél kész jelzés */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <p className="text-sm text-green-700 dark:text-green-300">
                  Ügyfél aláírása kész. Most a fővállalkozó következik.
                </p>
              </div>
              <SignerIdentityForm
                signerRole="contractor"
                defaultName={user?.name || user?.username || ''}
                defaultEmail={user?.email || ''}
                onSubmit={handleContractorIdentitySubmit}
                onCancel={resetSigningFlow}
              />
            </div>
          )}

          {/* Step: Contractor Signature */}
          {signingStep === 'contractor_signature' && contractorData && (
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="border rounded-lg p-6 bg-white dark:bg-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-md font-semibold">Fővállalkozó vizuális aláírása</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Aláíró: {contractorData.name} ({contractorData.email})
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSigningStep('contractor_identity')}
                  >
                    Adatok módosítása
                  </Button>
                </div>
                <SignaturePad
                  ref={signature1Ref}
                  onChange={(has) => setHasSignature1(has)}
                  width={500}
                  height={150}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetSigningFlow}>
                  <X className="mr-2 h-4 w-4" />
                  Mégse
                </Button>
                <Button onClick={handleContractorSign}>
                  <Shield className="mr-2 h-4 w-4" />
                  Fővállalkozó aláírása (PAdES)
                </Button>
              </div>
            </div>
          )}

          {/* Step: Contractor Signing (loading) */}
          {signingStep === 'contractor_signing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Fővállalkozó digitális aláírása folyamatban...
              </p>
              <p className="text-xs text-gray-400">
                Tanúsítvány generálás → PDF hash → PAdES aláírás alkalmazása
              </p>
            </div>
          )}

          {/* Step: Complete */}
          {signingStep === 'complete' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
                <ShieldCheck className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h4 className="text-lg font-semibold text-green-700 dark:text-green-400">
                Mindkét fél digitálisan aláírta a dokumentumot
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">
                A dokumentum eIDAS AES kompatibilis PAdES aláírásokkal van ellátva.
                Az aláírások ellenőrizhetők Adobe Acrobat Reader-ben.
              </p>
              <Button variant="outline" onClick={resetSigningFlow}>
                Bezárás
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Verifikáció Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              Aláírás ellenőrzése
            </DialogTitle>
            <DialogDescription>
              A dokumentumon lévő digitális aláírások verifikációja
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {isVerifying && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-3" />
                <span className="text-sm text-gray-500">Ellenőrzés folyamatban...</span>
              </div>
            )}

            {verifyError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">{verifyError}</p>
              </div>
            )}

            {verificationResult && (
              <>
                {/* Összesítő */}
                <div className={`rounded-md p-4 flex items-center gap-3 ${
                  verificationResult.valid
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}>
                  {verificationResult.valid ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : (
                    <ShieldAlert className="h-6 w-6 text-red-500" />
                  )}
                  <div>
                    <p className={`font-medium text-sm ${
                      verificationResult.valid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                    }`}>
                      {verificationResult.valid
                        ? 'Dokumentum integritás: Rendben'
                        : 'Dokumentum módosítva vagy érvénytelen aláírás!'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {verificationResult.signatures.length} aláírás ellenőrizve
                    </p>
                  </div>
                </div>

                {/* Aláírások listája */}
                <div className="space-y-3">
                  {verificationResult.signatures.map((sig, idx) => (
                    <div
                      key={idx}
                      className="border rounded-md p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{sig.signer_name}</span>
                        {sig.certificate_valid && sig.document_integrity ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" /> Érvényes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600">
                            <ShieldAlert className="h-3 w-3" /> Érvénytelen
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>Szerepkör:</span>
                        <span>{sig.signer_role === 'client' ? 'Ügyfél' : sig.signer_role === 'contractor' ? 'Fővállalkozó' : sig.signer_role}</span>
                        <span>E-mail:</span>
                        <span className="font-mono">{sig.signer_email}</span>
                        <span>Aláírva:</span>
                        <span>{sig.signed_at ? new Date(sig.signed_at).toLocaleString('hu-HU') : '-'}</span>
                        <span>Tanúsítvány:</span>
                        <span>{sig.certificate_valid ? '✓ Érvényes' : '✗ Érvénytelen'}</span>
                        <span>Integritás:</span>
                        <span>{sig.document_integrity ? '✓ Rendben' : '✗ Módosított!'}</span>
                        {sig.certificate_fingerprint && (
                          <>
                            <span>Ujjlenyomat:</span>
                            <span className="font-mono text-[10px] break-all">{sig.certificate_fingerprint.substring(0, 24)}...</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>
              Bezárás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
