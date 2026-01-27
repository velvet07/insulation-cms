'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/lib/store/auth';
import { usePermission } from '@/lib/contexts/permission-context';
import type { Company } from '@/types';
import { Input } from '@/components/ui/input';
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
import { templatesApi } from '@/lib/api/templates';
import { TEMPLATE_TYPE_LABELS, type Template, type TemplateType } from '@/types';
import { Plus, Edit, Trash2, Upload, FileText, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const templateSchema = z.object({
  name: z.string().min(1, 'A sablon neve kötelező'),
  type: z.enum([
    'felmerolap',
    'vallalkozasi_szerzodes',
    'megallapodas',
    'szerzodes_energiahatékonysag',
    'adatkezelesi_hozzajarulas',
    'teljesitesi_igazolo',
    'munkaterul_atadas',
    'other',
  ]),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

export default function TemplatesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { can } = usePermission();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Check permission - redirect if user cannot view templates
  if (!can('documents', 'view_list')) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-gray-500">Nincs jogosultságod az oldal megtekintéséhez.</p>
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  // Check if user can manage templates
  const canManageTemplates = can('documents', 'manage_templates');

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.getAll(),
  });

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      type: 'felmerolap',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormValues) => {
      return templatesApi.create({
        name: data.name,
        type: data.type,
        tokens: [], // Alapértelmezett tokenek listája
      }, selectedFile || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsDialogOpen(false);
      form.reset();
      setSelectedFile(null);
    },
    onError: (error: any) => {
      console.error('Error creating template:', error);

      // Ellenőrizzük, hogy a hiba a type enum értékekkel kapcsolatos-e
      const errorMessage = error?.message || '';
      if (errorMessage.includes('type must be one of the following values') ||
        errorMessage.includes('contract, worksheet, invoice')) {
        alert(
          'HIBA: A Strapi szerveren a dokumentum típusok sémája még nem frissült.\n\n' +
          'Kérjük, frissítse a Strapi admin felületen:\n' +
          '1. Lépjen be: https://cms.emermedia.eu/admin\n' +
          '2. Menjen a Content-Type Builder menüpontra\n' +
          '3. Keresse meg a "Template" content type-ot\n' +
          '4. Frissítse a "type" mező enum értékeit az új értékekre\n' +
          '5. Ismételje meg ugyanezt a "Document" content type-nál is\n\n' +
          'Részletes útmutató: docs/STRAPI_SCHEMA_UPDATE.md'
        );
      } else {
        alert(error?.message || 'Hiba történt a sablon létrehozása során.');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number | string; data: Partial<Template> }) => {
      return templatesApi.update(id, data, selectedFile || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      form.reset();
      setSelectedFile(null);
    },
    onError: (error: any) => {
      console.error('Error updating template:', error);

      // Ellenőrizzük, hogy a hiba a type enum értékekkel kapcsolatos-e
      const errorMessage = error?.message || '';
      if (errorMessage.includes('type must be one of the following values') ||
        errorMessage.includes('contract, worksheet, invoice')) {
        alert(
          'HIBA: A Strapi szerveren a dokumentum típusok sémája még nem frissült.\n\n' +
          'Kérjük, frissítse a Strapi admin felületen:\n' +
          '1. Lépjen be: https://cms.emermedia.eu/admin\n' +
          '2. Menjen a Content-Type Builder menüpontra\n' +
          '3. Keresse meg a "Template" content type-ot\n' +
          '4. Frissítse a "type" mező enum értékeit az új értékekre\n' +
          '5. Ismételje meg ugyanezt a "Document" content type-nál is\n\n' +
          'Részletes útmutató: docs/STRAPI_SCHEMA_UPDATE.md'
        );
      } else {
        alert(error?.message || 'Hiba történt a sablon frissítése során.');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      return templatesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (error: any) => {
      console.error('Error deleting template:', error);
      alert(error?.message || 'Hiba történt a sablon törlése során.');
    },
  });

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    form.reset({
      name: template.name,
      type: template.type,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (template: Template) => {
    if (confirm(`Biztosan törölni szeretné a "${template.name}" sablont?`)) {
      const identifier = template.documentId || template.id;
      deleteMutation.mutate(identifier);
    }
  };

  const onSubmit = (values: TemplateFormValues) => {
    if (editingTemplate) {
      const identifier = editingTemplate.documentId || editingTemplate.id;
      updateMutation.mutate({
        id: identifier,
        data: {
          name: values.name,
          type: values.type,
        },
      });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold">Dokumentum sablonok</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Dokumentum sablonok kezelése és szerkesztése
              </p>
            </div>
            {canManageTemplates && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingTemplate(null);
                    form.reset();
                    setSelectedFile(null);
                  }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Új sablon
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingTemplate ? 'Sablon szerkesztése' : 'Új sablon létrehozása'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingTemplate
                        ? 'Módosítsa a sablon adatait vagy cserélje le a sablon fájlt.'
                        : 'Hozzon létre egy új dokumentum sablont.'}
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sablon neve *</FormLabel>
                            <FormControl>
                              <Input placeholder="Pl. Felmérőlap sablon" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dokumentum típus *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Válasszon típust" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.entries(TEMPLATE_TYPE_LABELS).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Sablon fájl (DOCX) {editingTemplate && '(opcionális - csak lecseréléshez)'}
                        </label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept=".docx"
                            onChange={handleFileSelect}
                            className="flex-1"
                          />
                          {selectedFile && (
                            <span className="text-sm text-gray-500">{selectedFile.name}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {editingTemplate
                            ? 'Csak akkor töltse fel, ha le szeretné cserélni a meglévő sablont.'
                            : 'Töltse fel a DOCX sablon fájlt. A tokeneket {token_neve} formátumban használja.'}
                        </p>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
                        <p className="text-sm font-medium mb-3">Elérhető tokenek:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Szerződő fél (1):</p>
                            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                              <li>• {'{nev1}'} - Név</li>
                              <li>• {'{irsz1}'} - Irányítószám</li>
                              <li>• {'{telepules1}'} - Település</li>
                              <li>• {'{cim1}'} - Cím (utca, házszám)</li>
                              <li>• {'{telefon}'} - Telefonszám</li>
                              <li>• {'{email1}'} - Email</li>
                            </ul>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Személyes adatok (1):</p>
                            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                              <li>• {'{szhely}'} - Születési hely</li>
                              <li>• {'{szido1}'} - Születési idő</li>
                              <li>• {'{anyjaneve1}'} - Anyja neve</li>
                              <li>• {'{adoazonosito1}'} - Adóazonosító</li>
                            </ul>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Projekt / ingatlan:</p>
                            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                              <li>• {'{projektirsz}'} - Ingatlan IRSZ</li>
                              <li>• {'{projekttelepules}'} - Ingatlan település</li>
                              <li>• {'{projektcim}'} - Ingatlan cím (utca, házszám)</li>
                              <li>• {'{hrsz}'} - HRSZ</li>
                              <li>• {'{negyzetmeter}'} - Terület (m²)</li>
                              <li>• {'{fodem_anyaga}'} - Födém anyaga</li>
                            </ul>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Szerződő fél (2) / cég:</p>
                            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                              <li>• {'{nev2}'} - Név</li>
                              <li>• {'{irsz2}'} - Irányítószám</li>
                              <li>• {'{telepules2}'} - Település</li>
                              <li>• {'{cim2}'} - Cím</li>
                              <li>• {'{szido2}'} - Születési idő</li>
                              <li>• {'{anyjaneve2}'} - Anyja neve</li>
                              <li>• {'{adoazonosito2}'} - Adóazonosító</li>
                              <li>• {'{adoszam}'} - Adószám</li>
                            </ul>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Dátumok / egyéb:</p>
                            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                              <li>• {'{szerzodesdatum}'} - Szerződés dátuma</li>
                              <li>• {'{kivdatum}'} - Kivitelezés dátuma</li>
                              <li>• {'{kivdatum_real}'} - Kivitelezés dátuma (tényleges)</li>
                              <li>• {'{hem}'} - HEM</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsDialogOpen(false);
                            form.reset();
                            setSelectedFile(null);
                          }}
                        >
                          Mégse
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                          {editingTemplate ? 'Mentés' : 'Létrehozás'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Sablonok betöltése...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">Még nincsenek sablonok.</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Első sablon létrehozása
              </Button>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Név</TableHead>
                    <TableHead>Típus</TableHead>
                    <TableHead>Fájl</TableHead>
                    <TableHead>Tokenek</TableHead>
                    <TableHead className="text-right">Műveletek</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>{TEMPLATE_TYPE_LABELS[template.type as TemplateType] || template.type}</TableCell>
                      <TableCell>
                        {template.template_file ? (
                          <span className="text-green-600 dark:text-green-400">
                            ✓ {typeof template.template_file === 'object' && template.template_file.name
                              ? template.template_file.name
                              : 'Feltöltve'}
                          </span>
                        ) : (
                          <span className="text-gray-400">Nincs fájl</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {template.tokens && template.tokens.length > 0 ? (
                          <span className="text-sm text-gray-500">
                            {template.tokens.length} token
                          </span>
                        ) : (
                          <span className="text-gray-400">Nincs</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canManageTemplates && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(template)}
                              title="Szerkesztés"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(template)}
                              title="Törlés"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
