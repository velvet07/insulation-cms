'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { can } = usePermission();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<string | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [companyDeleteMode, setCompanyDeleteMode] = useState<'delete' | 'deactivate' | null>(null);

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
  const [userPasswordConfirm, setUserPasswordConfirm] = useState('');
  const [userPasswordError, setUserPasswordError] = useState('');
  const [selectedUserCompany, setSelectedUserCompany] = useState<string>('');
  const [userRole, setUserRole] = useState<number | undefined>(undefined);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

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
    queryKey: ['companies', 'settings', isAdmin ? 'admin' : userCompanyId],
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
    enabled: !!user && (isAdmin || !!userCompany),
    staleTime: 1000 * 60 * 5, // 5 minutes - avoid refetch on every focus
    refetchOnWindowFocus: false,
  });

  const { data: mainContractors = [] } = useQuery({
    queryKey: ['companies', 'main_contractors'],
    queryFn: () => companiesApi.getAll({ type: 'main_contractor' }),
    enabled: isAdmin,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const { data: categories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['photo-categories'],
    queryFn: () => photoCategoriesApi.getAll(),
    enabled: can('settings', 'manage_photo_categories'),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const { data: materials = [], isLoading: isLoadingMaterials } = useQuery({
    queryKey: ['materials'],
    queryFn: () => materialsApi.getAll(),
    enabled: can('settings', 'manage_materials'),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users', 'settings', isAdmin ? 'admin' : userCompanyId, companies.length],
    queryFn: async () => {
      if (isAdmin) {
        return await usersApi.getAll();
      }
      if (!userCompany) return [];
      const ownCompanyId = userCompany.id;
      if (isMainContractor) {
        const companyIds = [ownCompanyId, ...companies.map(c => c.id)].filter((id, index, self) => self.indexOf(id) === index);
        const companyUsers = await usersApi.getAll({ company: companyIds });
        return Array.from(new Map(companyUsers.map(u => [u.id, u])).values());
      } else {
        const ownUsers = await usersApi.getAll({ company: ownCompanyId });
        return Array.from(new Map(ownUsers.map(u => [u.id, u])).values());
      }
    },
    enabled: !!user && (isAdmin || !!userCompany) && companies.length > 0,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const visibleUsers = useMemo(() => {
    if (isAdmin) return users;
    return users.filter((userItem) => !!userItem.company);
  }, [users, isAdmin]);

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
    enabled: can('settings', 'manage_users'),
    staleTime: 1000 * 60 * 10, // 10 minutes - roles rarely change
    refetchOnWindowFocus: false,
  });

  const roles = rolesData?.roles || [];
  const authenticatedRoleId = useMemo(() => {
    const role = roles.find((r: any) => {
      const type = ((r?.type ?? '') as string).toLowerCase();
      const name = ((r?.name ?? '') as string).toLowerCase();
      return type === 'authenticated' || name === 'authenticated';
    });
    const rawId = (role as any)?.id;
    const n = typeof rawId === 'number' ? rawId : Number(rawId);
    return Number.isFinite(n) ? n : undefined;
  }, [roles]);

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

  const deactivateCompanyMutation = useMutation({
    mutationFn: (id: string) => companiesApi.update(id, { is_active: false }),
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
      setMaterialCategory('insulation');
      setMaterialThickness(undefined);
      setMaterialCoverage('');
      setMaterialRollsPerPallet('24');
    },
  });

  const updateMaterialMutation = useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: Partial<Material> }) => materialsApi.update(id, data),
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
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: (id: number | string) => materialsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['materials'] }),
  });

  const inviteUserMutation = useMutation({
    mutationFn: (data: { username: string; email: string; company?: string | null; role?: number }) =>
      usersApi.invite({
        username: data.username,
        email: data.email,
        company: data.company === 'none' || !data.company ? null : data.company,
        role: data.role,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsUserDialogOpen(false);
      setEditingUser(null);
      setUserUsername('');
      setUserEmail('');
      setUserPassword('');
      setUserPasswordConfirm('');
      setUserPasswordError('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? err?.response?.data?.message ?? err?.message;
      setUserPasswordError(typeof msg === 'string' ? msg : 'Meghívó küldése sikertelen');
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
      setUserPasswordConfirm('');
      setUserPasswordError('');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string | number) => usersApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  // Only Admin can choose role; others default to "Authenticated" for new users.
  useEffect(() => {
    if (!isUserDialogOpen) return;
    if (isAdmin) return;
    if (editingUser) return; // only apply default on create
    if (!authenticatedRoleId) return;
    if (userRole === authenticatedRoleId) return;
    setUserRole(authenticatedRoleId);
  }, [isUserDialogOpen, isAdmin, editingUser, authenticatedRoleId, userRole]);

  const validateUserPassword = (isCreating: boolean) => {
    if (!userPassword && !userPasswordConfirm) {
      if (isCreating) {
        setUserPasswordError('A jelszó kötelező');
        return false;
      }
      setUserPasswordError('');
      return true;
    }
    if (!userPassword || !userPasswordConfirm) {
      setUserPasswordError('A jelszót kétszer kell megadni');
      return false;
    }
    if (userPassword !== userPasswordConfirm) {
      setUserPasswordError('A jelszavak nem egyeznek');
      return false;
    }
    setUserPasswordError('');
    return true;
  };

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

  const handleDeleteRequest = (company: Company) => {
    const companyId = (company.documentId || company.id?.toString() || '').toString();
    const ownCompanyId = (userCompany?.documentId || userCompany?.id?.toString() || '').toString();
    const isOwnMainContractor = company.type === 'main_contractor' && companyId && ownCompanyId && companyId === ownCompanyId;

    if (isOwnMainContractor) {
      alert('Saját cég nem törölhető');
      return;
    }

    setCompanyDeleteMode(company.type === 'subcontractor' ? 'deactivate' : 'delete');
    setCompanyToDelete(company);
  };

  const handleCompanyDeleteConfirm = () => {
    if (!companyToDelete || !companyDeleteMode) return;
    const identifier = (companyToDelete.documentId || companyToDelete.id?.toString() || '').toString();
    if (!identifier) return;

    if (companyDeleteMode === 'deactivate') {
      deactivateCompanyMutation.mutate(identifier);
    } else {
      deleteMutation.mutate(identifier);
    }

    setCompanyToDelete(null);
    setCompanyDeleteMode(null);
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
    if (!userUsername.trim()) {
      setUserPasswordError('A felhasználónév kötelező');
      return;
    }
    if (userUsername.trim().length < 3) {
      setUserPasswordError('A felhasználónév legalább 3 karakter');
      return;
    }
    if (!userEmail.trim()) {
      setUserPasswordError('Az e-mail cím kötelező');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim())) {
      setUserPasswordError('Érvényes e-mail cím szükséges');
      return;
    }
    setUserPasswordError('');
    const roleToSend = isAdmin ? userRole : authenticatedRoleId;
    const payload: any = {
      username: userUsername.trim(),
      email: userEmail.trim(),
      company: selectedUserCompany === 'none' ? null : selectedUserCompany || null,
    };
    if (roleToSend !== undefined) payload.role = roleToSend;
    inviteUserMutation.mutate(payload);
  };

  const handleUserUpdate = () => {
    if (!editingUser) return;
    if (!validateUserPassword(false)) return;
    const data: any = { username: userUsername, email: userEmail, company: selectedUserCompany || null };
    // Admin can update role
    if (isAdmin && userRole !== undefined) {
      data.role = userRole;
    }
    if (userPassword) {
      data.password = userPassword;
      // If user is not confirmed and we're setting a password, confirm them
      if (!editingUser.confirmed) {
        data.confirmed = true;
      }
    }
    updateUserMutation.mutate({ id: editingUser.id!, data });
  };

  const handleUserDelete = (userItem: User) => {
    if (userItem?.id === user?.id) {
      alert('Saját felhasználó nem törölhető');
      return;
    }
    deleteUserMutation.mutate(userItem.id!);
  };

  const handleUserDeleteConfirm = () => {
    if (!userToDelete) return;
    handleUserDelete(userToDelete);
    setUserToDelete(null);
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
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={company.type === 'main_contractor' && (company.documentId || company.id?.toString())?.toString() === (userCompany?.documentId || userCompany?.id?.toString())?.toString()}
                          title={company.type === 'subcontractor' ? 'Inaktiválás' : 'Törlés'}
                          onClick={() => handleDeleteRequest(company)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
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
                <div className="flex gap-2">
                  {isAdmin && (
                    <Button variant="outline" onClick={() => router.push('/create-user')}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Regisztráció oldal
                    </Button>
                  )}
                  {can('settings', 'manage_users') && (
                    <Button onClick={() => { setIsUserDialogOpen(true); setEditingUser(null); setUserUsername(''); setUserEmail(''); setUserPassword(''); setUserPasswordConfirm(''); setUserPasswordError(''); setSelectedUserCompany(''); setUserRole(undefined); }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Új felhasználó
                    </Button>
                  )}
                </div>
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
                    {isAdmin && <TableHead>Szerepkör</TableHead>}
                    <TableHead>Műveletek</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleUsers.map((userItem) => (
                    <TableRow key={userItem.id}>
                      <TableCell>{userItem.username}</TableCell>
                      <TableCell>{userItem.email}</TableCell>
                      <TableCell>{(userItem.company as any)?.name || '-'}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          {typeof userItem.role === 'object' && userItem.role !== null 
                            ? (userItem.role as any)?.name || '-'
                            : '-'}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        {can('settings', 'manage_users') && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => { setEditingUser(userItem); setUserUsername(userItem.username || ''); setUserEmail(userItem.email); setSelectedUserCompany((userItem.company as any)?.documentId || (userItem.company as any)?.id?.toString() || ''); setUserRole(typeof userItem.role === 'object' ? (userItem.role as any)?.id : undefined); setUserPassword(''); setUserPasswordConfirm(''); setUserPasswordError(''); setIsUserDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" disabled={userItem.id === user?.id} title={userItem.id === user?.id ? 'Saját felhasználó nem törölhető' : 'Törlés'} onClick={() => setUserToDelete(userItem)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
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
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Szerkesztés' : 'Új felhasználó'}</DialogTitle>
              <DialogDescription>
                {editingUser ? 'Felhasználó adatainak módosítása' : 'Új felhasználó meghívása e-mailben'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Felhasználónév</Label><Input value={userUsername} onChange={e => setUserUsername(e.target.value)} placeholder="Min. 3 karakter" /></div>
              <div><Label>Email</Label><Input type="email" value={userEmail} onChange={e => setUserEmail(e.target.value)} placeholder="email@example.com" /></div>
              {editingUser && (
                <>
                  <div><Label>Jelszó (üresen hagyva nem változik)</Label><Input type="password" value={userPassword} onChange={e => { setUserPassword(e.target.value); if (userPasswordError) setUserPasswordError(''); }} /></div>
                  <div><Label>Jelszó megerősítése</Label><Input type="password" value={userPasswordConfirm} onChange={e => { setUserPasswordConfirm(e.target.value); if (userPasswordError) setUserPasswordError(''); }} /></div>
                </>
              )}
              {!editingUser && (
                <p className="text-sm text-muted-foreground">Meghívót kapsz e-mailben. A linkre kattintva erősítsd meg az e-mail címedet, majd állítsd be a jelszavadat.</p>
              )}
              {userPasswordError && <p className="text-xs text-red-500">{userPasswordError}</p>}
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
              {isAdmin && (
                <div>
                  <Label>Szerepkör</Label>
                  <Select value={userRole?.toString() || ''} onValueChange={(v) => setUserRole(parseInt(v))}>
                    <SelectTrigger><SelectValue placeholder="Válassz szerepkört" /></SelectTrigger>
                    <SelectContent>
                      {roles.map((r: any) => <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {editingUser && editingUser.id === user?.id && (
                    <p className="text-xs text-gray-500 mt-1">Saját szerepkör módosítása</p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              {editingUser && !editingUser.confirmed && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!editingUser?.id) return;
                    usersApi.resendConfirmation(editingUser.id)
                      .then(() => {
                        alert('Megerősítő e-mail újraküldve');
                        setIsUserDialogOpen(false);
                        setEditingUser(null);
                      })
                      .catch((err) => {
                        alert(err?.response?.data?.error?.message || 'Hiba történt az e-mail újraküldése során');
                      });
                  }}
                >
                  Meghívó újraküldése
                </Button>
              )}
              <Button
                onClick={editingUser ? handleUserUpdate : handleUserCreate}
                disabled={inviteUserMutation.isPending || updateUserMutation.isPending}
              >
                {(inviteUserMutation.isPending || updateUserMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {editingUser ? 'Mentés' : 'Meghívó küldése'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!userToDelete} onOpenChange={(open) => { if (!open) setUserToDelete(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Felhasználó törlése</DialogTitle>
              <DialogDescription>Biztosan törölni szeretnéd ezt a felhasználót?</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUserToDelete(null)}>Mégse</Button>
              <Button variant="destructive" onClick={handleUserDeleteConfirm}>Törlés</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!companyToDelete} onOpenChange={(open) => { if (!open) { setCompanyToDelete(null); setCompanyDeleteMode(null); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{companyDeleteMode === 'deactivate' ? 'Alvállalkozó inaktiválása' : 'Cég törlése'}</DialogTitle>
              <DialogDescription>
                {companyDeleteMode === 'deactivate'
                  ? 'Biztosan inaktiválni szeretnéd ezt az alvállalkozót?'
                  : 'Biztosan törölni szeretnéd ezt a céget?'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCompanyToDelete(null); setCompanyDeleteMode(null); }}>Mégse</Button>
              <Button variant="destructive" onClick={handleCompanyDeleteConfirm}>
                {companyDeleteMode === 'deactivate' ? 'Inaktiválás' : 'Törlés'}
              </Button>
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
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Szerkesztés' : 'Új kategória'}</DialogTitle>
              <DialogDescription>
                {editingCategory ? 'Fénykép kategória módosítása' : 'Új fénykép kategória létrehozása'}
              </DialogDescription>
            </DialogHeader>
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
                <Button onClick={() => { 
                  setIsMaterialDialogOpen(true); 
                  setEditingMaterial(null);
                  setMaterialName('');
                  setMaterialCategory('insulation');
                  setMaterialThickness(undefined);
                  setMaterialCoverage('');
                  setMaterialRollsPerPallet('24');
                }}><Plus className="h-4 w-4 mr-2" /> Új anyag</Button>
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
                        <Button variant="ghost" size="sm" onClick={() => { 
                          setEditingMaterial(m); 
                          setMaterialName(m.name);
                          setMaterialCategory(m.category);
                          setMaterialThickness(m.thickness_cm);
                          setMaterialCoverage(m.coverage_per_roll?.toString() || '');
                          setMaterialRollsPerPallet(m.rolls_per_pallet?.toString() || '24');
                          setIsMaterialDialogOpen(true); 
                        }}><Edit className="h-4 w-4" /></Button>
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
            <DialogHeader>
              <DialogTitle>{editingMaterial ? 'Szerkesztés' : 'Új anyag'}</DialogTitle>
              <DialogDescription>
                {editingMaterial ? 'Anyag adatainak módosítása' : 'Új anyagtípus létrehozása'}
              </DialogDescription>
            </DialogHeader>
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
