import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::photo.photo', ({ strapi }) => ({
  /**
   * Custom endpoint a Photo létrehozásához relation mezőkkel
   * A Strapi v5 Document Service API-t használja
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

      // Strapi v5 Document Service API - a relation mezőket documentId-ként kell megadni
      const photoData: any = {
        name: name || 'Unnamed photo',
        file: typeof file === 'number' ? file : parseInt(file, 10), // Media marad numerikus ID
        category: category, // documentId string - Strapi v5 elfogadja
        project: project, // documentId string - Strapi v5 elfogadja
        order: typeof order === 'number' ? order : parseInt(order, 10) || 0,
      };

      // User kapcsolás (opcionális) - users-permissions user numerikus ID-t használ
      if (uploaded_by) {
        photoData.uploaded_by = typeof uploaded_by === 'number' ? uploaded_by : parseInt(uploaded_by, 10);
      }

      strapi.log.info('Creating photo with data:', JSON.stringify(photoData));

      // Létrehozzuk a Photo rekordot a Document Service API-val
      const photo = await strapi.documents('api::photo.photo').create({
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
