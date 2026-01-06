import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { requireSecret, rateLimit } from '@/app/utils/apiGuard';
import { createGuardedProvider, createGuardedSigner } from '@/app/utils/guardedSigner';
import { verifyWhitelist } from '@/app/utils/server/whitelistCheck';

// Use service role key to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Swap contract for LP operations (existing working contract)
const SWAP_CONTRACT_ADDRESS = "0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE";
const SWAP_ABI = [
  "function getPool(address token) view returns (tuple(address token, uint256 tokenReserve, uint256 ethReserve, bool active))",
  "function emergencyWithdraw(address token) external"
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)"
];

interface WithdrawRequest {
  artistId: string;
  percent?: number;
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function POST(request: NextRequest) {
  // Security guards: secret header + whitelist + rate limit (stricter for withdrawals)
  const secretCheck = requireSecret(request);
  if (secretCheck) return secretCheck;
  
  // Also check whitelist (defense-in-depth - middleware should catch this, but backup check)
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
  
  const rl = rateLimit(request, 'lp-withdraw', 5, 60_000); // 5/min per IP (stricter)
  if (rl) return rl;
  
  try {
    const { artistId, percent = 100 }: WithdrawRequest = await request.json();
    
    console.log('💎 LP withdrawal request:', { artistId, percent });

    // Validate inputs (clamp and round)
    const clampedPercent = Math.max(1, Math.min(100, Math.round(percent * 10) / 10)); // Round to 0.1% increments
    
    if (!artistId || isNaN(clampedPercent)) {
      return NextResponse.json({ 
        error: 'Invalid inputs',
        details: 'artistId required, percent must be 1-100'
      }, { status: 400 });
    }

    // Get wallet address from header for auth
    const walletAddress = request.headers.get('x-wallet-address');
    if (!walletAddress) {
      return NextResponse.json({ 
        error: 'Missing x-wallet-address header' 
      }, { status: 400 });
    }

    // Verify artist exists and get treasury wallet
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id, name, displayname, treasury_wallet, total_earnings_usd')
      .eq('id', artistId)
      .single();

    if (artistError || !artist) {
      return NextResponse.json({ 
        error: `Artist not found: ${artistId}` 
      }, { status: 404 });
    }

    // Verify caller is the artist's treasury wallet
    if (!artist.treasury_wallet || artist.treasury_wallet.toLowerCase() !== walletAddress.toLowerCase()) {
      console.log('🚫 Permission denied:', { 
        caller: walletAddress.slice(0, 8) + '...', 
        required: artist.treasury_wallet?.slice(0, 8) + '...' 
      });
      return NextResponse.json({ 
        error: 'Permission denied: only artist treasury wallet can withdraw' 
      }, { status: 403 });
    }

    // Get token address from registry
    const { data: registry, error: registryError } = await supabaseAdmin
      .from('artist_registry')
      .select('token, swap')
      .eq('id', artistId)
      .single();

    if (registryError || !registry?.token) {
      return NextResponse.json({ 
        error: `Token contract not found for artist: ${artistId}` 
      }, { status: 404 });
    }

    const tokenAddress = registry.token;
    console.log('🪙 Token for withdrawal:', tokenAddress.slice(0, 8) + '...');

    // Setup guarded provider and signer (enforces Base Sepolia network)
    const rpcUrl = process.env.SERVER_BASE_SEPOLIA_RPC_URL;
    const serverPrivateKey = process.env.MINTER_PRIVATE_KEY;
    
    if (!rpcUrl || !serverPrivateKey) {
      return NextResponse.json(
        { error: 'Server configuration error: SERVER_BASE_SEPOLIA_RPC_URL or MINTER_PRIVATE_KEY missing' },
        { status: 500 }
      );
    }
    
    const provider = await createGuardedProvider(rpcUrl);
    const custodyWallet = await createGuardedSigner(serverPrivateKey, rpcUrl);
    const swapContract = new ethers.Contract(SWAP_CONTRACT_ADDRESS, SWAP_ABI, custodyWallet);

    console.log('🔑 Using custody wallet:', custodyWallet.address.slice(0, 8) + '...');

    // Get current pool state for quote
    const pool = await swapContract.getPool(tokenAddress);
    
    if (!pool.active || pool.ethReserve === 0n || pool.tokenReserve === 0n) {
      return NextResponse.json({ 
        error: 'No active liquidity pool for this artist' 
      }, { status: 400 });
    }

    // Calculate quote (expected USD proceeds)
    const ethReserve = Number(ethers.formatEther(pool.ethReserve));
    const tokenReserve = Number(ethers.formatUnits(pool.tokenReserve, 18));
    const ethUsdRate = 2500; // Fallback ETH price
    const tokenPriceUsd = (ethReserve / tokenReserve) * ethUsdRate;
    
    const totalPoolUsd = (ethReserve * ethUsdRate) + (tokenReserve * tokenPriceUsd);
    const lpWithdrawableUsd = totalPoolUsd * 0.997; // Artist's 99.7% share
    const quoteUsd = lpWithdrawableUsd * (clampedPercent / 100);

    console.log('💰 LP withdrawal quote:', {
      totalPoolUsd: totalPoolUsd.toFixed(2),
      lpWithdrawableUsd: lpWithdrawableUsd.toFixed(2),
      requestedPercent: percent,
      quoteUsd: quoteUsd.toFixed(2)
    });

    try {
      // For testnet MVP: Ledger-only withdrawal (no chain call to preserve pools)
      console.log('📝 Recording testnet LP withdrawal (ledger-only)...');
      
      const actualUsd = quoteUsd; // Use quote amount
      
      // Generate synthetic txHash for idempotency and demo purposes
      const syntheticTxHash = `0x${Buffer.from(`lp-withdraw-${artistId}-${percent}-${Date.now()}`).toString('hex').padStart(64, '0').slice(0, 64)}`;

      // Record withdrawal in artist earnings
      const { data: insertResult, error: insertError } = await supabaseAdmin
        .from('artist_earnings')
        .insert({
          artist_id: artistId,
          buyer_address: artist.treasury_wallet.toLowerCase(),
          asset_id: null,
          gross_amount_usd: actualUsd,
          protocol_fee_usd: 0, // No protocol fee on withdrawals
          processor_fee_usd: 0,
          net_earnings_usd: actualUsd,
          payment_method: 'internal',
          source: 'eth', // Use existing constraint-compliant value
        external_id: syntheticTxHash,
        tx_hash: syntheticTxHash,
          collectible_minted: false,
          status: 'minted',
          error_reason: 'LP_WITHDRAWAL' // Mark as LP withdrawal
        })
        .select();

      if (insertError) {
        if (insertError.code === '23505') {
          return NextResponse.json({ 
            duplicate: true,
            message: 'Withdrawal already recorded'
          }, { status: 409 });
        }
        throw insertError;
      }

      // Update artist totals
      await supabaseAdmin
        .from('artists')
        .update({
          total_earnings_usd: (parseFloat(artist.total_earnings_usd || '0') + actualUsd),
          total_sales_count: (artist.total_sales_count || 0) + 1
        })
        .eq('id', artistId);

      console.log('✅ LP withdrawal recorded:', { earningId: insertResult?.[0]?.id, actualUsd });

      return NextResponse.json({
        success: true,
        txHash: syntheticTxHash,
        usdProceeds: actualUsd,
        breakdown: {
          percent,
          lpWithdrawableUsdBefore: lpWithdrawableUsd,
          quoteUsd,
          actualUsd
        }
      });

    } catch (chainError: any) {
      console.error('❌ Chain withdrawal error:', chainError);
      return NextResponse.json({
        error: 'Withdrawal transaction failed',
        details: chainError.message,
        code: chainError.code
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ LP withdrawal API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
