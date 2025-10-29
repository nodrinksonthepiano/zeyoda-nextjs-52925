import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { ArtistDownloadsUUPS } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ArtistDownloadsUUPS", function () {
  let downloadsContract: ArtistDownloadsUUPS;
  let owner: SignerWithAddress;
  let artist: SignerWithAddress;
  let user: SignerWithAddress;
  let otherAccount: SignerWithAddress;

  const ARTIST_ID = "testartist";
  const BASE_URI = "https://zeyoda.com/metadata/";
  const TOKEN_ID = 1;
  const QUANTITY = 1;

  beforeEach(async function () {
    [owner, artist, user, otherAccount] = await ethers.getSigners();

    // Deploy UUPS proxy
    const ArtistDownloadsUUPS = await ethers.getContractFactory("ArtistDownloadsUUPS");
    downloadsContract = await upgrades.deployProxy(
      ArtistDownloadsUUPS,
      [ARTIST_ID, BASE_URI, artist.address],
      { initializer: "initialize", kind: "uups" }
    ) as unknown as ArtistDownloadsUUPS;

    await downloadsContract.waitForDeployment();
  });

  describe("Initialization", function () {
    it("Should initialize with correct values", async function () {
      expect(await downloadsContract.artistId()).to.equal(ARTIST_ID);
      expect(await downloadsContract.owner()).to.equal(artist.address);
    });

    it("Should not allow reinitialization", async function () {
      await expect(
        downloadsContract.initialize(ARTIST_ID, BASE_URI, artist.address)
      ).to.be.revertedWithCustomError(downloadsContract, "InvalidInitialization");
    });
  });

  describe("buyFor() - Server-Sponsored Purchases", function () {
    it("Should mint NFT to recipient, not caller", async function () {
      const paymentAmount = ethers.parseEther("0.001");

      await downloadsContract.connect(artist).buyFor(
        user.address,
        TOKEN_ID,
        QUANTITY,
        { value: paymentAmount }
      );

      expect(await downloadsContract.balanceOf(user.address, TOKEN_ID)).to.equal(QUANTITY);
      expect(await downloadsContract.totalMinted(TOKEN_ID)).to.equal(QUANTITY);
    });

    it("Should forward 100% of msg.value to owner (artist)", async function () {
      const paymentAmount = ethers.parseEther("0.001");
      const initialBalance = await ethers.provider.getBalance(artist.address);

      const tx = await downloadsContract.connect(artist).buyFor(
        user.address,
        TOKEN_ID,
        QUANTITY,
        { value: paymentAmount }
      );

      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const finalBalance = await ethers.provider.getBalance(artist.address);
      
      // Artist should receive payment minus gas (since artist is owner and caller)
      // Payment goes back to artist, but they also paid gas
      expect(finalBalance).to.be.closeTo(
        initialBalance - gasUsed,
        ethers.parseEther("0.00001") // Small tolerance for gas estimation
      );
    });

    it("Should emit DownloadPurchased event with correct values", async function () {
      const paymentAmount = ethers.parseEther("0.001");

      await expect(
        downloadsContract.connect(artist).buyFor(
          user.address,
          TOKEN_ID,
          QUANTITY,
          { value: paymentAmount }
        )
      )
        .to.emit(downloadsContract, "DownloadPurchased")
        .withArgs(user.address, TOKEN_ID, QUANTITY, paymentAmount);
    });

    it("Should revert if called by non-owner", async function () {
      const paymentAmount = ethers.parseEther("0.001");

      await expect(
        downloadsContract.connect(otherAccount).buyFor(
          user.address,
          TOKEN_ID,
          QUANTITY,
          { value: paymentAmount }
        )
      ).to.be.revertedWithCustomError(downloadsContract, "OwnableUnauthorizedAccount");
    });

    it("Should work with msg.value = 0 (free giveaway)", async function () {
      await downloadsContract.connect(artist).buyFor(
        user.address,
        TOKEN_ID,
        QUANTITY,
        { value: 0 }
      );

      expect(await downloadsContract.balanceOf(user.address, TOKEN_ID)).to.equal(QUANTITY);
    });

    it("Should revert if recipient is zero address", async function () {
      await expect(
        downloadsContract.connect(artist).buyFor(
          ethers.ZeroAddress,
          TOKEN_ID,
          QUANTITY,
          { value: ethers.parseEther("0.001") }
        )
      ).to.be.revertedWith("Invalid recipient");
    });

    it("Should revert if quantity is zero", async function () {
      await expect(
        downloadsContract.connect(artist).buyFor(
          user.address,
          TOKEN_ID,
          0,
          { value: ethers.parseEther("0.001") }
        )
      ).to.be.revertedWith("Quantity must be > 0");
    });
  });

  describe("Legacy mintDownload()", function () {
    it("Should mint tokens correctly", async function () {
      await downloadsContract.connect(artist).mintDownload(
        user.address,
        TOKEN_ID,
        QUANTITY
      );

      expect(await downloadsContract.balanceOf(user.address, TOKEN_ID)).to.equal(QUANTITY);
      expect(await downloadsContract.totalMinted(TOKEN_ID)).to.equal(QUANTITY);
    });

    it("Should emit DownloadMinted event", async function () {
      await expect(
        downloadsContract.connect(artist).mintDownload(
          user.address,
          TOKEN_ID,
          QUANTITY
        )
      )
        .to.emit(downloadsContract, "DownloadMinted")
        .withArgs(user.address, TOKEN_ID, QUANTITY, ARTIST_ID);
    });
  });

  describe("Pause/Unpause", function () {
    it("Should pause and unpause correctly", async function () {
      await downloadsContract.connect(artist).pause();
      expect(await downloadsContract.paused()).to.be.true;

      await downloadsContract.connect(artist).unpause();
      expect(await downloadsContract.paused()).to.be.false;
    });

    it("Should block buyFor() when paused", async function () {
      await downloadsContract.connect(artist).pause();

      await expect(
        downloadsContract.connect(artist).buyFor(
          user.address,
          TOKEN_ID,
          QUANTITY,
          { value: ethers.parseEther("0.001") }
        )
      ).to.be.revertedWithCustomError(downloadsContract, "EnforcedPause");
    });

    it("Should only allow owner to pause", async function () {
      await expect(
        downloadsContract.connect(otherAccount).pause()
      ).to.be.revertedWithCustomError(downloadsContract, "OwnableUnauthorizedAccount");
    });
  });

  describe("UUPS Upgrade", function () {
    it("Should preserve state after upgrade", async function () {
      // Mint some tokens before upgrade
      await downloadsContract.connect(artist).buyFor(
        user.address,
        TOKEN_ID,
        QUANTITY,
        { value: ethers.parseEther("0.001") }
      );

      const balanceBefore = await downloadsContract.balanceOf(user.address, TOKEN_ID);
      const totalMintedBefore = await downloadsContract.totalMinted(TOKEN_ID);

      // Deploy new implementation (same contract for this test)
      const ArtistDownloadsUUPSV2 = await ethers.getContractFactory("ArtistDownloadsUUPS");
      const upgraded = await upgrades.upgradeProxy(
        await downloadsContract.getAddress(),
        ArtistDownloadsUUPSV2,
        { kind: "uups" }
      );

      // Verify state is preserved
      expect(await upgraded.balanceOf(user.address, TOKEN_ID)).to.equal(balanceBefore);
      expect(await upgraded.totalMinted(TOKEN_ID)).to.equal(totalMintedBefore);
      expect(await upgraded.artistId()).to.equal(ARTIST_ID);
    });

    it("Should only allow owner to upgrade", async function () {
      const ArtistDownloadsUUPSV2 = await ethers.getContractFactory(
        "ArtistDownloadsUUPS",
        otherAccount
      );
      const newImplementation = await ArtistDownloadsUUPSV2.deploy();
      await newImplementation.waitForDeployment();

      await expect(
        downloadsContract.connect(otherAccount).upgradeToAndCall(
          await newImplementation.getAddress(),
          "0x"
        )
      ).to.be.revertedWithCustomError(downloadsContract, "OwnableUnauthorizedAccount");
    });
  });

  describe("Utility Functions", function () {
    it("Should check download access correctly", async function () {
      expect(await downloadsContract.hasDownloadAccess(user.address, TOKEN_ID)).to.be.false;

      await downloadsContract.connect(artist).buyFor(
        user.address,
        TOKEN_ID,
        QUANTITY,
        { value: 0 }
      );

      expect(await downloadsContract.hasDownloadAccess(user.address, TOKEN_ID)).to.be.true;
    });

    it("Should return correct URI", async function () {
      const uri = await downloadsContract.uri(TOKEN_ID);
      expect(uri).to.equal(`${BASE_URI}${ARTIST_ID}/${TOKEN_ID}`);
    });

    it("Should allow owner to update URI", async function () {
      const newURI = "https://new-uri.com/";
      await downloadsContract.connect(artist).setURI(newURI);
      
      const uri = await downloadsContract.uri(TOKEN_ID);
      expect(uri).to.include(newURI);
    });
  });

  describe("Batch Minting", function () {
    it("Should batch mint correctly", async function () {
      const tokenIds = [1, 2, 3];
      const amounts = [1, 2, 3];

      await downloadsContract.connect(artist).batchMintDownloads(
        user.address,
        tokenIds,
        amounts
      );

      expect(await downloadsContract.balanceOf(user.address, 1)).to.equal(1);
      expect(await downloadsContract.balanceOf(user.address, 2)).to.equal(2);
      expect(await downloadsContract.balanceOf(user.address, 3)).to.equal(3);
    });
  });
});

