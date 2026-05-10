/**
 * Launch integrity helpers — detect unsafe placeholder media and invalid public state.
 */

const PLACEHOLDER_SUBSTR = 'placeholder.mp4';

export function isPlaceholderVideoSrc(url: string | null | undefined): boolean {
  if (url == null || typeof url !== 'string') return true;
  const u = url.trim().toLowerCase();
  if (!u) return true;
  return u.includes(PLACEHOLDER_SUBSTR);
}

export function isTrustedLaunchSourceUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;

  const host = parsed.hostname.toLowerCase();
  const configuredSupabaseHost = (() => {
    try {
      const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
      return raw ? new URL(raw).hostname.toLowerCase() : null;
    } catch {
      return null;
    }
  })();

  return host === configuredSupabaseHost || host.endsWith('.supabase.co');
}
