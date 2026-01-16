/**
 * document controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::document.document', ({ strapi }) => ({
  /**
   * Generál egy dokumentumot template-ből és projekt adatokból
   */
  async generate(ctx) {
    try {
      const { templateId, projectId } = ctx.request.body.data || ctx.request.body;
      const userId = ctx.state.user?.id;

      strapi.log.info('Generate document request:', { templateId, projectId, userId });

      if (!templateId || !projectId) {
        return ctx.badRequest('templateId és projectId kötelező');
      }

      // @ts-ignore
      const document = await strapi.service('api::document.document').generateDocument({
        templateId,
        projectId,
        userId,
      });

      strapi.log.info('Document generated successfully:', document.documentId || document.id);

      return ctx.created({ data: document });
    } catch (error: any) {
      strapi.log.error('Error in generate controller:', error);
      strapi.log.error('Error message:', error.message);
      strapi.log.error('Error stack:', error.stack);
      return ctx.badRequest(error.message || 'Hiba történt a dokumentum generálása során');
    }
  },

  /**
   * Újragenerálja egy dokumentumot az aláírással
   */
  async regenerateWithSignature(ctx) {
    try {
      const { documentId, signatureData } = ctx.request.body.data || ctx.request.body;

      if (!documentId || !signatureData) {
        return ctx.badRequest('documentId és signatureData kötelező');
      }

      // @ts-ignore
      const document = await strapi.service('api::document.document').regenerateDocumentWithSignature(
        documentId,
        signatureData
      );

      strapi.log.info('Document regenerated with signature successfully:', document.documentId || document.id);

      return { data: document };
    } catch (error: any) {
      strapi.log.error('Error in regenerateWithSignature controller:', error);
      return ctx.badRequest(error.message || 'Hiba történt a dokumentum újragenerálása során');
    }
  },
}));
