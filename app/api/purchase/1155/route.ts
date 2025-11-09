import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers, keccak256, toUtf8Bytes } from 'ethers';
import { createGuardedSigner } from '@/app/utils/guardedSigner';
import { ArtistDownloadsUUPSABI } from '../../../utils/abis/ArtistDownloadsUUPSABI';
import { requireSecret, rateLimit, logInfo, logError } from '@/app/utils/apiGuard';

// Supabase admin client (service role for database access)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Use ABI from separate file
const DOWNLOADS_ABI = ArtistDownloadsUUPSABI;

// Free mint caps (from env or defaults)
const FREE_MINT_PER_USER_DAILY = parseInt(process.env.FREE_MINT_PER_USER_DAILY || "5");
const FREE_MINT_DAILY_CAP = parseInt(process.env.FREE_MINT_DAILY_CAP || "500");
const FREE_MINT_GLOBAL_CAP = parseInt(process.env.FREE_MINT_GLOBAL_CAP || "5000");

// Simple in-memory rate limiter (production: use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(ip);
  
  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 }); // 1 min window
    return true;
  }
  
  if (limit.count >= 10) { // 10 requests per minute
    return false;
  }
  
  limit.count++;
  return true;
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() || realIP || 'unknown';
}

/**
 * Get cached ETH price in USD
 * TODO: Implement Redis cache with 5-min TTL
 */
async function getCachedETHPrice(): Promise<number> {
  try {
    // Fetch from Coinbase API
    const response = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=ETH');
    const data = await response.json();
    const ethPrice = parseFloat(data.data.rates.USD);
    
    if (ethPrice && ethPrice > 0) {
      return ethPrice;
    }
  } catch (error) {
    logError('⚠️  Failed to fetch ETH price, using fallback:', error);
  }
  
  // Fallback price
  return 2500;
}

/**
 * Generate idempotency hash for duplicate prevention
 * Hash: keccak256(artistId + assetNumber + userAddress + priceWei + today)
 */
function generateRequestHash(
  artistId: string,
  assetNumber: number,
  userAddress: string,
  priceWei: bigint,
  date: string
): string {
  const input = `${artistId}:${assetNumber}:${userAddress}:${priceWei.toString()}:${date}`;
  return keccak256(toUtf8Bytes(input));
}

/**
 * Check for duplicate purchase request (idempotency)
 * Returns existing purchase if found, null if new
 */
async function checkDuplicatePurchase(
  requestHash: string
): Promise<{ exists: boolean; txHash?: string }> {
  const { data } = await supabase
    .from('artist_purchases')
    .select('tx_hash')
    .eq('request_hash', requestHash)
    .maybeSingle();
  
  if (data) {
    return { exists: true, txHash: data.tx_hash };
  }
  return { exists: false };
}

/**
 * Enforce free mint caps to prevent abuse
 */
async function enforceFreeMintsystemCaps(userAddress: string, artistId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  // Check per-user daily cap
  const { count: userDailyCount } = await supabase
    .from('gas_sponsorship_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_address', userAddress.toLowerCase())
    .eq('payment_amount_wei', '0')
    .gte('sponsored_at', `${today}T00:00:00Z`);
  
  if (userDailyCount && userDailyCount >= FREE_MINT_PER_USER_DAILY) {
    throw new Error(`Free mint limit reached: ${FREE_MINT_PER_USER_DAILY} per day per user`);
  }
  
  // Check daily system cap
  const { count: dailyCount } = await supabase
    .from('gas_sponsorship_events')
    .select('*', { count: 'exact', head: true })
    .eq('payment_amount_wei', '0')
    .gte('sponsored_at', `${today}T00:00:00Z`);
  
  if (dailyCount && dailyCount >= FREE_MINT_DAILY_CAP) {
    throw new Error(`Daily free mint cap reached: ${FREE_MINT_DAILY_CAP} total`);
  }
  
  // Check global cap
  const { count: globalCount } = await supabase
    .from('gas_sponsorship_events')
    .select('*', { count: 'exact', head: true })
    .eq('payment_amount_wei', '0');
  
  if (globalCount && globalCount >= FREE_MINT_GLOBAL_CAP) {
    throw new Error(`Global free mint cap reached: ${FREE_MINT_GLOBAL_CAP} total`);
  }
}

