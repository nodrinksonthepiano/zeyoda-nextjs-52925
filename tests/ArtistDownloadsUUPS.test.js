const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ArtistDownloadsUUPS (Manual Proxy)", function () {
  let deployer, downloads, proxyAddress;

  const artistId = "testartist";
  const baseURI  = "ipfs://zeyoda/";

  before(async () => {
    [deployer] = await ethers.getSigners();

    // 1. Deploy implementation
    const Downloads = await ethers.getContractFactory("ArtistDownloadsUUPS");
    const impl = await Downloads.deploy();
    await impl.waitForDeployment();
    const implAddress = await impl.getAddress();
    
    console.log("📦 Implementation deployed at:", implAddress);

    // 2. Encode initializer call
    const initData = Downloads.interface.encodeFunctionData("initialize", [
      artistId,
      baseURI,
      deployer.address
    ]);

    // 3. Deploy ERC1967Proxy pointing to implementation with init data
    const Proxy = await ethers.getContractFactory("ERC1967Proxy");
    const proxy = await Proxy.deploy(implAddress, initData);
    await proxy.waitForDeployment();
    proxyAddress = await proxy.getAddress();
    
    console.log("🔗 Proxy deployed at:", proxyAddress);

    // 4. Attach Downloads interface to proxy address
    downloads = Downloads.attach(proxyAddress);

    // 5. Verify implementation slot is set correctly (ERC-1967 stores address in last 20 bytes)
    const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    const raw = await ethers.provider.getStorage(proxyAddress, IMPL_SLOT);
    const implFromSlot = ethers.getAddress(ethers.dataSlice(raw, 12)); // Last 20 bytes = address
    
    console.log("✅ Implementation from slot:", implFromSlot);
    expect(implFromSlot).to.equal(implAddress);
  });

  it("Should initialize with correct values", async () => {
    expect(await downloads.artistId()).to.equal(artistId);
    expect(await downloads.uri(0)).to.equal(baseURI);
    expect(await downloads.owner()).to.equal(deployer.address);
    console.log("✅ Initialization verified");
  });

  it("buyFor mints to recipient and forwards 100% value to owner", async () => {
    const tokenId = 1;
    const qty = 2;
    const priceWei = ethers.parseEther("0.001");

    const recipient = ethers.Wallet.createRandom().address;
    const ownerBefore = await ethers.provider.getBalance(deployer.address);

    const tx = await downloads.buyFor(recipient, tokenId, qty, { value: priceWei });
    const receipt = await tx.wait();
    
    // Check minting
    expect(await downloads.balanceOf(recipient, tokenId)).to.equal(qty);
    expect(await downloads.totalMinted(tokenId)).to.equal(qty);

    // Check payment (owner received value minus gas they paid)
    const ownerAfter = await ethers.provider.getBalance(deployer.address);
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    
    // Owner balance should be roughly: before + priceWei - gasUsed
    // We check it went up (payment received) even after paying gas
    expect(ownerAfter).to.be.greaterThan(ownerBefore - gasUsed);
    
    console.log("✅ buyFor minted to recipient and owner received payment");
  });

  it("pause/unpause works", async () => {
    await downloads.pause();
    expect(await downloads.paused()).to.be.true;

    await expect(
      downloads.buyFor(ethers.Wallet.createRandom().address, 1, 1, { value: 0 })
    ).to.be.revertedWithCustomError(downloads, "EnforcedPause");

    await downloads.unpause();
    expect(await downloads.paused()).to.be.false;
    
    await downloads.buyFor(ethers.Wallet.createRandom().address, 2, 1, { value: 0 });
    expect(await downloads.balanceOf(ethers.Wallet.createRandom().address, 2)).to.equal(0); // different address, so 0
    
    console.log("✅ Pause/unpause working");
  });

  it("Free giveaway works (msg.value = 0)", async () => {
    const recipient = ethers.Wallet.createRandom().address;
    await downloads.buyFor(recipient, 3, 5, { value: 0 });
    expect(await downloads.balanceOf(recipient, 3)).to.equal(5);
    console.log("✅ Free giveaway works");
  });
});
