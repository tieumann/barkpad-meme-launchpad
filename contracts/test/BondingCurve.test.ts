import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  BondingCurve,
  MemeToken,
  Treasury,
  ReputationRegistry,
  LiquidityLocker,
  SimpleAMM,
} from "../typechain-types";

const ONE = ethers.parseEther("1");
const TOTAL_SUPPLY = ethers.parseEther("1000000"); // 1M whole tokens
const BASE_PRICE = ethers.parseEther("0.0001"); // OPN per whole token at n=0
const SLOPE = ethers.parseEther("0.0000001");
const GRAD_CAP = ethers.parseEther("50"); // graduate when reserve >= 50 OPN
const FEE_BPS = 100; // 1%
const WALLET_CAP = 10000n; // whole tokens in early window
const LOCK_DURATION = 7 * 24 * 60 * 60;

describe("BondingCurve", () => {
  async function deployFixture() {
    const [admin, creator, alice, bob] = await ethers.getSigners();

    const Treasury_ = await ethers.getContractFactory("Treasury");
    const treasury = (await Treasury_.deploy(admin.address, FEE_BPS, 0)) as unknown as Treasury;
    await treasury.waitForDeployment();

    const Rep = await ethers.getContractFactory("ReputationRegistry");
    const reputation = (await Rep.deploy(admin.address)) as unknown as ReputationRegistry;
    await reputation.waitForDeployment();

    const Locker = await ethers.getContractFactory("LiquidityLocker");
    const locker = (await Locker.deploy(admin.address)) as unknown as LiquidityLocker;
    await locker.waitForDeployment();

    const AMM = await ethers.getContractFactory("SimpleAMM");
    const amm = (await AMM.deploy()) as unknown as SimpleAMM;
    await amm.waitForDeployment();

    const Token = await ethers.getContractFactory("MemeToken");
    const token = (await Token.deploy()) as unknown as MemeToken;
    await token.waitForDeployment();

    const Curve = await ethers.getContractFactory("BondingCurve");
    const curve = (await Curve.deploy()) as unknown as BondingCurve;
    await curve.waitForDeployment();

    // Wire roles so the curve can write graduation + lock.
    await reputation.grantRole(await reputation.CURVE_ROLE(), await curve.getAddress());
    await locker.grantRole(await locker.LOCKER_ROLE(), await curve.getAddress());

    // Mint full supply to the curve.
    await token.initialize(
      "Doge",
      "DOGE",
      TOTAL_SUPPLY,
      await curve.getAddress(),
      creator.address,
      ethers.ZeroHash
    );

    const earlyWindowEnd = (await time.latest()) + 3600;

    await curve.initialize(
      await token.getAddress(),
      creator.address,
      await treasury.getAddress(),
      await reputation.getAddress(),
      await locker.getAddress(),
      await amm.getAddress(),
      TOTAL_SUPPLY,
      BASE_PRICE,
      SLOPE,
      GRAD_CAP,
      FEE_BPS,
      earlyWindowEnd,
      WALLET_CAP,
      LOCK_DURATION
    );

    return { admin, creator, alice, bob, treasury, reputation, locker, amm, token, curve };
  }

  it("sells tokens to a buyer and accrues reserve + fee", async () => {
    const { curve, token, treasury, alice } = await deployFixture();
    const buyAmount = ethers.parseEther("1");

    const treasuryBefore = await ethers.provider.getBalance(await treasury.getAddress());
    await curve.connect(alice).buy(0, { value: buyAmount });

    expect(await token.balanceOf(alice.address)).to.be.gt(0);
    expect(await curve.reserve()).to.be.gt(0);
    const treasuryAfter = await ethers.provider.getBalance(await treasury.getAddress());
    expect(treasuryAfter - treasuryBefore).to.equal((buyAmount * BigInt(FEE_BPS)) / 10000n);
  });

  it("maintains supply conservation (Property 2)", async () => {
    const { curve, token, alice } = await deployFixture();
    await curve.connect(alice).buy(0, { value: ethers.parseEther("2") });

    const curveBal = await token.balanceOf(await curve.getAddress());
    const circulating = TOTAL_SUPPLY - curveBal;
    const soldWhole = await curve.supplySold();
    expect(circulating).to.equal(soldWhole * ONE);
    expect(curveBal + circulating).to.equal(TOTAL_SUPPLY);
  });

  it("reverts on slippage when minTokensOut not met (Property 11)", async () => {
    const { curve, alice } = await deployFixture();
    await expect(
      curve.connect(alice).buy(ethers.parseEther("999999999"), { value: ethers.parseEther("1") })
    ).to.be.revertedWithCustomError(curve, "SlippageExceeded");
  });

  it("enforces per-wallet cap during early window (Property 10)", async () => {
    const { curve, alice } = await deployFixture();
    // A large buy that exceeds WALLET_CAP whole tokens should revert.
    await expect(
      curve.connect(alice).buy(0, { value: ethers.parseEther("40") })
    ).to.be.revertedWithCustomError(curve, "WalletCapExceeded");
  });

  it("allows buy then sell with reserve solvency (Property 1)", async () => {
    const { curve, token, alice } = await deployFixture();
    await curve.connect(alice).buy(0, { value: ethers.parseEther("1") });

    const balance = await token.balanceOf(alice.address);
    await token.connect(alice).approve(await curve.getAddress(), balance);

    const before = await ethers.provider.getBalance(alice.address);
    const tx = await curve.connect(alice).sell(balance, 0);
    const receipt = await tx.wait();
    const gas = receipt!.gasUsed * receipt!.gasPrice;
    const after = await ethers.provider.getBalance(alice.address);

    // Seller receives OPN back (net of gas + fees).
    expect(after + gas).to.be.gt(before);
    // Curve never pays out more than its reserve.
    expect(await curve.reserve()).to.be.gte(0);
    expect(await curve.supplySold()).to.equal(0);
  });

  it("graduates when reserve crosses the cap, locks LP, bumps reputation (Properties 3, 6, 7)", async () => {
    const { curve, token, locker, reputation, creator, alice, bob } = await deployFixture();

    // Move past the early window so the wallet cap doesn't block large buys.
    await time.increase(3601);

    // Buy enough to push reserve over GRAD_CAP (50 OPN). Do it in chunks.
    for (let i = 0; i < 6; i++) {
      const status = await curve.status();
      if (status !== 0n) break; // stop once not Trading
      await curve.connect(i % 2 === 0 ? alice : bob).buy(0, { value: ethers.parseEther("10") });
    }

    // Curve flips to Graduating; finalize via the dedicated call.
    expect(await curve.status()).to.equal(1n);
    await curve.graduate();

    expect(await curve.status()).to.equal(2n); // Graduated
    expect(await curve.pool()).to.not.equal(ethers.ZeroAddress);

    // LP locked to creator.
    const lock = await locker.getLock(await curve.lockId());
    expect(lock.beneficiary).to.equal(creator.address);
    expect(lock.amount).to.be.gt(0);

    // Reputation bumped.
    const rep = await reputation.reputationOf(creator.address);
    expect(rep.graduations).to.equal(1);

    // Reserve consumed into liquidity.
    expect(await curve.reserve()).to.equal(0);
  });

  it("blocks trading after graduation", async () => {
    const { curve, alice, bob } = await deployFixture();
    await time.increase(3601);
    for (let i = 0; i < 6; i++) {
      if ((await curve.status()) !== 0n) break;
      await curve.connect(i % 2 === 0 ? alice : bob).buy(0, { value: ethers.parseEther("10") });
    }
    expect(await curve.status()).to.equal(1n);
    await curve.graduate();
    expect(await curve.status()).to.equal(2n);
    await expect(curve.connect(alice).buy(0, { value: ONE })).to.be.revertedWithCustomError(
      curve,
      "NotTrading"
    );
  });
});
