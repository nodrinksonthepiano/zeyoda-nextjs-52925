const { ethers } = require("hardhat");

// CANCAKES contract and wallet info
const CANCAKES_TOKEN = "0xd88B1b69Cf6Cd4E52ad1F661fe24EF414D52f8";
const CANCAKES_WALLET = "0xe42C291143e03f3Bd7D5a095815DAD3e82835C05";

async function fixCancakesDistribution() {
  console.log("🍰 FIXING CANCAKES TOKEN DISTRIBUTION");
  console.log("===================================");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer ETH balance: ${ethers.formatEther(balance)} ETH`);
  
  try {
    // Connect to CANCAK33 token contract
    const tokenContract = new ethers.Contract(CANCAKES_TOKEN, [
      "function balanceOf(address owner) view returns (uint256)",
      "function transfer(address to, uint256 amount) returns (bool)",
      "function totalSupply() view returns (uint256)",
      "function symbol() view returns (string)"
    ], deployer);
    
    console.log("\n🔍 CURRENT TOKEN DISTRIBUTION:");
    
    const symbol = await tokenContract.symbol();
    const totalSupply = await tokenContract.totalSupply();
    
    console.log(`Token: ${symbol}`);
    console.log(`Total Supply: ${ethers.formatUnits(totalSupply, 18)} tokens`);
    console.log(`CANCAKES Wallet (expected): ${CANCAKES_WALLET}`);
    
    // Check current balances in key wallets
    const deployerBalance = await tokenContract.balanceOf(deployer.address);
    const cancakesBalance = await tokenContract.balanceOf(CANCAKES_WALLET);
    const gosheeshBalance = await tokenContract.balanceOf('0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8');
    const protocolBalance = await tokenContract.balanceOf('0x615258a5263DBEe0DDEED3166ddC1f442D937eB3');
    
    console.log("\n💰 CURRENT BALANCES:");
    console.log(`Deployer (${deployer.address}): ${ethers.formatUnits(deployerBalance, 18)} tokens`);
    console.log(`CANCAKES Wallet (${CANCAKES_WALLET}): ${ethers.formatUnits(cancakesBalance, 18)} tokens`);
    console.log(`GOSHEESH Wallet: ${ethers.formatUnits(gosheeshBalance, 18)} tokens`);
    console.log(`Protocol Wallet: ${ethers.formatUnits(protocolBalance, 18)} tokens`);
    
    // Check if we need to transfer tokens to CANCAKES wallet
    if (cancakesBalance === 0n && deployerBalance > 0) {
      console.log(`\n🔄 TRANSFERRING 1B CANCAK33 FROM DEPLOYER TO CANCAKES WALLET...`);
      const transferAmount = ethers.parseUnits("1000000000", 18); // 1B tokens
      
      if (deployerBalance >= transferAmount) {
        const tx = await tokenContract.transfer(CANCAKES_WALLET, transferAmount);
        await tx.wait();
        console.log(`✅ Transferred 1B CANCAK33 to CANCAKES wallet!`);
        console.log(`Transaction: ${tx.hash}`);
        
        // Check new balance
        const newBalance = await tokenContract.balanceOf(CANCAKES_WALLET);
        console.log(`New CANCAKES balance: ${ethers.formatUnits(newBalance, 18)} tokens`);
      } else {
        console.log(`❌ Insufficient balance. Deployer has ${ethers.formatUnits(deployerBalance, 18)} tokens`);
      }
    } else if (cancakesBalance > 0) {
      console.log("\n✅ CANCAKES WALLET ALREADY HAS TOKENS!");
      console.log(`Balance: ${ethers.formatUnits(cancakesBalance, 18)} tokens`);
    } else {
      console.log("\n❌ NO TOKENS FOUND IN DEPLOYER WALLET");
      console.log("The tokens might be in a different wallet or not minted yet.");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

fixCancakesDistribution()
  .then(() => {
    console.log("\n✅ Distribution check complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
