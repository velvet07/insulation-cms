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
      strapi.log.error('Error in generate controller:', error?.message ?? String(error));
      if (error?.stack) strapi.log.error('Stack:', error.stack);
      if (error?.properties?.errors) {
        strapi.log.error('Docxtemplater errors:', JSON.stringify(error.properties.errors, null, 2));
      }
      return ctx.badRequest(error?.message || 'Hiba történt a dokumentum generálása során');
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

  /**
   * eIDAS AES PAdES digitális aláírás alkalmazása
   */
  async signPades(ctx) {
    try {
      const {
        documentId,
        signerRole,
        signerName,
        signerEmail,
        companyName,
        visualSignature,
      } = ctx.request.body.data || ctx.request.body;

      // Validáció
      if (!documentId || !signerRole || !signerName || !signerEmail) {
        return ctx.badRequest('documentId, signerRole, signerName és signerEmail kötelező');
      }
      if (!['contractor', 'client'].includes(signerRole)) {
        return ctx.badRequest('signerRole értéke "contractor" vagy "client" kell legyen');
      }

      strapi.log.info('PAdES sign request:', { documentId, signerRole, signerName, signerEmail });

      // @ts-ignore
      const document = await strapi.service('api::document.document').signDocumentPades({
        documentId,
        signerRole,
        signerName,
        signerEmail,
        companyName,
        visualSignature,
      });

      strapi.log.info('PAdES signature applied successfully:', document.documentId || document.id);

      return { data: document };
    } catch (error: any) {
      strapi.log.error('Error in signPades controller:', error);
      strapi.log.error('Error message:', error.message);
      return ctx.badRequest(error.message || 'Hiba történt a PAdES aláírás során');
    }
  },

  /**
   * Dokumentum aláírásainak ellenőrzése
   */
  async verifySignatures(ctx) {
    try {
      const { documentId } = ctx.params;

      if (!documentId) {
        return ctx.badRequest('documentId kötelező');
      }

      // @ts-ignore
      const result = await strapi.service('api::document.document').verifyDocumentSignatures(documentId);

      return { data: result };
    } catch (error: any) {
      strapi.log.error('Error in verifySignatures controller:', error);
      return ctx.badRequest(error.message || 'Hiba történt az aláírás ellenőrzése során');
    }
  },

}));
