const { ethers } = require("hardhat");
const { createClient } = require('@supabase/supabase-js');

// Supabase setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Swap contract address from swapUtils.ts
const SWAP_CONTRACT_ADDRESS = "0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE";

// Swap ABI for pool checking
const SWAP_ABI = [
  "function getPool(address token) view returns (bool active, uint256 ethReserve, uint256 tokenReserve, uint256 totalLiquidity, address lpToken)"
];

async function investigateAMM() {
  console.log("🔍 INVESTIGATING AMM POOLS AND PRICING");
  console.log("=====================================");
  
  try {
    // Get all artist registry data
    const { data: registry, error: registryError } = await supabase
      .from('artist_registry')
      .select('id, token, swap, downloads, treasury_wallet');
    
    if (registryError) {
      throw new Error(`Failed to fetch registry: ${registryError.message}`);
    }
    
    console.log(`📋 Found ${registry.length} artists in registry\n`);
    
    // Setup provider
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    const swapContract = new ethers.Contract(SWAP_CONTRACT_ADDRESS, SWAP_ABI, provider);
    
    console.log(`🔄 Using Swap Contract: ${SWAP_CONTRACT_ADDRESS}\n`);
    
    // Check each artist's pool
    for (const artist of registry) {
      console.log(`🎨 ${artist.id.toUpperCase()}:`);
      console.log(`  Token: ${artist.token}`);
      console.log(`  Swap: ${artist.swap}`);
      
      if (!artist.token) {
        console.log(`  ❌ No token address\n`);
        continue;
      }
      
      try {
        // Check pool status in the main AMM contract
        const pool = await swapContract.getPool(artist.token);
        
        console.log(`  Pool Status:`, {
          active: pool.active,
          ethReserve: ethers.formatEther(pool.ethReserve),
          tokenReserve: ethers.formatUnits(pool.tokenReserve, 18),
          totalLiquidity: pool.totalLiquidity.toString()
        });
        
        if (pool.active && pool.ethReserve > 0 && pool.tokenReserve > 0) {
          // Calculate actual price
          const ethPerToken = Number(ethers.formatEther(pool.ethReserve)) / Number(ethers.formatUnits(pool.tokenReserve, 18));
          const ethUsdRate = 2500; // Rough ETH price
          const tokenPriceUSD = ethPerToken * ethUsdRate;
          
          console.log(`  💰 Calculated Price: $${tokenPriceUSD.toFixed(8)} per token`);
          console.log(`  📊 Pool Ratio: 1 ETH = ${(1/ethPerToken).toLocaleString()} tokens`);
          
          if (artist.id === 'cancakes') {
            console.log(`  🎯 CANCAKES ANALYSIS:`);
            console.log(`    - Current Price: $${tokenPriceUSD.toFixed(8)}`);
            console.log(`    - Should be similar to GOSH33SH/JAIT33 unless pool is different`);
            
            if (tokenPriceUSD > 1) {
              console.log(`    ⚠️ SUSPICIOUS: Price seems too high for CANCAKES`);
              console.log(`    🔍 This suggests the initial LP was created with wrong ratios`);
            }
          }
        } else {
          console.log(`  ❌ No active liquidity pool`);
        }
        
      } catch (poolError) {
        console.log(`  ❌ Pool check failed: ${poolError.message}`);
      }
      
      console.log(''); // Empty line for readability
    }
    
    // Check historical earnings data accuracy
    console.log("📊 CHECKING HISTORICAL EARNINGS ACCURACY");
    console.log("=======================================");
    
    const { data: earnings, error: earningsError } = await supabase
      .from('artist_earnings')
      .select('artist_id, gross_amount_usd, net_earnings_usd, protocol_fee_usd, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (!earningsError && earnings) {
      console.log('Recent earnings records:');
      earnings.forEach(earning => {
        console.log(`  ${earning.artist_id}: $${earning.gross_amount_usd} gross → $${earning.net_earnings_usd} net (fee: $${earning.protocol_fee_usd})`);
      });
      
      // Check for suspicious amounts
      const suspiciousEarnings = earnings.filter(e => parseFloat(e.gross_amount_usd) !== 1.0 && parseFloat(e.gross_amount_usd) !== 5.0);
      
      if (suspiciousEarnings.length > 0) {
        console.log('\n⚠️ SUSPICIOUS EARNINGS (not $1 or $5):');
        suspiciousEarnings.forEach(earning => {
          console.log(`  ${earning.artist_id}: $${earning.gross_amount_usd} - Created: ${earning.created_at}`);
        });
      }
    }
    
  } catch (error) {
    console.error("❌ Investigation failed:", error);
    process.exit(1);
  }
}

// Run the investigation
investigateAMM()
  .then(() => {
    console.log("✅ AMM investigation completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Investigation failed:", error);
    process.exit(1);
  });
