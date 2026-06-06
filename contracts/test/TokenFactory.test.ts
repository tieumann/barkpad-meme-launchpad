import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  TokenFactory,
  Treasury,
  ReputationRegistry,
  LiquidityLocker,
  IdentityGate,
  SimpleAMM,
} from "../typechain-types";

const TOTAL_SUPPLY = ethers.parseEther("1000000");
const BASE_PRICE = ethers.parseEther("0.0001");
const SLOPE = ethers.parseEther("0.0000001");
const GRAD_CAP = ethers.parseEther("50");
const FEE_BPS = 100;
const CREATION_FEE = ethers.parseEther("1");
const WALLET_CAP = 10000n;

describe("TokenFactory (integration)", () => {
  async function deployFixture(identityGating = false) {
    const [admin, creator, alice] = await ethers.getSigners();
    const verifier = ethers.Wallet.createRandom();

    const Treasury_ = await ethers.getContractFactory("Treasury");
    const treasury = (await Treasury_.deploy(admin.address, FEE_BPS, CREATION_FEE)) as unknown as Treasury;

    const Rep = await ethers.getContractFactory("ReputationRegistry");
    const reputation = (await Rep.deploy(admin.address)) as unknown as ReputationRegistry;

    const Locker = await ethers.getContractFactory("LiquidityLocker");
    const locker = (await Locker.deploy(admin.address)) as unknown as LiquidityLocker;

    const Gate = await ethers.getContractFactory("IdentityGate");
    const gate = (await Gate.deploy(admin.address, verifier.address, 0)) as unknown as IdentityGate;

    const AMM = await ethers.getContractFactory("SimpleAMM");
    const amm = (await AMM.deploy()) as unknown as SimpleAMM;

    const MemeImpl = await (await ethers.getContractFactory("MemeToken")).deploy();
    const CurveImpl = await (await ethers.getContractFactory("BondingCurve")).deploy();

    const Factory = await ethers.getContractFactory("TokenFactory");
    const factory = (await Factory.deploy(
      admin.address,
      await MemeImpl.getAddress(),
      await CurveImpl.getAddress(),
      await treasury.getAddress(),
      await reputation.getAddress(),
      await locker.getAddress(),
      await gate.getAddress(),
      await amm.getAddress(),
      identityGating
    )) as unknown as TokenFactory;

    // Grant the factory the admin + writer roles it needs.
    await reputation.grantRole(await reputation.DEFAULT_ADMIN_ROLE(), await factory.getAddress());
    await reputation.grantRole(await reputation.FACTORY_ROLE(), await factory.getAddress());
    await locker.grantRole(await locker.DEFAULT_ADMIN_ROLE(), await factory.getAddress());

    return { admin, creator, alice, factory, treasury, reputation, locker, gate, amm, verifier };
  }

  function params(overrides: Partial<any> = {}) {
    return {
      name: "Doge Supreme",
      symbol: "DOGES",
      totalSupply: TOTAL_SUPPLY,
      metadataId: ethers.ZeroHash,
      basePrice: BASE_PRICE,
      slope: SLOPE,
      graduationCap: GRAD_CAP,
      tradingFeeBps: FEE_BPS,
      walletCap: WALLET_CAP,
      earlyWindowEnd: 0,
      ...overrides,
    };
  }

  it("creates a token end-to-end and records it", async () => {
    const { factory, creator, treasury, reputation } = await deployFixture();
    const earlyWindowEnd = (await time.latest()) + 3600;

    const tx = await factory.connect(creator).createToken(params({ earlyWindowEnd }), {
      value: CREATION_FEE,
    });
    const receipt = await tx.wait();
    const ev = receipt!.logs
      .map((l) => {
        try {
          return factory.interface.parseLog(l as any);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "TokenCreated");
    expect(ev).to.not.equal(undefined);

    const tokenAddr = ev!.args.token as string;
    const record = await factory.records(tokenAddr);
    expect(record.creator).to.equal(creator.address);
    expect(record.identityVerified).to.equal(false);
    expect(await factory.tokenCount()).to.equal(1);

    // Creation fee routed to treasury.
    expect(await ethers.provider.getBalance(await treasury.getAddress())).to.equal(CREATION_FEE);

    // Launch recorded in reputation.
    const rep = await reputation.reputationOf(creator.address);
    expect(rep.launches).to.equal(1);

    // Token holds the full supply via its curve.
    const meme = await ethers.getContractAt("MemeToken", tokenAddr);
    expect(await meme.balanceOf(record.curve)).to.equal(TOTAL_SUPPLY);
    expect(await meme.mintingDisabled()).to.equal(true);
  });

  it("rejects invalid params", async () => {
    const { factory, creator } = await deployFixture();
    await expect(
      factory.connect(creator).createToken(params({ name: "" }), { value: CREATION_FEE })
    ).to.be.revertedWithCustomError(factory, "InvalidName");
    await expect(
      factory.connect(creator).createToken(params({ symbol: "TOOOOOLONG12" }), { value: CREATION_FEE })
    ).to.be.revertedWithCustomError(factory, "InvalidSymbol");
    await expect(
      factory.connect(creator).createToken(params({ totalSupply: 1n }), { value: CREATION_FEE })
    ).to.be.revertedWithCustomError(factory, "InvalidSupply");
  });

  it("reverts when the creation fee is not paid", async () => {
    const { factory, creator } = await deployFixture();
    await expect(
      factory.connect(creator).createToken(params(), { value: 0 })
    ).to.be.revertedWithCustomError(factory, "InsufficientFee");
  });

  it("supports a full create -> trade -> graduate flow", async () => {
    const { factory, creator, alice, reputation } = await deployFixture();
    await factory.connect(creator).createToken(params({ earlyWindowEnd: 0 }), { value: CREATION_FEE });
    const tokenAddr = (await factory.allTokens(0)) as string;
    const record = await factory.records(tokenAddr);
    const curve = await ethers.getContractAt("BondingCurve", record.curve);

    for (let i = 0; i < 6; i++) {
      if ((await curve.status()) !== 0n) break;
      await curve.connect(alice).buy(0, { value: ethers.parseEther("10") });
    }
    await curve.graduate();

    expect(await curve.status()).to.equal(2n); // Graduated
    const rep = await reputation.reputationOf(creator.address);
    expect(rep.graduations).to.equal(1);
  });

  it("blocks launch under identity gating when unverified, allows when verified", async () => {
    const { factory, gate, creator, admin, verifier } = await deployFixture(true);
    // Switch gate to BLOCK policy (constructor used ALLOW=... actually 0 = BLOCK).
    // Gate was deployed with policy 0 (BLOCK_UNVERIFIED).
    await expect(
      factory.connect(creator).createToken(params(), { value: CREATION_FEE })
    ).to.be.revertedWithCustomError(gate, "NotVerified");

    // Verify the creator via a signed attestation.
    const expiry = (await time.latest()) + 3600;
    const hash = await gate.attestationHash(creator.address, expiry);
    const sig = await verifier.signMessage(ethers.getBytes(hash));
    await gate.submitAttestation(creator.address, expiry, sig);

    await factory.connect(creator).createToken(params(), { value: CREATION_FEE });
    const tokenAddr = (await factory.allTokens(0)) as string;
    const record = await factory.records(tokenAddr);
    expect(record.identityVerified).to.equal(true);
  });
});
