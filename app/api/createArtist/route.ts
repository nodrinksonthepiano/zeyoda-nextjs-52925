import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(request: NextRequest) {
  try {
    const artistData = await request.json();
    console.log('🎨 Creating artist via API:', artistData.name);

    const downloadPriceNum = Number(artistData.downloadPrice);
    if (!Number.isFinite(downloadPriceNum) || downloadPriceNum <= 0) {
      return NextResponse.json(
        { error: 'downloadPrice must be a number greater than 0' },
        { status: 400 },
      );
    }

    /**
     * When `coin_public_id` is sent, invite-driven launch requires a successful registry insert before
     * marking the NFC invite as launched (no warn-only shortcut). Omit `coin_public_id` to keep legacy
     * warn-and-continue behavior on registry insert failure.
     */
    const inviteCoin =
      typeof artistData.coin_public_id === 'string' ? artistData.coin_public_id.trim() : '';
    const inviteDrivenLaunch = inviteCoin.length > 0;

    const artistRecord = {
      id: artistData.id,
      name: artistData.name,
      displayname: artistData.displayname,
      tokenName: artistData.tokenName || artistData.name,
      artworktitle: artistData.artworktitle,
      artworkyear: artistData.artworkyear,
      tokenprice: downloadPriceNum,
      videosrc: artistData.contentUrl,
      contract: artistData.tokenAddress,
      download_address: artistData.downloadsAddress,
      swap_address: artistData.poolAddress,
      treasury_wallet: artistData.treasuryWallet,
      hasLiquidityPool: true,
      theme: {
        primaryColor: artistData.primaryColor,
        accentColor: artistData.accentColor,
        gradientStart: artistData.gradientStart,
        gradientMiddle: artistData.gradientMiddle,
        gradientEnd: artistData.gradientEnd,
        fontFamily: artistData.fontFamily,
        stardust: artistData.stardust === true,
      },
      orbitaltokens: artistData.orbitaltokens || [],
      paused: true,
    };

    const { data: artistResult, error: artistError } = await supabaseAdmin
      .from('artists')
      .insert([artistRecord])
      .select();

    if (artistError) {
      console.error('❌ Artist table error:', artistError);
      return NextResponse.json(
        { error: `Failed to save artist: ${artistError.message}` },
        { status: 500 },
      );
    }

    const registryRecord = {
      id: artistData.id,
      token: artistData.tokenAddress,
      downloads: artistData.downloadsAddress,
      swap: artistData.poolAddress,
      treasury_wallet: artistData.treasuryWallet,
    };

    const { data: registryResult, error: registryError } = await supabaseAdmin
      .from('artist_registry')
      .insert([registryRecord])
      .select();

    if (inviteDrivenLaunch) {
      const registryOk = !registryError && Array.isArray(registryResult) && registryResult.length > 0;
      if (!registryOk) {
        console.error('❌ Invite launch: registry insert failed (blocking):', registryError);
        return NextResponse.json(
          {
            error: `Invite launch requires registry insert. ${registryError?.message ?? 'Registry insert missing'}`,
          },
          { status: 500 },
        );
      }

      const { error: inviteUpdErr } = await supabaseAdmin
        .from('artist_invites')
        .update({
          status: 'launched',
          launched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('coin_public_id', inviteCoin)
        .eq('status', 'claimed');

      if (inviteUpdErr) {
        console.error('❌ artist_invites launched update:', inviteUpdErr);
      }
    } else if (registryError) {
      console.warn('⚠️ Registry table error:', registryError);
    }

    console.log('✅ Artist created successfully:', artistData.name);

    return NextResponse.json({
      success: true,
      artist: artistResult?.[0],
      registry: registryResult?.[0],
      message: `${artistData.name} created successfully!`,
    });
  } catch (error: unknown) {
    console.error('❌ API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
