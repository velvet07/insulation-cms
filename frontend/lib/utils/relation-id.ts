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

/**
 * Get company or subcontractor id from a project, trying all common Strapi response shapes
 * (root field, attributes, nested data).
 */
export function getProjectRelationId(
  project: Record<string, unknown>,
  field: 'company' | 'subcontractor'
): string | null {
  const direct = project[field];
  const fromDirect = getRelationId(direct);
  if (fromDirect) return fromDirect;
  const attrs = project.attributes as Record<string, unknown> | undefined;
  if (attrs) {
    const fromAttrs = getRelationId(attrs[field]);
    if (fromAttrs) return fromAttrs;
  }
  const relations = project.relations as Record<string, unknown> | undefined;
  if (relations) {
    const fromRels = getRelationId(relations[field]);
    if (fromRels) return fromRels;
  }
  return null;
}
