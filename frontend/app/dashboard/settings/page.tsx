'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useAuthStore } from '@/lib/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogFooter,
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
import { photoCategoriesApi } from '@/lib/api/photo-categories';
import { materialsApi, type Material } from '@/lib/api/materials';
import { Building2, Plus, Trash2, Edit, FolderTree, Package } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { isAdminRole } from '@/lib/utils/user-role';
import type { Company } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import type { PhotoCategory } from '@/types';

const companySchema = z.object({
  name: z.string().min(1, 'A cég neve kötelező'),
  type: z.enum(['main_contractor', 'subcontractor'], {
    message: 'A cég típusa kötelező',
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
  
  // Photo category management states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PhotoCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryRequired, setCategoryRequired] = useState(false);

  // Material type management states
  const [isMaterialDialogOpen, setIsMaterialDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [materialName, setMaterialName] = useState('');
  const [materialCategory, setMaterialCategory] = useState<Material['category']>('insulation');
  const [materialThickness, setMaterialThickness] = useState<Material['thickness_cm']>();
  const [materialCoverage, setMaterialCoverage] = useState('');
  const [materialRollsPerPallet, setMaterialRollsPerPallet] = useState('24');

  // Check if user is subcontractor - same way as in projects page
  const getUserCompany = () => {
    if (!user?.company) {
      console.log('[SettingsPage] No company found for user:', user);
      return null;
    }
    if (typeof user.company === 'object' && 'type' in user.company) {
      console.log('[SettingsPage] Company found:', user.company, 'type:', (user.company as any).type);
      return user.company as Company;
    }
    console.log('[SettingsPage] Company is not an object with type:', typeof user.company, user.company);
    return null;
  };

  const userCompany = getUserCompany();
  const isSubContractor = userCompany?.type === 'subcontractor';
  const isAdmin = useMemo(() => isAdminRole(user), [user]);
  
  console.log('[SettingsPage] Access check:', {
    userCompany,
    companyType: userCompany?.type,
    isSubContractor,
    isAdmin,
    shouldBlock: isSubContractor && !isAdmin
  });

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

  // Fetch photo categories
  const { data: categories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['photo-categories'],
    queryFn: () => photoCategoriesApi.getAll(),
    enabled: isAdmin,
  });

  // Fetch materials
  const { data: materials = [], isLoading: isLoadingMaterials } = useQuery({
    queryKey: ['materials'],
    queryFn: () => materialsApi.getAll(),
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
      // Main contractor can only create subcontractors
      if (isMainContractor && !isAdmin && data.type === 'main_contractor') {
        throw new Error('Nincs jogosultságod fővállalkozó létrehozásához. Csak admin felhasználók hozhatnak létre fővállalkozókat.');
      }
      
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
      // Main contractor can only update subcontractors
      if (isMainContractor && !isAdmin && data.type === 'main_contractor') {
        throw new Error('Nincs jogosultságod fővállalkozó módosításához. Csak admin felhasználók módosíthatják a fővállalkozókat.');
      }
      
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

  // Photo category mutations
  const createCategoryMutation = useMutation({
    mutationFn: async ({ name, required }: { name: string; required: boolean }) => {
      const categoryData: any = {
        name,
        order: categories.length,
        required,
      };
      
      // Generate slug on frontend as fallback (though lifecycle hook should handle it)
      if (!categoryData.slug) {
        categoryData.slug = name
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
      }
      
      const category = await photoCategoriesApi.create(categoryData);
      return category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photo-categories'] });
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryName('');
      setCategoryRequired(false);
    },
    onError: (error: any) => {
      console.error('Category creation error:', error);
      const errorMessage = error.response?.data?.error?.message || 
                          error.message || 
                          'Hiba történt a kategória létrehozása során';
      alert(errorMessage);
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, name, required }: { id: number | string; name: string; required: boolean }) => {
      const category = await photoCategoriesApi.update(id, { name, required });
      return category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photo-categories'] });
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryName('');
      setCategoryRequired(false);
    },
    onError: (error: any) => {
      alert(error.message || 'Hiba történt a kategória frissítése során');
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number | string) => {
      await photoCategoriesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photo-categories'] });
    },
    onError: (error: any) => {
      alert(error.message || 'Hiba történt a kategória törlése során');
    },
  });

  const handleEdit = (companyId: string) => {
    const company = companies.find(c => (c.documentId || c.id.toString()) === companyId);
    if (company) {
      // Main contractor can only edit subcontractors
      if (isMainContractor && !isAdmin && company.type === 'main_contractor') {
        alert('Nincs jogosultságod fővállalkozó szerkesztéséhez. Csak admin felhasználók szerkeszthetik a fővállalkozókat.');
        return;
      }
      
      setEditingCompany(companyId);
      const companyType = company.type;
      // Main contractor can only edit subcontractors, so if editing, keep it as subcontractor
      const allowedType = (isMainContractor && !isAdmin && companyType === 'main_contractor') 
        ? 'subcontractor' 
        : companyType;
      
      form.reset({
        name: company.name,
        type: allowedType as 'main_contractor' | 'subcontractor',
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
    const company = companies.find(c => (c.documentId || c.id.toString()) === companyId);
    if (company) {
      // Main contractor can only delete subcontractors
      if (isMainContractor && !isAdmin && company.type === 'main_contractor') {
        alert('Nincs jogosultságod fővállalkozó törléséhez. Csak admin felhasználók törölhetik a fővállalkozókat.');
        return;
      }
      
      if (confirm('Biztosan törölni szeretnéd ezt a céget?')) {
        deleteMutation.mutate(companyId);
      }
    }
  };

  const onSubmit = (data: CompanyFormValues) => {
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Photo category handlers
  const handleCategoryCreate = () => {
    if (!categoryName.trim()) return;
    createCategoryMutation.mutate({ name: categoryName.trim(), required: categoryRequired });
  };

  const handleCategoryEdit = (category: PhotoCategory) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryRequired(category.required || false);
    setIsCategoryDialogOpen(true);
  };

  const handleCategoryUpdate = () => {
    if (!editingCategory || !categoryName.trim()) return;
    const identifier = editingCategory.documentId || editingCategory.id;
    updateCategoryMutation.mutate({ id: identifier, name: categoryName.trim(), required: categoryRequired });
  };

  const handleCategoryDelete = (category: PhotoCategory) => {
    if (category.required === true) {
      alert('A kötelező kategóriákat nem lehet törölni.');
      return;
    }
    
    if (confirm(`Biztosan törölni szeretné ezt a kategóriát: ${category.name}?`)) {
      const identifier = category.documentId || category.id;
      deleteCategoryMutation.mutate(identifier);
    }
  };

  // Material mutations
  const createMaterialMutation = useMutation({
    mutationFn: async (data: Partial<Material>) => {
      return materialsApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setIsMaterialDialogOpen(false);
      setEditingMaterial(null);
      setMaterialName('');
      setMaterialCategory('insulation');
      setMaterialThickness(undefined);
      setMaterialCoverage('');
      setMaterialRollsPerPallet('24');
    },
    onError: (error: any) => {
      alert(error.message || 'Hiba történt az anyag létrehozása során');
    },
  });

  const updateMaterialMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number | string; data: Partial<Material> }) => {
      return materialsApi.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setIsMaterialDialogOpen(false);
      setEditingMaterial(null);
      setMaterialName('');
      setMaterialCategory('insulation');
      setMaterialThickness(undefined);
      setMaterialCoverage('');
      setMaterialRollsPerPallet('24');
    },
    onError: (error: any) => {
      alert(error.message || 'Hiba történt az anyag frissítése során');
    },
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: async (id: number | string) => {
      await materialsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
    onError: (error: any) => {
      alert(error.message || 'Hiba történt az anyag törlése során');
    },
  });

  // Material handlers
  const handleMaterialCreate = () => {
    if (!materialName.trim() || !materialCoverage) return;

    const materialData: Partial<Material> = {
      name: materialName.trim(),
      category: materialCategory,
      coverage_per_roll: parseFloat(materialCoverage),
      rolls_per_pallet: parseInt(materialRollsPerPallet) || 24,
    };

    if (materialCategory === 'insulation' && materialThickness) {
      materialData.thickness_cm = materialThickness;
    }

    createMaterialMutation.mutate(materialData);
  };

  const handleMaterialEdit = (material: Material) => {
    setEditingMaterial(material);
    setMaterialName(material.name);
    setMaterialCategory(material.category);
    setMaterialThickness(material.thickness_cm);
    setMaterialCoverage(material.coverage_per_roll?.toString() || '');
    setMaterialRollsPerPallet(material.rolls_per_pallet?.toString() || '24');
    setIsMaterialDialogOpen(true);
  };

  const handleMaterialUpdate = () => {
    if (!editingMaterial || !materialName.trim() || !materialCoverage) return;

    const identifier = editingMaterial.documentId || editingMaterial.id;
    const materialData: Partial<Material> = {
      name: materialName.trim(),
      category: materialCategory,
      coverage_per_roll: parseFloat(materialCoverage),
      rolls_per_pallet: parseInt(materialRollsPerPallet) || 24,
    };

    if (materialCategory === 'insulation') {
      materialData.thickness_cm = materialThickness;
    } else {
      materialData.thickness_cm = undefined;
    }

    updateMaterialMutation.mutate({ id: identifier!, data: materialData });
  };

  const handleMaterialDelete = (material: Material) => {
    if (confirm(`Biztosan törölni szeretné ezt az anyagot: ${material.name}?`)) {
      const identifier = material.documentId || material.id;
      deleteMaterialMutation.mutate(identifier!);
    }
  };

  const companyTypeLabels: Record<string, string> = {
    main_contractor: 'Fővállalkozó',
    subcontractor: 'Alvállalkozó',
  };

  const materialCategoryLabels: Record<Material['category'], string> = {
    insulation: 'Szigetelőanyag',
    vapor_barrier: 'Párazáró fólia',
    breathable_membrane: 'Légáteresztő fólia',
  };

  const thicknessLabels: Record<NonNullable<Material['thickness_cm']>, string> = {
    cm10: '10 cm',
    cm12_5: '12.5 cm',
    cm15: '15 cm',
  };

  // Determine user permissions - same way as in projects page
  const isMainContractor = userCompany?.type === 'main_contractor';
  
  const canManageCompanies = isAdmin || isMainContractor;
  
  // Subcontractors cannot access settings page (except admins)
  if (isSubContractor && !isAdmin) {
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
              Nincs jogosultságod a beállítások megtekintéséhez. Csak admin felhasználók és fővállalkozók érhetik el ezt az oldalt.
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
              {canManageCompanies && (
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
                                {isAdmin && (
                                  <SelectItem value="main_contractor">Fővállalkozó</SelectItem>
                                )}
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
              )}
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
                        {canManageCompanies && (
                          // Main contractor can only edit/delete subcontractors
                          (isAdmin || (isMainContractor && company.type === 'subcontractor')) && (
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
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Fénykép kategóriák kezelése */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FolderTree className="h-5 w-5" />
                  Fénykép kategóriák kezelése
                </CardTitle>
                <CardDescription>
                  Hozz létre és kezelj fénykép kategóriákat
                </CardDescription>
              </div>
              <Dialog open={isCategoryDialogOpen} onOpenChange={(open) => {
                setIsCategoryDialogOpen(open);
                if (!open) {
                  setEditingCategory(null);
                  setCategoryName('');
                  setCategoryRequired(false);
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Új kategória
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingCategory ? 'Kategória szerkesztése' : 'Új kategória'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingCategory 
                        ? 'Módosítsa a kategória beállításait.' 
                        : 'Adjon nevet az új kategóriának és állítsa be, hogy kötelező-e.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="category-name">Kategória neve *</Label>
                      <Input
                        id="category-name"
                        value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value)}
                        placeholder="pl. Külső képek"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="category-required"
                        checked={categoryRequired}
                        onCheckedChange={(checked) => setCategoryRequired(checked === true)}
                        disabled={editingCategory?.required === true}
                      />
                      <Label
                        htmlFor="category-required"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Kötelező kategória
                      </Label>
                    </div>
                    {editingCategory?.required === true && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        A default kategóriák kötelezőek és nem módosíthatók.
                      </p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCategoryDialogOpen(false);
                        setEditingCategory(null);
                        setCategoryName('');
                        setCategoryRequired(false);
                      }}
                    >
                      Mégse
                    </Button>
                    <Button
                      onClick={editingCategory ? handleCategoryUpdate : handleCategoryCreate}
                      disabled={!categoryName.trim() || createCategoryMutation.isPending || updateCategoryMutation.isPending}
                    >
                      {createCategoryMutation.isPending || updateCategoryMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Mentés...
                        </>
                      ) : (
                        editingCategory ? 'Mentés' : 'Létrehozás'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingCategories ? (
              <p className="text-gray-500 text-center py-8">Betöltés...</p>
            ) : categories.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Még nincs kategória létrehozva.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Név</TableHead>
                    <TableHead>Kötelező</TableHead>
                    <TableHead>Rendezsés</TableHead>
                    <TableHead className="text-right">Műveletek</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.documentId || category.id}>
                      <TableCell className="font-medium">
                        {category.name}
                      </TableCell>
                      <TableCell>
                        {category.required ? (
                          <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                            Kötelező
                          </span>
                        ) : (
                          <span className="text-gray-500 text-sm">Opcionális</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {category.order ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!category.required && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCategoryEdit(category)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCategoryDelete(category)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                          {category.required && (
                            <span className="text-xs text-gray-500">Nem szerkeszthető</span>
                          )}
        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Anyagtípusok kezelése */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Anyagtípusok kezelése
                </CardTitle>
                <CardDescription>
                  Hozz létre és kezelj anyagtípusokat (szigetelőanyag, párazáró fólia, légáteresztő fólia)
                </CardDescription>
              </div>
              <Dialog open={isMaterialDialogOpen} onOpenChange={(open) => {
                setIsMaterialDialogOpen(open);
                if (!open) {
                  setEditingMaterial(null);
                  setMaterialName('');
                  setMaterialCategory('insulation');
                  setMaterialThickness(undefined);
                  setMaterialCoverage('');
                  setMaterialRollsPerPallet('24');
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Új anyag
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingMaterial ? 'Anyag szerkesztése' : 'Új anyag'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingMaterial 
                        ? 'Módosítsa az anyag beállításait.' 
                        : 'Adja meg az anyag típusát és paramétereit.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="material-name">Anyag neve *</Label>
                      <Input
                        id="material-name"
                        value={materialName}
                        onChange={(e) => setMaterialName(e.target.value)}
                        placeholder="pl. Szigetelő 10cm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="material-category">Kategória *</Label>
                      <Select value={materialCategory} onValueChange={(v: Material['category']) => setMaterialCategory(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="insulation">Szigetelőanyag</SelectItem>
                          <SelectItem value="vapor_barrier">Párazáró fólia</SelectItem>
                          <SelectItem value="breathable_membrane">Légáteresztő fólia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {materialCategory === 'insulation' && (
                      <div>
                        <Label htmlFor="material-thickness">Vastagság</Label>
                        <Select value={materialThickness || ''} onValueChange={(v: string) => setMaterialThickness((v as Material['thickness_cm']) || undefined)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Válasszon vastagságot" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cm10">10 cm</SelectItem>
                            <SelectItem value="cm12_5">12.5 cm</SelectItem>
                            <SelectItem value="cm15">15 cm</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label htmlFor="material-coverage">m²/tekercs *</Label>
                      <Input
                        id="material-coverage"
                        type="number"
                        step="0.01"
                        min="0"
                        value={materialCoverage}
                        onChange={(e) => setMaterialCoverage(e.target.value)}
                        placeholder="pl. 9.24"
                      />
                    </div>
                    {materialCategory === 'insulation' && (
                      <div>
                        <Label htmlFor="material-rolls-per-pallet">Tekercs/raklap</Label>
                        <Input
                          id="material-rolls-per-pallet"
                          type="number"
                          min="1"
                          value={materialRollsPerPallet}
                          onChange={(e) => setMaterialRollsPerPallet(e.target.value)}
                          placeholder="24"
                        />
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsMaterialDialogOpen(false);
                        setEditingMaterial(null);
                        setMaterialName('');
                        setMaterialCategory('insulation');
                        setMaterialThickness(undefined);
                        setMaterialCoverage('');
                        setMaterialRollsPerPallet('24');
                      }}
                    >
                      Mégse
                    </Button>
                    <Button
                      onClick={editingMaterial ? handleMaterialUpdate : handleMaterialCreate}
                      disabled={!materialName.trim() || !materialCoverage || createMaterialMutation.isPending || updateMaterialMutation.isPending}
                    >
                      {createMaterialMutation.isPending || updateMaterialMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Mentés...
                        </>
                      ) : (
                        editingMaterial ? 'Mentés' : 'Létrehozás'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingMaterials ? (
              <p className="text-gray-500 text-center py-8">Betöltés...</p>
            ) : materials.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Még nincs anyag létrehozva.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Név</TableHead>
                    <TableHead>Kategória</TableHead>
                    <TableHead>Vastagság</TableHead>
                    <TableHead>m²/tekercs</TableHead>
                    <TableHead>Tekercs/raklap</TableHead>
                    <TableHead className="text-right">Műveletek</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map((material) => (
                    <TableRow key={material.id || material.documentId}>
                      <TableCell className="font-medium">
                        {material.name}
                      </TableCell>
                      <TableCell>
                        {materialCategoryLabels[material.category as Material['category']]}
                      </TableCell>
                      <TableCell>
                        {material.thickness_cm ? thicknessLabels[material.thickness_cm as NonNullable<Material['thickness_cm']>] : '-'}
                      </TableCell>
                      <TableCell>
                        {material.coverage_per_roll?.toFixed(2) || '-'}
                      </TableCell>
                      <TableCell>
                        {material.rolls_per_pallet || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMaterialEdit(material)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMaterialDelete(material)}
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
