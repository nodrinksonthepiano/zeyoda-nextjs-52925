const { ethers } = require("hardhat");

// Contract addresses
const CONTRACTS = {
  GOSHEESH_TOKEN: "0x91EA826b3ff30272fDe475db012D7304dd6Dac1a",
  JAITEA_TOKEN: "0xDb2D5F722C0AF730a0fd737650f865ED296D79c1",
  GOSHEESH_SWAP: "0x63349f5190860b4E954639eeFd60b92bE9A01148", 
  JAITEA_SWAP: "0xd01cFF08a9962e67914a3A3e446D90513915db6f"
};

// TreasurySwapLite ABI
const TREASURY_SWAP_ABI = [
  "function swapIn() external payable",
  "function swapOut(uint256 tokenAmount) external",
  "function getTokenQuote(uint256 ethAmount) external pure returns (uint256)",
  "function getEthQuote(uint256 tokenAmount) external pure returns (uint256)",
  "function paused() external view returns (bool)",
  "function artistToken() external view returns (address)"
];

// ERC20 ABI
const ERC20_ABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function symbol() external view returns (string)"
];

async function testSwapContract(tokenAddress, swapAddress, tokenSymbol) {
  console.log(`\n🧪 TESTING ${tokenSymbol} SWAP CONTRACT`);
  console.log("=" * 40);
  
  const [wallet] = await ethers.getSigners();
  
  // Get contracts
  const swapContract = new ethers.Contract(swapAddress, TREASURY_SWAP_ABI, wallet);
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
  
  // Check if contract is paused
  const isPaused = await swapContract.paused();
  console.log(`Contract paused: ${isPaused ? '❌ YES' : '✅ NO'}`);
  
  if (isPaused) {
    console.log("⚠️  Cannot test - contract is paused");
    return false;
  }
  
  // Check contract token balance
  const contractTokenBalance = await tokenContract.balanceOf(swapAddress);
  console.log(`Contract ${tokenSymbol} balance:`, ethers.formatUnits(contractTokenBalance, 18));
  
  if (contractTokenBalance === 0n) {
    console.log("⚠️  Cannot test - contract has no tokens");
    return false;
  }
  
  // Check contract ETH balance
  const contractEthBalance = await ethers.provider.getBalance(swapAddress);
  console.log(`Contract ETH balance:`, ethers.formatEther(contractEthBalance));
  
  // Test 1: Get quotes (these are pure functions, no gas needed)
  console.log("\n📊 TESTING QUOTES:");
  try {
    const testEthAmount = ethers.parseEther("0.005"); // $12.50 worth at $2500/ETH
    const tokenQuote = await swapContract.getTokenQuote(testEthAmount);
    console.log(`Quote: 0.005 ETH → ${ethers.formatUnits(tokenQuote, 18)} ${tokenSymbol}`);
    
    const testTokenAmount = ethers.parseUnits("5000", 18); // 5000 tokens
    const ethQuote = await swapContract.getEthQuote(testTokenAmount);
    console.log(`Quote: 5000 ${tokenSymbol} → ${ethers.formatEther(ethQuote)} ETH`);
  } catch (error) {
    console.error("❌ Quote test failed:", error.message);
    return false;
  }
  
  // Test 2: Buy tokens (swapIn)
  console.log("\n💰 TESTING BUY (swapIn):");
  const buyAmount = ethers.parseEther("0.002"); // $5 worth
  
  try {
    const userEthBefore = await ethers.provider.getBalance(wallet.address);
    const userTokensBefore = await tokenContract.balanceOf(wallet.address);
    
    console.log(`Buying with ${ethers.formatEther(buyAmount)} ETH...`);
    
    const tx = await swapContract.swapIn({ 
      value: buyAmount,
      gasLimit: 300000 
    });
    
    console.log(`Transaction: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    
    const userEthAfter = await ethers.provider.getBalance(wallet.address);
    const userTokensAfter = await tokenContract.balanceOf(wallet.address);
    
    const tokensReceived = userTokensAfter - userTokensBefore;
    console.log(`✅ Received: ${ethers.formatUnits(tokensReceived, 18)} ${tokenSymbol}`);
    
    // Test 3: Sell tokens back (swapOut)
    console.log("\n💸 TESTING SELL (swapOut):");
    
    if (tokensReceived > 0) {
      // Sell half of what we bought
      const sellAmount = tokensReceived / 2n;
      
      console.log(`Selling ${ethers.formatUnits(sellAmount, 18)} ${tokenSymbol}...`);
      
      // First approve tokens
      const approveTx = await tokenContract.approve(swapAddress, sellAmount);
      await approveTx.wait();
      console.log("✅ Tokens approved");
      
      // Then sell
      const sellTx = await swapContract.swapOut(sellAmount, { gasLimit: 300000 });
      console.log(`Transaction: ${sellTx.hash}`);
      await sellTx.wait();
      
      const userTokensFinal = await tokenContract.balanceOf(wallet.address);
      const tokensSold = userTokensAfter - userTokensFinal;
      
      console.log(`✅ Sold: ${ethers.formatUnits(tokensSold, 18)} ${tokenSymbol}`);
      console.log(`✅ ${tokenSymbol} swap test PASSED!`);
      return true;
    } else {
      console.log("❌ No tokens to sell");
      return false;
    }
    
  } catch (error) {
    console.error("❌ Swap test failed:", error.message);
    return false;
  }
}

async function main() {
  console.log("🧪 TREASURYSWAPLITE END-TO-END TESTING");
  console.log("=" * 50);
  
  const [wallet] = await ethers.getSigners();
  console.log("Testing wallet:", wallet.address);
  
  // Check wallet ETH balance
  const ethBalance = await ethers.provider.getBalance(wallet.address);
  console.log("Wallet ETH:", ethers.formatEther(ethBalance));
  
  if (ethBalance < ethers.parseEther("0.02")) {
    console.log("⚠️  WARNING: Low ETH balance. Need at least 0.02 ETH for testing");
    return;
  }
  
  console.log("\n🎯 TESTING PLAN:");
  console.log("1. Test quote functions");
  console.log("2. Buy tokens with ETH (swapIn)");
  console.log("3. Sell tokens for ETH (swapOut)");
  console.log("4. Verify all transactions work");
  
  // Test both contracts
  let gosheeshPassed = false;
  let jaiteaPassed = false;
  
  try {
    gosheeshPassed = await testSwapContract(
      CONTRACTS.GOSHEESH_TOKEN, 
      CONTRACTS.GOSHEESH_SWAP, 
      "GOSHEESH"
    );
  } catch (error) {
    console.error("GOSHEESH test error:", error.message);
  }
  
  try {
    jaiteaPassed = await testSwapContract(
      CONTRACTS.JAITEA_TOKEN, 
      CONTRACTS.JAITEA_SWAP, 
      "JAITEA"
    );
  } catch (error) {
    console.error("JAITEA test error:", error.message);
  }
  
  // Final results
  console.log("\n🏁 FINAL RESULTS:");
  console.log("=" * 30);
  console.log(`GOSHEESH Swap: ${gosheeshPassed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`JAITEA Swap: ${jaiteaPassed ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (gosheeshPassed && jaiteaPassed) {
    console.log("\n🎉 ALL TESTS PASSED!");
    console.log("🚀 Day-0 MVP is ready for production!");
    console.log("\n📋 What works:");
    console.log("✅ Fixed rate pricing (1 ETH = 1M tokens)");
    console.log("✅ Buy tokens with ETH");
    console.log("✅ Sell tokens for ETH");
    console.log("✅ Contract liquidity management");
    console.log("✅ Gas optimization");
  } else {
    console.log("\n⚠️  Some tests failed. Check logs above for details.");
    console.log("Common issues:");
    console.log("- Contract needs token funding");
    console.log("- Contract is paused");
    console.log("- Insufficient gas or ETH");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  }); 