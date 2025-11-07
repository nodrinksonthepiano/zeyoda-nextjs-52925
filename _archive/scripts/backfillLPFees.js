const { ethers } = require("hardhat");
const { createClient } = require('@supabase/supabase-js');

// Supabase setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Swap contract address and ABI
const SWAP_CONTRACT_ADDRESS = "0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE";
const SWAP_ABI = [
  "event TokenSwapped(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut)"
];

async function backfillLPFees() {
  console.log("💰 BACKFILLING HISTORICAL LP FEES FROM TOKENSWAPPED EVENTS");
  console.log("=========================================================");
  
  try {
    // Get artist registry for token→artist mapping
    const { data: registry, error: registryError } = await supabase
      .from('artist_registry')
      .select('id, token, swap');
    
    if (registryError) {
      throw new Error(`Failed to fetch registry: ${registryError.message}`);
    }
    
    console.log(`📋 Found ${registry.length} artists in registry`);
    
    // Create token→artist mapping
    const tokenToArtist = {};
    registry.forEach(artist => {
      tokenToArtist[artist.token.toLowerCase()] = artist.id;
      console.log(`🎨 ${artist.id}: ${artist.token.slice(0, 8)}...`);
    });
    
    // Setup provider
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    const swapContract = new ethers.Contract(SWAP_CONTRACT_ADDRESS, SWAP_ABI, provider);
    
    const currentBlock = await provider.getBlockNumber();
    console.log(`🔗 Current block: ${currentBlock}`);
    
    // Start from a reasonable block (when contracts were deployed)
    const startBlock = Math.max(currentBlock - 100000, 0); // Last ~100k blocks
    console.log(`📊 Scanning blocks ${startBlock} to ${currentBlock}...`);
    
    let totalFeesFound = 0;
    let totalFeesUsd = 0;
    
    // Query TokenSwapped events in chunks to avoid API limits
    const CHUNK_SIZE = 1000; // Small chunks for free tier
    
    for (let fromBlock = startBlock; fromBlock < currentBlock; fromBlock += CHUNK_SIZE) {
      const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, currentBlock);
      
      try {
        console.log(`  📊 Scanning blocks ${fromBlock} to ${toBlock}...`);
        
        const events = await swapContract.queryFilter(
          swapContract.filters.TokenSwapped(),
          fromBlock,
          toBlock
        );
        
        if (events.length > 0) {
          console.log(`    ✅ Found ${events.length} swap events in this chunk`);
          
          // Process each swap event
          for (const event of events) {
            const { user, tokenIn, tokenOut, amountIn, amountOut } = event.args;
            const txHash = event.transactionHash;
            const blockNumber = event.blockNumber;
            const logIndex = event.logIndex;
            
            console.log(`💱 Processing swap: ${tokenIn.slice(0,8)}... → ${tokenOut.slice(0,8)}... (${ethers.formatUnits(amountIn, 18)} tokens)`);
            
            // Handle different swap types
            if (tokenOut === ethers.ZeroAddress) {
              // Token → ETH swap (single fee to tokenIn artist)
              await recordSwapFee(tokenIn, txHash, logIndex, amountIn, 'ETH', blockNumber, tokenToArtist);
              totalFeesFound++;
              
            } else if (tokenIn === ethers.ZeroAddress) {
              // ETH → Token swap (single fee to tokenOut artist)  
              await recordSwapFee(tokenOut, txHash, logIndex, amountIn, 'ETH', blockNumber, tokenToArtist);
              totalFeesFound++;
              
            } else {
              // Token → Token swap (two fees: one for each pool)
              // Leg 1: TokenIn → ETH (fee to tokenIn artist)
              await recordSwapFee(tokenIn, txHash, logIndex, amountIn, 'ETH', blockNumber, tokenToArtist);
              // Leg 2: ETH → TokenOut (fee to tokenOut artist, but based on original input)
              await recordSwapFee(tokenOut, txHash, logIndex + 1, amountIn, 'ETH', blockNumber, tokenToArtist);
              totalFeesFound += 2;
            }
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (chunkError) {
        console.log(`    ⚠️ Chunk ${fromBlock}-${toBlock} failed: ${chunkError.message}`);
        // Continue with next chunk
      }
    }
    
    console.log("\n🎉 LP FEE BACKFILL COMPLETE!");
    console.log("============================");
    console.log(`📊 Total fees processed: ${totalFeesFound}`);
    console.log(`💰 Estimated total fees: $${totalFeesUsd.toFixed(4)}`);
    
  } catch (error) {
    console.error("❌ LP fee backfill failed:", error);
    process.exit(1);
  }
}

// Helper function to record individual swap fees
async function recordSwapFee(tokenAddress, txHash, logIndex, amountInRaw, baseQuote, blockNumber, tokenToArtist) {
  try {
    const artistId = tokenToArtist[tokenAddress.toLowerCase()];
    
    if (!artistId) {
      console.warn(`⚠️ Unknown token for LP fee: ${tokenAddress.slice(0, 8)}...`);
      return;
    }
    
    // Calculate fee (0.30% of input)
    const amountIn = parseFloat(ethers.formatUnits(amountInRaw, 18));
    const feeBase = amountIn * 0.003;
    const feeUsd = baseQuote === 'ETH' ? feeBase * 2500 : feeBase; // Rough ETH price
    
    // Create external_id for idempotency
    const externalId = `${txHash}:${logIndex}:${SWAP_CONTRACT_ADDRESS}`;
    
    console.log(`  💰 Recording LP fee: ${artistId} $${feeUsd.toFixed(4)}`);
    
    // Insert into artist_earnings
    const { error: insertError } = await supabase
      .from('artist_earnings')
      .insert({
        artist_id: artistId,
        buyer_address: 'amm-pool', // LP pool address or similar
        asset_id: null,
        gross_amount_usd: feeUsd,
        protocol_fee_usd: 0,
        processor_fee_usd: 0,
        net_earnings_usd: feeUsd,
        payment_method: 'amm',
        source: 'lp_fee',
        external_id: externalId,
        tx_hash: txHash,
        collectible_minted: false,
        status: 'minted',
        created_at: new Date().toISOString() // Use current time for backfill
      });
    
    if (insertError) {
      if (insertError.code === '23505') {
        // Duplicate - already processed
        return;
      } else {
        console.error(`  ❌ Insert error for ${artistId}:`, insertError);
      }
    } else {
      console.log(`  ✅ LP fee recorded for ${artistId}: $${feeUsd.toFixed(4)}`);
    }
    
  } catch (error) {
    console.error('❌ Error recording swap fee:', error);
  }
}

// Run the backfill
backfillLPFees()
  .then(() => {
    console.log("✅ LP fee backfill completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ LP fee backfill failed:", error);
    process.exit(1);
  });
