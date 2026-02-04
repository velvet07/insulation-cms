/**
 * Project lifecycles
 * 
 * Validates that every project has a main contractor (company)
 * Auto-assigns parent_company if subcontractor is set but company is not
 */

export default {
  /**
   * Before creating a project
   */
  async beforeCreate(event: any) {
    try {
      // eslint-disable-next-line no-undef
      const strapiAny: any = typeof strapi !== 'undefined' ? strapi : null;
      if (!strapiAny) return;

      const { data } = event.params;
      
      // Validate and auto-assign company
      await strapiAny.service('api::project.project').validateAndSetCompany(data);
    } catch (e: any) {
      // eslint-disable-next-line no-undef
      if (typeof strapi !== 'undefined' && strapi?.log) {
        // eslint-disable-next-line no-undef
        strapi.log.error(`[Project lifecycle] beforeCreate validation failed: ${e?.message || e}`);
      }
      throw e; // Re-throw to prevent project creation
    }
  },

  /**
   * Before updating a project
   */
  async beforeUpdate(event: any) {
    try {
      // eslint-disable-next-line no-undef
      const strapiAny: any = typeof strapi !== 'undefined' ? strapi : null;
      if (!strapiAny) return;

      const { data } = event.params;
      
      // Only validate if company or subcontractor is being modified
      if (data.hasOwnProperty('company') || data.hasOwnProperty('subcontractor')) {
        // Get current project data to merge with updates
        const whereClause = event.params.where;
        const projectId = whereClause.id;
        const documentId = whereClause.documentId;
        
        if (projectId || documentId) {
          let currentProject: any = null;
          
          // Try to load the project using the correct method based on ID type
          if (documentId) {
            // Use Document Service API for documentId (Strapi v5)
            try {
              currentProject = await strapiAny.documents('api::project.project').findOne({
                documentId,
                populate: ['company', 'subcontractor'],
              });
            } catch (docErr: any) {
              strapiAny.log.warn(`[Project lifecycle] Document Service failed, trying Entity Service: ${docErr?.message}`);
            }
          }
          
          // Fallback to Entity Service with numeric id
          if (!currentProject && projectId) {
            currentProject = await strapiAny.entityService.findOne(
              'api::project.project',
              projectId,
              { populate: ['company', 'subcontractor'] }
            );
          }

          if (currentProject) {
            // Merge current data with updates to check final state
            const mergedData = {
              company: data.company !== undefined ? data.company : currentProject?.company,
              subcontractor: data.subcontractor !== undefined ? data.subcontractor : currentProject?.subcontractor,
            };

            // Validate and auto-assign company
            await strapiAny.service('api::project.project').validateAndSetCompany(mergedData);
            
            // Apply the validated company back to data if it was auto-assigned
            if (mergedData.company && !data.company) {
              data.company = mergedData.company;
            }
          }
        }
      }
    } catch (e: any) {
      // eslint-disable-next-line no-undef
      if (typeof strapi !== 'undefined' && strapi?.log) {
        // eslint-disable-next-line no-undef
        strapi.log.error(`[Project lifecycle] beforeUpdate validation failed: ${e?.message || e}`);
      }
      throw e; // Re-throw to prevent project update
    }
  },
};
