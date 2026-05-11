import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMagicAuthFromBearer, type MagicBearerAuth } from '@/app/utils/server/magicBearerEmail';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function warnAdvisoryWalletHeader(
  request: NextRequest,
  magicPublicAddress: string | null | undefined,
): void {
  const header = request.headers.get('x-wallet-address')?.trim();
  if (!header || !magicPublicAddress) return;
  if (header.toLowerCase() !== magicPublicAddress.toLowerCase()) {
    console.warn(
      '[assertMagicTreasuryArtist] x-wallet-address differs from Magic publicAddress (header is advisory only)',
      {
        headerPrefix: `${header.slice(0, 14)}…`,
        magicPrefix: `${magicPublicAddress.slice(0, 14)}…`,
      },
    );
  }
}

/**
 * Money / ownership routes: only the canonical treasury wallet Magic session may proceed.
 * No admin bypass — admin must operate from the treasury wallet identity.
 *
 * @returns null if authorized, otherwise an error NextResponse.
 */
export async function assertMagicTreasuryArtist(
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
    return NextResponse.json(
      { error: 'Authentication required', message: 'Valid Magic DID token required' },
      { status: 401 },
    );
  }

  const pub = auth.publicAddress?.trim().toLowerCase() ?? null;
  if (!pub) {
    return NextResponse.json(
      {
        error: 'Authentication required',
        message: 'Magic session has no publicAddress — treasury actions require a linked wallet',
      },
      { status: 401 },
    );
  }

  const { data: artist, error: artistError } = await supabaseAdmin
    .from('artists')
    .select('id, treasury_wallet')
    .eq('id', artistId)
    .single();

  if (artistError || !artist) {
    return NextResponse.json({ error: `Artist not found: ${artistId}` }, { status: 404 });
  }

  const treasuryWallet =
    typeof artist.treasury_wallet === 'string' ? artist.treasury_wallet.trim().toLowerCase() : null;
  if (!treasuryWallet || treasuryWallet !== pub) {
    return NextResponse.json(
      {
        error: 'Permission denied: only the artist treasury Magic wallet may perform this action',
      },
      { status: 403 },
    );
  }

  warnAdvisoryWalletHeader(request, auth.publicAddress);
  return null;
}
