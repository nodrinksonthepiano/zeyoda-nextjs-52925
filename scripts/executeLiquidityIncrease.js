const { ethers } = require("hardhat");

async function main() {
  console.log("🏊 EXECUTING LIQUIDITY INCREASE (3x)");
  console.log("===================================\n");
  
  const [deployer] = await ethers.getSigners();
  
  const NEW_SWAP_ADDRESS = "0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE";
  const GOSH33SH_TOKEN = "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac";
  const JAIT33_TOKEN = "0x9D06564a8D98e146CAb1dE74BF815bf05d24D685";
  
  const swapABI = [
    "function addLiquidity(address token, uint256 tokenAmount) external payable",
    "function getPool(address token) external view returns (tuple(address token, uint256 tokenReserve, uint256 ethReserve, bool active))"
  ];
  
  const erc20ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address owner) external view returns (uint256)"
  ];
  
  const swapContract = new ethers.Contract(NEW_SWAP_ADDRESS, swapABI, deployer);
  const goshContract = new ethers.Contract(GOSH33SH_TOKEN, erc20ABI, deployer);
  const jaitContract = new ethers.Contract(JAIT33_TOKEN, erc20ABI, deployer);
  
  // Check current pools
  const goshPoolBefore = await swapContract.getPool(GOSH33SH_TOKEN);
  const jaitPoolBefore = await swapContract.getPool(JAIT33_TOKEN);
  
  console.log("📊 BEFORE LIQUIDITY INCREASE:");
  console.log(`GOSH33SH: ${ethers.formatUnits(goshPoolBefore.tokenReserve, 18)} tokens, ${ethers.formatEther(goshPoolBefore.ethReserve)} ETH`);
  console.log(`JAIT33: ${ethers.formatUnits(jaitPoolBefore.tokenReserve, 18)} tokens, ${ethers.formatEther(jaitPoolBefore.ethReserve)} ETH\n`);
  
  // Conservative increase (3x) to stay within budget
  const GOSH_ADD_TOKENS = ethers.parseUnits("30000000", 18);  // 30M tokens (3x current 10M)
  const GOSH_ADD_ETH = ethers.parseEther("0.003");            // 0.003 ETH (3x current 0.01 ratio)
  
  const JAIT_ADD_TOKENS = ethers.parseUnits("15000000", 18);  // 15M tokens (3x current 5M)
  const JAIT_ADD_ETH = ethers.parseEther("0.0015");           // 0.0015 ETH (3x current 0.005 ratio)
  
  console.log("🎯 CONSERVATIVE INCREASE PLAN (3x):");
  console.log(`  GOSH33SH: +${ethers.formatUnits(GOSH_ADD_TOKENS, 18)} tokens + ${ethers.formatEther(GOSH_ADD_ETH)} ETH`);
  console.log(`  JAIT33: +${ethers.formatUnits(JAIT_ADD_TOKENS, 18)} tokens + ${ethers.formatEther(JAIT_ADD_ETH)} ETH`);
  console.log(`  Total ETH needed: ${ethers.formatEther(GOSH_ADD_ETH + JAIT_ADD_ETH)} ETH\n`);
  
  try {
    // Add to GOSH33SH Pool
    console.log("🟢 ADDING TO GOSH33SH POOL...");
    console.log("- Approving tokens...");
    const goshApprove = await goshContract.approve(NEW_SWAP_ADDRESS, GOSH_ADD_TOKENS);
    await goshApprove.wait();
    console.log("✅ Tokens approved");
    
    console.log("- Adding liquidity...");
    const goshTx = await swapContract.addLiquidity(GOSH33SH_TOKEN, GOSH_ADD_TOKENS, {
      value: GOSH_ADD_ETH,
      gasLimit: 500000
    });
    
    console.log(`- Transaction: ${goshTx.hash}`);
    await goshTx.wait();
    console.log("✅ GOSH33SH liquidity added!");
    
    // Add to JAIT33 Pool
    console.log("\n🟡 ADDING TO JAIT33 POOL...");
    console.log("- Approving tokens...");
    const jaitApprove = await jaitContract.approve(NEW_SWAP_ADDRESS, JAIT_ADD_TOKENS);
    await jaitApprove.wait();
    console.log("✅ Tokens approved");
    
    console.log("- Adding liquidity...");
    const jaitTx = await swapContract.addLiquidity(JAIT33_TOKEN, JAIT_ADD_TOKENS, {
      value: JAIT_ADD_ETH,
      gasLimit: 500000
    });
    
    console.log(`- Transaction: ${jaitTx.hash}`);
    await jaitTx.wait();
    console.log("✅ JAIT33 liquidity added!");
    
    // Check new pools
    console.log("\n📊 AFTER LIQUIDITY INCREASE:");
    const goshPoolAfter = await swapContract.getPool(GOSH33SH_TOKEN);
    const jaitPoolAfter = await swapContract.getPool(JAIT33_TOKEN);
    
    console.log(`GOSH33SH: ${ethers.formatUnits(goshPoolAfter.tokenReserve, 18)} tokens, ${ethers.formatEther(goshPoolAfter.ethReserve)} ETH`);
    console.log(`JAIT33: ${ethers.formatUnits(jaitPoolAfter.tokenReserve, 18)} tokens, ${ethers.formatEther(jaitPoolAfter.ethReserve)} ETH`);
    
    // Calculate improvement
    const goshImprovement = Number(ethers.formatUnits(goshPoolAfter.tokenReserve, 18)) / Number(ethers.formatUnits(goshPoolBefore.tokenReserve, 18));
    const jaitImprovement = Number(ethers.formatUnits(jaitPoolAfter.tokenReserve, 18)) / Number(ethers.formatUnits(jaitPoolBefore.tokenReserve, 18));
    
    console.log(`\n🎉 LIQUIDITY IMPROVEMENTS:`);
    console.log(`GOSH33SH pool: ${goshImprovement.toFixed(1)}x larger`);
    console.log(`JAIT33 pool: ${jaitImprovement.toFixed(1)}x larger`);
    console.log(`Cross-token swaps should have less slippage now!`);
    
  } catch (error) {
    console.error("❌ Error adding liquidity:", error.message);
  }
}

main()
  .then(() => {
    console.log("\n✅ Liquidity increase executed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
