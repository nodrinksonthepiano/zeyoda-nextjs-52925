import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

// Use service role key to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// AMM V2 address
const AMM_ADDRESS = process.env.NEXT_PUBLIC_UUPS_AMM || '0x49B9538e0022dD919d9af2358783e89d08bCd82c';

// Minimal ABI for querying ProtocolFeeCollected events
const AMM_ABI = [
  'event ProtocolFeeCollected(address indexed payer, address indexed tokenIn, uint256 feeAmount)'
];

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function GET(request: NextRequest) {
  try {
    console.log('🏦 Fetching treasury earnings (from database)');
    
    // Query protocol_swap_fees table for all collected fees
    const { data: fees, error: feesError } = await supabaseAdmin
      .from('protocol_swap_fees')
      .select('*')
      .order('collected_at', { ascending: false });
    
    if (feesError) {
      console.error('❌ Failed to fetch protocol fees:', feesError);
      return NextResponse.json(
        { error: 'Failed to fetch protocol fees', details: feesError.message },
        { status: 500 }
      );
    }
    
    console.log(`💰 Found ${fees?.length || 0} protocol fee records`);
    
    // Calculate totals
    const totalFeesUsd = (fees || []).reduce((sum, fee) => {
      return sum + (parseFloat(fee.fee_usd?.toString() || '0'));
    }, 0);
    
    const totalFeesEth = (fees || []).reduce((sum, fee) => {
      if (fee.fee_token === 'ETH') {
        const feeWei = BigInt(fee.fee_amount_wei || '0');
        return sum + parseFloat(ethers.formatEther(feeWei));
      }
      return sum;
    }, 0);
    
    // Get current ETH price for display
    let currentEthUsdRate = 2500;
    try {
      const priceResponse = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=ETH');
      const priceData = await priceResponse.json();
      if (priceData?.data?.rates?.USD) {
        currentEthUsdRate = parseFloat(priceData.data.rates.USD);
      }
    } catch (priceError) {
      console.warn('⚠️ Failed to fetch current ETH price');
    }
    
    // Format recent fees (last 50)
    const recentFees = (fees || []).slice(0, 50).map(fee => ({
      id: fee.id,
      artistId: fee.artist_id || 'unknown',
      artistName: fee.artist_id || 'Unknown Artist',
      feeAmount: parseFloat(fee.fee_usd?.toString() || '0'),
      feeType: fee.swap_direction === 'ETH_TO_TOKEN' ? 'Buy (ETH→Token)' : 
                fee.swap_direction === 'TOKEN_TO_ETH' ? 'Sell (Token→ETH)' : 
                'Swap (Token→Token)',
      createdAt: fee.collected_at,
      txHash: fee.tx_hash
    }));
    
    console.log('📈 Treasury stats:', {
      totalFeesUsd: totalFeesUsd.toFixed(4),
      totalFeesEth: totalFeesEth.toFixed(8),
      totalTransactions: fees?.length || 0,
      currentEthUsdRate: currentEthUsdRate.toFixed(2)
    });
    
    return NextResponse.json({
      success: true,
      totalProtocolFees: Number(totalFeesUsd.toFixed(8)),
      swapFeesUsd: Number(totalFeesUsd.toFixed(8)),
      downloadFeesUsd: 0, // Downloads = 0% fee
      totalTransactions: fees?.length || 0,
      recentFees,
      // Extra metadata
      totalFeesEth: Number(totalFeesEth.toFixed(8)),
      ethUsdRate: Number(currentEthUsdRate.toFixed(2)),
      note: 'Accurate fee tracking from database (only shows fees logged since AMM V2 upgrade)'
    });
    
  } catch (error: any) {
    console.error('❌ Treasury earnings API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error.stack
    }, { status: 500 });
  }
}
