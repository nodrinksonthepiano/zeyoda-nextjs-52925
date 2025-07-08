// archived 2024-03-19 — debug script for investigating swap contract issues during initial deployment
const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 DEBUGGING SWAP CONTRACT");
  console.log("=========================\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const MAIN_SWAP_ADDRESS = "0xb9Fd7D8111F462cdB58EB7E1D18EA3016142Fa35";
  const GOSH33SH_TOKEN = "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac";
  
  // Full Swap contract ABI
  const swapABI = [
    "function owner() external view returns (address)",
    "function paused() external view returns (bool)",
    "function createPool(address token, uint256 tokenAmount) external payable",
    "function getPool(address token) external view returns (tuple(address token, uint256 tokenReserve, uint256 ethReserve, bool active))",
    "function supportedTokens(uint256) external view returns (address)",
    "event PoolCreated(address indexed token, uint256 tokenAmount, uint256 ethAmount)",
    "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)"
  ];
  
  const swapContract = new ethers.Contract(MAIN_SWAP_ADDRESS, swapABI, deployer);
  
  console.log("📊 CONTRACT STATUS:");
  
  try {
    const owner = await swapContract.owner();
    console.log(`  Owner: ${owner}`);
    console.log(`  Deployer: ${deployer.address}`);
    console.log(`  Is Owner: ${owner.toLowerCase() === deployer.address.toLowerCase()}`);
  } catch (error) {
    console.log(`  Owner check failed: ${error.message}`);
  }
  
  try {
    const paused = await swapContract.paused();
    console.log(`  Paused: ${paused}`);
  } catch (error) {
    console.log(`  Pause check failed: ${error.message}`);
  }
  
  // Check if we can access supportedTokens (indicates contract is properly deployed)
  try {
    const supportedToken0 = await swapContract.supportedTokens(0);
    console.log(`  First supported token: ${supportedToken0}`);
  } catch (error) {
    console.log(`  No supported tokens yet (expected for new contract)`);
  }
  
  // Test token approval and balance
  const erc20ABI = [
    "function balanceOf(address owner) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)"
  ];
  
  const tokenContract = new ethers.Contract(GOSH33SH_TOKEN, erc20ABI, deployer);
  
  console.log("\n💰 TOKEN STATUS:");
  const balance = await tokenContract.balanceOf(deployer.address);
  const allowance = await tokenContract.allowance(deployer.address, MAIN_SWAP_ADDRESS);
  
  console.log(`  GOSH33SH Balance: ${ethers.formatUnits(balance, 18)}`);
  console.log(`  GOSH33SH Allowance: ${ethers.formatUnits(allowance, 18)}`);
  
  // Try to simulate the transaction
  console.log("\n🧪 SIMULATING TRANSACTION:");
  const lpTokens = ethers.parseUnits("10000000", 18);
  const lpETH = ethers.parseEther("0.01");
  
  try {
    // First test if we need to approve more tokens
    if (allowance < lpTokens) {
      console.log("- Need to approve more tokens first");
      const approveTx = await tokenContract.approve(MAIN_SWAP_ADDRESS, lpTokens);
      await approveTx.wait();
      console.log("✅ Tokens approved");
    }
    
    // Try to estimate gas for the createPool call
    const gasEstimate = await swapContract.createPool.estimateGas(GOSH33SH_TOKEN, lpTokens, {
      value: lpETH
    });
    
    console.log(`✅ Gas estimate: ${gasEstimate.toString()}`);
    console.log("Transaction should succeed!");
    
  } catch (error) {
    console.log(`❌ Transaction would fail: ${error.message}`);
    
    // Additional debugging
    if (error.message.includes("Ownable")) {
      console.log("💡 Issue: Only owner can create pools");
    }
    if (error.message.includes("Pausable")) {
      console.log("💡 Issue: Contract is paused");
    }
    if (error.message.includes("Pool already exists")) {
      console.log("💡 Issue: Pool already exists for this token");
    }
    if (error.message.includes("Invalid")) {
      console.log("💡 Issue: Invalid token address or amounts");
    }
  }
  
  // Let's also check the bytecode to ensure the contract is deployed correctly
  console.log("\n🔧 CONTRACT DEPLOYMENT CHECK:");
  const code = await ethers.provider.getCode(MAIN_SWAP_ADDRESS);
  if (code === "0x") {
    console.log("❌ Contract not deployed at this address!");
  } else {
    console.log(`✅ Contract deployed (${code.length} bytes)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
