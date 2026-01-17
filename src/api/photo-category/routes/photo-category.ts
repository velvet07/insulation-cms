import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::photo-category.photo-category', {
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
