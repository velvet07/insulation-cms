import { factories } from '@strapi/strapi';

interface CompanyWithParent {
  id: number;
  documentId: string;
  parent_company?: {
    id: number;
    documentId: string;
  };
}

/**
 * project service (TS)
 *
 * Important: ensure the core service exists in `dist/` after TS build.
 */
export default factories.createCoreService('api::project.project', ({ strapi }) => ({
  /**
   * Validate and auto-assign main contractor (company) when subcontractor is set
   */
  async validateAndSetCompany(data: any) {
    // If subcontractor is set but company is not, try to auto-assign parent_company
    if (data.subcontractor && !data.company) {
      try {
        // Get subcontractor details with parent_company
        const subcontractorId = typeof data.subcontractor === 'object' 
          ? (data.subcontractor.documentId || data.subcontractor.id || data.subcontractor)
          : data.subcontractor;

        const subcontractor = await strapi.entityService.findOne(
          'api::company.company',
          subcontractorId,
          { populate: ['parent_company'] }
        ) as CompanyWithParent;

        if (subcontractor?.parent_company) {
          // Auto-assign parent company as the main contractor
          data.company = subcontractor.parent_company.documentId || subcontractor.parent_company.id;
          strapi.log.info(`[Project Service] Auto-assigned main contractor (company) from subcontractor's parent_company: ${data.company}`);
        } else {
          // Subcontractor has no parent company - this is an error
          throw new Error(
            'A projektnek fővállalkozót (company) kell rendelni. Az alvállalkozónak nincs beállítva szülő céges, kérjük adja meg manuálisan a fővállalkozót.'
          );
        }
      } catch (error) {
        strapi.log.error('[Project Service] Error auto-assigning company:', error);
        throw error;
      }
    }

    // Final validation: every project must have a company (main contractor)
    if (!data.company) {
      throw new Error(
        'A projekthez kötelező fővállalkozót (company) rendelni. Olyan projekt nem lehet, amihez nincs fővállalkozó.'
      );
    }

    return data;
  },
}));

