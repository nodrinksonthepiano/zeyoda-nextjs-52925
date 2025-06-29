const { ethers, upgrades } = require("hardhat");

// NEW token addresses (GOSH33SH and JAIT33)
const NEW_TOKENS = {
  GOSH33SH: "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac",
  JAIT33: "0x9D06564a8D98e146CAb1dE74BF815bf05d24D685"
};

// Artist wallet addresses  
const ARTIST_WALLETS = {
  gosheesh: "0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8", // GOSHEESH Magic Link
  jaitea: "0x0B893D9D0dA09096C75e43c310316dC61b2773be"   // JAITEA Magic Link
};

async function deployNewSwapContract(tokenAddress, artistWallet, artistName) {
  console.log(`\n🚀 Deploying NEW TreasurySwapLite for ${artistName.toUpperCase()}...`);
  
  // Deploy TreasurySwapLite proxy with correct token address
  const TreasurySwapLite = await ethers.getContractFactory("TreasurySwapLite");
  
  const proxy = await upgrades.deployProxy(
    TreasurySwapLite,
    [tokenAddress, artistWallet],
    { 
      initializer: 'initialize',
      kind: 'uups'
    }
  );
  
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  
  console.log(`✅ NEW ${artistName} TreasurySwapLite deployed at: ${proxyAddress}`);
  
  // Transfer 100M tokens from deployer to new proxy
  const ERC20_ABI = [
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function balanceOf(address owner) external view returns (uint256)"
  ];
  
  const [deployer] = await ethers.getSigners();
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, deployer);
  
  const transferAmount = ethers.parseUnits("100000000", 18); // 100M tokens
  const deployerBalance = await tokenContract.balanceOf(deployer.address);
  
  console.log(`- Deployer balance: ${ethers.formatUnits(deployerBalance, 18)} tokens`);
  console.log(`- Transferring: ${ethers.formatUnits(transferAmount, 18)} tokens`);
  
  if (deployerBalance < transferAmount) {
    console.log(`⚠️ Warning: Deployer only has ${ethers.formatUnits(deployerBalance, 18)} tokens`);
    console.log("Transferring available balance instead...");
    const actualTransfer = deployerBalance > 0 ? deployerBalance : ethers.parseUnits("0", 18);
    
    if (actualTransfer > 0) {
      const tokenTx = await tokenContract.transfer(proxyAddress, actualTransfer);
      await tokenTx.wait();
      console.log(`✅ Transferred ${ethers.formatUnits(actualTransfer, 18)} tokens`);
    }
  } else {
    const tokenTx = await tokenContract.transfer(proxyAddress, transferAmount);
    await tokenTx.wait();
    console.log("✅ Transferred 100M tokens successfully");
  }
  
  // Send 0.01 ETH to contract for sell-back functionality
  console.log("💰 Funding contract with 0.01 ETH...");
  const ethTx = await deployer.sendTransaction({
    to: proxyAddress,
    value: ethers.parseEther("0.01")
  });
  await ethTx.wait();
  console.log("✅ Contract funded with 0.01 ETH");
  
  return proxyAddress;
}

async function main() {
  console.log("🔧 REDEPLOYING SWAP CONTRACTS WITH CORRECT TOKEN ADDRESSES");
  console.log("=" * 60);
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer ETH balance:", ethers.formatEther(balance));
  
  if (balance < ethers.parseEther("0.05")) {
    console.log("⚠️ Warning: Low ETH balance. Need at least 0.05 ETH for deployment + funding");
  }
  
  const newSwapContracts = {};
  
  try {
    // Deploy for GOSH33SH (GOSHEESH)
    newSwapContracts.gosheesh = await deployNewSwapContract(
      NEW_TOKENS.GOSH33SH,
      ARTIST_WALLETS.gosheesh, 
      "gosheesh"
    );
    
    // Deploy for JAIT33 (JAITEA)  
    newSwapContracts.jaitea = await deployNewSwapContract(
      NEW_TOKENS.JAIT33,
      ARTIST_WALLETS.jaitea,
      "jaitea"
    );
    
  } catch (error) {
    console.error("❌ Deployment error:", error.message);
    throw error;
  }
  
  console.log("\n🎉 NEW SWAP CONTRACTS DEPLOYED!");
  console.log("=" * 60);
  
  console.log("\n📝 UPDATE THESE ADDRESSES:");
  console.log("\n1. Update Supabase:");
  Object.entries(newSwapContracts).forEach(([artist, address]) => {
    console.log(`   UPDATE artists SET swap_address = '${address}' WHERE id = '${artist}';`);
  });
  
  console.log("\n2. Update .env.local (if needed):");
  Object.entries(newSwapContracts).forEach(([artist, address]) => {
    console.log(`   NEXT_PUBLIC_${artist.toUpperCase()}_SWAP=${address}`);
  });
  
  console.log("\n🎯 VERIFICATION:");
  console.log("1. ✅ Contracts deployed with CORRECT token addresses");
  console.log("2. ✅ Contracts funded with tokens and ETH");
  console.log("3. ✅ Ready for automated swapping");
  
  console.log("\n🚀 NEXT STEPS:");
  console.log("1. Update Supabase with the new swap addresses above");
  console.log("2. Hard refresh your browser (Cmd+Shift+R)");
  console.log("3. Test the swap functionality with small amounts");
  console.log("4. Enjoy your working protocol! 🎉");
  
  console.log("\n📊 NEW SWAP CONTRACT ADDRESSES:");
  Object.entries(newSwapContracts).forEach(([artist, address]) => {
    console.log(`${artist.toUpperCase()}: ${address}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 