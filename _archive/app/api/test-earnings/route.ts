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

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Creating test earnings data...');
    
    // Get asset IDs
    const { data: assets, error: assetsError } = await supabaseAdmin
      .from('artist_assets')
      .select('id, artist_id, asset_number, price_usd');
    
    if (assetsError || !assets?.length) {
      return NextResponse.json({ error: 'No assets found' }, { status: 404 });
    }
    
    const testSales = [];
    
    // Create test sales for each artist
    for (const asset of assets) {
      const grossAmount = asset.price_usd || 1.0;
      const protocolFee = grossAmount * 0.003; // 0.3%
      const netEarnings = grossAmount - protocolFee;
      
      // Create a test sale
      testSales.push({
        artist_id: asset.artist_id,
        buyer_address: '0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8', // Your test wallet
        asset_id: asset.id,
        gross_amount_usd: grossAmount,
        protocol_fee_usd: protocolFee,
        processor_fee_usd: 0,
        net_earnings_usd: netEarnings,
        payment_method: 'eth_balance',
        source: 'eth',
        external_id: `test-${asset.artist_id}-${Date.now()}`,
        tx_hash: '0x1234567890abcdef',
        collectible_minted: true,
        status: 'minted'
      });
    }
    
    // Insert test sales
    const { data: insertResult, error: insertError } = await supabaseAdmin
      .from('artist_earnings')
      .insert(testSales)
      .select();
    
    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    
    // Update artist totals
    for (const asset of assets) {
      const grossAmount = asset.price_usd || 1.0;
      const protocolFee = grossAmount * 0.003;
      const netEarnings = grossAmount - protocolFee;
      
      await supabaseAdmin
        .from('artists')
        .update({
          total_earnings_usd: netEarnings,
          total_sales_count: 1
        })
        .eq('id', asset.artist_id);
    }
    
    console.log('✅ Test earnings created:', insertResult?.length);
    
    return NextResponse.json({
      success: true,
      message: `Created ${insertResult?.length} test sales`,
      sales: insertResult
    });
    
  } catch (error: any) {
    console.error('Test earnings error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
