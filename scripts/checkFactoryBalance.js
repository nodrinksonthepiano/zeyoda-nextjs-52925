const { ethers } = require("hardhat");

async function main() {
  const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || "0xAbCaf3Ebb71aF649d3535c285501e44767CE5825";
  
  const factory = await ethers.getContractAt("ArtistFactory", FACTORY_ADDRESS);
  
  // Read balance directly from blockchain (more reliable)
  const balance = await ethers.provider.getBalance(FACTORY_ADDRESS);
  const artistCount = await factory.artistCount();
  
  console.log("\n📊 Factory Status:");
  console.log("   Address:", FACTORY_ADDRESS);
  console.log("   Balance:", ethers.formatEther(balance), "ETH");
  console.log("   Artists Created:", artistCount.toString());
  console.log("   Can Deploy:", Math.floor(Number(ethers.formatEther(balance)) / 0.005), "more artists");
  
  if (Number(ethers.formatEther(balance)) < 0.01) {
    console.log("\n⚠️  WARNING: Factory balance low! Top up soon.");
  } else {
    console.log("\n✅ Factory well funded.");
  }
}

main().catch(e => { console.error(e); process.exit(1); });

