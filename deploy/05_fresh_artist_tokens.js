const { ethers } = require("hardhat");

// Existing swap contract addresses (already deployed)
const SWAP_CONTRACTS = {
  GOSHEESH_SWAP: "0x63349f5190860b4E954639eeFd60b92bE9A01148",
  JAITEA_SWAP: "0xd01cFF08a9962e67914a3A3e446D90513915db6f"
};

// Artist wallet addresses
const ARTIST_WALLETS = {
  gosheesh: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", 
  jaitea: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
};

// Token configurations
const TOKEN_CONFIGS = {
  GOSH33SH: {
    name: "GOSH33SH Token",
    symbol: "GOSH33SH",
    artistWallet: ARTIST_WALLETS.gosheesh,
    swapContract: SWAP_CONTRACTS.GOSHEESH_SWAP
  },
  JAIT33: {
    name: "JAIT33 Token", 
    symbol: "JAIT33",
    artistWallet: ARTIST_WALLETS.jaitea,
    swapContract: SWAP_CONTRACTS.JAITEA_SWAP
  }
};

// Allocation amounts (10B total supply)
const ALLOCATIONS = {
  TOTAL_SUPPLY: ethers.parseUnits("10000000000", 18), // 10B tokens
  ARTIST_AMOUNT: ethers.parseUnits("1000000000", 18),  // 1B tokens
  SWAP_AMOUNT: ethers.parseUnits("100000000", 18),     // 100M tokens  
  TREASURY_AMOUNT: ethers.parseUnits("8900000000", 18) // 8.9B tokens
};

async function deployToken(config) {
  console.log(`\n🚀 Deploying ${config.symbol}...`);
  
  const [deployer] = await ethers.getSigners();
  
  // Deploy the token contract
  const ArtistToken = await ethers.getContractFactory("Artistock");
  const token = await ArtistToken.deploy(
    config.name,
    config.symbol,
    deployer.address // Initial owner is deployer
  );
  
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  
  console.log(`✅ ${config.symbol} deployed at: ${tokenAddress}`);
  
  // Mint total supply to deployer first
  console.log(`🪙 Minting ${ethers.formatUnits(ALLOCATIONS.TOTAL_SUPPLY, 18)} ${config.symbol}...`);
  const mintTx = await token.mint(deployer.address, ALLOCATIONS.TOTAL_SUPPLY);
  await mintTx.wait();
  console.log(`✅ Minted total supply to deployer`);
  
  // Allocate tokens
  console.log(`📤 Allocating tokens...`);
  
  // 1. Transfer to artist wallet
  if (ALLOCATIONS.ARTIST_AMOUNT > 0) {
    const artistTx = await token.transfer(config.artistWallet, ALLOCATIONS.ARTIST_AMOUNT);
    await artistTx.wait();
    console.log(`✅ Sent ${ethers.formatUnits(ALLOCATIONS.ARTIST_AMOUNT, 18)} to artist (${config.artistWallet})`);
  }
  
  // 2. Transfer to swap contract
  if (ALLOCATIONS.SWAP_AMOUNT > 0) {
    const swapTx = await token.transfer(config.swapContract, ALLOCATIONS.SWAP_AMOUNT);
    await swapTx.wait();
    console.log(`✅ Sent ${ethers.formatUnits(ALLOCATIONS.SWAP_AMOUNT, 18)} to swap contract (${config.swapContract})`);
  }
  
  // 3. Treasury amount remains with deployer (8.9B)
  console.log(`✅ Treasury amount (${ethers.formatUnits(ALLOCATIONS.TREASURY_AMOUNT, 18)}) remains with deployer`);
  
  // Verify allocations
  console.log(`\n🔍 Verifying ${config.symbol} allocations:`);
  const artistBalance = await token.balanceOf(config.artistWallet);
  const swapBalance = await token.balanceOf(config.swapContract);
  const treasuryBalance = await token.balanceOf(deployer.address);
  
  console.log(`Artist wallet: ${ethers.formatUnits(artistBalance, 18)}`);
  console.log(`Swap contract: ${ethers.formatUnits(swapBalance, 18)}`);
  console.log(`Treasury wallet: ${ethers.formatUnits(treasuryBalance, 18)}`);
  
  const totalAllocated = artistBalance + swapBalance + treasuryBalance;
  console.log(`Total allocated: ${ethers.formatUnits(totalAllocated, 18)}`);
  
  if (totalAllocated === ALLOCATIONS.TOTAL_SUPPLY) {
    console.log(`✅ Allocation verified!`);
  } else {
    console.log(`❌ Allocation mismatch!`);
  }
  
  return {
    address: tokenAddress,
    symbol: config.symbol,
    allocations: {
      artist: ethers.formatUnits(artistBalance, 18),
      swap: ethers.formatUnits(swapBalance, 18),
      treasury: ethers.formatUnits(treasuryBalance, 18)
    }
  };
}

