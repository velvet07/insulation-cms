/**
 * Custom route for billing started projects
 */

export default {
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/projects/started-for-billing',
      handler: 'api::project.project.startedForBilling',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

