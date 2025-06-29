const { ethers } = require("hardhat");

// Contract addresses 
const CONTRACTS = {
  GOSHEESH_TOKEN: "0x91EA826b3ff30272fDe475db012D7304dd6Dac1a",
  JAITEA_TOKEN: "0xDb2D5F722C0AF730a0fd737650f865ED296D79c1"
};

// Known artist wallet addresses (from deployment script)
const ARTIST_WALLETS = {
  gosheesh: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", 
  jaitea: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
};

async function main() {
  console.log("🎨 CHECKING ARTIST WALLET BALANCES");
  console.log("=" * 50);
  
  const [deployer] = await ethers.getSigners();
  console.log("Checking from:", deployer.address);
  
  // ERC20 ABI for checking balances
  const ERC20_ABI = [
    "function balanceOf(address owner) external view returns (uint256)",
    "function symbol() external view returns (string)",
    "function totalSupply() external view returns (uint256)",
    "function owner() external view returns (address)"
  ];
  
  // Get token contracts
  const gosheeshToken = new ethers.Contract(CONTRACTS.GOSHEESH_TOKEN, ERC20_ABI, deployer);
  const jaiteaToken = new ethers.Contract(CONTRACTS.JAITEA_TOKEN, ERC20_ABI, deployer);
  
  console.log("\n📊 TOKEN INFO:");
  const gosheeshSymbol = await gosheeshToken.symbol();
  const jaiteaSymbol = await jaiteaToken.symbol();
  const gosheeshSupply = await gosheeshToken.totalSupply();
  const jaiteaSupply = await jaiteaToken.totalSupply();
  
  console.log(`${gosheeshSymbol} - Total Supply:`, ethers.formatUnits(gosheeshSupply, 18));
  console.log(`${jaiteaSymbol} - Total Supply:`, ethers.formatUnits(jaiteaSupply, 18));
  
  console.log("\n🎨 ARTIST WALLET BALANCES:");
  
  // Check GOSHEESH artist wallet
  const gosheeshArtistBalance = await gosheeshToken.balanceOf(ARTIST_WALLETS.gosheesh);
  const gosheeshArtistEth = await ethers.provider.getBalance(ARTIST_WALLETS.gosheesh);
  
  console.log(`\nGOSHEESH Artist (${ARTIST_WALLETS.gosheesh}):`);
  console.log(`  ${gosheeshSymbol} tokens:`, ethers.formatUnits(gosheeshArtistBalance, 18));
  console.log(`  ETH:`, ethers.formatEther(gosheeshArtistEth));
  
  // Check JAITEA artist wallet  
  const jaiteaArtistBalance = await jaiteaToken.balanceOf(ARTIST_WALLETS.jaitea);
  const jaiteaArtistEth = await ethers.provider.getBalance(ARTIST_WALLETS.jaitea);
  
  console.log(`\nJAITEA Artist (${ARTIST_WALLETS.jaitea}):`);
  console.log(`  ${jaiteaSymbol} tokens:`, ethers.formatUnits(jaiteaArtistBalance, 18));
  console.log(`  ETH:`, ethers.formatEther(jaiteaArtistEth));
  
  // Cross-check: see if artists have each other's tokens
  const gosheeshJaiteaBalance = await jaiteaToken.balanceOf(ARTIST_WALLETS.gosheesh);
  const jaiteaGosheeshBalance = await gosheeshToken.balanceOf(ARTIST_WALLETS.jaitea);
  
  if (gosheeshJaiteaBalance > 0) {
    console.log(`\nCross-holdings - GOSHEESH artist has ${jaiteaSymbol}:`, ethers.formatUnits(gosheeshJaiteaBalance, 18));
  }
  if (jaiteaGosheeshBalance > 0) {
    console.log(`Cross-holdings - JAITEA artist has ${gosheeshSymbol}:`, ethers.formatUnits(jaiteaGosheeshBalance, 18));
  }
  
  // Check deployer balances too
  console.log(`\n🚀 DEPLOYER WALLET (${deployer.address}):`);
  const deployerGosheesh = await gosheeshToken.balanceOf(deployer.address);
  const deployerJaitea = await jaiteaToken.balanceOf(deployer.address);
  
  console.log(`  ${gosheeshSymbol} tokens:`, ethers.formatUnits(deployerGosheesh, 18));
  console.log(`  ${jaiteaSymbol} tokens:`, ethers.formatUnits(deployerJaitea, 18));
  
  // Provide recommendations
  console.log("\n💡 RECOMMENDATIONS:");
  
  if (gosheeshArtistBalance >= ethers.parseUnits("1000000", 18)) {
    console.log("✅ GOSHEESH artist has enough tokens for seeding");
  } else {
    console.log("❌ GOSHEESH artist needs more tokens");
  }
  
  if (jaiteaArtistBalance >= ethers.parseUnits("1000000", 18)) {
    console.log("✅ JAITEA artist has enough tokens for seeding");
  } else {
    console.log("❌ JAITEA artist needs more tokens");
  }
  
  console.log("\n🔧 NEXT STEPS:");
  console.log("Option 1: Use artist private keys directly in .env.local");
  console.log("Option 2: Transfer tokens from artist wallets to deployer wallet");
  console.log("Option 3: Check if tokens are in different Magic Link addresses");
  
  // Look for large token holders
  console.log("\n🔍 TOKEN DISTRIBUTION ANALYSIS:");
  
  // Calculate unaccounted tokens
  const totalAccountedGosheesh = gosheeshArtistBalance + deployerGosheesh;
  const totalAccountedJaitea = jaiteaArtistBalance + deployerJaitea; 
  
  const unaccountedGosheesh = gosheeshSupply - totalAccountedGosheesh;
  const unaccountedJaitea = jaiteaSupply - totalAccountedJaitea;
  
  console.log(`${gosheeshSymbol} unaccounted:`, ethers.formatUnits(unaccountedGosheesh, 18));
  console.log(`${jaiteaSymbol} unaccounted:`, ethers.formatUnits(unaccountedJaitea, 18));
  
  if (unaccountedGosheesh > ethers.parseUnits("1000000", 18)) {
    console.log("🔍 Large amount of GOSHEESH tokens are in unknown wallets");
  }
  if (unaccountedJaitea > ethers.parseUnits("1000000", 18)) {
    console.log("🔍 Large amount of JAITEA tokens are in unknown wallets");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  }); 