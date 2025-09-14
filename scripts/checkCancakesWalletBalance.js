const { ethers } = require("hardhat");

async function checkCancakesWalletBalance() {
  console.log("💰 CHECKING CANCAKES WALLET BALANCE");
  console.log("===================================");
  
  const CANCAK33_TOKEN = "0xdF0f956Be58D0ed027AbdF993A8c61e4cf31CA65";
  const CANCAKES_WALLET = "0xe42C291143e03f3Bd7D5a095815DAD3e82835C05";
  
  try {
    const [deployer] = await ethers.getSigners();
    
    const tokenContract = new ethers.Contract(
      CANCAK33_TOKEN,
      [
        "function balanceOf(address) view returns (uint256)",
        "function symbol() view returns (string)",
        "function name() view returns (string)"
      ],
      deployer
    );
    
    const symbol = await tokenContract.symbol();
    const name = await tokenContract.name();
    const balance = await tokenContract.balanceOf(CANCAKES_WALLET);
    
    console.log("📊 Token Info:");
    console.log("   Name:", name);
    console.log("   Symbol:", symbol);
    console.log("   Contract:", CANCAK33_TOKEN);
    
    console.log("\n💰 CANCAKES Wallet Balance:");
    console.log("   Wallet:", CANCAKES_WALLET);
    console.log("   Balance:", ethers.formatUnits(balance, 18), "CANCAK33");
    console.log("   Raw Balance:", balance.toString());
    
    if (balance > 0) {
      console.log("\n✅ CANCAKES wallet has tokens!");
      console.log("💡 If not showing in frontend, check:");
      console.log("   1. useWalletBalances hook is querying correct address");
      console.log("   2. artistConfig contains correct contract address");
      console.log("   3. Registry is loading correctly");
    } else {
      console.log("\n❌ CANCAKES wallet has no tokens!");
      console.log("💡 Need to transfer tokens from deployer");
    }
    
  } catch (error) {
    console.error("❌ Error checking balance:", error.message);
  }
}

checkCancakesWalletBalance();
