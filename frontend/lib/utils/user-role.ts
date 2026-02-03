// Helper function to check if user has admin role
export function isAdminRole(user: any): boolean {
  if (!user) {
    return false;
  }

  // Check role if present
  if (user.role) {
    // If role is a string - case insensitive check
    if (typeof user.role === 'string') {
      const roleLower = user.role.toLowerCase();
      // Accept common admin-like role strings (e.g. "Admin", "Administrator", "Super Admin")
      if (roleLower === 'admin' || roleLower.includes('admin')) {
        return true;
      }
    }

    // If role is an object (Strapi role relation)
    if (typeof user.role === 'object' && user.role !== null) {
      const roleName = (user.role as any).name?.toLowerCase() || '';
      const roleType = (user.role as any).type?.toLowerCase() || '';
      // IMPORTANT:
      // - users-permissions "Authenticated" is NOT an admin role
      // - numeric role IDs (e.g. 1/2) are not reliable indicators of admin
      if (roleName === 'admin' || roleType === 'admin' || roleName.includes('admin')) {
        return true;
      }
    }
  }

  // Fallback: check if username contains 'admin' (case insensitive)
  // This helps when role detection fails but user is named as admin
  if (user.username) {
    const usernameLower = user.username.toLowerCase();
    if (usernameLower.includes('admin')) {
      return true;
    }
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
      if (roleLower === 'alvallalkozo' || roleLower.includes('alvállalkozó') || roleLower.includes('subcontractor')) {
        return true;
      }
    }

    if (typeof user.role === 'object' && user.role !== null) {
      const roleName = (user.role as any).name?.toLowerCase() || '';
      const roleType = (user.role as any).type?.toLowerCase() || '';
      if (
        roleName.includes('alvallalkozo') ||
        roleName.includes('alvállalkozó') ||
        roleName.includes('subcontractor') ||
        roleType.includes('alvallalkozo') ||
        roleType.includes('alvállalkozó') ||
        roleType.includes('subcontractor')
      ) {
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
      if (
        roleLower === 'foovallalkozo' ||
        roleLower.includes('fővállalkozó') ||
        roleLower.includes('main') ||
        roleLower.includes('contractor')
      ) {
        return true;
      }
    }

    if (typeof user.role === 'object' && user.role !== null) {
      const roleName = (user.role as any).name?.toLowerCase() || '';
      const roleType = (user.role as any).type?.toLowerCase() || '';
      if (
        roleName.includes('foovallalkozo') ||
        roleName.includes('fővállalkozó') ||
        roleName.includes('main') ||
        roleType.includes('foovallalkozo') ||
        roleType.includes('fővállalkozó') ||
        roleType.includes('main')
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