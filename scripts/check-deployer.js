const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 DEPLOYER WALLET STATUS CHECK");
  console.log("=" * 50);
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer Address:", deployer.address);
  
  // Check ETH balance
  const ethBalance = await ethers.provider.getBalance(deployer.address);
  console.log("ETH Balance:", ethers.formatEther(ethBalance), "ETH");
  
  // Contract addresses from deployment
  const contracts = {
    GOSHEESH_TOKEN: "0x91EA826b3ff30272fDe475db012D7304dd6Dac1a",
    JAITEA_TOKEN: "0xDb2D5F722C0AF730a0fd737650f865ED296D79c1",
    GOSHEESH_SWAP: "0x63349f5190860b4E954639eeFd60b92bE9A01148", 
    JAITEA_SWAP: "0xd01cFF08a9962e67914a3A3e446D90513915db6f"
  };
  
  // ERC20 ABI for checking balances
  const ERC20_ABI = [
    "function balanceOf(address owner) external view returns (uint256)",
    "function totalSupply() external view returns (uint256)",
    "function symbol() external view returns (string)"
  ];
  
  console.log("\n📊 TOKEN BALANCES:");
  
  // Check GOSHEESH token balance
  const gosheeshToken = new ethers.Contract(contracts.GOSHEESH_TOKEN, ERC20_ABI, deployer);
  const gosheeshBalance = await gosheeshToken.balanceOf(deployer.address);
  const gosheeshSymbol = await gosheeshToken.symbol();
  console.log(`${gosheeshSymbol} (Deployer):`, ethers.formatUnits(gosheeshBalance, 18));
  
  // Check JAITEA token balance  
  const jaiteaToken = new ethers.Contract(contracts.JAITEA_TOKEN, ERC20_ABI, deployer);
  const jaiteaBalance = await jaiteaToken.balanceOf(deployer.address);
  const jaiteaSymbol = await jaiteaToken.symbol();
  console.log(`${jaiteaSymbol} (Deployer):`, ethers.formatUnits(jaiteaBalance, 18));
  
  console.log("\n🏦 SWAP CONTRACT BALANCES:");
  
  // Check swap contract token balances
  const gosheeshSwapBalance = await gosheeshToken.balanceOf(contracts.GOSHEESH_SWAP);
  console.log(`${gosheeshSymbol} in Swap Contract:`, ethers.formatUnits(gosheeshSwapBalance, 18));
  
  const jaiteaSwapBalance = await jaiteaToken.balanceOf(contracts.JAITEA_SWAP);
  console.log(`${jaiteaSymbol} in Swap Contract:`, ethers.formatUnits(jaiteaSwapBalance, 18));
  
  // Check swap contract ETH balances
  const gosheeshSwapEth = await ethers.provider.getBalance(contracts.GOSHEESH_SWAP);
  const jaiteaSwapEth = await ethers.provider.getBalance(contracts.JAITEA_SWAP);
  
  console.log("\n💰 SWAP CONTRACT ETH:");
  console.log(`GOSHEESH Swap ETH:`, ethers.formatEther(gosheeshSwapEth), "ETH");
  console.log(`JAITEA Swap ETH:`, ethers.formatEther(jaiteaSwapEth), "ETH");
  
  console.log("\n✅ STATUS SUMMARY:");
  console.log(`- Deployer has ${ethers.formatEther(ethBalance)} ETH`);
  console.log(`- GOSHEESH tokens in swap: ${ethers.formatUnits(gosheeshSwapBalance, 18)}`);
  console.log(`- JAITEA tokens in swap: ${ethers.formatUnits(jaiteaSwapBalance, 18)}`);
  
  if (gosheeshSwapBalance === 0n || jaiteaSwapBalance === 0n) {
    console.log("\n⚠️  ISSUE: Swap contracts need token funding!");
    console.log("Next step: Transfer tokens from artist wallets to swap contracts");
  }
  
  if (ethBalance < ethers.parseEther("0.01")) {
    console.log("\n⚠️  WARNING: Low ETH balance. May need more for transactions.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  }); 