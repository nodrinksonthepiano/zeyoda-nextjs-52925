const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Current artist registry from addressRegistry.ts
const ARTIST_REGISTRY = {
  gosheesh: {
    token: "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac",
    swap: "0xFCdc6C04bC0e1625178883c64567e1218Ee97DFf",
    treasuryWallet: "0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8"
  },
  jaitea: {
    token: "0x9D06564a8D98e146CAb1dE74BF815bf05d24D685",
    swap: "0xd01cFF08a9962e67914a3A3e446D90513915db6f",
    treasuryWallet: "0x0B893D9D0dA09096C75e43c310316dC61b2773be"
  }
};

// Base URI for ERC-1155 metadata
const BASE_URI = "https://api.zeyoda.com/metadata/downloads/";

async function deployDownloadContract(artistId) {
  console.log(`\n🎨 Deploying ArtistDownloads for ${artistId.toUpperCase()}...`);
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  
  // Deploy the contract
  const ArtistDownloads = await ethers.getContractFactory("ArtistDownloads");
  const downloadContract = await ArtistDownloads.deploy(
    artistId,
    BASE_URI
  );
  
  await downloadContract.waitForDeployment();
  const contractAddress = await downloadContract.getAddress();
  
  console.log(`✅ ${artistId} ArtistDownloads deployed at: ${contractAddress}`);
  
  // Verify the deployment
  const deployedArtistId = await downloadContract.artistId();
  const deployedURI = await downloadContract.uri(1);
  
  console.log(`   Artist ID: ${deployedArtistId}`);
  console.log(`   Base URI: ${deployedURI}`);
  console.log(`   Owner: ${await downloadContract.owner()}`);
  
  return contractAddress;
}

async function updateAddressRegistry(deployedContracts) {
  console.log("\n📝 Updating addressRegistry.ts...");
  
  // Build the updated registry
  const updatedRegistry = { ...ARTIST_REGISTRY };
  
  for (const [artistId, downloadAddress] of Object.entries(deployedContracts)) {
    if (updatedRegistry[artistId]) {
      updatedRegistry[artistId].download = downloadAddress;
    }
  }
  
  // Generate the new addressRegistry.ts content
  const registryContent = `export const ARTIST_REGISTRY = ${JSON.stringify(updatedRegistry, null, 2)} as const;

export type ArtistId = keyof typeof ARTIST_REGISTRY;

// Helper functions for type-safe access
export function getArtistContracts(artistId: string) {
  return ARTIST_REGISTRY[artistId as ArtistId] || null;
}

export function isValidArtist(artistId: string): artistId is ArtistId {
  return artistId in ARTIST_REGISTRY;
}

export function getAllArtistIds(): ArtistId[] {
  return Object.keys(ARTIST_REGISTRY) as ArtistId[];
}
`;
  
  // Write the updated file
  const registryPath = path.join(__dirname, "../app/utils/addressRegistry.ts");
  fs.writeFileSync(registryPath, registryContent);
  
  console.log("✅ addressRegistry.ts updated with download contract addresses");
  
  return updatedRegistry;
}

async function main() {
  console.log("🚀 DEPLOYING ARTIST DOWNLOAD CONTRACTS");
  console.log("=====================================");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
  
  if (balance < ethers.parseEther("0.05")) {
    console.log("⚠️ Warning: Low ETH balance. Need at least 0.05 ETH for deployment");
  }
  
  const deployedContracts = {};
  
  try {
    // Deploy for each artist
    for (const artistId of Object.keys(ARTIST_REGISTRY)) {
      const contractAddress = await deployDownloadContract(artistId);
      deployedContracts[artistId] = contractAddress;
      
      // Small delay between deployments
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Update the address registry
    const updatedRegistry = await updateAddressRegistry(deployedContracts);
    
    console.log("\n🎉 DEPLOYMENT COMPLETE!");
    console.log("=======================");
    
    console.log("\n📋 DEPLOYED CONTRACTS:");
    Object.entries(deployedContracts).forEach(([artistId, address]) => {
      console.log(`${artistId.toUpperCase()}: ${address}`);
    });
    
    console.log("\n🔧 MANUAL SUPABASE UPDATE REQUIRED:");
    console.log("Copy and run this SQL in your Supabase SQL Editor:");
    console.log("\n-- Add download_address column if it doesn't exist");
    console.log("ALTER TABLE artists ADD COLUMN IF NOT EXISTS download_address TEXT;");
    console.log("\n-- Update artists with download contract addresses");
    
    Object.entries(deployedContracts).forEach(([artistId, address]) => {
      console.log(`UPDATE artists SET download_address = '${address}' WHERE id = '${artistId}';`);
    });
    
    console.log("\n-- Verify the updates");
    console.log("SELECT id, name, contract, swap_address, download_address FROM artists;");
    
    console.log("\n📦 DEPLOYMENT SUMMARY:");
    console.log("✅ ArtistDownloads contracts deployed for all artists");
    console.log("✅ addressRegistry.ts updated with download addresses");
    console.log("🔄 Manual step: Update Supabase artists table (SQL above)");
    
    console.log("\n🧪 NEXT STEPS:");
    console.log("1. Run the Supabase SQL updates above");
    console.log("2. Test with: node scripts/seedDownloadTokens.js");
    console.log("3. Implement /api/createSignedUrl endpoint");
    console.log("4. Add download button to frontend");
    
    // Save deployment info
    const deploymentInfo = {
      timestamp: new Date().toISOString(),
      network: "base-sepolia",
      deployer: deployer.address,
      contracts: deployedContracts,
      registry: updatedRegistry
    };
    
    fs.writeFileSync(
      path.join(__dirname, "../deployments/download_contracts_deployment.json"),
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log("\n💾 Deployment info saved to deployments/download_contracts_deployment.json");
    
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 