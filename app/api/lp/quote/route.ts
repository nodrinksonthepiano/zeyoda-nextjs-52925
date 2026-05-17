import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import {
  AMM_GET_POOL_ABI,
  getBaseSepoliaReadRpcUrl,
  resolveArtistAmmPool,
} from '@/app/utils/server/resolveArtistAmm';
import {
  ARTIST_CASHOUT_FLOOR_WEI,
  ethWeiSurplusAboveFloor,
  surplusEthUsd,
  surplusWeiForWithdrawPercent,
} from '@/app/utils/server/lpVirtualTreasury';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
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
        error: 'Invalid parameters: artistId required, percent 0-100',
      }, { status: 400 });
    }

    const resolved = await resolveArtistAmmPool(supabaseAdmin, artistId);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 404 });
    }

    const rpcUrl = getBaseSepoliaReadRpcUrl();
    if (!rpcUrl) {
      return NextResponse.json(
        {
          error: 'Server misconfigured: SERVER_BASE_SEPOLIA_RPC_URL or BASE_SEPOLIA_RPC_URL required',
        },
        { status: 500 },
      );
    }

    const { tokenAddress, swapAddress } = resolved;

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const swapContract = new ethers.Contract(swapAddress, AMM_GET_POOL_ABI, provider);

    const pool = await swapContract.getPool(tokenAddress);

    if (!pool.active || pool.ethReserve === 0n || pool.tokenReserve === 0n) {
      return NextResponse.json({ error: 'No active liquidity pool for this artist' }, { status: 400 });
    }

    const ethUsdRate = 2500;
    const surplusWei = ethWeiSurplusAboveFloor(pool.ethReserve);
    const lpWithdrawableUsd = surplusEthUsd(pool.ethReserve, ethUsdRate);

    const clampedPercent =
      percent > 0 ? Math.max(1, Math.min(100, Math.round(percent * 10) / 10)) : 0;
    const sliceWei =
      clampedPercent > 0 && surplusWei > 0n
        ? surplusWeiForWithdrawPercent(surplusWei, clampedPercent)
        : 0n;
    const quoteUsd = Number((Number(ethers.formatEther(sliceWei)) * ethUsdRate).toFixed(2));

    const ethReserveNum = Number(ethers.formatEther(pool.ethReserve));
    const tokenReserveNum = Number(ethers.formatUnits(pool.tokenReserve, 18));
    const tokenPriceUsd =
      tokenReserveNum > 0 && Number.isFinite(ethReserveNum)
        ? (ethReserveNum / tokenReserveNum) * ethUsdRate
        : 0;
    const totalPoolUsd =
      Number.isFinite(ethReserveNum) && Number.isFinite(tokenReserveNum)
        ? ethReserveNum * ethUsdRate + tokenReserveNum * tokenPriceUsd
        : 0;

    const ethWithdrawPreview = Number(ethers.formatEther(sliceWei));
    const ethReserveAfter =
      surplusWei > 0n && sliceWei > 0n ? ethReserveNum - ethWithdrawPreview : ethReserveNum;

    return NextResponse.json({
      success: true,
      quoteUsd,
      ethAmount: ethWithdrawPreview,
      tokenAmount: 0,
      breakdown: {
        totalPoolUsd,
        lpWithdrawableUsd,
        surplusEthWei: surplusWei.toString(),
        floorWei: ARTIST_CASHOUT_FLOOR_WEI.toString(),
        percent: clampedPercent || percent,
        ethUsdRate,
        tokenPriceUsd,
        ethReserveBefore: ethReserveNum,
        ethReserveAfter,
        tokenReserveUnchanged: tokenReserveNum,
      },
    });
  } catch (error: unknown) {
    console.error('❌ LP quote error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
