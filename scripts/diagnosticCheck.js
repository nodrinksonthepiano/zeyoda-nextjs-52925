const { ethers } = require("hardhat");

// Contract addresses
const GOSH33SH_TOKEN = "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac";
const JAIT33_TOKEN = "0x9D06564a8D98e146CAb1dE74BF815bf05d24D685";
const GOSHEESH_SWAP = "0x63349f5190860b4E954639eeFd60b92bE9A01148";
const JAITEA_SWAP = "0xd01cFF08a9962e67914a3A3e446D90513915db6f";

// Your actual Magic Link wallet
const YOUR_WALLET = "0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8";

async function main() {
    console.log("🔍 COMPREHENSIVE DIAGNOSTIC CHECK");
    console.log("=" * 50);
    
    const [deployer] = await ethers.getSigners();
    
    // Get contract instances
    const gosh33shToken = await ethers.getContractAt("Artistock", GOSH33SH_TOKEN);
    const jait33Token = await ethers.getContractAt("Artistock", JAIT33_TOKEN);
    
    console.log("\n📍 CONTRACT ADDRESSES:");
    console.log("GOSH33SH Token:", GOSH33SH_TOKEN);
    console.log("JAIT33 Token:", JAIT33_TOKEN);
    console.log("GOSHEESH Swap:", GOSHEESH_SWAP);
    console.log("JAITEA Swap:", JAITEA_SWAP);
    console.log("Your Wallet:", YOUR_WALLET);
    
    console.log("\n💰 YOUR WALLET BALANCES:");
    try {
        const goshBalance = await gosh33shToken.balanceOf(YOUR_WALLET);
        const jaitBalance = await jait33Token.balanceOf(YOUR_WALLET);
        const ethBalance = await ethers.provider.getBalance(YOUR_WALLET);
        
        console.log(`GOSH33SH: ${ethers.formatUnits(goshBalance, 18)} tokens`);
        console.log(`JAIT33: ${ethers.formatUnits(jaitBalance, 18)} tokens`);
        console.log(`ETH: ${ethers.formatEther(ethBalance)} ETH`);
        
        if (goshBalance > 0) {
            console.log("✅ GOSH33SH tokens ARE in your wallet!");
        } else {
            console.log("❌ No GOSH33SH tokens in your wallet");
        }
        
        if (jaitBalance > 0) {
            console.log("✅ JAIT33 tokens ARE in your wallet!");
        } else {
            console.log("❌ No JAIT33 tokens in your wallet");
        }
        
        if (ethBalance == 0) {
            console.log("⚠️ WARNING: You have 0 ETH - this will cause transaction failures!");
        }
        
    } catch (error) {
        console.error("Error checking wallet balances:", error.message);
    }
    
    console.log("\n🏊 SWAP CONTRACT STATUS:");
    try {
        // Check if these are TreasurySwapLite contracts
        const gosheeshSwapBalance = await ethers.provider.getBalance(GOSHEESH_SWAP);
        const jaiteaSwapBalance = await ethers.provider.getBalance(JAITEA_SWAP);
        
        console.log(`GOSHEESH Swap ETH: ${ethers.formatEther(gosheeshSwapBalance)} ETH`);
        console.log(`JAITEA Swap ETH: ${ethers.formatEther(jaiteaSwapBalance)} ETH`);
        
        // Check token balances in swap contracts
        const gosheeshSwapTokens = await gosh33shToken.balanceOf(GOSHEESH_SWAP);
        const jaiteaSwapTokens = await jait33Token.balanceOf(JAITEA_SWAP);
        
        console.log(`GOSHEESH Swap GOSH33SH: ${ethers.formatUnits(gosheeshSwapTokens, 18)} tokens`);
        console.log(`JAITEA Swap JAIT33: ${ethers.formatUnits(jaiteaSwapTokens, 18)} tokens`);
        
    } catch (error) {
        console.error("Error checking swap contracts:", error.message);
    }
    
    console.log("\n🎯 PROTOCOL TYPE ANALYSIS:");
    console.log("You are using DAY-0 MVP with TreasurySwapLite contracts.");
    console.log("This is NOT a liquidity pool system - it's a fixed-rate treasury system.");
    console.log("Fixed rate: 1 ETH = 1,000,000 tokens");
    
    console.log("\n🔧 WHY YOUR FRONTEND ISN'T WORKING:");
    console.log("1. Frontend may be looking for different contract addresses");
    console.log("2. Frontend may need to refresh to see new token balances");
    console.log("3. You need ETH in your wallet for gas fees");
    console.log("4. Environment variables might not be properly set");
    
    console.log("\n💡 SOLUTIONS:");
    console.log("1. Make sure .env.local has the < characters removed");
    console.log("2. Hard refresh your browser (Cmd+Shift+R)");
    console.log("3. Get some ETH in your wallet for gas fees");
    console.log("4. Check that Supabase has the correct contract addresses");
    
    console.log("\n🚀 NEXT ACTIONS:");
    if (ethBalance == 0) {
        console.log("❗ CRITICAL: You need ETH for gas fees!");
        console.log("   - Get some Base Sepolia ETH from a faucet");
        console.log("   - Or I can send you some from the deployer wallet");
    } else {
        console.log("✅ You have enough ETH for transactions");
    }
    
    console.log("\n📋 ENVIRONMENT CHECK:");
    console.log("Make sure your .env.local contains:");
    console.log(`NEXT_PUBLIC_GOSH33SH_TOKEN=${GOSH33SH_TOKEN}`);
    console.log(`NEXT_PUBLIC_JAIT33_TOKEN=${JAIT33_TOKEN}`);
    console.log("(WITHOUT < characters!)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 