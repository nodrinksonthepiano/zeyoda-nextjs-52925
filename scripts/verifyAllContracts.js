const { ethers } = require("ethers");

// Network configuration
const PROVIDER_URL = "https://sepolia.base.org";
const provider = new ethers.JsonRpcProvider(PROVIDER_URL);

// Token addresses (consistent across all files)
// Import the centralized registry
const ARTIST_REGISTRY = {
  gosheesh: {
    token: "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac",
    swap:  "0xFCdc6C04bC0e1625178883c64567e1218Ee97DFf",
    treasuryWallet: "0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8"
  },
  jaitea: {
    token: "0x9D06564a8D98e146CAb1dE74BF815bf05d24D685",
    swap:  "0xd01cFF08a9962e67914a3A3e446D90513915db6f",
    treasuryWallet: "0x0B893D9D0dA09096C75e43c310316dC61b2773be"
  }
};

const TOKENS = {
  GOSH33SH: ARTIST_REGISTRY.gosheesh.token,
  JAIT33: ARTIST_REGISTRY.jaitea.token
};

// Potential swap contract addresses from different sources
const SWAP_CONTRACTS = {
  // From fresh_tokens_deployment.json
  GOSHEESH_FRESH: "0x63349f5190860b4E954639eeFd60b92bE9A01148",
  JAITEA_FRESH: "0xd01cFF08a9962e67914a3A3e446D90513915db6f",
  
  // From MASTER_PROMPT_V5_CURRENT_STATE.md
  GOSHEESH_V5: "0xC7Ddb4F5310405758e4D609dA1E6aba4228E29ae",
  
  // From MASTER_PROMPT_V6_FINAL_STATE.md (newly deployed)
  GOSHEESH_V6: "0xFCdc6C04bC0e1625178883c64567e1218Ee97DFf",
  
  // Main AMM Swap
  MAIN_AMM: "0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE"
};

// Important wallet addresses
const WALLETS = {
  PROTOCOL_DEPLOYER: "0x615258a5263DBEe0DDEED3166ddC1f442D937eB3",
  USER_MAGIC_LINK: "0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8",
  GOSHEESH_ARTIST: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  JAITEA_ARTIST: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
};

// ERC20 ABI for balance checking
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function checkContractExists(address, name) {
  try {
    const code = await provider.getCode(address);
    const exists = code !== "0x";
    console.log(`${exists ? "✅" : "❌"} ${name}: ${address} ${exists ? "EXISTS" : "NOT FOUND"}`);
    return exists;
  } catch (error) {
    console.log(`❌ ${name}: ${address} ERROR - ${error.message}`);
    return false;
  }
}

async function checkTokenBalance(tokenAddress, walletAddress, tokenSymbol, walletName) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await tokenContract.balanceOf(walletAddress);
    const formattedBalance = ethers.formatUnits(balance, 18);
    const numericBalance = parseFloat(formattedBalance);
    
    if (numericBalance > 0) {
      console.log(`    💰 ${walletName}: ${numericBalance.toLocaleString()} ${tokenSymbol}`);
    } else {
      console.log(`    💸 ${walletName}: 0 ${tokenSymbol}`);
    }
    
    return numericBalance;
  } catch (error) {
    console.log(`    ❌ ${walletName}: Error checking balance - ${error.message}`);
    return 0;
  }
}

async function checkETHBalance(walletAddress, walletName) {
  try {
    const balance = await provider.getBalance(walletAddress);
    const formattedBalance = ethers.formatEther(balance);
    const numericBalance = parseFloat(formattedBalance);
    
    console.log(`    ⛽ ${walletName}: ${numericBalance.toFixed(6)} ETH`);
    return numericBalance;
  } catch (error) {
    console.log(`    ❌ ${walletName}: Error checking ETH balance - ${error.message}`);
    return 0;
  }
}

async function main() {
  console.log("🔍 COMPREHENSIVE CONTRACT VERIFICATION");
  console.log("=====================================");
  
  // 1. Check all token contracts
  console.log("\n📋 1. TOKEN CONTRACTS:");
  for (const [symbol, address] of Object.entries(TOKENS)) {
    const exists = await checkContractExists(address, `${symbol} Token`);
    
    if (exists) {
      try {
        const contract = new ethers.Contract(address, ERC20_ABI, provider);
        const name = await contract.name();
        const totalSupply = await contract.totalSupply();
        const formattedSupply = ethers.formatUnits(totalSupply, 18);
        console.log(`    📊 Name: ${name}, Total Supply: ${parseFloat(formattedSupply).toLocaleString()}`);
      } catch (error) {
        console.log(`    ❌ Error reading token details: ${error.message}`);
      }
    }
  }
  
  // 2. Check all swap contracts
  console.log("\n🔄 2. SWAP CONTRACTS:");
  for (const [name, address] of Object.entries(SWAP_CONTRACTS)) {
    await checkContractExists(address, `${name} Swap`);
  }
  
  // 3. Check token balances for all important wallets
  console.log("\n💰 3. TOKEN BALANCES:");
  
  for (const [symbol, tokenAddress] of Object.entries(TOKENS)) {
    console.log(`\n${symbol} Token Balances:`);
    
    let totalDistributed = 0;
    
    for (const [walletName, walletAddress] of Object.entries(WALLETS)) {
      const balance = await checkTokenBalance(tokenAddress, walletAddress, symbol, walletName);
      totalDistributed += balance;
    }
    
    // Check all swap contracts for this token
    for (const [swapName, swapAddress] of Object.entries(SWAP_CONTRACTS)) {
      const balance = await checkTokenBalance(tokenAddress, swapAddress, symbol, `${swapName} Contract`);
      totalDistributed += balance;
    }
    
    console.log(`    📊 Total Distributed: ${totalDistributed.toLocaleString()} ${symbol}`);
    console.log(`    🏦 Expected Total Supply: 10,000,000,000 ${symbol}`);
    console.log(`    📈 Distribution Rate: ${((totalDistributed / 10000000000) * 100).toFixed(2)}%`);
  }
  
  // 4. Check ETH balances
  console.log("\n⛽ 4. ETH BALANCES:");
  for (const [walletName, walletAddress] of Object.entries(WALLETS)) {
    await checkETHBalance(walletAddress, walletName);
  }
  
  // Check swap contracts for ETH
  for (const [swapName, swapAddress] of Object.entries(SWAP_CONTRACTS)) {
    await checkETHBalance(swapAddress, `${swapName} Contract`);
  }
  
  console.log("\n🎯 5. TREASURY ANALYSIS:");
  console.log("Expected Treasury Distribution per Token:");
  console.log("  - Artist: 1,000,000,000 tokens (10%)");
  console.log("  - Swap Contract: 100,000,000 tokens (1%)");
  console.log("  - Treasury/Protocol: 8,900,000,000 tokens (89%)");
  console.log("\nLook for the largest balances to find where treasury tokens are stored!");
}

main().catch(console.error); 