const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account for deployment:", deployer.address);

  // --- CONFIGURATION ---
  const artistId = "jaitea";
  const configPath = path.join(__dirname, '..', 'public', 'artists', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  const artistInfo = config.artists[artistId];
  if (!artistInfo) {
    throw new Error(`Artist "${artistId}" not found in config.json`);
  }

  const tokenName = artistInfo.tokenName;
  const tokenSymbol = artistId.toUpperCase();
  const initialOwner = deployer.address; // Deployer will be the initial owner

  console.log(`Preparing to re-deploy contract for artist: "${artistId}"`);
  console.log(`Token Name: ${tokenName}, Symbol: ${tokenSymbol}`);
  console.log(`Initial owner will be the deployer: ${initialOwner}`);

  // --- DEPLOYMENT ---
  const Artistock = await ethers.getContractFactory("Artistock");
  const artistock = await Artistock.deploy(tokenName, tokenSymbol, initialOwner);
  await artistock.waitForDeployment();
  const newContractAddress = await artistock.getAddress();
  
  console.log(`\n✅ New contract for ${artistId} deployed successfully!`);
  console.log(`New Contract Address: ${newContractAddress}`);

  // --- UPDATE CONFIG.JSON ---
  const oldContractAddress = config.artists[artistId].contract;
  config.artists[artistId].contract = newContractAddress;
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  console.log(`\n✅ Updated public/artists/config.json`);
  console.log(`   Old Address: ${oldContractAddress}`);
  console.log(`   New Address: ${newContractAddress}`);
  console.log(`\nRedeployment complete. You can now run the ownership transfer script.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 