/**
 * Log gas sponsorship event to database
 */
async function logGasSponsorship(
  receipt: ethers.TransactionReceipt,
  artistId: string,
  userAddress: string,
  paymentWei: bigint,
  assetNumber: number
): Promise<void> {
  const gasUsed = receipt.gasUsed;
  const gasPrice = receipt.gasPrice || 0n;
  
  const { error } = await supabase
    .from('gas_sponsorship_events')
    .insert({
      artist_id: artistId,
      user_address: userAddress.toLowerCase(),
      asset_number: assetNumber,
      tx_hash: receipt.hash,
      gas_used: gasUsed.toString(),
      gas_price: gasPrice.toString(),
      payment_amount_wei: paymentWei.toString()
    });
  
  if (error) {
    logError('❌ Failed to log gas sponsorship:', error);
  }
}

/**
 * Record sale to artist_earnings table (for wallet display)
 */
async function recordSale(
  artistId: string,
  userAddress: string,
  assetId: number,
  priceUSD: number,
  externalId: string,
  txHash: string
): Promise<void> {
  try {
    const protocolFee = priceUSD * 0.003; // 0.3% protocol fee
    
    // Get client IP for rate limiting (use a default since we don't have request here)
    const ipHash = 'purchase1155-api'; // Simplified for this context
    
    // Call record_artist_sale RPC function
    const { error: saleError } = await supabase.rpc('record_artist_sale', {
      p_artist_id: artistId,
      p_buyer_address: userAddress.toLowerCase(),
      p_asset_id: assetId,
      p_gross_amount: priceUSD,
      p_protocol_fee: protocolFee,
      p_payment_method: 'eth_balance',
      p_processor_fee: 0,
      p_source: 'eth',
      p_external_id: externalId,
      p_ip_hash: ipHash
    });
    
    if (saleError) {
      // Handle duplicate external_id (idempotency - don't fail purchase)
      if (saleError.code === '23505' || saleError.message?.includes('duplicate')) {
        logInfo('⚠️ Duplicate sale detected (idempotency):', externalId);
        return; // Don't throw - sale already recorded
      }
      
      logError('❌ Failed to record sale:', saleError);
      // Don't throw - sale recording failure shouldn't fail purchase
    } else {
      logInfo('✅ Sale recorded to artist_earnings:', { artistId, priceUSD, txHash });
    }
  } catch (error: any) {
    logError('❌ Error recording sale:', error);
    // Don't throw - sale recording failure shouldn't fail purchase
  }
}

/**
 * Log purchase to artist_purchases table (idempotency + history)
 */
async function logPurchase(
  requestHash: string,
  artistId: string,
  userAddress: string,
  assetNumber: number,
  quantity: number,
  priceUSD: number | null,
  priceWei: bigint,
  txHash: string,
  blockNumber: number,
  gasCostWei: bigint
): Promise<void> {
  const { error } = await supabase
    .from('artist_purchases')
    .insert({
      request_hash: requestHash,
      artist_id: artistId,
      user_address: userAddress.toLowerCase(),
      asset_number: assetNumber,
      quantity: quantity,
      price_usd: priceUSD,
      price_wei: priceWei.toString(),
      tx_hash: txHash,
      block_number: blockNumber,
      gas_cost_wei: gasCostWei.toString()
    });
  
  if (error) {
    logError('❌ Failed to log purchase:', error);
    // Don't throw - logging failure shouldn't fail purchase
  }
}

/**
 * Get user address from session/auth
 * TODO: Implement proper session management with Magic.link
 */
async function getUserAddressFromSession(request: NextRequest): Promise<string | null> {
  // For MVP: Accept user address from request body (client provides their Magic wallet)
  // Production: Verify Magic.link DID token and extract address
  const body = await request.json();
  return body.userAddress || null;
}

