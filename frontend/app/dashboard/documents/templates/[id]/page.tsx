'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  FormDescription,
} from '@/components/ui/form';
import { templatesApi } from '@/lib/api/templates';
import { companiesApi } from '@/lib/api/companies';
import { TEMPLATE_TYPE_LABELS, type Template, type TemplateType, type Company } from '@/types';
import { useAuthStore } from '@/lib/store/auth';
import { usePermission } from '@/lib/contexts/permission-context';
import { isAdminRole } from '@/lib/utils/user-role';
import { ArrowLeft, Upload, FileText, AlertCircle, Loader2 } from 'lucide-react';

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
  company: z.string().optional(),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params?.id as string;
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { can } = usePermission();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const isAdmin = isAdminRole(user);

  // Check permission
  const canManageTemplates = can('documents', 'manage_templates');
  if (!canManageTemplates) {
    router.push('/dashboard/documents/templates');
    return null;
  }

  // Fetch template
  const { data: template, isLoading: isLoadingTemplate } = useQuery({
    queryKey: ['template', templateId],
    queryFn: () => templatesApi.getOne(templateId),
    enabled: !!templateId,
  });

  // Fetch main contractors (for admin only)
  const { data: mainContractors = [] } = useQuery({
    queryKey: ['companies', 'main_contractor'],
    queryFn: () => companiesApi.getAll({ type: 'main_contractor' }),
    enabled: isAdmin,
  });

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      type: 'felmerolap',
      company: '__none__',
    },
  });

  // Populate form when template loads
  useEffect(() => {
    if (template) {
      // Get company ID (documentId or id)
      let companyId: string | undefined;
      if (template.company) {
        if (typeof template.company === 'object') {
          companyId = (template.company as Company).documentId || String((template.company as Company).id);
        } else {
          companyId = String(template.company);
        }
      }
      
      form.reset({
        name: template.name,
        type: template.type,
        company: companyId || '__none__',
      });
    }
  }, [template, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: TemplateFormValues) => {
      const companyValue = data.company === '__none__' ? undefined : data.company;
      const updateData: Partial<Template> = {
        name: data.name,
        type: data.type,
      };
      
      // Admin can update company
      if (isAdmin) {
        updateData.company = companyValue;
      }
      
      return templatesApi.update(templateId, updateData, selectedFile || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['template', templateId] });
      router.push('/dashboard/documents/templates');
    },
    onError: (error: any) => {
      console.error('Error updating template:', error);
      const errorMessage = error?.message || '';
      if (errorMessage.includes('type must be one of the following values') ||
        errorMessage.includes('contract, worksheet, invoice')) {
        alert(
          'HIBA: A Strapi szerveren a dokumentum típusok sémája még nem frissült.\n\n' +
          'Kérjük, frissítse a Strapi admin felületen:\n' +
          '1. Lépjen be: https://cms.emermedia.eu/admin\n' +
          '2. Menjen a Content-Type Builder menüpontra\n' +
          '3. Keresse meg a "Template" content type-ot\n' +
          '4. Frissítse a "type" mező enum értékeit az új értékekre\n\n' +
          'Részletes útmutató: docs/STRAPI_SCHEMA_UPDATE.md'
        );
      } else {
        alert(error?.message || 'Hiba történt a sablon frissítése során.');
      }
    },
  });

  const onSubmit = (values: TemplateFormValues) => {
    updateMutation.mutate(values);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  if (isLoadingTemplate) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (!template) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="text-center py-12">
            <p className="text-gray-500">Sablon nem található</p>
            <Button onClick={() => router.push('/dashboard/documents/templates')} className="mt-4">
              Vissza a sablonokhoz
            </Button>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push('/dashboard/documents/templates')}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Vissza a sablonokhoz
            </Button>
            <h2 className="text-3xl font-bold">Sablon szerkesztése</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Módosítsa a sablon adatait vagy cserélje le a fájlt
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sablon adatok</CardTitle>
              <CardDescription>
                Frissítse a sablon alapadatait
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
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

                  {isAdmin && (
                    <FormField
                      control={form.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fővállalkozó (opcionális)</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value || '__none__'}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Válasszon céget (üres = globális sablon)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">
                                <span className="text-gray-500">Nincs (globális sablon)</span>
                              </SelectItem>
                              {mainContractors.map((company) => (
                                <SelectItem 
                                  key={company.documentId || company.id} 
                                  value={company.documentId || String(company.id)}>
                                  {company.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Ha nincs kiválasztva, a sablon minden cég számára elérhető lesz
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div>
                    <Label htmlFor="file" className="mb-2 block">
                      Sablon fájl (DOCX) <span className="text-gray-500 text-sm">(opcionális - csak lecseréléshez)</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="file"
                        type="file"
                        accept=".docx"
                        onChange={handleFileSelect}
                        className="flex-1"
                      />
                      {selectedFile && (
                        <span className="text-sm text-green-600 dark:text-green-400">
                          ✓ {selectedFile.name}
                        </span>
                      )}
                    </div>
                    {!selectedFile && template.template_file && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Jelenlegi fájl: {typeof template.template_file === 'object' && template.template_file.name
                          ? template.template_file.name
                          : 'Feltöltve'}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Csak akkor töltse fel, ha le szeretné cserélni a meglévő sablont
                    </p>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Elérhető tokenek</AlertTitle>
                    <AlertDescription>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 text-xs">
                        <div>
                          <p className="font-semibold mb-1">Szerződő fél (1):</p>
                          <ul className="space-y-0.5">
                            <li>• {'{nev1}'} - Név</li>
                            <li>• {'{irsz1}'} - Irányítószám</li>
                            <li>• {'{telepules1}'} - Település</li>
                            <li>• {'{cim1}'} - Cím</li>
                            <li>• {'{telefon}'} - Telefonszám</li>
                            <li>• {'{email1}'} - Email</li>
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold mb-1">Személyes adatok (1):</p>
                          <ul className="space-y-0.5">
                            <li>• {'{szhely}'} - Születési hely</li>
                            <li>• {'{szido1}'} - Születési idő</li>
                            <li>• {'{anyjaneve1}'} - Anyja neve</li>
                            <li>• {'{adoazonosito1}'} - Adóazonosító</li>
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold mb-1">Projekt / ingatlan:</p>
                          <ul className="space-y-0.5">
                            <li>• {'{projektirsz}'} - Ingatlan IRSZ</li>
                            <li>• {'{projekttelepules}'} - Ingatlan település</li>
                            <li>• {'{projektcim}'} - Ingatlan cím</li>
                            <li>• {'{hrsz}'} - HRSZ</li>
                            <li>• {'{negyzetmeter}'} - Terület (m²)</li>
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold mb-1">Szerződő fél (2) / cég:</p>
                          <ul className="space-y-0.5">
                            <li>• {'{nev2}'} - Név</li>
                            <li>• {'{irsz2}'} - Irányítószám</li>
                            <li>• {'{telepules2}'} - Település</li>
                            <li>• {'{cim2}'} - Cím</li>
                            <li>• {'{adoszam}'} - Adószám</li>
                          </ul>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push('/dashboard/documents/templates')}
                    >
                      Mégse
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? 'Mentés...' : 'Módosítások mentése'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
