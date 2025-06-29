const { ethers } = require("hardhat");

// Token addresses
const JAIT33_TOKEN = "0x9D06564a8D98e146CAb1dE74BF815bf05d24D685";

// Wallet addresses
const GOSHEESH_WALLET = "0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8"; // Current wallet (has JAIT33 incorrectly)
const JAITEA_WALLET = "0x0B893D9D0dA09096C75e43c310316dC61b2773be";   // Correct JAITEA wallet

// Amount to transfer (1B tokens)
const TRANSFER_AMOUNT = ethers.parseUnits("1000000000", 18); // 1B tokens

async function main() {
    console.log("🔄 TRANSFERRING JAIT33 TO CORRECT JAITEA WALLET");
    console.log("=" * 50);
    
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    
    // Check deployer balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer ETH balance:", ethers.formatEther(balance));
    
    if (balance < ethers.parseEther("0.005")) {
        console.log("❌ ERROR: Need at least 0.005 ETH for gas fees");
        return;
    }
    
    console.log("\n📍 WALLET ADDRESSES:");
    console.log("GOSHEESH wallet (current):", GOSHEESH_WALLET);
    console.log("JAITEA wallet (correct):", JAITEA_WALLET);
    
    // Get contract instance
    const jait33Token = await ethers.getContractAt("Artistock", JAIT33_TOKEN);
    
    console.log("\n🔍 CHECKING CURRENT BALANCES:");
    
    // Check current balances
    const gosheeshBalance = await jait33Token.balanceOf(GOSHEESH_WALLET);
    const jaiteaBalance = await jait33Token.balanceOf(JAITEA_WALLET);
    const deployerBalance = await jait33Token.balanceOf(deployer.address);
    
    console.log(`GOSHEESH wallet JAIT33: ${ethers.formatUnits(gosheeshBalance, 18)}`);
    console.log(`JAITEA wallet JAIT33: ${ethers.formatUnits(jaiteaBalance, 18)}`);
    console.log(`Deployer JAIT33: ${ethers.formatUnits(deployerBalance, 18)}`);
    
    if (gosheeshBalance < TRANSFER_AMOUNT) {
        console.log("❌ ERROR: Not enough JAIT33 tokens in GOSHEESH wallet");
        console.log(`Need: ${ethers.formatUnits(TRANSFER_AMOUNT, 18)}`);
        console.log(`Have: ${ethers.formatUnits(gosheeshBalance, 18)}`);
        return;
    }
    
    console.log("\n🚀 TRANSFERRING TOKENS FROM DEPLOYER TO JAITEA WALLET:");
    
    try {
        // The deployer should have the tokens to transfer
        if (deployerBalance >= TRANSFER_AMOUNT) {
            console.log("📤 Transferring 1B JAIT33 tokens from deployer to JAITEA wallet...");
            const tx = await jait33Token.transfer(JAITEA_WALLET, TRANSFER_AMOUNT);
            console.log("Transaction hash:", tx.hash);
            
            await tx.wait();
            console.log("✅ Transfer successful!");
            
            // Check final balances
            const finalJaiteaBalance = await jait33Token.balanceOf(JAITEA_WALLET);
            const finalDeployerBalance = await jait33Token.balanceOf(deployer.address);
            
            console.log("\n📊 FINAL BALANCES:");
            console.log(`JAITEA wallet JAIT33: ${ethers.formatUnits(finalJaiteaBalance, 18)}`);
            console.log(`Deployer JAIT33: ${ethers.formatUnits(finalDeployerBalance, 18)}`);
            
        } else {
            console.log("❌ ERROR: Deployer doesn't have enough JAIT33 tokens");
            console.log("The tokens are likely in the GOSHEESH wallet, not the deployer wallet");
            console.log("We need the private key of the GOSHEESH wallet to transfer them");
        }
        
    } catch (error) {
        console.error("❌ Transfer failed:", error.message);
    }
    
    console.log("\n🎯 NEXT STEPS:");
    console.log("1. Verify JAITEA wallet has 1B JAIT33 tokens");
    console.log("2. Verify GOSHEESH wallet only has GOSH33SH tokens");
    console.log("3. Test swapping functionality");
    console.log("4. Each artist can now trade their own tokens!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 