'use client';

import { useState, useMemo } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth';
import { materialsApi, type Material } from '@/lib/api/materials';
import { materialBalancesApi, type MaterialBalance } from '@/lib/api/material-balances';
import { projectsApi } from '@/lib/api/projects';
import { calculateMaterials, formatInsulationQuantity, formatFoilQuantity } from '@/lib/utils/material-calculation';
import type { Project } from '@/types';
import { Plus, AlertTriangle, CheckCircle2, TrendingDown, Package, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function MaterialsPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [isPickupDialogOpen, setIsPickupDialogOpen] = useState(false);
  const [requirementsPeriod, setRequirementsPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [pickupDate, setPickupDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [pickupPallets, setPickupPallets] = useState('');
  const [pickupRolls, setPickupRolls] = useState('');

  const userId = user?.documentId || user?.id;

  // Anyagok lekérése
  const { data: materials = [] } = useQuery({
    queryKey: ['materials'],
    queryFn: () => materialsApi.getAll(),
  });

  // Anyagegyenlegek lekérése (jelenlegi felhasználó)
  const { data: balances = [], isLoading: balancesLoading } = useQuery({
    queryKey: ['material-balances', userId],
    queryFn: () => materialBalancesApi.getByUser(userId!),
    enabled: !!userId,
  });

  // Projektek lekérése (anyagigény számításhoz)
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll(),
  });

  // Anyagigény számítás a kiválasztott időszakra
  const materialRequirements = useMemo(() => {
    if (!projects.length) return null;

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (requirementsPeriod) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay() + 1); // Hétfő
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // Vasárnap
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
    }

    // Projektek szűrése időszakra és státuszra
    const relevantProjects = projects.filter((p: Project) => {
      if (!p.scheduled_date) return false;
      const scheduledDate = new Date(p.scheduled_date);
      return scheduledDate >= startDate && scheduledDate <= endDate && p.status !== 'completed';
    });

    // Összesített anyagigény számítás
    let totalInsulationRolls = 0;
    let totalVaporBarrierRolls = 0;
    let totalBreathableMembraneRolls = 0;
    let totalArea = 0;

    relevantProjects.forEach((p: Project) => {
      if (!p.area_sqm || !p.insulation_option) return;
      
      totalArea += Number(p.area_sqm);
      const req = calculateMaterials(Number(p.area_sqm), p.insulation_option);
      
      totalInsulationRolls += req.insulation.total_rolls;
      totalVaporBarrierRolls += req.vapor_barrier.rolls;
      totalBreathableMembraneRolls += req.breathable_membrane.rolls;
    });

    const totalInsulationPallets = Math.ceil(totalInsulationRolls / 24);
    const remainingInsulationRolls = totalInsulationRolls % 24;

    return {
      period: requirementsPeriod,
      projectCount: relevantProjects.length,
      totalArea,
      insulation: {
        total_rolls: totalInsulationRolls,
        total_pallets: totalInsulationPallets,
        remaining_rolls: remainingInsulationRolls,
      },
      vapor_barrier: {
        rolls: totalVaporBarrierRolls,
      },
      breathable_membrane: {
        rolls: totalBreathableMembraneRolls,
      },
    };
  }, [projects, requirementsPeriod]);

  // Anyagfelvétel form submit (jelenleg még nincs API endpoint, csak placeholder)
  const pickupMutation = useMutation({
    mutationFn: async (data: any) => {
      // TODO: Implement material transaction API call
      console.log('Material pickup:', data);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-balances'] });
      setIsPickupDialogOpen(false);
      setSelectedMaterial('');
      setPickupPallets('');
      setPickupRolls('');
    },
  });

  const handlePickupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial || (!pickupPallets && !pickupRolls)) return;
    
    pickupMutation.mutate({
      material: selectedMaterial,
      pickup_date: pickupDate,
      quantity_pallets: pickupPallets ? parseInt(pickupPallets) : 0,
      quantity_rolls: pickupRolls ? parseInt(pickupRolls) : 0,
    });
  };

  // Anyagegyenlegek kategorizálása
  const balancesByCategory = useMemo(() => {
    const categories: Record<string, MaterialBalance[]> = {
      insulation: [],
      vapor_barrier: [],
      breathable_membrane: [],
    };

    balances.forEach((balance) => {
      const category = balance.material?.category || 'unknown';
      if (category in categories) {
        categories[category].push(balance);
      }
    });

    return categories;
  }, [balances]);

  // Riasztások (negatív egyenleg)
  const deficits = useMemo(() => {
    return balances.filter((b) => {
      const balance = b.balance || {};
      const pallets = balance.pallets || 0;
      const rolls = balance.rolls || 0;
      return pallets < 0 || rolls < 0;
    });
  }, [balances]);

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-3xl font-bold">Anyagok</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Kezelje a szigetelőanyagokat és készleteket
              </p>
            </div>
            <Button onClick={() => setIsPickupDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Anyag felvétel
            </Button>
          </div>
        </div>

        {/* Riasztások */}
        {deficits.length > 0 && (
          <Card className="mb-6 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20">
            <CardHeader>
              <CardTitle className="flex items-center text-red-700 dark:text-red-400">
                <AlertTriangle className="mr-2 h-5 w-5" />
                Anyag hiány figyelmeztetés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {deficits.map((balance) => (
                  <div key={balance.id || balance.documentId} className="text-sm">
                    <span className="font-medium">{balance.material?.name || 'Ismeretlen anyag'}:</span>
                    {' '}
                    <span className="text-red-600 dark:text-red-400">
                      Hiány: {balance.balance?.pallets ? `${balance.balance.pallets} raklap` : ''}
                      {balance.balance?.rolls ? `, ${balance.balance.rolls} tekercs` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Anyagegyenlegek */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-4">Anyagegyenlegem</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {balancesByCategory.insulation.map((balance) => {
              const pickedUp = balance.total_picked_up || {};
              const used = balance.total_used || {};
              const bal = balance.balance || {};
              const status = balance.status || 'balanced';

              return (
                <Card
                  key={balance.id || balance.documentId}
                  className={status === 'deficit' ? 'border-red-200 dark:border-red-900' : ''}
                >
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Package className="mr-2 h-5 w-5" />
                      {balance.material?.name || 'Szigetelőanyag'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm">
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-600 dark:text-gray-400">Felvéve:</span>
                        <span>{formatInsulationQuantity(pickedUp.pallets || 0, pickedUp.rolls || 0)}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-600 dark:text-gray-400">Bedolgozva:</span>
                        <span>{formatInsulationQuantity(used.pallets || 0, used.rolls || 0)}</span>
                      </div>
                      <div className="flex justify-between font-semibold pt-2 border-t">
                        <span>Egyenleg:</span>
                        <span
                          className={
                            status === 'deficit'
                              ? 'text-red-600 dark:text-red-400'
                              : status === 'surplus'
                              ? 'text-green-600 dark:text-green-400'
                              : ''
                          }
                        >
                          {formatInsulationQuantity(bal.pallets || 0, bal.rolls || 0)}
                        </span>
                      </div>
                    </div>
                    {status === 'deficit' && (
                      <div className="flex items-center text-sm text-red-600 dark:text-red-400">
                        <TrendingDown className="mr-1 h-4 w-4" />
                        Hiány - Kérj utánpótlást!
                      </div>
                    )}
                    {status === 'surplus' && (
                      <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Többlet
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {balancesByCategory.vapor_barrier.map((balance) => {
              const pickedUp = balance.total_picked_up || {};
              const used = balance.total_used || {};
              const bal = balance.balance || {};
              const status = balance.status || 'balanced';

              return (
                <Card
                  key={balance.id || balance.documentId}
                  className={status === 'deficit' ? 'border-red-200 dark:border-red-900' : ''}
                >
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Package className="mr-2 h-5 w-5" />
                      {balance.material?.name || 'Párazáró fólia'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm">
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-600 dark:text-gray-400">Felvéve:</span>
                        <span>{formatFoilQuantity(pickedUp.rolls || 0)}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-600 dark:text-gray-400">Bedolgozva:</span>
                        <span>{formatFoilQuantity(used.rolls || 0)}</span>
                      </div>
                      <div className="flex justify-between font-semibold pt-2 border-t">
                        <span>Egyenleg:</span>
                        <span
                          className={
                            status === 'deficit'
                              ? 'text-red-600 dark:text-red-400'
                              : status === 'surplus'
                              ? 'text-green-600 dark:text-green-400'
                              : ''
                          }
                        >
                          {formatFoilQuantity(bal.rolls || 0)}
                        </span>
                      </div>
                    </div>
                    {status === 'deficit' && (
                      <div className="flex items-center text-sm text-red-600 dark:text-red-400">
                        <TrendingDown className="mr-1 h-4 w-4" />
                        Hiány - Kérj utánpótlást!
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {balancesByCategory.breathable_membrane.map((balance) => {
              const pickedUp = balance.total_picked_up || {};
              const used = balance.total_used || {};
              const bal = balance.balance || {};
              const status = balance.status || 'balanced';

              return (
                <Card
                  key={balance.id || balance.documentId}
                  className={status === 'deficit' ? 'border-red-200 dark:border-red-900' : ''}
                >
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Package className="mr-2 h-5 w-5" />
                      {balance.material?.name || 'Légáteresztő fólia'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm">
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-600 dark:text-gray-400">Felvéve:</span>
                        <span>{formatFoilQuantity(pickedUp.rolls || 0)}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-600 dark:text-gray-400">Bedolgozva:</span>
                        <span>{formatFoilQuantity(used.rolls || 0)}</span>
                      </div>
                      <div className="flex justify-between font-semibold pt-2 border-t">
                        <span>Egyenleg:</span>
                        <span
                          className={
                            status === 'deficit'
                              ? 'text-red-600 dark:text-red-400'
                              : status === 'surplus'
                              ? 'text-green-600 dark:text-green-400'
                              : ''
                          }
                        >
                          {formatFoilQuantity(bal.rolls || 0)}
                        </span>
                      </div>
                    </div>
                    {status === 'deficit' && (
                      <div className="flex items-center text-sm text-red-600 dark:text-red-400">
                        <TrendingDown className="mr-1 h-4 w-4" />
                        Hiány - Kérj utánpótlást!
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {balances.length === 0 && !balancesLoading && (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-gray-500">
                  Még nincs anyagegyenleg adat.
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Anyagigény számítás */}
        {materialRequirements && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Anyagigény
              </h3>
              <Select value={requirementsPeriod} onValueChange={(v: 'day' | 'week' | 'month') => setRequirementsPeriod(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Ma</SelectItem>
                  <SelectItem value="week">Ez a hét</SelectItem>
                  <SelectItem value="month">Ez a hónap</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>
                  {requirementsPeriod === 'day' && 'Mai'}
                  {requirementsPeriod === 'week' && 'Heti'}
                  {requirementsPeriod === 'month' && 'Havi'} anyagigény
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm">
                    <span className="font-medium">Projektek száma:</span> {materialRequirements.projectCount}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Összes terület:</span> {materialRequirements.totalArea.toFixed(0)} m²
                  </div>
                  <div className="pt-2 border-t space-y-2">
                    <div>
                      <span className="font-medium">Szigetelőanyag:</span>{' '}
                      {formatInsulationQuantity(
                        materialRequirements.insulation.total_pallets,
                        materialRequirements.insulation.remaining_rolls
                      )}
                    </div>
                    <div>
                      <span className="font-medium">Párazáró fólia:</span>{' '}
                      {formatFoilQuantity(materialRequirements.vapor_barrier.rolls)}
                    </div>
                    <div>
                      <span className="font-medium">Légáteresztő fólia:</span>{' '}
                      {formatFoilQuantity(materialRequirements.breathable_membrane.rolls)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Anyagfelvétel dialog */}
        <Dialog open={isPickupDialogOpen} onOpenChange={setIsPickupDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Anyag felvétel</DialogTitle>
              <DialogDescription>
                Rögzítse a felvett anyag mennyiségét.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePickupSubmit}>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="pickup-date">Felvétel dátuma</Label>
                  <Input
                    id="pickup-date"
                    type="date"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="material">Anyag típus</Label>
                  <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                    <SelectTrigger>
                      <SelectValue placeholder="Válasszon anyagot" />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map((material) => (
                        <SelectItem key={material.id || material.documentId} value={String(material.id || material.documentId)}>
                          {material.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedMaterial && materials.find((m) => String(m.id || m.documentId) === selectedMaterial)?.category === 'insulation' && (
                  <>
                    <div>
                      <Label htmlFor="pallets">Raklapok száma</Label>
                      <Input
                        id="pallets"
                        type="number"
                        min="0"
                        value={pickupPallets}
                        onChange={(e) => setPickupPallets(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="rolls">Tekercsek száma</Label>
                      <Input
                        id="rolls"
                        type="number"
                        min="0"
                        value={pickupRolls}
                        onChange={(e) => setPickupRolls(e.target.value)}
                      />
                    </div>
                  </>
                )}
                {selectedMaterial && materials.find((m) => String(m.id || m.documentId) === selectedMaterial)?.category !== 'insulation' && (
                  <div>
                    <Label htmlFor="rolls">Tekercsek száma</Label>
                    <Input
                      id="rolls"
                      type="number"
                      min="0"
                      value={pickupRolls}
                      onChange={(e) => setPickupRolls(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPickupDialogOpen(false)}>
                  Mégse
                </Button>
                <Button type="submit" disabled={pickupMutation.isPending}>
                  {pickupMutation.isPending ? 'Mentés...' : 'Mentés'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
