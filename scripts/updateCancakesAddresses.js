const { ethers } = require("hardhat");

async function updateCancakesAddresses() {
  console.log("🔧 UPDATING CANCAKES ADDRESSES");
  console.log("==============================");
  
  // We have a new complete token address from the deployment
  const NEW_TOKEN_ADDRESS = "0xdF0f956Be58D0ed027AbdF993A8c61e4cf31CA65";
  const CANCAKES_WALLET = "0xe42C291143e03f3Bd7D5a095815DAD3e82835C05";
  
  console.log("✅ New CANCAKES token address:", NEW_TOKEN_ADDRESS);
  console.log("✅ CANCAKES wallet:", CANCAKES_WALLET);
  
  try {
    // Check if token has supply
    const [deployer] = await ethers.getSigners();
    const tokenContract = new ethers.Contract(
      NEW_TOKEN_ADDRESS,
      [
        "function name() view returns (string)",
        "function symbol() view returns (string)", 
        "function totalSupply() view returns (uint256)",
        "function balanceOf(address) view returns (uint256)",
        "function transfer(address, uint256) returns (bool)"
      ],
      deployer
    );
    
    const name = await tokenContract.name();
    const symbol = await tokenContract.symbol();
    const totalSupply = await tokenContract.totalSupply();
    const deployerBalance = await tokenContract.balanceOf(deployer.address);
    const cancakesBalance = await tokenContract.balanceOf(CANCAKES_WALLET);
    
    console.log("📊 Token Info:");
    console.log("   Name:", name);
    console.log("   Symbol:", symbol);
    console.log("   Total Supply:", ethers.formatUnits(totalSupply, 18));
    console.log("   Deployer Balance:", ethers.formatUnits(deployerBalance, 18));
    console.log("   CANCAKES Balance:", ethers.formatUnits(cancakesBalance, 18));
    
    // If deployer has tokens and CANCAKES has none, transfer 1B
    if (deployerBalance > 0 && cancakesBalance === 0n) {
      console.log("\\n🚀 Transferring 1B CANCAK33 to CANCAKES wallet...");
      const transferAmount = ethers.parseUnits("1000000000", 18); // 1B tokens
      
      if (deployerBalance >= transferAmount) {
        const tx = await tokenContract.transfer(CANCAKES_WALLET, transferAmount);
        console.log("Transaction sent:", tx.hash);
        await tx.wait();
        console.log("✅ Transfer completed!");
        
        const newBalance = await tokenContract.balanceOf(CANCAKES_WALLET);
        console.log("New CANCAKES balance:", ethers.formatUnits(newBalance, 18));
      } else {
        console.log("❌ Not enough tokens in deployer wallet");
      }
    }
    
    // For now, we'll use GOSHEESH's swap temporarily until we deploy a new one
    const TEMP_SWAP_ADDRESS = "0xFCdc6C04bC0e1625178883c64567e1218Ee97DFf";
    const DOWNLOADS_ADDRESS = "0x1942756cA3dc2484b55E3417551159b56F66d467";
    
    console.log("\\n📝 REQUIRED SQL UPDATES:");
    console.log("Copy and run this SQL in your Supabase SQL Editor:");
    console.log("```sql");
    console.log("-- Update CANCAKES with complete token address");
    console.log(`UPDATE artist_registry SET`);
    console.log(`  token = '${NEW_TOKEN_ADDRESS}',`);
    console.log(`  swap = '${TEMP_SWAP_ADDRESS}',`);
    console.log(`  downloads = '${DOWNLOADS_ADDRESS}'`);
    console.log(`WHERE id = 'cancakes';`);
    console.log("");
    console.log(`UPDATE artists SET`);
    console.log(`  token_address = '${NEW_TOKEN_ADDRESS}',`);
    console.log(`  download_address = '${DOWNLOADS_ADDRESS}'`);
    console.log(`WHERE id = 'cancakes';`);
    console.log("");
    console.log("-- Verify the updates");
    console.log("SELECT id, token, swap, downloads FROM artist_registry WHERE id = 'cancakes';");
    console.log("```");
    
    console.log("\\n🎉 ADDRESSES READY TO UPDATE!");
    console.log("📊 Summary:");
    console.log("   ✅ Complete Token Address:", NEW_TOKEN_ADDRESS);
    console.log("   ✅ Swap Address (temp):", TEMP_SWAP_ADDRESS);
    console.log("   ✅ Downloads Address:", DOWNLOADS_ADDRESS);
    console.log("");
    console.log("🚀 After running the SQL:");
    console.log("   - CANCAK33 should appear in swap options");
    console.log("   - 1B CANCAK33 should be in CANCAKES wallet");
    console.log("   - System should be fully functional");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

updateCancakesAddresses();
