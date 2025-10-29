import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

// Supabase admin client (service role for database access)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ABI for buyFor function
const DOWNLOADS_ABI = [
  "function buyFor(address recipient, uint256 tokenId, uint256 quantity) external payable",
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
  "event DownloadPurchased(address indexed recipient, uint256 indexed tokenId, uint256 quantity, uint256 amount)"
];

// Free mint caps (from env or defaults)
const FREE_MINT_PER_USER_DAILY = parseInt(process.env.FREE_MINT_PER_USER_DAILY || "5");
const FREE_MINT_DAILY_CAP = parseInt(process.env.FREE_MINT_DAILY_CAP || "500");
const FREE_MINT_GLOBAL_CAP = parseInt(process.env.FREE_MINT_GLOBAL_CAP || "5000");

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
    console.warn('⚠️  Failed to fetch ETH price, using fallback:', error);
  }
  
  // Fallback price
  return 2500;
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
    console.error('❌ Failed to log gas sponsorship:', error);
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
  console.log('🛒 Purchase API called...');
  
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
    
    console.log('📋 Purchase details:', { artistId, assetNumber, quantity, userAddress });
    
    // 1. Fetch asset price from database
    const { data: asset, error: assetError } = await supabase
      .from('artist_assets')
      .select('price_usd, artist_id, metadata')
      .eq('artist_id', artistId)
      .eq('asset_number', assetNumber)
      .single();
    
    if (assetError || !asset) {
      console.error('❌ Asset not found:', assetError);
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }
    
    console.log('💰 Asset price:', asset.price_usd, 'USD');
    
    // 2. Fetch downloads contract address from artist_registry
    const { data: registry, error: registryError } = await supabase
      .from('artist_registry')
      .select('downloads, treasury_wallet')
      .eq('id', artistId)
      .single();
    
    if (registryError || !registry?.downloads) {
      console.error('❌ Downloads contract not found:', registryError);
      return NextResponse.json(
        { error: 'Downloads contract not found for this artist' },
        { status: 404 }
      );
    }
    
    console.log('📝 Downloads contract:', registry.downloads);
    
    // 3. Enforce free mint caps if price is 0
    if (asset.price_usd === 0) {
      console.log('🎁 Free download - checking caps...');
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
      
      console.log(`💱 Price conversion: $${asset.price_usd} → ${priceETH.toFixed(8)} ETH → ${priceWei.toString()} wei`);
    }
    
    // 5. Set up blockchain provider and signer
    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const serverPrivateKey = process.env.MINTER_PRIVATE_KEY;
    if (!serverPrivateKey) {
      console.error('❌ MINTER_PRIVATE_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    const signer = new ethers.Wallet(serverPrivateKey, provider);
    console.log('🔑 Server signer:', signer.address);
    
    // 6. Create contract instance
    const downloadsContract = new ethers.Contract(
      registry.downloads,
      DOWNLOADS_ABI,
      signer
    );
    
    // 7. Call buyFor() - server pays gas, artist receives payment
    console.log('⛽ Calling buyFor() - server sponsors gas...');
    console.log(`   Recipient: ${userAddress}`);
    console.log(`   Token ID: ${assetNumber}`);
    console.log(`   Quantity: ${quantity}`);
    console.log(`   Payment: ${ethers.formatEther(priceWei)} ETH`);
    
    const tx = await downloadsContract.buyFor(
      userAddress,
      assetNumber,
      quantity,
      {
        value: priceWei,
        gasLimit: 300000 // Generous gas limit
      }
    );
    
    console.log('📡 Transaction sent:', tx.hash);
    console.log('⏳ Waiting for confirmation...');
    
    const receipt = await tx.wait();
    
    if (!receipt || receipt.status !== 1) {
      console.error('❌ Transaction failed:', receipt);
      return NextResponse.json(
        { error: 'Transaction failed on-chain' },
        { status: 500 }
      );
    }
    
    console.log('✅ Transaction confirmed!');
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`   Block: ${receipt.blockNumber}`);
    
    // 8. Log gas sponsorship
    await logGasSponsorship(receipt, artistId, userAddress, priceWei, assetNumber);
    
    // 9. Verify NFT was minted (optional sanity check)
    try {
      const balance = await downloadsContract.balanceOf(userAddress, assetNumber);
      console.log(`✅ User balance of token #${assetNumber}: ${balance.toString()}`);
    } catch (e) {
      console.warn('⚠️  Could not verify balance:', e);
    }
    
    console.log('🎉 Purchase complete!\n');
    
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
    console.error('❌ Purchase failed:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Purchase failed',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}

