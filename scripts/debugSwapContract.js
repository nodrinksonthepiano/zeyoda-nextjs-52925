const { ethers } = require("hardhat");

async function debugSwapContract() {
  console.log("🔍 DEBUGGING SWAP CONTRACT FOR CANCAKES");
  console.log("======================================");
  
  const [deployer] = await ethers.getSigners();
  const MAIN_SWAP_ADDRESS = "0xb9Fd7D8111F462cdB58EB7E1D18EA3016142Fa35";
  const CANCAK33_TOKEN = "0xdF0f956Be58D0ed027AbdF993A8c61e4cf31CA65";
  
  try {
    // Check if the swap contract exists and is working
    const swapContract = new ethers.Contract(
      MAIN_SWAP_ADDRESS,
      [
        "function getPool(address token) external view returns (tuple(address token, uint256 tokenReserve, uint256 ethReserve, bool active))",
        "function owner() external view returns (address)",
        "function paused() external view returns (bool)"
      ],
      deployer
    );
    
    console.log("📊 Swap Contract Status:");
    
    try {
      const owner = await swapContract.owner();
      console.log("   Owner:", owner);
      console.log("   Deployer:", deployer.address);
      console.log("   Is Deployer Owner:", owner.toLowerCase() === deployer.address.toLowerCase());
    } catch (e) {
      console.log("   ❌ Can't get owner:", e.message);
    }
    
    try {
      const paused = await swapContract.paused();
      console.log("   Paused:", paused);
    } catch (e) {
      console.log("   ⚠️ Can't check paused status (might not have this function)");
    }
    
    // Check existing pools
    console.log("\n📊 Existing Pools:");
    const tokens = [
      { name: "GOSH33SH", address: "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac" },
      { name: "JAIT33", address: "0x9D06564a8D98e146CAb1dE74BF815bf05d24D685" },
      { name: "CANCAK33", address: CANCAK33_TOKEN }
    ];
    
    for (const token of tokens) {
      try {
        const pool = await swapContract.getPool(token.address);
        console.log(`   ${token.name}:`, {
          active: pool.active,
          tokenReserve: ethers.formatUnits(pool.tokenReserve || 0, 18),
          ethReserve: ethers.formatEther(pool.ethReserve || 0)
        });
      } catch (e) {
        console.log(`   ${token.name}: ❌ Error -`, e.message);
      }
    }
    
    // Check CANCAK33 token allowance and balance
    console.log("\n📊 CANCAK33 Token Status:");
    const tokenContract = new ethers.Contract(
      CANCAK33_TOKEN,
      [
        "function balanceOf(address) view returns (uint256)",
        "function allowance(address, address) view returns (uint256)",
        "function symbol() view returns (string)"
      ],
      deployer
    );
    
    const balance = await tokenContract.balanceOf(deployer.address);
    const allowance = await tokenContract.allowance(deployer.address, MAIN_SWAP_ADDRESS);
    const symbol = await tokenContract.symbol();
    
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Deployer Balance: ${ethers.formatUnits(balance, 18)}`);
    console.log(`   Allowance for Swap: ${ethers.formatUnits(allowance, 18)}`);
    
    // Try to understand why the createPool call failed
    console.log("\n🔍 Potential Issues:");
    
    if (balance < ethers.parseUnits("100000000", 18)) {
      console.log("   ❌ Insufficient tokens for LP");
    } else {
      console.log("   ✅ Sufficient tokens for LP");
    }
    
    if (allowance < ethers.parseUnits("100000000", 18)) {
      console.log("   ❌ Insufficient allowance (but we just approved)");
    } else {
      console.log("   ✅ Sufficient allowance");
    }
    
    const ethBalance = await ethers.provider.getBalance(deployer.address);
    if (ethBalance < ethers.parseEther("0.02")) {
      console.log("   ❌ Insufficient ETH for LP");
    } else {
      console.log("   ✅ Sufficient ETH for LP");
    }
    
    console.log("\n💡 Possible Solutions:");
    console.log("1. Check if swap contract has restrictions on who can create pools");
    console.log("2. Check if there's a minimum token amount requirement");
    console.log("3. Try with different LP amounts");
    console.log("4. Check if the token needs to be whitelisted first");
    
  } catch (error) {
    console.error("❌ Debug failed:", error.message);
  }
}

debugSwapContract();
