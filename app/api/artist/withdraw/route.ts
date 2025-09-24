import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface WithdrawRequest {
  artistId: string;
  type: 'downloads' | 'cash';
  amountUsd: number;
  method: 'paypal' | 'eth_balance';
}

export async function POST(request: NextRequest) {
  try {
    const withdrawData: WithdrawRequest = await request.json();
    console.log('💰 Withdrawal request:', { 
      artistId: withdrawData.artistId,
      type: withdrawData.type || 'downloads',
      amount: withdrawData.amountUsd,
      method: withdrawData.method 
    });

    // Validate required fields
    if (!withdrawData.artistId || !withdrawData.amountUsd || !withdrawData.method) {
      return NextResponse.json({ 
        error: 'Missing required fields: artistId, amountUsd, method' 
      }, { status: 400 });
    }

    // Get wallet address from header for auth
    const walletAddress = request.headers.get('x-wallet-address');
    if (!walletAddress) {
      return NextResponse.json({ 
        error: 'Missing x-wallet-address header' 
      }, { status: 400 });
    }

    // Verify artist exists and get treasury wallet
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id, name, displayname, treasury_wallet')
      .eq('id', withdrawData.artistId)
      .single();

    if (artistError || !artist) {
      return NextResponse.json({ 
        error: `Artist not found: ${withdrawData.artistId}` 
      }, { status: 404 });
    }

    // Verify caller is the artist's treasury wallet
    const callerLc = walletAddress.toLowerCase();
    const ownerLc = artist.treasury_wallet?.toLowerCase() || '';
    
    if (!ownerLc || callerLc !== ownerLc) {
      return NextResponse.json({ 
        error: 'Permission denied: only artist treasury wallet can withdraw downloads' 
      }, { status: 403 });
    }

    // Calculate available downloads balance
    const { data: earnings, error: earningsError } = await supabaseAdmin
      .from('artist_earnings')
      .select('net_earnings_usd, status, collectible_minted')
      .eq('artist_id', withdrawData.artistId)
      .neq('error_reason', 'LP_FEE'); // Exclude LP fees

    if (earningsError) {
      return NextResponse.json({ 
        error: 'Failed to fetch earnings data' 
      }, { status: 500 });
    }

    const downloadsUsdAvailable = (earnings || [])
      .filter(e => e.status === 'minted' && e.collectible_minted)
      .reduce((sum, e) => sum + parseFloat(e.net_earnings_usd || '0'), 0);

    // Validate withdrawal amount
    if (withdrawData.amountUsd > downloadsUsdAvailable) {
      return NextResponse.json({ 
        error: `Insufficient downloads balance. Available: $${downloadsUsdAvailable.toFixed(2)}` 
      }, { status: 400 });
    }

    // For testnet MVP: Create withdrawal record (off-chain simulation)
    const withdrawalRecord = {
      artist_id: withdrawData.artistId,
      buyer_address: artist.treasury_wallet,
      asset_id: null, // Downloads withdrawal, not asset-specific
      gross_amount_usd: withdrawData.amountUsd,
      protocol_fee_usd: 0, // No fee on withdrawals
      net_earnings_usd: withdrawData.amountUsd,
      payment_method: withdrawData.method,
      source: withdrawData.type === 'cash' ? 'cash_withdrawal' : 'downloads_withdrawal',
      external_id: `${withdrawData.type || 'downloads'}_withdraw_${Date.now()}`,
      status: 'minted',
      error_reason: withdrawData.type === 'cash' ? 'CASH_WITHDRAWAL' : 'DOWNLOADS_WITHDRAWAL',
      collectible_minted: true
    };

    const { error: recordError } = await supabaseAdmin
      .from('artist_earnings')
      .insert([withdrawalRecord]);

    if (recordError) {
      console.error('❌ Failed to record withdrawal:', recordError);
      return NextResponse.json({ 
        error: 'Failed to process withdrawal' 
      }, { status: 500 });
    }

    console.log('✅ Downloads withdrawal recorded:', {
      artistId: withdrawData.artistId,
      amount: withdrawData.amountUsd,
      method: withdrawData.method
    });

    return NextResponse.json({
      success: true,
      withdrawal: {
        artistId: withdrawData.artistId,
        amountUsd: withdrawData.amountUsd,
        method: withdrawData.method,
        status: 'completed'
      }
    });

  } catch (error) {
    console.error('❌ Downloads withdrawal error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
