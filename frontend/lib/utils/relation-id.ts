/**
 * Get documentId or id from a Strapi relation (company, subcontractor, etc.).
 * Handles: primitive id (number/string), flat object (rel.documentId / rel.id),
 * Strapi v5 wrapped (rel.data), and attributes-style (rel.attributes?.documentId).
 */
export function getRelationId(rel: unknown): string | null {
  if (rel == null) return null;
  if (typeof rel === 'number' || typeof rel === 'string') return String(rel);
  const r = rel as Record<string, unknown>;
  const data = r.data as Record<string, unknown> | undefined;
  const attrs = r.attributes as Record<string, unknown> | undefined;
  const id =
    r.documentId ??
    r.id ??
    data?.documentId ??
    data?.id ??
    attrs?.documentId ??
    attrs?.id;
  return id != null ? String(id) : null;
}
