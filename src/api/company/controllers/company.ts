import { factories } from '@strapi/strapi';

const STORE_KEY = 'permission_matrix_v3';

export default factories.createCoreController('api::company.company', ({ strapi }) => ({
  async getPermissionMatrix(ctx) {
    try {
      // @ts-ignore - store API exists at runtime
      const store = strapi.store({ type: 'core', name: 'insulation-crm' });
      const value = await store.get({ key: STORE_KEY });
      return { data: value || null };
    } catch (e: any) {
      strapi.log.error('[permission-matrix] get failed', e);
      return ctx.internalServerError('Nem sikerült betölteni a jogosultsági mátrixot');
    }
  },

  async updatePermissionMatrix(ctx) {
    const body = (ctx.request as any)?.body?.data ?? (ctx.request as any)?.body ?? null;
    if (!body || typeof body !== 'object') {
      return ctx.badRequest('Érvénytelen jogosultsági mátrix');
    }

    try {
      // @ts-ignore - store API exists at runtime
      const store = strapi.store({ type: 'core', name: 'insulation-crm' });
      await store.set({ key: STORE_KEY, value: body });
      return { data: body };
    } catch (e: any) {
      strapi.log.error('[permission-matrix] update failed', e);
      return ctx.internalServerError('Nem sikerült menteni a jogosultsági mátrixot');
    }
  },
}));
