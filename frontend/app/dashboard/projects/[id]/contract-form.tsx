'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/utils';
import type { Project } from '@/types';

const contractDataSchema = z.object({
  // Szerződő lakcíme - nem kötelező mezők
  client_street: z.string().optional(),
  client_city: z.string().optional(),
  client_zip: z.string().optional().refine((val) => !val || (val.length === 4 && /^\d+$/.test(val)), {
    message: 'Az irányítószám 4 számjegy kell legyen',
  }),
  // Születési adatok - nem kötelező mezők
  client_birth_place: z.string().optional(),
  client_birth_date: z.string().optional(),
  // Egyéb adatok - nem kötelező mezők
  client_mother_name: z.string().optional(),
  client_tax_id: z.string().optional().refine((val) => !val || (val.length === 10 && /^\d+$/.test(val)), {
    message: 'Az adóazonosító 10 számjegy kell legyen',
  }),
  // Ingatlan adatok
  property_address_same: z.boolean().optional(),
  property_street: z.string().optional(),
  property_city: z.string().optional(),
  property_zip: z.string().optional(),
  area_sqm: z.number().optional(),
  floor_material: z.enum(['wood', 'prefab_rc', 'monolithic_rc', 'rc_slab', 'hollow_block', 'other']).optional(),
  floor_material_extra: z.string().optional(),
  insulation_option: z.enum(['A', 'B']).optional(),
  scheduled_date: z.string().optional(),
}).superRefine((data, ctx) => {
  // Ha property_zip van kitöltve, validáljuk a formátumát (de nem kötelező)
  if (data.property_zip && data.property_zip.length !== 4 || (data.property_zip && !/^\d+$/.test(data.property_zip))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Az irányítószám 4 számjegy kell legyen',
      path: ['property_zip'],
    });
  }
});

export type ContractDataFormValues = z.infer<typeof contractDataSchema>;

interface ContractFormProps {
  project: Project;
  onSubmit: (data: ContractDataFormValues) => Promise<void>;
  isSubmitting: boolean;
}

