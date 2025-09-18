import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Use service role key to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function POST(request: NextRequest) {
  try {
    const { userAddress, artistId, assetNumber, externalId } = await request.json();
    console.log('💰 Recording sale via API:', { artistId, assetNumber, userAddress: userAddress?.slice(0, 8) + '...' });

    if (!userAddress || !artistId || !assetNumber || !externalId) {
      return NextResponse.json({ 
        error: 'Missing required fields: userAddress, artistId, assetNumber, externalId' 
      }, { status: 400 });
    }
    
    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 'unknown';
    const ipHash = crypto.createHash('sha256').update(clientIP + 'IP_SALT').digest('hex');
    
    // Look up asset by artist_id and asset_number
    const { data: asset, error: assetError } = await supabaseAdmin
      .from('artist_assets')
      .select('id, price_usd')
      .eq('artist_id', artistId)
      .eq('asset_number', assetNumber)
      .single();
    
    if (assetError || !asset) {
      console.error('❌ Asset lookup error:', assetError);
      return NextResponse.json({ 
        error: `Asset not found for artist ${artistId}, asset number ${assetNumber}` 
      }, { status: 404 });
    }
    
    const grossAmount = asset.price_usd;
    const protocolFee = grossAmount * 0.003; // 0.3% protocol fee
    
    console.log('💸 Sale details:', { grossAmount, protocolFee, assetId: asset.id });
    
    // Call record_artist_sale RPC function
    const { data: saleResult, error: saleError } = await supabaseAdmin
      .rpc('record_artist_sale', {
        p_artist_id: artistId,
        p_buyer_address: userAddress.toLowerCase(),
        p_asset_id: asset.id,
        p_gross_amount: grossAmount,
        p_protocol_fee: protocolFee,
        p_payment_method: 'eth_balance',
        p_processor_fee: 0,
        p_source: 'eth',
        p_external_id: externalId,
        p_ip_hash: ipHash
      });
    
    if (saleError) {
      console.error('❌ Sale recording error:', saleError);
      
      // Handle duplicate external_id (unique constraint violation)
      if (saleError.code === '23505' || saleError.message?.includes('duplicate')) {
        console.log('⚠️ Duplicate sale detected:', externalId);
        return NextResponse.json({ 
          duplicate: true,
          message: 'Sale already recorded'
        }, { status: 409 });
      }
      
      throw saleError;
    }
    
    const result = saleResult?.[0];
    if (!result) {
      throw new Error('No result returned from record_artist_sale');
    }
    
    console.log('✅ Sale recorded successfully:', { earningId: result.earning_id, netEarnings: result.net_earnings });
    
    return NextResponse.json({
      success: true,
      earningId: result.earning_id,
      netEarnings: result.net_earnings,
      grossAmount: grossAmount,
      protocolFee: protocolFee,
      readyForMint: true
    });
    
  } catch (error: any) {
    console.error('❌ Record sale API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}