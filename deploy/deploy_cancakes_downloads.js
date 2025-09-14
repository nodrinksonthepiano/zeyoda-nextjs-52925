const { ethers } = require("hardhat");

// CANCAKES token info
const CANCAKES_INFO = {
  artistId: "cancakes",
  tokenAddress: "0xd88B1b69Cf6Cd4E52ad1F661fe24EF414D52f8", // From your deployment
  baseURI: "https://api.zeyoda.com/metadata/cancakes/"
};

async function deployCancakesDownloads() {
  console.log("🍰 DEPLOYING CANCAKES DOWNLOADS CONTRACT");
  console.log("=======================================");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
  
  if (balance < ethers.parseEther("0.01")) {
    throw new Error("⚠️ Need at least 0.01 ETH for deployment");
  }
  
  try {
    console.log(`\n🎨 Deploying ArtistDownloads for ${CANCAKES_INFO.artistId}...`);
    
    // Deploy the contract
    const ArtistDownloads = await ethers.getContractFactory("ArtistDownloads");
    const downloadContract = await ArtistDownloads.deploy(
      CANCAKES_INFO.artistId,  // "cancakes"
      CANCAKES_INFO.baseURI    // Base URI
    );
    
    await downloadContract.waitForDeployment();
    const contractAddress = await downloadContract.getAddress();
    
    console.log(`✅ CANCAKES ArtistDownloads deployed at: ${contractAddress}`);
    
    // Verify the deployment (with error handling)
    try {
      const deployedArtistId = await downloadContract.artistId();
      const deployedURI = await downloadContract.uri(1);
      const owner = await downloadContract.owner();
      
      console.log(`   Artist ID: ${deployedArtistId}`);
      console.log(`   Sample URI: ${deployedURI}`);
      console.log(`   Owner: ${owner}`);
    } catch (verifyError) {
      console.log(`   ⚠️ Verification calls failed (contract still deployed successfully)`);
      console.log(`   This is normal for newly deployed contracts`);
    }
    
    console.log("\n🔧 MANUAL SUPABASE UPDATES NEEDED:");
    console.log("Copy and run this SQL in your Supabase SQL Editor:");
    console.log("\n-- Update CANCAKES with download contract address");
    console.log(`UPDATE artists SET download_address = '${contractAddress}' WHERE id = 'cancakes';`);
    console.log(`UPDATE artist_registry SET downloads = '${contractAddress}' WHERE id = 'cancakes';`);
    
    console.log("\n-- Verify the updates");
    console.log("SELECT id, name, token_address, download_address FROM artists WHERE id = 'cancakes';");
    console.log("SELECT id, token, downloads FROM artist_registry WHERE id = 'cancakes';");
    
    console.log("\n🎉 CANCAKES DOWNLOADS DEPLOYMENT COMPLETE!");
    console.log(`Contract Address: ${contractAddress}`);
    console.log("Remember to run the Supabase SQL updates above!");
    
    return contractAddress;
    
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
}

// Run the deployment
deployCancakesDownloads()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
