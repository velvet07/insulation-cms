/**
 * Lifecycle hooks for Photo Category
 * Auto-generate slug from name if not provided
 */

export default {
  async beforeCreate(event: any) {
    const { data } = event.params;
    
    // Log for debugging
    if (typeof strapi !== 'undefined' && strapi.log) {
      strapi.log.info('[Photo Category beforeCreate] Event params:', JSON.stringify({ data }));
    }
    
    // Auto-generate slug from name if not provided
    if (data && data.name && !data.slug) {
      const slug = data.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen
      
      data.slug = slug;
      
      if (typeof strapi !== 'undefined' && strapi.log) {
        strapi.log.info('[Photo Category beforeCreate] Generated slug:', slug);
      }
    }
  },

  async beforeUpdate(event: any) {
    const { data } = event.params;
    
    // Auto-regenerate slug if name is being updated and slug is not explicitly provided
    if (data && data.name && data.slug === undefined) {
      const slug = data.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen
      
      data.slug = slug;
      
      if (typeof strapi !== 'undefined' && strapi.log) {
        strapi.log.info('[Photo Category beforeUpdate] Generated slug:', slug);
      }
    }
  },
};