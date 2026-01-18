// Helper function to check if user has admin role
export function isAdminRole(user: any): boolean {
  if (!user || !user.role) return false;
  
  // If role is a string
  if (typeof user.role === 'string') {
    return user.role === 'admin';
  }
  
  // If role is an object (Strapi role relation)
  if (typeof user.role === 'object' && user.role !== null) {
    const roleName = (user.role as any).name?.toLowerCase() || '';
    const roleType = (user.role as any).type?.toLowerCase() || '';
    return roleName.includes('admin') || roleType === 'admin';
  }
  
  return false;
}
