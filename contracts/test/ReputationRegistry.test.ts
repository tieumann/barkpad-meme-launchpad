import { expect } from "chai";
import { ethers } from "hardhat";
import { ReputationRegistry } from "../typechain-types";

describe("ReputationRegistry", () => {
  async function deploy() {
    const [admin, factory, curve, moderator, creator, token, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ReputationRegistry");
    const reg = (await Factory.deploy(admin.address)) as unknown as ReputationRegistry;
    await reg.waitForDeployment();

    await reg.connect(admin).grantRole(await reg.FACTORY_ROLE(), factory.address);
    await reg.connect(admin).grantRole(await reg.CURVE_ROLE(), curve.address);
    await reg.connect(admin).grantRole(await reg.MODERATOR_ROLE(), moderator.address);

    return { reg, admin, factory, curve, moderator, creator, token, outsider };
  }

  it("records launches via FACTORY_ROLE", async () => {
    const { reg, factory, creator, token } = await deploy();
    await expect(reg.connect(factory).recordLaunch(creator.address, token.address))
      .to.emit(reg, "LaunchRecorded")
      .withArgs(creator.address, token.address);
    const rep = await reg.reputationOf(creator.address);
    expect(rep.launches).to.equal(1);
    expect(rep.score).to.equal(0);
  });

  it("increments score on graduation via CURVE_ROLE", async () => {
    const { reg, curve, creator, token } = await deploy();
    await reg.connect(curve).recordGraduation(creator.address, token.address);
    const rep = await reg.reputationOf(creator.address);
    expect(rep.graduations).to.equal(1);
    expect(rep.score).to.equal(await reg.W_GRAD());
  });

  it("decrements score on flag via MODERATOR_ROLE", async () => {
    const { reg, curve, moderator, creator, token } = await deploy();
    await reg.connect(curve).recordGraduation(creator.address, token.address); // +10
    await reg.connect(moderator).flag(creator.address, token.address, "rug attempt"); // -25
    const rep = await reg.reputationOf(creator.address);
    const expected = (await reg.W_GRAD()) - (await reg.W_FLAG());
    expect(rep.score).to.equal(expected);
    expect(rep.flags).to.equal(1);
  });

  it("rejects writes from unauthorized accounts", async () => {
    const { reg, outsider, creator, token } = await deploy();
    await expect(
      reg.connect(outsider).recordLaunch(creator.address, token.address)
    ).to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
    await expect(
      reg.connect(outsider).recordGraduation(creator.address, token.address)
    ).to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
    await expect(
      reg.connect(outsider).flag(creator.address, token.address, "x")
    ).to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
  });
});
