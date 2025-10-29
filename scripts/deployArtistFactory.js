const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying ArtistFactory to Base Sepolia...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH\n");

  // Configuration - Use addresses from Sprint 1, 2A, 2B
  const TOKEN_IMPLEMENTATION = "0xe31608a3C5A7924D4C0f8A0b760839Caa2E4e90D";      // From Sprint 2A
  const DOWNLOADS_IMPLEMENTATION = "0x9de11C68d6f124BdAef175D51C7Ebb0bDb13d88e"; // V2 with sponsor in initialize
  const AMM_PROXY = "0x49B9538e0022dD919d9af2358783e89d08bCd82c";              // From Sprint 2B (FIXED)
  const PROTOCOL_VAULT = "0x615258a5263DBEe0DDEED3166ddC1f442D937eB3";         // Known
  const SPONSOR_ADDRESS = deployer.address;                                    // Server signer (can mint)

  console.log("⚙️  Configuration:");
  console.log("   Token Implementation:    ", TOKEN_IMPLEMENTATION);
  console.log("   Downloads Implementation:", DOWNLOADS_IMPLEMENTATION);
  console.log("   AMM Proxy:               ", AMM_PROXY);
  console.log("   Protocol Vault:          ", PROTOCOL_VAULT);
  console.log("   Sponsor (Server):        ", SPONSOR_ADDRESS);
  console.log("   Owner:                   ", deployer.address);
  console.log("");

  // Deploy factory
  console.log("📦 Deploying ArtistFactory with auto-sponsor support...");
  const Factory = await ethers.getContractFactory("ArtistFactory");
  const factory = await Factory.deploy(
    TOKEN_IMPLEMENTATION,
    DOWNLOADS_IMPLEMENTATION,
    AMM_PROXY,
    PROTOCOL_VAULT,
    SPONSOR_ADDRESS,      // Sponsor (server can mint)
    deployer.address      // Factory owner (protocol)
  );
  
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("✅ Factory deployed at:", factoryAddress);

  // Fund factory with ETH for LP seeding (protocol subsidizes)
  console.log("\n💰 Funding factory with ETH for LP seeding...");
  const fundingAmount = ethers.parseEther("0.05"); // Fund with 0.05 ETH (10 artists worth)
  
  const fundTx = await factory.fundFactory({ value: fundingAmount });
  await fundTx.wait();
  
  const factoryBalance = await factory.getBalance();
  console.log("   Factory funded with:", ethers.formatEther(factoryBalance), "ETH");
  console.log("   ✅ Can deploy", Math.floor(Number(ethers.formatEther(factoryBalance)) / 0.005), "artists");

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📋 FACTORY DEPLOYMENT SUMMARY");
  console.log("=".repeat(70));
  console.log("Network:               Base Sepolia");
  console.log("Factory Address:      ", factoryAddress);
  console.log("Factory Balance:      ", ethers.formatEther(factoryBalance), "ETH");
  console.log("Token Implementation: ", TOKEN_IMPLEMENTATION);
  console.log("Downloads Implementation:", DOWNLOADS_IMPLEMENTATION);
  console.log("AMM Proxy:            ", AMM_PROXY);
  console.log("Protocol Vault:       ", PROTOCOL_VAULT);
  console.log("=".repeat(70));

  console.log("\n📝 Add to .env.local:");
  console.log(`NEXT_PUBLIC_ARTIST_FACTORY=${factoryAddress}`);
  console.log(`NEXT_PUBLIC_DEPLOYMENT_MODE=UUPS`);

  console.log("\n📝 Test factory with new artist:");
  console.log("   1. Go to localhost:3000?artist=newartist");
  console.log("   2. Type 'zeyoda' to trigger onboarding");
  console.log("   3. Fill form and click deploy");
  console.log("   4. Single transaction deploys everything!");

  console.log("\n✅ Factory Ready! Protocol-subsidized artist onboarding enabled!\n");

  return {
    factory: factoryAddress,
    balance: factoryBalance.toString()
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

