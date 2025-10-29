const { ethers } = require("hardhat");

async function main() {
  console.log("💰 Recovering ETH from all old factories...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // All old factory addresses
  const OLD_FACTORIES = [
    "0xA97194062770fEbC7b8A65E999860a137408E924", // Factory #1
    "0xa452169e5a7262538c7B194521CfD8171E3592B1", // Factory #2
    "0xAbCaf3Ebb71aF649d3535c285501e44767CE5825", // Factory #3
    "0xf3A5Ed0509f7FbE06113f61859De8FC5B8619266"  // Factory #4
  ];

  let totalRecovered = 0n;

  for (const factoryAddr of OLD_FACTORIES) {
    try {
      const factory = await ethers.getContractAt("ArtistFactory", factoryAddr);
      const balance = await factory.getBalance();
      
      console.log(`\n📍 Factory: ${factoryAddr.slice(0, 10)}...`);
      console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);
      
      if (balance > 0n) {
        console.log(`   Withdrawing...`);
        const tx = await factory.withdrawETH(balance);
        await tx.wait();
        totalRecovered += balance;
        console.log(`   ✅ Recovered ${ethers.formatEther(balance)} ETH`);
      } else {
        console.log(`   (empty)`);
      }
    } catch (error) {
      console.log(`   ⚠️  Error: ${error.message}`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`💰 Total Recovered: ${ethers.formatEther(totalRecovered)} ETH`);
  console.log(`${"=".repeat(50)}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });

