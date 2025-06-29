const { ethers } = require("hardhat");

// Contract addresses
const GOSH33SH_TOKEN = "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac";
const GOSHEESH_SWAP = "0x63349f5190860b4E954639eeFd60b92bE9A01148";
const USER_WALLET = "0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8";

async function main() {
    console.log("🔍 DEBUGGING SWAP FAILURE");
    console.log("=" * 40);
    
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    
    // Get contract instances
    const tokenContract = await ethers.getContractAt("Artistock", GOSH33SH_TOKEN);
    
    // Check if we can get the swap contract
    try {
        const swapContract = await ethers.getContractAt("TreasurySwapLite", GOSHEESH_SWAP);
        
        console.log("\n📊 SWAP CONTRACT STATE:");
        
        // Check contract balances
        const swapTokenBalance = await tokenContract.balanceOf(GOSHEESH_SWAP);
        const swapEthBalance = await ethers.provider.getBalance(GOSHEESH_SWAP);
        
        console.log(`Swap contract GOSH33SH: ${ethers.formatUnits(swapTokenBalance, 18)}`);
        console.log(`Swap contract ETH: ${ethers.formatEther(swapEthBalance)}`);
        
        // Check if contract is paused or has other issues
        try {
            const tokenAddress = await swapContract.tokenAddress();
            console.log("Token address in contract:", tokenAddress);
            console.log("Expected token address:", GOSH33SH_TOKEN);
            
            if (tokenAddress.toLowerCase() !== GOSH33SH_TOKEN.toLowerCase()) {
                console.log("❌ ERROR: Token address mismatch!");
            }
        } catch (e) {
            console.log("❌ Error reading token address:", e.message);
        }
        
        // Try to simulate the buy transaction
        console.log("\n🧪 SIMULATING BUY TRANSACTION:");
        
        // Calculate what the user was trying to do
        const usdAmount = 3.39;
        const expectedTokens = 6780;
        const ethAmount = ethers.parseEther((usdAmount / 1000).toString()); // Assuming ~$1000/ETH
        
        console.log(`USD Amount: $${usdAmount}`);
        console.log(`Expected tokens: ${expectedTokens}`);
        console.log(`ETH to send: ${ethers.formatEther(ethAmount)}`);
        
        try {
            // Try to call buyTokens method
            const buyResult = await swapContract.buyTokens.staticCall({ value: ethAmount });
            console.log("✅ Buy simulation successful, would get:", ethers.formatUnits(buyResult, 18), "tokens");
        } catch (error) {
            console.log("❌ Buy simulation failed:");
            console.log("Error:", error.message);
            
            // Check common failure reasons
            if (error.message.includes("insufficient")) {
                console.log("🔍 Likely cause: Insufficient tokens in swap contract");
            } else if (error.message.includes("paused")) {
                console.log("🔍 Likely cause: Contract is paused");
            } else if (error.message.includes("amount")) {
                console.log("🔍 Likely cause: Invalid amount or calculation");
            }
        }
        
        // Check user's ETH balance
        console.log("\n👤 USER WALLET STATUS:");
        const userEthBalance = await ethers.provider.getBalance(USER_WALLET);
        const userTokenBalance = await tokenContract.balanceOf(USER_WALLET);
        
        console.log(`User ETH: ${ethers.formatEther(userEthBalance)}`);
        console.log(`User GOSH33SH: ${ethers.formatUnits(userTokenBalance, 18)}`);
        
        if (userEthBalance < ethAmount) {
            console.log("❌ ERROR: User doesn't have enough ETH for this transaction!");
            console.log(`Needs: ${ethers.formatEther(ethAmount)} ETH`);
            console.log(`Has: ${ethers.formatEther(userEthBalance)} ETH`);
        }
        
    } catch (error) {
        console.log("❌ Error accessing swap contract:", error.message);
        console.log("This might be a different contract type or ABI mismatch");
        
        // Try to get basic contract info
        console.log("\n🔍 BASIC CONTRACT CHECKS:");
        const code = await ethers.provider.getCode(GOSHEESH_SWAP);
        console.log("Contract has code:", code !== "0x");
        
        const balance = await ethers.provider.getBalance(GOSHEESH_SWAP);
        console.log("Contract ETH balance:", ethers.formatEther(balance));
    }
    
    console.log("\n💡 POTENTIAL SOLUTIONS:");
    console.log("1. Check if swap contract needs more tokens");
    console.log("2. Verify user has enough ETH for transaction + gas");
    console.log("3. Check if contract pricing logic is correct");
    console.log("4. Verify contract ABI matches deployed contract");
    console.log("5. Check if there are minimum purchase requirements");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 