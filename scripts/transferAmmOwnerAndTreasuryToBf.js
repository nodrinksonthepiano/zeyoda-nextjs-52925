/**
 * One-time (or idempotent) handoff: shared UupsAMM owner + treasury → BF on Base Sepolia.
 *
 * Why `setTreasury` before `transferOwnership`:
 * Both are `onlyOwner`. After `transferOwnership(BF)`, only BF can call `setTreasury`.
 * On a single session as current owner (B3), do treasury first, then ownership.
 *
 * Prerequisites:
 *   - `MINTER_PRIVATE_KEY` in `.env.local` must be the *current* AMM owner (today: B3).
 *   - That wallet needs a little Base Sepolia ETH for gas.
 *
 * Usage:
 *   npx hardhat run scripts/transferAmmOwnerAndTreasuryToBf.js --network baseSepolia
 *
 * Optional env:
 *   AMM_PROXY=0x...           (default: shared proxy from deployArtistFactory)
 *   AMM_NEW_OWNER=0x...       (default: BF / PROTOCOL_VAULT from deploy script)
 */
const { ethers } = require('hardhat');

const DEFAULT_AMM_PROXY = '0x49B9538e0022dD919d9af2358783e89d08bCd82c';
const DEFAULT_BF = '0x4cfb53929cA0609482b1228Fa08B4D4d36751aBF';

async function main() {
  const ammProxy = (process.env.AMM_PROXY || DEFAULT_AMM_PROXY).trim();
  const newOwner = (process.env.AMM_NEW_OWNER || DEFAULT_BF).trim();

  if (!ethers.isAddress(ammProxy) || !ethers.isAddress(newOwner)) {
    throw new Error('Invalid AMM_PROXY or AMM_NEW_OWNER address.');
  }

  const [signer] = await ethers.getSigners();
  const amm = await ethers.getContractAt('UupsAMM', ammProxy, signer);

  const ownerBefore = await amm.owner();
  const treasuryBefore = await amm.treasury();

  console.log('AMM proxy:     ', ammProxy);
  console.log('Signer:        ', signer.address);
  console.log('Target (BF):   ', newOwner);
  console.log('owner() before:', ownerBefore);
  console.log('treasury() before:', treasuryBefore);

  if (
    ownerBefore.toLowerCase() === newOwner.toLowerCase() &&
    treasuryBefore.toLowerCase() === newOwner.toLowerCase()
  ) {
    console.log('✅ Already migrated: owner and treasury are the target.');
    return;
  }

  if (ownerBefore.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `Signer ${signer.address} is not AMM owner (${ownerBefore}). Set MINTER_PRIVATE_KEY to the current owner key.`,
    );
  }

  if (treasuryBefore.toLowerCase() !== newOwner.toLowerCase()) {
    console.log('→ setTreasury(BF)...');
    const tx1 = await amm.setTreasury(newOwner);
    console.log('  tx:', tx1.hash);
    await tx1.wait();
    console.log('  ✅ mined');
  } else {
    console.log('treasury already target; skipping setTreasury');
  }

  if (ownerBefore.toLowerCase() !== newOwner.toLowerCase()) {
    console.log('→ transferOwnership(BF)...');
    const tx2 = await amm.transferOwnership(newOwner);
    console.log('  tx:', tx2.hash);
    await tx2.wait();
    console.log('  ✅ mined');
  } else {
    console.log('owner already target; skipping transferOwnership');
  }

  const ammRead = await ethers.getContractAt('UupsAMM', ammProxy);
  const ownerAfter = await ammRead.owner();
  const treasuryAfter = await ammRead.treasury();
  console.log('owner() after:   ', ownerAfter);
  console.log('treasury() after:', treasuryAfter);

  if (
    ownerAfter.toLowerCase() !== newOwner.toLowerCase() ||
    treasuryAfter.toLowerCase() !== newOwner.toLowerCase()
  ) {
    throw new Error('Verification failed: owner/treasury do not match target.');
  }

  console.log('\n✅ AMM handed off to BF. Retire B3 from AMM control; optionally set MINTER_PRIVATE_KEY to BF for future owner-only txs.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
