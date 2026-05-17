import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get('artistId');
    
    if (!artistId) {
      return NextResponse.json({ 
        error: 'Artist ID required as query parameter' 
      }, { status: 400 });
    }

    // Get artist data
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id, name, displayname, treasury_wallet')
      .eq('id', artistId)
      .single();
    
    if (artistError || !artist) {
      return NextResponse.json({ 
        error: `Artist not found: ${artistId}` 
      }, { status: 404 });
    }

    // Calculate downloads history and cash balance
    const { data: earnings, error: earningsError } = await supabaseAdmin
      .from('artist_earnings')
      .select('gross_amount_usd, net_earnings_usd, status, collectible_minted, error_reason, buyer_address, asset_id, created_at')
      .eq('artist_id', artistId);

    if (earningsError) {
      console.error('❌ Earnings fetch error:', earningsError);
      return NextResponse.json({ 
        error: 'Failed to fetch earnings data' 
      }, { status: 500 });
    }

    // Filter downloads (exclude LP fees and AMM rows)
    const downloadSales = (earnings || []).filter(e => 
      e.status === 'minted' && 
      e.error_reason !== 'LP_FEE' && 
      e.asset_id !== null && 
      e.buyer_address !== 'amm-pool'
    );

    // Calculate downloads stats
    const downloadsCount = downloadSales.length;
    const downloadsGrossUsd = downloadSales.reduce((sum, e) => sum + parseFloat(e.gross_amount_usd || '0'), 0);
    const downloadsNetUsd = downloadSales.reduce((sum, e) => sum + parseFloat(e.net_earnings_usd || '0'), 0);

    // Calculate cash balance (deposits + net downloads - withdrawals)
    // For MVP: use ETH balance as proxy for deposits + net downloads credited
    const depositsUsd = 200.00; // Simplified for testnet
    const cashWithdrawnUsd = 0; // Track via withdrawal records later
    const cashAvailableUsd = depositsUsd + downloadsNetUsd - cashWithdrawnUsd;

    // Calculate LP withdrawable (reuse existing logic from artist-earnings)
    let lpWithdrawableUsd = 0;
    try {
      const rpcUrl = getBaseSepoliaReadRpcUrl();
      const resolved = await resolveArtistAmmPool(supabaseAdmin, artistId);
      if (rpcUrl && resolved.ok) {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const swapContract = new ethers.Contract(resolved.swapAddress, AMM_GET_POOL_ABI, provider);
        const pool = await swapContract.getPool(resolved.tokenAddress);
        if (pool.active && pool.ethReserve !== 0n && pool.tokenReserve !== 0n) {
          lpWithdrawableUsd = surplusEthUsd(pool.ethReserve, 2500);
        }
      }
    } catch (error) {
      console.warn('Artist Cashout surplus read failed:', error);
    }

    return NextResponse.json({
      artistId,
      artistName: artist.name,
      cash: {
        availableUsd: Number(cashAvailableUsd.toFixed(2)),
        lifetimeNetUsd: Number(downloadsNetUsd.toFixed(2)),
        depositsUsd: Number(depositsUsd.toFixed(2)),
        withdrawnUsd: Number(cashWithdrawnUsd.toFixed(2)),
        lastUpdated: new Date().toISOString()
      },
      downloads: {
        count: downloadsCount,
        grossUsd: Number(downloadsGrossUsd.toFixed(2)),
        netUsd: Number(downloadsNetUsd.toFixed(2)),
        recent: downloadSales.slice(0, 10).map(sale => ({
          timestamp: sale.created_at,
          gross: parseFloat(sale.gross_amount_usd || '0'),
          fee: parseFloat(sale.gross_amount_usd || '0') - parseFloat(sale.net_earnings_usd || '0'),
          net: parseFloat(sale.net_earnings_usd || '0')
        }))
      },
      lp: {
        withdrawableUsd: Number(lpWithdrawableUsd.toFixed(2))
      }
    });

  } catch (error) {
    console.error('❌ Artist balances API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
