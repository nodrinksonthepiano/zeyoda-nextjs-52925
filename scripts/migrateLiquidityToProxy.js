const { ethers } = require("hardhat");
const { createClient } = require('@supabase/supabase-js');

// Supabase setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Contract addresses
const LEGACY_SWAP = "0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE";
const NEW_PROXY = process.argv[2]; // Pass as argument

// ABIs
const LEGACY_ABI = [
  "function getPool(address token) view returns (tuple(address token, uint256 tokenReserve, uint256 ethReserve, bool active))",
  "function emergencyWithdraw(address token) external"
];

const PROXY_ABI = [
  "function createPool(address token, uint256 tokenAmount) external payable",
  "function getPool(address token) view returns (tuple(address token, uint256 tokenReserve, uint256 ethReserve, bool active))"
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)"
];

async function migrateLiquidity() {
  console.log("🔄 MIGRATING LIQUIDITY FROM LEGACY TO UUPS PROXY");
  console.log("===============================================");
  
  if (!NEW_PROXY) {
    console.error("❌ Usage: npx hardhat run scripts/migrateLiquidityToProxy.js --network baseSepolia <PROXY_ADDRESS>");
    process.exit(1);
  }
  
  console.log("Legacy Swap:", LEGACY_SWAP);
  console.log("New Proxy:", NEW_PROXY);
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  try {
    // Get artist tokens from registry
    const { data: registry, error: registryError } = await supabase
      .from('artist_registry')
      .select('id, token');
    
    if (registryError) {
      throw new Error(`Failed to fetch registry: ${registryError.message}`);
    }
    
    console.log(`\n📋 Found ${registry.length} artists to migrate:`);
    registry.forEach(artist => {
      console.log(`  ${artist.id}: ${artist.token.slice(0, 8)}...`);
    });
    
    // Setup contracts
    const legacySwap = new ethers.Contract(LEGACY_SWAP, LEGACY_ABI, deployer);
    const proxySwap = new ethers.Contract(NEW_PROXY, PROXY_ABI, deployer);
    
    let totalMigrated = 0;
    
    // Migrate each artist's pool
    for (const artist of registry) {
      console.log(`\n🎨 Migrating ${artist.id.toUpperCase()}...`);
      
      try {
        // Check legacy pool state
        const legacyPool = await legacySwap.getPool(artist.token);
        
        if (!legacyPool.active || legacyPool.tokenReserve === 0n || legacyPool.ethReserve === 0n) {
          console.log(`  ⚠️ No active legacy pool for ${artist.id}, skipping`);
          continue;
        }
        
        console.log(`  📊 Legacy pool:`, {
          tokenReserve: ethers.formatUnits(legacyPool.tokenReserve, 18),
          ethReserve: ethers.formatEther(legacyPool.ethReserve),
          active: legacyPool.active
        });
        
        // Withdraw from legacy (owner only)
        console.log(`  🔄 Withdrawing from legacy pool...`);
        
        // Withdraw tokens
        const tokenWithdrawTx = await legacySwap.emergencyWithdraw(artist.token);
        await tokenWithdrawTx.wait();
        console.log(`  ✅ Tokens withdrawn: ${tokenWithdrawTx.hash.slice(0, 10)}...`);
        
        // Withdraw ETH
        const ethWithdrawTx = await legacySwap.emergencyWithdraw(ethers.ZeroAddress);
        await ethWithdrawTx.wait();
        console.log(`  ✅ ETH withdrawn: ${ethWithdrawTx.hash.slice(0, 10)}...`);
        
        // Check our token balance
        const tokenContract = new ethers.Contract(artist.token, ERC20_ABI, deployer);
        const tokenBalance = await tokenContract.balanceOf(deployer.address);
        const ethBalance = await ethers.provider.getBalance(deployer.address);
        
        console.log(`  💰 Received:`, {
          tokens: ethers.formatUnits(tokenBalance, 18),
          eth: ethers.formatEther(ethBalance)
        });
        
        // Approve proxy to spend tokens
        console.log(`  🔐 Approving proxy to spend tokens...`);
        const approveTx = await tokenContract.approve(NEW_PROXY, tokenBalance);
        await approveTx.wait();
        
        // Create pool in new proxy with same ratio
        console.log(`  🏊 Creating pool in new proxy...`);
        const createPoolTx = await proxySwap.createPool(artist.token, tokenBalance, {
          value: legacyPool.ethReserve // Use same ETH amount
        });
        await createPoolTx.wait();
        
        console.log(`  ✅ Pool migrated successfully: ${createPoolTx.hash.slice(0, 10)}...`);
        
        // Verify new pool
        const newPool = await proxySwap.getPool(artist.token);
        console.log(`  📊 New pool:`, {
          tokenReserve: ethers.formatUnits(newPool.tokenReserve, 18),
          ethReserve: ethers.formatEther(newPool.ethReserve),
          active: newPool.active
        });
        
        totalMigrated++;
        
      } catch (artistError) {
        console.error(`  ❌ Migration failed for ${artist.id}:`, artistError.message);
      }
    }
    
    console.log("\n🎉 LIQUIDITY MIGRATION COMPLETE!");
    console.log("=================================");
    console.log(`📊 Successfully migrated: ${totalMigrated}/${registry.length} pools`);
    console.log("\n📝 MANUAL UPDATES REQUIRED:");
    console.log("Update Supabase artist_registry.swap to new proxy address:");
    console.log(`UPDATE artist_registry SET swap = '${NEW_PROXY}';`);
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateLiquidity()
  .then(() => {
    console.log("✅ Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  });
