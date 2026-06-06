import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploys the full Barkpad stack and wires roles.
 * Outputs deployments/<network>.json with all addresses.
 *
 * Order: Treasury, ReputationRegistry, LiquidityLocker, IdentityGate, SimpleAMM,
 * MemeToken impl, BondingCurve impl, TokenFactory; then role wiring.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const admin = deployer.address;
  console.log(`Deploying Barkpad to ${network.name} with ${admin}`);

  // --- Config (tune for production) ---
  const TRADING_FEE_BPS = 100; // 1%
  const CREATION_FEE = ethers.parseEther("0.01");
  const VERIFIER = process.env.IDENTITY_VERIFIER || admin; // signer for attestations
  const IDENTITY_POLICY = 1; // 1 = ALLOW_UNVERIFIED for launch; switch to 0 to enforce
  const IDENTITY_GATING_ENABLED = false;

  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(admin, TRADING_FEE_BPS, CREATION_FEE);
  await treasury.waitForDeployment();
  console.log(`  Treasury:            ${await treasury.getAddress()}`);

  const Rep = await ethers.getContractFactory("ReputationRegistry");
  const reputation = await Rep.deploy(admin);
  await reputation.waitForDeployment();
  console.log(`  ReputationRegistry:  ${await reputation.getAddress()}`);

  const Locker = await ethers.getContractFactory("LiquidityLocker");
  const locker = await Locker.deploy(admin);
  await locker.waitForDeployment();
  console.log(`  LiquidityLocker:     ${await locker.getAddress()}`);

  const Gate = await ethers.getContractFactory("IdentityGate");
  const gate = await Gate.deploy(admin, VERIFIER, IDENTITY_POLICY);
  await gate.waitForDeployment();
  console.log(`  IdentityGate:        ${await gate.getAddress()}`);

  const AMM = await ethers.getContractFactory("SimpleAMM");
  const amm = await AMM.deploy();
  await amm.waitForDeployment();
  console.log(`  SimpleAMM:           ${await amm.getAddress()}`);

  const memeImpl = await (await ethers.getContractFactory("MemeToken")).deploy();
  await memeImpl.waitForDeployment();
  console.log(`  MemeTokenImpl:       ${await memeImpl.getAddress()}`);

  const curveImpl = await (await ethers.getContractFactory("BondingCurve")).deploy();
  await curveImpl.waitForDeployment();
  console.log(`  BondingCurveImpl:    ${await curveImpl.getAddress()}`);

  const Factory = await ethers.getContractFactory("TokenFactory");
  const factory = await Factory.deploy(
    admin,
    await memeImpl.getAddress(),
    await curveImpl.getAddress(),
    await treasury.getAddress(),
    await reputation.getAddress(),
    await locker.getAddress(),
    await gate.getAddress(),
    await amm.getAddress(),
    IDENTITY_GATING_ENABLED
  );
  await factory.waitForDeployment();
  console.log(`  TokenFactory:        ${await factory.getAddress()}`);

  // --- Role wiring: the factory must be able to grant curve roles + record launches ---
  await (await reputation.grantRole(await reputation.DEFAULT_ADMIN_ROLE(), await factory.getAddress())).wait();
  await (await reputation.grantRole(await reputation.FACTORY_ROLE(), await factory.getAddress())).wait();
  await (await locker.grantRole(await locker.DEFAULT_ADMIN_ROLE(), await factory.getAddress())).wait();

  // --- Staking + Airdrop factories (community features) ---
  const stakingFactory = await (await ethers.getContractFactory("StakingFactory")).deploy();
  await stakingFactory.waitForDeployment();

  const airdropFactory = await (await ethers.getContractFactory("AirdropFactory")).deploy();
  await airdropFactory.waitForDeployment();

  const dir = path.join(__dirname, "..", "deployments");
  const file = path.join(dir, `${network.name}.json`);
  // Merge with any existing file so sibling deployments (e.g. dogon) are preserved.
  let existing: any = {};
  if (fs.existsSync(file)) existing = JSON.parse(fs.readFileSync(file, "utf-8"));
  const out = { ...existing, ...{
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: admin,
    contracts: {
      Treasury: await treasury.getAddress(),
      ReputationRegistry: await reputation.getAddress(),
      LiquidityLocker: await locker.getAddress(),
      IdentityGate: await gate.getAddress(),
      SimpleAMM: await amm.getAddress(),
      MemeTokenImpl: await memeImpl.getAddress(),
      BondingCurveImpl: await curveImpl.getAddress(),
      TokenFactory: await factory.getAddress(),
      StakingFactory: await stakingFactory.getAddress(),
      AirdropFactory: await airdropFactory.getAddress(),
    },
    config: {
      tradingFeeBps: TRADING_FEE_BPS,
      creationFee: CREATION_FEE.toString(),
      identityGatingEnabled: IDENTITY_GATING_ENABLED,
    },
  }};

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2));

  console.log("Deployment complete:");
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
