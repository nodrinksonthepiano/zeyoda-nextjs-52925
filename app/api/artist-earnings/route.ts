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

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get('artistId');
    
    console.log('📊 Fetching artist earnings:', artistId);
    
    if (!artistId) {
      return NextResponse.json({ 
        error: 'Artist ID required as query parameter' 
      }, { status: 400 });
    }
    
    // Get artist summary data (totals)
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id, name, displayname, total_earnings_usd, total_sales_count')
      .eq('id', artistId)
      .single();
    
    if (artistError) {
      console.error('❌ Artist lookup error:', artistError);
      return NextResponse.json({ 
        error: `Artist not found: ${artistId}` 
      }, { status: 404 });
    }
    
    console.log('🎨 Artist found:', artist.name, 'Total earnings:', artist.total_earnings_usd);
    
    // Get recent earnings with joined asset data (last 50 transactions)
    const { data: earnings, error: earningsError } = await supabaseAdmin
      .from('artist_earnings')
      .select(`
        id,
        asset_id,
        gross_amount_usd,
        protocol_fee_usd,
        net_earnings_usd,
        payment_method,
        source,
        tx_hash,
        collectible_minted,
        status,
        created_at,
        artist_assets!inner(
          asset_number,
          price_usd,
          metadata
        )
      `)
      .eq('artist_id', artistId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (earningsError) {
      console.error('❌ Earnings fetch error:', earningsError);
      return NextResponse.json({ 
        error: 'Failed to fetch earnings data',
        details: earningsError.message
      }, { status: 500 });
    }
    
    console.log('💰 Found', earnings?.length || 0, 'earnings records');
    
    // Format earnings data for frontend consumption
    const formattedEarnings = (earnings || []).map(earning => ({
      id: earning.id,
      assetNumber: earning.artist_assets.asset_number,
      assetTitle: earning.artist_assets.metadata?.title || `Asset #${earning.artist_assets.asset_number}`,
      grossAmount: earning.gross_amount_usd,
      protocolFee: earning.protocol_fee_usd,
      netEarnings: earning.net_earnings_usd,
      paymentMethod: earning.payment_method,
      source: earning.source,
      txHash: earning.tx_hash,
      collectibleMinted: earning.collectible_minted,
      status: earning.status,
      createdAt: earning.created_at
    }));
    
    // Calculate additional metrics
    const totalEarnings = artist.total_earnings_usd || 0;
    const totalSales = artist.total_sales_count || 0;
    const availableBalance = totalEarnings; // For now, same as total earnings
    
    // Calculate some basic stats from recent earnings
    const recentEarnings = formattedEarnings.slice(0, 10); // Last 10 for recent display
    const mintedCount = formattedEarnings.filter(e => e.collectibleMinted).length;
    const pendingCount = formattedEarnings.filter(e => !e.collectibleMinted).length;
    
    console.log('📈 Stats:', { totalEarnings, totalSales, mintedCount, pendingCount });
    
    return NextResponse.json({
      success: true,
      artist: {
        id: artist.id,
        name: artist.name,
        displayName: artist.displayname
      },
      totals: {
        totalEarnings: Number(totalEarnings),
        totalSales: Number(totalSales),
        availableBalance: Number(availableBalance),
        mintedCount,
        pendingCount
      },
      recentEarnings,
      allEarnings: formattedEarnings // Include all for potential future use
    });
    
  } catch (error: any) {
    console.error('❌ Artist earnings API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error.stack
    }, { status: 500 });
  }
}
