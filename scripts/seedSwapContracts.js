const { ethers } = require("hardhat");

// Contract addresses from deployment
const CONTRACTS = {
  GOSHEESH_TOKEN: "0x91EA826b3ff30272fDe475db012D7304dd6Dac1a",
  JAITEA_TOKEN: "0xDb2D5F722C0AF730a0fd737650f865ED296D79c1",
  GOSHEESH_SWAP: "0x63349f5190860b4E954639eeFd60b92bE9A01148", 
  JAITEA_SWAP: "0xd01cFF08a9962e67914a3A3e446D90513915db6f"
};

// Target amounts for each swap contract (1M tokens each for good UX)
const TARGET_AMOUNTS = {
  GOSHEESH: ethers.parseUnits("1000000", 18), // 1M GOSHEESH tokens
  JAITEA: ethers.parseUnits("1000000", 18)    // 1M JAITEA tokens  
};

async function main() {
  console.log("🎯 SEEDING TREASURYSWAPLITE CONTRACTS");
  console.log("=" * 50);
  
  const [deployer] = await ethers.getSigners();
  console.log("Using wallet:", deployer.address);
  
  // ERC20 ABI for token operations
  const ERC20_ABI = [
    "function balanceOf(address owner) external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function symbol() external view returns (string)",
    "function totalSupply() external view returns (uint256)"
  ];
  
  // Get token contracts
  const gosheeshToken = new ethers.Contract(CONTRACTS.GOSHEESH_TOKEN, ERC20_ABI, deployer);
  const jaiteaToken = new ethers.Contract(CONTRACTS.JAITEA_TOKEN, ERC20_ABI, deployer);
  
  console.log("\n📊 CURRENT BALANCES:");
  
  // Check current wallet balances
  const gosheeshBalance = await gosheeshToken.balanceOf(deployer.address);
  const jaiteaBalance = await jaiteaToken.balanceOf(deployer.address);
  const gosheeshSymbol = await gosheeshToken.symbol();
  const jaiteaSymbol = await jaiteaToken.symbol();
  
  console.log(`Wallet ${gosheeshSymbol}:`, ethers.formatUnits(gosheeshBalance, 18));
  console.log(`Wallet ${jaiteaSymbol}:`, ethers.formatUnits(jaiteaBalance, 18));
  
  // Check current swap contract balances
  const gosheeshSwapBalance = await gosheeshToken.balanceOf(CONTRACTS.GOSHEESH_SWAP);
  const jaiteaSwapBalance = await jaiteaToken.balanceOf(CONTRACTS.JAITEA_SWAP);
  
  console.log(`\nSwap ${gosheeshSymbol}:`, ethers.formatUnits(gosheeshSwapBalance, 18));
  console.log(`Swap ${jaiteaSymbol}:`, ethers.formatUnits(jaiteaSwapBalance, 18));
  
  console.log("\n🎯 SEEDING PLAN:");
  console.log(`Target: 1,000,000 tokens per swap contract`);
  
  // Check if wallet has enough tokens
  let canSeedGosheesh = gosheeshBalance >= TARGET_AMOUNTS.GOSHEESH;
  let canSeedJaitea = jaiteaBalance >= TARGET_AMOUNTS.JAITEA;
  
  console.log(`Can seed GOSHEESH: ${canSeedGosheesh ? '✅' : '❌'}`);
  console.log(`Can seed JAITEA: ${canSeedJaitea ? '✅' : '❌'}`);
  
  if (!canSeedGosheesh && !canSeedJaitea) {
    console.log("\n⚠️  ISSUE: Current wallet doesn't have enough tokens!");
    console.log("\n💡 SOLUTIONS:");
    console.log("1. Transfer tokens from artist Magic Link wallets to this deployer wallet");
    console.log("2. Use artist wallets directly (change MINTER_PRIVATE_KEY in .env.local)");
    console.log("\nArtist wallet addresses to check:");
    console.log("GOSHEESH Artist: (check Magic Link wallet with ~5B tokens)");
    console.log("JAITEA Artist: (check Magic Link wallet with ~1B tokens)");
    return;
  }
  
  console.log("\n🚀 STARTING SEEDING PROCESS...");
  
  // Seed GOSHEESH if possible
  if (canSeedGosheesh) {
    console.log(`\n📤 Seeding GOSHEESH swap contract...`);
    try {
      const tx1 = await gosheeshToken.transfer(
        CONTRACTS.GOSHEESH_SWAP, 
        TARGET_AMOUNTS.GOSHEESH
      );
      console.log(`Transaction sent: ${tx1.hash}`);
      await tx1.wait();
      console.log(`✅ Transferred 1M GOSHEESH tokens to swap contract`);
    } catch (error) {
      console.error(`❌ Failed to transfer GOSHEESH:`, error.message);
    }
  }
  
  // Seed JAITEA if possible  
  if (canSeedJaitea) {
    console.log(`\n📤 Seeding JAITEA swap contract...`);
    try {
      const tx2 = await jaiteaToken.transfer(
        CONTRACTS.JAITEA_SWAP,
        TARGET_AMOUNTS.JAITEA
      );
      console.log(`Transaction sent: ${tx2.hash}`);
      await tx2.wait();
      console.log(`✅ Transferred 1M JAITEA tokens to swap contract`);
    } catch (error) {
      console.error(`❌ Failed to transfer JAITEA:`, error.message);
    }
  }
  
  // Final verification
  console.log("\n🔍 FINAL VERIFICATION:");
  const finalGosheeshSwap = await gosheeshToken.balanceOf(CONTRACTS.GOSHEESH_SWAP);
  const finalJaiteaSwap = await jaiteaToken.balanceOf(CONTRACTS.JAITEA_SWAP);
  
  console.log(`GOSHEESH Swap:`, ethers.formatUnits(finalGosheeshSwap, 18), "tokens");
  console.log(`JAITEA Swap:`, ethers.formatUnits(finalJaiteaSwap, 18), "tokens");
  
  if (finalGosheeshSwap >= TARGET_AMOUNTS.GOSHEESH && finalJaiteaSwap >= TARGET_AMOUNTS.JAITEA) {
    console.log("\n🎉 SUCCESS! Both swap contracts are now funded!");
    console.log("Ready for Day-0 MVP testing!");
  } else {
    console.log("\n⚠️  Some contracts still need funding. Check artist wallets.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  }); 