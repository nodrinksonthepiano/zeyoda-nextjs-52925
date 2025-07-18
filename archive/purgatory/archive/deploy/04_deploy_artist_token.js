const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  // Configuration - EDIT THESE FOR EACH NEW ARTIST
  const ARTIST_CONFIG = {
    name: "TestArtistToken",         // Test token
    symbol: "TESTTOKEN",             // Test symbol
    artistWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Test wallet
    artistId: "testartist",          // For testing
  };

  // Protocol addresses (keep these constant)
  const PROTOCOL_VAULT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Replace with actual multisig

  console.log("🚀 Deploying ArtistToken for:", ARTIST_CONFIG.name);
  
  try {
    // Deploy the token contract
    const ArtistToken = await ethers.getContractFactory("ArtistToken");
    const tokenContract = await ArtistToken.deploy(
      ARTIST_CONFIG.name,
      ARTIST_CONFIG.symbol,
      ARTIST_CONFIG.artistWallet,
      PROTOCOL_VAULT
    );
    
    await tokenContract.waitForDeployment();
    const deployResult = { address: await tokenContract.getAddress() };
    
    console.log(`✅ ${ARTIST_CONFIG.name} deployed at:`, deployResult.address);
    
    // Perform initial mint (10B tokens with automatic distribution)
    console.log("🪙 Performing initial mint with distribution...");
    const mintTx = await tokenContract.initialMint();
    await mintTx.wait();
    
    console.log("✅ Initial mint completed!");
    
    // Get distribution info for verification
    const distributionInfo = await tokenContract.getDistributionInfo();
    
    console.log("\n📊 TOKEN DISTRIBUTION SUMMARY:");
    console.log(`  Total Supply: ${ethers.formatUnits(distributionInfo.totalSupply_, 18)} ${ARTIST_CONFIG.symbol}`);
    console.log(`  Artist Wallet (10%): ${ethers.formatUnits(distributionInfo.artistAmount, 18)} ${ARTIST_CONFIG.symbol}`);
    console.log(`  LP Seeding (1%): ${ethers.formatUnits(distributionInfo.lpAmount, 18)} ${ARTIST_CONFIG.symbol}`);
    console.log(`  Protocol Vault (89%): ${ethers.formatUnits(distributionInfo.protocolAmount, 18)} ${ARTIST_CONFIG.symbol}`);
    console.log(`  Artist Wallet: ${distributionInfo.artistWallet_}`);
    console.log(`  Protocol Vault: ${distributionInfo.protocolVault_}`);
    
    // Verify actual balances
    const artistBalance = await tokenContract.balanceOf(distributionInfo.artistWallet_);
    const deployerBalance = await tokenContract.balanceOf(deployer);
    const protocolBalance = await tokenContract.balanceOf(distributionInfo.protocolVault_);
    
    console.log("\n🔍 ACTUAL BALANCES:");
    console.log(`  Artist Balance: ${ethers.formatUnits(artistBalance, 18)} ${ARTIST_CONFIG.symbol}`);
    console.log(`  Deployer Balance (for LP): ${ethers.formatUnits(deployerBalance, 18)} ${ARTIST_CONFIG.symbol}`);
    console.log(`  Protocol Vault Balance: ${ethers.formatUnits(protocolBalance, 18)} ${ARTIST_CONFIG.symbol}`);
    
    console.log("\n📝 NEXT STEPS:");
    console.log("1. Update Supabase with the following data:");
    console.log(`   - contract: "${deployResult.address}"`);
    console.log(`   - name: "${ARTIST_CONFIG.name}"`);
    console.log(`   - symbol: "${ARTIST_CONFIG.symbol}"`);
    console.log(`   - artistWallet: "${ARTIST_CONFIG.artistWallet}"`);
    console.log(`   - launchBlock: ${deployResult.receipt?.blockNumber || 'TBD'}`);
    console.log(`   - Leave tokenprice BLANK (LP will drive price)`);
    console.log("");
    console.log("2. Seed liquidity pool:");
    console.log(`   npx hardhat seed-lp --token ${deployResult.address} --artist ${ARTIST_CONFIG.artistId} --network baseSepolia`);
    console.log("");
    console.log("3. Test frontend:");
    console.log(`   http://localhost:3000?artist=${ARTIST_CONFIG.artistId}`);
    
    // Save deployment info to file for easy reference
    const fs = require('fs');
    const deploymentData = {
      timestamp: new Date().toISOString(),
      network: "baseSepolia",
      artist: ARTIST_CONFIG,
      contract: deployResult.address,
      deployer: deployer,
      protocolVault: PROTOCOL_VAULT,
      blockNumber: deployResult.receipt?.blockNumber,
      txHash: mintTx.hash,
      distribution: {
        total: distributionInfo.totalSupply_.toString(),
        artist: distributionInfo.artistAmount.toString(),
        lp: distributionInfo.lpAmount.toString(),
        protocol: distributionInfo.protocolAmount.toString()
      }
    };
    
    fs.writeFileSync(
      `deployments/${ARTIST_CONFIG.artistId}_deployment.json`,
      JSON.stringify(deploymentData, null, 2)
    );
    
    console.log(`💾 Deployment data saved to: deployments/${ARTIST_CONFIG.artistId}_deployment.json`);
    
  } catch (error) {
    console.log("❌ Deployment failed:", error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 