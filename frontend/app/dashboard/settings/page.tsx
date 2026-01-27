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
import { PermissionMatrix } from '@/components/settings/permission-matrix';
import { usePermission } from '@/lib/contexts/permission-context';
import { usersApi } from '@/lib/api/users';
import { Building2, Plus, Trash2, Edit, FolderTree, Package, UserPlus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { isAdminRole, isSubcontractor } from '@/lib/utils/user-role';
import type { Company, User } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import type { PhotoCategory } from '@/types';
import { getRoles } from '@/lib/api/create-user';

const companySchema = z.object({
  name: z.string().min(1, 'A cég neve kötelező'),
  type: z.enum(['main_contractor', 'subcontractor'], {
    message: 'A cég típusa kötelező',
  }),
  tax_number: z.string().optional(),
  address: z.string().optional(),
  parent_company: z.string().optional(),
  billing_price_per_sqm: z.string().optional(),
});

type CompanyFormValues = z.infer<typeof companySchema>;

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const { can } = usePermission();
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

  // User management states
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userUsername, setUserUsername] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [selectedUserCompany, setSelectedUserCompany] = useState<string>('');
  const [userRole, setUserRole] = useState<number | undefined>(undefined);

  const isAdmin = useMemo(() => isAdminRole(user), [user]);

  // Get user company ID
  const userCompanyId = useMemo(() => {
    if (!user?.company) return null;
    if (typeof user.company === 'object') return user.company.documentId || user.company.id;
    return user.company;
  }, [user]);

  const { data: fetchedCompany, isLoading: isLoadingCompany } = useQuery({
    queryKey: ['company', userCompanyId],
    queryFn: () => companiesApi.getOne(userCompanyId!),
    enabled: !!userCompanyId,
    staleTime: 1000 * 60 * 5,
  });

  const userCompany = fetchedCompany || (typeof user?.company === 'object' ? user.company : null);
  const isMainContractor = userCompany?.type === 'main_contractor' || (userCompany?.type as string) === 'Fővállalkozó';
  const isSubContractor = userCompany?.type === 'subcontractor' || (userCompany?.type as string) === 'Alvállalkozó' || isSubcontractor(user);

  // Queries
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies', user?.id, userCompany?.id],
    queryFn: async () => {
      if (isAdmin) {
        return await companiesApi.getAll();
      } else if (isMainContractor && userCompany) {
        const ownId = userCompany.id;
        const [own, subs] = await Promise.all([
          companiesApi.getOne(userCompany.documentId || userCompany.id),
          companiesApi.getAll({ parent_company: ownId })
        ]);
        return [own, ...subs];
      } else if (userCompany) {
        const own = await companiesApi.getOne(userCompany.documentId || userCompany.id);
        return [own];
      }
      return [];
    },
    enabled: !!user,
  });

  const { data: mainContractors = [] } = useQuery({
    queryKey: ['companies', 'main_contractors'],
    queryFn: () => companiesApi.getAll({ type: 'main_contractor' }),
    enabled: isAdmin,
  });

  const { data: categories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['photo-categories'],
    queryFn: () => photoCategoriesApi.getAll(),
    enabled: can('settings', 'manage_photo_categories'),
  });

  const { data: materials = [], isLoading: isLoadingMaterials } = useQuery({
    queryKey: ['materials'],
    queryFn: () => materialsApi.getAll(),
    enabled: can('settings', 'manage_materials'),
  });

  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users', user?.id, companies.length, userCompany?.id],
    queryFn: async () => {
      if (isAdmin) {
        return await usersApi.getAll();
      }
      if (!userCompany) return [];
      const ownCompanyId = userCompany.id;
      if (isMainContractor) {
        const companyIds = [ownCompanyId, ...companies.map(c => c.id)].filter((id, index, self) => self.indexOf(id) === index);
        const [companyUsers, unassignedUsers] = await Promise.all([
          usersApi.getAll({ company: companyIds }),
          usersApi.getAll({ company: 'null' })
        ]);
        const allUsers = [...companyUsers, ...unassignedUsers];
        return Array.from(new Map(allUsers.map(u => [u.id, u])).values());
      } else {
        const [ownUsers, unassignedUsers] = await Promise.all([
          usersApi.getAll({ company: ownCompanyId }),
          usersApi.getAll({ company: 'null' })
        ]);
        const allUsers = [...ownUsers, ...unassignedUsers];
        return Array.from(new Map(allUsers.map(u => [u.id, u])).values());
      }
    },
    enabled: !!user && (isAdmin || !!userCompany),
  });

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
    enabled: can('settings', 'manage_users'),
  });

  const roles = rolesData?.roles || [];

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: '',
      type: 'subcontractor',
      tax_number: '',
      address: '',
      parent_company: undefined,
      billing_price_per_sqm: '',
    },
  });

  const normalizeCompanyPayload = (data: CompanyFormValues) => {
    const submitData: any = { ...data };

    // Only Admin can set billing price
    if (!isAdmin) {
      delete submitData.billing_price_per_sqm;
      return submitData;
    }

    // Only main contractors have a billing price
    if (data.type !== 'main_contractor') {
      delete submitData.billing_price_per_sqm;
      return submitData;
    }

    const raw = (data.billing_price_per_sqm || '').toString().trim().replace(',', '.');
    if (!raw) {
      delete submitData.billing_price_per_sqm;
      return submitData;
    }

    const price = Number(raw);
    if (!Number.isFinite(price) || price < 0) {
      delete submitData.billing_price_per_sqm;
      return submitData;
    }

    submitData.billing_price_per_sqm = price;
    return submitData;
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CompanyFormValues) => {
      const submitData: any = normalizeCompanyPayload(data);
      if (isMainContractor && !isAdmin && userCompany) {
        submitData.parent_company = userCompany.documentId || userCompany.id;
      }
      return companiesApi.create(submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      form.reset();
      setIsDialogOpen(false);
      setEditingCompany(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CompanyFormValues }) => companiesApi.update(id, normalizeCompanyPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      form.reset();
      setIsDialogOpen(false);
      setEditingCompany(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => companiesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
  });

  const createCategoryMutation = useMutation({
    mutationFn: ({ name, required }: { name: string; required: boolean }) => photoCategoriesApi.create({ name, required, order: categories.length }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photo-categories'] });
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryName('');
      setCategoryRequired(false);
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, name, required }: { id: number | string; name: string; required: boolean }) => photoCategoriesApi.update(id, { name, required }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photo-categories'] });
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryName('');
      setCategoryRequired(false);
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number | string) => photoCategoriesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['photo-categories'] }),
  });

  const createMaterialMutation = useMutation({
    mutationFn: (data: Partial<Material>) => materialsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setIsMaterialDialogOpen(false);
      setEditingMaterial(null);
      setMaterialName('');
    },
  });

  const updateMaterialMutation = useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: Partial<Material> }) => materialsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setIsMaterialDialogOpen(false);
      setEditingMaterial(null);
      setMaterialName('');
    },
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: (id: number | string) => materialsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['materials'] }),
  });

  const createUserMutation = useMutation({
    mutationFn: (data: any) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsUserDialogOpen(false);
      setEditingUser(null);
      setUserUsername('');
      setUserEmail('');
      setUserPassword('');
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: any }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsUserDialogOpen(false);
      setEditingUser(null);
      setUserUsername('');
      setUserEmail('');
      setUserPassword('');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string | number) => usersApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });


  // Handlers
  const onSubmit = (data: CompanyFormValues) => {
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (companyId: string) => {
    const company = companies.find(c => (c.documentId || c.id.toString()) === companyId);
    if (company) {
      setEditingCompany(companyId);
      form.reset({
        name: company.name,
        type: company.type as 'main_contractor' | 'subcontractor',
        tax_number: company.tax_number || '',
        address: company.address || '',
        parent_company: company.parent_company ? (company.parent_company.documentId || company.parent_company.id?.toString()) : undefined,
        billing_price_per_sqm:
          company.type === 'main_contractor' && company.billing_price_per_sqm !== undefined && company.billing_price_per_sqm !== null
            ? String(company.billing_price_per_sqm)
            : '',
      });
      setIsDialogOpen(true);
    }
  };

  const handleDelete = (companyId: string) => {
    if (confirm('Biztosan törölni szeretnéd ezt a céget?')) {
      deleteMutation.mutate(companyId);
    }
  };

  const handleCategoryCreate = () => {
    if (!categoryName.trim()) return;
    createCategoryMutation.mutate({ name: categoryName.trim(), required: categoryRequired });
  };

  const handleCategoryUpdate = () => {
    if (!editingCategory || !categoryName.trim()) return;
    const identifier = editingCategory.documentId || editingCategory.id;
    updateCategoryMutation.mutate({ id: identifier, name: categoryName.trim(), required: categoryRequired });
  };

  const handleCategoryDelete = (category: PhotoCategory) => {
    if (category.required) return alert('Kötelező kategória nem törölhető');
    if (confirm('Biztosan törölni szeretnéd?')) {
      deleteCategoryMutation.mutate(category.documentId || category.id);
    }
  };

  const handleMaterialCreate = () => {
    if (!materialName.trim()) return;
    const data: Partial<Material> = {
      name: materialName.trim(),
      category: materialCategory,
      coverage_per_roll: parseFloat(materialCoverage),
      rolls_per_pallet: parseInt(materialRollsPerPallet),
      thickness_cm: materialCategory === 'insulation' ? materialThickness : undefined,
    };
    createMaterialMutation.mutate(data);
  };

  const handleMaterialUpdate = () => {
    if (!editingMaterial) return;
    const data: Partial<Material> = {
      name: materialName.trim(),
      category: materialCategory,
      coverage_per_roll: parseFloat(materialCoverage),
      rolls_per_pallet: parseInt(materialRollsPerPallet),
      thickness_cm: materialCategory === 'insulation' ? materialThickness : undefined,
    };
    updateMaterialMutation.mutate({ id: editingMaterial.documentId || editingMaterial.id!, data });
  };

  const handleMaterialDelete = (material: Material) => {
    if (confirm('Biztosan törölni szeretnéd?')) {
      deleteMaterialMutation.mutate(material.documentId || material.id!);
    }
  };

  const handleUserCreate = () => {
    createUserMutation.mutate({
      username: userUsername,
      email: userEmail,
      password: userPassword,
      company: selectedUserCompany || null,
      role: userRole,
    });
  };

  const handleUserUpdate = () => {
    if (!editingUser) return;
    const data: any = { username: userUsername, email: userEmail, company: selectedUserCompany || null, role: userRole };
    if (userPassword) data.password = userPassword;
    updateUserMutation.mutate({ id: editingUser.id!, data });
  };

  const handleUserDelete = (user: User) => {
    if (confirm('Biztosan törölni szeretnéd?')) {
      deleteUserMutation.mutate(user.id!);
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

  if (isLoadingCompany) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
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
        {can('settings', 'manage_companies') && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Cégek kezelése
                  </CardTitle>
                  <CardDescription>
                    Hozz létre és kezelj cégeket
                  </CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { form.reset(); setEditingCompany(null); }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Új cég
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{editingCompany ? 'Cég szerkesztése' : 'Új cég létrehozása'}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cég neve *</FormLabel>
                              <FormControl><Input {...field} /></FormControl>
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
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {isAdmin && <SelectItem value="main_contractor">Fővállalkozó</SelectItem>}
                                  <SelectItem value="subcontractor">Alvállalkozó</SelectItem>
                                </SelectContent>
                              </Select>
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
                                <FormLabel>Szülő cég</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Válassz" /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    {mainContractors.map(c => <SelectItem key={c.id} value={c.documentId || c.id.toString()}>{c.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
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
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {isAdmin && form.watch('type') === 'main_contractor' && (
                          <FormField
                            control={form.control}
                            name="billing_price_per_sqm"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Ár (Ft/m²) - elszámoláshoz</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    inputMode="decimal"
                                    placeholder="Pl. 460"
                                  />
                                </FormControl>
                                <FormDescription>
                                  Csak Fővállalkozóknál értelmezett. Az elszámolásnál a megkezdett projektek \(m²\)-e ezzel szorzódik.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        <FormField
                          control={form.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cím</FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end gap-2">
                          <Button type="submit">Mentés</Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cég neve</TableHead>
                    <TableHead>Típus</TableHead>
                    <TableHead>Műveletek</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.documentId || company.id}>
                      <TableCell>{company.name}</TableCell>
                      <TableCell>{companyTypeLabels[company.type]}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(company.documentId || company.id.toString())}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(company.documentId || company.id.toString())}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Felhasználók kezelése */}
        {can('settings', 'manage_users') && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Felhasználók kezelése
                  </CardTitle>
                </div>
                {can('settings', 'manage_users') && (
                  <Button onClick={() => { setIsUserDialogOpen(true); setEditingUser(null); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Új felhasználó
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* User Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Felhasználónév</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Cég</TableHead>
                    <TableHead>Műveletek</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{(user.company as any)?.name || '-'}</TableCell>
                      <TableCell className="text-right">
                        {can('settings', 'manage_users') && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => { setEditingUser(user); setUserUsername(user.username || ''); setUserEmail(user.email); setIsUserDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleUserDelete(user)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* User Dialog */}
        <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingUser ? 'Szerkesztés' : 'Új felhasználó'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Felhasználónév</Label><Input value={userUsername} onChange={e => setUserUsername(e.target.value)} /></div>
              <div><Label>Email</Label><Input value={userEmail} onChange={e => setUserEmail(e.target.value)} /></div>
              <div><Label>Jelszó</Label><Input type="password" value={userPassword} onChange={e => setUserPassword(e.target.value)} /></div>
              <div>
                <Label>Cég</Label>
                <Select value={selectedUserCompany} onValueChange={setSelectedUserCompany}>
                  <SelectTrigger><SelectValue placeholder="Válassz céget" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nincs cég</SelectItem>
                    {companies.map(c => <SelectItem key={c.id} value={c.documentId || c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Szerepkör</Label>
                <Select value={userRole?.toString()} onValueChange={v => setUserRole(parseInt(v))}>
                  <SelectTrigger><SelectValue placeholder="Válassz szerepkört" /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r: any) => <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={editingUser ? handleUserUpdate : handleUserCreate}>Mentés</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Fénykép kategóriák kezelése */}
        {can('settings', 'manage_photo_categories') && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle className="flex gap-2"><FolderTree className="h-5 w-5" /> Fénykép kategóriák</CardTitle>
                <Button onClick={() => { setIsCategoryDialogOpen(true); setEditingCategory(null); }}><Plus className="h-4 w-4 mr-2" /> Új kategória</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Név</TableHead><TableHead>Kötelező</TableHead><TableHead>Műveletek</TableHead></TableRow></TableHeader>
                <TableBody>
                  {categories.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.required ? 'Igen' : 'Nem'}</TableCell>
                      <TableCell className="text-right">
                        {!c.required && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => { setEditingCategory(c); setCategoryName(c.name); setCategoryRequired(c.required || false); setIsCategoryDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleCategoryDelete(c)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Category Dialog */}
        <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingCategory ? 'Szerkesztés' : 'Új kategória'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Név</Label><Input value={categoryName} onChange={e => setCategoryName(e.target.value)} /></div>
              <div className="flex items-center gap-2"><Checkbox checked={categoryRequired} onCheckedChange={c => setCategoryRequired(c === true)} id="req" /><Label htmlFor="req">Kötelező</Label></div>
            </div>
            <DialogFooter><Button onClick={editingCategory ? handleCategoryUpdate : handleCategoryCreate}>Mentés</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Anyagtípusok kezelése */}
        {can('settings', 'manage_materials') && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle className="flex gap-2"><Package className="h-5 w-5" /> Anyagtípusok</CardTitle>
                <Button onClick={() => { setIsMaterialDialogOpen(true); setEditingMaterial(null); }}><Plus className="h-4 w-4 mr-2" /> Új anyag</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Név</TableHead><TableHead>Kategória</TableHead><TableHead>Műveletek</TableHead></TableRow></TableHeader>
                <TableBody>
                  {materials.map(m => (
                    <TableRow key={m.id}>
                      <TableCell>{m.name}</TableCell>
                      <TableCell>{materialCategoryLabels[m.category as Material['category']]}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingMaterial(m); setMaterialName(m.name); setIsMaterialDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleMaterialDelete(m)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Material Dialog */}
        <Dialog open={isMaterialDialogOpen} onOpenChange={setIsMaterialDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingMaterial ? 'Szerkesztés' : 'Új anyag'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Név</Label><Input value={materialName} onChange={e => setMaterialName(e.target.value)} /></div>
              <div>
                <Label>Kategória</Label>
                <Select value={materialCategory} onValueChange={(v: any) => setMaterialCategory(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="insulation">Szigetelőanyag</SelectItem>
                    <SelectItem value="vapor_barrier">Párazáró fólia</SelectItem>
                    <SelectItem value="breathable_membrane">Légáteresztő fólia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {materialCategory === 'insulation' && (
                <div>
                  <Label>Vastagság</Label>
                  <Select value={materialThickness || ''} onValueChange={(v: any) => setMaterialThickness(v)}>
                    <SelectTrigger><SelectValue placeholder="Válassz" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cm10">10 cm</SelectItem>
                      <SelectItem value="cm12_5">12.5 cm</SelectItem>
                      <SelectItem value="cm15">15 cm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>m²/tekercs</Label><Input type="number" value={materialCoverage} onChange={e => setMaterialCoverage(e.target.value)} /></div>
              {materialCategory === 'insulation' && <div><Label>Tekercs/raklap</Label><Input type="number" value={materialRollsPerPallet} onChange={e => setMaterialRollsPerPallet(e.target.value)} /></div>}
            </div>
            <DialogFooter><Button onClick={editingMaterial ? handleMaterialUpdate : handleMaterialCreate}>Mentés</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Jogosultságok kezelése */}
        {isAdmin && (
          <div className="mb-6">
            <PermissionMatrix />
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
