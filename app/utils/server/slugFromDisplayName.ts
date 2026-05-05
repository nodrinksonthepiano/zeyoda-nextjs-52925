/**
 * Canonical public artist slug from display name (not token symbol).
 */
export function slugFromDisplayName(displayname: string): string {
  const s = displayname
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!s) {
    throw new Error('Invalid artist name for slug');
  }
  return s.slice(0, 80);
}
