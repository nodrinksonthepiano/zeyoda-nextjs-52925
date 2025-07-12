/**
 * Seed Base Sepolia WETH⇄USDC Uniswap V3 Pool
 * Fee Tier: 500 bps (0.05%) - matches production code
 */

const { ethers } = require('ethers');

// Base Sepolia Configuration
const NETWORK_CONFIG = {
  name: 'Base Sepolia',
  chainId: 84532,
  rpc: 'https://sepolia.base.org', // Public RPC
};

// Contract Addresses (Base Sepolia)
const ADDRESSES = {
  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x036cBD53842c5426634e7929541eC2318f3dCF7e',
  UNISWAP_V3_FACTORY: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
  UNISWAP_V3_POSITION_MANAGER: '0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2',
  UNISWAP_V3_ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564'
};

// Target Liquidity
const LIQUIDITY_CONFIG = {
  wethAmount: '5.0',      // 5 WETH
  usdcAmount: '15000',    // 15,000 USDC
  feeTier: 500           // 0.05% - matches our production code
};

// ABIs (minimal required functions)
const POSITION_MANAGER_ABI = [
  'function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) external returns (address pool)',
  'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)'
];

const WETH_ABI = [
  'function deposit() external payable',
  'function withdraw(uint256 amount) external',
  ...ERC20_ABI
];

