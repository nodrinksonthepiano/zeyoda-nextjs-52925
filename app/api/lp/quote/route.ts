import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import {
  AMM_GET_POOL_ABI,
  getBaseSepoliaReadRpcUrl,
  resolveArtistAmmPool,
} from '@/app/utils/server/resolveArtistAmm';
import {
  poolReservesToOnChainLpWithdrawableUsd,
  remainingLpWithdrawableUsd,
  sumVirtualLpWithdrawnUsd,
} from '@/app/utils/server/lpVirtualTreasury';

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
    const percent = Number(searchParams.get('percent')) || 0;

    if (!artistId || percent < 0 || percent > 100) {
      return NextResponse.json({ 
        error: 'Invalid parameters: artistId required, percent 0-100' 
      }, { status: 400 });
    }

    const resolved = await resolveArtistAmmPool(supabaseAdmin, artistId);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 404 });
    }

    const rpcUrl = getBaseSepoliaReadRpcUrl();
    if (!rpcUrl) {
      return NextResponse.json(
        { error: 'Server misconfigured: SERVER_BASE_SEPOLIA_RPC_URL or BASE_SEPOLIA_RPC_URL required' },
        { status: 500 }
      );
    }

    const { tokenAddress, swapAddress } = resolved;

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const swapContract = new ethers.Contract(swapAddress, AMM_GET_POOL_ABI, provider);

    // Get current pool state
    const pool = await swapContract.getPool(tokenAddress);
    
    if (!pool.active || pool.ethReserve === 0n || pool.tokenReserve === 0n) {
      return NextResponse.json({ 
        error: 'No active liquidity pool for this artist' 
      }, { status: 400 });
    }

    const ethReserve = Number(ethers.formatEther(pool.ethReserve));
    const tokenReserve = Number(ethers.formatUnits(pool.tokenReserve, 18));
    const ethUsdRate = 2500;

    const onChainLpWithdrawableUsd = poolReservesToOnChainLpWithdrawableUsd(
      ethReserve,
      tokenReserve,
      ethUsdRate
    );
    const tokenPriceUsd = (ethReserve / tokenReserve) * ethUsdRate;
    const totalPoolUsd = ethReserve * ethUsdRate + tokenReserve * tokenPriceUsd;

    const virtualWithdrawnUsd = await sumVirtualLpWithdrawnUsd(supabaseAdmin, artistId);
    const lpWithdrawableUsd = remainingLpWithdrawableUsd(
      onChainLpWithdrawableUsd,
      virtualWithdrawnUsd
    );
    const quoteUsd = lpWithdrawableUsd * (percent / 100);

    const ethAmount = ethReserve * (percent / 100);
    const tokenAmount = tokenReserve * (percent / 100);

    return NextResponse.json({
      success: true,
      quoteUsd,
      ethAmount,
      tokenAmount,
      breakdown: {
        totalPoolUsd,
        onChainLpWithdrawableUsd,
        virtualWithdrawnUsd,
        lpWithdrawableUsd,
        percent,
        ethUsdRate,
        tokenPriceUsd
      }
    });

  } catch (error: any) {
    console.error('❌ LP quote error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
