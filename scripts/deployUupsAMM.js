const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying UupsAMM (Manual ERC1967 Proxy) to Base Sepolia...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH\n");

  // Configuration
  const TRADING_FEE = 30; // 0.3% (30 basis points)
  const OWNER = deployer.address;

  console.log("⚙️  Configuration:");
  console.log("   Trading Fee:", TRADING_FEE, "basis points (0.3%)");
  console.log("   Owner:", OWNER);
  console.log("");

  // Step 1: Deploy implementation
  console.log("📦 Deploying implementation contract...");
  const AMM = await ethers.getContractFactory("UupsAMM");
  const impl = await AMM.deploy();
  await impl.waitForDeployment();
  const implAddress = await impl.getAddress();
  console.log("✅ Implementation deployed at:", implAddress);

  // Step 2: Encode initializer
  console.log("\n🔧 Encoding initializer...");
  const initData = AMM.interface.encodeFunctionData("initialize", [
    OWNER,
    TRADING_FEE
  ]);
  console.log("✅ Initializer encoded");

  // Step 3: Deploy ERC1967Proxy
  console.log("\n🔗 Deploying ERC1967Proxy...");
  const Proxy = await ethers.getContractFactory("ERC1967Proxy");
  const proxy = await Proxy.deploy(implAddress, initData);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log("✅ Proxy deployed at:", proxyAddress);

  // Summary (skip verification - will check via BaseScan)
  console.log("\n" + "=".repeat(70));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(70));
  console.log("Network:            Base Sepolia");
  console.log("Proxy (USE THIS):  ", proxyAddress);
  console.log("Implementation:    ", implAddress);
  console.log("Trading Fee:        30 bps (0.3%)");
  console.log("Owner:             ", OWNER);
  console.log("=".repeat(70));
  
  console.log("\n📝 Verify on BaseScan:");
  console.log(`   https://sepolia.basescan.org/address/${proxyAddress}`);
  
  console.log("\n📝 Next Step - Seed Pool:");
  console.log("   export AMM_PROXY=" + proxyAddress);
  console.log("   export ARTIST_TOKEN_PROXY=0xDFf8058890102f2aF623c9B6E0C1Ab42Bb996a8c");
  console.log("   npx hardhat run scripts/seedTestartistPool.js --network baseSepolia");

  console.log("\n✅ AMM Deployment Complete!\n");

  return {
    proxy: proxyAddress,
    implementation: implAddress
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
