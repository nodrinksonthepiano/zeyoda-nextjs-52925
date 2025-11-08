import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { requireSecret, rateLimit } from '@/app/utils/apiGuard';
import { createGuardedSigner } from '@/app/utils/guardedSigner';

// Use service role key to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function POST(request: NextRequest) {
  // Security guards: secret header + rate limit
  const secretCheck = requireSecret(request);
  if (secretCheck) return secretCheck;
  
  const rl = rateLimit(request, 'mint-collectible', 10, 60_000); // 10/min per IP
  if (rl) return rl;
  
  try {
    const { userAddress, artistId, assetNumber } = await request.json();
    console.log('🎨 Minting collectible via API:', { artistId, assetNumber, userAddress: userAddress?.slice(0, 8) + '...' });

    if (!userAddress || !artistId || !assetNumber) {
      return NextResponse.json({ 
        error: 'Missing required fields: userAddress, artistId, assetNumber' 
      }, { status: 400 });
    }
    
    // Get download contract address from artist_registry
    const { data: registry, error: registryError } = await supabaseAdmin
      .from('artist_registry')
      .select('downloads')
      .eq('id', artistId)
      .single();
    
    if (registryError || !registry?.downloads) {
      console.error('❌ Registry lookup error:', registryError);
      return NextResponse.json({ 
        error: `Download contract not found for artist ${artistId}` 
      }, { status: 404 });
    }
    
    console.log('📄 Using download contract:', registry.downloads);
    
    // Check gas budget (estimate ~$2 USD for ERC-1155 mint)
    const { data: budgetCheck, error: budgetError } = await supabaseAdmin
      .rpc('check_and_reserve_gas_budget', { 
        p_estimated_cost_usd: 2.0 
      });
    
    if (budgetError) {
      console.error('❌ Gas budget check error:', budgetError);
      return NextResponse.json({ 
        error: 'Gas budget check failed',
        details: budgetError.message
      }, { status: 500 });
    }
    
    const budgetResult = budgetCheck?.[0];
    if (!budgetResult?.can_sponsor) {
      console.log('⛽ Gas budget exceeded');
      return NextResponse.json({ 
        error: 'Gas budget exceeded for today', 
        budget: 'exceeded',
        remaining: budgetResult?.remaining_budget || 0
      }, { status: 400 });
    }
    
    console.log('✅ Gas budget approved, remaining:', budgetResult.remaining_budget);
    
    // Setup guarded signer (enforces Base Sepolia network)
    const serverPrivateKey = process.env.MINTER_PRIVATE_KEY;
    const rpcUrl = process.env.SERVER_BASE_SEPOLIA_RPC_URL;
    
    if (!serverPrivateKey || !rpcUrl) {
      return NextResponse.json(
        { error: 'Server configuration error: MINTER_PRIVATE_KEY or SERVER_BASE_SEPOLIA_RPC_URL missing' },
        { status: 500 }
      );
    }
    
    const gasWallet = await createGuardedSigner(serverPrivateKey, rpcUrl);
    console.log('🔑 Using gas wallet:', gasWallet.address);
    
    // Contract ABI for ArtistDownloads (ERC-1155)
    const downloadABI = [
      "function mintDownload(address user, uint256 assetId, uint256 amount) external"
    ];
    
    const contract = new ethers.Contract(registry.downloads, downloadABI, gasWallet);
    
    // Execute mint transaction
    console.log('⛏️ Executing mint transaction...');
    const tx = await contract.mintDownload(userAddress, assetNumber, 1, {
      gasLimit: 200000 // Conservative gas limit for ERC-1155 mint
    });
    
    console.log('📡 Transaction sent:', tx.hash);
    
    // Wait for 1 confirmation
    const receipt = await tx.wait(1);
    console.log('✅ Transaction confirmed:', receipt.hash);
    
    // Calculate gas costs
    const gasUsed = receipt.gasUsed;
    const gasPrice = receipt.gasPrice || tx.gasPrice;
    const costEth = Number(ethers.formatEther(gasUsed * gasPrice));
    const ethUsdRate = 2500; // Rough ETH price - can be improved with price oracle
    const costUsd = costEth * ethUsdRate;
    
    console.log('⛽ Gas details:', { gasUsed: gasUsed.toString(), costEth, costUsd });
    
    // Log gas sponsorship event to database
    const { error: gasLogError } = await supabaseAdmin
      .from('gas_sponsorship_events')
      .insert({
        tx_hash: receipt.hash,
        user_address: userAddress.toLowerCase(),
        artist_id: artistId,
        gas_used: gasUsed.toString(),
        gas_price_wei: gasPrice.toString(),
        cost_eth: costEth,
        cost_usd: costUsd,
        eth_usd_rate: ethUsdRate,
        rate_source: 'fallback',
        status: 'success',
        daily_budget_date: new Date().toISOString().split('T')[0]
      });
    
    if (gasLogError) {
      console.warn('⚠️ Failed to log gas event:', gasLogError);
      // Don't fail the request if logging fails
    }
    
    // Update the corresponding artist_earnings row with tx_hash and collectible_minted=true
    // Find the most recent pending earning for this user/artist/asset
    const { data: earnings, error: earningsError } = await supabaseAdmin
      .from('artist_earnings')
      .select('id')
      .eq('artist_id', artistId)
      .eq('buyer_address', userAddress.toLowerCase())
      .eq('collectible_minted', false)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!earningsError && earnings?.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('artist_earnings')
        .update({
          tx_hash: receipt.hash,
          collectible_minted: true,
          status: 'minted'
        })
        .eq('id', earnings[0].id);
      
      if (updateError) {
        console.warn('⚠️ Failed to update earnings record:', updateError);
      } else {
        console.log('✅ Updated earnings record with tx_hash');
      }
    }
    
    return NextResponse.json({
      success: true,
      txHash: receipt.hash,
      gasUsed: gasUsed.toString(),
      costEth: costEth,
      costUsd: costUsd.toFixed(4)
    });
    
  } catch (error: any) {
    console.error('❌ Mint collectible API error:', error);
    
    // Log failed gas event if we got far enough to have transaction details
    if (error.hash || error.transaction) {
      try {
        await supabaseAdmin
          .from('gas_sponsorship_events')
          .insert({
            tx_hash: error.hash || 'failed',
            user_address: request.body ? JSON.parse(await request.text()).userAddress?.toLowerCase() : 'unknown',
            artist_id: request.body ? JSON.parse(await request.text()).artistId : 'unknown',
            status: 'failed',
            error_reason: error.message,
            daily_budget_date: new Date().toISOString().split('T')[0]
          });
      } catch (logError) {
        console.warn('⚠️ Failed to log failed gas event:', logError);
      }
    }
    
    return NextResponse.json({ 
      error: error.message || 'Mint failed',
      retryable: true,
      details: error.reason || error.code
    }, { status: 500 });
  }
}
