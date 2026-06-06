import { expect } from "chai";
import { ethers } from "hardhat";
import { Treasury } from "../typechain-types";

const TRADING_FEE = 100; // 1%
const CREATION_FEE = ethers.parseEther("1");

describe("Treasury", () => {
  async function deploy() {
    const [admin, treasurer, outsider, recipient] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("Treasury");
    const treasury = (await Factory.deploy(admin.address, TRADING_FEE, CREATION_FEE)) as unknown as Treasury;
    await treasury.waitForDeployment();
    return { treasury, admin, treasurer, outsider, recipient };
  }

  it("initializes with bounded fees and grants admin roles", async () => {
    const { treasury, admin } = await deploy();
    expect(await treasury.tradingFeeBps()).to.equal(TRADING_FEE);
    expect(await treasury.creationFee()).to.equal(CREATION_FEE);
    expect(await treasury.hasRole(await treasury.TREASURER_ROLE(), admin.address)).to.equal(true);
    expect(await treasury.hasRole(await treasury.FEE_ADMIN_ROLE(), admin.address)).to.equal(true);
  });

  it("rejects construction with fees above bounds", async () => {
    const [admin] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("Treasury");
    await expect(Factory.deploy(admin.address, 301, CREATION_FEE)).to.be.revertedWithCustomError(
      Factory,
      "FeeTooHigh"
    );
  });

  it("collects fees and emits FeeCollected", async () => {
    const { treasury, outsider } = await deploy();
    const kind = ethers.encodeBytes32String("trade");
    await expect(treasury.connect(outsider).collect(kind, { value: ethers.parseEther("0.5") }))
      .to.emit(treasury, "FeeCollected")
      .withArgs(outsider.address, ethers.parseEther("0.5"), kind);
    expect(await ethers.provider.getBalance(await treasury.getAddress())).to.equal(ethers.parseEther("0.5"));
  });

  it("enforces trading fee upper bound (3%)", async () => {
    const { treasury } = await deploy();
    await expect(treasury.setTradingFeeBps(301)).to.be.revertedWithCustomError(treasury, "FeeTooHigh");
    await treasury.setTradingFeeBps(300);
    expect(await treasury.tradingFeeBps()).to.equal(300);
  });

  it("enforces creation fee upper bound", async () => {
    const { treasury } = await deploy();
    await expect(treasury.setCreationFee(ethers.parseEther("101"))).to.be.revertedWithCustomError(
      treasury,
      "FeeTooHigh"
    );
  });

  it("only TREASURER_ROLE can withdraw", async () => {
    const { treasury, outsider, recipient, admin } = await deploy();
    await treasury.connect(outsider).collect(ethers.ZeroHash, { value: ethers.parseEther("2") });

    await expect(
      treasury.connect(outsider).withdraw(recipient.address, ethers.parseEther("1"))
    ).to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");

    const before = await ethers.provider.getBalance(recipient.address);
    await treasury.connect(admin).withdraw(recipient.address, ethers.parseEther("1"));
    const after = await ethers.provider.getBalance(recipient.address);
    expect(after - before).to.equal(ethers.parseEther("1"));
  });

  it("only FEE_ADMIN_ROLE can change fees", async () => {
    const { treasury, outsider } = await deploy();
    await expect(treasury.connect(outsider).setTradingFeeBps(50)).to.be.revertedWithCustomError(
      treasury,
      "AccessControlUnauthorizedAccount"
    );
  });
});
