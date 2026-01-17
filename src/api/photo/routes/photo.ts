import { factories } from '@strapi/strapi';

// Custom routes
const customRoutes = {
  routes: [
    {
      method: 'POST',
      path: '/photos/create-with-relations',
      handler: 'photo.createWithRelations',
      config: {
        auth: false,
      },
    },
  ],
};

// Core routes with custom config
const coreRouter = factories.createCoreRouter('api::photo.photo', {
  config: {
    find: {
      auth: false,
    },
    findOne: {
      auth: false,
    },
    create: {
      auth: false,
    },
    update: {
      auth: false,
    },
    delete: {
      auth: false,
    },
  },
});

// Export both custom and core routes
export default {
  routes: [
    ...customRoutes.routes,
    ...coreRouter.routes,
  ],
};
