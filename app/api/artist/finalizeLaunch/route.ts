import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isPlaceholderVideoSrc } from '@/app/utils/launchIntegrity';
import { getMagicAuthFromBearer } from '@/app/utils/server/magicBearerEmail';
import { normalizeReservedEmail } from '@/app/utils/server/normalizeReservedEmail';
import { ethers } from 'ethers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function tokenNameToArtistId(tokenName: string): string {
  return tokenName.trim().toUpperCase().replace(/\s+/g, '').toLowerCase();
}

type InviteCoinResolve =
  | { coin: string }
  | { error: string; status: number }
  | null;

/** Resolve NFC coin for invite → launched promotion (avoid artist_slug vs artists.id drift). */
async function resolveInviteCoinForFinalize(
  artistId: string,
  treasuryWallet: string | null,
  coinFromBody: string | null,
): Promise<InviteCoinResolve> {
  const coinTrim = coinFromBody?.trim() ?? '';
  if (coinTrim) {
    return { coin: coinTrim };
  }
  if (!treasuryWallet) {
    return null;
  }

  const { data: rows, error } = await supabaseAdmin
    .from('artist_invites')
    .select('coin_public_id, draft_payload')
    .eq('claimed_by_wallet', treasuryWallet)
    .eq('status', 'claimed');

  if (error) {
    console.error('finalizeLaunch invite coin resolve:', error);
    return { error: 'Failed to resolve invite for launch finalization', status: 500 };
  }

  const matches = (rows ?? []).filter((row) => {
    const dp = row.draft_payload as Record<string, unknown> | null;
    const tokenName = typeof dp?.tokenName === 'string' ? dp.tokenName : '';
    if (!tokenName.trim()) return false;
    return tokenNameToArtistId(tokenName) === artistId;
  });

  if (matches.length === 0) {
    return null;
  }
  if (matches.length > 1) {
    return {
      error:
        'Multiple claimed invites match this wallet; pass coin_public_id when finalizing launch',
      status: 409,
    };
  }

  const coin = matches[0].coin_public_id;
  return typeof coin === 'string' && coin.trim() ? { coin: coin.trim() } : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const artistId = typeof body.artistId === 'string' ? body.artistId.trim() : '';
    if (!artistId) {
      return NextResponse.json({ error: 'artistId required' }, { status: 400 });
    }

    const coinFromBody =
      typeof body.coin_public_id === 'string' ? body.coin_public_id.trim() : '';

    const auth = await getMagicAuthFromBearer(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id, treasury_wallet, videosrc, paused, contract, download_address, swap_address')
      .eq('id', artistId)
      .single();

    if (artistError || !artist) {
      return NextResponse.json({ error: `Artist not found: ${artistId}` }, { status: 404 });
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
        console.error('finalizeLaunch invite auth lookup:', inviteError);
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
            'Permission denied: verified Magic user is not the artist treasury wallet or claimed invite launcher',
        },
        { status: 403 },
      );
    }

    if (artist.paused !== true) {
      return NextResponse.json({
        success: true,
        message: 'Artist is already public or not in draft-pause state',
        alreadyLive: true,
      });
    }

    let { data: registry, error: regErr } = await supabaseAdmin
      .from('artist_registry')
      .select('id, token, downloads, swap')
      .eq('id', artistId)
      .maybeSingle();

    if (regErr) {
      return NextResponse.json({ error: 'Registry lookup failed — launch incomplete.' }, { status: 400 });
    }

    if (!registry) {
      if (!artist.contract || !artist.download_address || !artist.swap_address || !treasuryWallet) {
        return NextResponse.json(
          {
            error:
              'Registry row missing and deployed addresses are incomplete. Cleanup/restart is required before publishing.',
          },
          { status: 400 },
        );
      }

      const { data: recoveredRegistry, error: recoverErr } = await supabaseAdmin
        .from('artist_registry')
        .upsert(
          {
            id: artistId,
            token: artist.contract,
            downloads: artist.download_address,
            swap: artist.swap_address,
            treasury_wallet: artist.treasury_wallet,
          },
          { onConflict: 'id' },
        )
        .select('id, token, downloads, swap')
        .single();

      if (recoverErr || !recoveredRegistry) {
        console.error('finalizeLaunch registry recovery failed:', recoverErr);
        return NextResponse.json(
          {
            error:
              'Registry recovery failed. Artist remains private; cleanup/restart or manual registry repair is required.',
          },
          { status: 500 },
        );
      }

      registry = recoveredRegistry;
    }

    if (isPlaceholderVideoSrc(artist.videosrc)) {
      return NextResponse.json(
        { error: 'Hero video is not ready (placeholder or missing).' },
        { status: 400 },
      );
    }

    const { data: asset1, error: assetErr } = await supabaseAdmin
      .from('artist_assets')
      .select('asset_number, file_url, file_type, price_usd')
      .eq('artist_id', artistId)
      .eq('asset_number', 1)
      .maybeSingle();

    if (assetErr || !asset1) {
      return NextResponse.json({ error: 'Featured download asset (#1) is missing.' }, { status: 400 });
    }

    const urlOk = typeof asset1.file_url === 'string' && asset1.file_url.startsWith('http');
    const typeOk = typeof asset1.file_type === 'string' && asset1.file_type.length > 0;
    const priceOk = typeof asset1.price_usd === 'number' && asset1.price_usd > 0;

    if (!urlOk || !typeOk || !priceOk) {
      return NextResponse.json(
        {
          error: 'Featured asset #1 must have file_url, file_type, and price_usd > 0.',
        },
        { status: 400 },
      );
    }

    const downloadsAddress =
      typeof artist.download_address === 'string' && artist.download_address
        ? artist.download_address
        : registry.downloads;
    const rpcUrl = process.env.SERVER_BASE_SEPOLIA_RPC_URL;
    if (!downloadsAddress || !treasuryWallet || !rpcUrl) {
      return NextResponse.json(
        { error: 'Cannot verify launch mint: downloads contract, treasury wallet, or RPC is missing.' },
        { status: 500 },
      );
    }

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(
        downloadsAddress,
        ['function balanceOf(address account, uint256 id) view returns (uint256)'],
        provider,
      );
      const balance = await contract.balanceOf(treasuryWallet, 1);
      if (balance <= 0n) {
        return NextResponse.json(
          { error: 'Featured asset #1 is not minted to the artist treasury yet.' },
          { status: 400 },
        );
      }
    } catch (mintCheckError) {
      console.error('finalizeLaunch mint verification failed:', mintCheckError);
      return NextResponse.json(
        { error: 'Could not verify featured asset #1 mint before publishing.' },
        { status: 500 },
      );
    }

    const { error: updErr } = await supabaseAdmin
      .from('artists')
      .update({ paused: false })
      .eq('id', artistId)
      .eq('paused', true);

    if (updErr) {
      console.error('finalizeLaunch pause update:', updErr);
      return NextResponse.json({ error: 'Failed to publish artist' }, { status: 500 });
    }

    const inviteCoinResolved = await resolveInviteCoinForFinalize(
      artistId,
      treasuryWallet,
      coinFromBody || null,
    );

    if (inviteCoinResolved && 'error' in inviteCoinResolved) {
      return NextResponse.json(
        { error: inviteCoinResolved.error },
        { status: inviteCoinResolved.status },
      );
    }

    if (inviteCoinResolved && 'coin' in inviteCoinResolved) {
      const now = new Date().toISOString();
      const { data: updatedInvites, error: inviteLaunchedErr } = await supabaseAdmin
        .from('artist_invites')
        .update({
          status: 'launched',
          launched_at: now,
          updated_at: now,
        })
        .eq('coin_public_id', inviteCoinResolved.coin)
        .eq('status', 'claimed')
        .select('coin_public_id');

      if (inviteLaunchedErr) {
        console.error('finalizeLaunch invite launched update:', inviteLaunchedErr);
        return NextResponse.json(
          {
            error:
              'Artist is live but invite status could not be updated. Contact support with your coin id.',
          },
          { status: 500 },
        );
      }

      if (!updatedInvites?.length) {
        console.warn(
          'finalizeLaunch: artist unpaused but no claimed invite matched coin',
          inviteCoinResolved.coin,
        );
      }
    }

    return NextResponse.json({ success: true, message: 'Artist is now live.' });
  } catch (error: unknown) {
    console.error('finalizeLaunch:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
