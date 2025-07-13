const { ethers } = require('hardhat');

async function main() {
  console.log('🚀 COMPLETE WETH/USDC POOL SETUP ON BASE SEPOLIA');
  console.log('================================================');
  
  // Base Sepolia addresses
  const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
  const USDC_ADDRESS = '0x6Ac3aB54Dc5019A2e57eCcb214337FF5bbD52897';
  
  // Uniswap V3 addresses on Base Sepolia
  const UNISWAP_V3_FACTORY = '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24';
  const UNISWAP_V3_POSITION_MANAGER = '0x03a520b32c04bf3beef7bf5755a6e82a1b6ce191';
  
  const [deployer] = await ethers.getSigners();
  console.log('👤 Wallet Address:', deployer.address);
  
  // Check starting balances
  console.log('\n💰 STARTING BALANCES:');
  const ethBalance = await ethers.provider.getBalance(deployer.address);
  console.log('📊 ETH Balance:', ethers.formatEther(ethBalance), 'ETH');
  
  // Get contract instances
  const wethContract = await ethers.getContractAt([
    'function deposit() payable',
    'function balanceOf(address) view returns (uint256)',
    'function approve(address, uint256) returns (bool)'
  ], WETH_ADDRESS);
  
  const usdcContract = await ethers.getContractAt([
    'function balanceOf(address) view returns (uint256)',
    'function approve(address, uint256) returns (bool)',
    'function decimals() view returns (uint8)'
  ], USDC_ADDRESS);
  
  const wethBalance = await wethContract.balanceOf(deployer.address);
  const usdcBalance = await usdcContract.balanceOf(deployer.address);
  
  console.log('📊 WETH Balance:', ethers.formatEther(wethBalance), 'WETH');
  console.log('📊 USDC Balance:', ethers.formatUnits(usdcBalance, 6), 'USDC');
  
  // STEP 1: Wrap ETH → WETH
  const wrapAmount = ethers.parseEther('0.015'); // 0.015 ETH
  const poolWethAmount = ethers.parseEther('0.01'); // 0.01 WETH for pool
  const poolUsdcAmount = ethers.parseUnits('30', 6); // 30 USDC for pool
  
  console.log('\n🔄 STEP 1: WRAPPING ETH → WETH');
  console.log('💡 Amount to wrap:', ethers.formatEther(wrapAmount), 'ETH');
  
  if (wethBalance < poolWethAmount) {
    console.log('⏳ Wrapping ETH...');
    const wrapTx = await wethContract.deposit({ value: wrapAmount });
    console.log('📡 Wrap transaction:', wrapTx.hash);
    
    const receipt = await wrapTx.wait();
    console.log('✅ ETH wrapped successfully! Block:', receipt.blockNumber);
    
    // Wait a moment and check balance again
    await new Promise(resolve => setTimeout(resolve, 2000));
    const newWethBalance = await wethContract.balanceOf(deployer.address);
    console.log('📊 New WETH balance:', ethers.formatEther(newWethBalance), 'WETH');
  } else {
    console.log('✅ Already have sufficient WETH');
  }
  
  // STEP 2: Create Uniswap V3 Pool
  console.log('\n🏊 STEP 2: CREATING WETH/USDC POOL');
  console.log('💡 Pool amounts: 0.01 WETH + 30 USDC');
  console.log('💡 Fee tier: 0.05% (500 basis points)');
  
  // Check if we have enough tokens (refresh balances)
  console.log('🔍 Checking updated balances...');
  const finalWethBalance = await wethContract.balanceOf(deployer.address);
  const finalUsdcBalance = await usdcContract.balanceOf(deployer.address);
  
  console.log('📊 Updated WETH balance:', ethers.formatEther(finalWethBalance), 'WETH');
  console.log('📊 Updated USDC balance:', ethers.formatUnits(finalUsdcBalance, 6), 'USDC');
  
  if (finalWethBalance < poolWethAmount) {
    throw new Error(`Insufficient WETH. Need: ${ethers.formatEther(poolWethAmount)}, Have: ${ethers.formatEther(finalWethBalance)}`);
  }
  
  if (finalUsdcBalance < poolUsdcAmount) {
    throw new Error(`Insufficient USDC. Need: ${ethers.formatUnits(poolUsdcAmount, 6)}, Have: ${ethers.formatUnits(finalUsdcBalance, 6)}`);
  }
  
  // Get Uniswap V3 Position Manager
  const positionManager = await ethers.getContractAt([
    'function createAndInitializePoolIfNecessary(address,address,uint24,uint160) external payable returns (address)',
    'function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256,uint128,uint256,uint256)'
  ], UNISWAP_V3_POSITION_MANAGER);
  
  // Calculate sqrt price for ~$3000 ETH (1 ETH = 3000 USDC)
  // sqrtPriceX96 = sqrt(price) * 2^96
  // For WETH/USDC pair: price = USDC per WETH = 3000
  // sqrtPrice = sqrt(3000) ≈ 54.77
  const sqrtPriceX96 = '4334531309892529734323793268808'; // sqrt(3000) * 2^96
  
  console.log('⏳ Creating/initializing pool...');
  
  try {
    // Create and initialize pool if it doesn't exist
    const poolTx = await positionManager.createAndInitializePoolIfNecessary(
      WETH_ADDRESS,
      USDC_ADDRESS,
      500, // 0.05% fee
      sqrtPriceX96
    );
    
    console.log('📡 Pool creation transaction:', poolTx.hash);
    await poolTx.wait();
    console.log('✅ Pool created/initialized');
  } catch (error) {
    if (error.message.includes('Already initialized')) {
      console.log('✅ Pool already exists');
    } else {
      console.log('⚠️ Pool creation failed (might already exist):', error.message);
    }
  }
  
  // STEP 3: Approve tokens for Position Manager
  console.log('\n🔑 STEP 3: APPROVING TOKENS');
  
  console.log('⏳ Approving WETH...');
  const wethApproveTx = await wethContract.approve(UNISWAP_V3_POSITION_MANAGER, poolWethAmount);
  await wethApproveTx.wait();
  console.log('✅ WETH approved');
  
  console.log('⏳ Approving USDC...');
  const usdcApproveTx = await usdcContract.approve(UNISWAP_V3_POSITION_MANAGER, poolUsdcAmount);
  await usdcApproveTx.wait();
  console.log('✅ USDC approved');
  
  // STEP 4: Add liquidity (mint position)
  console.log('\n💧 STEP 4: ADDING LIQUIDITY');
  
  const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes
  
  // Full range position: tick range approximately -887220 to 887220
  const mintParams = {
    token0: WETH_ADDRESS < USDC_ADDRESS ? WETH_ADDRESS : USDC_ADDRESS,
    token1: WETH_ADDRESS < USDC_ADDRESS ? USDC_ADDRESS : WETH_ADDRESS,
    fee: 500,
    tickLower: -887220, // Full range
    tickUpper: 887220,  // Full range
    amount0Desired: WETH_ADDRESS < USDC_ADDRESS ? poolWethAmount : poolUsdcAmount,
    amount1Desired: WETH_ADDRESS < USDC_ADDRESS ? poolUsdcAmount : poolWethAmount,
    amount0Min: 0, // Accept any amount
    amount1Min: 0, // Accept any amount
    recipient: deployer.address,
    deadline: deadline
  };
  
  console.log('⏳ Minting liquidity position...');
  console.log('🔧 Mint params:', {
    token0: mintParams.token0,
    token1: mintParams.token1,
    fee: mintParams.fee,
    amount0Desired: WETH_ADDRESS < USDC_ADDRESS ? 
      ethers.formatEther(mintParams.amount0Desired) + ' WETH' : 
      ethers.formatUnits(mintParams.amount0Desired, 6) + ' USDC',
    amount1Desired: WETH_ADDRESS < USDC_ADDRESS ? 
      ethers.formatUnits(mintParams.amount1Desired, 6) + ' USDC' : 
      ethers.formatEther(mintParams.amount1Desired) + ' WETH'
  });
  
  try {
    const mintTx = await positionManager.mint(mintParams, {
      gasLimit: 500000 // Increased gas limit for complex operation
    });
    
    console.log('📡 Liquidity mint transaction:', mintTx.hash);
    const receipt = await mintTx.wait();
    console.log('✅ Liquidity added successfully! Block:', receipt.blockNumber);
    
    // Parse the receipt for position ID
    console.log('🎯 Position NFT minted - check your wallet for LP token');
    
  } catch (error) {
    console.error('❌ Liquidity mint failed:', error.message);
    throw error;
  }
  
  // STEP 5: Verify final state
  console.log('\n🔍 FINAL VERIFICATION:');
  
  const finalEthBalance = await ethers.provider.getBalance(deployer.address);
  const finalWethBalanceCheck = await wethContract.balanceOf(deployer.address);
  const finalUsdcBalanceCheck = await usdcContract.balanceOf(deployer.address);
  
  console.log('💰 FINAL BALANCES:');
  console.log('📊 ETH:', ethers.formatEther(finalEthBalance), 'ETH');
  console.log('📊 WETH:', ethers.formatEther(finalWethBalanceCheck), 'WETH');
  console.log('📊 USDC:', ethers.formatUnits(finalUsdcBalanceCheck, 6), 'USDC');
  
  console.log('\n🎉 POOL SETUP COMPLETE!');
  console.log('=====================================');
  console.log('✅ WETH/USDC pool created with liquidity');
  console.log('✅ Your cash-out system should now work');
  console.log('');
  console.log('🚀 NEXT STEPS:');
  console.log('1. npm run dev');
  console.log('2. Visit: http://localhost:3000/?artist=gosheesh');
  console.log('3. Try cashing out some GOSH33SH tokens');
  console.log('4. Expect: Token approval → Swap transaction → USD balance update');
  console.log('');
  console.log('💡 TIP: First cash-out requires token approval (extra signature)');
}

main()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }); 