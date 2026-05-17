import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { requireSecret, rateLimit } from '@/app/utils/apiGuard';
import { createGuardedSigner } from '@/app/utils/guardedSigner';
import { getMagicAuthFromBearer } from '@/app/utils/server/magicBearerEmail';
import { normalizeReservedEmail } from '@/app/utils/server/normalizeReservedEmail';
import { assertMagicTreasuryArtist } from '@/app/utils/server/assertMagicTreasuryArtist';
import { AMM_GET_POOL_ABI, resolveArtistAmmPool } from '@/app/utils/server/resolveArtistAmm';
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

const SWAP_ABI = [
  ...AMM_GET_POOL_ABI,
  'function withdrawArtistCashoutEth(address token, address payable recipient, uint256 amountWei) external',
  'function owner() view returns (address)',
] as const;

interface WithdrawRequest {
  artistId: string;
  percent?: number;
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function POST(request: NextRequest) {
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

  const rl = rateLimit(request, 'lp-withdraw', 5, 60_000);
  if (rl) return rl;

  try {
    const { artistId, percent = 100 }: WithdrawRequest = await request.json();

    console.log('💎 Artist Cashout (truth-path) request:', { artistId, percent });

    const clampedPercent = Math.max(1, Math.min(100, Math.round(percent * 10) / 10));

    if (!artistId || isNaN(clampedPercent)) {
      return NextResponse.json({
        error: 'Invalid inputs',
        details: 'artistId required, percent must be 1-100',
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

    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id, name, displayname, treasury_wallet')
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
    console.log('🪙 Pool:', { token: `${tokenAddress.slice(0, 10)}…`, swap: `${swapAddress.slice(0, 10)}…` });

    const rpcUrl = process.env.SERVER_BASE_SEPOLIA_RPC_URL?.trim();
    const ownerKey =
      process.env.SERVER_AMM_OWNER_PRIVATE_KEY?.trim() || process.env.MINTER_PRIVATE_KEY?.trim();

    if (!rpcUrl || !ownerKey) {
      return NextResponse.json(
        {
          error:
            'Server configuration error: SERVER_BASE_SEPOLIA_RPC_URL or SERVER_AMM_OWNER_PRIVATE_KEY / MINTER_PRIVATE_KEY missing',
        },
        { status: 500 },
      );
    }

    const treasuryRaw = (artist.treasury_wallet || '').trim();
    if (!treasuryRaw) {
      return NextResponse.json({ error: 'Artist treasury wallet not configured' }, { status: 400 });
    }

    let treasuryChecksummed: string;
    try {
      treasuryChecksummed = ethers.getAddress(treasuryRaw);
    } catch {
      return NextResponse.json({ error: 'Invalid treasury wallet address' }, { status: 400 });
    }

    const signer = await createGuardedSigner(ownerKey, rpcUrl);
    const swapContract = new ethers.Contract(swapAddress, SWAP_ABI, signer);

    const contractOwner = await swapContract.owner();
    if (contractOwner.toLowerCase() !== signer.address.toLowerCase()) {
      console.error('❌ Signer is not AMM owner:', {
        signer: signer.address,
        owner: contractOwner,
      });
      return NextResponse.json(
        {
          error: 'Server misconfigured',
          details:
            'Signer must be shared UupsAMM owner (set SERVER_AMM_OWNER_PRIVATE_KEY or MINTER_PRIVATE_KEY to BF)',
        },
        { status: 500 },
      );
    }

    const pool = await swapContract.getPool(tokenAddress);

    if (!pool.active || pool.ethReserve === 0n || pool.tokenReserve === 0n) {
      return NextResponse.json({ error: 'No active liquidity pool for this artist' }, { status: 400 });
    }

    const surplusWei = ethWeiSurplusAboveFloor(pool.ethReserve);
    const amountWei = surplusWeiForWithdrawPercent(surplusWei, clampedPercent);

    if (surplusWei <= 0n || amountWei <= 0n) {
      return NextResponse.json(
        {
          error: 'No ETH surplus above protected floor',
          details: `Floor ${ethers.formatEther(ARTIST_CASHOUT_FLOOR_WEI)} ETH must remain in pool`,
        },
        { status: 400 },
      );
    }

    const ethUsdRate = 2500;
    const usdProceeds = Number((Number(ethers.formatEther(amountWei)) * ethUsdRate).toFixed(2));

    console.log('💰 Artist Cashout quote:', {
      ethReserve: ethers.formatEther(pool.ethReserve),
      surplusWei: surplusWei.toString(),
      amountWei: amountWei.toString(),
      percent: clampedPercent,
      usdProceedsLabel: usdProceeds,
    });

    try {
      const tx = await swapContract.withdrawArtistCashoutEth(
        tokenAddress,
        treasuryChecksummed,
        amountWei,
      );
      console.log('📤 tx:', tx.hash);
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        throw new Error('Transaction failed or reverted');
      }

      console.log('✅ Artist Cashout mined:', receipt.hash);

      return NextResponse.json({
        success: true,
        txHash: receipt.hash,
        usdProceeds,
        breakdown: {
          percent: clampedPercent,
          ethUsdRate,
          floorWei: ARTIST_CASHOUT_FLOOR_WEI.toString(),
          surplusWeiBefore: surplusWei.toString(),
          amountWeiWithdrawn: amountWei.toString(),
          ethReserveBeforeWei: pool.ethReserve.toString(),
          ethReserveAfterWei: (pool.ethReserve - amountWei).toString(),
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
      console.error('❌ Artist Cashout chain error:', chainError);
      return NextResponse.json(
        {
          error: 'Withdrawal transaction failed',
          details: msg,
        },
        { status: 500 },
      );
    }
  } catch (error: unknown) {
    console.error('❌ LP withdrawal API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