async function main() {
  console.log("🎯 DEPLOYING FRESH ARTIST TOKENS FOR DAY-0 MVP");
  console.log("=" * 60);
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer ETH balance:", ethers.formatEther(balance));
  
  if (balance < ethers.parseEther("0.05")) {
    console.log("⚠️ Warning: Low ETH balance. Need at least 0.05 ETH for deployment");
  }
  
  console.log("\n📋 ALLOCATION PLAN:");
  console.log(`Total Supply: ${ethers.formatUnits(ALLOCATIONS.TOTAL_SUPPLY, 18)} tokens`);
  console.log(`Artist: ${ethers.formatUnits(ALLOCATIONS.ARTIST_AMOUNT, 18)} (10%)`);
  console.log(`Swap Contract: ${ethers.formatUnits(ALLOCATIONS.SWAP_AMOUNT, 18)} (1%)`);
  console.log(`Treasury: ${ethers.formatUnits(ALLOCATIONS.TREASURY_AMOUNT, 18)} (89%)`);
  
  const results = {};
  
  try {
    // Deploy GOSH33SH
    results.GOSH33SH = await deployToken(TOKEN_CONFIGS.GOSH33SH);
    
    // Deploy JAIT33
    results.JAIT33 = await deployToken(TOKEN_CONFIGS.JAIT33);
    
  } catch (error) {
    console.error("❌ Deployment error:", error.message);
    throw error;
  }
  
  // Final summary
  console.log("\n🎉 DEPLOYMENT COMPLETE!");
  console.log("=" * 40);
  
  Object.entries(results).forEach(([symbol, result]) => {
    console.log(`\n${symbol}:`);
    console.log(`  Address: ${result.address}`);
    console.log(`  Artist: ${result.allocations.artist} tokens`);
    console.log(`  Swap: ${result.allocations.swap} tokens`);
    console.log(`  Treasury: ${result.allocations.treasury} tokens`);
  });
  
  console.log("\n📝 NEXT STEPS:");
  console.log("\n1. Update .env.local:");
  console.log(`   NEXT_PUBLIC_GOSH33SH_TOKEN=${results.GOSH33SH.address}`);
  console.log(`   NEXT_PUBLIC_JAIT33_TOKEN=${results.JAIT33.address}`);
  
  console.log("\n2. Update Supabase artists table:");
  console.log(`   UPDATE artists SET contract = '${results.GOSH33SH.address}' WHERE id = 'gosheesh';`);
  console.log(`   UPDATE artists SET contract = '${results.JAIT33.address}' WHERE id = 'jaitea';`);
  
  console.log("\n3. Test frontend:");
  console.log("   npm run dev");
  console.log("   Visit: http://localhost:3000/?artist=gosheesh");
  console.log("   Visit: http://localhost:3000/?artist=jaitea");
  
  console.log("\n4. Run final verification:");
  console.log("   npx hardhat run scripts/testSwapFunctionality.js --network baseSepolia");
  
  // Save deployment data
  const fs = require('fs');
  const deploymentData = {
    timestamp: new Date().toISOString(),
    network: "baseSepolia",
    deployer: deployer.address,
    tokens: results,
    swapContracts: SWAP_CONTRACTS,
    artistWallets: ARTIST_WALLETS,
    allocations: {
      totalSupply: ethers.formatUnits(ALLOCATIONS.TOTAL_SUPPLY, 18),
      artist: ethers.formatUnits(ALLOCATIONS.ARTIST_AMOUNT, 18),
      swap: ethers.formatUnits(ALLOCATIONS.SWAP_AMOUNT, 18),
      treasury: ethers.formatUnits(ALLOCATIONS.TREASURY_AMOUNT, 18)
    }
  };
  
  fs.writeFileSync(
    'deployments/fresh_tokens_deployment.json', 
    JSON.stringify(deploymentData, null, 2)
  );
  
  console.log("\n💾 Deployment data saved to: deployments/fresh_tokens_deployment.json");
  
  console.log("\n🚀 DAY-0 MVP STATUS:");
  console.log("✅ Fresh tokens deployed with proper allocations");
  console.log("✅ Swap contracts pre-funded with 100M tokens each");
  console.log("✅ Artist wallets have 1B tokens each");
  console.log("✅ Treasury controls 8.9B tokens each");
  console.log("✅ Ready for immediate testing!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  }); 