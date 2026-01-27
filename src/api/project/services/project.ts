import { factories } from '@strapi/strapi';

/**
 * project service (TS)
 *
 * Important: ensure the core service exists in `dist/` after TS build.
 */
export default factories.createCoreService('api::project.project');

