import type { ProjectAuditLogEntry } from '@/types';
import type { User } from '@/types';

/**
 * Létrehoz egy audit log bejegyzést
 */
export function createAuditLogEntry(
  action: ProjectAuditLogEntry['action'],
  user?: User | null,
  details?: string
): ProjectAuditLogEntry {
  return {
    action,
    timestamp: new Date().toISOString(),
    user: user ? {
      email: user.email,
      username: user.username,
    } : undefined,
    details,
  };
}

/**
 * Hozzáad egy audit log bejegyzést egy meglévő audit log tömbhöz
 */
export function addAuditLogEntry(
  existingLog: ProjectAuditLogEntry[] | undefined,
  entry: ProjectAuditLogEntry
): ProjectAuditLogEntry[] {
  return [...(existingLog || []), entry];
}
