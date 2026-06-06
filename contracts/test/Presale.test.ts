import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Presale, DogOn } from "../typechain-types";

const RATE = ethers.parseEther("1000"); // 1000 DOGON per 1 OPN
const SOFT_CAP = ethers.parseEther("5");
const HARD_CAP = ethers.parseEther("20");
const MAX_WALLET = ethers.parseEther("10");

describe("Presale", () => {
  async function deploy(opts: { started?: boolean } = {}) {
    const [owner, treasury, alice, bob] = await ethers.getSigners();

    const DogOnF = await ethers.getContractFactory("DogOn");
    const dogon = (await DogOnF.deploy(treasury.address, owner.address)) as unknown as DogOn;
    await dogon.waitForDeployment();

    const now = await time.latest();
    const startTime = opts.started === false ? now + 1000 : now - 1;
    const endTime = now + 3600;
    const claimUnlock = now + 7200;

    const PresaleF = await ethers.getContractFactory("Presale");
    const presale = (await PresaleF.deploy(
      await dogon.getAddress(),
      RATE,
      startTime,
      endTime,
      SOFT_CAP,
      HARD_CAP,
      MAX_WALLET,
      claimUnlock,
      owner.address
    )) as unknown as Presale;
    await presale.waitForDeployment();

    // Fund presale with tokens to cover hard cap.
    const needed = (HARD_CAP * RATE) / ethers.parseEther("1");
    await dogon.connect(treasury).transfer(await presale.getAddress(), needed);

    return { owner, treasury, alice, bob, dogon, presale, endTime, claimUnlock };
  }

  it("lets a buyer contribute and allocates tokens at the fixed rate", async () => {
    const { presale, alice } = await deploy();
    await expect(presale.connect(alice).buy({ value: ethers.parseEther("2") }))
      .to.emit(presale, "Bought")
      .withArgs(alice.address, ethers.parseEther("2"), ethers.parseEther("2000"));
    expect(await presale.contributed(alice.address)).to.equal(ethers.parseEther("2"));
    expect(await presale.totalRaised()).to.equal(ethers.parseEther("2"));
  });

  it("enforces per-wallet cap", async () => {
    const { presale, alice } = await deploy();
    await expect(
      presale.connect(alice).buy({ value: ethers.parseEther("11") })
    ).to.be.revertedWithCustomError(presale, "WalletCapExceeded");
  });

  it("enforces hard cap", async () => {
    const { presale, alice, bob } = await deploy();
    await presale.connect(alice).buy({ value: ethers.parseEther("10") });
    await presale.connect(bob).buy({ value: ethers.parseEther("10") });
    const [, , , , carol] = await ethers.getSigners();
    await expect(
      presale.connect(carol).buy({ value: ethers.parseEther("1") })
    ).to.be.revertedWithCustomError(presale, "HardCapExceeded");
  });

  it("finalizes when soft cap met, then buyers claim after unlock", async () => {
    const { presale, dogon, alice, endTime, claimUnlock, owner } = await deploy();
    await presale.connect(alice).buy({ value: ethers.parseEther("6") });

    await time.increaseTo(endTime + 1);
    await presale.connect(owner).finalize();

    await expect(presale.connect(alice).claim()).to.be.revertedWithCustomError(
      presale,
      "TooEarlyToClaim"
    );

    await time.increaseTo(claimUnlock + 1);
    await presale.connect(alice).claim();
    expect(await dogon.balanceOf(alice.address)).to.equal(ethers.parseEther("6000"));

    await expect(presale.connect(alice).claim()).to.be.revertedWithCustomError(
      presale,
      "NothingToClaim"
    );
  });

  it("refunds buyers when soft cap is not met", async () => {
    const { presale, alice, endTime } = await deploy();
    await presale.connect(alice).buy({ value: ethers.parseEther("2") }); // below soft cap

    await time.increaseTo(endTime + 1);
    const before = await ethers.provider.getBalance(alice.address);
    const tx = await presale.connect(alice).refund();
    const receipt = await tx.wait();
    const gas = receipt!.gasUsed * receipt!.gasPrice;
    const after = await ethers.provider.getBalance(alice.address);
    expect(after + gas - before).to.equal(ethers.parseEther("2"));
  });

  it("lets owner withdraw proceeds after finalize", async () => {
    const { presale, alice, endTime, owner, treasury } = await deploy();
    await presale.connect(alice).buy({ value: ethers.parseEther("6") });
    await time.increaseTo(endTime + 1);
    await presale.connect(owner).finalize();

    const before = await ethers.provider.getBalance(treasury.address);
    await presale.connect(owner).withdrawProceeds(treasury.address);
    const after = await ethers.provider.getBalance(treasury.address);
    expect(after - before).to.equal(ethers.parseEther("6"));
  });
});
