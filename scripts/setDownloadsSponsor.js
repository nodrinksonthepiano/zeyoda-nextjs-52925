const { ethers } = require("hardhat");

async function main() {
  console.log("🔑 Setting sponsor on ArtistDownloadsUUPS...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer (owner):", deployer.address);

  // Configuration
  const DOWNLOADS_PROXY = process.env.DOWNLOADS_PROXY || "0x4C8BAC6f532e48Fdc8F30583610d234Fd7e96aA5";
  const SPONSOR_ADDRESS = process.env.SPONSOR_ADDRESS || deployer.address; // Server signer address
  
  console.log("📍 Downloads proxy:", DOWNLOADS_PROXY);
  console.log("🔑 Sponsor address:", SPONSOR_ADDRESS);
  console.log("");

  // Get contract
  const downloads = await ethers.getContractAt("ArtistDownloadsUUPS", DOWNLOADS_PROXY);
  
  // Verify current state
  const owner = await downloads.owner();
  const currentSponsor = await downloads.sponsor();
  
  console.log("📊 Current state:");
  console.log("   Owner:", owner);
  console.log("   Sponsor:", currentSponsor);
  console.log("");

  if (currentSponsor === SPONSOR_ADDRESS) {
    console.log("✅ Sponsor already set correctly!");
    return;
  }

  // Set sponsor
  console.log("⚡ Setting sponsor...");
  const tx = await downloads.setSponsor(SPONSOR_ADDRESS);
  const receipt = await tx.wait();
  
  console.log("   Transaction:", receipt.hash);
  console.log("✅ Sponsor set successfully!");

  // Verify
  const newSponsor = await downloads.sponsor();
  console.log("\n📊 New state:");
  console.log("   Sponsor:", newSponsor);
  console.log("   Match:", newSponsor === SPONSOR_ADDRESS ? "✅" : "❌");
  
  console.log("\n✅ Downloads contract ready for server-sponsored mints!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });

