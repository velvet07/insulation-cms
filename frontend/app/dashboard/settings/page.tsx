'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useAuthStore } from '@/lib/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { companiesApi } from '@/lib/api/companies';
import { Building2, Plus, Trash2, Edit } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const companySchema = z.object({
  name: z.string().min(1, 'A cég neve kötelező'),
  type: z.enum(['main_contractor', 'subcontractor'], {
    required_error: 'A cég típusa kötelező',
  }),
  tax_number: z.string().optional(),
  address: z.string().optional(),
  parent_company: z.string().optional(),
});

type CompanyFormValues = z.infer<typeof companySchema>;

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companiesApi.getAll(),
    enabled: isAdmin,
  });

  const { data: mainContractors = [] } = useQuery({
    queryKey: ['companies', 'main_contractors'],
    queryFn: () => companiesApi.getAll({ type: 'main_contractor' }),
    enabled: isAdmin,
  });

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: '',
      type: 'subcontractor',
      tax_number: '',
      address: '',
      parent_company: undefined,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CompanyFormValues) => {
      const submitData: any = {
        name: data.name,
        type: data.type,
        tax_number: data.tax_number || undefined,
        address: data.address || undefined,
      };
      if (data.parent_company) {
        submitData.parent_company = data.parent_company;
      }
      return companiesApi.create(submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      form.reset();
      setIsDialogOpen(false);
      setEditingCompany(null);
    },
    onError: (error: any) => {
      alert(error.message || 'Hiba történt a cég létrehozása során');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CompanyFormValues }) => {
      const submitData: any = {
        name: data.name,
        type: data.type,
        tax_number: data.tax_number || undefined,
        address: data.address || undefined,
      };
      if (data.parent_company) {
        submitData.parent_company = data.parent_company;
      } else {
        submitData.parent_company = null;
      }
      return companiesApi.update(id, submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      form.reset();
      setIsDialogOpen(false);
      setEditingCompany(null);
    },
    onError: (error: any) => {
      alert(error.message || 'Hiba történt a cég frissítése során');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => companiesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (error: any) => {
      alert(error.message || 'Hiba történt a cég törlése során');
    },
  });

  const handleEdit = (companyId: string) => {
    const company = companies.find(c => (c.documentId || c.id.toString()) === companyId);
    if (company) {
      setEditingCompany(companyId);
      form.reset({
        name: company.name,
        type: company.type,
        tax_number: company.tax_number || '',
        address: company.address || '',
        parent_company: company.parent_company 
          ? (typeof company.parent_company === 'object' && 'documentId' in company.parent_company
              ? company.parent_company.documentId
              : typeof company.parent_company === 'object' && 'id' in company.parent_company
              ? company.parent_company.id.toString()
              : undefined)
          : undefined,
      });
      setIsDialogOpen(true);
    }
  };

  const handleDelete = (companyId: string) => {
    if (confirm('Biztosan törölni szeretnéd ezt a céget?')) {
      deleteMutation.mutate(companyId);
    }
  };

  const onSubmit = (data: CompanyFormValues) => {
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const companyTypeLabels: Record<string, string> = {
    main_contractor: 'Fővállalkozó',
    subcontractor: 'Alvállalkozó',
  };

  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="mb-6">
            <h2 className="text-3xl font-bold">Beállítások</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Kezelje a rendszer beállításait
            </p>
          </div>
          <Alert>
            <AlertDescription>
              Nincs jogosultságod a beállítások megtekintéséhez. Csak admin felhasználók érhetik el ezt az oldalt.
            </AlertDescription>
          </Alert>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Beállítások</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Kezelje a rendszer beállításait
          </p>
        </div>

        {/* Cégek kezelése */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Cégek kezelése
                </CardTitle>
                <CardDescription>
                  Hozz létre és kezelj cégeket (Fővállalkozók és Alvállalkozók)
                </CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                  form.reset();
                  setEditingCompany(null);
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Új cég
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingCompany ? 'Cég szerkesztése' : 'Új cég létrehozása'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingCompany 
                        ? 'Módosítsd a cég adatait' 
                        : 'Töltsd ki az adatokat az új cég létrehozásához'}
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cég neve *</FormLabel>
                            <FormControl>
                              <Input placeholder="Pl. ABC Kft." {...field} />
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
                            <FormLabel>Cég típusa *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Válassz típust" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="main_contractor">Fővállalkozó</SelectItem>
                                <SelectItem value="subcontractor">Alvállalkozó</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Fővállalkozók önálló cégek. Alvállalkozók egy Fővállalkozóhoz tartoznak.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {form.watch('type') === 'subcontractor' && (
                        <FormField
                          control={form.control}
                          name="parent_company"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Szülő cég (Fővállalkozó)</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Válassz fővállalkozót" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {mainContractors.map((company) => (
                                    <SelectItem 
                                      key={company.documentId || company.id} 
                                      value={company.documentId || company.id.toString()}
                                    >
                                      {company.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Válaszd ki, melyik Fővállalkozóhoz tartozik ez az Alvállalkozó
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <FormField
                        control={form.control}
                        name="tax_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Adószám</FormLabel>
                            <FormControl>
                              <Input placeholder="Pl. 12345678-1-23" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cím</FormLabel>
                            <FormControl>
                              <Input placeholder="Pl. 1234 Budapest, Fő utca 1." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsDialogOpen(false);
                            form.reset();
                            setEditingCompany(null);
                          }}
                        >
                          Mégse
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                          {(createMutation.isPending || updateMutation.isPending) ? 'Mentés...' : editingCompany ? 'Módosítás' : 'Létrehozás'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-gray-500 text-center py-8">Betöltés...</p>
            ) : companies.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Még nincs cég létrehozva.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cég neve</TableHead>
                    <TableHead>Típus</TableHead>
                    <TableHead>Szülő cég</TableHead>
                    <TableHead>Adószám</TableHead>
                    <TableHead>Cím</TableHead>
                    <TableHead className="text-right">Műveletek</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.documentId || company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          company.type === 'main_contractor'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                        }`}>
                          {companyTypeLabels[company.type]}
                        </span>
                      </TableCell>
                      <TableCell>
                        {company.parent_company ? (
                          typeof company.parent_company === 'object' && 'name' in company.parent_company
                            ? company.parent_company.name
                            : '-'
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{company.tax_number || '-'}</TableCell>
                      <TableCell>{company.address || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(company.documentId || company.id.toString())}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(company.documentId || company.id.toString())}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
