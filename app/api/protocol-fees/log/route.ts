import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

// Use service role key to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface LogProtocolFeeRequest {
  txHash: string;
  artistId?: string;
  tokenAddress: string;
  userAddress: string;
  swapDirection: 'ETH_TO_TOKEN' | 'TOKEN_TO_ETH' | 'TOKEN_TO_TOKEN';
  feeAmountWei: string;
  feeToken: string; // 'ETH' or token address
  blockNumber: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as LogProtocolFeeRequest;
    
    const {
      txHash,
      artistId,
      tokenAddress,
      userAddress,
      swapDirection,
      feeAmountWei,
      feeToken,
      blockNumber
    } = body;
    
    // Validate required fields
    if (!txHash || !tokenAddress || !userAddress || !swapDirection || !feeAmountWei || !feeToken || !blockNumber) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    console.log('💰 Logging protocol fee:', {
      txHash: txHash.slice(0, 15) + '...',
      artistId,
      swapDirection,
      feeAmountWei,
      feeToken,
      userAddress: userAddress.slice(0, 10) + '...'
    });
    
    // Get current ETH price for USD conversion
    let ethUsdRate = 2500; // Fallback
    try {
      const priceResponse = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=ETH');
      const priceData = await priceResponse.json();
      if (priceData?.data?.rates?.USD) {
        ethUsdRate = parseFloat(priceData.data.rates.USD);
      }
    } catch (priceError) {
      console.warn('⚠️ Failed to fetch ETH price, using fallback');
    }
    
    // Calculate USD value (assume fee is in ETH for now - token fees need token price lookup)
    let feeUsd = 0;
    if (feeToken === 'ETH' || feeToken.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
      const feeEth = parseFloat(ethers.formatEther(feeAmountWei));
      feeUsd = feeEth * ethUsdRate;
    } else {
      // For token fees, we'd need to look up token price
      // For now, set to 0 (can enhance later)
      feeUsd = 0;
      console.warn('⚠️ Token fee USD conversion not yet implemented');
    }
    
    // Insert into database
    const { data, error } = await supabase
      .from('protocol_swap_fees')
      .insert({
        tx_hash: txHash,
        artist_id: artistId || null,
        token_address: tokenAddress.toLowerCase(),
        user_address: userAddress.toLowerCase(),
        swap_direction: swapDirection,
        fee_amount_wei: feeAmountWei,
        fee_token: feeToken === 'ETH' ? 'ETH' : feeToken.toLowerCase(),
        fee_usd: feeUsd,
        eth_usd_rate: ethUsdRate,
        block_number: blockNumber
      })
      .select()
      .single();
    
    if (error) {
      // Check if duplicate (tx_hash is unique)
      if (error.code === '23505') {
        console.log('⚠️ Fee already logged for tx:', txHash.slice(0, 15) + '...');
        return NextResponse.json(
          { success: true, message: 'Fee already logged', duplicate: true },
          { status: 200 }
        );
      }
      
      console.error('❌ Failed to log protocol fee:', error);
      return NextResponse.json(
        { error: 'Failed to log protocol fee', details: error.message },
        { status: 500 }
      );
    }
    
    console.log('✅ Protocol fee logged successfully:', data.id);
    
    return NextResponse.json({
      success: true,
      feeId: data.id,
      feeUsd: feeUsd.toFixed(8),
      ethUsdRate: ethUsdRate.toFixed(2)
    });
    
  } catch (error: any) {
    console.error('❌ Log protocol fee API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

