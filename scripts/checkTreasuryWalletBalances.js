const { ethers } = require("ethers");

// Base Sepolia RPC
const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");

// Treasury wallet addresses from ARTIST_REGISTRY
const TREASURY_WALLETS = {
  gosheesh: "0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8",
  jaitea: "0x0B893D9D0dA09096C75e43c310316dC61b2773be"
};

// Minimum ETH required for testing (0.0002 ETH for gas)
const MIN_ETH_REQUIRED = ethers.parseEther("0.0002");

async function checkWalletBalances() {
  console.log("🔍 CHECKING TREASURY WALLET ETH BALANCES");
  console.log("========================================");
  
  let allWalletsReady = true;
  
  for (const [artist, walletAddress] of Object.entries(TREASURY_WALLETS)) {
    try {
      const balance = await provider.getBalance(walletAddress);
      const balanceEth = ethers.formatEther(balance);
      const hasSufficientFunds = balance >= MIN_ETH_REQUIRED;
      
      console.log(`${artist.toUpperCase()} Treasury (${walletAddress}):`);
      console.log(`  ETH Balance: ${balanceEth} ETH`);
      console.log(`  Sufficient for testing: ${hasSufficientFunds ? "✅ YES" : "❌ NO"}`);
      
      if (!hasSufficientFunds) {
        console.log(`  ⚠️  Needs at least 0.0002 ETH for gas fees`);
        allWalletsReady = false;
      }
      console.log("");
      
    } catch (error) {
      console.log(`${artist.toUpperCase()} Treasury: ❌ Error checking balance`);
      console.log(`  Error: ${error.message}`);
      console.log("");
      allWalletsReady = false;
    }
  }
  
  console.log("📊 SUMMARY:");
  console.log("===========");
  if (allWalletsReady) {
    console.log("✅ All treasury wallets have sufficient ETH for testing");
    console.log("🚀 Ready to proceed with USDC cash-out implementation");
  } else {
    console.log("❌ Some treasury wallets need more ETH");
    console.log("💡 Add ETH to wallets shown above before testing");
  }
  
  console.log("\n🎯 NEXT STEPS:");
  console.log("1. Ensure wallets have sufficient ETH (minimum 0.0002 ETH each)");
  console.log("2. Test small cash-out amounts (e.g., 100 tokens)");
  console.log("3. Verify USD balance appears in wallet component");
}

checkWalletBalances().catch(console.error); 