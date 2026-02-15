import type { Core } from '@strapi/strapi';
import PizZip from 'pizzip';

/**
 * Sablon DOCX-ból kiolvassa, mely aláírás tokenek ({%signature1}, {%signature2}) szerepelnek.
 * XML tageket stripeli, hogy a Word run-szétbontás ne okozzon problémát.
 */
function detectSignatureTokensInDocx(docxBuffer: Buffer): { has1: boolean; has2: boolean } {
  try {
    const zip = new PizZip(docxBuffer);
    const xmlFiles = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/footer1.xml', 'word/footer2.xml'];
    let plainText = '';
    for (const fn of xmlFiles) {
      const f = zip.file(fn);
      if (f) plainText += f.asText().replace(/<[^>]+>/g, '') + ' ';
    }
    return { has1: /signature1/.test(plainText), has2: /signature2/.test(plainText) };
  } catch {
    return { has1: true, has2: true };
  }
}

const defaultPhotoCategories = [
  { name: 'Külső képek', order: 0, required: true },
  { name: 'Üres padlástér', order: 1, required: true },
  { name: 'Kivitelezés közbeni képek', order: 2, required: true },
  { name: 'Rétegrend', order: 3, required: true },
  { name: 'Hőtermelő', order: 4, required: true },
];

const defaultMaterials = [
  { name: 'Szigetelés 10 cm', category: 'insulation', thickness_cm: 'cm10', coverage_per_roll: 9.24, rolls_per_pallet: 24 },
  { name: 'Szigetelés 12.5 cm', category: 'insulation', thickness_cm: 'cm12_5', coverage_per_roll: 7.68, rolls_per_pallet: 24 },
  { name: 'Szigetelés 15 cm', category: 'insulation', thickness_cm: 'cm15', coverage_per_roll: 6.12, rolls_per_pallet: 24 },
  { name: 'Gőzfólia', category: 'vapor_barrier', coverage_per_roll: 60, rolls_per_pallet: 24 },
  { name: 'Légáteresztő fólia', category: 'breathable_membrane', coverage_per_roll: 75, rolls_per_pallet: 24 },
];

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // ONE-TIME FIX: Fix invalid project statuses
    // This can be removed after running once successfully
    try {
      const VALID_STATUSES = [
        'pending',
        'in_progress',
        'scheduled',
        'execution_completed',
        'ready_for_review',
        'sent_back_for_revision',
        'approved',
        'completed',
        'archived'
      ];

      const knex = strapi.db.connection;

      // Check for projects with null or invalid status
      const invalidProjects = await knex('projects')
        .whereNull('status')
        .orWhere('status', '')
        .orWhereNotIn('status', VALID_STATUSES);

      const invalidCount = invalidProjects.length;

      if (invalidCount > 0) {
        console.log(`🔧 Found ${invalidCount} projects with invalid status, fixing...`);

        // Fix all invalid statuses to 'pending'
        const fixed = await knex('projects')
          .whereNull('status')
          .orWhere('status', '')
          .orWhereNotIn('status', VALID_STATUSES)
          .update({ status: 'pending' });

        console.log(`✅ Fixed ${fixed} projects - set status to 'pending'`);
      } else {
        console.log('✅ All project statuses are valid');
      }
    } catch (error: any) {
      console.error('⚠️  Could not fix project statuses:', error.message);
    }

    try {
      // Létrehozzuk a default fénykép kategóriákat, ha még nem léteznek
      const photoCategoryService = strapi.documents('api::photo-category.photo-category');

      // Helper to generate slug from name
      const generateSlug = (name: string) => name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      for (const categoryData of defaultPhotoCategories) {
        try {
          // Ellenőrizzük, hogy létezik-e már ilyen névvel
          const existing = await photoCategoryService.findMany({
            filters: { name: { $eq: categoryData.name } },
            limit: 1,
          });

          // findMany returns array directly in Strapi v5
          if (existing && existing.length > 0) {
            console.log(`⏭️  Photo category "${categoryData.name}" already exists, skipping...`);
            continue;
          }

          // Létrehozzuk a kategóriát (slug required)
          await photoCategoryService.create({
            data: {
              name: categoryData.name,
              slug: generateSlug(categoryData.name),
              order: categoryData.order,
              required: categoryData.required,
            } as any, // Cast to any to bypass strict typing
          });

          console.log(`✅ Created default photo category: "${categoryData.name}"`);
        } catch (error: any) {
          // Ha a content type még nem létezik vagy nincs permission, nem csinálunk semmit
          if (error.message?.includes('not found') || error.message?.includes('permission')) {
            console.warn(`⚠️  Cannot create photo category "${categoryData.name}": ${error.message}`);
          } else {
            console.error(`❌ Error creating photo category "${categoryData.name}":`, error.message);
          }
        }
      }
    } catch (error: any) {
      // Ha a content type még nem létezik, nem csinálunk semmit
      console.warn('⚠️  Photo category content type may not exist yet:', error.message);
    }

    // Create default materials if they don't exist
    try {
      console.log('🔍 Checking Material content type...');
      const materialService = strapi.documents('api::material.material');
      
      for (const materialData of defaultMaterials) {
        try {
          const existing = await materialService.findMany({
            filters: { 
              name: { $eq: materialData.name },
              category: { $eq: materialData.category }
            },
            limit: 1,
          });

          if (existing && existing.length > 0) {
            console.log(`⏭️  Material "${materialData.name}" already exists, skipping...`);
            continue;
          }

          await materialService.create({
            data: materialData as any,
          });

          console.log(`✅ Created default material: "${materialData.name}"`);
        } catch (error: any) {
          console.error(`❌ Error creating material "${materialData.name}":`, error.message);
        }
      }
      
      console.log('✅ Material bootstrap completed');
    } catch (error: any) {
      console.error('⚠️  Material content type bootstrap error:', error.message);
    }

    // Template signature flags auto-detect: parse DOCX for all templates
    try {
      const allTemplates = await strapi.entityService.findMany('api::template.template', {
        populate: ['template_file'],
      });

      if (allTemplates && allTemplates.length > 0) {
        const serverUrl = strapi.config.get('server.url') || 'https://cms.emermedia.eu';
        let updated = 0;

        for (const tpl of allTemplates as any[]) {
          if (!tpl.template_file || !tpl.template_file.url) continue;

          try {
            const fileUrl = tpl.template_file.url.startsWith('http')
              ? tpl.template_file.url
              : `${serverUrl}${tpl.template_file.url}`;

            const resp = await fetch(fileUrl);
            if (!resp.ok) continue;

            const buf = Buffer.from(await resp.arrayBuffer());
            const { has1, has2 } = detectSignatureTokensInDocx(buf);

            if (tpl.require_signature1 !== has1 || tpl.require_signature2 !== has2) {
              await strapi.entityService.update('api::template.template', tpl.id, {
                data: { require_signature1: has1, require_signature2: has2 },
              });
              updated++;
              console.log(`📝 Template "${tpl.name}" signature flags: sig1=${has1}, sig2=${has2}`);
            }
          } catch (err: any) {
            console.warn(`⚠️  Template "${tpl.name}" signature detect failed: ${err.message}`);
          }
        }

        if (updated > 0) {
          console.log(`✅ Updated ${updated} template(s) signature flags from DOCX`);
        } else {
          console.log('✅ All template signature flags up to date');
        }
      }
    } catch (error: any) {
      console.warn('⚠️  Template signature bootstrap error:', error.message);
    }
  },
};
