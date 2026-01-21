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

// Helper function to check if user is a subcontractor
export function isSubcontractor(user: any): boolean {
  if (!user) {
    return false;
  }
  
  // Check by role
  if (user.role) {
    if (typeof user.role === 'string') {
      const roleLower = user.role.toLowerCase();
      return roleLower === 'alvallalkozo' || roleLower.includes('subcontractor');
    }
    
    if (typeof user.role === 'object' && user.role !== null) {
      const roleName = (user.role as any).name?.toLowerCase() || '';
      const roleType = (user.role as any).type?.toLowerCase() || '';
      return roleName.includes('alvallalkozo') || roleName.includes('subcontractor') ||
             roleType.includes('alvallalkozo') || roleType.includes('subcontractor');
    }
  }
  
  // Check by company type
  if (user.company && typeof user.company === 'object') {
    const companyType = (user.company as any).type;
    if (companyType === 'subcontractor') {
      return true;
    }
  }
  
  return false;
}

// Helper function to check if user is a main contractor
export function isMainContractor(user: any): boolean {
  if (!user) {
    return false;
  }
  
  // Check by role
  if (user.role) {
    if (typeof user.role === 'string') {
      const roleLower = user.role.toLowerCase();
      return roleLower === 'foovallalkozo' || roleLower.includes('main') || roleLower.includes('contractor');
    }
    
    if (typeof user.role === 'object' && user.role !== null) {
      const roleName = (user.role as any).name?.toLowerCase() || '';
      const roleType = (user.role as any).type?.toLowerCase() || '';
      return roleName.includes('foovallalkozo') || roleName.includes('main') ||
             roleType.includes('foovallalkozo') || roleType.includes('main');
    }
  }
  
  // Check by company type
  if (user.company && typeof user.company === 'object') {
    const companyType = (user.company as any).type;
    if (companyType === 'main_contractor') {
      return true;
    }
  }
  
  return false;
}