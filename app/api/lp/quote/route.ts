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

// Swap contract for LP operations
const SWAP_CONTRACT_ADDRESS = "0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE";
const SWAP_ABI = [
  "function getPool(address token) view returns (tuple(address token, uint256 tokenReserve, uint256 ethReserve, bool active))"
];

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

    // Get token address from registry
    const { data: registry, error: registryError } = await supabaseAdmin
      .from('artist_registry')
      .select('token')
      .eq('id', artistId)
      .single();

    if (registryError || !registry?.token) {
      return NextResponse.json({ 
        error: `Token contract not found for artist: ${artistId}` 
      }, { status: 404 });
    }

    const tokenAddress = registry.token;

    // Setup provider and contract
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    const swapContract = new ethers.Contract(SWAP_CONTRACT_ADDRESS, SWAP_ABI, provider);

    // Get current pool state
    const pool = await swapContract.getPool(tokenAddress);
    
    if (!pool.active || pool.ethReserve === 0n || pool.tokenReserve === 0n) {
      return NextResponse.json({ 
        error: 'No active liquidity pool for this artist' 
      }, { status: 400 });
    }

    // Calculate quote
    const ethReserve = Number(ethers.formatEther(pool.ethReserve));
    const tokenReserve = Number(ethers.formatUnits(pool.tokenReserve, 18));
    const ethUsdRate = 2500; // Fallback ETH price
    const tokenPriceUsd = (ethReserve / tokenReserve) * ethUsdRate;
    
    const totalPoolUsd = (ethReserve * ethUsdRate) + (tokenReserve * tokenPriceUsd);
    const lpWithdrawableUsd = totalPoolUsd * 0.997; // Artist's 99.7% share
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
