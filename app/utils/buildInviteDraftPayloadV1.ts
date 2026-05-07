/**
 * Maps onboarding form state ⇄ persisted invite draft_payload (schema v1).
 * Keeps naming aligned with mapInviteToTreasureDto + draftPayloadValidation.
 */

export interface InviteDraftThemeInput {
  fontFamily: string;
  primaryColor: string;
  accentColor: string;
  gradientStart: string;
  gradientMiddle: string;
  gradientEnd: string;
}

export interface InviteDraftFormInput {
  displayname: string;
  tokenName: string;
  artworktitle: string;
  artworkyear: string;
  downloadPrice: number;
  description: string;
  videosrc: string;
  logo_url: string | null;
  background_image_url: string | null;
  featured_asset_url: string | null;
  logo_use_background: boolean;
  background_use_image: boolean;
  theme: InviteDraftThemeInput;
}

/** Only persist https URLs — blobs/local placeholders become null */
function sanitizeHttpsMediaField(v: string | null | undefined): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (
    lower.startsWith('blob:') ||
    lower.startsWith('file:') ||
    lower.startsWith('filesystem:') ||
    lower.startsWith('data:')
  ) {
    return null;
  }
  return t.startsWith('https://') ? t : null;
}

/**
 * Empty, null, legacy `/assets/placeholder.mp4` draft filler — treat as “no hero video”; use featured_asset_url instead.
 */
export function isSentinelOrEmptyVideosrc(v: string | null | undefined): boolean {
  if (v === null || v === undefined) return true;
  const raw = typeof v === 'string' ? v.trim() : '';
  if (!raw) return true;
  const pathOnly = raw.split('?')[0].split('#')[0].trim().toLowerCase();
  return (
    pathOnly === '/assets/placeholder.mp4' ||
    pathOnly === 'assets/placeholder.mp4' ||
    pathOnly.endsWith('/assets/placeholder.mp4')
  );
}

/** Persist https:// or /assets/... only; omit empty / sentinel placeholder (validation allows omitted/null videosrc). */
export function normalizeVideosrcForDraft(videosrc: string): string | null {
  const t = (videosrc ?? '').trim();
  if (isSentinelOrEmptyVideosrc(t)) return null;
  if (t.startsWith('https://')) return t;
  if (t.startsWith('/assets/')) return t;
  if (t.startsWith('assets/')) return `/${t}`;
  return t;
}

export function buildInviteDraftPayloadV1(input: InviteDraftFormInput): Record<string, unknown> {
  const logo_url = sanitizeHttpsMediaField(input.logo_url);
  const background_image_url = sanitizeHttpsMediaField(input.background_image_url);
  const featured_asset_url = sanitizeHttpsMediaField(input.featured_asset_url);
  const videosrcNorm = normalizeVideosrcForDraft(input.videosrc);

  const artworkyearParsed = /^-?\d+$/.test(String(input.artworkyear).trim())
    ? parseInt(String(input.artworkyear).trim(), 10)
    : String(input.artworkyear).trim();

  return {
    schema_version: 1,
    displayname: input.displayname.trim(),
    tokenName: input.tokenName.trim(),
    artworktitle: input.artworktitle,
    artworkyear: artworkyearParsed,
    downloadPrice: input.downloadPrice,
    description: input.description,
    logo_use_background: input.logo_use_background,
    background_use_image: input.background_use_image,
    ...(videosrcNorm !== null ? { videosrc: videosrcNorm } : {}),
    logo_url,
    background_image_url,
    featured_asset_url,
    theme: {
      fontFamily: input.theme.fontFamily,
      primaryColor: input.theme.primaryColor,
      accentColor: input.theme.accentColor,
      gradientStart: input.theme.gradientStart,
      gradientMiddle: input.theme.gradientMiddle,
      gradientEnd: input.theme.gradientEnd,
    },
    orbitaltokens: [],
    paused: false,
  };
}

/**
 * Applies draft_payload keys into onboarding form shape.
 * Caller merges into React state via setFormData.
 */
export function applyInviteDraftPayloadToForm(prev: InviteDraftFormInput, d: Record<string, unknown>): InviteDraftFormInput {
  const themeRaw =
    d.theme && typeof d.theme === 'object' && !Array.isArray(d.theme) ? (d.theme as Record<string, unknown>) : {};

  const logo =
    typeof d.logo_url === 'string' ? d.logo_url : d.logo_url === null ? null : prev.logo_url;
  const background =
    typeof d.background_image_url === 'string'
      ? d.background_image_url
      : d.background_image_url === null
        ? null
        : prev.background_image_url;

  const featured =
    typeof d.featured_asset_url === 'string'
      ? d.featured_asset_url
      : d.featured_asset_url === null
        ? null
        : prev.featured_asset_url;

  const vy = d.artworkyear;
  const artworkyear =
    typeof vy === 'string' || typeof vy === 'number' ? String(vy) : prev.artworkyear;

  const vs = d.videosrc;
  let videosrc: string;
  if (vs === null || vs === undefined) {
    videosrc = '';
  } else if (typeof vs === 'string') {
    const t = vs.trim();
    videosrc = isSentinelOrEmptyVideosrc(t) ? '' : t;
  } else {
    videosrc = prev.videosrc;
  }

  return {
    ...prev,
    displayname:
      typeof d.displayname === 'string' ? d.displayname : prev.displayname,
    tokenName: typeof d.tokenName === 'string' ? d.tokenName : prev.tokenName,
    artworktitle: typeof d.artworktitle === 'string' ? d.artworktitle : prev.artworktitle,
    artworkyear,
    downloadPrice:
      typeof d.downloadPrice === 'number'
        ? d.downloadPrice
        : typeof prev.downloadPrice === 'number'
          ? prev.downloadPrice
          : 5,
    description: typeof d.description === 'string' ? d.description : prev.description,
    logo_url: logo,
    background_image_url: background,
    featured_asset_url: featured,
    logo_use_background:
      typeof d.logo_use_background === 'boolean'
        ? d.logo_use_background
        : prev.logo_use_background,
    background_use_image:
      typeof d.background_use_image === 'boolean'
        ? d.background_use_image
        : prev.background_use_image,
    videosrc,
    theme: {
      ...prev.theme,
      fontFamily:
        typeof themeRaw.fontFamily === 'string' ? themeRaw.fontFamily : prev.theme.fontFamily,
      primaryColor:
        typeof themeRaw.primaryColor === 'string'
          ? themeRaw.primaryColor
          : prev.theme.primaryColor,
      accentColor:
        typeof themeRaw.accentColor === 'string' ? themeRaw.accentColor : prev.theme.accentColor,
      gradientStart:
        typeof themeRaw.gradientStart === 'string'
          ? themeRaw.gradientStart
          : prev.theme.gradientStart,
      gradientMiddle:
        typeof themeRaw.gradientMiddle === 'string'
          ? themeRaw.gradientMiddle
          : prev.theme.gradientMiddle,
      gradientEnd:
        typeof themeRaw.gradientEnd === 'string'
          ? themeRaw.gradientEnd
          : prev.theme.gradientEnd,
    },
  };
}
