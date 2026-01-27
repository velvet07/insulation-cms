import { factories } from '@strapi/strapi';

/**
 * project router (TS)
 *
 * Important: this repo builds Strapi via TypeScript compilation into `dist/`.
 * If we only have `routes/project.js`, it will NOT be emitted to `dist/` (no `allowJs`),
 * which can result in missing `/api/projects` routes in production.
 */
export default factories.createCoreRouter('api::project.project');

