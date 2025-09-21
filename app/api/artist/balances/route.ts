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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get('artistId');
    
    if (!artistId) {
      return NextResponse.json({ 
        error: 'Artist ID required as query parameter' 
      }, { status: 400 });
    }

    // Get artist data
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id, name, displayname, treasury_wallet')
      .eq('id', artistId)
      .single();
    
    if (artistError || !artist) {
      return NextResponse.json({ 
        error: `Artist not found: ${artistId}` 
      }, { status: 404 });
    }

    // Calculate downloads USD available (from artist_earnings)
    const { data: earnings, error: earningsError } = await supabaseAdmin
      .from('artist_earnings')
      .select('net_earnings_usd, status, collectible_minted')
      .eq('artist_id', artistId)
      .neq('error_reason', 'LP_FEE'); // Exclude LP fees

    if (earningsError) {
      console.error('❌ Earnings fetch error:', earningsError);
      return NextResponse.json({ 
        error: 'Failed to fetch earnings data' 
      }, { status: 500 });
    }

    // Calculate available download earnings (minted/completed sales)
    const downloadsUsdAvailable = (earnings || [])
      .filter(e => e.status === 'minted' && e.collectible_minted)
      .reduce((sum, e) => sum + parseFloat(e.net_earnings_usd || '0'), 0);

    // Calculate LP withdrawable (reuse existing logic from artist-earnings)
    let lpWithdrawableUsd = 0;
    try {
      // Get registry for swap contract
      const { data: registry } = await supabaseAdmin
        .from('artist_registry')
        .select('token, swap')
        .eq('id', artistId)
        .single();

      if (registry?.swap && registry?.token) {
        // Calculate LP withdrawable amount (99.7% of pool value)
        // This is a simplified version - you can reuse the exact logic from artist-earnings API
        const ethUsdRate = 2500; // Simplified - use your actual rate logic
        
        // For now, return 0 - this will be calculated properly in the existing LP logic
        lpWithdrawableUsd = 0; // TODO: Implement proper LP calculation
      }
    } catch (error) {
      console.warn('LP calculation failed:', error);
    }

    return NextResponse.json({
      artistId,
      artistName: artist.name,
      downloadsUsdAvailable: Number(downloadsUsdAvailable.toFixed(2)),
      lpWithdrawableUsd: Number(lpWithdrawableUsd.toFixed(2)),
      breakdown: {
        totalEarningsRecords: earnings?.length || 0,
        mintedSales: earnings?.filter(e => e.status === 'minted').length || 0
      }
    });

  } catch (error) {
    console.error('❌ Artist balances API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
