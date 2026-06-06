import { expect } from "chai";
import { ethers } from "hardhat";
import { QuestRewards, MockERC20 } from "../typechain-types";

const FOLLOW = ethers.id("FOLLOW");
const DISCORD = ethers.id("DISCORD");
const X_POST = ethers.id("X_POST");

describe("QuestRewards", () => {
  async function deploy() {
    const [admin, operator, alice, bob] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const reward = (await Token.deploy("DogOn", "DOGON")) as unknown as MockERC20;
    await reward.waitForDeployment();

    const Quest = await ethers.getContractFactory("QuestRewards");
    const quest = (await Quest.deploy(await reward.getAddress(), admin.address)) as unknown as QuestRewards;
    await quest.waitForDeployment();

    await quest.connect(admin).grantRole(await quest.OPERATOR_ROLE(), operator.address);

    // Configure point weights: follow=1, discord=1, x_post=2.
    await quest.connect(admin).configureActions([FOLLOW, DISCORD, X_POST], [1, 1, 2]);

    return { admin, operator, alice, bob, reward, quest };
  }

  it("awards points per action with configured weights", async () => {
    const { quest, operator, alice } = await deploy();
    await quest.connect(operator).awardAction(alice.address, FOLLOW); // +1
    await quest.connect(operator).awardAction(alice.address, X_POST); // +2
    expect(await quest.pointsOf(alice.address)).to.equal(3);
    expect(await quest.totalPoints()).to.equal(3);
  });

  it("prevents double-counting the same action for a user", async () => {
    const { quest, operator, alice } = await deploy();
    await quest.connect(operator).awardAction(alice.address, FOLLOW);
    await expect(
      quest.connect(operator).awardAction(alice.address, FOLLOW)
    ).to.be.revertedWithCustomError(quest, "AlreadyCompleted");
  });

  it("rejects unconfigured actions and non-operators", async () => {
    const { quest, operator, alice } = await deploy();
    await expect(
      quest.connect(operator).awardAction(alice.address, ethers.id("UNKNOWN"))
    ).to.be.revertedWithCustomError(quest, "ActionNotConfigured");
    await expect(
      quest.connect(alice).awardAction(alice.address, FOLLOW)
    ).to.be.revertedWithCustomError(quest, "AccessControlUnauthorizedAccount");
  });

  it("batch awards points", async () => {
    const { quest, operator, alice, bob } = await deploy();
    await quest.connect(operator).awardBatch([alice.address, bob.address, alice.address], [FOLLOW, DISCORD, X_POST]);
    expect(await quest.pointsOf(alice.address)).to.equal(3);
    expect(await quest.pointsOf(bob.address)).to.equal(1);
  });

  it("converts points to tokens and lets users claim once", async () => {
    const { quest, operator, admin, alice, bob, reward } = await deploy();
    await quest.connect(operator).awardBatch([alice.address, bob.address], [X_POST, FOLLOW]); // alice 2, bob 1
    const tokensPerPoint = ethers.parseEther("100");

    // Fund the contract: totalPoints (3) * 100 tokens.
    await reward.mint(await quest.getAddress(), 3n * tokensPerPoint);
    await quest.connect(admin).openConversion(tokensPerPoint);

    expect(await quest.claimable(alice.address)).to.equal(2n * tokensPerPoint);
    await quest.connect(alice).claim();
    expect(await reward.balanceOf(alice.address)).to.equal(2n * tokensPerPoint);

    await expect(quest.connect(alice).claim()).to.be.revertedWithCustomError(quest, "NothingToClaim");

    await quest.connect(bob).claim();
    expect(await reward.balanceOf(bob.address)).to.equal(tokensPerPoint);
  });

  it("rejects opening conversion when underfunded", async () => {
    const { quest, operator, admin, alice } = await deploy();
    await quest.connect(operator).awardAction(alice.address, X_POST);
    await expect(
      quest.connect(admin).openConversion(ethers.parseEther("100"))
    ).to.be.revertedWith("underfunded");
  });
});
