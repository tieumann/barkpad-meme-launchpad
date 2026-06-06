import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { LiquidityLocker, MockERC20 } from "../typechain-types";

const AMOUNT = ethers.parseEther("1000");
const ONE_DAY = 24 * 60 * 60;

describe("LiquidityLocker", () => {
  async function deploy() {
    const [admin, locker, beneficiary, outsider] = await ethers.getSigners();

    const LP = await ethers.getContractFactory("MockERC20");
    const lp = (await LP.deploy("LP Token", "LP")) as unknown as MockERC20;
    await lp.waitForDeployment();

    const Locker = await ethers.getContractFactory("LiquidityLocker");
    const lockerContract = (await Locker.deploy(admin.address)) as unknown as LiquidityLocker;
    await lockerContract.waitForDeployment();
    await lockerContract.connect(admin).grantRole(await lockerContract.LOCKER_ROLE(), locker.address);

    // Fund the locker caller and approve.
    await lp.mint(locker.address, AMOUNT);
    await lp.connect(locker).approve(await lockerContract.getAddress(), AMOUNT);

    return { lp, lockerContract, admin, locker, beneficiary, outsider };
  }

  async function createLock() {
    const ctx = await deploy();
    const unlock = (await time.latest()) + ONE_DAY;
    await ctx.lockerContract
      .connect(ctx.locker)
      .lock(await ctx.lp.getAddress(), AMOUNT, unlock, ctx.beneficiary.address);
    return { ...ctx, unlock };
  }

  it("only LOCKER_ROLE can create a lock", async () => {
    const { lockerContract, outsider, lp, beneficiary } = await deploy();
    const unlock = (await time.latest()) + ONE_DAY;
    await expect(
      lockerContract.connect(outsider).lock(await lp.getAddress(), AMOUNT, unlock, beneficiary.address)
    ).to.be.revertedWithCustomError(lockerContract, "AccessControlUnauthorizedAccount");
  });

  it("pulls LP tokens in and records the lock", async () => {
    const { lockerContract, lp } = await createLock();
    expect(await lp.balanceOf(await lockerContract.getAddress())).to.equal(AMOUNT);
    const l = await lockerContract.getLock(0);
    expect(l.amount).to.equal(AMOUNT);
    expect(l.withdrawn).to.equal(false);
  });

  it("reverts withdrawal before unlock", async () => {
    const { lockerContract, beneficiary } = await createLock();
    await expect(lockerContract.connect(beneficiary).withdraw(0)).to.be.revertedWithCustomError(
      lockerContract,
      "StillLocked"
    );
  });

  it("allows withdrawal exactly once after unlock", async () => {
    const { lockerContract, beneficiary, lp, unlock } = await createLock();
    await time.increaseTo(unlock + 1);

    await lockerContract.connect(beneficiary).withdraw(0);
    expect(await lp.balanceOf(beneficiary.address)).to.equal(AMOUNT);

    await expect(lockerContract.connect(beneficiary).withdraw(0)).to.be.revertedWithCustomError(
      lockerContract,
      "AlreadyWithdrawn"
    );
  });

  it("only the beneficiary can withdraw", async () => {
    const { lockerContract, outsider, unlock } = await createLock();
    await time.increaseTo(unlock + 1);
    await expect(lockerContract.connect(outsider).withdraw(0)).to.be.revertedWithCustomError(
      lockerContract,
      "NotBeneficiary"
    );
  });
});
