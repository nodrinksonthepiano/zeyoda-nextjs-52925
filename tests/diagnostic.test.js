const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("UUPS Proxy Diagnostic", function () {
  it("Should deploy a valid ERC-1967 proxy with implementation", async () => {
    const [deployer] = await ethers.getSigners();
    
    console.log("🔧 Deploying proxy...");
    const Downloads = await ethers.getContractFactory("ArtistDownloadsUUPS");
    
    const proxy = await upgrades.deployProxy(
      Downloads,
      ["testartist", "ipfs://zeyoda/", deployer.address],
      { initializer: "initialize", kind: "uups" }
    );
    await proxy.waitForDeployment();
    
    const proxyAddress = await proxy.getAddress();
    console.log("✅ Proxy deployed at:", proxyAddress);
    
    // Read ERC-1967 implementation slot directly
    const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    const implSlotValue = await ethers.provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT);
    const implAddress = "0x" + implSlotValue.slice(-40);
    
    console.log("📍 Implementation slot value:", implSlotValue);
    console.log("📍 Implementation address:", implAddress);
    
    // Check if implementation has code
    const implCode = await ethers.provider.getCode(implAddress);
    console.log("📏 Implementation code length:", implCode.length);
    
    expect(implCode).to.not.equal("0x");
    expect(implCode.length).to.be.greaterThan(2);
    
    // Try to call artistId()
    console.log("\n🧪 Testing artistId() call...");
    try {
      const artistId = await proxy.artistId();
      console.log("✅ artistId() returned:", artistId);
      expect(artistId).to.equal("testartist");
    } catch (error) {
      console.error("❌ artistId() failed:", error.message);
      throw error;
    }
  });
});

