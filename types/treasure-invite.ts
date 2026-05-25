/** Envelope statuses returned by GET /api/invite/resolve (DB uses same strings except not_found/error). */

export type InviteRowStatus = 'draft' | 'claimed' | 'launched' | 'revoked';

export type InviteResolveEnvelopeStatus =
  | InviteRowStatus
  | 'not_found'
  | 'error';

export type TreasureResolveTheme = {
  fontFamily?: string;
  primaryColor?: string;
  accentColor?: string;
  gradientStart?: string;
  gradientMiddle?: string;
  gradientEnd?: string;
  stardust?: boolean;
};

/** Subset of draft_payload.schema_version === 1 for public preview shells. */
export type TreasureResolveDTO = {
  schema_version: 1;
  displayname: string;
  tokenName: string;
  artworktitle?: string;
  artworkyear?: string | number;
  downloadPrice?: number;
  description?: string;
  theme?: TreasureResolveTheme;
  logo_use_background?: boolean;
  background_use_image?: boolean;
  logo_url?: string | null;
  background_image_url?: string | null;
  videosrc?: string | null;
  featured_asset_url?: string | null;
  orbitaltokens?: unknown[];
  paused?: boolean;
};

export type InviteResolveNotFoundBody = {
  status: 'not_found';
  coin_public_id: string;
};

export type InviteResolveRevokedBody = {
  status: 'revoked';
  coin_public_id: string;
  messageKey: 'he_was_taken';
};

export type InviteResolveLaunchedRedirectBody = {
  status: 'launched';
  artist_slug: string;
  coin_public_id: string;
  /**
   * Real launched artist id (artists.id, token-derived). Optional for backward
   * compatibility; absent when the resolve route cannot find a matching live
   * artist row. Frontend should prefer this over `artist_slug` for routing.
   */
  launched_artist_id?: string;
};

export type InviteResolveTreasureBody = {
  status: 'draft' | 'claimed';
  artist_slug: string;
  coin_public_id: string;
  treasure: TreasureResolveDTO;
};

export type InviteResolveErrorBody = {
  status: 'error';
  message?: string;
};

export type InviteResolveOkBody =
  | InviteResolveTreasureBody
  | InviteResolveRevokedBody
  | InviteResolveNotFoundBody
  | InviteResolveLaunchedRedirectBody;

export type ClaimErrorCode =
  | 'reserved_email_mismatch'
  | 'already_claimed'
  | 'invalid_coin'
  | 'not_draft';

export type ClaimInviteResponseBody = {
  coin_public_id: string;
  artist_slug: string;
  status: 'claimed';
  draft_payload: Record<string, unknown>;
};

export type MeStateResponseBody = {
  isClaimant: boolean;
};
