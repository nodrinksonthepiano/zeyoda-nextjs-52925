import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMagicAuthFromBearer, type MagicBearerAuth } from '@/app/utils/server/magicBearerEmail';
import { normalizeReservedEmail } from '@/app/utils/server/normalizeReservedEmail';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Log when clients still send x-wallet-address; Magic is authoritative. */
function warnAdvisoryWalletHeader(
  request: NextRequest,
  magicPublicAddress: string | null | undefined,
): void {
  const header = request.headers.get('x-wallet-address')?.trim();
  if (!header || !magicPublicAddress) return;
  if (header.toLowerCase() !== magicPublicAddress.toLowerCase()) {
    console.warn(
      '[assertMagicArtistUploader] x-wallet-address differs from Magic publicAddress (header is advisory only)',
      {
        headerPrefix: `${header.slice(0, 14)}…`,
        magicPrefix: `${magicPublicAddress.slice(0, 14)}…`,
      },
    );
  }
}

/**
 * Ensures Magic DID identities who may upload/write assets for artistId.
 * Matches finalizeLaunch: treasury wallet, claimed invite launcher, or admin (with explicit log).
 *
 * @param preloadedAuth optional — callers that already fetched Magic metadata (avoids duplicate token calls).
 * @returns null if authorized, otherwise an error NextResponse for the route handler.
 */
export async function assertMagicArtistUploader(
  request: NextRequest,
  artistIdRaw: string,
  preloadedAuth?: MagicBearerAuth | null,
): Promise<NextResponse | null> {
  const artistId = typeof artistIdRaw === 'string' ? artistIdRaw.trim() : '';
  if (!artistId) {
    return NextResponse.json({ error: 'artistId required' }, { status: 400 });
  }

  const auth = preloadedAuth ?? (await getMagicAuthFromBearer(request));
  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: artist, error: artistError } = await supabaseAdmin
    .from('artists')
    .select('id, treasury_wallet')
    .eq('id', artistId)
    .single();

  if (artistError || !artist) {
    return NextResponse.json({ error: `Artist not found: ${artistId}` }, { status: 404 });
  }

  const lookupEmailRaw = auth.email || auth.issuer;
  const lookupEmail =
    lookupEmailRaw && typeof lookupEmailRaw === 'string'
      ? normalizeReservedEmail(lookupEmailRaw)
      : null;

  if (lookupEmail) {
    const { data: wlRow, error: wlError } = await supabaseAdmin
      .from('whitelist_emails')
      .select('email, role')
      .eq('email', lookupEmail)
      .maybeSingle();

    if (wlError) {
      console.error('assertMagicArtistUploader whitelist lookup:', wlError);
      return NextResponse.json({ error: 'Failed to verify authorization' }, { status: 500 });
    }

    if (wlRow?.role === 'admin') {
      console.warn('[assertMagicArtistUploader] ADMIN BYPASS upload authorized', {
        artistId,
        email: `${lookupEmail.slice(0, 8)}…`,
      });
      warnAdvisoryWalletHeader(request, auth.publicAddress);
      return null;
    }
  }

  const treasuryWallet =
    typeof artist.treasury_wallet === 'string' ? artist.treasury_wallet.toLowerCase() : null;
  const authWallet = auth.publicAddress?.toLowerCase() ?? null;
  const walletAuthorized = !!treasuryWallet && !!authWallet && authWallet === treasuryWallet;
  const authEmail = auth.email ? normalizeReservedEmail(auth.email) : null;

  let inviteAuthorized = false;
  if (authEmail && treasuryWallet) {
    const { data: inviteRow, error: inviteError } = await supabaseAdmin
      .from('artist_invites')
      .select('claimed_by_email, claimed_by_wallet, status')
      .eq('artist_slug', artistId)
      .in('status', ['claimed', 'launched'])
      .maybeSingle();

    if (inviteError) {
      console.error('assertMagicArtistUploader invite lookup:', inviteError);
      return NextResponse.json({ error: 'Failed to verify invite authorization' }, { status: 500 });
    }

    const inviteEmail =
      typeof inviteRow?.claimed_by_email === 'string'
        ? normalizeReservedEmail(inviteRow.claimed_by_email)
        : null;
    const inviteWallet =
      typeof inviteRow?.claimed_by_wallet === 'string'
        ? inviteRow.claimed_by_wallet.toLowerCase()
        : null;
    inviteAuthorized = inviteEmail === authEmail && inviteWallet === treasuryWallet;
  }

  if (!walletAuthorized && !inviteAuthorized) {
    return NextResponse.json(
      {
        error:
          'Permission denied: verified Magic user is not the artist treasury wallet, claimed invite launcher, or admin',
      },
      { status: 403 },
    );
  }

  warnAdvisoryWalletHeader(request, auth.publicAddress);
  return null;
}
