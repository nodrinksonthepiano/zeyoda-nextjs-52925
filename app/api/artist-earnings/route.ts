import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { verifyWhitelist } from '@/app/utils/server/whitelistCheck';
import {
  AMM_GET_POOL_ABI,
  getBaseSepoliaReadRpcUrl,
  resolveArtistAmmPool,
} from '@/app/utils/server/resolveArtistAmm';
import { surplusEthUsd } from '@/app/utils/server/lpVirtualTreasury';

// Use service role key to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/** ETH skim ceiling above fixed pool floor (USD label @ fixed ETH/USD rate). */
async function fetchOnChainArtistCashoutUsd(
  artistId: string,
  tokenAddress: string,
  swapAddress: string
): Promise<number> {
  try {
    if (!tokenAddress || !swapAddress) {
      console.log(`  ⚠️ Missing tokenAddress or swapAddress for ${artistId}`);
      return 0;
    }

    console.log(`💎 Calculating on-chain LP for ${artistId}...`);
    console.log(`   Token: ${tokenAddress}`);
    console.log(`   AMM: ${swapAddress}`);

    const rpcUrl = getBaseSepoliaReadRpcUrl();
    if (!rpcUrl) {
      console.error(`  ⚠️ No Base Sepolia RPC (SERVER_BASE_SEPOLIA_RPC_URL or BASE_SEPOLIA_RPC_URL) for ${artistId}`);
      return 0;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const swapContract = new ethers.Contract(swapAddress, AMM_GET_POOL_ABI, provider);

    const pool = await swapContract.getPool(tokenAddress);

    if (!pool.active || pool.ethReserve === 0n || pool.tokenReserve === 0n) {
      console.log(`  ⚠️ No active pool for ${artistId}`);
      return 0;
    }

    const ethReserve = Number(ethers.formatEther(pool.ethReserve));
    const tokenReserve = Number(ethers.formatUnits(pool.tokenReserve, 18));
    const ethUsdRate = 2500;
    const onChainLp = surplusEthUsd(pool.ethReserve, ethUsdRate);
    const tokenPriceUsd =
      tokenReserve > 0 && Number.isFinite(ethReserve)
        ? (ethReserve / tokenReserve) * ethUsdRate
        : 0;
    const totalPoolUsd =
      Number.isFinite(ethReserve) && Number.isFinite(tokenReserve)
        ? ethReserve * ethUsdRate + tokenReserve * tokenPriceUsd
        : 0;

    console.log(`  📊 Pool analysis for ${artistId}:`, {
      ethReserve: ethReserve.toFixed(6),
      tokenReserve: tokenReserve.toFixed(0),
      tokenPriceUsd: tokenPriceUsd.toFixed(8),
      totalPoolUsd: totalPoolUsd.toFixed(2),
      artistCashoutCeilingUsd: onChainLp.toFixed(2),
    });

    return onChainLp;
  } catch (error) {
    console.error(`❌ LP calculation error for ${artistId}:`, error);
    return 0;
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function GET(request: NextRequest) {
  try {
    // Verify whitelist (defense-in-depth - middleware should catch this, but backup check)
    const whitelistResult = await verifyWhitelist(request);
    if (!whitelistResult.verified) {
      console.log(`❌ Route blocked: ${whitelistResult.error || 'Not whitelisted'}`);
      return NextResponse.json(
        { 
          error: whitelistResult.error || 'Unauthorized',
          message: 'Access denied - whitelist required'
        },
        { status: whitelistResult.email === null ? 401 : 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get('artistId');
    
    console.log('📊 Fetching artist earnings:', artistId);
    
    if (!artistId) {
      return NextResponse.json({ 
        error: 'Artist ID required as query parameter' 
      }, { status: 400 });
    }
    
    // Get artist summary data (totals)
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id, name, displayname, total_earnings_usd, total_sales_count')
      .eq('id', artistId)
      .single();
    
    if (artistError) {
      console.error('❌ Artist lookup error:', artistError);
      return NextResponse.json({ 
        error: `Artist not found: ${artistId}` 
      }, { status: 404 });
    }
    
    console.log('🎨 Artist found:', artist.name, 'Total earnings:', artist.total_earnings_usd);
    
    // Get recent earnings with joined asset data (last 50 transactions)
    const { data: earnings, error: earningsError } = await supabaseAdmin
      .from('artist_earnings')
      .select(`
        id,
        asset_id,
        gross_amount_usd,
        protocol_fee_usd,
        net_earnings_usd,
        payment_method,
        source,
        tx_hash,
        collectible_minted,
        status,
        created_at,
        artist_assets!inner(
          asset_number,
          price_usd,
          metadata
        )
      `)
      .eq('artist_id', artistId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (earningsError) {
      console.error('❌ Earnings fetch error:', earningsError);
      return NextResponse.json({ 
        error: 'Failed to fetch earnings data',
        details: earningsError.message
      }, { status: 500 });
    }
    
    console.log('💰 Found', earnings?.length || 0, 'earnings records');
    
    // Format earnings data for frontend consumption
    const formattedEarnings = (earnings || []).map(earning => ({
      id: earning.id,
      assetNumber: earning.artist_assets.asset_number,
      assetTitle: earning.artist_assets.metadata?.title || `Asset #${earning.artist_assets.asset_number}`,
      grossAmount: earning.gross_amount_usd,
      protocolFee: earning.protocol_fee_usd,
      netEarnings: earning.net_earnings_usd,
      paymentMethod: earning.payment_method,
      source: earning.source,
      txHash: earning.tx_hash,
      collectibleMinted: earning.collectible_minted,
      status: earning.status,
      createdAt: earning.created_at
    }));
    
    const resolved = await resolveArtistAmmPool(supabaseAdmin, artistId);
    let onChainLpUsd = 0;
    if (resolved.ok) {
      onChainLpUsd = await fetchOnChainArtistCashoutUsd(
        artistId,
        resolved.tokenAddress,
        resolved.swapAddress
      );
    } else {
      console.warn(`⚠️ LP pool resolution failed for ${artistId}:`, resolved.error);
    }

    const lpWithdrawable = onChainLpUsd;

    const totalEarnings = artist.total_earnings_usd || 0;
    const totalSales = artist.total_sales_count || 0;
    const availableBalance = Number(totalEarnings) + lpWithdrawable;
    
    // Calculate some basic stats from recent earnings
    const recentEarnings = formattedEarnings.slice(0, 10); // Last 10 for recent display
    const mintedCount = formattedEarnings.filter(e => e.collectibleMinted).length;
    const pendingCount = formattedEarnings.filter(e => !e.collectibleMinted).length;
    
    console.log('📈 Stats:', { totalEarnings, totalSales, mintedCount, pendingCount });
    
    return NextResponse.json({
      success: true,
      artist: {
        id: artist.id,
        name: artist.name,
        displayName: artist.displayname
      },
      totals: {
        totalEarnings: Number(totalEarnings),
        totalSales: Number(totalSales),
        availableBalance: Number(availableBalance),
        lpWithdrawable: Number(lpWithdrawable),
        mintedCount,
        pendingCount
      },
      recentEarnings,
      allEarnings: formattedEarnings // Include all for potential future use
    });
    
  } catch (error: any) {
    console.error('❌ Artist earnings API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error.stack
    }, { status: 500 });
  }
}
