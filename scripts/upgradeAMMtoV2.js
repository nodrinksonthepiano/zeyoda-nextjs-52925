const { ethers, upgrades } = require("hardhat");

/**
 * Upgrade UUPS AMM to V2
 * - Adds protocol fee extraction (0.3%)
 * - Transfers fees to treasury immediately on each swap
 * - No artist relaunch needed (UUPS magic!)
 */
async function upgradeAMMtoV2() {
  console.log("🔧 Upgrading UUPS AMM to V2 (Protocol Fee Collection)...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Existing AMM proxy address (all artists use this)
  const AMM_PROXY = process.env.NEXT_PUBLIC_UUPS_AMM || "0x49B9538e0022dD919d9af2358783e89d08bCd82c";
  console.log("📍 Existing AMM Proxy:", AMM_PROXY);

  // Treasury wallet (where fees will be sent) - normalize checksum
  const TREASURY_WALLET = ethers.getAddress(
    process.env.PROTOCOL_TREASURY || process.env.PROTOCOL_VAULT || "0x615258a5263DBEe0DDEED3166ddC1f442D937eB3"
  );
  console.log("💰 Treasury Wallet:", TREASURY_WALLET);

  // Protocol fee (30 basis points = 0.3%)
  const FEE_BPS = 30;
  console.log("💸 Protocol Fee:", FEE_BPS, "bps (0.3%)\n");

  // Step 1: Deploy new implementation
  console.log("1️⃣  Deploying new AMM V2 implementation...");
  const UupsAMMV2 = await ethers.getContractFactory("UupsAMM");
  const newImplementation = await UupsAMMV2.deploy();
  await newImplementation.waitForDeployment();
  const newImplAddress = await newImplementation.getAddress();
  console.log("✅ New implementation deployed:", newImplAddress, "\n");

  // Step 2: Upgrade the proxy
  console.log("2️⃣  Upgrading proxy to V2 implementation...");
  const ammProxy = await ethers.getContractAt("UupsAMM", AMM_PROXY);
  
  // Encode initializeV2 call
  const initData = ammProxy.interface.encodeFunctionData("initializeV2", [
    TREASURY_WALLET,
    FEE_BPS
  ]);

  // Execute upgrade with initialization
  const upgradeTx = await ammProxy.upgradeToAndCall(newImplAddress, initData);
  console.log("📤 Upgrade TX sent:", upgradeTx.hash);
  await upgradeTx.wait();
  console.log("✅ Proxy upgraded to V2!\n");

  // Step 3: Verify upgrade
  console.log("3️⃣  Verifying V2 configuration...");
  const treasury = await ammProxy.treasury();
  const feeBps = await ammProxy.feeBps();
  
  console.log("   Treasury:", treasury);
  console.log("   Fee (bps):", feeBps.toString());
  
  if (treasury.toLowerCase() !== TREASURY_WALLET.toLowerCase()) {
    console.log("   ⚠️  WARNING: Treasury mismatch!");
  }
  if (feeBps.toString() !== FEE_BPS.toString()) {
    console.log("   ⚠️  WARNING: Fee mismatch!");
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ AMM V2 UPGRADE COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n🎯 What changed:");
  console.log("   - Every ETH→Token swap: 0.3% fee sent to treasury");
  console.log("   - Every Token→ETH swap: 0.3% fee (in tokens) sent to treasury");
  console.log("   - All 4 artists automatically use new logic");
  console.log("   - No artist relaunch needed!");
  console.log("\n💰 Next swap will send fees to:", TREASURY_WALLET);
  console.log("=".repeat(60) + "\n");

  // Step 4: Test swap (optional)
  const pools = await ammProxy.getSupportedTokens();
  if (pools.length > 0) {
    console.log("\n📊 Active pools:", pools.length);
    for (const token of pools) {
      const [tokenReserve, ethReserve] = await ammProxy.getReserves(token);
      console.log(`   ${token.slice(0, 10)}...`);
      console.log(`      Tokens: ${ethers.formatUnits(tokenReserve, 18)}`);
      console.log(`      ETH:    ${ethers.formatEther(ethReserve)}`);
    }
  }
}

upgradeAMMtoV2()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

