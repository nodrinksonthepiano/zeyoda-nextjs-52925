const { ethers } = require("hardhat");

// Contract addresses
const CONTRACTS = {
  GOSHEESH_TOKEN: "0x91EA826b3ff30272fDe475db012D7304dd6Dac1a",
  JAITEA_TOKEN: "0xDb2D5F722C0AF730a0fd737650f865ED296D79c1",
  GOSHEESH_SWAP: "0x63349f5190860b4E954639eeFd60b92bE9A01148", 
  JAITEA_SWAP: "0xd01cFF08a9962e67914a3A3e446D90513915db6f"
};

async function main() {
  console.log("🚀 TRANSFER TOKENS TO SWAP CONTRACTS");
  console.log("=" * 50);
  
  const [wallet] = await ethers.getSigners();
  console.log("Using wallet:", wallet.address);
  
  // Check ETH balance
  const ethBalance = await ethers.provider.getBalance(wallet.address);
  console.log("ETH Balance:", ethers.formatEther(ethBalance), "ETH");
  
  if (ethBalance < ethers.parseEther("0.01")) {
    console.log("⚠️  WARNING: Low ETH balance for gas fees!");
    return;
  }
  
  // ERC20 ABI
  const ERC20_ABI = [
    "function balanceOf(address owner) external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function symbol() external view returns (string)"
  ];
  
  // Get token contracts
  const gosheeshToken = new ethers.Contract(CONTRACTS.GOSHEESH_TOKEN, ERC20_ABI, wallet);
  const jaiteaToken = new ethers.Contract(CONTRACTS.JAITEA_TOKEN, ERC20_ABI, wallet);
  
  // Check wallet token balances
  const gosheeshBalance = await gosheeshToken.balanceOf(wallet.address);
  const jaiteaBalance = await jaiteaToken.balanceOf(wallet.address);
  const gosheeshSymbol = await gosheeshToken.symbol();
  const jaiteaSymbol = await jaiteaToken.symbol();
  
  console.log("\n📊 CURRENT WALLET BALANCES:");
  console.log(`${gosheeshSymbol}:`, ethers.formatUnits(gosheeshBalance, 18));
  console.log(`${jaiteaSymbol}:`, ethers.formatUnits(jaiteaBalance, 18));
  
  // Transfer amounts (1M tokens each)
  const transferAmount = ethers.parseUnits("1000000", 18);
  
  // Transfer GOSHEESH tokens if available
  if (gosheeshBalance >= transferAmount) {
    console.log(`\n📤 Transferring 1M ${gosheeshSymbol} to swap contract...`);
    try {
      const tx1 = await gosheeshToken.transfer(CONTRACTS.GOSHEESH_SWAP, transferAmount);
      console.log(`Transaction: ${tx1.hash}`);
      console.log("Waiting for confirmation...");
      await tx1.wait();
      console.log(`✅ Success! Transferred 1M ${gosheeshSymbol}`);
    } catch (error) {
      console.error(`❌ Failed:`, error.message);
    }
  } else {
    console.log(`\n⚠️  Not enough ${gosheeshSymbol} tokens (need 1M, have ${ethers.formatUnits(gosheeshBalance, 18)})`);
  }
  
  // Transfer JAITEA tokens if available  
  if (jaiteaBalance >= transferAmount) {
    console.log(`\n📤 Transferring 1M ${jaiteaSymbol} to swap contract...`);
    try {
      const tx2 = await jaiteaToken.transfer(CONTRACTS.JAITEA_SWAP, transferAmount);
      console.log(`Transaction: ${tx2.hash}`);
      console.log("Waiting for confirmation...");
      await tx2.wait();
      console.log(`✅ Success! Transferred 1M ${jaiteaSymbol}`);
    } catch (error) {
      console.error(`❌ Failed:`, error.message);
    }
  } else {
    console.log(`\n⚠️  Not enough ${jaiteaSymbol} tokens (need 1M, have ${ethers.formatUnits(jaiteaBalance, 18)})`);
  }
  
  // Final verification
  console.log("\n🔍 FINAL CHECK:");
  const finalGosheeshSwap = await gosheeshToken.balanceOf(CONTRACTS.GOSHEESH_SWAP);
  const finalJaiteaSwap = await jaiteaToken.balanceOf(CONTRACTS.JAITEA_SWAP);
  
  console.log(`GOSHEESH Swap Balance:`, ethers.formatUnits(finalGosheeshSwap, 18));
  console.log(`JAITEA Swap Balance:`, ethers.formatUnits(finalJaiteaSwap, 18));
  
  if (finalGosheeshSwap >= transferAmount && finalJaiteaSwap >= transferAmount) {
    console.log("\n🎉 SUCCESS! Both swap contracts are funded!");
    console.log("🚀 Ready for Day-0 MVP testing!");
  } else {
    console.log("\n⚠️  Some transfers may have failed. Check individual results above.");
  }
  
  console.log("\n📋 NEXT STEPS:");
  console.log("1. Test swap functionality in frontend");
  console.log("2. Verify buy/sell transactions work");
  console.log("3. Check console logs for any errors");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  }); 