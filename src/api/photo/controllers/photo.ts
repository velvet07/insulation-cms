import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::photo.photo', ({ strapi }) => ({
  /**
   * Override find metódus, hogy biztosan populate-olja a relation mezőket
   */
  async find(ctx) {
    // Entity Service API használata populate-dal
    // A query paramétereket parse-oljuk
    const query = ctx.query || {};
    
    // Parse sort - lehet string vagy object
    let sort: any = ['order:asc', 'createdAt:desc'];
    if (query.sort) {
      if (typeof query.sort === 'string') {
        sort = [query.sort];
      } else if (Array.isArray(query.sort)) {
        sort = query.sort;
      } else if (typeof query.sort === 'object') {
        sort = Object.entries(query.sort).map(([key, value]) => `${key}:${value}`);
      }
    }

    // Entity Service API findMany
    const photos = await strapi.entityService.findMany('api::photo.photo', {
      filters: (query.filters as any) || {},
      sort: sort as any,
      populate: ['file', 'category', 'project', 'uploaded_by'],
      ...(query.pagination ? { pagination: query.pagination } : {}),
    });

    return { data: photos };
  },

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

      strapi.log.info('Photo created successfully (raw):', JSON.stringify(photo));

      // Újra lekérjük a photot populate-dal, hogy biztosan benne legyenek a relation mezők
      const populatedPhoto = await strapi.entityService.findOne('api::photo.photo', photo.id, {
        populate: ['file', 'category', 'project'],
      });

      strapi.log.info('Photo created successfully (populated):', JSON.stringify(populatedPhoto));

      return { data: populatedPhoto || photo };
    } catch (error: any) {
      strapi.log.error('Error in createWithRelations:', error.message, error.stack);
      return ctx.badRequest(error.message || 'Hiba történt a fénykép létrehozása során');
    }
  },

  /**
   * Custom endpoint a Photo frissítéséhez relation mezőkkel
   * Entity Service API-t használjuk, mert jobban kezeli a relation mezőket
   */
  async updateWithRelations(ctx) {
    try {
      const { id } = ctx.params;
      const { name, file, category, project, uploaded_by, order } = ctx.request.body.data || ctx.request.body;
      
      strapi.log.info('updateWithRelations called with:', JSON.stringify({ id, name, file, category, project, uploaded_by, order }));

      // Először megkeressük a photot (documentId vagy id alapján)
      let photoDoc;
      try {
        // Try documentId first (Strapi v5)
        photoDoc = await strapi.documents('api::photo.photo').findOne({
          documentId: id.toString(),
        });
      } catch (error) {
        // If not found, try numeric id
        photoDoc = await strapi.entityService.findOne('api::photo.photo', parseInt(id, 10));
      }

      if (!photoDoc) {
        return ctx.notFound('Fénykép nem található');
      }

      const photoData: any = {};

      // Name update
      if (name !== undefined) {
        photoData.name = name;
      }

      // File update (media relation)
      if (file !== undefined) {
        photoData.file = typeof file === 'number' ? file : parseInt(file, 10);
      }

      // Category update - convert documentId to numeric ID
      if (category !== undefined) {
        if (category === null) {
          photoData.category = null;
        } else {
          let categoryDoc;
          
          // Check if category is a numeric ID (number or numeric string)
          const categoryId = typeof category === 'number' ? category : parseInt(category, 10);
          const isNumericId = !isNaN(categoryId) && categoryId.toString() === category.toString();
          
          if (isNumericId) {
            // If it's already a numeric ID, use it directly
            try {
              categoryDoc = await strapi.entityService.findOne('api::photo-category.photo-category', categoryId);
            } catch (error) {
              strapi.log.error('Error finding category by numeric id:', error);
              return ctx.badRequest(`Kategória nem található: ${category}`);
            }
          } else {
            // If it's a documentId (string), try to find by documentId first
            try {
              categoryDoc = await strapi.documents('api::photo-category.photo-category').findOne({
                documentId: category.toString(),
              });
            } catch (error) {
              strapi.log.error('Error finding category by documentId:', error);
              return ctx.badRequest(`Kategória nem található: ${category}`);
            }
          }

          if (!categoryDoc) {
            return ctx.badRequest(`Kategória nem található: ${category}`);
          }

          photoData.category = categoryDoc.id; // Numerikus ID
        }
      }

      // Project update - convert documentId to numeric ID
      if (project !== undefined) {
        if (project === null) {
          photoData.project = null;
        } else {
          let projectDoc;
          
          // Check if project is a numeric ID (number or numeric string)
          const projectId = typeof project === 'number' ? project : parseInt(project, 10);
          const isNumericId = !isNaN(projectId) && projectId.toString() === project.toString();
          
          if (isNumericId) {
            // If it's already a numeric ID, use it directly
            try {
              projectDoc = await strapi.entityService.findOne('api::project.project', projectId);
            } catch (error) {
              strapi.log.error('Error finding project by numeric id:', error);
              return ctx.badRequest(`Projekt nem található: ${project}`);
            }
          } else {
            // If it's a documentId (string), try to find by documentId first
            try {
              projectDoc = await strapi.documents('api::project.project').findOne({
                documentId: project.toString(),
              });
            } catch (error) {
              strapi.log.error('Error finding project by documentId:', error);
              return ctx.badRequest(`Projekt nem található: ${project}`);
            }
          }

          if (!projectDoc) {
            return ctx.badRequest(`Projekt nem található: ${project}`);
          }

          photoData.project = projectDoc.id; // Numerikus ID
        }
      }

      // User update
      if (uploaded_by !== undefined) {
        if (uploaded_by === null) {
          photoData.uploaded_by = null;
        } else {
          photoData.uploaded_by = typeof uploaded_by === 'number' ? uploaded_by : parseInt(uploaded_by, 10);
        }
      }

      // Order update
      if (order !== undefined) {
        photoData.order = typeof order === 'number' ? order : parseInt(order, 10) || 0;
      }

      strapi.log.info('Updating photo with data:', JSON.stringify(photoData));

      // Use numeric id for update
      const numericId = photoDoc.id;

      // Entity Service API használata - ez jobban kezeli a relation mezőket
      const updatedPhoto = await strapi.entityService.update('api::photo.photo', numericId, {
        data: photoData,
        populate: ['file', 'category', 'project'],
      });

      strapi.log.info('Photo updated successfully:', JSON.stringify(updatedPhoto));

      return { data: updatedPhoto };
    } catch (error: any) {
      strapi.log.error('Error in updateWithRelations:', error.message, error.stack);
      return ctx.badRequest(error.message || 'Hiba történt a fénykép frissítése során');
    }
  },
}));
