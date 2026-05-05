/**
 * Reject dangerous/local-only URLs in draft_payload — never persist blob: or File handles (JSON can't hold Files anyway).
 * Allows https:// URLs and same-origin style paths under /assets/ for built-in placeholders (e.g. videosrc).
 */

const DISALLOWED_PREFIXES = ['blob:', 'file:', 'filesystem:', 'data:'];

export function assertNoDisallowedUrlStrings(value: unknown, path = 'draft_payload'): void {
  if (value === null || value === undefined) return;

  if (typeof value === 'string') {
    const t = value.trim();
    const lower = t.toLowerCase();
    for (const p of DISALLOWED_PREFIXES) {
      if (lower.startsWith(p)) {
        throw new Error(`${path}: disallowed URL scheme (${p})`);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoDisallowedUrlStrings(v, `${path}[${i}]`));
    return;
  }

  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      assertNoDisallowedUrlStrings(v, `${path}.${k}`);
    }
  }
}

/** Logo / background / featured must be https Supabase public URLs when non-empty. videosrc may be https or /assets/... */
export function assertHttpsUrlsForMediaFields(payload: Record<string, unknown>): void {
  const logo = payload.logo_url;
  const bg = payload.background_image_url;
  const featured = payload.featured_asset_url;
  const videosrc = payload.videosrc;

  const checkHttps = (label: string, v: unknown) => {
    if (v === null || v === undefined || v === '') return;
    if (typeof v !== 'string') throw new Error(`${label} must be a string URL`);
    assertNoDisallowedUrlStrings(v, label);
    if (!v.startsWith('https://')) {
      throw new Error(`${label} must be an https URL`);
    }
  };

  checkHttps('logo_url', logo);
  checkHttps('background_image_url', bg);
  checkHttps('featured_asset_url', featured);

  if (videosrc !== undefined && videosrc !== null && videosrc !== '') {
    if (typeof videosrc !== 'string') throw new Error('videosrc must be a string');
    assertNoDisallowedUrlStrings(videosrc, 'videosrc');
    const ok = videosrc.startsWith('https://') || videosrc.startsWith('/assets/');
    if (!ok) {
      throw new Error('videosrc must be https:// or /assets/...');
    }
  }
}
