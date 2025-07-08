const { ethers } = require("hardhat");

// Correct token addresses
const GOSH33SH_TOKEN = "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac";
const USER_WALLET = "0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8";

async function main() {
    console.log("🔧 MANUAL SWAP EXECUTION (TREASURY FIX)");
    console.log("=" * 50);
    
    const [deployer] = await ethers.getSigners();
    console.log("Treasury wallet (deployer):", deployer.address);
    
    // Get token contract
    const tokenContract = await ethers.getContractAt("Artistock", GOSH33SH_TOKEN);
    
    console.log("\n💰 CURRENT BALANCES:");
    
    // Check balances
    const deployerTokens = await tokenContract.balanceOf(deployer.address);
    const deployerEth = await ethers.provider.getBalance(deployer.address);
    const userTokens = await tokenContract.balanceOf(USER_WALLET);
    const userEth = await ethers.provider.getBalance(USER_WALLET);
    
    console.log(`Treasury GOSH33SH: ${ethers.formatUnits(deployerTokens, 18)}`);
    console.log(`Treasury ETH: ${ethers.formatEther(deployerEth)}`);
    console.log(`User GOSH33SH: ${ethers.formatUnits(userTokens, 18)}`);
    console.log(`User ETH: ${ethers.formatEther(userEth)}`);
    
    // Calculate the swap the user wanted: $3.39 for 6,780 tokens
    const requestedTokens = 6780;
    const requestedTokensWei = ethers.parseUnits(requestedTokens.toString(), 18);
    
    // At fixed rate: 1 ETH = 1,000,000 tokens
    // So 6,780 tokens = 0.00678 ETH
    const requiredEth = requestedTokens / 1_000_000;
    const requiredEthWei = ethers.parseEther(requiredEth.toString());
    
    console.log("\n🎯 SWAP DETAILS:");
    console.log(`Tokens to send: ${requestedTokens} GOSH33SH`);
    console.log(`ETH to receive: ${requiredEth} ETH`);
    
    // Check if treasury has enough tokens
    if (deployerTokens < requestedTokensWei) {
        console.log("❌ ERROR: Treasury doesn't have enough tokens");
        console.log(`Needs: ${ethers.formatUnits(requestedTokensWei, 18)}`);
        console.log(`Has: ${ethers.formatUnits(deployerTokens, 18)}`);
        return;
    }
    
    console.log("\n🚀 EXECUTING MANUAL SWAP:");
    
    try {
        // Step 1: Treasury sends tokens to user
        console.log("📤 Step 1: Sending tokens to user...");
        const tokenTx = await tokenContract.transfer(USER_WALLET, requestedTokensWei);
        await tokenTx.wait();
        console.log("✅ Tokens sent:", tokenTx.hash);
        
        // Step 2: Treasury should receive ETH (but we can't force user to send it)
        console.log("\n💡 Step 2: User should send ETH to treasury");
        console.log(`User needs to send ${requiredEth} ETH to ${deployer.address}`);
        console.log("Since this is a test, we'll skip the ETH collection for now.");
        
        // Check final balances
        const finalUserTokens = await tokenContract.balanceOf(USER_WALLET);
        const finalTreasuryTokens = await tokenContract.balanceOf(deployer.address);
        
        console.log("\n📊 FINAL BALANCES:");
        console.log(`User GOSH33SH: ${ethers.formatUnits(finalUserTokens, 18)}`);
        console.log(`Treasury GOSH33SH: ${ethers.formatUnits(finalTreasuryTokens, 18)}`);
        
        console.log("\n✅ MANUAL SWAP COMPLETED!");
        console.log(`User received ${requestedTokens} tokens`);
        console.log("Your wallet should now show the additional tokens");
        
    } catch (error) {
        console.error("❌ Manual swap failed:", error.message);
    }
    
    console.log("\n🔧 LONG-TERM SOLUTION:");
    console.log("1. Redeploy swap contracts with correct token addresses");
    console.log("2. Update Supabase with new swap contract addresses");
    console.log("3. Test the automated swap functionality");
    
    console.log("\n💡 IMMEDIATE NEXT STEPS:");
    console.log("1. Refresh your browser to see new token balance");
    console.log("2. Try the swap again with smaller amounts");
    console.log("3. Test on both GOSHEESH and JAITEA pages");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 