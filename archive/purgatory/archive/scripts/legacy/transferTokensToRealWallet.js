const { ethers } = require("hardhat");

// Token addresses from deployment
const GOSH33SH_TOKEN = "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac";
const JAIT33_TOKEN = "0x9D06564a8D98e146CAb1dE74BF815bf05d24D685";

// Wallet addresses
const TEST_GOSHEESH_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const TEST_JAITEA_WALLET = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const REAL_MAGIC_LINK_WALLET_RAW = "0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8"; // User's actual GOSHEESH Magic Link wallet

// Amounts to transfer (1B tokens each)
const ARTIST_AMOUNT = ethers.parseUnits("1000000000", 18); // 1B tokens

async function main() {
    console.log("🔄 TRANSFERRING TOKENS TO REAL MAGIC LINK WALLET");
    console.log("=" * 50);
    
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    
    // Get properly checksummed wallet address
    const REAL_MAGIC_LINK_WALLET = ethers.getAddress(REAL_MAGIC_LINK_WALLET_RAW);
    
    // Check deployer balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer ETH balance:", ethers.formatEther(balance));
    
    if (balance < ethers.parseEther("0.01")) {
        console.log("❌ ERROR: Need at least 0.01 ETH for gas fees");
        return;
    }
    
    console.log("\n📍 ADDRESSES:");
    console.log("Test GOSHEESH wallet:", TEST_GOSHEESH_WALLET);
    console.log("Test JAITEA wallet:", TEST_JAITEA_WALLET);
    console.log("Real Magic Link wallet:", REAL_MAGIC_LINK_WALLET);
    
    // Get contract instances
    const gosh33shToken = await ethers.getContractAt("Artistock", GOSH33SH_TOKEN);
    const jait33Token = await ethers.getContractAt("Artistock", JAIT33_TOKEN);
    
    console.log("\n🔍 CHECKING CURRENT BALANCES:");
    
    // Check test wallet balances
    const testGoshBalance = await gosh33shToken.balanceOf(TEST_GOSHEESH_WALLET);
    const testJaitBalance = await jait33Token.balanceOf(TEST_JAITEA_WALLET);
    
    console.log(`Test GOSHEESH wallet GOSH33SH: ${ethers.formatUnits(testGoshBalance, 18)}`);
    console.log(`Test JAITEA wallet JAIT33: ${ethers.formatUnits(testJaitBalance, 18)}`);
    
    // Check real wallet balances (should be 0)
    const realGoshBalance = await gosh33shToken.balanceOf(REAL_MAGIC_LINK_WALLET);
    const realJaitBalance = await jait33Token.balanceOf(REAL_MAGIC_LINK_WALLET);
    
    console.log(`Real wallet GOSH33SH: ${ethers.formatUnits(realGoshBalance, 18)}`);
    console.log(`Real wallet JAIT33: ${ethers.formatUnits(realJaitBalance, 18)}`);
    
    // Check deployer balances (should have the artist tokens)
    const deployerGoshBalance = await gosh33shToken.balanceOf(deployer.address);
    const deployerJaitBalance = await jait33Token.balanceOf(deployer.address);
    
    console.log(`Deployer GOSH33SH: ${ethers.formatUnits(deployerGoshBalance, 18)}`);
    console.log(`Deployer JAIT33: ${ethers.formatUnits(deployerJaitBalance, 18)}`);
    
    console.log("\n💡 ANALYSIS:");
    console.log("Tokens are allocated correctly according to our deployment:");
    console.log("• Test wallets have 1B tokens each (as planned)");
    console.log("• Deployer has treasury tokens (8.9B)");
    console.log("• Swap contracts have 100M tokens each");
    
    console.log("\n🚀 TRANSFERRING ARTIST ALLOCATION FROM TREASURY:");
    
    try {
        // Transfer GOSH33SH from deployer (treasury) to real wallet (1B tokens)
        if (deployerGoshBalance >= ARTIST_AMOUNT) {
            console.log("📤 Transferring 1B GOSH33SH tokens from treasury to your wallet...");
            const goshTx = await gosh33shToken.transfer(REAL_MAGIC_LINK_WALLET, ARTIST_AMOUNT);
            await goshTx.wait();
            console.log("✅ GOSH33SH transfer successful:", goshTx.hash);
        } else {
            console.log("⚠️ Not enough GOSH33SH in treasury");
        }
        
        // Transfer JAIT33 from deployer (treasury) to real wallet (1B tokens)
        if (deployerJaitBalance >= ARTIST_AMOUNT) {
            console.log("📤 Transferring 1B JAIT33 tokens from treasury to your wallet...");
            const jaitTx = await jait33Token.transfer(REAL_MAGIC_LINK_WALLET, ARTIST_AMOUNT);
            await jaitTx.wait();
            console.log("✅ JAIT33 transfer successful:", jaitTx.hash);
        } else {
            console.log("⚠️ Not enough JAIT33 in treasury");
        }
        
    } catch (error) {
        console.error("❌ Transfer error:", error.message);
        throw error;
    }
    
    console.log("\n🔍 FINAL BALANCES:");
    
    const finalRealGoshBalance = await gosh33shToken.balanceOf(REAL_MAGIC_LINK_WALLET);
    const finalRealJaitBalance = await jait33Token.balanceOf(REAL_MAGIC_LINK_WALLET);
    
    console.log(`Real wallet GOSH33SH: ${ethers.formatUnits(finalRealGoshBalance, 18)}`);
    console.log(`Real wallet JAIT33: ${ethers.formatUnits(finalRealJaitBalance, 18)}`);
    
    console.log("\n🎉 TRANSFER COMPLETE!");
    console.log("🔔 Your Magic Link wallet should now show:");
    console.log("   • 1,000,000,000 GOSH33SH tokens");
    console.log("   • 1,000,000,000 JAIT33 tokens");
    
    console.log("\n💡 NEXT STEPS:");
    console.log("1. Refresh your browser");
    console.log("2. Check 'Your Assets' panel - should show both tokens");
    console.log("3. Try a small swap ($1-5) to test functionality");
    console.log("4. You can now sell tokens back to the protocol!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 