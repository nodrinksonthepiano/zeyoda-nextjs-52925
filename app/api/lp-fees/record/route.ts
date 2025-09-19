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

interface LPFeeRequest {
  poolAddress: string;  // Pool that was hit (determines artist)
  txHash: string;
  logIndex: number;
  tokenIn: string;
  amountInRaw: string;
  tokenInDecimals: number;
  baseQuote: 'USDC' | 'ETH';
  blockNumber: number;
  // artistId removed - derive server-side from poolAddress
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function POST(request: NextRequest) {
  try {
    const feeData: LPFeeRequest = await request.json();
    console.log('💰 Recording LP fee:', { 
      artistId: feeData.artistId, 
      txHash: feeData.txHash.slice(0, 10) + '...',
      amountIn: feeData.amountInRaw
    });

    // Validate required fields (artistId removed - derive server-side)
    const { poolAddress, txHash, logIndex, tokenIn, amountInRaw, tokenInDecimals, baseQuote, blockNumber } = feeData;
    
    if (!poolAddress || !txHash || logIndex === undefined || !tokenIn || !amountInRaw || !tokenInDecimals || !baseQuote || !blockNumber) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        required: ['poolAddress', 'txHash', 'logIndex', 'tokenIn', 'amountInRaw', 'tokenInDecimals', 'baseQuote', 'blockNumber']
      }, { status: 400 });
    }

    // Derive artistId from tokenIn address (server-side security)
    const { data: registry, error: registryError } = await supabaseAdmin
      .from('artist_registry')
      .select('id, token, swap')
      .eq('token', tokenIn)
      .single();

    if (registryError || !registry) {
      console.error('❌ Token not found in registry:', tokenIn, registryError);
      return NextResponse.json({ 
        error: `Unknown token for LP fee: ${tokenIn}` 
      }, { status: 404 });
    }

    const artistId = registry.id;
    console.log('🎯 Derived artist from token:', { tokenIn: tokenIn.slice(0, 8) + '...', artistId });

    // Get artist data
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id, name, displayname, treasury_wallet, total_earnings_usd, total_sales_count')
      .eq('id', artistId)
      .single();

    if (artistError || !artist) {
      console.error('❌ Artist not found:', artistId, artistError);
      return NextResponse.json({ 
        error: `Artist not found: ${artistId}` 
      }, { status: 404 });
    }

    // Calculate LP fee (0.30% of input amount)
    const amountIn = parseFloat(amountInRaw) / Math.pow(10, tokenInDecimals);
    const feeBase = amountIn * 0.003; // 0.30% trading fee

    // Convert to USD based on base quote
    let feeUsd: number;
    let ethUsdRate: number | null = null;

    if (baseQuote === 'USDC') {
      // USDC pools: 1 USDC ≈ $1 USD
      feeUsd = feeBase;
    } else if (baseQuote === 'ETH') {
      // ETH pools: convert using current ETH/USD rate
      ethUsdRate = 2500; // Fallback rate - can be improved with price oracle
      feeUsd = feeBase * ethUsdRate;
    } else {
      return NextResponse.json({ 
        error: `Unsupported base quote: ${baseQuote}` 
      }, { status: 400 });
    }

    // Create external_id for idempotency (includes poolAddress for two-hop swaps)
    const externalId = `${txHash}:${logIndex}:${poolAddress}`;

    console.log('💸 LP fee details:', { 
      amountIn: amountIn.toFixed(6), 
      feeBase: feeBase.toFixed(6), 
      feeUsd: feeUsd.toFixed(6),
      baseQuote,
      ethUsdRate
    });

    // Insert into artist_earnings table
    const { data: insertResult, error: insertError } = await supabaseAdmin
      .from('artist_earnings')
      .insert({
        artist_id: artistId,
        buyer_address: artist.treasury_wallet?.toLowerCase() || 'amm-router', // LP owner receives the fee
        asset_id: null, // Not a download sale
        gross_amount_usd: feeUsd,
        protocol_fee_usd: 0, // No protocol fee on LP fees
        processor_fee_usd: 0,
        net_earnings_usd: feeUsd,
        payment_method: 'eth_balance', // LP fees are ETH-based
        source: 'eth', // LP fees come from ETH trading
        external_id: externalId,
        tx_hash: txHash,
        collectible_minted: false, // Not applicable for LP fees
        status: 'minted', // Fee is immediately available
        created_at: new Date().toISOString(),
        // Use a metadata field or comment to distinguish LP fees
        error_reason: 'LP_FEE' // Repurpose this field to mark LP fees
      })
      .select();

    if (insertError) {
      // Handle duplicate external_id (idempotency)
      if (insertError.code === '23505' || insertError.message?.includes('duplicate')) {
        console.log('⚠️ Duplicate LP fee detected:', externalId);
        return NextResponse.json({ 
          duplicate: true,
          message: 'LP fee already recorded'
        }, { status: 200 }); // 200 for successful idempotency
      }
      
      console.error('❌ LP fee insert error:', insertError);
      throw insertError;
    }

    const result = insertResult?.[0];
    console.log('✅ LP fee recorded:', { earningId: result?.id, feeUsd: feeUsd.toFixed(6) });

    // Update artist totals (LP fees count toward total earnings)
    const { error: updateError } = await supabaseAdmin
      .from('artists')
      .update({
        total_earnings_usd: artist.total_earnings_usd ? parseFloat(artist.total_earnings_usd) + feeUsd : feeUsd,
        total_sales_count: artist.total_sales_count ? artist.total_sales_count + 1 : 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', artistId);

    if (updateError) {
      console.warn('⚠️ Failed to update artist totals:', updateError);
      // Don't fail the request if totals update fails
    }

    return NextResponse.json({
      success: true,
      earningId: result?.id,
      feeUsd: parseFloat(feeUsd.toFixed(6)),
      baseQuote,
      ethUsdRate,
      externalId
    });

  } catch (error: any) {
    console.error('❌ LP fee recording error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
