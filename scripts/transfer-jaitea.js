const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // --- CONFIGURATION ---
  const artistId = "jaitea";
  const newOwnerAddress = "0x0B893D9D0dA09096C75e43c310316dC61b2773be";

  console.log(`Preparing to transfer ownership for artist: "${artistId}"`);
  console.log(`New owner will be: ${newOwnerAddress}`);

  // --- LOAD CONTRACT ---
  const configPath = path.join(__dirname, '..', 'public', 'artists', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  const artistInfo = config.artists[artistId];
  if (!artistInfo) {
    throw new Error(`Artist "${artistId}" not found in config.json`);
  }

  const contractAddress = artistInfo.contract;
  if (!contractAddress || !ethers.isAddress(contractAddress)) {
      throw new Error(`Invalid or missing contract address for ${artistId} in config.json`);
  }
  
  console.log(`Found contract address for ${artistId}: ${contractAddress}`);

  const Artistock = await ethers.getContractFactory("Artistock");
  const artistock = Artistock.attach(contractAddress);

  // --- TRANSFER OWNERSHIP ---
  console.log("Checking current owner...");
  const currentOwner = await artistock.owner();
  console.log(`Current owner is: ${currentOwner}`);

  if (currentOwner.toLowerCase() === newOwnerAddress.toLowerCase()) {
    console.log("The new owner is already the current owner. No action needed.");
    return;
  }
  
  console.log("Transferring ownership...");
  const tx = await artistock.transferOwnership(newOwnerAddress);
  
  console.log(`Transaction sent with hash: ${tx.hash}`);
  console.log("Waiting for transaction to be confirmed...");
  
  await tx.wait();
  
  console.log("\n✅ Ownership transferred successfully!");
  const finalOwner = await artistock.owner();
  console.log(`The new owner of contract ${contractAddress} is now: ${finalOwner}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 