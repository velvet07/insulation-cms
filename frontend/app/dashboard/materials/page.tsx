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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth';
import { materialsApi } from '@/lib/api/materials';
import { materialBalancesApi, type MaterialBalance } from '@/lib/api/material-balances';
import { materialTransactionsApi } from '@/lib/api/material-transactions';
import { projectsApi } from '@/lib/api/projects';
import { 
  calculateMaterials, 
  formatInsulationQuantity, 
  formatFoilQuantity,
  calculateAvailableMaterials,
  determineInsulationOption,
  type AvailableMaterial,
} from '@/lib/utils/material-calculation';
import type { Project } from '@/types';
import { Plus, AlertTriangle, CheckCircle2, TrendingDown, Package, Calendar, CalendarDays, List, Edit, Trash2 } from 'lucide-react';
import { createAuditLogEntry, addAuditLogEntry } from '@/lib/utils/audit-log';
import { isAdminRole } from '@/lib/utils/user-role';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type RequirementsPeriod = 'today' | 'tomorrow' | 'week' | 'two-weeks' | 'month' | 'custom';

export default function MaterialsPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [isPickupDialogOpen, setIsPickupDialogOpen] = useState(false);
  const [requirementsPeriod, setRequirementsPeriod] = useState<RequirementsPeriod>('week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  // Elérhető anyagok kezelése (checklist + end date)
  const [availableMaterialsIds, setAvailableMaterialsIds] = useState<string[]>([]);
  const [availabilityEndDate, setAvailabilityEndDate] = useState('');
  const [isAvailableMaterialsDialogOpen, setIsAvailableMaterialsDialogOpen] = useState(false);
  const [pickupDate, setPickupDate] = useState(new Date().toISOString().split('T')[0]);
  // Táblázatos anyagfelvétel: minden anyaghoz külön mennyiség
  const [pickupQuantities, setPickupQuantities] = useState<Record<string, { pallets: string; rolls: string }>>({});
  // Tranzakció szerkesztés/törlés
  const [editingTransaction, setEditingTransaction] = useState<{ date: string; materialId: string } | null>(null);
  const [editTransactionData, setEditTransactionData] = useState<{ pallets: string; rolls: string } | null>(null);
  
  // Helyi log a törlések és módosítások tárolásához (localStorage-ban perzisztálva)
  type MaterialLogEntry = {
    id: string;
    timestamp: string;
    action: 'pickup' | 'modified' | 'deleted';
    materialName: string;
    quantity: { pallets?: number; rolls?: number };
    oldQuantity?: { pallets?: number; rolls?: number };
    user: string;
  };
  const [materialLog, setMaterialLog] = useState<MaterialLogEntry[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('materialMovementLog');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  
  const addLogEntry = (entry: Omit<MaterialLogEntry, 'id' | 'timestamp'>) => {
    const newEntry: MaterialLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };
    setMaterialLog((prev) => {
      const updated = [newEntry, ...prev].slice(0, 100); // Max 100 bejegyzés
      localStorage.setItem('materialMovementLog', JSON.stringify(updated));
      return updated;
    });
  };

  const userId = user?.documentId || user?.id;

  // Anyagok lekérése
  const { data: materials = [] } = useQuery({
    queryKey: ['materials'],
    queryFn: () => materialsApi.getAll(),
  });

  // Anyagegyenlegek lekérése (jelenlegi felhasználó)
  const { data: balances = [] } = useQuery({
    queryKey: ['material-balances', userId],
    queryFn: () => materialBalancesApi.getByUser(userId!),
    enabled: !!userId,
  });

  // Projektek lekérése (anyagigény számításhoz)
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll(),
  });

  // Material Transactions lekérése (elérhető anyagok számításhoz)
  const { data: transactions = [] } = useQuery({
    queryKey: ['material-transactions', userId],
    queryFn: () => materialTransactionsApi.getAll({ user: userId }),
    enabled: !!userId,
  });

  // Dátum tartomány számítása
  const dateRange = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const today = new Date(now);
    
    let startDate: Date;
    let endDate: Date;

    switch (requirementsPeriod) {
      case 'today':
        startDate = new Date(today);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'tomorrow':
        startDate = new Date(today);
        startDate.setDate(today.getDate() + 1);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        // Hétfő a hét első napja
        const dayOfWeek = now.getDay(); // 0 = vasárnap, 1 = hétfő, ..., 6 = szombat
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Hétfő eltolása
        startDate = new Date(now);
        startDate.setDate(now.getDate() + mondayOffset);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // Vasárnap
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'two-weeks':
        const weekDayOfWeek = now.getDay();
        const weekMondayOffset = weekDayOfWeek === 0 ? -6 : 1 - weekDayOfWeek;
        startDate = new Date(now);
        startDate.setDate(now.getDate() + weekMondayOffset);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 13); // 2 hét = 14 nap - 1
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        if (!customStartDate || !customEndDate) {
          return null;
        }
        startDate = new Date(customStartDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate = new Date(now);
        endDate = new Date(now);
    }

    return { startDate, endDate };
  }, [requirementsPeriod, customStartDate, customEndDate]);

  // Anyagigény számítás a kiválasztott időszakra
  const materialRequirements = useMemo(() => {
    // Ha nincs dateRange (custom esetén dátumok hiányában), adjunk vissza üres adatokat
    if (!dateRange) {
      return {
        period: requirementsPeriod,
        projectCount: 0,
        totalProjects: 0,
        projectsWithoutData: 0,
        projectsOptionA: 0,
        projectsOptionB: 0,
        projectsNoOption: 0,
        totalArea: 0,
        availableMaterials: [],
        insulation: {
          total_rolls: 0,
          total_pallets: 0,
          remaining_rolls: 0,
          optionA_rolls: 0,
          optionB_rolls: 0,
        },
        vapor_barrier: {
          rolls: 0,
        },
        breathable_membrane: {
          rolls: 0,
        },
      };
    }

    const { startDate, endDate } = dateRange;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Projektek szűrése időszakra és státuszra
    // Túllépett projekteket (scheduled_date < today és status !== 'completed') kihagyjuk
    const relevantProjects = (projects || []).filter((p: Project) => {
      if (!p.scheduled_date) return false;
      const scheduledDate = new Date(p.scheduled_date);
      scheduledDate.setHours(0, 0, 0, 0);

      // Ha túllépett a dátum és nincs completed státuszban, akkor kihagyjuk (elkészültként kezeljük)
      if (scheduledDate < today && p.status !== 'completed') {
        return false;
      }

      // Ha completed státuszban van, kihagyjuk
      if (p.status === 'completed') {
        return false;
      }

      return scheduledDate >= startDate && scheduledDate <= endDate;
    });

    // Elérhető anyagok számítása dátum alapján
    // Csak a kiválasztott anyagokat számoljuk
    const availabilityDate = availabilityEndDate 
      ? new Date(availabilityEndDate)
      : new Date(); // Ha nincs beállítva, akkor mai dátumig
    availabilityDate.setHours(23, 59, 59, 999);

    // Szűrjük a tranzakciókat a kiválasztott anyagokra
    const filteredTransactions = (transactions as any[]).filter((t) => {
      if (!t.material) return false;
      const materialId = String(t.material.documentId || t.material.id);
      return availableMaterialsIds.length === 0 || availableMaterialsIds.includes(materialId);
    });

    const availableMaterials = calculateAvailableMaterials(
      filteredTransactions,
      availabilityDate
    );

    // Összesített anyagigény számítás
    let totalInsulationRollsA = 0; // Opció A (10cm + 15cm)
    let totalInsulationRollsB = 0; // Opció B (12.5cm + 12.5cm)
    let totalVaporBarrierRolls = 0;
    let totalBreathableMembraneRolls = 0;
    let totalArea = 0;
    let projectsWithData = 0;
    let projectsOptionA = 0;
    let projectsOptionB = 0;
    let projectsNoOption = 0;

    relevantProjects.forEach((p: Project) => {
      // Csak azokat a projekteket számoljuk, amelyeknek van area_sqm értéke
      if (!p.area_sqm) return;
      
      projectsWithData++;
      const area = Number(p.area_sqm);
      totalArea += area;

      // Insulation option meghatározása elérhető anyagokból
      const insulationOptions = determineInsulationOption(availableMaterials, area);
      
      // Számoljuk az anyagigényt mindkét opcióhoz (függetlenül attól, hogy van-e elég anyag)
      const reqA = calculateMaterials(area, 'A');
      const reqB = calculateMaterials(area, 'B');
      
      // 10cm + 15cm számítás
      if (insulationOptions.optionA?.available) {
        projectsOptionA++;
        totalInsulationRollsA += reqA.insulation.total_rolls;
      } else {
        // Ha nincs elég anyag, akkor is számoljuk az igényt (de nem számítjuk bele a projektek számába)
        totalInsulationRollsA += reqA.insulation.total_rolls;
      }

      // 12.5cm + 12.5cm számítás
      if (insulationOptions.optionB?.available) {
        projectsOptionB++;
        totalInsulationRollsB += reqB.insulation.total_rolls;
      } else {
        // Ha nincs elég anyag, akkor is számoljuk az igényt (de nem számítjuk bele a projektek számába)
        totalInsulationRollsB += reqB.insulation.total_rolls;
      }

      if (!insulationOptions.optionA?.available && !insulationOptions.optionB?.available) {
        projectsNoOption++;
      }

      // Fóliák mindig ugyanazok (nem függnek az insulation_option-tól)
      totalVaporBarrierRolls += reqA.vapor_barrier.rolls;
      totalBreathableMembraneRolls += reqA.breathable_membrane.rolls;
    });

    // Összesített szigetelőanyag (a nagyobb opció alapján, vagy mindkettő)
    const totalInsulationRolls = Math.max(totalInsulationRollsA, totalInsulationRollsB);
    const totalInsulationPallets = Math.floor(totalInsulationRolls / 24);
    const remainingInsulationRolls = totalInsulationRolls % 24;

    // Projektek számolása, amelyeknek hiányzik az adat
    const projectsWithoutData = relevantProjects.length - projectsWithData;

    return {
      period: requirementsPeriod,
      projectCount: projectsWithData,
      totalProjects: relevantProjects.length,
      projectsWithoutData,
      projectsOptionA,
      projectsOptionB,
      projectsNoOption,
      totalArea,
      availableMaterials,
      insulation: {
        total_rolls: totalInsulationRolls,
        total_pallets: totalInsulationPallets,
        remaining_rolls: remainingInsulationRolls,
        optionA_rolls: totalInsulationRollsA,
        optionB_rolls: totalInsulationRollsB,
      },
      vapor_barrier: {
        rolls: totalVaporBarrierRolls,
      },
      breathable_membrane: {
        rolls: totalBreathableMembraneRolls,
      },
    };
  }, [projects, dateRange, requirementsPeriod, transactions, availabilityEndDate, availableMaterialsIds]);

  // Anyagfelvétel form submit (több anyag egyszerre)
  const pickupMutation = useMutation({
    mutationFn: async (data: Array<{ material: string; quantity_pallets: number; quantity_rolls: number; materialName?: string }>) => {
      // Több tranzakció létrehozása párhuzamosan
      const createdTransactions = await Promise.all(
        data.map((item) =>
          materialTransactionsApi.create({
            type: 'pickup',
            pickup_date: pickupDate,
            material: item.material,
            quantity_pallets: item.quantity_pallets || 0,
            quantity_rolls: item.quantity_rolls || 0,
            user: userId,
          })
        )
      );

      // Audit log hozzáadása minden projekthez
      try {
        const allProjects = await projectsApi.getAll();
        const auditLogEntry = createAuditLogEntry(
          'material_added',
          user,
          `Anyagfelvétel: ${data.map((d) => `${d.materialName || 'Ismeretlen'}: ${d.quantity_pallets || 0} raklap, ${d.quantity_rolls || 0} tekercs`).join(', ')} (${pickupDate})`
        );
        auditLogEntry.module = 'Anyaggazdálkodás';

        // Minden projekthez hozzáadjuk az audit log bejegyzést
        const updatePromises = allProjects.map((project: Project) => {
          const projectId = project.documentId || project.id;
          if (!projectId) {
            console.warn('Projekt ID hiányzik, audit log frissítés kihagyva');
            return Promise.resolve();
          }
          
          const updatedAuditLog = addAuditLogEntry(project.audit_log, auditLogEntry);
          return projectsApi.update(projectId, {
            audit_log: updatedAuditLog,
          }).catch((error: any) => {
            // Ha nincs audit_log mező, csak logoljuk
            if (error?.message?.includes('Invalid key audit_log') || 
                error?.response?.data?.error?.message?.includes('Invalid key audit_log')) {
              console.warn('audit_log mező nem létezik a projektben, audit log frissítés kihagyva');
            } else if (error?.response?.status === 404 || 
                       error?.message?.includes('404') || 
                       error?.message?.includes('nem található') ||
                       error?.message?.includes('Not Found')) {
              // Projekt nem található (lehet, hogy törölve lett) - csendben kihagyjuk
              // Nem logoljuk, mert ez normális esemény lehet
            } else {
              // Egyéb hiba
              console.warn(`Audit log frissítés hiba projektnél (ID: ${projectId}):`, error?.message || error);
            }
          });
        });
        await Promise.all(updatePromises);
      } catch (error) {
        console.warn('Audit log frissítés hiba (nem kritikus):', error);
      }

      return createdTransactions;
    },
    onSuccess: (_data, variables) => {
      // Helyi log hozzáadása minden anyaghoz
      variables.forEach((item) => {
        addLogEntry({
          action: 'pickup',
          materialName: item.materialName || 'Ismeretlen anyag',
          quantity: { pallets: item.quantity_pallets, rolls: item.quantity_rolls },
          user: user?.username || user?.email || 'Ismeretlen',
        });
      });
      
      queryClient.invalidateQueries({ queryKey: ['material-balances'] });
      queryClient.invalidateQueries({ queryKey: ['material-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsPickupDialogOpen(false);
      setPickupQuantities({});
    },
    onError: (error: any) => {
      console.error('Anyagfelvétel hiba:', error);
      alert(`Hiba történt az anyagfelvételek rögzítése során: ${error.message || 'Ismeretlen hiba'}`);
    },
  });

  const handlePickupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Szűrjük az elérhető anyagokat
    const availableMaterials = materials.filter(
      (m) => availableMaterialsIds.length === 0 || availableMaterialsIds.includes(String(m.documentId || m.id))
    );

    if (availableMaterials.length === 0) {
      alert('Nincs elérhető anyag!');
      return;
    }

    // Összegyűjtjük a kitöltött mennyiségeket
    const transactionsToCreate: Array<{ material: string; quantity_pallets: number; quantity_rolls: number; materialName?: string }> = [];

    availableMaterials.forEach((material) => {
      const materialId = String(material.documentId || material.id);
      const quantities = pickupQuantities[materialId] || { pallets: '', rolls: '' };
      const pallets = quantities.pallets ? parseInt(quantities.pallets) : 0;
      const rolls = quantities.rolls ? parseInt(quantities.rolls) : 0;

      // Validáció
      if (material.category === 'insulation') {
        if (pallets > 0 || rolls > 0) {
          transactionsToCreate.push({
            material: materialId,
            quantity_pallets: pallets,
            quantity_rolls: rolls,
            materialName: material.name,
          });
        }
      } else {
        // Fóliák
        if (rolls > 0) {
          transactionsToCreate.push({
            material: materialId,
            quantity_pallets: 0,
            quantity_rolls: rolls,
            materialName: material.name,
          });
        }
      }
    });

    if (transactionsToCreate.length === 0) {
      alert('Kérjük adjon meg legalább egy anyag mennyiségét!');
      return;
    }

    pickupMutation.mutate(transactionsToCreate);
  };

  // Riasztások (negatív egyenleg)
  const deficits = useMemo(() => {
    return balances.filter((b) => {
      const balance = b.balance || {};
      const pallets = balance.pallets || 0;
      const rolls = balance.rolls || 0;
      return pallets < 0 || rolls < 0;
    });
  }, [balances]);

  // Felvett anyagok összesítése anyagtípusra és dátumra
  const pickupTransactionsGrouped = useMemo(() => {
    const pickupTransactions = (transactions as any[]).filter((t) => t.type === 'pickup');
    
    // Csoportosítás dátumra és anyagra
    const grouped: Record<string, Record<string, { pallets: number; rolls: number; transactions: any[]; materialName: string }>> = {};
    
    pickupTransactions.forEach((transaction) => {
      const date = transaction.pickup_date 
        ? new Date(transaction.pickup_date).toISOString().split('T')[0]
        : transaction.createdAt
        ? new Date(transaction.createdAt).toISOString().split('T')[0]
        : 'unknown';
      
      const materialId = String(transaction.material?.documentId || transaction.material?.id || 'unknown');
      const materialName = transaction.material?.name || 'Ismeretlen anyag';
      
      if (!grouped[date]) {
        grouped[date] = {};
      }
      
      if (!grouped[date][materialId]) {
        grouped[date][materialId] = {
          pallets: 0,
          rolls: 0,
          transactions: [],
          materialName,
        };
      }
      
      grouped[date][materialId].pallets += transaction.quantity_pallets || 0;
      grouped[date][materialId].rolls += transaction.quantity_rolls || 0;
      grouped[date][materialId].transactions.push(transaction);
    });
    
    return grouped;
  }, [transactions]);

  // Anyagegyenleg számítás: felvett anyagok - kész/elmúlt projektek anyagigénye
  const calculatedBalance = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Felvett anyagok összesítése anyagtípusonként
    const pickedUp: Record<string, { pallets: number; rolls: number; name: string; category: string }> = {};
    
    (transactions as any[])
      .filter((t) => t.type === 'pickup')
      .forEach((t) => {
        const materialId = String(t.material?.documentId || t.material?.id || 'unknown');
        const materialName = t.material?.name || 'Ismeretlen anyag';
        const category = t.material?.category || 'unknown';
        
        if (!pickedUp[materialId]) {
          pickedUp[materialId] = { pallets: 0, rolls: 0, name: materialName, category };
        }
        pickedUp[materialId].pallets += t.quantity_pallets || 0;
        pickedUp[materialId].rolls += t.quantity_rolls || 0;
      });

    // 2. Kész vagy elmúlt projektek anyagigénye
    // Szigetelőanyagoknál: projektenként számolva, egész tekercsre kerekítve fel
    // Fóliáknál: m²-ben számolva (nem kerekítve projektenként), majd a végén konvertáljuk tekercsre
    const usedByProjects: Record<string, { totalRolls: number; pallets: number; rolls: number; squareMeters?: number; rollsPerPallet?: number }> = {};
    
    (projects as Project[]).forEach((p) => {
      if (!p.area_sqm) return;
      
      const scheduledDate = p.scheduled_date ? new Date(p.scheduled_date) : null;
      if (scheduledDate) scheduledDate.setHours(0, 0, 0, 0);
      
      // Levonás, ha:
      // 1. A projekt státusza "completed"
      // 2. VAGY az ütemezett dátum a múltban van (és nem completed)
      const shouldDeduct = p.status === 'completed' || (scheduledDate && scheduledDate < today);
      
      if (!shouldDeduct) return;
      
      const area = Number(p.area_sqm);
      
      // Szigetelő anyagigény - projektenként számolva, egész tekercsre kerekítve fel
      materials.forEach((m) => {
        const materialId = String(m.documentId || m.id);
        if (!usedByProjects[materialId]) {
          usedByProjects[materialId] = { totalRolls: 0, pallets: 0, rolls: 0, squareMeters: 0, rollsPerPallet: m.rolls_per_pallet || 24 };
        }
        
        if (m.category === 'insulation') {
          // Projektenként számolva, egész tekercsre kerekítve fel
          const rollsNeeded = Math.ceil(area / (m.coverage_per_roll || 9.24));
          usedByProjects[materialId].totalRolls += rollsNeeded;
        } else if (m.category === 'vapor_barrier') {
          // Párazáró fólia: m²-ben számolva (nem kerekítve projektenként)
          usedByProjects[materialId].squareMeters! += area;
        } else if (m.category === 'breathable_membrane') {
          // Légáteresztő fólia: m²-ben számolva (nem kerekítve projektenként)
          usedByProjects[materialId].squareMeters! += area;
        }
      });
    });
    
    // Szigetelőanyagoknál: konvertáljuk a tekercseket raklapokra és maradék tekercsekre
    // Fóliáknál: konvertáljuk a m²-t tekercsekre és maradék m²-re
    Object.keys(usedByProjects).forEach((materialId) => {
      const material = materials.find((m) => String(m.documentId || m.id) === materialId);
      if (material && material.category === 'insulation') {
        const totalRolls = usedByProjects[materialId].totalRolls;
        const rollsPerPallet = usedByProjects[materialId].rollsPerPallet || 24;
        usedByProjects[materialId].pallets = Math.floor(totalRolls / rollsPerPallet);
        usedByProjects[materialId].rolls = totalRolls % rollsPerPallet;
      } else if (material && (material.category === 'vapor_barrier' || material.category === 'breathable_membrane')) {
        // Fóliáknál: m²-ből számoljuk a tekercseket és maradék m²-t
        const coveragePerRoll = material.category === 'vapor_barrier' ? 60 : 75;
        const totalSquareMeters = usedByProjects[materialId].squareMeters || 0;
        usedByProjects[materialId].rolls = Math.floor(totalSquareMeters / coveragePerRoll);
        // A maradék m²-t megtartjuk a squareMeters-ben
        usedByProjects[materialId].squareMeters = totalSquareMeters % coveragePerRoll;
      }
    });

    // 3. Egyenleg számítás - tartalmazza a felvett, felhasznált és egyenleg mennyiségeket
    const balance: Record<string, { 
      pickedUp: { pallets: number; rolls: number };
      used: { pallets: number; rolls: number; squareMeters?: number };
      balance: { pallets: number; rolls: number; squareMeters?: number };
      name: string; 
      category: string;
    }> = {};
    
    Object.entries(pickedUp).forEach(([materialId, picked]) => {
      const used = usedByProjects[materialId] || { pallets: 0, rolls: 0, squareMeters: 0, rollsPerPallet: 24 };
      const material = materials.find((m) => String(m.documentId || m.id) === materialId);
      const rollsPerPallet = material?.rolls_per_pallet || 24;
      
      // Szigetelőanyagnál: egyenleg = felvett - felhasznált (raklapok és tekercsek)
      if (picked.category === 'insulation') {
        const totalPickedRolls = picked.pallets * rollsPerPallet + picked.rolls;
        const totalUsedRolls = used.pallets * rollsPerPallet + used.rolls;
        const balanceRolls = totalPickedRolls - totalUsedRolls;
        const balancePallets = Math.floor(balanceRolls / rollsPerPallet);
        const balanceRemainingRolls = balanceRolls % rollsPerPallet;
        
        balance[materialId] = {
          pickedUp: { pallets: picked.pallets, rolls: picked.rolls },
          used: { pallets: used.pallets, rolls: used.rolls },
          balance: { pallets: balancePallets, rolls: balanceRemainingRolls },
          name: picked.name,
          category: picked.category,
        };
      } else {
        // Fóliáknál: egyenleg = felvett - felhasznált (m²-ben számolva, majd konvertálva tekercsre és maradék m²-re)
        const coveragePerRoll = picked.category === 'vapor_barrier' ? 60 : 75;
        const pickedSquareMeters = picked.rolls * coveragePerRoll;
        // A felhasznált: tekercsek * coveragePerRoll + maradék m²
        const usedSquareMeters = (used.rolls || 0) * coveragePerRoll + (used.squareMeters || 0);
        const balanceSquareMeters = pickedSquareMeters - usedSquareMeters;
        
        // Konvertáljuk a maradék m²-t tekercsekre és maradék m²-re
        // Ha negatív, akkor is helyesen számoljuk
        const balanceRolls = balanceSquareMeters >= 0 
          ? Math.floor(balanceSquareMeters / coveragePerRoll)
          : Math.ceil(balanceSquareMeters / coveragePerRoll);
        const balanceRemainingSquareMeters = balanceSquareMeters >= 0
          ? balanceSquareMeters % coveragePerRoll
          : balanceSquareMeters - (balanceRolls * coveragePerRoll);
        
        balance[materialId] = {
          pickedUp: { pallets: picked.pallets, rolls: picked.rolls },
          used: { pallets: used.pallets, rolls: used.rolls, squareMeters: used.squareMeters },
          balance: { pallets: 0, rolls: balanceRolls, squareMeters: balanceRemainingSquareMeters },
          name: picked.name,
          category: picked.category,
        };
      }
    });

    // 4. Kategóriák szerinti csoportosítás
    const insulation = Object.entries(balance)
      .filter(([, b]) => b.category === 'insulation')
      .sort(([, a], [, b]) => a.name.localeCompare(b.name));
    
    const foils = Object.entries(balance)
      .filter(([, b]) => b.category === 'vapor_barrier' || b.category === 'breathable_membrane')
      .sort(([, a], [, b]) => a.name.localeCompare(b.name));

    return { insulation, foils, all: balance };
  }, [transactions, projects, materials]);

  // Tranzakció törlés mutation
  const deleteTransactionMutation = useMutation({
    mutationFn: async ({ id, transaction }: { id: string | number; transaction: any }) => {
      // A tranzakció adatai már rendelkezésre állnak, nem kell újra lekérni
      const deleted = await materialTransactionsApi.delete(id);
      
      // Audit log hozzáadása minden projekthez
      try {
        const allProjects = await projectsApi.getAll();
        const materialName = transaction.material?.name || 'Ismeretlen anyag';
        const pickupDate = transaction.pickup_date 
          ? new Date(transaction.pickup_date).toLocaleDateString('hu-HU')
          : transaction.createdAt
          ? new Date(transaction.createdAt).toLocaleDateString('hu-HU')
          : 'ismeretlen dátum';
        const auditLogEntry = createAuditLogEntry(
          'material_removed',
          user,
          `Anyagfelvétel törölve: ${materialName} - ${transaction.quantity_pallets || 0} raklap, ${transaction.quantity_rolls || 0} tekercs (${pickupDate})`
        );
        auditLogEntry.module = 'Anyaggazdálkodás';

        const updatePromises = allProjects.map((project: Project) => {
          const projectId = project.documentId || project.id;
          if (!projectId) {
            console.warn('Projekt ID hiányzik, audit log frissítés kihagyva');
            return Promise.resolve();
          }
          
          const updatedAuditLog = addAuditLogEntry(project.audit_log, auditLogEntry);
          return projectsApi.update(projectId, {
            audit_log: updatedAuditLog,
          }).catch((error: any) => {
            // Ha nincs audit_log mező, csak logoljuk
            if (error?.message?.includes('Invalid key audit_log') || 
                error?.response?.data?.error?.message?.includes('Invalid key audit_log')) {
              console.warn('audit_log mező nem létezik a projektben, audit log frissítés kihagyva');
            } else if (error?.response?.status === 404 || 
                       error?.message?.includes('404') || 
                       error?.message?.includes('nem található') ||
                       error?.message?.includes('Not Found')) {
              // Projekt nem található (lehet, hogy törölve lett) - csendben kihagyjuk
              // Nem logoljuk, mert ez normális esemény lehet
            } else {
              // Egyéb hiba
              console.warn(`Audit log frissítés hiba projektnél (ID: ${projectId}):`, error?.message || error);
            }
          });
        });
        await Promise.all(updatePromises);
      } catch (error) {
        console.warn('Audit log frissítés hiba (nem kritikus):', error);
      }

      return { deleted, transaction };
    },
    onSuccess: (_data, variables) => {
      // Helyi log hozzáadása
      addLogEntry({
        action: 'deleted',
        materialName: variables.transaction?.material?.name || 'Ismeretlen anyag',
        quantity: { 
          pallets: variables.transaction?.quantity_pallets || 0, 
          rolls: variables.transaction?.quantity_rolls || 0 
        },
        user: user?.username || user?.email || 'Ismeretlen',
      });
      
      queryClient.invalidateQueries({ queryKey: ['material-balances'] });
      queryClient.invalidateQueries({ queryKey: ['material-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error: any) => {
      console.error('Tranzakció törlés hiba:', error);
      alert(`Hiba történt a tranzakció törlése során: ${error.message || 'Ismeretlen hiba'}`);
    },
  });

  // Tranzakció frissítés mutation
  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, data, oldTransaction }: { id: string | number; data: Partial<any>; oldTransaction: any }) => {
      const updated = await materialTransactionsApi.update(id, data);
      
      // Audit log hozzáadása minden projekthez
      try {
        const allProjects = await projectsApi.getAll();
        const materialName = oldTransaction.material?.name || 'Ismeretlen anyag';
        const oldPallets = oldTransaction.quantity_pallets || 0;
        const oldRolls = oldTransaction.quantity_rolls || 0;
        const newPallets = data.quantity_pallets || 0;
        const newRolls = data.quantity_rolls || 0;
        const auditLogEntry = createAuditLogEntry(
          'material_modified',
          user,
          `Anyagfelvétel módosítva: ${materialName} - ${oldPallets} raklap, ${oldRolls} tekercs → ${newPallets} raklap, ${newRolls} tekercs (${oldTransaction.pickup_date || oldTransaction.createdAt})`
        );
        auditLogEntry.module = 'Anyaggazdálkodás';

        const updatePromises = allProjects.map((project: Project) => {
          const projectId = project.documentId || project.id;
          if (!projectId) {
            console.warn('Projekt ID hiányzik, audit log frissítés kihagyva');
            return Promise.resolve();
          }
          
          const updatedAuditLog = addAuditLogEntry(project.audit_log, auditLogEntry);
          return projectsApi.update(projectId, {
            audit_log: updatedAuditLog,
          }).catch((error: any) => {
            // Ha nincs audit_log mező, csak logoljuk
            if (error?.message?.includes('Invalid key audit_log') || 
                error?.response?.data?.error?.message?.includes('Invalid key audit_log')) {
              console.warn('audit_log mező nem létezik a projektben, audit log frissítés kihagyva');
            } else if (error?.response?.status === 404 || 
                       error?.message?.includes('404') || 
                       error?.message?.includes('nem található') ||
                       error?.message?.includes('Not Found')) {
              // Projekt nem található (lehet, hogy törölve lett) - csendben kihagyjuk
              // Nem logoljuk, mert ez normális esemény lehet
            } else {
              // Egyéb hiba
              console.warn(`Audit log frissítés hiba projektnél (ID: ${projectId}):`, error?.message || error);
            }
          });
        });
        await Promise.all(updatePromises);
      } catch (error) {
        console.warn('Audit log frissítés hiba (nem kritikus):', error);
      }

      return { updated, oldTransaction, newData: data };
    },
    onSuccess: (_data, variables) => {
      // Helyi log hozzáadása
      addLogEntry({
        action: 'modified',
        materialName: variables.oldTransaction?.material?.name || 'Ismeretlen anyag',
        quantity: { 
          pallets: variables.data.quantity_pallets || 0, 
          rolls: variables.data.quantity_rolls || 0 
        },
        oldQuantity: {
          pallets: variables.oldTransaction?.quantity_pallets || 0,
          rolls: variables.oldTransaction?.quantity_rolls || 0,
        },
        user: user?.username || user?.email || 'Ismeretlen',
      });
      
      queryClient.invalidateQueries({ queryKey: ['material-balances'] });
      queryClient.invalidateQueries({ queryKey: ['material-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setEditingTransaction(null);
      setEditTransactionData(null);
    },
    onError: (error: any) => {
      console.error('Tranzakció frissítés hiba:', error);
      alert(`Hiba történt a tranzakció frissítése során: ${error.message || 'Ismeretlen hiba'}`);
    },
  });

  const getPeriodLabel = (period: RequirementsPeriod) => {
    switch (period) {
      case 'today':
        return 'Mai';
      case 'tomorrow':
        return 'Holnapi';
      case 'week':
        return 'Heti';
      case 'two-weeks':
        return 'Kétheti';
      case 'month':
        return 'Havi';
      case 'custom':
        return 'Egyedi';
      default:
        return '';
    }
  };

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
                  <div key={balance.documentId || balance.id} className="text-sm">
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

        {/* Felvett anyagok listája - összesítve */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold flex items-center">
              <List className="mr-2 h-5 w-5" />
              Felvett anyagok
            </h3>
          </div>
          <Card>
            <CardContent className="py-4">
              {Object.keys(pickupTransactionsGrouped).length > 0 ? (
                <div className="space-y-6">
                  {Object.entries(pickupTransactionsGrouped)
                    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
                    .map(([date, materialsByDate]) => (
                      <div key={date} className="border-b last:border-b-0 pb-4 last:pb-0">
                        <div className="font-semibold text-lg mb-3 text-gray-700 dark:text-gray-300">
                          {new Date(date).toLocaleDateString('hu-HU', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            weekday: 'long'
                          })}
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Anyag</TableHead>
                              <TableHead className="text-right">Raklapok</TableHead>
                              <TableHead className="text-right">Tekercsek</TableHead>
                              <TableHead className="text-right">Műveletek</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(materialsByDate).map(([materialId, summary]) => (
                              <TableRow key={materialId}>
                                <TableCell className="font-medium">
                                  {summary.materialName}
                                </TableCell>
                                <TableCell className="text-right">
                                  {summary.pallets || 0}
                                </TableCell>
                                <TableCell className="text-right">
                                  {summary.rolls || 0}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingTransaction({ date, materialId });
                                        setEditTransactionData({
                                          pallets: String(summary.pallets),
                                          rolls: String(summary.rolls),
                                        });
                                      }}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        // Törlés megerősítés nélkül (audit log miatt)
                                        // A tranzakció adatai már rendelkezésre állnak, nem kell újra lekérni
                                        summary.transactions.forEach((t: any) => {
                                          deleteTransactionMutation.mutate({
                                            id: t.documentId || t.id,
                                            transaction: t, // A tranzakció adatai már itt vannak
                                          });
                                        });
                                      }}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="mx-auto h-12 w-12 mb-2 text-gray-400" />
                  <p className="text-sm">Még nincs felvett anyag.</p>
                  <p className="text-xs text-gray-400 mt-1">Az anyagfelvétel után itt jelenik meg a lista.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tranzakció szerkesztés dialog */}
        {editingTransaction && editTransactionData && (
          <Dialog open={!!editingTransaction} onOpenChange={(open) => !open && setEditingTransaction(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tranzakció szerkesztése</DialogTitle>
                <DialogDescription>
                  Módosítsa a tranzakció mennyiségét. Az összes tranzakció ezen a napon erre az anyagra frissül.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="edit-pallets">Raklapok</Label>
                  <Input
                    id="edit-pallets"
                    type="number"
                    min="0"
                    value={editTransactionData.pallets}
                    onChange={(e) => setEditTransactionData({ ...editTransactionData, pallets: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-rolls">Tekercsek</Label>
                  <Input
                    id="edit-rolls"
                    type="number"
                    min="0"
                    value={editTransactionData.rolls}
                    onChange={(e) => setEditTransactionData({ ...editTransactionData, rolls: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingTransaction(null);
                    setEditTransactionData(null);
                  }}
                >
                  Mégse
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (!editingTransaction) return;
                    const { date, materialId } = editingTransaction;
                    const summary = pickupTransactionsGrouped[date]?.[materialId];
                    if (summary && summary.transactions.length > 0) {
                      const transactions = summary.transactions;
                      const totalPallets = parseInt(editTransactionData.pallets || '0');
                      const totalRolls = parseInt(editTransactionData.rolls || '0');
                      const palletsPerTransaction = Math.floor(totalPallets / transactions.length);
                      const rollsPerTransaction = Math.floor(totalRolls / transactions.length);
                      const remainingPallets = totalPallets % transactions.length;
                      const remainingRolls = totalRolls % transactions.length;
                      
                      transactions.forEach((t: any, index: number) => {
                        const pallets = palletsPerTransaction + (index < remainingPallets ? 1 : 0);
                        const rolls = rollsPerTransaction + (index < remainingRolls ? 1 : 0);
                        updateTransactionMutation.mutate({
                          id: t.documentId || t.id,
                          data: {
                            quantity_pallets: pallets,
                            quantity_rolls: rolls,
                          },
                          oldTransaction: t,
                        });
                      });
                    }
                  }}
                  disabled={updateTransactionMutation.isPending}
                >
                  {updateTransactionMutation.isPending ? 'Mentés...' : 'Mentés'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Anyagigény számítás */}
        {materialRequirements && dateRange && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Anyagigény
              </h3>
              <div className="flex gap-2 items-center">
                <Select value={requirementsPeriod} onValueChange={(v: RequirementsPeriod) => setRequirementsPeriod(v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Ma</SelectItem>
                    <SelectItem value="tomorrow">Holnap</SelectItem>
                    <SelectItem value="week">Ez a hét</SelectItem>
                    <SelectItem value="two-weeks">Két hét</SelectItem>
                    <SelectItem value="month">Ez a hónap</SelectItem>
                    <SelectItem value="custom">Egyedi dátumok</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {requirementsPeriod === 'custom' && (
              <div className="mb-4 flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor="custom-start-date">Kezdő dátum</Label>
                  <Input
                    id="custom-start-date"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="custom-end-date">Végdátum</Label>
                  <Input
                    id="custom-end-date"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
            {/* Elérhető anyagok kezelése */}
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Elérhető anyagok beállítása:</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAvailableMaterialsDialogOpen(true)}
                >
                  <Package className="mr-2 h-4 w-4" />
                  {availableMaterialsIds.length > 0 ? `${availableMaterialsIds.length} anyag kiválasztva` : 'Anyagok kiválasztása'}
                </Button>
              </div>
              <div className="mb-3">
                <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Számítás dátumig:</Label>
                <Input
                  type="date"
                  value={availabilityEndDate}
                  onChange={(e) => setAvailabilityEndDate(e.target.value)}
                  className="w-full max-w-xs"
                />
              </div>
              {availableMaterialsIds.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {availableMaterialsIds.length} anyag kiválasztva. Az anyagigény számítás csak ezekből az anyagokból történik.
                  </p>
                  <div className="text-xs space-y-1">
                    <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">Kiválasztott anyagok:</div>
                    <div className="flex flex-wrap gap-2">
                      {materials
                        .filter((m) => availableMaterialsIds.includes(String(m.documentId || m.id)))
                        .map((material) => (
                          <span
                            key={material.documentId || material.id}
                            className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs"
                          >
                            {material.name}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              )}
              {availableMaterialsIds.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ Nincs kiválasztott anyag. Kattintson az "Anyagok kiválasztása" gombra!
                </p>
              )}
            </div>
            <Card>
              <CardHeader>
                <CardTitle>
                  {getPeriodLabel(requirementsPeriod)} anyagigény
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Elérhető anyagok megjelenítése */}
                  {materialRequirements.availableMaterials && materialRequirements.availableMaterials.length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <div className="text-sm font-medium mb-2">Elérhető anyagok ({availabilityEndDate || 'mai dátumig'}):</div>
                      <div className="space-y-1 text-xs">
                        {materialRequirements.availableMaterials.map((mat: AvailableMaterial) => (
                          <div key={String(mat.materialId)} className="flex justify-between">
                            <span>{mat.materialName}</span>
                            <span>
                              {mat.category === 'insulation' 
                                ? formatInsulationQuantity(mat.availablePallets, mat.availableRolls)
                                : formatFoilQuantity(mat.totalRolls)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {materialRequirements.projectsNoOption > 0 && (
                    <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                      <span className="font-medium">❌ Hiány:</span> {materialRequirements.projectsNoOption} projekt nem készíthető el, mert nincs elég anyag sem a 10cm+15cm, sem a 12.5cm+12.5cm kombinációhoz.
                    </div>
                  )}
                  
                  {materialRequirements.projectsOptionA > 0 && materialRequirements.projectsOptionB > 0 && (
                    <div className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                      <span className="font-medium">ℹ️ Info:</span> {materialRequirements.projectsOptionA} projekt 10cm+15cm kombinációval, {materialRequirements.projectsOptionB} projekt 12.5cm+12.5cm kombinációval készíthető el.
                    </div>
                  )}
                  {materialRequirements.projectsOptionA > 0 && materialRequirements.projectsOptionB === 0 && (
                    <div className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                      <span className="font-medium">ℹ️ Info:</span> {materialRequirements.projectsOptionA} projekt 10cm+15cm kombinációval készíthető el.
                    </div>
                  )}
                  {materialRequirements.projectsOptionA === 0 && materialRequirements.projectsOptionB > 0 && (
                    <div className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                      <span className="font-medium">ℹ️ Info:</span> {materialRequirements.projectsOptionB} projekt 12.5cm+12.5cm kombinációval készíthető el.
                    </div>
                  )}
                  
                  {materialRequirements.projectsWithoutData > 0 && (
                    <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                      <span className="font-medium">⚠️ Figyelmeztetés:</span> {materialRequirements.projectsWithoutData} projekt nem számolható bele az anyagigénybe, mert hiányzik a terület (area_sqm) adata.
                    </div>
                  )}
                  
                  <div className="text-sm">
                    <span className="font-medium">Projektek száma:</span> {materialRequirements.projectCount}
                    {materialRequirements.totalProjects > materialRequirements.projectCount && (
                      <span className="text-gray-500 dark:text-gray-400"> (összes: {materialRequirements.totalProjects})</span>
                    )}
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
                      {materialRequirements.insulation.optionA_rolls > 0 && materialRequirements.insulation.optionB_rolls > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          (10cm+15cm: {Math.ceil(materialRequirements.insulation.optionA_rolls / 24)} raklap, 12.5cm+12.5cm: {Math.ceil(materialRequirements.insulation.optionB_rolls / 24)} raklap)
                        </span>
                      )}
                      {materialRequirements.insulation.optionA_rolls > 0 && materialRequirements.insulation.optionB_rolls === 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          (10cm+15cm: {Math.ceil(materialRequirements.insulation.optionA_rolls / 24)} raklap)
                        </span>
                      )}
                      {materialRequirements.insulation.optionA_rolls === 0 && materialRequirements.insulation.optionB_rolls > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          (12.5cm+12.5cm: {Math.ceil(materialRequirements.insulation.optionB_rolls / 24)} raklap)
                        </span>
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
                
                {/* Táblázatos anyagfelvétel */}
                <div>
                  <Label className="mb-2 block">Anyagok és mennyiségek:</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Anyag</TableHead>
                          <TableHead className="text-right">Raklapok</TableHead>
                          <TableHead className="text-right">Tekercsek</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {materials
                          .filter((m) => availableMaterialsIds.length === 0 || availableMaterialsIds.includes(String(m.documentId || m.id)))
                          .map((material) => {
                            const materialId = String(material.documentId || material.id);
                            const isInsulation = material.category === 'insulation';
                            const quantities = pickupQuantities[materialId] || { pallets: '', rolls: '' };
                            
                            return (
                              <TableRow key={materialId}>
                                <TableCell className="font-medium">
                                  {material.name}
                                  {material.thickness_cm && (
                                    <span className="text-xs text-gray-500 ml-2">
                                      ({material.thickness_cm.replace('cm', '')} cm)
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {isInsulation ? (
                                    <Input
                                      type="number"
                                      min="0"
                                      value={quantities.pallets}
                                      onChange={(e) => {
                                        setPickupQuantities({
                                          ...pickupQuantities,
                                          [materialId]: {
                                            ...quantities,
                                            pallets: e.target.value,
                                          },
                                        });
                                      }}
                                      className="w-20 ml-auto"
                                      placeholder="0"
                                    />
                                  ) : (
                                    <span className="text-gray-400 text-sm">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={quantities.rolls}
                                    onChange={(e) => {
                                      setPickupQuantities({
                                        ...pickupQuantities,
                                        [materialId]: {
                                          ...quantities,
                                          rolls: e.target.value,
                                        },
                                      });
                                    }}
                                    className="w-20 ml-auto"
                                    placeholder="0"
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        {materials.filter((m) => availableMaterialsIds.length === 0 || availableMaterialsIds.includes(String(m.documentId || m.id))).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-gray-500 py-4">
                              Nincs elérhető anyag
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>ℹ️ Tájékoztatás:</strong> A szállítólevelet a projekt <strong>Képek</strong> menüpontjában, az <strong>"Egyéb"</strong> kategóriába töltse fel!
                  </p>
                </div>
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

        {/* Aktuális anyagegyenleg - számított */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold flex items-center">
              <Package className="mr-2 h-5 w-5" />
              Aktuális anyagegyenleg
            </h3>
          </div>
          
          {Object.keys(calculatedBalance.all).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <Package className="mx-auto h-12 w-12 mb-2 text-gray-400" />
                <p className="text-sm">Még nincs anyagegyenleg adat.</p>
                <p className="text-xs text-gray-400 mt-1">Az anyagfelvétel után itt jelenik meg az egyenleg.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Szigetelőanyagok */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Szigetelőanyagok</CardTitle>
                </CardHeader>
                <CardContent>
                  {calculatedBalance.insulation.length === 0 ? (
                    <p className="text-sm text-gray-500">Nincs felvett szigetelőanyag.</p>
                  ) : (
                    <div className="space-y-4">
                      {calculatedBalance.insulation.map(([materialId, balanceData]) => {
                        const { pickedUp, used, balance: balanceAmount, name } = balanceData;
                        const isNegative = balanceAmount.rolls < 0 || balanceAmount.pallets < 0;
                        
                        return (
                          <div key={materialId} className="border-b pb-3 last:border-b-0 last:pb-0">
                            <div className="font-medium mb-2">{name}</div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Felvett mennyiség:</span>
                                <span>
                                  {pickedUp.pallets > 0 && `${pickedUp.pallets} raklap`}
                                  {pickedUp.pallets > 0 && pickedUp.rolls > 0 && ', '}
                                  {pickedUp.rolls > 0 && `${pickedUp.rolls} tekercs`}
                                  {pickedUp.pallets === 0 && pickedUp.rolls === 0 && '0'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Felhasznált mennyiség:</span>
                                <span>
                                  {used.pallets > 0 && `${used.pallets} raklap`}
                                  {used.pallets > 0 && used.rolls > 0 && ', '}
                                  {used.rolls > 0 && `${used.rolls} tekercs`}
                                  {used.pallets === 0 && used.rolls === 0 && '0'}
                                </span>
                              </div>
                              <div className="flex justify-between font-semibold pt-1 border-t">
                                <span>Egyenleg:</span>
                                <span className={isNegative ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                                  {balanceAmount.pallets > 0 && `${balanceAmount.pallets} raklap`}
                                  {balanceAmount.pallets > 0 && balanceAmount.rolls !== 0 && ', '}
                                  {balanceAmount.pallets === 0 && balanceAmount.rolls !== 0 && ''}
                                  {balanceAmount.rolls !== 0 && `${balanceAmount.rolls} tekercs`}
                                  {balanceAmount.pallets === 0 && balanceAmount.rolls === 0 && '0'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Fóliák */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Fóliák</CardTitle>
                </CardHeader>
                <CardContent>
                  {calculatedBalance.foils.length === 0 ? (
                    <p className="text-sm text-gray-500">Nincs felvett fólia.</p>
                  ) : (
                    <div className="space-y-4">
                      {calculatedBalance.foils.map(([materialId, balanceData]) => {
                        const { used, balance: balanceAmount, name, category } = balanceData;
                        const isNegative = balanceAmount.rolls < 0 || (balanceAmount.rolls === 0 && (balanceAmount.squareMeters || 0) < 0);
                        const coveragePerRoll = category === 'vapor_barrier' ? 60 : 75;
                        // Felhasznált: tekercsek * coveragePerRoll + maradék m²
                        const usedTotalSquareMeters = (used.rolls || 0) * coveragePerRoll + (used.squareMeters || 0);
                        const balanceSquareMeters = balanceAmount.squareMeters || 0;
                        
                        return (
                          <div key={materialId} className="border-b pb-3 last:border-b-0 last:pb-0">
                            <div className="font-medium mb-2">{name}</div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Felhasznált mennyiség:</span>
                                <span>
                                  {used.rolls > 0 ? `${used.rolls} tekercs` : '0 tekercs'}
                                  {usedTotalSquareMeters > 0 && ` ${Math.round(usedTotalSquareMeters)} m²`}
                                </span>
                              </div>
                              <div className="flex justify-between font-semibold pt-1 border-t">
                                <span>Egyenleg:</span>
                                <span className={isNegative ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                                  {balanceAmount.rolls !== 0 ? `${balanceAmount.rolls} tekercs` : balanceSquareMeters !== 0 ? '0 tekercs' : '0 tekercs'}
                                  {balanceSquareMeters !== 0 && ` ${Math.round(Math.abs(balanceSquareMeters))} m²`}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Anyag mozgás log */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold flex items-center">
              <List className="mr-2 h-5 w-5" />
              Anyag mozgás napló
            </h3>
          </div>
          <Card>
            <CardContent className="py-4">
              {materialLog.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <List className="mx-auto h-12 w-12 mb-2 text-gray-400" />
                  <p className="text-sm">Még nincs anyag mozgás.</p>
                  <p className="text-xs text-gray-400 mt-1">Az anyagfelvétel, módosítás és törlés itt jelenik meg.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dátum</TableHead>
                      <TableHead>Művelet</TableHead>
                      <TableHead>Anyag</TableHead>
                      <TableHead>Felhasználó</TableHead>
                      <TableHead className="text-right">Mennyiség</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialLog.map((entry) => {
                      const actionLabels: Record<string, string> = {
                        pickup: 'Felvétel',
                        modified: 'Módosítás',
                        deleted: 'Törlés',
                      };
                      const actionColors: Record<string, string> = {
                        pickup: 'text-green-600 dark:text-green-400',
                        modified: 'text-amber-600 dark:text-amber-400',
                        deleted: 'text-red-600 dark:text-red-400',
                      };
                      
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(entry.timestamp).toLocaleDateString('hu-HU', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell>
                            <span className={`font-medium ${actionColors[entry.action] || ''}`}>
                              {actionLabels[entry.action] || entry.action}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">
                            {entry.materialName}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                            {entry.user}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.action === 'modified' && entry.oldQuantity ? (
                              <>
                                <span className="text-gray-400 line-through mr-2">
                                  {entry.oldQuantity.pallets || 0} r, {entry.oldQuantity.rolls || 0} t
                                </span>
                                <span>→ {entry.quantity.pallets || 0} raklap, {entry.quantity.rolls || 0} tekercs</span>
                              </>
                            ) : (
                              <>
                                {(entry.quantity.pallets || 0) > 0 && `${entry.quantity.pallets} raklap`}
                                {(entry.quantity.pallets || 0) > 0 && (entry.quantity.rolls || 0) > 0 && ', '}
                                {(entry.quantity.rolls || 0) > 0 && `${entry.quantity.rolls} tekercs`}
                                {!entry.quantity.pallets && !entry.quantity.rolls && '0'}
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Elérhető anyagok kiválasztása dialog */}
        <Dialog open={isAvailableMaterialsDialogOpen} onOpenChange={setIsAvailableMaterialsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Elérhető anyagok kiválasztása</DialogTitle>
              <DialogDescription>
                Válassza ki, hogy mely anyagok érhetők el az anyagigény számításhoz és az anyagfelvételhez.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-3">
                {materials.length === 0 ? (
                  <p className="text-sm text-gray-500">Nincs elérhető anyag.</p>
                ) : (
                  materials.map((material) => {
                    const materialId = String(material.documentId || material.id);
                    const isChecked = availableMaterialsIds.includes(materialId);
                    
                    return (
                      <div key={materialId} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                        <Checkbox
                          id={`material-${materialId}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setAvailableMaterialsIds([...availableMaterialsIds, materialId]);
                            } else {
                              setAvailableMaterialsIds(availableMaterialsIds.filter((id) => id !== materialId));
                            }
                          }}
                        />
                        <Label
                          htmlFor={`material-${materialId}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="font-medium">{material.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {material.category === 'insulation' && material.thickness_cm && (
                              <>Vastagság: {material.thickness_cm.replace('cm', '')} cm • </>
                            )}
                            {material.coverage_per_roll && (
                              <>m²/tekercs: {material.coverage_per_roll} • </>
                            )}
                            {material.rolls_per_pallet && (
                              <>Tekercs/raklap: {material.rolls_per_pallet}</>
                            )}
                            {!material.rolls_per_pallet && material.category !== 'insulation' && (
                              <>Fólia</>
                            )}
                          </div>
                        </Label>
                      </div>
                    );
                  })
                )}
              </div>
              {availableMaterialsIds.length === 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  ⚠️ Ha nem választ ki anyagot, az összes anyag elérhetőnek számít.
                </p>
              )}
        </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAvailableMaterialsIds([]);
                }}
              >
                Összes törlése
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setIsAvailableMaterialsDialogOpen(false);
                }}
              >
                Mentés
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
