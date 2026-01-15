'use client';

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
  // Szerződő lakcíme
  client_street: z.string().min(1, 'Az utca, házszám kötelező'),
  client_city: z.string().min(1, 'A város kötelező'),
  client_zip: z.string().min(1, 'Az IRSZ kötelező'),
  // Születési adatok
  client_birth_place: z.string().min(1, 'A születési hely kötelező'),
  client_birth_date: z.string().min(1, 'A születési idő kötelező'),
  // Egyéb adatok
  client_mother_name: z.string().min(1, 'Az anyja neve kötelező'),
  client_tax_id: z.string().min(1, 'Az adóazonosító kötelező'),
  // Ingatlan adatok
  property_address_same: z.boolean(),
  property_street: z.string().optional(),
  property_city: z.string().optional(),
  property_zip: z.string().optional(),
  area_sqm: z.number().min(0.01, 'A padlás alapterülete kötelező'),
  floor_material: z.enum(['wood', 'prefab_rc', 'monolithic_rc', 'rc_slab', 'hollow_block'], {
    message: 'A padlásfödém anyaga kötelező',
  }),
}).superRefine((data, ctx) => {
  // Ha property_address_same === false, akkor a property mezők kötelezőek
  if (!data.property_address_same) {
    if (!data.property_street || data.property_street.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Az ingatlan utca, házszám kötelező',
        path: ['property_street'],
      });
    }
    if (!data.property_city || data.property_city.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Az ingatlan város kötelező',
        path: ['property_city'],
      });
    }
    if (!data.property_zip || data.property_zip.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Az ingatlan IRSZ kötelező',
        path: ['property_zip'],
      });
    }
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
      property_address_same: project.property_address_same ?? false,
      property_street: project.property_street || '',
      property_city: project.property_city || '',
      property_zip: project.property_zip || '',
      area_sqm: project.area_sqm || 0,
      floor_material: project.floor_material || 'wood',
    },
  });

  const propertyAddressSame = form.watch('property_address_same');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    <Input placeholder="IRSZ" {...field} />
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
                    <Input type="date" {...field} />
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
                    <Input {...field} />
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
                      <Input placeholder="IRSZ" {...field} />
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
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
