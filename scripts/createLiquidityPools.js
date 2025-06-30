const { ethers } = require("hardhat");

async function main() {
  console.log("🏊 CREATING JAITEA-GOSHEESH LIQUIDITY POOLS");
  console.log("==========================================\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Protocol deployer:", deployer.address);
  
  // CORRECT CONTRACT ADDRESSES (from fresh_tokens_deployment.json)
  const MAIN_SWAP_ADDRESS = "0xb9Fd7D8111F462cdB58EB7E1D18EA3016142Fa35";
  const GOSH33SH_TOKEN = "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac";  // Correct
  const JAIT33_TOKEN = "0x9D06564a8D98e146CAb1dE74BF815bf05d24D685";   // Correct
  
  // Get contract instances
  const swapABI = [
    "function createPool(address token, uint256 tokenAmount) external payable",
    "function getPool(address token) external view returns (tuple(address token, uint256 tokenReserve, uint256 ethReserve, bool active))",
    "event PoolCreated(address indexed token, uint256 tokenAmount, uint256 ethAmount)"
  ];
  
  const erc20ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function symbol() external view returns (string)"
  ];
  
  const swapContract = new ethers.Contract(MAIN_SWAP_ADDRESS, swapABI, deployer);
  const goshContract = new ethers.Contract(GOSH33SH_TOKEN, erc20ABI, deployer);
  const jaitContract = new ethers.Contract(JAIT33_TOKEN, erc20ABI, deployer);
  
  // Check current balances
  const goshBalance = await goshContract.balanceOf(deployer.address);
  const jaitBalance = await jaitContract.balanceOf(deployer.address);
  const ethBalance = await ethers.provider.getBalance(deployer.address);
  
  console.log("💰 CURRENT BALANCES:");
  console.log(`  GOSH33SH: ${ethers.formatUnits(goshBalance, 18)} tokens`);
  console.log(`  JAIT33: ${ethers.formatUnits(jaitBalance, 18)} tokens`);
  console.log(`  ETH: ${ethers.formatEther(ethBalance)} ETH\n`);
  
  // LP creation amounts
  const GOSH_LP_TOKENS = ethers.parseUnits("10000000", 18);  // 10M tokens
  const GOSH_LP_ETH = ethers.parseEther("0.01");             // 0.01 ETH
  
  const JAIT_LP_TOKENS = ethers.parseUnits("5000000", 18);   // 5M tokens
  const JAIT_LP_ETH = ethers.parseEther("0.005");            // 0.005 ETH
  
  console.log("🎯 LIQUIDITY POOL PLAN:");
  console.log(`  GOSH33SH: ${ethers.formatUnits(GOSH_LP_TOKENS, 18)} tokens + ${ethers.formatEther(GOSH_LP_ETH)} ETH`);
  console.log(`  JAIT33: ${ethers.formatUnits(JAIT_LP_TOKENS, 18)} tokens + ${ethers.formatEther(JAIT_LP_ETH)} ETH\n`);
  
  // Check if we have enough tokens
  if (goshBalance < GOSH_LP_TOKENS) {
    throw new Error(`Insufficient GOSH33SH tokens. Need: ${ethers.formatUnits(GOSH_LP_TOKENS, 18)}, Have: ${ethers.formatUnits(goshBalance, 18)}`);
  }
  
  if (jaitBalance < JAIT_LP_TOKENS) {
    throw new Error(`Insufficient JAIT33 tokens. Need: ${ethers.formatUnits(JAIT_LP_TOKENS, 18)}, Have: ${ethers.formatUnits(jaitBalance, 18)}`);
  }
  
  if (ethBalance < GOSH_LP_ETH + JAIT_LP_ETH + ethers.parseEther("0.01")) {
    throw new Error(`Insufficient ETH. Need: ${ethers.formatEther(GOSH_LP_ETH + JAIT_LP_ETH + ethers.parseEther("0.01"))}, Have: ${ethers.formatEther(ethBalance)}`);
  }
  
  // Create GOSH33SH Pool
  console.log("🟢 CREATING GOSH33SH LIQUIDITY POOL...");
  
  try {
    // Check if pool already exists
    const existingGoshPool = await swapContract.getPool(GOSH33SH_TOKEN);
    if (existingGoshPool.active) {
      console.log("⚠️ GOSH33SH pool already exists, skipping...");
    } else {
      console.log("- Approving GOSH33SH tokens...");
      const goshApprove = await goshContract.approve(MAIN_SWAP_ADDRESS, GOSH_LP_TOKENS);
      await goshApprove.wait();
      console.log("✅ GOSH33SH tokens approved");
      
      console.log("- Creating GOSH33SH pool...");
      const goshTx = await swapContract.createPool(GOSH33SH_TOKEN, GOSH_LP_TOKENS, {
        value: GOSH_LP_ETH,
        gasLimit: 500000
      });
      
      console.log(`- Transaction: ${goshTx.hash}`);
      const goshReceipt = await goshTx.wait();
      console.log("✅ GOSH33SH pool created successfully!");
    }
  } catch (error) {
    console.error("❌ Error creating GOSH33SH pool:", error.message);
  }
  
  console.log("");
  
  // Create JAIT33 Pool
  console.log("🟡 CREATING JAIT33 LIQUIDITY POOL...");
  
  try {
    const existingJaitPool = await swapContract.getPool(JAIT33_TOKEN);
    if (existingJaitPool.active) {
      console.log("⚠️ JAIT33 pool already exists, skipping...");
    } else {
      console.log("- Approving JAIT33 tokens...");
      const jaitApprove = await jaitContract.approve(MAIN_SWAP_ADDRESS, JAIT_LP_TOKENS);
      await jaitApprove.wait();
      console.log("✅ JAIT33 tokens approved");
      
      console.log("- Creating JAIT33 pool...");
      const jaitTx = await swapContract.createPool(JAIT33_TOKEN, JAIT_LP_TOKENS, {
        value: JAIT_LP_ETH,
        gasLimit: 500000
      });
      
      console.log(`- Transaction: ${jaitTx.hash}`);
      const jaitReceipt = await jaitTx.wait();
      console.log("✅ JAIT33 pool created successfully!");
    }
  } catch (error) {
    console.error("❌ Error creating JAIT33 pool:", error.message);
  }
  
  // Verify pool creation
  console.log("\n🔍 VERIFYING POOL CREATION...");
  
  try {
    const finalGoshPool = await swapContract.getPool(GOSH33SH_TOKEN);
    const finalJaitPool = await swapContract.getPool(JAIT33_TOKEN);
    
    console.log("\n✅ FINAL POOL STATUS:");
    console.log("GOSH33SH Pool:", {
      active: finalGoshPool.active,
      tokenReserve: ethers.formatUnits(finalGoshPool.tokenReserve, 18),
      ethReserve: ethers.formatEther(finalGoshPool.ethReserve)
    });
    
    console.log("JAIT33 Pool:", {
      active: finalJaitPool.active,
      tokenReserve: ethers.formatUnits(finalJaitPool.tokenReserve, 18),
      ethReserve: ethers.formatEther(finalJaitPool.ethReserve)
    });
    
    // Calculate prices
    if (finalGoshPool.active && finalGoshPool.ethReserve > 0) {
      const goshPrice = Number(ethers.formatEther(finalGoshPool.ethReserve)) / Number(ethers.formatUnits(finalGoshPool.tokenReserve, 18));
      console.log(`\n💰 GOSH33SH LP Price: ${goshPrice.toExponential(4)} ETH per token`);
      console.log(`💰 GOSH33SH LP Price: $${(goshPrice * 2500).toFixed(6)} USD (assuming ETH = $2500)`);
    }
    
    if (finalJaitPool.active && finalJaitPool.ethReserve > 0) {
      const jaitPrice = Number(ethers.formatEther(finalJaitPool.ethReserve)) / Number(ethers.formatUnits(finalJaitPool.tokenReserve, 18));
      console.log(`💰 JAIT33 LP Price: ${jaitPrice.toExponential(4)} ETH per token`);
      console.log(`💰 JAIT33 LP Price: $${(jaitPrice * 2500).toFixed(6)} USD (assuming ETH = $2500)`);
    }
    
    if (finalGoshPool.active && finalJaitPool.active) {
      console.log("\n🎉 CROSS-TOKEN TRADING ENABLED!");
      console.log("Users can now swap JAITEA ↔ GOSHEESH through the AMM");
      console.log("Frontend will automatically detect live pricing");
    }
    
  } catch (error) {
    console.error("❌ Error verifying pools:", error.message);
  }
  
  console.log("\n🚀 NEXT STEPS:");
  console.log("1. Test the frontend at http://localhost:3000");
  console.log("2. Check for 'Live Price ●' indicators");
  console.log("3. Test cross-token swaps");
  console.log("4. Update Supabase if needed");
}

main()
  .then(() => {
    console.log("\n✅ Liquidity Pool Creation Complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Failed to create liquidity pools:", error);
    process.exit(1);
  });
