/**
 * Anyagszükséglet kalkuláció projekt alapján
 * 
 * Szabályok:
 * - Szigetelés: 25 cm össz vastagság (2 réteg)
 * - Fóliák: 1 réteg párazáró ALÁ, 1 réteg légáteresztő FÖLÉ
 * 
 * Kombinációk:
 * - Opció A: 10 cm + 15 cm = 25 cm
 * - Opció B: 12.5 cm + 12.5 cm = 25 cm
 */

export interface MaterialRequirement {
  insulation: {
    option: 'A' | 'B';
    bottom: {
      thickness: number;
      rolls: number;
    };
    top: {
      thickness: number;
      rolls: number;
    };
    total_rolls: number;
    total_pallets: number;
  };
  vapor_barrier: {
    rolls: number;
  };
  breathable_membrane: {
    rolls: number;
  };
}

/**
 * Anyagszükséglet számítása terület és szigetelési opció alapján
 */
export function calculateMaterials(
  area_sqm: number,
  insulation_option: 'A' | 'B'
): MaterialRequirement {
  const configs = {
    'A': { // 10cm + 15cm
      bottom: { thickness: 10, coverage: 9.24 },
      top: { thickness: 15, coverage: 6.12 }
    },
    'B': { // 12.5cm + 12.5cm
      bottom: { thickness: 12.5, coverage: 7.68 },
      top: { thickness: 12.5, coverage: 7.68 }
    }
  };

  const config = configs[insulation_option];

  // Alsó réteg
  const bottom_rolls = Math.ceil(area_sqm / config.bottom.coverage);

  // Felső réteg
  const top_rolls = Math.ceil(area_sqm / config.top.coverage);

  // Összesen szigetelő
  const total_rolls = bottom_rolls + top_rolls;
  const total_pallets = Math.ceil(total_rolls / 24);

  // Fóliák
  const vapor_rolls = Math.ceil(area_sqm / 60); // Párazáró
  const breathable_rolls = Math.ceil(area_sqm / 75); // Légáteresztő

  return {
    insulation: {
      option: insulation_option,
      bottom: {
        thickness: config.bottom.thickness,
        rolls: bottom_rolls
      },
      top: {
        thickness: config.top.thickness,
        rolls: top_rolls
      },
      total_rolls: total_rolls,
      total_pallets: total_pallets
    },
    vapor_barrier: {
      rolls: vapor_rolls
    },
    breathable_membrane: {
      rolls: breathable_rolls
    }
  };
}

/**
 * Szigetelő mennyiség formázása (raklapok + tekercsek)
 */
export function formatInsulationQuantity(pallets: number, rolls: number): string {
  if (pallets === 0 && rolls === 0) return '0';
  if (pallets === 0) return `${rolls} tekercs`;
  if (rolls === 0) return `${pallets} raklap`;
  return `${pallets} raklap, ${rolls} tekercs`;
}

/**
 * Fólia mennyiség formázása (tekercsek)
 */
export function formatFoilQuantity(rolls: number): string {
  if (rolls === 0) return '0';
  return `${rolls} tekercs`;
}

/**
 * Raklapok száma tekercsekből
 */
export function rollsToPallets(rolls: number): { pallets: number; remainingRolls: number } {
  const pallets = Math.floor(rolls / 24);
  const remainingRolls = rolls % 24;
  return { pallets, remainingRolls };
}

/**
 * Tekercsek száma raklapokból
 */
export function palletsToRolls(pallets: number, rolls: number = 0): number {
  return pallets * 24 + rolls;
}

/**
 * Elérhető anyagok számítása Material Transaction-okból dátum alapján
 */
export interface AvailableMaterial {
  materialId: string | number;
  materialName: string;
  category: 'insulation' | 'vapor_barrier' | 'breathable_membrane';
  thickness_cm?: 'cm10' | 'cm12_5' | 'cm15';
  availablePallets: number;
  availableRolls: number;
  totalRolls: number; // Összes tekercs (raklapok + tekercsek)
}

// MaterialTransaction interface - kompatibilis a material-transactions.ts fájlban definiált típussal
export interface MaterialTransactionForCalculation {
  type: 'pickup' | 'usage';
  pickup_date?: string;
  used_date?: string;
  material?: {
    id?: number;
    documentId?: string;
    name?: string;
    category?: 'insulation' | 'vapor_barrier' | 'breathable_membrane';
    thickness_cm?: 'cm10' | 'cm12_5' | 'cm15';
  };
  quantity_pallets?: number;
  quantity_rolls?: number;
}

