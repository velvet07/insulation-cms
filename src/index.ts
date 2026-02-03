import type { Core } from '@strapi/strapi';

const defaultPhotoCategories = [
  { name: 'Külső képek', order: 0, required: true },
  { name: 'Üres padlástér', order: 1, required: true },
  { name: 'Kivitelezés közbeni képek', order: 2, required: true },
  { name: 'Rétegrend', order: 3, required: true },
  { name: 'Hőtermelő', order: 4, required: true },
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
      
      for (const categoryData of defaultPhotoCategories) {
        try {
          // Ellenőrizzük, hogy létezik-e már ilyen névvel
          const existing = await photoCategoryService.findMany({
            filters: { name: { $eq: categoryData.name } },
            limit: 1,
          });

          if (existing.results && existing.results.length > 0) {
            console.log(`⏭️  Photo category "${categoryData.name}" already exists, skipping...`);
            continue;
          }

          // Létrehozzuk a kategóriát
          await photoCategoryService.create({
            data: {
              name: categoryData.name,
              order: categoryData.order,
              required: categoryData.required,
            },
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
  },
};
