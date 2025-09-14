const { ethers } = require("hardhat");

async function verifyCancakesLP() {
  console.log("🔍 VERIFYING CANCAKES LIQUIDITY POOL");
  console.log("===================================");
  
  const [deployer] = await ethers.getSigners();
  const MAIN_SWAP_ADDRESS = "0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE";
  const CANCAK33_TOKEN = "0xdF0f956Be58D0ed027AbdF993A8c61e4cf31CA65";
  
  try {
    const swapContract = new ethers.Contract(
      MAIN_SWAP_ADDRESS,
      [
        "function getPool(address token) external view returns (tuple(address token, uint256 tokenReserve, uint256 ethReserve, bool active))",
        "function owner() external view returns (address)"
      ],
      deployer
    );
    
    console.log("📊 Swap Contract Info:");
    const owner = await swapContract.owner();
    console.log("   Owner:", owner);
    console.log("   Deployer:", deployer.address);
    console.log("   Is Owner:", owner === deployer.address);
    
    console.log("\n📊 Pool Status:");
    const pool = await swapContract.getPool(CANCAK33_TOKEN);
    console.log("   Token:", pool.token);
    console.log("   Active:", pool.active);
    console.log("   Token Reserve:", ethers.formatUnits(pool.tokenReserve, 18), "CANCAK33");
    console.log("   ETH Reserve:", ethers.formatEther(pool.ethReserve), "ETH");
    
    if (pool.active && pool.tokenReserve > 0) {
      console.log("\n✅ LIQUIDITY POOL IS WORKING!");
      
      // Calculate price
      const pricePerToken = Number(ethers.formatEther(pool.ethReserve)) / Number(ethers.formatUnits(pool.tokenReserve, 18));
      const usdPrice = pricePerToken * 2500; // Assuming ETH = $2500
      
      console.log("💰 CANCAK33 Price:");
      console.log(`   ${pricePerToken.toExponential(4)} ETH per CANCAK33`);
      console.log(`   $${usdPrice.toFixed(6)} USD per CANCAK33`);
      
      console.log("\n🎯 NEXT: Update database with correct swap address");
      console.log(`UPDATE artist_registry SET swap = '${MAIN_SWAP_ADDRESS}' WHERE id = 'cancakes';`);
      
    } else {
      console.log("\n❌ Pool not active or empty");
      console.log("💡 The transaction might have failed or pool creation was unsuccessful");
    }
    
    // Check token balances
    console.log("\n📊 Token Distribution Check:");
    const tokenContract = new ethers.Contract(
      CANCAK33_TOKEN,
      ["function balanceOf(address) view returns (uint256)"],
      deployer
    );
    
    const deployerBalance = await tokenContract.balanceOf(deployer.address);
    const cancakesBalance = await tokenContract.balanceOf("0xe42C291143e03f3Bd7D5a095815DAD3e82835C05");
    const swapBalance = await tokenContract.balanceOf(MAIN_SWAP_ADDRESS);
    
    console.log("   Deployer:", ethers.formatUnits(deployerBalance, 18), "CANCAK33");
    console.log("   CANCAKES Wallet:", ethers.formatUnits(cancakesBalance, 18), "CANCAK33");
    console.log("   Swap Contract:", ethers.formatUnits(swapBalance, 18), "CANCAK33");
    
  } catch (error) {
    console.error("❌ Verification failed:", error.message);
  }
}

verifyCancakesLP();