/**
 * Elérhető anyagok számítása dátum alapján
 */
export function calculateAvailableMaterials(
  transactions: MaterialTransactionForCalculation[],
  targetDate: Date
): AvailableMaterial[] {
  const targetDateStr = targetDate.toISOString().split('T')[0];
  const targetDateTime = targetDate.getTime();

  // Anyagok szerint csoportosítás
  const materialMap = new Map<string, AvailableMaterial>();

  transactions.forEach((transaction) => {
    if (!transaction.material) return;

    const materialId = String(transaction.material.documentId || transaction.material.id);
    const materialName = transaction.material.name || 'Ismeretlen';
    const category = transaction.material.category || 'insulation';
    const thickness = transaction.material.thickness_cm;

    // Csak azokat a tranzakciókat számoljuk, amelyek a cél dátum előtt vagy aznap történtek
    const transactionDate = transaction.type === 'pickup' 
      ? transaction.pickup_date 
      : transaction.used_date;
    
    if (!transactionDate) return;

    const transDate = new Date(transactionDate);
    transDate.setHours(0, 0, 0, 0);
    
    // Csak a cél dátumig történt tranzakciókat számoljuk
    if (transDate.getTime() > targetDateTime) return;

    if (!materialMap.has(materialId)) {
      materialMap.set(materialId, {
        materialId,
        materialName,
        category,
        thickness_cm: thickness,
        availablePallets: 0,
        availableRolls: 0,
        totalRolls: 0,
      });
    }

    const material = materialMap.get(materialId)!;
    const pallets = transaction.quantity_pallets || 0;
    const rolls = transaction.quantity_rolls || 0;
    const totalRollsFromTransaction = palletsToRolls(pallets, rolls);

    if (transaction.type === 'pickup') {
      // Felvétel: hozzáadás
      material.availablePallets += pallets;
      material.availableRolls += rolls;
      material.totalRolls += totalRollsFromTransaction;
    } else if (transaction.type === 'usage') {
      // Bedolgozás: levonás
      material.availablePallets -= pallets;
      material.availableRolls -= rolls;
      material.totalRolls -= totalRollsFromTransaction;
    }
  });

  return Array.from(materialMap.values());
}

/**
 * Insulation option meghatározása elérhető anyagokból
 * Opció A: 10cm + 15cm
 * Opció B: 12.5cm + 12.5cm
 */
export function determineInsulationOption(
  availableMaterials: AvailableMaterial[],
  requiredArea: number
): {
  optionA?: { available: boolean; reason?: string };
  optionB?: { available: boolean; reason?: string };
} {
  const insulation10 = availableMaterials.find(
    (m) => m.category === 'insulation' && m.thickness_cm === 'cm10'
  );
  const insulation12_5 = availableMaterials.find(
    (m) => m.category === 'insulation' && m.thickness_cm === 'cm12_5'
  );
  const insulation15 = availableMaterials.find(
    (m) => m.category === 'insulation' && m.thickness_cm === 'cm15'
  );

  // Opció A számítás (10cm + 15cm)
  let optionA: { available: boolean; reason?: string } | undefined;
  if (insulation10 && insulation15) {
    const required10cm = Math.ceil(requiredArea / 9.24);
    const required15cm = Math.ceil(requiredArea / 6.12);
    const available10cm = insulation10.totalRolls;
    const available15cm = insulation15.totalRolls;

    if (available10cm >= required10cm && available15cm >= required15cm) {
      optionA = { available: true };
    } else {
      optionA = {
        available: false,
        reason: `10cm: ${available10cm}/${required10cm}, 15cm: ${available15cm}/${required15cm}`,
      };
    }
  } else {
    optionA = { available: false, reason: 'Hiányzik 10cm vagy 15cm szigetelő' };
  }

  // Opció B számítás (12.5cm + 12.5cm)
  let optionB: { available: boolean; reason?: string } | undefined;
  if (insulation12_5) {
    const required12_5cm = Math.ceil(requiredArea / 7.68) * 2; // 2 réteg
    const available12_5cm = insulation12_5.totalRolls;

    if (available12_5cm >= required12_5cm) {
      optionB = { available: true };
    } else {
      optionB = {
        available: false,
        reason: `12.5cm: ${available12_5cm}/${required12_5cm}`,
      };
    }
  } else {
    optionB = { available: false, reason: 'Hiányzik 12.5cm szigetelő' };
  }

  return { optionA, optionB };
}
