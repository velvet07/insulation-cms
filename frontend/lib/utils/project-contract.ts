/**
 * Szerződés adatok teljességének ellenőrzése (Projekt Állapot Összesítő – Szerződés adatok).
 * Ha hiányos, ütemezés nem engedélyezett.
 */
import type { Project } from '@/types';

function isFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return value > 0;
  return !!value;
}

export function isContractDataComplete(project: Project | null | undefined): boolean {
  if (!project) return false;

  const hasClientBirthPlace = isFieldFilled(project.client_birth_place);
  const hasClientBirthDate = isFieldFilled(project.client_birth_date);
  const hasClientTaxId = isFieldFilled(project.client_tax_id);
  const hasAreaSqm = isFieldFilled(project.area_sqm);
  const hasFloorMaterial = !!project.floor_material;

  const hasClientAddress =
    isFieldFilled(project.client_street) &&
    isFieldFilled(project.client_city) &&
    isFieldFilled(project.client_zip);

  const propertyAddressSame = project.property_address_same === true;
  const hasPropertyAddress = propertyAddressSame
    ? hasClientAddress
    : isFieldFilled(project.property_street) &&
      isFieldFilled(project.property_city) &&
      isFieldFilled(project.property_zip);

  return !!(
    hasClientBirthPlace &&
    hasClientBirthDate &&
    hasClientTaxId &&
    hasAreaSqm &&
    hasFloorMaterial &&
    hasClientAddress &&
    hasPropertyAddress
  );
}
