const { ethers } = require("hardhat");

async function mintCancakesTokens() {
  console.log("🪙 MINTING CANCAK33 TOKENS");
  console.log("=========================");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const TOKEN_ADDRESS = "0xdF0f956Be58D0ed027AbdF993A8c61e4cf31CA65";
  const CANCAKES_WALLET = "0xe42C291143e03f3Bd7D5a095815DAD3e82835C05";
  
  try {
    // Connect to the deployed token contract
    const tokenContract = new ethers.Contract(
      TOKEN_ADDRESS,
      [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function totalSupply() view returns (uint256)",
        "function balanceOf(address) view returns (uint256)",
        "function transfer(address, uint256) returns (bool)",
        "function mint(address, uint256) returns (bool)",
        "function owner() view returns (address)",
        "function initialMint() returns (bool)"
      ],
      deployer
    );
    
    console.log("📊 Current Token Status:");
    const name = await tokenContract.name();
    const symbol = await tokenContract.symbol();
    const totalSupply = await tokenContract.totalSupply();
    const owner = await tokenContract.owner();
    
    console.log("   Name:", name);
    console.log("   Symbol:", symbol);
    console.log("   Total Supply:", ethers.formatUnits(totalSupply, 18));
    console.log("   Owner:", owner);
    console.log("   Deployer:", deployer.address);
    
    if (totalSupply === 0n) {
      console.log("\n🚀 Attempting to mint tokens...");
      
      // Try initialMint first
      try {
        console.log("Trying initialMint()...");
        const mintTx = await tokenContract.initialMint();
        await mintTx.wait();
        console.log("✅ initialMint() successful!");
        
        const newSupply = await tokenContract.totalSupply();
        console.log("New total supply:", ethers.formatUnits(newSupply, 18));
        
        const cancakesBalance = await tokenContract.balanceOf(CANCAKES_WALLET);
        console.log("CANCAKES wallet balance:", ethers.formatUnits(cancakesBalance, 18));
        
      } catch (mintError) {
        console.log("❌ initialMint() failed:", mintError.message);
        
        // Try direct mint if initialMint fails
        try {
          console.log("Trying direct mint...");
          const mintAmount = ethers.parseUnits("10000000000", 18); // 10B tokens
          const directMintTx = await tokenContract.mint(deployer.address, mintAmount);
          await directMintTx.wait();
          console.log("✅ Direct mint successful!");
          
          // Transfer 1B to CANCAKES wallet
          const transferAmount = ethers.parseUnits("1000000000", 18); // 1B tokens
          const transferTx = await tokenContract.transfer(CANCAKES_WALLET, transferAmount);
          await transferTx.wait();
          console.log("✅ Transferred 1B to CANCAKES wallet!");
          
        } catch (directMintError) {
          console.log("❌ Direct mint also failed:", directMintError.message);
          console.log("💡 The contract might not have mint functions or deployer is not owner");
        }
      }
    } else {
      console.log("✅ Token already has supply!");
      
      const deployerBalance = await tokenContract.balanceOf(deployer.address);
      const cancakesBalance = await tokenContract.balanceOf(CANCAKES_WALLET);
      
      console.log("Deployer balance:", ethers.formatUnits(deployerBalance, 18));
      console.log("CANCAKES balance:", ethers.formatUnits(cancakesBalance, 18));
      
      // Transfer if needed
      if (deployerBalance > 0 && cancakesBalance === 0n) {
        const transferAmount = ethers.parseUnits("1000000000", 18); // 1B tokens
        if (deployerBalance >= transferAmount) {
          const transferTx = await tokenContract.transfer(CANCAKES_WALLET, transferAmount);
          await transferTx.wait();
          console.log("✅ Transferred 1B to CANCAKES wallet!");
        }
      }
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

mintCancakesTokens();
