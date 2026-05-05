/** Base URL for treasure links returned by save-draft (NFC / copy-paste). */
export function treasureUrlForInvite(artistSlug: string, coinPublicId: string): string {
  const base =
    process.env.NEXT_PUBLIC_INVITE_BASE_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'https://test.artistocks.io';
  const u = new URL(base);
  u.pathname = '/';
  u.search = '';
  u.hash = '';
  const q = new URLSearchParams();
  q.set('artist', artistSlug);
  q.set('coin', coinPublicId);
  return `${u.origin}/?${q.toString()}`;
}
