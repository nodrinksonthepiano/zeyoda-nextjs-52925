import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyWhitelist } from '@/app/utils/server/whitelistCheck';
import { getMagicAuthFromBearer } from '@/app/utils/server/magicBearerEmail';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Treasure (`cash_balances`) read via service role so browser RLS cannot hide LP-withdraw credits.
 */
export async function GET(request: NextRequest) {
  try {
    const whitelistResult = await verifyWhitelist(request);
    if (!whitelistResult.verified || !whitelistResult.email) {
      return NextResponse.json(
        {
          error: whitelistResult.error || 'Unauthorized',
          message: 'Authentication required',
        },
        { status: whitelistResult.email === null ? 401 : 403 }
      );
    }

    const auth = await getMagicAuthFromBearer(request);
    const wallet = auth?.publicAddress?.trim().toLowerCase();
    if (!wallet) {
      return NextResponse.json(
        {
          error: 'No wallet on session',
          message: 'Treasure requires a linked Magic wallet',
        },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('cash_balances')
      .select('usd_balance')
      .eq('wallet_address', wallet)
      .maybeSingle();

    if (error) {
      console.error('❌ /api/me/cash-balance select error:', error);
      return NextResponse.json(
        { error: 'Failed to load Treasure balance', details: error.message },
        { status: 500 }
      );
    }

    const usdBalance = parseFloat(String(data?.usd_balance ?? '0')) || 0;

    return NextResponse.json({
      success: true,
      walletAddress: wallet,
      usdBalance,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('❌ /api/me/cash-balance:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