export function ContractForm({ project, onSubmit, isSubmitting }: ContractFormProps) {
  const form = useForm<ContractDataFormValues>({
    resolver: zodResolver(contractDataSchema),
    defaultValues: {
      client_street: project.client_street || '',
      client_city: project.client_city || '',
      client_zip: project.client_zip || '',
      client_birth_place: project.client_birth_place || '',
      client_birth_date: formatDate(project.client_birth_date),
      client_mother_name: project.client_mother_name || '',
      client_tax_id: project.client_tax_id || '',
      property_address_same: project.property_address_same ?? true,
      property_street: project.property_street || '',
      property_city: project.property_city || '',
      property_zip: project.property_zip || '',
      area_sqm: project.area_sqm || 0,
      floor_material: project.floor_material || 'wood',
      floor_material_extra: project.floor_material_extra || '',
      insulation_option: project.insulation_option || undefined,
      scheduled_date: project.scheduled_date || undefined,
    },
  });

  const propertyAddressSame = form.watch('property_address_same');
  const floorMaterial = form.watch('floor_material');
  const clientZip = form.watch('client_zip');

  // Watch for changes in property_address_same to conditionally enable/disable fields
  useEffect(() => {
    if (propertyAddressSame) {
      // Ha property_address_same === true, akkor másoljuk a client adatokat
      form.setValue('property_street', form.getValues('client_street') || '', { shouldValidate: false });
      form.setValue('property_city', form.getValues('client_city') || '', { shouldValidate: false });
      form.setValue('property_zip', form.getValues('client_zip') || '', { shouldValidate: false });
    }
  }, [propertyAddressSame, form]);

  // Watch for changes in client_zip to update property_zip if property_address_same === true
  useEffect(() => {
    if (propertyAddressSame && clientZip) {
      form.setValue('property_zip', clientZip, { shouldValidate: false });
    }
  }, [clientZip, propertyAddressSame, form]);

  // Frissítsd a form értékeit amikor a projekt adatok változnak
  useEffect(() => {
    const formattedBirthDate = formatDate(project.client_birth_date);
    form.reset({
      client_street: project.client_street || '',
      client_city: project.client_city || '',
      client_zip: project.client_zip || '',
      client_birth_place: project.client_birth_place || '',
      client_birth_date: formattedBirthDate,
      client_mother_name: project.client_mother_name || '',
      client_tax_id: project.client_tax_id || '',
      property_address_same: project.property_address_same ?? true,
      property_street: project.property_street || '',
      property_city: project.property_city || '',
      property_zip: project.property_zip || '',
      area_sqm: project.area_sqm || 0,
      floor_material: project.floor_material || 'wood',
      floor_material_extra: project.floor_material_extra || '',
      insulation_option: project.insulation_option || undefined,
      scheduled_date: project.scheduled_date || undefined,
    });
    // Explicit módon állítsd be a dátum mező értékét, hogy biztosan frissüljön
    if (formattedBirthDate) {
      form.setValue('client_birth_date', formattedBirthDate, { shouldValidate: false });
    }
  }, [project, form]);

  return (
    <Form {...form}>
      <form 
        onSubmit={form.handleSubmit(
          (data) => {
            console.log('=== FORM VALIDÁCIÓ SIKERES ===');
            console.log('Validált adatok:', data);
            return onSubmit(data);
          },
          (errors) => {
            console.error('=== FORM VALIDÁCIÓ HIBA ===');
            console.error('Validációs hibák:', errors);
          }
        )} 
        className="space-y-6"
      >
        {/* Szerződő lakcíme */}
        <div>
          <h4 className="font-semibold mb-4">Szerződő lakcíme</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="client_street"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Utca, házszám *</FormLabel>
                  <FormControl>
                    <Input placeholder="utca, házszám" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="client_city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Város *</FormLabel>
                  <FormControl>
                    <Input placeholder="Város" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="mt-4">
            <FormField
              control={form.control}
              name="client_zip"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IRSZ *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="1234" 
                      maxLength={4}
                      pattern="[0-9]*"
                      {...field}
                      onChange={(e) => {
                        // Csak számokat engedélyez
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Születési adatok */}
        <div>
          <h4 className="font-semibold mb-4">Születési adatok</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="client_birth_place"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Születési hely *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="client_birth_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Születési idő *</FormLabel>
                  <FormControl>
                    <Input 
                      type="text" 
                      value={field.value || ''} 
                      onChange={(e) => {
                        let value = e.target.value;
                        // Csak számokat és kötőjeleket engedünk
                        value = value.replace(/[^\d-]/g, '');
                        // Automatikus formázás: yyyy-mm-dd
                        if (value.length <= 4) {
                          // Csak év
                          field.onChange(value);
                        } else if (value.length <= 7) {
                          // Év-kötőjel-hónap
                          if (value.length === 5 && !value.endsWith('-')) {
                            field.onChange(value.slice(0, 4) + '-' + value.slice(4));
                          } else {
                            field.onChange(value);
                          }
                        } else if (value.length <= 10) {
                          // Év-kötőjel-hónap-kötőjel-nap
                          if (value.length === 8 && !value.endsWith('-')) {
                            field.onChange(value.slice(0, 7) + '-' + value.slice(7));
                          } else {
                            field.onChange(value);
                          }
                        } else {
                          // Túl hosszú, vágjuk le
                          field.onChange(value.slice(0, 10));
                        }
                      }}
                      onBlur={(e) => {
                        field.onBlur();
                        // Validáljuk a dátumot
                        const value = e.target.value;
                        if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                          const [year, month, day] = value.split('-').map(Number);
                          const date = new Date(year, month - 1, day);
                          if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
                            // Érvényes dátum
                            field.onChange(value);
                          } else {
                            // Érvénytelen dátum, töröljük
                            field.onChange('');
                          }
                        }
                      }}
                      pattern="\d{4}-\d{2}-\d{2}"
                      placeholder="ÉÉÉÉ-HH-NN (pl. 1990-01-15)"
                      maxLength={10}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Anyja neve és adóazonosító */}
        <div>
          <h4 className="font-semibold mb-4">Egyéb adatok</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="client_mother_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Anyja neve *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="client_tax_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adóazonosító *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Adóazonosító (10 számjegy)"
                      maxLength={10}
                      pattern="[0-9]*"
                      {...field}
                      onChange={(e) => {
                        // Csak számokat engedélyez és max 10 karakter
                        const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Ingatlan adatok */}
        <div>
          <h4 className="font-semibold mb-4">A szigetelendő ingatlan adatai</h4>
          <FormField
            control={form.control}
            name="property_address_same"
            render={({ field }) => (
              <FormItem className="mb-4">
                <FormLabel>Az ingatlan címe megegyezik a szerződő címével?</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={(value) => field.onChange(value === 'true')}
                    value={field.value ? 'true' : 'false'}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id="same-yes" />
                      <Label htmlFor="same-yes">Igen</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id="same-no" />
                      <Label htmlFor="same-no">Nem</Label>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {!propertyAddressSame && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="property_street"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Utca, házszám *</FormLabel>
                    <FormControl>
                      <Input placeholder="utca, házszám" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="property_city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Város *</FormLabel>
                    <FormControl>
                      <Input placeholder="Város" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
          {!propertyAddressSame && (
            <div className="mt-4">
              <FormField
                control={form.control}
                name="property_zip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IRSZ *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="1234" 
                        maxLength={4}
                        pattern="[0-9]*"
                        {...field}
                        onChange={(e) => {
                          // Csak számokat engedélyez
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
          
          <div className="mt-4">
            <FormField
              control={form.control}
              name="area_sqm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Padlás alapterülete (m²) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="mt-4">
            <FormField
              control={form.control}
              name="floor_material"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Padlásfödém anyaga *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="mt-2 space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="wood" id="floor-wood" />
                        <Label htmlFor="floor-wood">Fa</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="prefab_rc" id="floor-prefab" />
                        <Label htmlFor="floor-prefab">Előre gyártott vb. (betongerendás)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="monolithic_rc" id="floor-monolithic" />
                        <Label htmlFor="floor-monolithic">Monolit v.b.</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="rc_slab" id="floor-slab" />
                        <Label htmlFor="floor-slab">Vasbeton tálcás</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="hollow_block" id="floor-hollow" />
                        <Label htmlFor="floor-hollow">Horcsik</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="other" id="floor-other" />
                        <Label htmlFor="floor-other">Egyéb</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {floorMaterial === 'other' && (
              <div className="mt-4">
                <FormField
                  control={form.control}
                  name="floor_material_extra"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Födém anyaga (egyéb) *</FormLabel>
                      <FormControl>
                        <Input placeholder="Adja meg a födém anyagát" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Mentés...' : 'Adatok mentése'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
