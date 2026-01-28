/**
 * Global permission matrix routes (shared across users/browsers).
 *
 * NOTE: The frontend previously used localStorage-only "mock persistence".
 * This route enables real persistence so changes apply everywhere.
 */
export default {
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/permission-matrix',
      handler: 'api::company.company.getPermissionMatrix',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/permission-matrix',
      handler: 'api::company.company.updatePermissionMatrix',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

