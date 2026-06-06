import { expect } from "chai";
import { ethers } from "hardhat";
import { MemeToken } from "../typechain-types";

const NAME = "Doge Supreme";
const SYMBOL = "DOGES";
const SUPPLY = ethers.parseEther("1000000000"); // 1B tokens
const METADATA = ethers.encodeBytes32String("ipfs-cid-stub");

describe("MemeToken", () => {
  async function deployToken(): Promise<{ token: MemeToken; curve: string; creator: string }> {
    const [, curveSigner, creatorSigner] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("MemeToken");
    const token = (await Factory.deploy()) as unknown as MemeToken;
    await token.waitForDeployment();
    return { token, curve: curveSigner.address, creator: creatorSigner.address };
  }

  it("mints the full supply to the curve and disables minting", async () => {
    const { token, curve, creator } = await deployToken();
    await token.initialize(NAME, SYMBOL, SUPPLY, curve, creator, METADATA);

    expect(await token.name()).to.equal(NAME);
    expect(await token.symbol()).to.equal(SYMBOL);
    expect(await token.totalSupply()).to.equal(SUPPLY);
    expect(await token.balanceOf(curve)).to.equal(SUPPLY);
    expect(await token.creator()).to.equal(creator);
    expect(await token.metadataId()).to.equal(METADATA);
    expect(await token.mintingDisabled()).to.equal(true);
  });

  it("exposes no public mint function (supply is fixed)", async () => {
    const { token } = await deployToken();
    // There is no `mint` selector on the contract ABI.
    expect((token as unknown as { mint?: unknown }).mint).to.equal(undefined);
  });

  it("reverts on double initialization", async () => {
    const { token, curve, creator } = await deployToken();
    await token.initialize(NAME, SYMBOL, SUPPLY, curve, creator, METADATA);
    await expect(
      token.initialize(NAME, SYMBOL, SUPPLY, curve, creator, METADATA)
    ).to.be.revertedWithCustomError(token, "AlreadyInitialized");
  });

  it("reverts on invalid params (zero supply / zero curve / zero creator)", async () => {
    const { token, curve, creator } = await deployToken();
    await expect(
      token.initialize(NAME, SYMBOL, 0n, curve, creator, METADATA)
    ).to.be.revertedWithCustomError(token, "InvalidParams");
    await expect(
      token.initialize(NAME, SYMBOL, SUPPLY, ethers.ZeroAddress, creator, METADATA)
    ).to.be.revertedWithCustomError(token, "InvalidParams");
    await expect(
      token.initialize(NAME, SYMBOL, SUPPLY, curve, ethers.ZeroAddress, METADATA)
    ).to.be.revertedWithCustomError(token, "InvalidParams");
  });

  it("allows free transfers (no pause / no honeypot)", async () => {
    const [, , , holderA, holderB] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("MemeToken");
    const token = (await Factory.deploy()) as unknown as MemeToken;
    await token.waitForDeployment();
    // Mint supply to holderA by using them as the "curve" recipient for this test.
    await token.initialize(NAME, SYMBOL, SUPPLY, holderA.address, holderA.address, METADATA);

    const amount = ethers.parseEther("100");
    await token.connect(holderA).transfer(holderB.address, amount);
    expect(await token.balanceOf(holderB.address)).to.equal(amount);
  });
});
