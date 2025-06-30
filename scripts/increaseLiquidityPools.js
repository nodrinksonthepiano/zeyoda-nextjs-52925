const { ethers } = require("hardhat");

async function main() {
  console.log("🏊 INCREASING LIQUIDITY POOL SIZES (100x)");
  console.log("=========================================\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Protocol deployer:", deployer.address);
  
  const NEW_SWAP_ADDRESS = "0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE";
  const GOSH33SH_TOKEN = "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac";
  const JAIT33_TOKEN = "0x9D06564a8D98e146CAb1dE74BF815bf05d24D685";
  
  const swapABI = [
    "function addLiquidity(address token, uint256 tokenAmount) external payable"
  ];
  
  const erc20ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address owner) external view returns (uint256)"
  ];
  
  const swapContract = new ethers.Contract(NEW_SWAP_ADDRESS, swapABI, deployer);
  const goshContract = new ethers.Contract(GOSH33SH_TOKEN, erc20ABI, deployer);
  const jaitContract = new ethers.Contract(JAIT33_TOKEN, erc20ABI, deployer);
  
  // Check balances
  const goshBalance = await goshContract.balanceOf(deployer.address);
  const jaitBalance = await jaitContract.balanceOf(deployer.address);
  const ethBalance = await ethers.provider.getBalance(deployer.address);
  
  console.log("💰 CURRENT BALANCES:");
  console.log(`  GOSH33SH: ${ethers.formatUnits(goshBalance, 18)} tokens`);
  console.log(`  JAIT33: ${ethers.formatUnits(jaitBalance, 18)} tokens`);
  console.log(`  ETH: ${ethers.formatEther(ethBalance)} ETH\n`);
  
  // New liquidity amounts (100x bigger)
  const GOSH_ADD_TOKENS = ethers.parseUnits("1000000000", 18);  // 1B tokens
  const GOSH_ADD_ETH = ethers.parseEther("1.0");                // 1 ETH
  
  const JAIT_ADD_TOKENS = ethers.parseUnits("500000000", 18);   // 500M tokens
  const JAIT_ADD_ETH = ethers.parseEther("0.5");                // 0.5 ETH
  
  console.log("🎯 LIQUIDITY ADDITION PLAN:");
  console.log(`  GOSH33SH: +${ethers.formatUnits(GOSH_ADD_TOKENS, 18)} tokens + ${ethers.formatEther(GOSH_ADD_ETH)} ETH`);
  console.log(`  JAIT33: +${ethers.formatUnits(JAIT_ADD_TOKENS, 18)} tokens + ${ethers.formatEther(JAIT_ADD_ETH)} ETH\n`);
  
  // Check if we have enough
  if (goshBalance < GOSH_ADD_TOKENS) {
    console.log(`❌ Insufficient GOSH33SH. Need: ${ethers.formatUnits(GOSH_ADD_TOKENS, 18)}, Have: ${ethers.formatUnits(goshBalance, 18)}`);
    return;
  }
  
  if (jaitBalance < JAIT_ADD_TOKENS) {
    console.log(`❌ Insufficient JAIT33. Need: ${ethers.formatUnits(JAIT_ADD_TOKENS, 18)}, Have: ${ethers.formatUnits(jaitBalance, 18)}`);
    return;
  }
  
  if (ethBalance < GOSH_ADD_ETH + JAIT_ADD_ETH + ethers.parseEther("0.01")) {
    console.log(`❌ Insufficient ETH. Need: ${ethers.formatEther(GOSH_ADD_ETH + JAIT_ADD_ETH + ethers.parseEther("0.01"))}, Have: ${ethers.formatEther(ethBalance)}`);
    return;
  }
  
  // Add to GOSH33SH Pool
  console.log("🟢 ADDING TO GOSH33SH POOL...");
  
  try {
    console.log("- Approving GOSH33SH tokens...");
    const goshApprove = await goshContract.approve(NEW_SWAP_ADDRESS, GOSH_ADD_TOKENS);
    await goshApprove.wait();
    console.log("✅ GOSH33SH tokens approved");
    
    console.log("- Adding liquidity to GOSH33SH pool...");
    const goshTx = await swapContract.addLiquidity(GOSH33SH_TOKEN, GOSH_ADD_TOKENS, {
      value: GOSH_ADD_ETH,
      gasLimit: 500000
    });
    
    console.log(`- Transaction: ${goshTx.hash}`);
    await goshTx.wait();
    console.log("✅ GOSH33SH liquidity added successfully!");
    
  } catch (error) {
    console.error("❌ Error adding GOSH33SH liquidity:", error.message);
  }
  
  console.log("");
  
  // Add to JAIT33 Pool
  console.log("🟡 ADDING TO JAIT33 POOL...");
  
  try {
    console.log("- Approving JAIT33 tokens...");
    const jaitApprove = await jaitContract.approve(NEW_SWAP_ADDRESS, JAIT_ADD_TOKENS);
    await jaitApprove.wait();
    console.log("✅ JAIT33 tokens approved");
    
    console.log("- Adding liquidity to JAIT33 pool...");
    const jaitTx = await swapContract.addLiquidity(JAIT33_TOKEN, JAIT_ADD_TOKENS, {
      value: JAIT_ADD_ETH,
      gasLimit: 500000
    });
    
    console.log(`- Transaction: ${jaitTx.hash}`);
    await jaitTx.wait();
    console.log("✅ JAIT33 liquidity added successfully!");
    
  } catch (error) {
    console.error("❌ Error adding JAIT33 liquidity:", error.message);
  }
  
  console.log("\n🎉 LIQUIDITY POOLS MASSIVELY INCREASED!");
  console.log("Cross-token swaps should now work with reasonable slippage");
}

main()
  .then(() => {
    console.log("\n✅ Liquidity pools increased 100x!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Failed to increase liquidity:", error);
    process.exit(1);
  });
