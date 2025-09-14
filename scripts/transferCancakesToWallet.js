const { ethers } = require("hardhat");

async function transferCancakesTokens() {
  console.log("🍰 TRANSFERRING CANCAK33 TOKENS TO CANCAKES WALLET");
  console.log("================================================");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  
  const CANCAKES_TOKEN = "0xd88B1b69Cf6Cd4E52ad1F661fe24EF414D52f8";
  const CANCAKES_WALLET = "0xe42C291143e03f3Bd7D5a095815DAD3e82835C05";
  
  try {
    // Create contract without ENS resolution
    const abi = [
      "function balanceOf(address) view returns (uint256)",
      "function transfer(address, uint256) returns (bool)",
      "function symbol() view returns (string)"
    ];
    
    const tokenContract = new ethers.Contract(CANCAKES_TOKEN, abi, deployer);
    
    const symbol = await tokenContract.symbol();
    console.log(`Token: ${symbol}`);
    
    // Check balances
    const deployerBalance = await tokenContract.balanceOf(deployer.address);
    const cancakesBalance = await tokenContract.balanceOf(CANCAKES_WALLET);
    
    console.log(`\nDeployer balance: ${ethers.formatUnits(deployerBalance, 18)} tokens`);
    console.log(`CANCAKES wallet balance: ${ethers.formatUnits(cancakesBalance, 18)} tokens`);
    
    if (deployerBalance > 0 && cancakesBalance === 0n) {
      console.log(`\n🚀 Transferring 1B tokens to CANCAKES wallet...`);
      
      const transferAmount = ethers.parseUnits("1000000000", 18); // 1B tokens
      
      if (deployerBalance >= transferAmount) {
        const tx = await tokenContract.transfer(CANCAKES_WALLET, transferAmount);
        console.log(`Transaction sent: ${tx.hash}`);
        
        await tx.wait();
        console.log(`✅ Transfer confirmed!`);
        
        // Verify new balance
        const newBalance = await tokenContract.balanceOf(CANCAKES_WALLET);
        console.log(`New CANCAKES balance: ${ethers.formatUnits(newBalance, 18)} tokens`);
        
      } else {
        console.log(`❌ Not enough tokens. Need 1B, have ${ethers.formatUnits(deployerBalance, 18)}`);
      }
    } else if (cancakesBalance > 0) {
      console.log(`\n✅ CANCAKES wallet already has ${ethers.formatUnits(cancakesBalance, 18)} tokens!`);
    } else {
      console.log(`\n❌ No tokens in deployer wallet to transfer`);
    }
    
  } catch (error) {
    console.error("❌ Transfer failed:", error.message);
  }
}

transferCancakesTokens()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
