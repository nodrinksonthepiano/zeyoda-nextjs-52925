const { ethers } = require("hardhat");

async function redeployCancakesComplete() {
  console.log("🍰 COMPLETE CANCAKES REDEPLOYMENT");
  console.log("================================");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.05")) {
    throw new Error("⚠️ Need at least 0.05 ETH for complete deployment");
  }
  
  const CANCAKES_WALLET = "0xe42C291143e03f3Bd7D5a095815DAD3e82835C05";
  const PROTOCOL_VAULT = "0x615258a5263DBEe0DDEED3166ddC1f442D937eB3";
  
  try {
    // 1. Deploy CANCAKES Token (ArtistToken)
    console.log("\n🪙 1. Deploying CANCAKES Token...");
    const ArtistToken = await ethers.getContractFactory("ArtistToken");
    const tokenContract = await ArtistToken.deploy(
      "CANCAKES",    // Token name
      "CANCAK33",    // Token symbol  
      CANCAKES_WALLET, // Artist wallet
      PROTOCOL_VAULT   // Protocol vault
    );
    
    await tokenContract.waitForDeployment();
    const tokenAddress = await tokenContract.getAddress();
    console.log("✅ CANCAKES Token deployed:", tokenAddress);
    
    // Execute initial mint (10B distribution)
    console.log("🪙 Minting 10B CANCAK33 with automatic distribution...");
    const mintTx = await tokenContract.initialMint();
    await mintTx.wait();
    console.log("✅ 10B supply minted and distributed");
    console.log("   - 1B to CANCAKES wallet:", CANCAKES_WALLET);
    console.log("   - 100M to protocol vault (for LP seeding)");
    console.log("   - 8.9B to protocol vault");
    
    // 2. Deploy CANCAKES Swap (TreasurySwapLite)
    console.log("\n🔄 2. Deploying CANCAKES Swap...");
    const TreasurySwapLite = await ethers.getContractFactory("TreasurySwapLite");
    const swapContract = await TreasurySwapLite.deploy(
      tokenAddress,     // CANCAKES token
      CANCAKES_WALLET   // Treasury wallet (CANCAKES artist)
    );
    
    await swapContract.waitForDeployment();
    const swapAddress = await swapContract.getAddress();
    console.log("✅ CANCAKES Swap deployed:", swapAddress);
    
    // 3. Download contract is already deployed: 0x1942756cA3dc2484b55E3417551159b56F66d467
    const downloadAddress = "0x1942756cA3dc2484b55E3417551159b56F66d467";
    console.log("✅ CANCAKES Downloads (already deployed):", downloadAddress);
    
    // 4. Generate SQL updates
    console.log("\n📝 REQUIRED SQL UPDATES:");
    console.log("Copy and run this SQL in your Supabase SQL Editor:");
    console.log("```sql");
    console.log("-- Update CANCAKES with new complete addresses");
    console.log(`UPDATE artist_registry SET`);
    console.log(`  token = '${tokenAddress}',`);
    console.log(`  swap = '${swapAddress}',`);
    console.log(`  downloads = '${downloadAddress}'`);
    console.log(`WHERE id = 'cancakes';`);
    console.log("");
    console.log(`UPDATE artists SET`);
    console.log(`  token_address = '${tokenAddress}',`);
    console.log(`  download_address = '${downloadAddress}'`);
    console.log(`WHERE id = 'cancakes';`);
    console.log("");
    console.log("-- Verify the updates");
    console.log("SELECT id, token, swap, downloads FROM artist_registry WHERE id = 'cancakes';");
    console.log("SELECT id, name, token_address, download_address FROM artists WHERE id = 'cancakes';");
    console.log("```");
    
    console.log("\n🎉 CANCAKES COMPLETE REDEPLOYMENT SUCCESSFUL!");
    console.log("📊 Summary:");
    console.log("   Token Address:", tokenAddress);
    console.log("   Swap Address:", swapAddress);
    console.log("   Downloads Address:", downloadAddress);
    console.log("   CANCAKES Wallet:", CANCAKES_WALLET);
    console.log("");
    console.log("🚀 Next Steps:");
    console.log("1. Run the SQL updates above in Supabase");
    console.log("2. Refresh the CANCAKES page");
    console.log("3. CANCAK33 should appear in swap options");
    console.log("4. 1B CANCAK33 should be in CANCAKES wallet");
    console.log("5. LP will be automatically seeded with 100M tokens");
    
    return {
      token: tokenAddress,
      swap: swapAddress,
      downloads: downloadAddress,
      wallet: CANCAKES_WALLET
    };
    
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    throw error;
  }
}

redeployCancakesComplete()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
