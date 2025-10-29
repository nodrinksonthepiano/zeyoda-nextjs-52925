const { ethers } = require("hardhat");

async function main() {
  console.log("🌱 Seeding liquidity pool for testartist...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer:", deployer.address);

  // Configuration from environment
  const AMM_PROXY = process.env.AMM_PROXY;
  const TOKEN_PROXY = process.env.ARTIST_TOKEN_PROXY || "0xDFf8058890102f2aF623c9B6E0C1Ab42Bb996a8c";
  
  if (!AMM_PROXY) {
    throw new Error("❌ AMM_PROXY environment variable required! Set it to the AMM proxy address from deployment.");
  }

  console.log("⚙️  Configuration:");
  console.log("   Token:", TOKEN_PROXY);
  console.log("   AMM:", AMM_PROXY);
  console.log("");

  // Attach contracts
  const token = await ethers.getContractAt("ArtistTokenUUPS", TOKEN_PROXY);
  const amm = await ethers.getContractAt("UupsAMM", AMM_PROXY);

  // Check deployer's token balance (should have 100M from initialMint)
  console.log("💰 Checking deployer token balance...");
  const deployerBalance = await token.balanceOf(deployer.address);
  console.log("   Balance:", ethers.formatUnits(deployerBalance, 18), "tokens");
  
  const expected100M = ethers.parseUnits("100000000", 18);
  if (deployerBalance.toString() !== expected100M.toString()) {
    console.warn("⚠️  Warning: Expected 100M tokens, got", ethers.formatUnits(deployerBalance, 18));
  }

  // Pool seed amounts
  const TOKEN_AMOUNT = ethers.parseUnits("100000000", 18); // 100M tokens
  const ETH_AMOUNT = ethers.parseEther("0.005");           // 0.005 ETH

  console.log("\n🎯 Seed amounts:");
  console.log("   Tokens: 100,000,000");
  console.log("   ETH: 0.005");
  console.log("");

  // Step 1: Approve AMM to spend tokens
  console.log("✅ Step 1: Approving AMM to spend 100M tokens...");
  const approveTx = await token.approve(AMM_PROXY, TOKEN_AMOUNT);
  const approveReceipt = await approveTx.wait();
  console.log("   Transaction:", approveReceipt.hash);
  console.log("   ✅ Approval confirmed");

  // Step 2: Create pool
  console.log("\n⛏️  Step 2: Creating liquidity pool...");
  const createPoolTx = await amm.createPool(TOKEN_PROXY, TOKEN_AMOUNT, {
    value: ETH_AMOUNT
  });
  const createPoolReceipt = await createPoolTx.wait();
  console.log("   Transaction:", createPoolReceipt.hash);
  console.log("   Status:", createPoolReceipt.status === 1 ? "Success ✅" : "Failed ❌");
  
  if (createPoolReceipt.status !== 1) {
    throw new Error("❌ Pool creation failed!");
  }
  console.log("   ✅ Pool created");

  // Step 3: Verify pool reserves
  console.log("\n🔍 Verifying pool reserves...");
  const [tokenReserve, ethReserve] = await amm.getReserves(TOKEN_PROXY);
  
  console.log("   Token Reserve:", ethers.formatUnits(tokenReserve, 18));
  console.log("   ETH Reserve:", ethers.formatEther(ethReserve));
  
  const tokenMatch = tokenReserve.toString() === TOKEN_AMOUNT.toString();
  const ethMatch = ethReserve.toString() === ETH_AMOUNT.toString();
  
  console.log("   Token Match:", tokenMatch ? "✅" : "❌");
  console.log("   ETH Match:", ethMatch ? "✅" : "❌");

  // Step 4: Test quote functionality
  console.log("\n💱 Testing price quotes...");
  const testEthIn = ethers.parseEther("0.001"); // 1 test ETH
  const tokensOut = await amm.getTokenQuote(TOKEN_PROXY, testEthIn);
  
  console.log("   Quote: 0.001 ETH →", ethers.formatUnits(tokensOut, 18), "tokens");
  
  // Calculate expected price
  const pricePerToken = Number(ethers.formatEther(ethReserve)) / Number(ethers.formatUnits(tokenReserve, 18));
  console.log("   Current price: ~$" + (pricePerToken * 2500).toFixed(8), "per token (at $2500 ETH)");

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📋 POOL SEEDING SUMMARY");
  console.log("=".repeat(70));
  console.log("Token:             ", TOKEN_PROXY);
  console.log("AMM:               ", AMM_PROXY);
  console.log("Token Reserve:     ", ethers.formatUnits(tokenReserve, 18));
  console.log("ETH Reserve:       ", ethers.formatEther(ethReserve));
  console.log("Initial Price:     ~$" + (pricePerToken * 2500).toFixed(8), "per token");
  console.log("=".repeat(70));

  console.log("\n📝 Supabase Updates (copy/paste):");
  console.log(`UPDATE artists SET swap_address = '${AMM_PROXY}' WHERE id = 'testartist';`);
  console.log(`UPDATE artist_registry SET swap = '${AMM_PROXY}' WHERE id = 'testartist';`);

  console.log("\n✅ Sprint 2B Complete! Pool seeded and ready for trading!\n");

  return {
    tokenReserve: tokenReserve.toString(),
    ethReserve: ethReserve.toString(),
    pricePerToken
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  });

