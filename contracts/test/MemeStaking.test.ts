import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MemeStaking, MockERC20 } from "../typechain-types";

const STAKE = ethers.parseEther("1000");
const REWARD_FUND = ethers.parseEther("3024000"); // divisible-ish over 30d

describe("MemeStaking", () => {
  async function deploy() {
    const [owner, alice, bob] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const stakeToken = (await Token.deploy("Stake", "STK")) as unknown as MockERC20;
    const rewardToken = (await Token.deploy("Reward", "RWD")) as unknown as MockERC20;
    await stakeToken.waitForDeployment();
    await rewardToken.waitForDeployment();

    const Staking = await ethers.getContractFactory("MemeStaking");
    const staking = (await Staking.deploy(
      await stakeToken.getAddress(),
      await rewardToken.getAddress(),
      owner.address
    )) as unknown as MemeStaking;
    await staking.waitForDeployment();

    // Fund stakers.
    await stakeToken.mint(alice.address, STAKE);
    await stakeToken.mint(bob.address, STAKE);

    return { owner, alice, bob, stakeToken, rewardToken, staking };
  }

  async function fundRewards(ctx: Awaited<ReturnType<typeof deploy>>) {
    await ctx.rewardToken.mint(await ctx.staking.getAddress(), REWARD_FUND);
    await ctx.staking.connect(ctx.owner).notifyRewardAmount(REWARD_FUND);
  }

  it("accrues rewards proportional to stake over time", async () => {
    const ctx = await deploy();
    const { staking, stakeToken, alice } = ctx;

    await stakeToken.connect(alice).approve(await staking.getAddress(), STAKE);
    await staking.connect(alice).stake(STAKE);
    await fundRewards(ctx);

    expect(await staking.earned(alice.address)).to.equal(0);
    await time.increase(15 * 24 * 60 * 60); // 15 days
    const earned = await staking.earned(alice.address);
    expect(earned).to.be.gt(0);
    // ~ half the funded amount over half the duration (sole staker).
    expect(earned).to.be.closeTo(REWARD_FUND / 2n, ethers.parseEther("10000"));
  });

  it("splits rewards fairly between two equal stakers (no draining)", async () => {
    const ctx = await deploy();
    const { staking, stakeToken, rewardToken, alice, bob } = ctx;

    await stakeToken.connect(alice).approve(await staking.getAddress(), STAKE);
    await stakeToken.connect(bob).approve(await staking.getAddress(), STAKE);
    await staking.connect(alice).stake(STAKE);
    await staking.connect(bob).stake(STAKE);
    await fundRewards(ctx);

    await time.increase(31 * 24 * 60 * 60); // past period end

    const aEarned = await staking.earned(alice.address);
    const bEarned = await staking.earned(bob.address);
    expect(aEarned).to.be.closeTo(bEarned, ethers.parseEther("1"));

    await staking.connect(alice).claim();
    await staking.connect(bob).claim();

    // Total paid never exceeds funded amount.
    const aBal = await rewardToken.balanceOf(alice.address);
    const bBal = await rewardToken.balanceOf(bob.address);
    expect(aBal + bBal).to.be.lte(REWARD_FUND);
  });

  it("returns stake on unstake and settles rewards", async () => {
    const ctx = await deploy();
    const { staking, stakeToken, alice } = ctx;
    await stakeToken.connect(alice).approve(await staking.getAddress(), STAKE);
    await staking.connect(alice).stake(STAKE);
    await fundRewards(ctx);
    await time.increase(10 * 24 * 60 * 60);

    await staking.connect(alice).unstake(STAKE);
    expect(await stakeToken.balanceOf(alice.address)).to.equal(STAKE);
    expect(await staking.balanceOf(alice.address)).to.equal(0);
    // Rewards still claimable after unstake.
    expect(await staking.earned(alice.address)).to.be.gt(0);
  });

  it("rejects unstaking more than staked", async () => {
    const ctx = await deploy();
    const { staking, stakeToken, alice } = ctx;
    await stakeToken.connect(alice).approve(await staking.getAddress(), STAKE);
    await staking.connect(alice).stake(STAKE);
    await expect(staking.connect(alice).unstake(STAKE + 1n)).to.be.revertedWithCustomError(
      staking,
      "InsufficientStake"
    );
  });

  it("reverts notifyRewardAmount if not funded enough (no draining)", async () => {
    const ctx = await deploy();
    // Did not transfer reward tokens in.
    await expect(
      ctx.staking.connect(ctx.owner).notifyRewardAmount(REWARD_FUND)
    ).to.be.revertedWithCustomError(ctx.staking, "RewardTooHigh");
  });
});
