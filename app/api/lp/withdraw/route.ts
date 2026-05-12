import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { requireSecret, rateLimit } from '@/app/utils/apiGuard';
import { createGuardedProvider, createGuardedSigner } from '@/app/utils/guardedSigner';
import { getMagicAuthFromBearer } from '@/app/utils/server/magicBearerEmail';
import { normalizeReservedEmail } from '@/app/utils/server/normalizeReservedEmail';
import { assertMagicTreasuryArtist } from '@/app/utils/server/assertMagicTreasuryArtist';
import { AMM_GET_POOL_ABI, resolveArtistAmmPool } from '@/app/utils/server/resolveArtistAmm';
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

/** Pool reads + optional owner escape hatch — swap address comes from resolveArtistAmmPool */
const SWAP_ABI = [...AMM_GET_POOL_ABI, 'function emergencyWithdraw(address token) external'] as const;

interface WithdrawRequest {
  artistId: string;
  percent?: number;
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function POST(request: NextRequest) {
  // Internal: trusted secret + forwarded verified email + Magic DID; treasury-only for artistId (see Pass 2).
  const secretCheck = requireSecret(request);
  if (secretCheck) return secretCheck;

  const verifiedEmail = (request.headers.get('x-verified-email') ?? '').trim();
  if (!verifiedEmail) {
    return NextResponse.json(
      {
        error: 'Missing x-verified-email',
        message: 'Internal proxy must forward verified email',
      },
      { status: 400 },
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

    const auth = await getMagicAuthFromBearer(request);
    if (!auth) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Valid Magic DID token required',
        },
        { status: 401 },
      );
    }

