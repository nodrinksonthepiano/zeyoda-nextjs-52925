const { ethers } = require("hardhat");

// Updated artist registry with download contracts (after deployment)
const ARTIST_REGISTRY = {
  gosheesh: {
    token: "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac",
    swap: "0xFCdc6C04bC0e1625178883c64567e1218Ee97DFf",
    treasuryWallet: "0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8",
    download: "0x51A70725D8842E856971C71bAE389f0EA5EEC676"
  },
  jaitea: {
    token: "0x9D06564a8D98e146CAb1dE74BF815bf05d24D685",
    swap: "0xd01cFF08a9962e67914a3A3e446D90513915db6f",
    treasuryWallet: "0x0B893D9D0dA09096C75e43c310316dC61b2773be",
    download: "0xec7BaDb433504aEbeFF747ADc8586E5663C0ea21"
  }
};

// Test wallet address (Magic Link wallet)
const TEST_WALLET = "0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8";

// ERC-1155 ABI for minting
const ERC1155_ABI = [
  "function mintDownload(address user, uint256 assetId, uint256 amount) external",
  "function batchMintDownloads(address user, uint256[] calldata assetIds, uint256[] calldata amounts) external",
  "function balanceOf(address owner, uint256 id) view returns (uint256)",
  "function hasDownloadAccess(address user, uint256 assetId) view returns (bool)",
  "function owner() view returns (address)",
  "function artistId() view returns (string)"
];

async function seedDownloadTokens() {
  console.log("🌱 SEEDING DOWNLOAD TOKENS FOR TESTING");
  console.log("====================================");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Test Wallet: ${TEST_WALLET}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} ETH`);
  
  if (balance < ethers.parseEther("0.01")) {
    console.log("⚠️ Warning: Low ETH balance. Need at least 0.01 ETH for transactions");
  }
  
  for (const [artistId, contracts] of Object.entries(ARTIST_REGISTRY)) {
    try {
      console.log(`\n🎨 Processing ${artistId.toUpperCase()}...`);
      
      // Skip if download contract not deployed yet
      if (contracts.download === "REPLACE_WITH_DEPLOYED_ADDRESS") {
        console.log(`⚠️ Download contract not deployed for ${artistId}, skipping...`);
        console.log(`   Deploy contracts first with: npx hardhat run deploy/05_deploy_download_contract.js --network baseSepolia`);
        continue;
      }
      
      // Create contract instance
      const downloadContract = new ethers.Contract(
        contracts.download,
        ERC1155_ABI,
        deployer
      );
      
      // Verify contract details
      const contractArtistId = await downloadContract.artistId();
      const contractOwner = await downloadContract.owner();
      
      console.log(`   Contract: ${contracts.download}`);
      console.log(`   Artist ID: ${contractArtistId}`);
      console.log(`   Owner: ${contractOwner}`);
      console.log(`   Is Deployer Owner: ${contractOwner.toLowerCase() === deployer.address.toLowerCase()}`);
      
      if (contractOwner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.log(`❌ Deployer is not the owner of ${artistId} download contract`);
        continue;
      }
      
      // Check current balances
      console.log(`\n📊 Current download token balances for ${TEST_WALLET}:`);
      for (let assetId = 1; assetId <= 3; assetId++) {
        const balance = await downloadContract.balanceOf(TEST_WALLET, assetId);
        const hasAccess = await downloadContract.hasDownloadAccess(TEST_WALLET, assetId);
        console.log(`   Asset ${assetId}: ${balance.toString()} tokens (Access: ${hasAccess})`);
      }
      
      // Mint download tokens for testing
      console.log(`\n🪙 Minting download tokens...`);
      
      // Option 1: Single mint for asset 1
      console.log(`   Minting 1 download token for asset 1...`);
      const mintTx1 = await downloadContract.mintDownload(TEST_WALLET, 1, 1);
      await mintTx1.wait();
      console.log(`   ✅ Minted asset 1 download token: ${mintTx1.hash}`);
      
      // Option 2: Batch mint for assets 2 and 3 (if you want to test multiple)
      console.log(`   Batch minting download tokens for assets 2 and 3...`);
      const batchTx = await downloadContract.batchMintDownloads(
        TEST_WALLET,
        [2, 3], // Asset IDs
        [1, 1]  // Amounts
      );
      await batchTx.wait();
      console.log(`   ✅ Batch minted assets 2-3 download tokens: ${batchTx.hash}`);
      
      // Verify the minting
      console.log(`\n✅ Updated download token balances for ${TEST_WALLET}:`);
      for (let assetId = 1; assetId <= 3; assetId++) {
        const balance = await downloadContract.balanceOf(TEST_WALLET, assetId);
        const hasAccess = await downloadContract.hasDownloadAccess(TEST_WALLET, assetId);
        console.log(`   Asset ${assetId}: ${balance.toString()} tokens (Access: ${hasAccess})`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${artistId}:`, error.message);
      console.log(`   This might mean:`);
      console.log(`   1. Download contract not deployed yet`);
      console.log(`   2. Wrong contract address in registry`);
      console.log(`   3. Deployer doesn't own the contract`);
      console.log(`   4. Network/gas issues`);
    }
  }
  
  console.log("\n🎉 DOWNLOAD TOKEN SEEDING COMPLETE!");
  console.log("=====================================");
  
  console.log("\n🧪 TESTING INSTRUCTIONS:");
  console.log("1. Open your frontend (npm run dev)");
  console.log("2. Connect with the Magic Link wallet:");
  console.log(`   ${TEST_WALLET}`);
  console.log("3. Navigate to artist pages");
  console.log("4. Look for green download buttons");
  console.log("5. Click to test the download flow");
  
  console.log("\n📋 EXPECTED BEHAVIOR:");
  console.log("✅ Download buttons appear for assets you own");
  console.log("✅ Clicking creates signed URL and downloads file");
  console.log("✅ Download count increments in database");
  console.log("❌ No download buttons for assets you don't own");
  
  console.log("\n🔧 TROUBLESHOOTING:");
  console.log("- If no download buttons: Check console for hook errors");
  console.log("- If download fails: Check API route errors");
  console.log("- If files not found: Ensure Supabase Storage is set up");
  console.log("- If 403 errors: Verify contract addresses in addressRegistry.ts");
}

async function main() {
  try {
    await seedDownloadTokens();
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 