export async function POST(request: NextRequest) {
  // Security guards: secret header + rate limit - INLINE CHECK
  console.error('[GUARD] Route handler called');
  const expectedSecret = process.env.INTERNAL_API_SECRET;
  const gotSecret = request.headers.get('x-internal-secret') ?? '';
  
  console.error('[GUARD] Expected exists:', !!expectedSecret);
  console.error('[GUARD] Got header:', !!gotSecret);
  console.error('[GUARD] Match:', gotSecret === expectedSecret);
  
  if (!expectedSecret) {
    console.error('[GUARD] BLOCKING: Secret not configured');
    return NextResponse.json(
      { error: 'Server misconfigured: INTERNAL_API_SECRET missing' },
      { status: 500 }
    );
  }
  
  if (gotSecret !== expectedSecret) {
    console.error('[GUARD] BLOCKING: Header mismatch');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  console.error('[GUARD] ALLOWING: Secret matches');
  
  // Guard passed, continue with rate limit
  
  // Note: This route already has its own rate limiting, but we'll use the unified one
  const rl = rateLimit(request, 'purchase-1155', 10, 60_000); // 10/min per IP
  if (rl) return rl;
  
  logInfo('🛒 Purchase API called...');
  
  try {
    const body = await request.json();
    const { artistId, assetNumber, quantity, userAddress } = body;
    
    // Validate required fields
    if (!artistId || !assetNumber || !quantity) {
      return NextResponse.json(
        { error: 'Missing required fields: artistId, assetNumber, quantity' },
        { status: 400 }
      );
    }
    
    // Get user address (recipient of NFT)
    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required (userAddress field)' },
        { status: 401 }
      );
    }
    
    logInfo('📋 Purchase details:', { artistId, assetNumber, quantity, userAddress });
    
    // 1. Fetch asset price from database
    const { data: asset, error: assetError } = await supabase
      .from('artist_assets')
      .select('id, price_usd, artist_id, metadata')
      .eq('artist_id', artistId)
      .eq('asset_number', assetNumber)
      .single();
    
    if (assetError || !asset) {
      logError('❌ Asset not found:', assetError);
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }
    
    logInfo('💰 Asset price:', asset.price_usd, 'USD');
    
    // 2. Fetch downloads contract address from artists table
    const { data: artistData, error: artistError } = await supabase
      .from('artists')
      .select('download_address, treasury_wallet')
      .eq('id', artistId)
      .single();
    
    if (artistError || !artistData?.download_address) {
      logError('❌ Downloads contract not found:', artistError);
      return NextResponse.json(
        { error: 'Downloads contract not found for this artist' },
        { status: 404 }
      );
    }
    
    logInfo('📝 Downloads contract:', artistData.download_address);
    
    // 3. Enforce free mint caps if price is 0
    if (asset.price_usd === 0) {
      logInfo('🎁 Free download - checking caps...');
      try {
        await enforceFreeMintsystemCaps(userAddress, artistId);
      } catch (capError: any) {
        return NextResponse.json(
          { error: capError.message },
          { status: 400 }
        );
      }
    }
    
    // 4. Convert USD → ETH → wei
    let priceWei = 0n;
    if (asset.price_usd > 0) {
      const ethPrice = await getCachedETHPrice();
      const priceETH = asset.price_usd / ethPrice;
      
      // Convert to wei directly to avoid decimal precision issues
      // 1 ETH = 1e18 wei
      const priceWeiNumber = Math.floor(priceETH * 1e18);
      priceWei = BigInt(priceWeiNumber);
      
      logInfo(`💱 Price conversion: $${asset.price_usd} → ${priceETH.toFixed(8)} ETH → ${priceWei.toString()} wei`);
    }
    
    // Generate request hash for idempotency
    const today = new Date().toISOString().split('T')[0];
    const requestHash = generateRequestHash(artistId, assetNumber, userAddress, priceWei, today);
    
    // Check for duplicate purchase
    const duplicateCheck = await checkDuplicatePurchase(requestHash);
    if (duplicateCheck.exists) {
      logInfo('🔄 Duplicate purchase detected, returning existing tx:', duplicateCheck.txHash);
      return NextResponse.json({
        success: true,
        txHash: duplicateCheck.txHash,
        tokenId: assetNumber,
        amountWei: priceWei.toString(),
        duplicate: true
      });
    }
    
    // 5. Set up guarded blockchain signer (enforces Base Sepolia network)
    const rpcUrl = process.env.SERVER_BASE_SEPOLIA_RPC_URL;
    const serverPrivateKey = process.env.MINTER_PRIVATE_KEY;
    
    if (!serverPrivateKey) {
      logError('❌ MINTER_PRIVATE_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    if (!rpcUrl) {
      logError('❌ SERVER_BASE_SEPOLIA_RPC_URL not configured');
      return NextResponse.json(
        { error: 'Server configuration error: RPC URL missing' },
        { status: 500 }
      );
    }
    
    // Create guarded signer (verifies network is Base Sepolia before proceeding)
    const signer = await createGuardedSigner(serverPrivateKey, rpcUrl);
    
    logInfo('🔑 Server signer:', signer.address);
    
    // 6. Create contract instance
    const downloadsContract = new ethers.Contract(
      artistData.download_address,
      DOWNLOADS_ABI,
      signer
    );
    
    // 7. Call buyFor() - server pays gas, artist receives payment
    logInfo('⛽ Calling buyFor() - server sponsors gas...');
    logInfo(`   Recipient: ${userAddress}`);
    logInfo(`   Token ID: ${assetNumber}`);
    logInfo(`   Quantity: ${quantity}`);
    logInfo(`   Payment: ${ethers.formatEther(priceWei)} ETH`);
    
    const tx = await downloadsContract.buyFor(
      userAddress,
      assetNumber,
      quantity,
      {
        value: priceWei,
        gasLimit: 300000 // Generous gas limit
      }
    );
    
    logInfo('📡 Transaction sent:', tx.hash);
    logInfo('⏳ Waiting for confirmation...');
    
    const receipt = await tx.wait();
    
    if (!receipt || receipt.status !== 1) {
      logError('❌ Transaction failed:', receipt);
      return NextResponse.json(
        { error: 'Transaction failed on-chain' },
        { status: 500 }
      );
    }
    
    logInfo('✅ Transaction confirmed!');
    logInfo(`   Gas used: ${receipt.gasUsed.toString()}`);
    logInfo(`   Block: ${receipt.blockNumber}`);
    
    // 8. Log purchase and gas sponsorship
    const gasCostWei = receipt.gasUsed * (receipt.gasPrice || 0n);
    
    // Generate external ID for sale recording (idempotency)
    const externalId = `purchase1155-${artistId}-${assetNumber}-${userAddress.toLowerCase()}-${receipt.hash}`;
    
    await Promise.all([
      logPurchase(
        requestHash,
        artistId,
        userAddress,
        assetNumber,
        quantity,
        asset.price_usd,
        priceWei,
        receipt.hash,
        receipt.blockNumber,
        gasCostWei
      ),
      logGasSponsorship(receipt, artistId, userAddress, priceWei, assetNumber),
      recordSale(artistId, userAddress, asset.id, asset.price_usd, externalId, receipt.hash)
    ]);
    
    // 9. Verify NFT was minted (optional sanity check)
    try {
      const balance = await downloadsContract.balanceOf(userAddress, assetNumber);
      logInfo(`✅ User balance of token #${assetNumber}: ${balance.toString()}`);
    } catch (e) {
      logError('⚠️  Could not verify balance:', e);
    }
    
    logInfo('🎉 Purchase complete!\n');
    
    // Return success
    return NextResponse.json({
      success: true,
      txHash: receipt.hash,
      tokenId: assetNumber,
      amountWei: priceWei.toString(),
      recipient: userAddress,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    });
    
  } catch (error: any) {
    logError('❌ Purchase failed:', error);
    
    // Handle structured errors
    let errorMessage = 'Purchase failed';
    let errorCode = 'UNKNOWN_ERROR';
    let retryable = false;
    
    if (error.message) {
      errorMessage = error.message;
      if (error.message.includes('rate limit')) {
        errorCode = 'RATE_LIMIT';
        retryable = true;
      } else if (error.message.includes('caps')) {
        errorCode = 'CAP_EXCEEDED';
        retryable = false;
      } else if (error.message.includes('not found')) {
        errorCode = 'NOT_FOUND';
        retryable = false;
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        code: errorCode,
        retryable
      },
      { status: 500 }
    );
  }
}

