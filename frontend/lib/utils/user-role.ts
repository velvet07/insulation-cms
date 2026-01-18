// Helper function to check if user has admin role
export function isAdminRole(user: any): boolean {
  if (!user || !user.role) {
    console.log('[isAdminRole] No user or role:', { user: !!user, role: user?.role });
    return false;
  }
  
  // If role is a string - case insensitive check
  if (typeof user.role === 'string') {
    const isAdmin = user.role.toLowerCase() === 'admin';
    console.log('[isAdminRole] Role is string:', user.role, '-> isAdmin:', isAdmin);
    return isAdmin;
  }
  
  // If role is an object (Strapi role relation)
  if (typeof user.role === 'object' && user.role !== null) {
    const roleName = (user.role as any).name?.toLowerCase() || '';
    const roleType = (user.role as any).type?.toLowerCase() || '';
    const isAdmin = roleName.includes('admin') || roleType === 'admin' || roleName === 'admin' || roleType === 'authenticated';
    console.log('[isAdminRole] Role is object:', { roleName, roleType, isAdmin });
    
    // Also check for Strapi's default admin role (id: 1 or name: 'Admin' or type: 'admin')
    const roleId = (user.role as any).id;
    if (roleId === 1 || roleId === '1') {
      console.log('[isAdminRole] Admin role detected by ID:', roleId);
      return true;
    }
    
    return isAdmin;
  }
  
  console.log('[isAdminRole] Role type not recognized:', typeof user.role);
  return false;
}
