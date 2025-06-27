const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("🔑 Your actual deployer address:", signer.address);
  
  // Check balance
  const balance = await ethers.provider.getBalance(signer.address);
  console.log("💰 ETH Balance:", ethers.formatEther(balance), "ETH");
  
  // Check if you have TESTNET_PRIVATE_KEY set
  console.log("🔧 Using TESTNET_PRIVATE_KEY:", process.env.TESTNET_PRIVATE_KEY ? "YES" : "NO (using default Hardhat key)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 