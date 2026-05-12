/**
 * One-off: call setSponsor(newSponsor) on ArtistDownloadsUUPS from the contract owner.
 *
 * Usage (Base Sepolia):
 *   export OWNER_SIGNER_PRIVATE_KEY="0x..."   # Must be download contract owner(), NOT minter
 *   export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"   # optional
 *   node scripts/setDownloadContractSponsor.js \
 *     0x03dCe01B64DC4281D9d29C147d0Df67691a6c4F3 \
 *     0x4cfb53929cA0609482b1228Fa08B4d4d36751aBF
 *
 * Never commit keys. Never paste keys into chat.
 */

const { ethers } = require("ethers");

const ABI = [
  "function owner() view returns (address)",
  "function sponsor() view returns (address)",
  "function setSponsor(address _sponsor) external",
];

async function main() {
  const contractAddr = process.argv[2];
  const newSponsor = process.argv[3];
  const pk = process.env.OWNER_SIGNER_PRIVATE_KEY;

  if (!contractAddr || !newSponsor) {
    console.error(
      "Usage: OWNER_SIGNER_PRIVATE_KEY=0x... node scripts/setDownloadContractSponsor.js <downloadProxyAddress> <newSponsorAddress>"
    );
    process.exit(1);
  }
  if (!pk) {
    console.error("Missing env OWNER_SIGNER_PRIVATE_KEY (must match contract owner())");
    process.exit(1);
  }

  const rpc =
    process.env.BASE_SEPOLIA_RPC_URL ||
    process.env.SERVER_BASE_SEPOLIA_RPC_URL ||
    "https://sepolia.base.org";

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  const c = new ethers.Contract(contractAddr, ABI, wallet);

  const owner = await c.owner();
  const before = await c.sponsor();
  console.log("Contract:", contractAddr);
  console.log("Signer:  ", wallet.address);
  console.log("owner(): ", owner);
  console.log("sponsor() before:", before);

  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error("Signer is not owner(). Refusing to send (tx would revert).");
    process.exit(1);
  }

  const tx = await c.setSponsor(newSponsor);
  console.log("setSponsor tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("status:", receipt.status === 1 ? "success" : "failed");

  const after = await c.sponsor();
  console.log("sponsor() after: ", after);
  if (after.toLowerCase() !== newSponsor.toLowerCase()) {
    console.error("Mismatch: sponsor() != newSponsor argument");
    process.exit(1);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
