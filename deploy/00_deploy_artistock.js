// deploy/00_deploy_artistock.js
// Usage: ARTIST_NAME="Gosheesh Token" ARTIST_SYMBOL=GOSH npx hardhat run --network baseSepolia deploy/00_deploy_artistock.js

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const name   = process.env.ARTIST_NAME   || "MyArtist Token";
  const symbol = process.env.ARTIST_SYMBOL || "ART";

  console.log(`\n⛓  Deploying Artistock "${name}" (${symbol}) …`);

  const Artistock = await ethers.getContractFactory("Artistock");
  const art = await Artistock.deploy(name, symbol, deployer.address);
  await art.waitForDeployment();

  const addr = await art.getAddress();
  console.log("✅  Artistock deployed to:", addr);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
