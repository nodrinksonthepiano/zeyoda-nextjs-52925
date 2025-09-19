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
    console.log('🏦 Fetching treasury earnings (protocol fees)');
    
    // Get all protocol fees: download fees + swap fees
    const { data: earnings, error: earningsError } = await supabaseAdmin
      .from('artist_earnings')
      .select(`
        id,
        artist_id,
        protocol_fee_usd,
        net_earnings_usd,
        source,
        error_reason,
        created_at,
        artists!inner(
          name,
          displayname
        )
      `)
      .or('protocol_fee_usd.gt.0,error_reason.eq.LP_FEE') // Download protocol fees OR LP fees
      .order('created_at', { ascending: false });
    
    if (earningsError) {
      console.error('❌ Treasury earnings fetch error:', earningsError);
      return NextResponse.json({ 
        error: 'Failed to fetch treasury earnings',
        details: earningsError.message
      }, { status: 500 });
    }
    
    console.log('💰 Found', earnings?.length || 0, 'earnings records for treasury');
    
    // Separate download fees from swap fees
    const downloadFees = (earnings || []).filter(e => e.error_reason !== 'LP_FEE');
    const swapFees = (earnings || []).filter(e => e.error_reason === 'LP_FEE');
    
    // Calculate totals
    const downloadFeesUsd = downloadFees.reduce((sum, earning) => {
      return sum + parseFloat(earning.protocol_fee_usd || '0');
    }, 0);
    
    const swapFeesUsd = swapFees.reduce((sum, earning) => {
      return sum + parseFloat(earning.net_earnings_usd || '0'); // Full amount for LP fees
    }, 0);
    
    const totalProtocolFees = downloadFeesUsd + swapFeesUsd;
    const totalTransactions = earnings?.length || 0;
    
    // Format recent fees for display (last 50, mixed sources)
    const recentFees = (earnings || []).slice(0, 50).map(earning => ({
      id: earning.id,
      artistId: earning.artist_id,
      artistName: earning.artists.displayname || earning.artists.name,
      feeAmount: earning.error_reason === 'LP_FEE' ? 
        parseFloat(earning.net_earnings_usd || '0') : 
        parseFloat(earning.protocol_fee_usd || '0'),
      feeType: earning.error_reason === 'LP_FEE' ? 'Swap Fee' : 'Download Fee',
      createdAt: earning.created_at
    }));
    
    console.log('📈 Treasury stats:', { 
      totalProtocolFees: totalProtocolFees.toFixed(4), 
      downloadFees: downloadFeesUsd.toFixed(4),
      swapFees: swapFeesUsd.toFixed(4),
      totalTransactions,
      recentCount: recentFees.length
    });
    
    return NextResponse.json({
      success: true,
      totalProtocolFees: Number(totalProtocolFees.toFixed(8)),
      downloadFeesUsd: Number(downloadFeesUsd.toFixed(8)),
      swapFeesUsd: Number(swapFeesUsd.toFixed(8)),
      totalTransactions: Number(totalTransactions),
      recentFees
    });
    
  } catch (error: any) {
    console.error('❌ Treasury earnings API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error.stack
    }, { status: 500 });
  }
}
