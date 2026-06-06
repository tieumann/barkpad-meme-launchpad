import { expect } from "chai";
import { ethers } from "hardhat";
import { DogOn } from "../typechain-types";

describe("DogOn", () => {
  async function deploy() {
    const [owner, treasury, alice] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("DogOn");
    const dogon = (await Factory.deploy(treasury.address, owner.address)) as unknown as DogOn;
    await dogon.waitForDeployment();
    return { owner, treasury, alice, dogon };
  }

  it("mints the full fixed supply to the treasury", async () => {
    const { dogon, treasury } = await deploy();
    const max = await dogon.MAX_SUPPLY();
    expect(await dogon.totalSupply()).to.equal(max);
    expect(await dogon.balanceOf(treasury.address)).to.equal(max);
    expect(await dogon.name()).to.equal("DogOn");
    expect(await dogon.symbol()).to.equal("DOGON");
  });

  it("has no mint function (supply is fixed)", async () => {
    const { dogon } = await deploy();
    expect((dogon as unknown as { mint?: unknown }).mint).to.equal(undefined);
  });

  it("is burnable", async () => {
    const { dogon, treasury } = await deploy();
    const burn = ethers.parseEther("1000");
    const before = await dogon.totalSupply();
    await dogon.connect(treasury).burn(burn);
    expect(await dogon.totalSupply()).to.equal(before - burn);
  });
});
