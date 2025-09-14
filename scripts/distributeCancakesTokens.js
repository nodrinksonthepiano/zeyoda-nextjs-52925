const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const tokenAddress = "0xd88B1b69Cf6Cd4E52ad1F661fe24EF414D52f8";
  const cancakesWallet = "0xe42C291143e03f3Bd7D5a095815DAD3e82835C05";
  
  const token = new ethers.Contract(tokenAddress, [
    "function transfer(address, uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ], deployer);
  
  // Transfer 1B tokens to CANCAKES wallet
  const transferAmount = ethers.parseUnits("1000000000", 18);
  const tx = await token.transfer(cancakesWallet, transferAmount);
  await tx.wait();
  
  console.log("✅ Transferred 1B CANCAK33 to CANCAKES wallet");
  console.log("Transaction:", tx.hash);
}

main().catch(console.error);
