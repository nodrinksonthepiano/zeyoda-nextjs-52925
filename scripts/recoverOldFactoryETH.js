const { ethers } = require("hardhat");

async function main() {
  const OLD_FACTORY = process.env.FACTORY_ADDRESS || "0xA97194062770fEbC7b8A65E999860a137408E924";
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const factory = await ethers.getContractAt("ArtistFactory", OLD_FACTORY);
  
  const balance = await factory.getBalance();
  console.log("Old factory balance:", ethers.formatEther(balance), "ETH");
  
  if (balance > 0n) {
    console.log("Withdrawing ETH...");
    const tx = await factory.withdrawETH(balance);
    await tx.wait();
    console.log("✅ Recovered", ethers.formatEther(balance), "ETH from old factory!");
  } else {
    console.log("No ETH to recover.");
  }
}

main().catch(e => { console.error(e); process.exit(1); });

