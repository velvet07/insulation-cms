/**
 * Custom route for bulk project export (ZIP)
 */

export default {
  type: 'content-api',
  routes: [
    {
      method: 'POST',
      path: '/projects/bulk-export',
      handler: 'api::project.project.bulkExport',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

