const { ethers } = require('hardhat');

async function main() {
  console.log('🏊 Starting Base Sepolia Liquidity Pool Setup...');
  console.log('==========================================');
  
  // Base Sepolia addresses
  const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
  const USDC_ADDRESS = '0x6Ac3aB54Dc5019A2e57eCcb214337FF5bbD52897';
  
  // Get signer from hardhat
  const [deployer] = await ethers.getSigners();
  console.log('👤 Wallet Address:', deployer.address);
  
  // Check current balances
  console.log('\n💰 CURRENT BALANCES:');
  const ethBalance = await ethers.provider.getBalance(deployer.address);
  console.log('📊 ETH Balance:', ethers.formatEther(ethBalance), 'ETH');
  
  // Check USDC balance
  const usdcContract = await ethers.getContractAt([
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)'
  ], USDC_ADDRESS);
  
  const usdcBalance = await usdcContract.balanceOf(deployer.address);
  console.log('📊 USDC Balance:', ethers.formatUnits(usdcBalance, 6), 'USDC');
  
  // Verify we have enough for testing
  const ethFormatted = parseFloat(ethers.formatEther(ethBalance));
  const usdcFormatted = parseFloat(ethers.formatUnits(usdcBalance, 6));
  
  console.log('\n🔍 LIQUIDITY POOL READINESS CHECK:');
  console.log('✅ ETH Available:', ethFormatted >= 0.01 ? 'YES' : 'NEED MORE', `(${ethFormatted.toFixed(4)} ETH)`);
  console.log('✅ USDC Available:', usdcFormatted >= 30 ? 'YES' : 'NEED MORE', `(${usdcFormatted.toFixed(2)} USDC)`);
  
  if (ethFormatted >= 0.05 && usdcFormatted >= 150) {
    console.log('\n🎯 RECOMMENDED POOL AMOUNTS:');
    console.log('💡 ETH: 0.05 (≈$150)');
    console.log('💡 USDC: 150 (matching value)');
    console.log('💡 Reserve: Keep remaining for gas + testing');
  } else if (ethFormatted >= 0.02 && usdcFormatted >= 60) {
    console.log('\n🎯 MODERATE POOL AMOUNTS:');
    console.log('💡 ETH: 0.02 (≈$60)');
    console.log('💡 USDC: 60 (matching value)');
  } else if (ethFormatted >= 0.01 && usdcFormatted >= 30) {
    console.log('\n🎯 MINIMAL POOL AMOUNTS:');
    console.log('💡 ETH: 0.01 (≈$30)');
    console.log('💡 USDC: 30 (matching value)');
  }
  
  console.log('\n🚀 NEXT STEPS:');
  console.log('1. Use Uniswap interface: app.uniswap.org');
  console.log('2. Connect to Base Sepolia network');
  console.log('3. Create ETH/USDC pool (0.05% fee tier)');
  console.log('4. Test your USDC cash-out system!');
  
  console.log('\n✅ Script completed successfully!');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exitCode = 1;
});
