const { ethers } = require("hardhat");

async function main() {
  const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || "0xAbCaf3Ebb71aF649d3535c285501e44767CE5825";
  const AMOUNT = process.env.FUND_AMOUNT || "0.05"; // Default 0.05 ETH
  
  const [deployer] = await ethers.getSigners();
  const factory = await ethers.getContractAt("ArtistFactory", FACTORY_ADDRESS);
  
  console.log("\n💰 Funding factory...");
  console.log("   From:", deployer.address);
  console.log("   To:", FACTORY_ADDRESS);
  console.log("   Amount:", AMOUNT, "ETH");
  
  const tx = await factory.fundFactory({ value: ethers.parseEther(AMOUNT) });
  const receipt = await tx.wait();
  
  console.log("   Transaction:", receipt.hash);
  console.log("   ✅ Factory funded");
  
  // Wait for state to propagate
  console.log("\n   Waiting for balance update...");
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Read balance from blockchain directly (not contract call)
  const contractBalance = await ethers.provider.getBalance(FACTORY_ADDRESS);
  console.log("\n   New Balance:", ethers.formatEther(contractBalance), "ETH");
  console.log("   Can Deploy:", Math.floor(Number(ethers.formatEther(contractBalance)) / 0.005), "artists");
}

main().catch(e => { console.error(e); process.exit(1); });

