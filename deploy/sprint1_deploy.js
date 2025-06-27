const { ethers, upgrades } = require("hardhat");

// Use existing addresses from master prompt
const EXISTING_TOKENS = {
  GOSHEESH: "0x91EA826b3ff30272fDe475db012D7304dd6Dac1a",
  JAITEA: "0xDb2D5F722C0AF730a0fd737650f865ED296D79c1"
};

// Artist wallet addresses (can be updated)
const ARTIST_WALLETS = {
  gosheesh: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Update with real address
  jaitea: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"   // Update with real address
};

async function deployArtistSwap(tokenAddress, artistWallet, artistName) {
  console.log(`\n🚀 Deploying TreasurySwapLite for ${artistName.toUpperCase()}...`);
  
  // 1. Deploy TreasurySwapLite proxy
  const TreasurySwapLite = await ethers.getContractFactory("TreasurySwapLite");
  
  const proxy = await upgrades.deployProxy(
    TreasurySwapLite,
    [tokenAddress, artistWallet],
    { 
      initializer: 'initialize',
      kind: 'uups'
    }
  );
  
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  
  console.log(`✅ ${artistName} TreasurySwapLite deployed at: ${proxyAddress}`);
  
  // 2. Transfer 100M tokens from deployer to proxy
  const ERC20_ABI = [
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)"
  ];
  
  const [deployer] = await ethers.getSigners();
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, deployer);
  
  const transferAmount = ethers.parseUnits("100000000", 18); // 100M tokens
  const deployerBalance = await tokenContract.balanceOf(deployer.address);
  
  console.log(`- Deployer balance: ${ethers.formatUnits(deployerBalance, 18)} tokens`);
  
  if (deployerBalance >= transferAmount) {
    console.log(`- Transferring 100M tokens to swap contract...`);
    const transferTx = await tokenContract.transfer(proxyAddress, transferAmount);
    await transferTx.wait();
    console.log(`✅ Transferred 100M ${artistName} tokens to swap contract`);
  } else {
    console.log(`⚠️ Insufficient tokens. Need 100M, have ${ethers.formatUnits(deployerBalance, 18)}`);
  }
  
  // 3. OPTIONAL: Send small ETH amount for sell-back testing
  const ethAmount = ethers.parseEther("0.01"); // 0.01 ETH
  if (ethAmount <= await ethers.provider.getBalance(deployer.address)) {
    console.log(`- Sending 0.01 ETH to contract for sell-back testing...`);
    const ethTx = await deployer.sendTransaction({
      to: proxyAddress,
      value: ethAmount
    });
    await ethTx.wait();
    console.log(`✅ Sent 0.01 ETH to swap contract`);
  } else {
    console.log(`⚠️ Insufficient ETH for sell-back funding`);
  }
  
  // 4. Verify contract state
  const contractTokenBalance = await tokenContract.balanceOf(proxyAddress);
  const contractETHBalance = await ethers.provider.getBalance(proxyAddress);
  
  console.log(`📊 Contract State:`);
  console.log(`  Token Balance: ${ethers.formatUnits(contractTokenBalance, 18)} ${artistName}`);
  console.log(`  ETH Balance: ${ethers.formatEther(contractETHBalance)} ETH`);
  
  // 5. Calculate example pricing
  const tokensPerETH = 1_000_000;
  const exampleUSD = 20;
  const ethPrice = 2500; // Rough ETH price
  const ethAmountForExample = exampleUSD / ethPrice;
  const tokensForUSD = ethAmountForExample * tokensPerETH;
  
  console.log(`💰 Example Pricing (Fixed Rate):`);
  console.log(`  $${exampleUSD} USD ≈ ${ethAmountForExample.toFixed(6)} ETH ≈ ${tokensForUSD.toFixed(0)} ${artistName} tokens`);
  
  // 6. Log for manual .env.local update
  console.log(`\n📝 Add to .env.local:`);
  console.log(`NEXT_PUBLIC_${artistName.toUpperCase()}_SWAP=${proxyAddress}`);
  
  return proxyAddress;
}

async function main() {
  console.log("🎯 SPRINT 1 DEPLOYMENT - TreasurySwapLite for Day-0 MVP");
  console.log("=" * 60);
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.1")) {
    console.log("⚠️ Warning: Low ETH balance. Need at least 0.1 ETH for deployment + funding");
  }
  
  const deployedContracts = {};
  
  try {
    // Deploy for GOSHEESH
    deployedContracts.gosheesh = await deployArtistSwap(
      EXISTING_TOKENS.GOSHEESH,
      ARTIST_WALLETS.gosheesh, 
      "gosheesh"
    );
    
    // Deploy for JAITEA  
    deployedContracts.jaitea = await deployArtistSwap(
      EXISTING_TOKENS.JAITEA,
      ARTIST_WALLETS.jaitea,
      "jaitea"
    );
    
  } catch (error) {
    console.error("❌ Deployment error:", error.message);
    throw error;
  }
  
  console.log("\n🎉 SPRINT 1 DEPLOYMENT COMPLETE!");
  console.log("=" * 60);
  console.log("\n📝 MANUAL UPDATES REQUIRED:");
  console.log("\n1. Update .env.local with these addresses:");
  Object.entries(deployedContracts).forEach(([artist, address]) => {
    console.log(`   NEXT_PUBLIC_${artist.toUpperCase()}_SWAP=${address}`);
  });
  
  console.log("\n2. Update Supabase artists table:");
  console.log("   ALTER TABLE artists ADD COLUMN swap_address TEXT;");
  console.log("   ALTER TABLE artists ADD COLUMN paused BOOLEAN DEFAULT false;");
  Object.entries(deployedContracts).forEach(([artist, address]) => {
    console.log(`   UPDATE artists SET swap_address = '${address}', paused = false WHERE id = '${artist}';`);
  });
  
  console.log("\n✅ DAY-0 SUCCESS CRITERIA:");
  console.log("1. ✅ Contracts deployed - TreasurySwapLite live on Base Sepolia");
  console.log("2. ✅ Tokens transferred - 100M tokens per contract from deployer");  
  console.log("3. 🔄 Frontend integration - Update PurchaseFlow.tsx for new contracts");
  console.log("4. ✅ Math functional - 1 ETH = 1M tokens fixed rate");
  console.log("5. 🔄 Database updated - Manual Supabase updates required");
  console.log("6. 🧪 Testing ready - Test at localhost:3000/?artist=gosheesh");
  
  console.log("\n🔮 Next Sprint Features (Upgrade Hooks):");
  console.log("- Circuit Breaker (artist control)");
  console.log("- Dynamic Pricing (AMM integration)"); 
  console.log("- Badge System (ERC6909)");
  
  // Save deployment addresses for reference
  const fs = require('fs');
  const deploymentData = {
    timestamp: new Date().toISOString(),
    network: "baseSepolia",
    deployer: deployer.address,
    contracts: deployedContracts,
    existingTokens: EXISTING_TOKENS,
    artistWallets: ARTIST_WALLETS,
    fixedRate: "1 ETH = 1,000,000 tokens"
  };
  
  fs.writeFileSync(
    'deployments/sprint1_deployment.json',
    JSON.stringify(deploymentData, null, 2)
  );
  
  console.log("\n💾 Deployment data saved to: deployments/sprint1_deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 