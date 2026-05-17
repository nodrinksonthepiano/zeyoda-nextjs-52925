const { ethers } = require("hardhat");

/** Requires `PROTOCOL_VAULT` — no insecure default vault. */

async function main() {
  console.log("🚀 Deploying ArtistTokenUUPS (Manual ERC1967 Proxy) to Base Sepolia...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH\n");

  // Configuration
  const NAME = process.env.TOKEN_NAME || "TESTARTIST";
  const SYMBOL = process.env.TOKEN_SYMBOL || "TESTARTIST";
  const ARTIST_WALLET = process.env.ARTIST_WALLET || deployer.address;
  const PROTOCOL_VAULT = (process.env.PROTOCOL_VAULT || '').trim();
  if (!PROTOCOL_VAULT || !ethers.isAddress(PROTOCOL_VAULT)) {
    throw new Error('Set PROTOCOL_VAULT=0x... explicitly (no insecure default)');
  }

  console.log("⚙️  Configuration:");
  console.log("   Token Name:", NAME);
  console.log("   Symbol:", SYMBOL);
  console.log("   Artist Wallet:", ARTIST_WALLET);
  console.log("   Protocol Vault:", PROTOCOL_VAULT);
  console.log("");

  // Step 1: Deploy implementation
  console.log("📦 Deploying implementation contract...");
  const Token = await ethers.getContractFactory("ArtistTokenUUPS");
  const impl = await Token.deploy();
  await impl.waitForDeployment();
  const implAddress = await impl.getAddress();
  console.log("✅ Implementation deployed at:", implAddress);

  // Step 2: Encode initializer
  console.log("\n🔧 Encoding initializer...");
  const initData = Token.interface.encodeFunctionData("initialize", [
    NAME,
    SYMBOL,
    ARTIST_WALLET,
    PROTOCOL_VAULT
  ]);
  console.log("✅ Initializer encoded");

  // Step 3: Deploy ERC1967Proxy
  console.log("\n🔗 Deploying ERC1967Proxy...");
  const Proxy = await ethers.getContractFactory("ERC1967Proxy");
  const proxy = await Proxy.deploy(implAddress, initData);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log("✅ Proxy deployed at:", proxyAddress);

  // Step 4: Attach Token interface to proxy
  const token = Token.attach(proxyAddress);

  // Step 5: Verify implementation slot
  console.log("\n🔍 Verifying ERC-1967 implementation slot...");
  const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const raw = await ethers.provider.getStorage(proxyAddress, IMPL_SLOT);
  const implFromSlot = ethers.getAddress(ethers.dataSlice(raw, 12));
  
  console.log("   Stored implementation:", implFromSlot);
  console.log("   Expected:", implAddress);
  
  if (implFromSlot.toLowerCase() !== implAddress.toLowerCase()) {
    throw new Error("❌ Implementation slot mismatch!");
  }
  console.log("✅ Implementation slot verified");

  // Step 6: Call initialMint
  console.log("\n⛏️  Calling initialMint()...");
  const mintTx = await token.initialMint();
  const mintReceipt = await mintTx.wait();
  console.log("   Transaction:", mintReceipt.hash);
  console.log("   Status:", mintReceipt.status === 1 ? "Success ✅" : "Failed ❌");
  
  if (mintReceipt.status !== 1) {
    throw new Error("❌ initialMint() transaction failed!");
  }
  console.log("✅ initialMint() executed");

  // Step 7: Verify balances (CRITICAL - must match exactly)
  console.log("\n💰 Verifying token distribution...");
  
  const expectedArtist = ethers.parseUnits("1000000000", 18);   // 1B
  const expectedOwner = ethers.parseUnits("100000000", 18);     // 100M
  const expectedVault = ethers.parseUnits("8900000000", 18);    // 8.9B
  
  const balanceArtist = await token.balanceOf(ARTIST_WALLET);
  const balanceOwner = await token.balanceOf(deployer.address);
  const balanceVault = await token.balanceOf(PROTOCOL_VAULT);
  const totalSupply = await token.totalSupply();
  
  console.log("\n   Artist Wallet:", ethers.formatUnits(balanceArtist, 18));
  console.log("   Expected:      1000000000.0");
  console.log("   Match:", balanceArtist.toString() === expectedArtist.toString() ? "✅" : "❌");
  
  console.log("\n   Owner (LP Seed):", ethers.formatUnits(balanceOwner, 18));
  console.log("   Expected:         100000000.0");
  console.log("   Match:", balanceOwner.toString() === expectedOwner.toString() ? "✅" : "❌");
  
  console.log("\n   Protocol Vault:", ethers.formatUnits(balanceVault, 18));
  console.log("   Expected:       8900000000.0");
  console.log("   Match:", balanceVault.toString() === expectedVault.toString() ? "✅" : "❌");
  
  console.log("\n   Total Supply:", ethers.formatUnits(totalSupply, 18));
  console.log("   Expected:     10000000000.0");
  console.log("   Match:", totalSupply.toString() === ethers.parseUnits("10000000000", 18).toString() ? "✅" : "❌");

  // Step 8: Test pause/unpause
  console.log("\n🔒 Testing pause/unpause...");
  await token.pause();
  console.log("   ✅ Paused");
  
  await token.unpause();
  console.log("   ✅ Unpaused");

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(70));
  console.log("Network:            Base Sepolia");
  console.log("Proxy (USE THIS):  ", proxyAddress);
  console.log("Implementation:    ", implAddress);
  console.log("Token Name:        ", NAME);
  console.log("Symbol:            ", SYMBOL);
  console.log("Artist Wallet:     ", ARTIST_WALLET);
  console.log("Protocol Vault:    ", PROTOCOL_VAULT);
  console.log("Owner (has 100M):  ", deployer.address);
  console.log("=".repeat(70));
  
  console.log("\n📝 Supabase Updates (copy/paste):");
  console.log(`UPDATE artists SET contract = '${proxyAddress}' WHERE id = 'testartist';`);
  console.log(`UPDATE artist_registry SET token = '${proxyAddress}' WHERE id = 'testartist';`);
  
  console.log("\n✅ Sprint 2A Complete! Ready for Sprint 2B (AMM + LP seeding)\n");

  return {
    proxy: proxyAddress,
    implementation: implAddress,
    name: NAME,
    symbol: SYMBOL
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
