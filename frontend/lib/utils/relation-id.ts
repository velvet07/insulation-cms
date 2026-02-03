/**
 * Get documentId or id from a Strapi relation (company, subcontractor, etc.).
 * Handles both flat shape (rel.documentId / rel.id) and Strapi v5 wrapped shape (rel.data.documentId / rel.data.id).
 */
export function getRelationId(rel: unknown): string | null {
  if (rel == null) return null;
  const r = rel as Record<string, unknown>;
  const id = r.documentId ?? r.id ?? (r.data as Record<string, unknown> | undefined)?.documentId ?? (r.data as Record<string, unknown> | undefined)?.id;
  return id != null ? String(id) : null;
}
