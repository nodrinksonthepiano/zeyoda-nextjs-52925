const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 CHECKING MAIN SWAP CONTRACT STATUS");
  console.log("=====================================\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Protocol deployer:", deployer.address);
  
  const MAIN_SWAP_ADDRESS = "0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE";
  const GOSH33SH_TOKEN = "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac";
  const JAIT33_TOKEN = "0x9D06564a8D98e146CAb1dE74BF815bf05d24D685";
  
  // Swap contract ABI
  const swapABI = [
    "function getPool(address token) external view returns (tuple(address token, uint256 tokenReserve, uint256 ethReserve, bool active))",
    "function supportedTokens(uint256) external view returns (address)"
  ];
  
  const swapContract = new ethers.Contract(MAIN_SWAP_ADDRESS, swapABI, deployer);
  
  console.log("📊 MAIN SWAP CONTRACT ANALYSIS:");
  console.log(`Contract Address: ${MAIN_SWAP_ADDRESS}\n`);
  
  // Check GOSH33SH pool
  try {
    const gosheeshPool = await swapContract.getPool(GOSH33SH_TOKEN);
    console.log("🟢 GOSH33SH Pool Status:");
    console.log(`  Token: ${gosheeshPool.token}`);
    console.log(`  Token Reserve: ${ethers.formatUnits(gosheeshPool.tokenReserve, 18)}`);
    console.log(`  ETH Reserve: ${ethers.formatEther(gosheeshPool.ethReserve)}`);
    console.log(`  Active: ${gosheeshPool.active}`);
    
    if (gosheeshPool.active && gosheeshPool.ethReserve > 0) {
      const price = Number(ethers.formatEther(gosheeshPool.ethReserve)) / Number(ethers.formatUnits(gosheeshPool.tokenReserve, 18));
      console.log(`  Price: ${price.toExponential(4)} ETH per token`);
    }
  } catch (error) {
    console.log("🔴 GOSH33SH Pool: Not found or error");
    console.log(`  Error: ${error.message}`);
  }
  
  console.log("");
  
  // Check JAIT33 pool
  try {
    const jaitPool = await swapContract.getPool(JAIT33_TOKEN);
    console.log("🟡 JAIT33 Pool Status:");
    console.log(`  Token: ${jaitPool.token}`);
    console.log(`  Token Reserve: ${ethers.formatUnits(jaitPool.tokenReserve, 18)}`);
    console.log(`  ETH Reserve: ${ethers.formatEther(jaitPool.ethReserve)}`);
    console.log(`  Active: ${jaitPool.active}`);
    
    if (jaitPool.active && jaitPool.ethReserve > 0) {
      const price = Number(ethers.formatEther(jaitPool.ethReserve)) / Number(ethers.formatUnits(jaitPool.tokenReserve, 18));
      console.log(`  Price: ${price.toExponential(4)} ETH per token`);
    }
  } catch (error) {
    console.log("🔴 JAIT33 Pool: Not found or error");
    console.log(`  Error: ${error.message}`);
  }
  
  // Check deployer token balances
  console.log("\n💰 DEPLOYER TOKEN BALANCES:");
  const erc20ABI = [
    "function balanceOf(address owner) external view returns (uint256)"
  ];
  
  const goshContract = new ethers.Contract(GOSH33SH_TOKEN, erc20ABI, deployer);
  const jaitContract = new ethers.Contract(JAIT33_TOKEN, erc20ABI, deployer);
  
  const goshBalance = await goshContract.balanceOf(deployer.address);
  const jaitBalance = await jaitContract.balanceOf(deployer.address);
  
  console.log(`  GOSH33SH: ${ethers.formatUnits(goshBalance, 18)} tokens`);
  console.log(`  JAIT33: ${ethers.formatUnits(jaitBalance, 18)} tokens`);
  
  const ethBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`  ETH: ${ethers.formatEther(ethBalance)} ETH`);
  
  console.log("\n🎯 LIQUIDITY POOL CREATION PLAN:");
  
  if (goshBalance > 0 && jaitBalance > 0 && ethBalance > ethers.parseEther("0.02")) {
    console.log("✅ Ready to create liquidity pools!");
    console.log("  - GOSH33SH: 10M tokens + 0.01 ETH");
    console.log("  - JAIT33: 5M tokens + 0.005 ETH");
    console.log("  - Cross-token swaps will be enabled");
  } else {
    console.log("❌ Insufficient funds for liquidity pool creation");
    console.log(`  Need: 10M+ GOSH33SH, 5M+ JAIT33, 0.02+ ETH`);
    console.log(`  Have: ${ethers.formatUnits(goshBalance, 18)} GOSH33SH, ${ethers.formatUnits(jaitBalance, 18)} JAIT33, ${ethers.formatEther(ethBalance)} ETH`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
