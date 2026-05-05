import type { InviteResolveTreasureBody } from '@/types/treasure-invite';

import type { ArtistConfig, OrbitalToken } from '@/types/artist-types';

export type InviteLaunchBridge = {
  coinPublicId: string;
  draft: Record<string, unknown>;
};

/** Client-side bridge payload for onboarding (no extra PII). */
export function draftRecordFromTreasureEnvelope(
  envelope: InviteResolveTreasureBody,
): Record<string, unknown> {
  const t = envelope.treasure;
  const out: Record<string, unknown> = {
    schema_version: t.schema_version,
    displayname: t.displayname,
    tokenName: t.tokenName,
    artworktitle: t.artworktitle,
    artworkyear: t.artworkyear,
    downloadPrice: t.downloadPrice,
    description: t.description,
    theme: t.theme ?? {},
    logo_use_background: t.logo_use_background,
    background_use_image: t.background_use_image,
    logo_url: t.logo_url ?? null,
    background_image_url: t.background_image_url ?? null,
    videosrc: t.videosrc ?? null,
    featured_asset_url: t.featured_asset_url ?? null,
    orbitaltokens: t.orbitaltokens ?? [],
    paused: t.paused ?? false,
  };
  return out;
}

export const INVITE_LAUNCH_STORAGE_KEY = 'invite_onboard_bundle_v1';

export interface InviteLaunchBundle {
  coinPublicId: string;
  artist_slug: string;
  draft: Record<string, unknown>;
}

export function persistInviteLaunchBundle(bundle: InviteLaunchBundle) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(INVITE_LAUNCH_STORAGE_KEY, JSON.stringify(bundle));
}

export function readInviteLaunchBundle(): InviteLaunchBundle | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(INVITE_LAUNCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InviteLaunchBundle;
    if (
      !parsed?.coinPublicId ||
      typeof parsed.coinPublicId !== 'string' ||
      typeof parsed.draft !== 'object' ||
      parsed.draft === null
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearInviteLaunchBundle() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(INVITE_LAUNCH_STORAGE_KEY);
}

/** Minimal ArtistConfig so invite onboarding can reuse ArtistPageContent before the artist row exists. */
export function buildStubArtistConfigFromDraft(draft: Record<string, unknown>): ArtistConfig {
  const tnRaw = draft.tokenName ?? draft.displayname ?? 'COIN';
  const tokenName =
    typeof tnRaw === 'string' && tnRaw.trim() ? tnRaw.trim().toUpperCase().replace(/\s+/g, '') : 'COIN';
  const slug = tokenName.toLowerCase();
  const display =
    typeof draft.displayname === 'string' ? draft.displayname : typeof tnRaw === 'string' ? tnRaw : slug;
  const themeRaw = draft.theme as Record<string, unknown> | undefined;
  const theme = {
    primaryColor: typeof themeRaw?.primaryColor === 'string' ? themeRaw.primaryColor : '#FAF0E6',
    accentColor: typeof themeRaw?.accentColor === 'string' ? themeRaw.accentColor : '#B8860B',
    gradientStart: typeof themeRaw?.gradientStart === 'string' ? themeRaw.gradientStart : '#FAF0E6',
    gradientMiddle: typeof themeRaw?.gradientMiddle === 'string' ? themeRaw.gradientMiddle : '#FDF5E6',
    gradientEnd: typeof themeRaw?.gradientEnd === 'string' ? themeRaw.gradientEnd : '#F5F5DC',
    fontFamily: typeof themeRaw?.fontFamily === 'string' ? themeRaw.fontFamily : 'Bungee, cursive',
  };
  let videoSrc =
    typeof draft.videosrc === 'string' && draft.videosrc.trim()
      ? draft.videosrc
      : '/assets/placeholder.mp4';

  let artworkYear =
    draft.artworkyear !== undefined && draft.artworkyear !== null ? String(draft.artworkyear) : '2025';

  const price =
    typeof draft.downloadPrice === 'number' ? draft.downloadPrice : Number(draft.downloadPrice ?? 5) || 5;

  return {
    name: slug,
    displayName: display,
    tokenName,
    artworkTitle:
      typeof draft.artworktitle === 'string' ? draft.artworktitle : typeof draft.artworktitle === 'number' ? String(draft.artworktitle) : 'Featured Content #1',
    artworkYear,
    tokenPrice: price,
    realTimePrice: price,
    hasLiquidityPool: false,
    videoSrc,
    orbitalTokens: Array.isArray(draft.orbitaltokens)
      ? (draft.orbitaltokens as OrbitalToken[])
      : [],
    theme,
    logo_url:
      draft.logo_url === null || draft.logo_url === '' ? null : typeof draft.logo_url === 'string'
        ? draft.logo_url
        : null,
    logo_use_background: Boolean(draft.logo_use_background),
    background_image_url:
      draft.background_image_url === null || draft.background_image_url === ''
        ? null
        : typeof draft.background_image_url === 'string'
          ? draft.background_image_url
          : null,
    background_use_image: Boolean(draft.background_use_image),
    paused: false,
  };
}
