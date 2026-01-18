import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::photo-category.photo-category', ({ strapi }) => ({
  /**
   * Override create to auto-generate slug if not provided
   */
  async create(params: any) {
    // Generate slug from name if not provided
    if (params.data && params.data.name && !params.data.slug) {
      // Create slug from name: lowercase, replace spaces with hyphens, remove special chars
      const slug = params.data.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen
      
      params.data.slug = slug;
    }
    
    return await super.create(params);
  },

  /**
   * Override update to auto-generate slug if name changed and slug not provided
   */
  async update(entityId: any, params: any) {
    // If name is being updated and slug is not provided, regenerate slug
    if (params.data && params.data.name && params.data.slug === undefined) {
      const slug = params.data.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      
      params.data.slug = slug;
    }
    
    return await super.update(entityId, params);
  },
}));