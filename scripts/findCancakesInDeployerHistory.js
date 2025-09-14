const { ethers } = require("hardhat");

async function findCancakesInHistory() {
  console.log("🔍 SEARCHING DEPLOYER HISTORY FOR CANCAKES TOKEN");
  console.log("===============================================");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  try {
    const provider = ethers.provider;
    
    // Get latest block
    const latestBlock = await provider.getBlockNumber();
    console.log("Latest block:", latestBlock);
    
    // Search recent blocks for contract deployments by the deployer
    console.log("\n🔍 Searching recent deployments...");
    
    const searchBlocks = 10000; // Search last 10k blocks
    const startBlock = Math.max(0, latestBlock - searchBlocks);
    
    console.log(`Searching blocks ${startBlock} to ${latestBlock}...`);
    
    // Get transaction history for deployer
    const txHistory = [];
    
    for (let i = latestBlock; i > startBlock; i -= 1000) {
      const fromBlock = Math.max(startBlock, i - 1000);
      const toBlock = i;
      
      try {
        // Get all transactions in this block range
        const filter = {
          fromBlock,
          toBlock,
          topics: [
            "0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0" // OwnershipTransferred event
          ]
        };
        
        const logs = await provider.getLogs(filter);
        
        for (const log of logs) {
          const tx = await provider.getTransaction(log.transactionHash);
          if (tx && tx.from.toLowerCase() === deployer.address.toLowerCase()) {
            const receipt = await provider.getTransactionReceipt(log.transactionHash);
            if (receipt && receipt.contractAddress) {
              txHistory.push({
                hash: tx.hash,
                block: tx.blockNumber,
                contractAddress: receipt.contractAddress,
                gasUsed: receipt.gasUsed.toString()
              });
            }
          }
        }
        
        console.log(`Checked blocks ${fromBlock}-${toBlock}...`);
      } catch (error) {
        console.log(`Error checking blocks ${fromBlock}-${toBlock}:`, error.message);
      }
    }
    
    console.log(`\n📊 Found ${txHistory.length} contract deployments:`);
    
    // Check each deployed contract to see if it's a CANCAKES token
    for (const deployment of txHistory) {
      try {
        console.log(`\n🔍 Checking ${deployment.contractAddress}...`);
        
        // Try to call token methods
        const tokenContract = new ethers.Contract(
          deployment.contractAddress,
          [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function totalSupply() view returns (uint256)"
          ],
          provider
        );
        
        const name = await tokenContract.name();
        const symbol = await tokenContract.symbol();
        const supply = await tokenContract.totalSupply();
        
        console.log(`   Name: ${name}`);
        console.log(`   Symbol: ${symbol}`);
        console.log(`   Supply: ${ethers.formatUnits(supply, 18)}`);
        console.log(`   Block: ${deployment.block}`);
        console.log(`   Hash: ${deployment.hash}`);
        
        // Check if this looks like CANCAKES
        if (symbol.includes('CANCAK') || name.includes('CANCAK')) {
          console.log(`\n🎉 FOUND CANCAKES TOKEN!`);
          console.log(`✅ Complete Address: ${deployment.contractAddress}`);
          console.log(`✅ Name: ${name}`);
          console.log(`✅ Symbol: ${symbol}`);
          console.log(`✅ Supply: ${ethers.formatUnits(supply, 18)}`);
          
          return deployment.contractAddress;
        }
        
      } catch (error) {
        console.log(`   ❌ Not a token contract (${error.message.split(' ')[0]})`);
      }
    }
    
    console.log("\n❌ CANCAKES token not found in recent history");
    console.log("💡 Try increasing searchBlocks or check older transactions");
    
  } catch (error) {
    console.error("❌ Error searching history:", error.message);
  }
}

findCancakesInHistory();
