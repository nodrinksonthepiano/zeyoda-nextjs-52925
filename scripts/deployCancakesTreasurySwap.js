const { ethers } = require("hardhat");

async function deployCancakesTreasurySwap() {
  console.log("🍰 DEPLOYING CANCAKES TREASURY SWAP");
  console.log("===================================");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const CANCAK33_TOKEN = "0xdF0f956Be58D0ed027AbdF993A8c61e4cf31CA65";
  const CANCAKES_WALLET = "0xe42C291143e03f3Bd7D5a095815DAD3e82835C05";
  
  try {
    console.log("📝 Deploying TreasurySwapLite for CANCAKES...");
    
    const TreasurySwapLite = await ethers.getContractFactory("TreasurySwapLite");
    const swapContract = await TreasurySwapLite.deploy();
    
    await swapContract.waitForDeployment();
    const swapAddress = await swapContract.getAddress();
    
    console.log("✅ CANCAKES TreasurySwapLite deployed:", swapAddress);
    
    // Initialize the contract
    console.log("🔧 Initializing contract...");
    const initTx = await swapContract.initialize(CANCAK33_TOKEN, CANCAKES_WALLET);
    await initTx.wait();
    console.log("✅ Contract initialized");
    
    // Verify initialization
    const tokenAddress = await swapContract.artistToken();
    const artistWallet = await swapContract.artist();
    
    console.log("📊 Contract Verification:");
    console.log("   Token Address:", tokenAddress);
    console.log("   Treasury Wallet:", artistWallet);
    console.log("   Matches Expected:", tokenAddress === CANCAK33_TOKEN && artistWallet === CANCAKES_WALLET);
    
    console.log("\\n📝 REQUIRED DATABASE UPDATE:");
    console.log("Run this SQL in Supabase:");
    console.log("```sql");
    console.log(`UPDATE artist_registry SET swap = '${swapAddress}' WHERE id = 'cancakes';`);
    console.log("SELECT id, token, swap FROM artist_registry WHERE id = 'cancakes';");
    console.log("```");
    
    console.log("\\n🎉 CANCAKES TREASURY SWAP READY!");
    console.log("After updating the database:");
    console.log("✅ CANCAK33 should appear in swap options");
    console.log("✅ Users can buy CANCAK33 with USD/ETH");
    console.log("✅ Revenue goes to CANCAKES treasury wallet");
    console.log("✅ 1B CANCAK33 will be visible in wallet");
    
    return swapAddress;
    
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    throw error;
  }
}

deployCancakesTreasurySwap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