    const bearerIdentity = auth.email?.trim() || auth.issuer?.trim();
    if (!bearerIdentity) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Magic session lacks email or issuer — cannot bind to proxy',
        },
        { status: 401 },
      );
    }

    if (normalizeReservedEmail(bearerIdentity) !== normalizeReservedEmail(verifiedEmail)) {
      return NextResponse.json(
        {
          error: 'Identity mismatch',
          message: 'Token identity does not match verified proxy caller',
        },
        { status: 403 },
      );
    }

    const treasuryDenied = await assertMagicTreasuryArtist(request, artistId, auth);
    if (treasuryDenied) return treasuryDenied;

    // Verify artist exists and get treasury wallet
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id, name, displayname, treasury_wallet, total_earnings_usd, total_sales_count')
      .eq('id', artistId)
      .single();

    if (artistError || !artist) {
      return NextResponse.json({
        error: `Artist not found: ${artistId}`,
      }, { status: 404 });
    }

    const resolved = await resolveArtistAmmPool(supabaseAdmin, artistId);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 404 });
    }

    const { tokenAddress, swapAddress } = resolved;
    console.log('🪙 LP pool:', { token: tokenAddress.slice(0, 10) + '…', swap: swapAddress.slice(0, 10) + '…' });

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
    const swapContract = new ethers.Contract(swapAddress, SWAP_ABI, custodyWallet);

    console.log('🔑 Using custody wallet:', custodyWallet.address.slice(0, 8) + '...');

    // Get current pool state for quote
    const pool = await swapContract.getPool(tokenAddress);
    
    if (!pool.active || pool.ethReserve === 0n || pool.tokenReserve === 0n) {
      return NextResponse.json({ 
        error: 'No active liquidity pool for this artist' 
      }, { status: 400 });
    }

    // Calculate quote from remaining mock-LP capacity (on-chain ceiling minus prior ledger exits)
    const ethReserve = Number(ethers.formatEther(pool.ethReserve));
    const tokenReserve = Number(ethers.formatUnits(pool.tokenReserve, 18));
    const ethUsdRate = 2500;

    const onChainLpWithdrawableUsd = poolReservesToOnChainLpWithdrawableUsd(
      ethReserve,
      tokenReserve,
      ethUsdRate
    );
    const virtualWithdrawnBefore = await sumVirtualLpWithdrawnUsd(supabaseAdmin, artistId);
    const lpRemainingUsd = remainingLpWithdrawableUsd(
      onChainLpWithdrawableUsd,
      virtualWithdrawnBefore
    );

    if (lpRemainingUsd <= 0) {
      return NextResponse.json(
        {
          error: 'No remaining LP to withdraw (ledger capacity exhausted for this pool)',
        },
        { status: 400 }
      );
    }

    const quoteUsd = lpRemainingUsd * (clampedPercent / 100);

    console.log('💰 LP withdrawal quote:', {
      onChainLpWithdrawableUsd: onChainLpWithdrawableUsd.toFixed(2),
      virtualWithdrawnBefore: virtualWithdrawnBefore.toFixed(2),
      lpRemainingUsd: lpRemainingUsd.toFixed(2),
      requestedPercent: percent,
      quoteUsd: quoteUsd.toFixed(2),
    });

    const treasury = (artist.treasury_wallet || '').trim().toLowerCase();
    if (!treasury) {
      return NextResponse.json(
        { error: 'Artist treasury wallet not configured' },
        { status: 400 }
      );
    }

    try {
      // For testnet MVP: Ledger-only withdrawal (no chain call to preserve pools)
      console.log('📝 Recording testnet LP withdrawal (ledger-only)...');
      
      const actualUsd = Number(Number(quoteUsd).toFixed(2));
      if (!(actualUsd > 0) || !Number.isFinite(actualUsd)) {
        return NextResponse.json({ error: 'Invalid withdrawal amount' }, { status: 400 });
      }

      // Generate synthetic txHash for idempotency and demo purposes
      const syntheticTxHash = `0x${Buffer.from(`lp-withdraw-${artistId}-${percent}-${Date.now()}`).toString('hex').padStart(64, '0').slice(0, 64)}`;

      // Record withdrawal in artist earnings (payment_method must match DB constraints — same as LP fees / sales)
      const { data: insertResult, error: insertError } = await supabaseAdmin
        .from('artist_earnings')
        .insert({
          artist_id: artistId,
          buyer_address: treasury,
          asset_id: null,
          gross_amount_usd: actualUsd,
          protocol_fee_usd: 0, // No protocol fee on withdrawals
          processor_fee_usd: 0,
          net_earnings_usd: actualUsd,
          payment_method: 'eth_balance',
          source: 'eth',
          external_id: syntheticTxHash,
          tx_hash: syntheticTxHash,
          collectible_minted: false,
          status: 'minted',
          created_at: new Date().toISOString(),
          error_reason: 'LP_WITHDRAWAL',
        })
        .select();

      if (insertError) {
        if (insertError.code === '23505') {
          return NextResponse.json({
            duplicate: true,
            message: 'Withdrawal already recorded',
          }, { status: 409 });
        }
        console.error('❌ LP withdraw: artist_earnings insert failed:', insertError);
        return NextResponse.json(
          {
            error: 'Withdrawal transaction failed',
            details: insertError.message,
            code: insertError.code,
          },
          { status: 500 }
        );
      }

      const prevTotalUsd = parseFloat(String(artist.total_earnings_usd || '0'));
      const prevSalesCount = artist.total_sales_count || 0;

      const { error: artistUpdateError } = await supabaseAdmin
        .from('artists')
        .update({
          total_earnings_usd: prevTotalUsd + actualUsd,
          total_sales_count: prevSalesCount + 1,
        })
        .eq('id', artistId);

      if (artistUpdateError) {
        console.error('❌ LP withdraw: artist totals update failed:', artistUpdateError);
        const earningId = insertResult?.[0]?.id;
        if (earningId != null) {
          await supabaseAdmin.from('artist_earnings').delete().eq('id', earningId);
        }
        return NextResponse.json(
          {
            error: 'Withdrawal transaction failed',
            details: artistUpdateError.message,
            code: artistUpdateError.code,
          },
          { status: 500 }
        );
      }

      const { data: cashRow } = await supabaseAdmin
        .from('cash_balances')
        .select('usd_balance')
        .eq('wallet_address', treasury)
        .maybeSingle();

      const prevCash = parseFloat(String(cashRow?.usd_balance ?? '0')) || 0;
      const nextCash = prevCash + actualUsd;

      const { error: cashError } = await supabaseAdmin.from('cash_balances').upsert(
        {
          wallet_address: treasury,
          usd_balance: nextCash.toFixed(2),
          last_updated: new Date().toISOString(),
        },
        { onConflict: 'wallet_address' }
      );

      if (cashError) {
        console.error('❌ LP withdraw: cash_balances upsert failed:', cashError);
        const earningId = insertResult?.[0]?.id;
        if (earningId != null) {
          await supabaseAdmin.from('artist_earnings').delete().eq('id', earningId);
        }
        await supabaseAdmin
          .from('artists')
          .update({
            total_earnings_usd: prevTotalUsd,
            total_sales_count: prevSalesCount,
          })
          .eq('id', artistId);
        return NextResponse.json(
          { error: 'Failed to credit Treasure balance', details: cashError.message },
          { status: 500 }
        );
      }

      console.log('✅ LP withdrawal recorded:', {
        earningId: insertResult?.[0]?.id,
        actualUsd,
        treasureUsd: nextCash.toFixed(2),
      });

      return NextResponse.json({
        success: true,
        txHash: syntheticTxHash,
        usdProceeds: actualUsd,
        breakdown: {
          percent,
          onChainLpWithdrawableUsd,
          virtualWithdrawnUsdBefore: virtualWithdrawnBefore,
          lpRemainingUsdBefore: lpRemainingUsd,
          quoteUsd,
          actualUsd,
          treasureUsdBalance: nextCash,
        },
      });

    } catch (chainError: unknown) {
      const msg =
        chainError instanceof Error
          ? chainError.message
          : typeof chainError === 'object' &&
              chainError !== null &&
              'message' in chainError
            ? String((chainError as { message: unknown }).message)
            : String(chainError);
      console.error('❌ LP withdrawal unexpected error:', chainError);
      return NextResponse.json(
        {
          error: 'Withdrawal transaction failed',
          details: msg,
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('❌ LP withdrawal API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
