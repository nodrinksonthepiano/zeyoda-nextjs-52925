import type { TreasureResolveDTO } from '@/types/treasure-invite';

/**
 * Builds the public TreasureResolveDTO from persisted draft_payload (schema v1).
 * Omits any keys not allowed for strangers.
 */
export function mapInviteToTreasureDto(
  draftPayload: Record<string, unknown> | null | undefined,
): TreasureResolveDTO | null {
  if (!draftPayload || typeof draftPayload !== 'object') return null;

  const schemaRaw = draftPayload.schema_version;
  if (schemaRaw !== 1) return null;

  const displayname = draftPayload.displayname;
  const tokenName = draftPayload.tokenName;

  if (typeof displayname !== 'string' || !displayname.trim()) return null;
  if (typeof tokenName !== 'string' || !tokenName.trim()) return null;

  const themeRaw = draftPayload.theme;
  let theme: TreasureResolveDTO['theme'];
  if (themeRaw && typeof themeRaw === 'object' && !Array.isArray(themeRaw)) {
    const t = themeRaw as Record<string, unknown>;
    theme = {
      fontFamily: typeof t.fontFamily === 'string' ? t.fontFamily : undefined,
      primaryColor: typeof t.primaryColor === 'string' ? t.primaryColor : undefined,
      accentColor: typeof t.accentColor === 'string' ? t.accentColor : undefined,
      gradientStart: typeof t.gradientStart === 'string' ? t.gradientStart : undefined,
      gradientMiddle: typeof t.gradientMiddle === 'string' ? t.gradientMiddle : undefined,
      gradientEnd: typeof t.gradientEnd === 'string' ? t.gradientEnd : undefined,
    };
  }

  const orbitaltokens = draftPayload.orbitaltokens;
  const orbit =
    Array.isArray(orbitaltokens) ? (orbitaltokens as unknown[]) : [];

  let artworkyear: string | number | undefined;
  const ay = draftPayload.artworkyear;
  if (typeof ay === 'string' || typeof ay === 'number') artworkyear = ay;

  return {
    schema_version: 1,
    displayname: displayname.trim(),
    tokenName: tokenName.trim(),
    artworktitle:
      typeof draftPayload.artworktitle === 'string' ? draftPayload.artworktitle : undefined,
    artworkyear,
    downloadPrice:
      typeof draftPayload.downloadPrice === 'number' ? draftPayload.downloadPrice : undefined,
    description:
      typeof draftPayload.description === 'string' ? draftPayload.description : undefined,
    theme,
    logo_use_background:
      typeof draftPayload.logo_use_background === 'boolean'
        ? draftPayload.logo_use_background
        : undefined,
    background_use_image:
      typeof draftPayload.background_use_image === 'boolean'
        ? draftPayload.background_use_image
        : undefined,
    logo_url:
      typeof draftPayload.logo_url === 'string' ? draftPayload.logo_url : draftPayload.logo_url === null ? null : undefined,
    background_image_url:
      typeof draftPayload.background_image_url === 'string'
        ? draftPayload.background_image_url
        : draftPayload.background_image_url === null ? null : undefined,
    videosrc:
      typeof draftPayload.videosrc === 'string' ? draftPayload.videosrc : draftPayload.videosrc === null ? null : undefined,
    featured_asset_url:
      typeof draftPayload.featured_asset_url === 'string'
        ? draftPayload.featured_asset_url
        : draftPayload.featured_asset_url === null ? null : undefined,
    orbitaltokens: orbit,
    paused: typeof draftPayload.paused === 'boolean' ? draftPayload.paused : undefined,
  };
}
