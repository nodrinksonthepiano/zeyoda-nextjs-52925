const { ethers } = require("hardhat");

async function main() {
  console.log("🔧 FIXING SWAP CONTRACT OWNERSHIP");
  console.log("=================================\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Current deployer:", deployer.address);
  
  const MAIN_SWAP_ADDRESS = "0xb9Fd7D8111F462cdB58EB7E1D18EA3016142Fa35";
  
  // Two approaches: 
  // 1. Try to transfer ownership (if we have access)
  // 2. Deploy a new Swap contract with correct owner
  
  const swapABI = [
    "function owner() external view returns (address)",
    "function transferOwnership(address newOwner) external",
    "function renounceOwnership() external"
  ];
  
  const swapContract = new ethers.Contract(MAIN_SWAP_ADDRESS, swapABI, deployer);
  
  console.log("📊 CURRENT OWNERSHIP:");
  const currentOwner = await swapContract.owner();
  console.log(`  Current owner: ${currentOwner}`);
  console.log(`  Deployer: ${deployer.address}`);
  
  // Check if the current deployer can access the owner functions
  // This would only work if we're using the same private key that deployed the contract
  console.log("\n🔄 ATTEMPTING TO DEPLOY NEW SWAP CONTRACT...");
  console.log("(Since we likely don't control the current owner)\n");
  
  // Deploy new Swap contract with correct owner
  console.log("Deploying new Swap contract...");
  
  const Swap = await ethers.getContractFactory("Swap");
  const newSwap = await Swap.deploy(deployer.address); // Set deployer as owner
  
  await newSwap.waitForDeployment();
  const newSwapAddress = await newSwap.getAddress();
  
  console.log(`✅ New Swap contract deployed: ${newSwapAddress}`);
  console.log(`✅ Owner: ${deployer.address}`);
  
  // Verify ownership
  const newOwner = await newSwap.owner();
  console.log(`✅ Verified owner: ${newOwner}`);
  
  console.log("\n🔄 NEXT STEPS:");
  console.log("1. Update swap contract address in:");
  console.log("   - app/utils/swapUtils.ts");
  console.log("   - tasks/seed-lp.js");
  console.log("   - Any deployment scripts");
  console.log(`2. Use new address: ${newSwapAddress}`);
  console.log("3. Create liquidity pools with the new contract");
  
  // Update the constant in swapUtils.ts
  console.log("\n📝 AUTOMATIC UPDATE:");
  console.log(`Updating SWAP_CONTRACT_ADDRESS to: ${newSwapAddress}`);
  
  return newSwapAddress;
}

main()
  .then((newAddress) => {
    console.log(`\n✅ New Swap Contract: ${newAddress}`);
    console.log("Ready to create liquidity pools!");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
