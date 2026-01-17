import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::photo.photo', ({ strapi }) => ({
  /**
   * Custom endpoint a Photo létrehozásához relation mezőkkel
   * Entity Service API-t használjuk, mert jobban kezeli a relation mezőket
   */
  async createWithRelations(ctx) {
    try {
      const { name, file, category, project, uploaded_by, order = 0 } = ctx.request.body.data || ctx.request.body;
      
      strapi.log.info('createWithRelations called with:', JSON.stringify({ name, file, category, project, uploaded_by, order }));
      
      if (!file) {
        return ctx.badRequest('A file mező kötelező');
      }
      
      if (!category) {
        return ctx.badRequest('A category mező kötelező');
      }
      
      if (!project) {
        return ctx.badRequest('A project mező kötelező');
      }

      // Először megkeressük a category és project rekordokat documentId alapján
      const categoryDoc = await strapi.documents('api::photo-category.photo-category').findOne({
        documentId: category.toString(),
      });
      
      if (!categoryDoc) {
        return ctx.badRequest(`Kategória nem található: ${category}`);
      }

      const projectDoc = await strapi.documents('api::project.project').findOne({
        documentId: project.toString(),
      });
      
      if (!projectDoc) {
        return ctx.badRequest(`Projekt nem található: ${project}`);
      }

      // Entity Service API - numerikus ID-kat használ a relation mezőknél
      const photoData: any = {
        name: name || 'Unnamed photo',
        file: typeof file === 'number' ? file : parseInt(file, 10),
        category: categoryDoc.id, // Numerikus ID
        project: projectDoc.id, // Numerikus ID
        order: typeof order === 'number' ? order : parseInt(order, 10) || 0,
      };

      // User kapcsolás (opcionális)
      if (uploaded_by) {
        photoData.uploaded_by = typeof uploaded_by === 'number' ? uploaded_by : parseInt(uploaded_by, 10);
      }

      strapi.log.info('Creating photo with data:', JSON.stringify(photoData));

      // Entity Service API használata - ez jobban kezeli a relation mezőket
      const photo = await strapi.entityService.create('api::photo.photo', {
        data: photoData,
        populate: ['file', 'category', 'project'],
      });

      strapi.log.info('Photo created successfully:', JSON.stringify(photo));

      return { data: photo };
    } catch (error: any) {
      strapi.log.error('Error in createWithRelations:', error.message, error.stack);
      return ctx.badRequest(error.message || 'Hiba történt a fénykép létrehozása során');
    }
  },
}));
