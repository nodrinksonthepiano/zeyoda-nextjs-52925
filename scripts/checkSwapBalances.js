const { ethers } = require("hardhat");

// Contract addresses (will be updated after deployment)
const SWAP_CONTRACTS = {
  GOSHEESH_SWAP: "0x63349f5190860b4E954639eeFd60b92bE9A01148",
  JAITEA_SWAP: "0xd01cFF08a9962e67914a3A3e446D90513915db6f"
};

// Will be updated with new token addresses
let TOKEN_ADDRESSES = {
  GOSH33SH: "", // Will be filled from deployment
  JAIT33: ""    // Will be filled from deployment
};

// Load from deployment file if it exists
function loadDeploymentData() {
  const fs = require('fs');
  try {
    const data = JSON.parse(fs.readFileSync('deployments/fresh_tokens_deployment.json', 'utf8'));
    if (data.tokens) {
      TOKEN_ADDRESSES.GOSH33SH = data.tokens.GOSH33SH.address;
      TOKEN_ADDRESSES.JAIT33 = data.tokens.JAIT33.address;
      console.log("✅ Loaded token addresses from deployment file");
    }
  } catch (error) {
    console.log("⚠️ No deployment file found, using manual addresses");
  }
}

async function checkBalances() {
  console.log("🔍 CHECKING SWAP CONTRACT BALANCES");
  console.log("=" * 50);
  
  const [deployer] = await ethers.getSigners();
  console.log("Checking from:", deployer.address);
  
  // ERC20 ABI
  const ERC20_ABI = [
    "function balanceOf(address owner) external view returns (uint256)",
    "function symbol() external view returns (string)",
    "function name() external view returns (string)",
    "function totalSupply() external view returns (uint256)"
  ];
  
  // Load deployment data
  loadDeploymentData();
  
  if (!TOKEN_ADDRESSES.GOSH33SH || !TOKEN_ADDRESSES.JAIT33) {
    console.log("❌ Token addresses not found. Please ensure deployment was successful.");
    console.log("Expected deployment file: deployments/fresh_tokens_deployment.json");
    return;
  }
  
  console.log("\n📍 CONTRACT ADDRESSES:");
  console.log(`GOSH33SH Token: ${TOKEN_ADDRESSES.GOSH33SH}`);
  console.log(`JAIT33 Token: ${TOKEN_ADDRESSES.JAIT33}`);
  console.log(`GOSHEESH Swap: ${SWAP_CONTRACTS.GOSHEESH_SWAP}`);
  console.log(`JAITEA Swap: ${SWAP_CONTRACTS.JAITEA_SWAP}`);
  
  try {
    // Check GOSH33SH
    console.log("\n🟢 GOSH33SH TOKEN BALANCES:");
    const gosh33sh = new ethers.Contract(TOKEN_ADDRESSES.GOSH33SH, ERC20_ABI, deployer);
    
    const goshName = await gosh33sh.name();
    const goshSymbol = await gosh33sh.symbol();
    const goshTotalSupply = await gosh33sh.totalSupply();
    
    console.log(`Name: ${goshName}`);
    console.log(`Symbol: ${goshSymbol}`);
    console.log(`Total Supply: ${ethers.formatUnits(goshTotalSupply, 18)}`);
    
    const goshSwapBalance = await gosh33sh.balanceOf(SWAP_CONTRACTS.GOSHEESH_SWAP);
    const goshTreasuryBalance = await gosh33sh.balanceOf(deployer.address);
    
    console.log(`Swap Contract Balance: ${ethers.formatUnits(goshSwapBalance, 18)}`);
    console.log(`Treasury Balance: ${ethers.formatUnits(goshTreasuryBalance, 18)}`);
    
    // Check JAIT33
    console.log("\n🔵 JAIT33 TOKEN BALANCES:");
    const jait33 = new ethers.Contract(TOKEN_ADDRESSES.JAIT33, ERC20_ABI, deployer);
    
    const jaitName = await jait33.name();
    const jaitSymbol = await jait33.symbol();
    const jaitTotalSupply = await jait33.totalSupply();
    
    console.log(`Name: ${jaitName}`);
    console.log(`Symbol: ${jaitSymbol}`);
    console.log(`Total Supply: ${ethers.formatUnits(jaitTotalSupply, 18)}`);
    
    const jaitSwapBalance = await jait33.balanceOf(SWAP_CONTRACTS.JAITEA_SWAP);
    const jaitTreasuryBalance = await jait33.balanceOf(deployer.address);
    
    console.log(`Swap Contract Balance: ${ethers.formatUnits(jaitSwapBalance, 18)}`);
    console.log(`Treasury Balance: ${ethers.formatUnits(jaitTreasuryBalance, 18)}`);
    
    // Check ETH balances in swap contracts
    console.log("\n💰 ETH BALANCES IN SWAP CONTRACTS:");
    const goshEthBalance = await ethers.provider.getBalance(SWAP_CONTRACTS.GOSHEESH_SWAP);
    const jaitEthBalance = await ethers.provider.getBalance(SWAP_CONTRACTS.JAITEA_SWAP);
    
    console.log(`GOSHEESH Swap ETH: ${ethers.formatEther(goshEthBalance)} ETH`);
    console.log(`JAITEA Swap ETH: ${ethers.formatEther(jaitEthBalance)} ETH`);
    
    // Validation checks
    console.log("\n✅ VALIDATION RESULTS:");
    
    const expectedSwapAmount = ethers.parseUnits("100000000", 18); // 100M
    const expectedTreasuryAmount = ethers.parseUnits("8900000000", 18); // 8.9B
    
    console.log("\nGOSH33SH Validation:");
    console.log(`✅ Swap has 100M tokens: ${goshSwapBalance >= expectedSwapAmount}`);
    console.log(`✅ Treasury has 8.9B tokens: ${goshTreasuryBalance >= expectedTreasuryAmount}`);
    console.log(`✅ Swap has ETH for sells: ${goshEthBalance >= ethers.parseEther("0.005")}`);
    
    console.log("\nJAIT33 Validation:");
    console.log(`✅ Swap has 100M tokens: ${jaitSwapBalance >= expectedSwapAmount}`);
    console.log(`✅ Treasury has 8.9B tokens: ${jaitTreasuryBalance >= expectedTreasuryAmount}`);
    console.log(`✅ Swap has ETH for sells: ${jaitEthBalance >= ethers.parseEther("0.005")}`);
    
    // Overall MVP readiness
    const mvpReady = 
      goshSwapBalance >= expectedSwapAmount &&
      goshTreasuryBalance >= expectedTreasuryAmount &&
      goshEthBalance >= ethers.parseEther("0.005") &&
      jaitSwapBalance >= expectedSwapAmount &&
      jaitTreasuryBalance >= expectedTreasuryAmount &&
      jaitEthBalance >= ethers.parseEther("0.005");
    
    console.log("\n🚀 MVP READINESS STATUS:");
    if (mvpReady) {
      console.log("✅ DAY-0 MVP IS READY FOR TESTING!");
      console.log("✅ All swap contracts properly funded");
      console.log("✅ All allocations correct");
      console.log("✅ Ready for buy/sell operations");
      
      console.log("\n🎯 NEXT STEPS:");
      console.log("1. Update your .env.local with the token addresses above");
      console.log("2. Update Supabase artists table");
      console.log("3. Restart frontend: npm run dev");
      console.log("4. Test buy/sell at: http://localhost:3000/?artist=gosheesh");
      console.log("5. Test buy/sell at: http://localhost:3000/?artist=jaitea");
    } else {
      console.log("❌ MVP NOT READY - Issues found above");
    }
    
  } catch (error) {
    console.error("❌ Error checking balances:", error.message);
  }
}

async function main() {
  await checkBalances();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  }); 