async function main() {
  console.log('🏊‍♂️ Base Sepolia Liquidity Seeding Script');
  console.log('==========================================');
  
  // Check if private key is provided
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ Please set PRIVATE_KEY environment variable');
    console.log('💡 Usage: PRIVATE_KEY=0x... node scripts/seedLiquidity.js');
    process.exit(1);
  }

  try {
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.rpc);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log('👤 Wallet:', wallet.address);
    
    // Check ETH balance
    const ethBalance = await provider.getBalance(wallet.address);
    const ethFormatted = ethers.formatEther(ethBalance);
    console.log('💰 ETH Balance:', ethFormatted);
    
    if (parseFloat(ethFormatted) < 0.1) {
      console.error('❌ Insufficient ETH balance. Need at least 0.1 ETH for gas + wrapping');
      console.log('🚰 Get testnet ETH: https://faucet.quicknode.com/base/sepolia');
      process.exit(1);
    }

    // Step 1: Wrap ETH to WETH
    console.log('\n🔄 Step 1: Wrapping ETH to WETH...');
    const wethContract = new ethers.Contract(ADDRESSES.WETH, WETH_ABI, wallet);
    
    const wethAmount = ethers.parseEther(LIQUIDITY_CONFIG.wethAmount);
    const wrapTx = await wethContract.deposit({ value: wethAmount });
    console.log('⏳ Wrapping transaction:', wrapTx.hash);
    await wrapTx.wait();
    console.log('✅ Wrapped', LIQUIDITY_CONFIG.wethAmount, 'ETH to WETH');

    // Step 2: Check USDC balance (user needs to obtain separately)
    console.log('\n💵 Step 2: Checking USDC balance...');
    const usdcContract = new ethers.Contract(ADDRESSES.USDC, ERC20_ABI, wallet);
    const usdcBalance = await usdcContract.balanceOf(wallet.address);
    const usdcFormatted = ethers.formatUnits(usdcBalance, 6);
    console.log('💰 USDC Balance:', usdcFormatted);
    
    const requiredUsdc = parseFloat(LIQUIDITY_CONFIG.usdcAmount);
    if (parseFloat(usdcFormatted) < requiredUsdc) {
      console.error(`❌ Insufficient USDC. Need ${requiredUsdc} USDC, have ${usdcFormatted}`);
      console.log('🚰 Get testnet USDC from Base Sepolia faucets or bridges');
      process.exit(1);
    }

    // Step 3: Approve tokens for Position Manager
    console.log('\n🔑 Step 3: Approving tokens...');
    
    const usdcAmount = ethers.parseUnits(LIQUIDITY_CONFIG.usdcAmount, 6);
    
    console.log('Approving WETH...');
    const wethApproveTx = await wethContract.approve(ADDRESSES.UNISWAP_V3_POSITION_MANAGER, wethAmount);
    await wethApproveTx.wait();
    
    console.log('Approving USDC...');
    const usdcApproveTx = await usdcContract.approve(ADDRESSES.UNISWAP_V3_POSITION_MANAGER, usdcAmount);
    await usdcApproveTx.wait();
    
    console.log('✅ Token approvals complete');

    // Step 4: Create and initialize pool if necessary
    console.log('\n🏊‍♂️ Step 4: Creating/Initializing pool...');
    const positionManager = new ethers.Contract(
      ADDRESSES.UNISWAP_V3_POSITION_MANAGER, 
      POSITION_MANAGER_ABI, 
      wallet
    );

    // Calculate initial price (1 ETH = 3000 USDC for example)
    // sqrtPriceX96 = sqrt(price) * 2^96
    const price = 3000; // 1 WETH = 3000 USDC
    const sqrtPriceX96 = BigInt(Math.floor(Math.sqrt(price) * (2 ** 96)));

    // Determine token order (Uniswap sorts addresses)
    const token0 = ADDRESSES.WETH < ADDRESSES.USDC ? ADDRESSES.WETH : ADDRESSES.USDC;
    const token1 = ADDRESSES.WETH < ADDRESSES.USDC ? ADDRESSES.USDC : ADDRESSES.WETH;
    
    console.log('Token0 (lower address):', token0);
    console.log('Token1 (higher address):', token1);
    console.log('Fee Tier:', LIQUIDITY_CONFIG.feeTier, 'bps (0.05%)');

    try {
      const createPoolTx = await positionManager.createAndInitializePoolIfNecessary(
        token0,
        token1,
        LIQUIDITY_CONFIG.feeTier,
        sqrtPriceX96
      );
      console.log('⏳ Pool creation transaction:', createPoolTx.hash);
      await createPoolTx.wait();
      console.log('✅ Pool created/initialized');
    } catch (error) {
      if (error.message.includes('Already initialized')) {
        console.log('✅ Pool already exists');
      } else {
        throw error;
      }
    }

    // Step 5: Add liquidity (full range for simplicity)
    console.log('\n💧 Step 5: Adding liquidity...');
    
    const amount0Desired = token0 === ADDRESSES.WETH ? wethAmount : usdcAmount;
    const amount1Desired = token0 === ADDRESSES.WETH ? usdcAmount : wethAmount;
    
    const mintParams = {
      token0,
      token1,
      fee: LIQUIDITY_CONFIG.feeTier,
      tickLower: -887220, // Full range
      tickUpper: 887220,  // Full range  
      amount0Desired,
      amount1Desired,
      amount0Min: amount0Desired * BigInt(95) / BigInt(100), // 5% slippage
      amount1Min: amount1Desired * BigInt(95) / BigInt(100), // 5% slippage
      recipient: wallet.address,
      deadline: Math.floor(Date.now() / 1000) + 600 // 10 minutes
    };

    console.log('🔧 Mint parameters:', {
      token0: mintParams.token0,
      token1: mintParams.token1,
      fee: mintParams.fee,
      amount0: ethers.formatUnits(mintParams.amount0Desired, token0 === ADDRESSES.WETH ? 18 : 6),
      amount1: ethers.formatUnits(mintParams.amount1Desired, token1 === ADDRESSES.WETH ? 18 : 6)
    });

    const mintTx = await positionManager.mint(mintParams);
    console.log('⏳ Liquidity mint transaction:', mintTx.hash);
    const receipt = await mintTx.wait();
    
    console.log('✅ Liquidity added successfully!');
    console.log('📊 Transaction confirmed in block:', receipt.blockNumber);
    console.log('⛽ Gas used:', receipt.gasUsed.toString());

    console.log('\n🎉 POOL SEEDING COMPLETE!');
    console.log('==========================================');
    console.log('✅ WETH⇄USDC pool is now ready');
    console.log('✅ Fee tier: 500 bps (0.05%) - matches your code');
    console.log('✅ Your cash-out system can now use real Uniswap swaps');
    console.log('\n🧪 Ready for smoke testing!');

  } catch (error) {
    console.error('❌ Error seeding liquidity:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, ADDRESSES, LIQUIDITY_CONFIG }; 