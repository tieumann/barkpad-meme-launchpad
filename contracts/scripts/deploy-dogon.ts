import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploys the DogOn project token + its Presale + QuestRewards campaign,
 * then appends their addresses to deployments/<network>.json.
 *
 * Funds the presale and quest pool from the DOGON supply so the demo works
 * end-to-end.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const admin = deployer.address;
  console.log(`Deploying DogOn suite to ${network.name} with ${admin}`);

  // --- DogOn token (full supply minted to deployer as treasury) ---
  const DogOn = await ethers.getContractFactory("DogOn");
  const dogon = await DogOn.deploy(admin, admin);
  await dogon.waitForDeployment();
  console.log(`  DogOn (DOGON):   ${await dogon.getAddress()}`);

  const now = Math.floor(Date.now() / 1000);

  // --- Presale: 1000 DOGON per OPN, 1h sale, soft 1 / hard 10 OPN ---
  const RATE = ethers.parseEther("1000");
  const startTime = now - 10; // start immediately
  const endTime = now + 3 * 24 * 60 * 60; // 3 days
  const softCap = ethers.parseEther("1");
  const hardCap = ethers.parseEther("10");
  const maxPerWallet = ethers.parseEther("5");
  const claimUnlock = now + 3 * 24 * 60 * 60; // claim after sale ends

  const Presale = await ethers.getContractFactory("Presale");
  const presale = await Presale.deploy(
    await dogon.getAddress(),
    RATE,
    startTime,
    endTime,
    softCap,
    hardCap,
    maxPerWallet,
    claimUnlock,
    admin
  );
  await presale.waitForDeployment();
  console.log(`  Presale:         ${await presale.getAddress()}`);

  // Fund presale with tokens to cover hard cap.
  const presaleFund = (hardCap * RATE) / ethers.parseEther("1");
  await (await dogon.transfer(await presale.getAddress(), presaleFund)).wait();

  // --- QuestRewards campaign ---
  const Quest = await ethers.getContractFactory("QuestRewards");
  const quest = await Quest.deploy(await dogon.getAddress(), admin);
  await quest.waitForDeployment();
  console.log(`  QuestRewards:    ${await quest.getAddress()}`);

  // Configure standard social actions and weights.
  const ids = [
    ethers.id("FOLLOW"),
    ethers.id("DISCORD"),
    ethers.id("X_POST"),
    ethers.id("REFERRAL"),
  ];
  const weights = [1, 1, 2, 3];
  await (await quest.configureActions(ids, weights)).wait();

  // Fund quest pool with 1,000,000 DOGON for rewards.
  await (await dogon.transfer(await quest.getAddress(), ethers.parseEther("1000000"))).wait();

  // --- Persist ---
  const dir = path.join(__dirname, "..", "deployments");
  const file = path.join(dir, `${network.name}.json`);
  let existing: any = {};
  if (fs.existsSync(file)) existing = JSON.parse(fs.readFileSync(file, "utf-8"));

  existing.dogon = {
    DogOn: await dogon.getAddress(),
    Presale: await presale.getAddress(),
    QuestRewards: await quest.getAddress(),
    presaleConfig: {
      rate: RATE.toString(),
      softCap: softCap.toString(),
      hardCap: hardCap.toString(),
      maxPerWallet: maxPerWallet.toString(),
      endTime,
      claimUnlock,
    },
    questActions: { FOLLOW: 1, DISCORD: 1, X_POST: 2, REFERRAL: 3 },
  };

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(existing, null, 2));

  console.log("DogOn suite deployed and funded.");
  console.log(JSON.stringify(existing.dogon, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
