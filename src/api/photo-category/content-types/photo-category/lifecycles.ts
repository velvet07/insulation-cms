/**
 * Lifecycle hooks for Photo Category
 * Auto-generate slug from name if not provided
 */

export default {
  async beforeCreate(event: any) {
    const { data } = event.params;
    
    // Auto-generate slug from name if not provided
    if (data && data.name && !data.slug) {
      data.slug = data.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen
    }
  },

  async beforeUpdate(event: any) {
    const { data } = event.params;
    
    // Auto-regenerate slug if name is being updated and slug is not explicitly provided
    if (data && data.name && data.slug === undefined) {
      data.slug = data.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen
    }
  },
};