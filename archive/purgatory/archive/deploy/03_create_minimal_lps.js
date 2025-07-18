const { ethers } = require("hardhat");

async function main() {
  console.log("🏊 Creating Minimal Liquidity Pools...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Get account balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");
  
  // Contract addresses (from master prompt)
  const SWAP_CONTRACT = "0xb9Fd7D8111F462cdB58EB7E1D18EA3016142Fa35";
  const GOSHEESH_TOKEN = "0x91EA826b3ff30272fDe475db012D7304dd6Dac1a";
  const JAITEA_TOKEN = "0xDb2D5F722C0AF730a0fd737650f865ED296D79c1";
  
  // Get contract instances
  const swapABI = [
    "function createPool(address token, uint256 tokenAmount) external payable",
    "function getPool(address token) external view returns (tuple(address token, uint256 tokenReserve, uint256 ethReserve, bool active))",
    "event PoolCreated(address indexed token, uint256 tokenAmount, uint256 ethAmount)"
  ];
  
  const erc20ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)"
  ];
  
  const swapContract = new ethers.Contract(SWAP_CONTRACT, swapABI, deployer);
  const gosheeshContract = new ethers.Contract(GOSHEESH_TOKEN, erc20ABI, deployer);
  const jaiteaContract = new ethers.Contract(JAITEA_TOKEN, erc20ABI, deployer);
  
  // Check token balances
  const gosheeshBalance = await gosheeshContract.balanceOf(deployer.address);
  const jaiteaBalance = await jaiteaContract.balanceOf(deployer.address);
  
  console.log("Token Balances:");
  console.log(`GOSHEESH: ${ethers.formatUnits(gosheeshBalance, 18)} tokens`);
  console.log(`JAITEA: ${ethers.formatUnits(jaiteaBalance, 18)} tokens\n`);
  
  // MINIMAL AMOUNTS for testing
  const GOSHEESH_AMOUNT = ethers.parseUnits("10000000", 18); // 10M tokens  
  const GOSHEESH_ETH = ethers.parseEther("0.01");            // 0.01 ETH (~$24)
  
  const JAITEA_AMOUNT = ethers.parseUnits("5000000", 18);    // 5M tokens
  const JAITEA_ETH = ethers.parseEther("0.005");             // 0.005 ETH (~$12)
  
  console.log("Minimal LP Creation Plan:");
  console.log(`GOSHEESH: ${ethers.formatUnits(GOSHEESH_AMOUNT, 18)} tokens + ${ethers.formatEther(GOSHEESH_ETH)} ETH`);
  console.log(`JAITEA: ${ethers.formatUnits(JAITEA_AMOUNT, 18)} tokens + ${ethers.formatEther(JAITEA_ETH)} ETH\n`);
  
  // Check if pools already exist
  try {
    const gosheeshPool = await swapContract.getPool(GOSHEESH_TOKEN);
    if (gosheeshPool.active) {
      console.log("⚠️ GOSHEESH pool already exists, skipping...");
    } else {
      console.log("📊 Creating GOSHEESH Liquidity Pool...");
      
      // Approve tokens
      console.log("- Approving GOSHEESH tokens...");
      const gosheeshApprove = await gosheeshContract.approve(SWAP_CONTRACT, GOSHEESH_AMOUNT);
      await gosheeshApprove.wait();
      console.log("✅ GOSHEESH tokens approved");
      
      // Create pool
      console.log("- Creating GOSHEESH pool...");
      const gosheeshTx = await swapContract.createPool(GOSHEESH_TOKEN, GOSHEESH_AMOUNT, {
        value: GOSHEESH_ETH,
        gasLimit: 500000
      });
      
      console.log("- Transaction hash:", gosheeshTx.hash);
      const gosheeshReceipt = await gosheeshTx.wait();
      console.log("✅ GOSHEESH pool created successfully!\n");
    }
  } catch (error) {
    console.error("❌ Error creating GOSHEESH pool:", error.message, "\n");
  }
  
  try {
    const jaiteaPool = await swapContract.getPool(JAITEA_TOKEN);
    if (jaiteaPool.active) {
      console.log("⚠️ JAITEA pool already exists, skipping...");
    } else {
      console.log("📊 Creating JAITEA Liquidity Pool...");
      
      // Approve tokens
      console.log("- Approving JAITEA tokens...");
      const jaiteaApprove = await jaiteaContract.approve(SWAP_CONTRACT, JAITEA_AMOUNT);
      await jaiteaApprove.wait();
      console.log("✅ JAITEA tokens approved");
      
      // Create pool
      console.log("- Creating JAITEA pool...");
      const jaiteaTx = await swapContract.createPool(JAITEA_TOKEN, JAITEA_AMOUNT, {
        value: JAITEA_ETH,
        gasLimit: 500000
      });
      
      console.log("- Transaction hash:", jaiteaTx.hash);
      const jaiteaReceipt = await jaiteaTx.wait();
      console.log("✅ JAITEA pool created successfully!\n");
    }
  } catch (error) {
    console.error("❌ Error creating JAITEA pool:", error.message, "\n");
  }
  
  // Verify both pools
  console.log("🔍 Verifying Pool Creation...");
  try {
    const gosheeshPoolFinal = await swapContract.getPool(GOSHEESH_TOKEN);
    const jaiteaPoolFinal = await swapContract.getPool(JAITEA_TOKEN);
    
    console.log("\n✅ Final Pool Status:");
    console.log("GOSHEESH Pool:", {
      active: gosheeshPoolFinal.active,
      tokenReserve: ethers.formatUnits(gosheeshPoolFinal.tokenReserve, 18),
      ethReserve: ethers.formatEther(gosheeshPoolFinal.ethReserve)
    });
    
    console.log("JAITEA Pool:", {
      active: jaiteaPoolFinal.active,
      tokenReserve: ethers.formatUnits(jaiteaPoolFinal.tokenReserve, 18),
      ethReserve: ethers.formatEther(jaiteaPoolFinal.ethReserve)
    });
    
    // Calculate initial prices
    if (gosheeshPoolFinal.active && gosheeshPoolFinal.ethReserve > 0) {
      const gosheeshPrice = Number(ethers.formatEther(gosheeshPoolFinal.ethReserve)) / Number(ethers.formatUnits(gosheeshPoolFinal.tokenReserve, 18));
      console.log(`\n💰 GOSHEESH Initial Price: ${gosheeshPrice.toExponential(4)} ETH per token`);
      console.log(`💰 GOSHEESH Initial Price: $${(gosheeshPrice * 2400).toFixed(6)} USD (assuming ETH = $2400)`);
    }
    
    if (jaiteaPoolFinal.active && jaiteaPoolFinal.ethReserve > 0) {
      const jaiteaPrice = Number(ethers.formatEther(jaiteaPoolFinal.ethReserve)) / Number(ethers.formatUnits(jaiteaPoolFinal.tokenReserve, 18));
      console.log(`💰 JAITEA Initial Price: ${jaiteaPrice.toExponential(4)} ETH per token`);
      console.log(`💰 JAITEA Initial Price: $${(jaiteaPrice * 2400).toFixed(6)} USD (assuming ETH = $2400)`);
    }
    
  } catch (error) {
    console.error("❌ Error verifying pools:", error.message);
  }
  
  console.log("\n🎉 Minimal Liquidity Pool Deployment Complete!");
  console.log("\n🔄 Next Steps:");
  console.log("1. Visit the app at http://localhost:3000");
  console.log("2. Check that pricing now shows 'Live Price ●' indicators");
  console.log("3. Test token calculations with real LP pricing");
  console.log("4. Verify cross-token swaps work through ETH routing");
}

main()
  .then(() => {
    console.log("\n✅ Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  }); 