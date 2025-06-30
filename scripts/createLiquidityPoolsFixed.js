const { ethers } = require("hardhat");

async function main() {
  console.log("🏊 CREATING JAITEA-GOSHEESH LIQUIDITY POOLS (FIXED)");
  console.log("==================================================\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Protocol deployer:", deployer.address);
  
  // NEW CONTRACT ADDRESSES
  const NEW_SWAP_ADDRESS = "0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE";
  const GOSH33SH_TOKEN = "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac";
  const JAIT33_TOKEN = "0x9D06564a8D98e146CAb1dE74BF815bf05d24D685";
  
  // Get contract instances
  const swapABI = [
    "function owner() external view returns (address)",
    "function createPool(address token, uint256 tokenAmount) external payable",
    "function getPool(address token) external view returns (tuple(address token, uint256 tokenReserve, uint256 ethReserve, bool active))",
    "event PoolCreated(address indexed token, uint256 tokenAmount, uint256 ethAmount)"
  ];
  
  const erc20ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function symbol() external view returns (string)"
  ];
  
  const swapContract = new ethers.Contract(NEW_SWAP_ADDRESS, swapABI, deployer);
  const goshContract = new ethers.Contract(GOSH33SH_TOKEN, erc20ABI, deployer);
  const jaitContract = new ethers.Contract(JAIT33_TOKEN, erc20ABI, deployer);
  
  // Verify ownership
  const owner = await swapContract.owner();
  console.log(`✅ Swap contract owner: ${owner}`);
  console.log(`✅ Is deployer owner: ${owner === deployer.address}`);
  
  // Check balances
  const goshBalance = await goshContract.balanceOf(deployer.address);
  const jaitBalance = await jaitContract.balanceOf(deployer.address);
  const ethBalance = await ethers.provider.getBalance(deployer.address);
  
  console.log("\n💰 CURRENT BALANCES:");
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
  
  // Create GOSH33SH Pool
  console.log("🟢 CREATING GOSH33SH LIQUIDITY POOL...");
  
  try {
    console.log("- Approving GOSH33SH tokens...");
    const goshApprove = await goshContract.approve(NEW_SWAP_ADDRESS, GOSH_LP_TOKENS);
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
    
  } catch (error) {
    console.error("❌ Error creating GOSH33SH pool:", error.message);
    return;
  }
  
  console.log("");
  
  // Create JAIT33 Pool
  console.log("🟡 CREATING JAIT33 LIQUIDITY POOL...");
  
  try {
    console.log("- Approving JAIT33 tokens...");
    const jaitApprove = await jaitContract.approve(NEW_SWAP_ADDRESS, JAIT_LP_TOKENS);
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
    
  } catch (error) {
    console.error("❌ Error creating JAIT33 pool:", error.message);
    return;
  }
  
  // Verify pools
  console.log("\n🔍 VERIFYING LIQUIDITY POOLS...");
  
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
    console.log(`💰 GOSH33SH LP Price: $${(goshPrice * 2500).toFixed(6)} USD per token`);
  }
  
  if (finalJaitPool.active && finalJaitPool.ethReserve > 0) {
    const jaitPrice = Number(ethers.formatEther(finalJaitPool.ethReserve)) / Number(ethers.formatUnits(finalJaitPool.tokenReserve, 18));
    console.log(`💰 JAIT33 LP Price: ${jaitPrice.toExponential(4)} ETH per token`);
    console.log(`💰 JAIT33 LP Price: $${(jaitPrice * 2500).toFixed(6)} USD per token`);
  }
  
  if (finalGoshPool.active && finalJaitPool.active) {
    console.log("\n🎉 CROSS-TOKEN TRADING ENABLED!");
    console.log("✅ JAITEA ↔ GOSHEESH swaps now available");
    console.log("✅ Frontend will show live pricing");
    console.log("✅ AMM-based token trading active");
  }
  
  console.log("\n🚀 NEXT STEPS:");
  console.log("1. Test the frontend at http://localhost:3000");
  console.log("2. Look for 'Live Price ●' indicators");
  console.log("3. Test cross-token swapping");
  console.log("4. Verify pricing updates every 30 seconds");
  
  console.log("\n📊 DEPLOYMENT SUMMARY:");
  console.log(`New Swap Contract: ${NEW_SWAP_ADDRESS}`);
  console.log(`GOSH33SH Pool: ${finalGoshPool.active ? 'Active' : 'Inactive'}`);
  console.log(`JAIT33 Pool: ${finalJaitPool.active ? 'Active' : 'Inactive'}`);
}

main()
  .then(() => {
    console.log("\n✅ JAITEA-GOSHEESH LIQUIDITY POOLS CREATED!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Failed to create liquidity pools:", error);
    process.exit(1);
  });
