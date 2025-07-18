const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying JAI TEA Artistock contract...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  // JAI TEA owner address
  const jaiTeaOwner = "0x0B893D9D0dA09096C75e43c310316dC61b2773be";
  
  // Deploy the Artistock contract
  const Artistock = await ethers.getContractFactory("Artistock");
  const jaiTeaToken = await Artistock.deploy("JAI TEA", "TEATOKENS", jaiTeaOwner);
  
  await jaiTeaToken.waitForDeployment();
  const contractAddress = await jaiTeaToken.getAddress();
  
  console.log("JAI TEA Token deployed to:", contractAddress);
  console.log("Contract owner:", jaiTeaOwner);
  
  // Note: The owner (0x0B893D9D0dA09096C75e43c310316dC61b2773be) will need to 
  // call the mint function separately using their wallet to mint 1 billion tokens
  console.log("\nTo mint 1 billion tokens, the owner needs to call:");
  console.log(`jaiTeaToken.mint("${jaiTeaOwner}", "1000000000000000000000000000")`);
  
  return contractAddress;
}

main()
  .then((address) => {
    console.log(`\nDeployment successful!`);
    console.log(`Contract Address: ${address}`);
    console.log(`Update Supabase with this contract address.`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  }); 