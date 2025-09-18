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
    
    // Get all protocol fees across all artists
    const { data: earnings, error: earningsError } = await supabaseAdmin
      .from('artist_earnings')
      .select(`
        id,
        artist_id,
        protocol_fee_usd,
        created_at,
        artists!inner(
          name,
          displayname
        )
      `)
      .order('created_at', { ascending: false });
    
    if (earningsError) {
      console.error('❌ Treasury earnings fetch error:', earningsError);
      return NextResponse.json({ 
        error: 'Failed to fetch treasury earnings',
        details: earningsError.message
      }, { status: 500 });
    }
    
    console.log('💰 Found', earnings?.length || 0, 'earnings records for treasury');
    
    // Calculate totals
    const totalProtocolFees = (earnings || []).reduce((sum, earning) => {
      return sum + parseFloat(earning.protocol_fee_usd || '0');
    }, 0);
    
    const totalSales = earnings?.length || 0;
    
    // Format recent fees for display (last 50)
    const recentFees = (earnings || []).slice(0, 50).map(earning => ({
      id: earning.id,
      artistId: earning.artist_id,
      artistName: earning.artists.displayname || earning.artists.name,
      protocolFee: parseFloat(earning.protocol_fee_usd || '0'),
      createdAt: earning.created_at
    }));
    
    console.log('📈 Treasury stats:', { 
      totalProtocolFees: totalProtocolFees.toFixed(4), 
      totalSales,
      recentCount: recentFees.length
    });
    
    return NextResponse.json({
      success: true,
      totalProtocolFees: Number(totalProtocolFees.toFixed(8)),
      totalSales: Number(totalSales),
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
