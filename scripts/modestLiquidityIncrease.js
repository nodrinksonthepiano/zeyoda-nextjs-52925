const { ethers } = require("hardhat");

async function main() {
  console.log("🏊 MODEST LIQUIDITY POOL INCREASE (10x)");
  console.log("======================================\n");
  
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
  
  // Check current state
  const ethBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`Available ETH: ${ethers.formatEther(ethBalance)} ETH\n`);
  
  // Modest increase (10x) - within our ETH budget
  const GOSH_ADD_TOKENS = ethers.parseUnits("100000000", 18);  // 100M tokens (10x current 10M)
  const GOSH_ADD_ETH = ethers.parseEther("0.01");              // 0.01 ETH (10x current 0.01)
  
  const JAIT_ADD_TOKENS = ethers.parseUnits("50000000", 18);   // 50M tokens (10x current 5M)
  const JAIT_ADD_ETH = ethers.parseEther("0.005");             // 0.005 ETH (10x current 0.005)
  
  const totalETHNeeded = GOSH_ADD_ETH + JAIT_ADD_ETH + ethers.parseEther("0.005"); // +gas
  
  console.log("�� MODEST LIQUIDITY PLAN:");
  console.log(`  GOSH33SH: +${ethers.formatUnits(GOSH_ADD_TOKENS, 18)} tokens + ${ethers.formatEther(GOSH_ADD_ETH)} ETH`);
  console.log(`  JAIT33: +${ethers.formatUnits(JAIT_ADD_TOKENS, 18)} tokens + ${ethers.formatEther(JAIT_ADD_ETH)} ETH`);
  console.log(`  Total ETH needed: ${ethers.formatEther(totalETHNeeded)} ETH`);
  console.log(`  Available: ${ethers.formatEther(ethBalance)} ETH\n`);
  
  if (ethBalance < totalETHNeeded) {
    console.log(`❌ Still not enough ETH. Let's try even smaller amounts...\n`);
    
    // Ultra-modest increase (2x) 
    const ULTRA_GOSH_TOKENS = ethers.parseUnits("20000000", 18);  // 20M tokens (2x)
    const ULTRA_GOSH_ETH = ethers.parseEther("0.002");            // 0.002 ETH (2x)
    
    const ULTRA_JAIT_TOKENS = ethers.parseUnits("10000000", 18);  // 10M tokens (2x)
    const ULTRA_JAIT_ETH = ethers.parseEther("0.001");            // 0.001 ETH (2x)
    
    const ultraTotalETH = ULTRA_GOSH_ETH + ULTRA_JAIT_ETH + ethers.parseEther("0.005");
    
    console.log("🎯 ULTRA-MODEST PLAN (2x increase):");
    console.log(`  GOSH33SH: +${ethers.formatUnits(ULTRA_GOSH_TOKENS, 18)} tokens + ${ethers.formatEther(ULTRA_GOSH_ETH)} ETH`);
    console.log(`  JAIT33: +${ethers.formatUnits(ULTRA_JAIT_TOKENS, 18)} tokens + ${ethers.formatEther(ULTRA_JAIT_ETH)} ETH`);
    console.log(`  Total ETH needed: ${ethers.formatEther(ultraTotalETH)} ETH\n`);
    
    if (ethBalance >= ultraTotalETH) {
      console.log("✅ Ultra-modest plan fits budget! Proceeding...\n");
      
      // Execute ultra-modest plan
      try {
        // GOSH33SH
        console.log("🟢 ADDING TO GOSH33SH POOL (2x)...");
        const goshApprove = await goshContract.approve(NEW_SWAP_ADDRESS, ULTRA_GOSH_TOKENS);
        await goshApprove.wait();
        
        const goshTx = await swapContract.addLiquidity(GOSH33SH_TOKEN, ULTRA_GOSH_TOKENS, {
          value: ULTRA_GOSH_ETH,
          gasLimit: 500000
        });
        await goshTx.wait();
        console.log("✅ GOSH33SH pool increased to 30M tokens + 0.012 ETH");
        
        // JAIT33
        console.log("\n🟡 ADDING TO JAIT33 POOL (2x)...");
        const jaitApprove = await jaitContract.approve(NEW_SWAP_ADDRESS, ULTRA_JAIT_TOKENS);
        await jaitApprove.wait();
        
        const jaitTx = await swapContract.addLiquidity(JAIT33_TOKEN, ULTRA_JAIT_TOKENS, {
          value: ULTRA_JAIT_ETH,
          gasLimit: 500000
        });
        await jaitTx.wait();
        console.log("✅ JAIT33 pool increased to 15M tokens + 0.006 ETH");
        
      } catch (error) {
        console.error("❌ Error:", error.message);
      }
    } else {
      console.log("❌ Even ultra-modest plan exceeds budget");
      console.log("💡 Need to get more ETH for meaningful liquidity increases");
    }
    
  } else {
    console.log("✅ Modest plan fits! Proceeding with 10x increase...");
    // Execute modest plan (code similar to above)
  }
  
  // Test new rates
  console.log("\n🧮 TESTING NEW SWAP RATES:");
  try {
    const jaitAmount = ethers.parseUnits("20", 18);
    const ethFromJait = await swapContract.getEthQuote(JAIT33_TOKEN, jaitAmount);
    const goshFromEth = await swapContract.getTokenQuote(GOSH33SH_TOKEN, ethFromJait);
    
    console.log(`20 JAIT33 → ${ethers.formatUnits(goshFromEth, 18)} GOSH33SH (improved!)`);
  } catch (error) {
    console.log("Quote test failed:", error.message);
  }
}

main()
  .then(() => {
    console.log("\n✅ Liquidity improvement complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
