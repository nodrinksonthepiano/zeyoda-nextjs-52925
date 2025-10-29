const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🔄 Upgrading ArtistDownloadsUUPS to V2 (sponsor pattern)...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer:", deployer.address);

  // Get proxy address from environment or use default (joz33n from latest test)
  const PROXY_ADDRESS = process.env.DOWNLOADS_PROXY || "0x4C8BAC6f532e48Fdc8F30583610d234Fd7e96aA5";
  
  console.log("📍 Upgrading proxy:", PROXY_ADDRESS);
  console.log("");

  // Get current state before upgrade
  const oldContract = await ethers.getContractAt("ArtistDownloadsUUPS", PROXY_ADDRESS);
  const artistIdBefore = await oldContract.artistId();
  const ownerBefore = await oldContract.owner();
  
  console.log("📊 Before upgrade:");
  console.log("   Artist ID:", artistIdBefore);
  console.log("   Owner:", ownerBefore);
  console.log("");

  // Force import existing proxy first (was deployed manually)
  console.log("📋 Importing existing proxy...");
  const DownloadsV2 = await ethers.getContractFactory("ArtistDownloadsUUPS");
  
  await upgrades.forceImport(PROXY_ADDRESS, DownloadsV2, {
    kind: "uups"
  });
  console.log("✅ Proxy imported");

  // Deploy new implementation and upgrade
  console.log("\n📦 Upgrading to V2...");
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, DownloadsV2, {
    kind: "uups"
  });
  
  await upgraded.waitForDeployment();
  console.log("✅ Upgraded to V2");

  // Get new implementation address
  const newImplAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("   New implementation:", newImplAddress);

  // Verify state preserved
  console.log("\n🔍 Verifying state preservation...");
  const artistIdAfter = await upgraded.artistId();
  const ownerAfter = await upgraded.owner();
  const sponsorAfter = await upgraded.sponsor();
  
  console.log("   Artist ID:", artistIdAfter, artistIdAfter === artistIdBefore ? "✅" : "❌");
  console.log("   Owner:", ownerAfter, ownerAfter === ownerBefore ? "✅" : "❌");
  console.log("   Sponsor:", sponsorAfter, "(not set yet)");

  console.log("\n✅ Upgrade complete!");
  console.log("\n📝 Next step: Set sponsor address");
  console.log("   DOWNLOADS_PROXY=" + PROXY_ADDRESS + " npx hardhat run scripts/setDownloadsSponsor.js --network baseSepolia");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Upgrade failed:", error);
    process.exit(1);
  });

