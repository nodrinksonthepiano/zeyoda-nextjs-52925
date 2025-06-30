const { task } = require("hardhat/config");

task("seed-lp", "Seed liquidity pool for an artist token")
  .addParam("token", "Token contract address")
  .addParam("artist", "Artist ID for logging")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    
    console.log(`🏊 Seeding LP for ${taskArgs.artist} (${taskArgs.token})`);
    
    const [deployer] = await ethers.getSigners();
    console.log("Protocol deployer:", deployer.address);
    
    // Contract addresses (NEW - with correct ownership)
    const SWAP_CONTRACT = "0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE";
    
    // Get token contract
    const erc20ABI = [
      "function totalSupply() external view returns (uint256)",
      "function balanceOf(address owner) external view returns (uint256)",
      "function approve(address spender, uint256 amount) external returns (bool)",
      "function symbol() external view returns (string)"
    ];
    
    const tokenContract = new ethers.Contract(taskArgs.token, erc20ABI, deployer);
    
    // Get token info
    const totalSupply = await tokenContract.totalSupply();
    const symbol = await tokenContract.symbol();
    const protocolBalance = await tokenContract.balanceOf(deployer.address);
    
    console.log(`📊 Token Info:`);
    console.log(`  Symbol: ${symbol}`);
    console.log(`  Total Supply: ${ethers.formatUnits(totalSupply, 18)}`);
    console.log(`  Protocol Balance: ${ethers.formatUnits(protocolBalance, 18)}`);
    
    // Calculate LP seed amounts dynamically
    const lpTokens = totalSupply / 100n; // 1% of total supply
    const lpEth = ethers.parseEther("0.01"); // 0.01 ETH constant
    
    console.log(`\n💰 LP Seed Calculation:`);
    console.log(`  LP Tokens: ${ethers.formatUnits(lpTokens, 18)} (1% of supply)`);
    console.log(`  LP ETH: ${ethers.formatEther(lpEth)} ETH`);
    
    // Check if we have enough tokens
    if (protocolBalance < lpTokens) {
      throw new Error(`Insufficient protocol token balance. Need: ${ethers.formatUnits(lpTokens, 18)}, Have: ${ethers.formatUnits(protocolBalance, 18)}`);
    }
    
    // Check deployer ETH balance
    const ethBalance = await ethers.provider.getBalance(deployer.address);
    if (ethBalance < lpEth + ethers.parseEther("0.005")) { // Extra for gas
      throw new Error(`Insufficient ETH balance. Need: ${ethers.formatEther(lpEth + ethers.parseEther("0.005"))}, Have: ${ethers.formatEther(ethBalance)}`);
    }
    
    // Get swap contract
    const swapABI = [
      "function createPool(address token, uint256 tokenAmount) external payable",
      "function getPool(address token) external view returns (tuple(address token, uint256 tokenReserve, uint256 ethReserve, bool active))"
    ];
    
    const swapContract = new ethers.Contract(SWAP_CONTRACT, swapABI, deployer);
    
    // Check if pool already exists
    const existingPool = await swapContract.getPool(taskArgs.token);
    if (existingPool.active) {
      console.log(`⚠️ Pool already exists for ${symbol}, skipping...`);
      console.log(`  Token Reserve: ${ethers.formatUnits(existingPool.tokenReserve, 18)}`);
      console.log(`  ETH Reserve: ${ethers.formatEther(existingPool.ethReserve)}`);
      return;
    }
    
    console.log(`\n🔄 Creating Liquidity Pool...`);
    
    // Step 1: Approve tokens
    console.log("- Approving tokens...");
    const approveTx = await tokenContract.approve(SWAP_CONTRACT, lpTokens);
    await approveTx.wait();
    console.log("✅ Tokens approved");
    
    // Step 2: Create pool
    console.log("- Creating pool...");
    const createPoolTx = await swapContract.createPool(taskArgs.token, lpTokens, {
      value: lpEth,
      gasLimit: 500000
    });
    
    console.log(`  Transaction: ${createPoolTx.hash}`);
    const receipt = await createPoolTx.wait();
    console.log("✅ Pool created successfully!");
    
    // Step 3: Verify pool
    console.log("\n🔍 Verifying pool creation...");
    const newPool = await swapContract.getPool(taskArgs.token);
    
    console.log(`✅ ${symbol} Pool Created:`);
    console.log(`  Active: ${newPool.active}`);
    console.log(`  Token Reserve: ${ethers.formatUnits(newPool.tokenReserve, 18)}`);
    console.log(`  ETH Reserve: ${ethers.formatEther(newPool.ethReserve)}`);
    
    // Calculate initial price
    if (newPool.active && newPool.ethReserve > 0) {
      const ethPerToken = Number(ethers.formatEther(newPool.ethReserve)) / Number(ethers.formatUnits(newPool.tokenReserve, 18));
      console.log(`\n💰 Initial Price:`);
      console.log(`  ${ethPerToken.toExponential(4)} ETH per ${symbol}`);
      console.log(`  $${(ethPerToken * 2400).toFixed(6)} USD per ${symbol} (assuming ETH = $2400)`);
    }
    
    console.log(`\n🎉 LP seeding complete for ${taskArgs.artist}!`);
    console.log(`\n📝 Next steps:`);
    console.log(`1. Update Supabase with lp_pair address (if using router)`);
    console.log(`2. Frontend will automatically detect and use live pricing`);
    console.log(`3. Test at http://localhost:3000?artist=${taskArgs.artist}`);
  });

module.exports = {}; 