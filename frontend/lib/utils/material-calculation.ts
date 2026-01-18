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
