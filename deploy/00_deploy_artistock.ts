import { ethers } from "hardhat";

async function main() {
  const Artistock = await ethers.getContractFactory("Artistock");
  const token = await Artistock.deploy("Gosheesh", "GOSH");
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("GOSH deployed to:", tokenAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 