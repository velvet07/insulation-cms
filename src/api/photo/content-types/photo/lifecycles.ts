/**
 * Lifecycle hooks for Photo
 * - Mark project as "started" on first photo create
 */

export default {
  async afterCreate(event: any) {
    try {
      // eslint-disable-next-line no-undef
      const strapiAny: any = typeof strapi !== 'undefined' ? strapi : null;
      if (!strapiAny) return;

      const result = event?.result;
      const projectRel = result?.project;
      const projectId = typeof projectRel === 'object' ? projectRel?.id : projectRel;
      if (!projectId) return;

      const project = await strapiAny.entityService.findOne('api::project.project', projectId, {
        populate: ['company'],
      });
      if (!project) return;

      if (project.started_at) return;

      await strapiAny.entityService.update('api::project.project', projectId, {
        data: {
          started_at: new Date().toISOString(),
        },
      });
    } catch (e: any) {
      // eslint-disable-next-line no-undef
      if (typeof strapi !== 'undefined' && strapi?.log) {
        // eslint-disable-next-line no-undef
        strapi.log.warn(`[Photo lifecycle] failed to set project.started_at: ${e?.message || e}`);
      }
    }
  },
};

