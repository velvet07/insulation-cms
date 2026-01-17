import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::photo.photo', ({ strapi }) => ({
  /**
   * Custom endpoint a Photo létrehozásához relation mezőkkel
   * A Strapi v5 Document Service API-t használja
   */
  async createWithRelations(ctx) {
    try {
      const { name, file, category, project, uploaded_by, order = 0 } = ctx.request.body.data || ctx.request.body;
      
      strapi.log.info('createWithRelations called with:', { name, file, category, project, uploaded_by, order });
      
      if (!file) {
        return ctx.badRequest('A file mező kötelező');
      }
      
      if (!category) {
        return ctx.badRequest('A category mező kötelező');
      }
      
      if (!project) {
        return ctx.badRequest('A project mező kötelező');
      }

      // Document Service API használata a Photo létrehozásához
      const photoData: any = {
        name: name || 'Unnamed photo',
        file: typeof file === 'number' ? file : parseInt(file, 10),
        order: typeof order === 'number' ? order : parseInt(order, 10) || 0,
      };

      // Relation mezők - documentId alapján keressük meg a rekordokat
      // Category kapcsolás
      if (category) {
        const categoryEntry = await strapi.documents('api::photo-category.photo-category').findFirst({
          filters: { documentId: { $eq: category.toString() } },
        });
        if (categoryEntry) {
          photoData.category = categoryEntry.id;
        } else {
          // Próbáljuk meg numerikus ID-ként
          photoData.category = parseInt(category, 10) || category;
        }
      }

      // Project kapcsolás
      if (project) {
        const projectEntry = await strapi.documents('api::project.project').findFirst({
          filters: { documentId: { $eq: project.toString() } },
        });
        if (projectEntry) {
          photoData.project = projectEntry.id;
        } else {
          photoData.project = parseInt(project, 10) || project;
        }
      }

      // User kapcsolás (opcionális)
      if (uploaded_by) {
        photoData.uploaded_by = typeof uploaded_by === 'number' ? uploaded_by : parseInt(uploaded_by, 10);
      }

      strapi.log.info('Creating photo with resolved data:', photoData);

      // Létrehozzuk a Photo rekordot az Entity Service API-val
      const photo = await strapi.entityService.create('api::photo.photo', {
        data: photoData,
        populate: ['file', 'category', 'project'],
      });

      strapi.log.info('Photo created successfully:', photo);

      return { data: photo };
    } catch (error: any) {
      strapi.log.error('Error in createWithRelations:', error);
      return ctx.badRequest(error.message || 'Hiba történt a fénykép létrehozása során');
    }
  },
}));
