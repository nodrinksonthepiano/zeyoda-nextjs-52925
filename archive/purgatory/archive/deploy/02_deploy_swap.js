const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Swap contract...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  // Deploy the Swap contract
  const Swap = await ethers.getContractFactory("Swap");
  const swapContract = await Swap.deploy(deployer.address);
  
  await swapContract.waitForDeployment();
  const contractAddress = await swapContract.getAddress();
  
  console.log("Swap contract deployed to:", contractAddress);
  console.log("Contract owner:", deployer.address);
  
  // Known token addresses
  const gosheeshToken = "0x91EA826b3ff30272fDe475db012D7304dd6Dac1a";
  // JAI TEA token address will be set after deployment
  
  console.log("\nNext steps:");
  console.log("1. Deploy JAI TEA token contract");
  console.log("2. Create liquidity pools for both tokens");
  console.log("3. Update frontend with swap contract address");
  
  return contractAddress;
}

main()
  .then((address) => {
    console.log(`\nSwap contract deployment successful!`);
    console.log(`Contract Address: ${address}`);
    console.log(`Add this address to your frontend configuration.`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  }); 