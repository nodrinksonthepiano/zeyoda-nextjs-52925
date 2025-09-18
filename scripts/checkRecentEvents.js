const { ethers } = require("hardhat");

// Contract ABI for DownloadMinted events
const DOWNLOAD_ABI = [
  "event DownloadMinted(address indexed user, uint256 indexed assetId, uint256 amount, string artistId)",
  "function totalMinted(uint256 assetId) view returns (uint256)"
];

async function checkRecentEvents() {
  console.log("🔍 CHECKING RECENT DOWNLOAD EVENTS");
  console.log("==================================");
  
  const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
  const currentBlock = await provider.getBlockNumber();
  console.log(`🔗 Current block: ${currentBlock}`);
  
  // Artist contracts from your registry
  const contracts = {
    'gosheesh': '0x51A70725D8842E856971C71bAE389f0EA5EEC676',
    'jaitea': '0xec7BaDb433504aEbeFF747ADc8586E5663C0ea21', 
    'cancakes': '0x1942756cA3dc2484b55E3417551159b56F66d467'
  };
  
  for (const [artistId, contractAddress] of Object.entries(contracts)) {
    console.log(`\n🎨 Checking ${artistId.toUpperCase()}: ${contractAddress}`);
    
    try {
      const contract = new ethers.Contract(contractAddress, DOWNLOAD_ABI, provider);
      
      // Check total minted for asset #1 (most common)
      try {
        const totalMinted1 = await contract.totalMinted(1);
        console.log(`📊 Total minted for asset #1: ${totalMinted1}`);
        
        if (totalMinted1 > 0) {
          console.log(`✅ ${artistId} has ${totalMinted1} downloads for asset #1!`);
        }
      } catch (e) {
        console.log(`⚠️ Could not check totalMinted: ${e.message}`);
      }
      
      // Try to get recent events with a very small block range (last 1000 blocks)
      const fromBlock = Math.max(currentBlock - 1000, 0);
      console.log(`🔍 Checking blocks ${fromBlock} to ${currentBlock} (last 1000 blocks)...`);
      
      try {
        const events = await contract.queryFilter(
          contract.filters.DownloadMinted(),
          fromBlock,
          currentBlock
        );
        
        console.log(`📊 Found ${events.length} events in recent blocks`);
        
        if (events.length > 0) {
          console.log("🎯 Recent events:");
          events.slice(-5).forEach((event, i) => {
            const { user, assetId, amount } = event.args;
            console.log(`  ${i+1}. ${user.slice(0,8)}... → Asset #${assetId} (${amount} tokens) - Block ${event.blockNumber}`);
          });
        }
        
      } catch (eventError) {
        console.log(`⚠️ Event query failed: ${eventError.message}`);
        
        // If even 1000 blocks fails, try just the last 100
        try {
          const smallFromBlock = Math.max(currentBlock - 100, 0);
          console.log(`🔍 Trying smaller range: blocks ${smallFromBlock} to ${currentBlock}...`);
          
          const smallEvents = await contract.queryFilter(
            contract.filters.DownloadMinted(),
            smallFromBlock,
            currentBlock
          );
          
          console.log(`📊 Found ${smallEvents.length} events in last 100 blocks`);
          
        } catch (smallError) {
          console.log(`❌ Even small range failed: ${smallError.message}`);
        }
      }
      
    } catch (contractError) {
      console.error(`❌ Error with ${artistId} contract:`, contractError.message);
    }
  }
}

// Run the check
checkRecentEvents()
  .then(() => {
    console.log("\n✅ Recent events check completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Check failed:", error);
    process.exit(1);
  });
