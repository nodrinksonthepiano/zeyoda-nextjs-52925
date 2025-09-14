const { ethers } = require("hardhat");

async function createCancakesLP() {
  console.log("🍰 CREATING CANCAKES LIQUIDITY POOL");
  console.log("==================================");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  // Use the NEW main swap contract (deployer-owned)
  const MAIN_SWAP_ADDRESS = "0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE";
  const CANCAK33_TOKEN = "0xdF0f956Be58D0ed027AbdF993A8c61e4cf31CA65";
  
  const swapABI = [
    "function createPool(address token, uint256 tokenAmount) external payable",
    "function getPool(address token) external view returns (tuple(address token, uint256 tokenReserve, uint256 ethReserve, bool active))",
    "event PoolCreated(address indexed token, uint256 tokenAmount, uint256 ethAmount)"
  ];
  
  const erc20ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function symbol() external view returns (string)"
  ];
  
  try {
    const swapContract = new ethers.Contract(MAIN_SWAP_ADDRESS, swapABI, deployer);
    const tokenContract = new ethers.Contract(CANCAK33_TOKEN, erc20ABI, deployer);
    
    // Check balances
    const tokenBalance = await tokenContract.balanceOf(deployer.address);
    const ethBalance = await ethers.provider.getBalance(deployer.address);
    const symbol = await tokenContract.symbol();
    
    console.log("📊 Current Balances:");
    console.log(`   ${symbol}: ${ethers.formatUnits(tokenBalance, 18)} tokens`);
    console.log(`   ETH: ${ethers.formatEther(ethBalance)} ETH`);
    
    // LP amounts (similar to GOSHEESH/JAITEA)
    const LP_TOKENS = ethers.parseUnits("100000000", 18);  // 100M tokens
    const LP_ETH = ethers.parseEther("0.01");               // 0.01 ETH
    
    console.log("\\n🎯 Liquidity Pool Plan:");
    console.log(`   ${ethers.formatUnits(LP_TOKENS, 18)} CANCAK33 + ${ethers.formatEther(LP_ETH)} ETH`);
    
    // Check if we have enough
    if (tokenBalance < LP_TOKENS) {
      throw new Error(`Need ${ethers.formatUnits(LP_TOKENS, 18)} CANCAK33, have ${ethers.formatUnits(tokenBalance, 18)}`);
    }
    
    if (ethBalance < LP_ETH + ethers.parseEther("0.005")) {
      throw new Error(`Need ${ethers.formatEther(LP_ETH + ethers.parseEther("0.005"))} ETH, have ${ethers.formatEther(ethBalance)}`);
    }
    
    // Check if pool already exists
    console.log("\\n🔍 Checking if pool exists...");
    const existingPool = await swapContract.getPool(CANCAK33_TOKEN);
    
    if (existingPool.active) {
      console.log("⚠️ CANCAK33 pool already exists!");
      console.log("   Token Reserve:", ethers.formatUnits(existingPool.tokenReserve, 18));
      console.log("   ETH Reserve:", ethers.formatEther(existingPool.ethReserve));
      return;
    }
    
    console.log("✅ No existing pool found, creating new one...");
    
    // Approve tokens
    console.log("\\n🔓 Approving CANCAK33 tokens...");
    const approveTx = await tokenContract.approve(MAIN_SWAP_ADDRESS, LP_TOKENS);
    await approveTx.wait();
    console.log("✅ Tokens approved");
    
    // Create pool
    console.log("\\n🏊 Creating CANCAK33 liquidity pool...");
    const createTx = await swapContract.createPool(CANCAK33_TOKEN, LP_TOKENS, {
      value: LP_ETH,
      gasLimit: 500000
    });
    
    console.log("Transaction sent:", createTx.hash);
    console.log("⏳ Waiting for confirmation...");
    
    const receipt = await createTx.wait();
    console.log("✅ CANCAK33 liquidity pool created successfully!");
    
    // Verify creation
    const newPool = await swapContract.getPool(CANCAK33_TOKEN);
    console.log("\\n📊 Pool Status:");
    console.log("   Active:", newPool.active);
    console.log("   Token Reserve:", ethers.formatUnits(newPool.tokenReserve, 18), "CANCAK33");
    console.log("   ETH Reserve:", ethers.formatEther(newPool.ethReserve), "ETH");
    
    // Calculate initial price
    if (newPool.active && newPool.ethReserve > 0) {
      const pricePerToken = Number(ethers.formatEther(newPool.ethReserve)) / Number(ethers.formatUnits(newPool.tokenReserve, 18));
      const usdPrice = pricePerToken * 2500; // Assuming ETH = $2500
      
      console.log("\\n💰 CANCAK33 Initial Price:");
      console.log(`   ${pricePerToken.toExponential(4)} ETH per CANCAK33`);
      console.log(`   $${usdPrice.toFixed(6)} USD per CANCAK33`);
    }
    
    console.log("\\n🎉 CANCAKES IS NOW READY FOR TRADING!");
    console.log("✅ CANCAK33 should appear in swap options");
    console.log("✅ Users can buy/sell CANCAK33");
    console.log("✅ Cross-token swaps enabled");
    console.log("✅ 1B CANCAK33 in CANCAKES wallet for distribution");
    
  } catch (error) {
    console.error("❌ Error creating LP:", error.message);
    throw error;
  }
}

createCancakesLP()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
