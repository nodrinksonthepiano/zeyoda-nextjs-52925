const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying ArtistDownloadsUUPS (Manual ERC1967 Proxy) to Base Sepolia...\n");

  const [deployer] = await ethers.getSigners();
  const ownerAddr = process.env.DOWNLOADS_OWNER || deployer.address;
  const artistId = process.env.TEST_ARTIST_ID || "testartist";
  const baseURI = process.env.TEST_BASE_URI || "https://zeyoda.com/metadata/";

  console.log("📝 Deployer:", deployer.address);
  console.log("⚙️  Config:");
  console.log("   Artist ID:", artistId);
  console.log("   Base URI:", baseURI);
  console.log("   Owner:", ownerAddr);
  console.log("");

  // Step 1: Deploy implementation
  console.log("📦 Deploying implementation contract...");
  const Downloads = await ethers.getContractFactory("ArtistDownloadsUUPS");
  const impl = await Downloads.deploy();
  await impl.waitForDeployment();
  const implAddress = await impl.getAddress();
  console.log("✅ Implementation deployed at:", implAddress);

  // Step 2: Encode initializer
  console.log("\n🔧 Encoding initializer...");
  const initData = Downloads.interface.encodeFunctionData("initialize", [
    artistId,
    baseURI,
    ownerAddr
  ]);
  console.log("✅ Initializer encoded");

  // Step 3: Deploy ERC1967Proxy
  console.log("\n🔗 Deploying ERC1967Proxy...");
  const Proxy = await ethers.getContractFactory("ERC1967Proxy");
  const proxy = await Proxy.deploy(implAddress, initData);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log("✅ Proxy deployed at:", proxyAddress);

  // Step 4: Attach Downloads interface to proxy
  const downloads = Downloads.attach(proxyAddress);

  // Step 5: Verify implementation slot (ERC-1967 stores address in last 20 bytes)
  console.log("\n🔍 Verifying ERC-1967 implementation slot...");
  const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const raw = await ethers.provider.getStorage(proxyAddress, IMPL_SLOT);
  const implFromSlot = ethers.getAddress(ethers.dataSlice(raw, 12)); // Last 20 bytes
  console.log("   Stored implementation:", implFromSlot);
  console.log("   Expected:", implAddress);
  
  if (implFromSlot.toLowerCase() !== implAddress.toLowerCase()) {
    throw new Error("❌ Implementation slot mismatch!");
  }
  console.log("✅ Implementation slot verified");

  // Step 6: Smoke test - free mint
  console.log("\n🧪 Running smoke test (free buyFor)...");
  const tx = await downloads.buyFor(ownerAddr, 1, 1, { value: 0 });
  const receipt = await tx.wait();
  console.log("   Transaction:", receipt.hash);
  console.log("   Status:", receipt.status === 1 ? "Success ✅" : "Failed ❌");
  
  if (receipt.status !== 1) {
    throw new Error("❌ Smoke test transaction failed!");
  }
  console.log("✅ Smoke test passed - transaction succeeded!");

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:               Base Sepolia");
  console.log("Implementation:       ", implAddress);
  console.log("Proxy (USE THIS):     ", proxyAddress);
  console.log("Artist ID:            ", artistId);
  console.log("Owner:                ", ownerAddr);
  console.log("=".repeat(60));

  console.log("\n📝 Next Steps:");
  console.log("1. Verify implementation on BaseScan:");
  console.log(`   npx hardhat verify --network baseSepolia ${implAddress}`);
  console.log("\n2. Add to Supabase artist_registry:");
  console.log(`   INSERT INTO artist_registry (id, downloads, treasury_wallet)`);
  console.log(`   VALUES ('${artistId}', '${proxyAddress}', '${ownerAddr}');`);
  console.log("\n3. Add test asset to artist_assets:");
  console.log(`   INSERT INTO artist_assets (artist_id, asset_number, file_url, file_type, price_usd, metadata)`);
  console.log(`   VALUES ('${artistId}', 1, 'https://example.com/test.jpg', 'image/jpeg', 1.00,`);
  console.log(`           '{"title": "Test Asset", "description": "First UUPS download"}'::jsonb);`);

  console.log("\n✅ Deployment complete!\n");

  return {
    implementation: implAddress,
    proxy: proxyAddress,
    artistId: artistId
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
