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
    // IMPORTANT:
    // - users-permissions "Authenticated" is NOT an admin role
    // - numeric role IDs (e.g. 1/2) are not reliable indicators of admin
    return roleName === 'admin' || roleType === 'admin' || roleName.includes('admin');
  }

  return false;
}

// Helper function to check if user is a subcontractor
export function isSubcontractor(user: any): boolean {
  if (!user) {
    return false;
  }

  // Check by role (string or object)
  if (user.role) {
    if (typeof user.role === 'string') {
      const roleLower = user.role.toLowerCase();
      if (roleLower === 'alvallalkozo' || roleLower.includes('subcontractor')) {
        return true;
      }
    }

    if (typeof user.role === 'object' && user.role !== null) {
      const roleName = (user.role as any).name?.toLowerCase() || '';
      const roleType = (user.role as any).type?.toLowerCase() || '';
      if (roleName.includes('alvallalkozo') || roleName.includes('subcontractor') ||
        roleType.includes('alvallalkozo') || roleType.includes('subcontractor')) {
        return true;
      }
    }
  }

  // Check by company type (most reliable)
  if (user.company) {
    if (typeof user.company === 'object' && user.company !== null) {
      const companyType = (user.company as any).type;
      if (companyType === 'subcontractor' || companyType === 'Alvállalkozó') {
        return true;
      }
    }
  }

  return false;
}

// Helper function to check if user is a main contractor
export function isMainContractor(user: any): boolean {
  if (!user) {
    return false;
  }

  // Check by role (but do NOT early-return false; company type can still identify main contractors)
  if (user.role) {
    if (typeof user.role === 'string') {
      const roleLower = user.role.toLowerCase();
      if (roleLower === 'foovallalkozo' || roleLower.includes('main') || roleLower.includes('contractor')) {
        return true;
      }
    }

    if (typeof user.role === 'object' && user.role !== null) {
      const roleName = (user.role as any).name?.toLowerCase() || '';
      const roleType = (user.role as any).type?.toLowerCase() || '';
      if (
        roleName.includes('foovallalkozo') || roleName.includes('main') ||
        roleType.includes('foovallalkozo') || roleType.includes('main')
      ) {
        return true;
      }
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