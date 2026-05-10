/**
 * Fund an already-deployed ArtistFactory with ETH for createArtist LP subsidy.
 * Uses MINTER_PRIVATE_KEY from .env.local (same signer as hardhat.config.js baseSepolia).
 *
 * Usage:
 *   FACTORY_ADDRESS=0x... npx hardhat run scripts/fundArtistFactory.js --network baseSepolia
 */
const { ethers } = require('hardhat');

const DEFAULT_FUND = ethers.parseEther('0.05');

async function main() {
  const factoryAddr =
    process.env.FACTORY_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_ARTIST_FACTORY?.trim();
  if (!factoryAddr || !ethers.isAddress(factoryAddr)) {
    throw new Error(
      'Set FACTORY_ADDRESS=0x... (or NEXT_PUBLIC_ARTIST_FACTORY) for the deployed factory.',
    );
  }

  const [signer] = await ethers.getSigners();
  const factory = await ethers.getContractAt('ArtistFactory', factoryAddr, signer);

  const owner = await factory.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `Signer ${signer.address} is not factory owner (${owner}). Use the owner key in MINTER_PRIVATE_KEY.`,
    );
  }

  const before = await ethers.provider.getBalance(factoryAddr);
  console.log('Factory:', factoryAddr);
  console.log('Owner:', owner);
  console.log('Balance before:', ethers.formatEther(before), 'ETH');

  console.log('Sending', ethers.formatEther(DEFAULT_FUND), 'ETH via fundFactory()...');
  const tx = await factory.fundFactory({ value: DEFAULT_FUND });
  await tx.wait();

  const after = await ethers.provider.getBalance(factoryAddr);
  console.log('Balance after:', ethers.formatEther(after), 'ETH');
  console.log('✅ Done. Need ≥0.005 ETH per createArtist.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
