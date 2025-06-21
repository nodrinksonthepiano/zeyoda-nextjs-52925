const { ethers } = require("ethers");

async function main() {
  const dirtyAddress = "0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8";
  // Convert to a valid checksum address to prevent errors
  const ownerAddress = ethers.getAddress(dirtyAddress);
  
  console.log(`Calculating potential contract addresses for owner: ${ownerAddress}`);
  console.log("----------------------------------------------------------");

  // Nonces are transaction counters, starting from 0.
  // We'll check the nonces that were causing errors (0 through 8).
  for (let i = 0; i < 9; i++) {
    const nonce = i;
    const predictedAddress = ethers.getCreateAddress({
      from: ownerAddress,
      nonce: nonce,
    });
    console.log(`Nonce ${nonce}: ${predictedAddress}`);
  }

  console.log("----------------------------------------------------------");
  console.log("ACTION: Please check each address above on BaseScan (sepolia.basescan.org).");
  console.log("If one of them shows a contract, that's our lost contract!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
