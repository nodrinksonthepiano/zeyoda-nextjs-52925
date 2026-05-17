/**
 * Deploy new UupsAMM implementation and point existing ERC1967 proxy at it (UUPS).
 *
 * Prerequisites:
 *   - `.env.local`: `MINTER_PRIVATE_KEY` (or deploy key) must be **AMM owner** (BF today).
 *   - `BASE_SEPOLIA_RPC_URL` for Hardhat network.
 *
 * Usage:
 *   AMM_PROXY=0x49B9538e0022dD919d9af2358783e89d08bCd82c \
 *   npx hardhat run scripts/upgradeUupsAMMImplementation.js --network baseSepolia
 *
 * Verify on Base Sepolia:
 *   - Call `proxiableUUID()` / smoke `ARTIST_CASHOUT_MIN_ETH_WEI()` on proxy after upgrade.
 */
const { ethers } = require('hardhat');

const DEFAULT_AMM_PROXY = '0x49B9538e0022dD919d9af2358783e89d08bCd82c';

async function main() {
  const proxyAddr = (process.env.AMM_PROXY || DEFAULT_AMM_PROXY).trim();
  if (!ethers.isAddress(proxyAddr)) {
    throw new Error(`Invalid AMM_PROXY: ${proxyAddr}`);
  }

  const [signer] = await ethers.getSigners();
  const amm = await ethers.getContractAt('UupsAMM', proxyAddr, signer);

  const owner = await amm.owner();
  console.log('AMM proxy:    ', proxyAddr);
  console.log('Signer:       ', signer.address);
  console.log('owner():     ', owner);

  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `Signer is not AMM owner. Use the BF key as MINTER_PRIVATE_KEY (or add an owner signer). Owner=${owner}`,
    );
  }

  console.log('\n📦 Deploying new implementation...');
  const Factory = await ethers.getContractFactory('UupsAMM');
  const impl = await Factory.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log('✅ Implementation:', implAddr);

  console.log('\n⬆️  proxy.upgradeToAndCall(impl, "0x")...');
  const tx = await amm.upgradeToAndCall(implAddr, '0x');
  console.log('   tx:', tx.hash);
  await tx.wait();
  console.log('✅ Upgrade mined');

  const erc1967ImplSlot =
    '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  const slotHex = await ethers.provider.getStorage(proxyAddr, erc1967ImplSlot);
  const implFromSlot = ethers.getAddress(`0x${slotHex.slice(-40)}`);
  console.log('\nERC1967 implementation slot →', implFromSlot);
  if (implFromSlot.toLowerCase() !== implAddr.toLowerCase()) {
    console.warn('⚠️  Slot pointer !== deployed impl address — investigate before relying on upgrade.');
  }

  console.log('\nSmoke read (proxy — optional):');
  try {
    const ammRead = await ethers.getContractAt('UupsAMM', proxyAddr);
    const floor = await ammRead.ARTIST_CASHOUT_MIN_ETH_WEI();
    console.log('ARTIST_CASHOUT_MIN_ETH_WEI:', ethers.formatEther(floor), 'ETH');
  } catch (e) {
    console.warn(
      '⚠️  Constant getter eth_call failed via Hardhat provider — upgrade tx already mined.',
      e.shortMessage || e.message,
    );
    console.warn('   Confirm on BaseScan or: ethers Contract at proxy → ARTIST_CASHOUT_MIN_ETH_WEI()');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
