// Helper function to check if user has admin role
export function isAdminRole(user: any): boolean {
  if (!user || !user.role) {
    return false;
  }
  
  // If role is a string - case insensitive check
  if (typeof user.role === 'string') {
    return user.role.toLowerCase() === 'admin';
  }
  
  // If role is an object (Strapi role relation)
  if (typeof user.role === 'object' && user.role !== null) {
    const roleName = (user.role as any).name?.toLowerCase() || '';
    const roleType = (user.role as any).type?.toLowerCase() || '';
    const isAdmin = roleName.includes('admin') || roleType === 'admin' || roleName === 'admin' || roleType === 'authenticated';
    
    // Also check for Strapi's default admin role (id: 1 or name: 'Admin' or type: 'admin')
    const roleId = (user.role as any).id;
    if (roleId === 1 || roleId === '1') {
      return true;
    }
    
    return isAdmin;
  }
  
  return false;
}
