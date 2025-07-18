const { ethers } = require("hardhat");

// Contract addresses
const GOSH33SH_TOKEN = "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac";
const GOSHEESH_SWAP = "0x63349f5190860b4E954639eeFd60b92bE9A01148";
const USER_WALLET = "0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8";

// Correct TreasurySwapLite ABI
const TREASURY_SWAP_ABI = [
  "function swapIn() external payable",
  "function swapOut(uint256 tokenAmount) external",
  "function getTokenQuote(uint256 ethAmount) external pure returns (uint256)",
  "function getEthQuote(uint256 tokenAmount) external pure returns (uint256)",
  "function paused() external view returns (bool)",
  "function artistToken() external view returns (address)",
  "function artist() external view returns (address)"
];

async function main() {
    console.log("🔍 DEBUGGING SWAP WITH CORRECT ABI");
    console.log("=" * 40);
    
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    
    // Get contract instances with correct ABI
    const tokenContract = await ethers.getContractAt("Artistock", GOSH33SH_TOKEN);
    const swapContract = new ethers.Contract(GOSHEESH_SWAP, TREASURY_SWAP_ABI, deployer);
    
    console.log("\n📊 SWAP CONTRACT STATE:");
    
    // Check contract balances
    const swapTokenBalance = await tokenContract.balanceOf(GOSHEESH_SWAP);
    const swapEthBalance = await ethers.provider.getBalance(GOSHEESH_SWAP);
    
    console.log(`Swap contract GOSH33SH: ${ethers.formatUnits(swapTokenBalance, 18)}`);
    console.log(`Swap contract ETH: ${ethers.formatEther(swapEthBalance)}`);
    
    // Check contract configuration
    try {
        const tokenAddress = await swapContract.artistToken();
        const artistAddress = await swapContract.artist();
        const isPaused = await swapContract.paused();
        
        console.log("Artist token in contract:", tokenAddress);
        console.log("Expected token address:", GOSH33SH_TOKEN);
        console.log("Artist address:", artistAddress);
        console.log("Contract paused:", isPaused);
        
        if (tokenAddress.toLowerCase() !== GOSH33SH_TOKEN.toLowerCase()) {
            console.log("❌ ERROR: Token address mismatch!");
        }
        
        if (isPaused) {
            console.log("❌ ERROR: Contract is paused!");
        }
        
    } catch (e) {
        console.log("❌ Error reading contract state:", e.message);
    }
    
    // Simulate the exact transaction the user was trying
    console.log("\n🧪 SIMULATING USER'S TRANSACTION:");
    
    // The user was trying to spend $3.39 USD for 6,780 tokens
    const usdAmount = 3.39;
    const expectedTokens = 6780;
    
    // At fixed rate: 1 ETH = 1,000,000 tokens
    // So 6,780 tokens = 6,780 / 1,000,000 = 0.00678 ETH
    const requiredEth = expectedTokens / 1_000_000;
    const ethAmountWei = ethers.parseEther(requiredEth.toString());
    
    console.log(`USD Amount: $${usdAmount}`);
    console.log(`Expected tokens: ${expectedTokens}`);
    console.log(`Required ETH: ${requiredEth} ETH`);
    console.log(`Required ETH (wei): ${ethAmountWei.toString()}`);
    
    // Test the quote function
    try {
        const quote = await swapContract.getTokenQuote(ethAmountWei);
        console.log(`✅ Quote successful: ${ethers.formatUnits(quote, 18)} tokens`);
        
        // Check if quote matches expected
        const quotedTokens = Number(ethers.formatUnits(quote, 18));
        if (Math.abs(quotedTokens - expectedTokens) < 1) {
            console.log("✅ Quote matches expected amount");
        } else {
            console.log(`❌ Quote mismatch: expected ${expectedTokens}, got ${quotedTokens}`);
        }
        
    } catch (error) {
        console.log("❌ Quote failed:", error.message);
    }
    
    // Try to simulate the actual swap
    try {
        console.log("\n🎯 SIMULATING SWAP IN:");
        
        // Use a smaller amount to test (0.001 ETH = 1000 tokens)
        const testEthAmount = ethers.parseEther("0.001");
        const expectedTestTokens = await swapContract.getTokenQuote(testEthAmount);
        
        console.log(`Test amount: ${ethers.formatEther(testEthAmount)} ETH`);
        console.log(`Expected test tokens: ${ethers.formatUnits(expectedTestTokens, 18)}`);
        
        // Check if contract has enough tokens
        if (swapTokenBalance >= expectedTestTokens) {
            console.log("✅ Contract has enough tokens for test swap");
            
            // Try static call to see if it would work
            await swapContract.swapIn.staticCall({ value: testEthAmount });
            console.log("✅ Test swap simulation successful!");
            
        } else {
            console.log("❌ Contract doesn't have enough tokens");
            console.log(`Needs: ${ethers.formatUnits(expectedTestTokens, 18)}`);
            console.log(`Has: ${ethers.formatUnits(swapTokenBalance, 18)}`);
        }
        
    } catch (error) {
        console.log("❌ Swap simulation failed:");
        console.log("Error:", error.reason || error.message);
        
        // Decode common error reasons
        if (error.message.includes("insufficient")) {
            console.log("🔍 Likely cause: Insufficient tokens in swap contract");
        } else if (error.message.includes("paused")) {
            console.log("🔍 Likely cause: Contract is paused");
        } else if (error.message.includes("revert")) {
            console.log("🔍 Likely cause: Contract logic error or requirement failed");
        }
    }
    
    // Check user's wallet status
    console.log("\n👤 USER WALLET STATUS:");
    const userEthBalance = await ethers.provider.getBalance(USER_WALLET);
    const userTokenBalance = await tokenContract.balanceOf(USER_WALLET);
    
    console.log(`User ETH: ${ethers.formatEther(userEthBalance)}`);
    console.log(`User GOSH33SH: ${ethers.formatUnits(userTokenBalance, 18)}`);
    
    if (userEthBalance < ethAmountWei) {
        console.log("⚠️ WARNING: User might not have enough ETH for the full transaction");
        console.log(`Transaction needs: ${ethers.formatEther(ethAmountWei)} ETH`);
        console.log(`User has: ${ethers.formatEther(userEthBalance)} ETH`);
    } else {
        console.log("✅ User has enough ETH for the transaction");
    }
    
    console.log("\n💡 NEXT STEPS:");
    console.log("1. Try a smaller test transaction first (like $1)");
    console.log("2. Make sure user wallet has enough ETH for gas fees");
    console.log("3. Check frontend is sending the correct ETH amount");
    console.log("4. Verify the contract is not paused");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 