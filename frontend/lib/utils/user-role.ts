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
  console.error('🔍 [ROLE] isSubcontractor check for user:', { id: user?.id, email: user?.email });

  if (!user) {
    console.error('  ❌ No user provided');
    return false;
  }

  // Check by role (string or object)
  if (user.role) {
    if (typeof user.role === 'string') {
      const roleLower = user.role.toLowerCase();
      console.error('  Checking role (string):', roleLower);
      if (roleLower === 'alvallalkozo' || roleLower.includes('subcontractor')) {
        console.error('  ✅ Is Subcontractor (by role string)');
        return true;
      }
    }

    if (typeof user.role === 'object' && user.role !== null) {
      const roleName = (user.role as any).name?.toLowerCase() || '';
      const roleType = (user.role as any).type?.toLowerCase() || '';
      console.error('  Checking role (object):', { name: roleName, type: roleType });
      if (roleName.includes('alvallalkozo') || roleName.includes('subcontractor') ||
        roleType.includes('alvallalkozo') || roleType.includes('subcontractor')) {
        console.error('  ✅ Is Subcontractor (by role object)');
        return true;
      }
    }
  }

  // Check by company type (most reliable)
  if (user.company) {
    if (typeof user.company === 'object' && user.company !== null) {
      const companyType = (user.company as any).type;
      console.error('  Checking company type:', companyType);
      if (companyType === 'subcontractor' || companyType === 'Alvállalkozó') {
        console.error('  ✅ Is Subcontractor (by company type)');
        return true;
      }
    }
  }

  console.error('  ❌ Not a Subcontractor');
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
    if (companyType === 'main_contractor' || companyType === 'Fővállalkozó') {
      return true;
    }
  }

  return false;
}