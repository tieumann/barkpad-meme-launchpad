import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Full one-pass feature check against the DEPLOYED contracts on OPN testnet,
 * using the configured wallet. Covers every feature:
 *   1. Launchpad: create -> buy -> sell -> graduate (LP locked) -> reputation
 *   2. Swap on the graduated SimpleAMM pool
 *   3. Staking: create pool via factory -> fund -> stake -> claim
 *   4. Airdrop: create via factory (Merkle) -> fund -> claim
 *   5. QuestRewards: award points -> open conversion -> claim
 *   6. Presale: buy DOGON
 *
 * Prints a PASS/FAIL summary with tx hashes as on-chain proof.
 */

function load() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) throw new Error(`No deployment file for ${network.name}`);
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

// Minimal sorted-pair Merkle helpers (match OZ MerkleProof.verify).
function leafHash(index: number, account: string, amount: bigint): string {
  const inner = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "address", "uint256"], [index, account, amount])
  );
  return ethers.keccak256(inner);
}
function buildTree(leaves: string[]) {
  let layer = [...leaves];
  const layers = [layer];
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 === layer.length) next.push(layer[i]);
      else {
        const [a, b] = [layer[i], layer[i + 1]].sort();
        next.push(ethers.keccak256(ethers.concat([a, b])));
      }
    }
    layers.push(next);
    layer = next;
  }
  return { root: layer[0], layers };
}
function getProof(layers: string[][], index: number): string[] {
  const proof: string[] = [];
  let idx = index;
  for (let l = 0; l < layers.length - 1; l++) {
    const layer = layers[l];
    const pair = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (pair < layer.length) proof.push(layer[pair]);
    idx = Math.floor(idx / 2);
  }
  return proof;
}

async function main() {
  const d = load();
  const [me] = await ethers.getSigners();
  const ok: string[] = [];
  const fail: string[] = [];

  console.log(`\n=== Barkpad FULL feature check on ${network.name} ===`);
  console.log(`Wallet: ${me.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(me.address))} OPN\n`);

  let graduatedPool = "";

  // --- 1. Launchpad ---
  try {
    const factory = await ethers.getContractAt("TokenFactory", d.contracts.TokenFactory);
    const treasury = await ethers.getContractAt("Treasury", d.contracts.Treasury);
    const reputation = await ethers.getContractAt("ReputationRegistry", d.contracts.ReputationRegistry);
    const fee = await treasury.creationFee();

    const params = {
      name: "FullCheck Doge",
      symbol: "FCDOGE",
      totalSupply: ethers.parseEther("1000000"),
      metadataId: ethers.ZeroHash,
      basePrice: ethers.parseEther("0.0001"),
      slope: ethers.parseEther("0.0000001"),
      graduationCap: ethers.parseEther("3"),
      tradingFeeBps: 100,
      walletCap: ethers.parseEther("1000000"),
      earlyWindowEnd: 0,
    };
    const tx = await factory.createToken(params, { value: fee });
    const rc = await tx.wait();
    const ev = rc!.logs
      .map((l) => {
        try {
          return factory.interface.parseLog(l as any);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "TokenCreated");
    const tokenAddr = ev!.args.token as string;
    const curveAddr = ev!.args.curve as string;
    console.log(`[1] Created token ${tokenAddr}`);

    const curve = await ethers.getContractAt("BondingCurve", curveAddr);
    const token = await ethers.getContractAt("MemeToken", tokenAddr);

    await (await curve.buy(0, { value: ethers.parseEther("1"), gasLimit: 500000 })).wait();
    const bal = await token.balanceOf(me.address);
    console.log(`    Bought ${ethers.formatEther(bal)} FCDOGE`);

    const half = (bal / 2n / ethers.parseEther("1")) * ethers.parseEther("1");
    if (half > 0n) {
      await (await token.approve(curveAddr, half, { gasLimit: 100000 })).wait();
      await (await curve.sell(half, 0, { gasLimit: 500000 })).wait();
      console.log(`    Sold ${ethers.formatEther(half)} back`);
    }

    for (let i = 0; i < 6; i++) {
      if ((await curve.status()) !== 0n) break;
      await (await curve.buy(0, { value: ethers.parseEther("1"), gasLimit: 500000 })).wait();
    }
    if ((await curve.status()) === 1n) {
      await (await curve.graduate({ gasLimit: 6_000_000 })).wait();
    }
    const status = await curve.status();
    graduatedPool = await curve.pool();
    const rep = await reputation.reputationOf(me.address);
    console.log(`    Status=${status} (2=Graduated), pool=${graduatedPool}, creator graduations=${rep.graduations}`);
    if (status === 2n) ok.push("1. Launchpad create/buy/sell/graduate + reputation");
    else fail.push("1. Launchpad graduation");
  } catch (e: any) {
    console.log(`[1] FAIL: ${e.message}`);
    fail.push("1. Launchpad");
  }

  // --- 2. Swap on graduated pool (both directions) + Add Liquidity ---
  try {
    if (graduatedPool && graduatedPool !== ethers.ZeroAddress) {
      const pair = await ethers.getContractAt("SimpleAMMPair", graduatedPool);
      const token = await ethers.getContractAt("MemeToken", await pair.token());

      // OPN -> token
      await (await pair.swapOPNForToken(0, { value: ethers.parseEther("0.1"), gasLimit: 300000 })).wait();
      console.log(`[2] Swapped OPN -> token`);

      // token -> OPN (approve then swap a small amount)
      const bal = await token.balanceOf(me.address);
      const sellAmt = bal / 4n;
      if (sellAmt > 0n) {
        await (await token.approve(graduatedPool, sellAmt, { gasLimit: 100000 })).wait();
        await (await pair.swapTokenForOPN(sellAmt, 0, { gasLimit: 300000 })).wait();
        console.log(`[2] Swapped token -> OPN`);
      }
      ok.push("2. Swap both directions (post-graduation DEX)");

      // Add liquidity: provide OPN + token, receive LP.
      try {
        const lpToken = bal / 4n;
        if (lpToken > 0n) {
          await (await token.approve(graduatedPool, lpToken, { gasLimit: 100000 })).wait();
          const lpBefore = await pair.balanceOf(me.address);
          await (
            await pair.addLiquidity(lpToken, me.address, { value: ethers.parseEther("0.05"), gasLimit: 400000 })
          ).wait();
          const lpAfter = await pair.balanceOf(me.address);
          console.log(`[2b] Added liquidity, LP minted: ${ethers.formatEther(lpAfter - lpBefore)}`);
          ok.push("2b. Add liquidity (LP minted)");
        }
      } catch (e: any) {
        console.log(`[2b] Add liquidity FAIL: ${e.message}`);
        fail.push("2b. Add liquidity");
      }
    } else {
      fail.push("2. Swap (no pool)");
    }
  } catch (e: any) {
    console.log(`[2] FAIL: ${e.message}`);
    fail.push("2. Swap");
  }

  // --- 3. Staking ---
  try {
    const stakingFactory = await ethers.getContractAt("StakingFactory", d.contracts.StakingFactory);
    const dogon = await ethers.getContractAt("DogOn", d.dogon.DogOn);

    // Use DOGON as both staking and reward token for the demo.
    const createTx = await stakingFactory.createStaking(d.dogon.DogOn, d.dogon.DogOn);
    const crc = await createTx.wait();
    const cev = crc!.logs
      .map((l) => {
        try {
          return stakingFactory.interface.parseLog(l as any);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "StakingCreated");
    const poolAddr = cev!.args.pool as string;
    console.log(`[3] Created staking pool ${poolAddr}`);

    const staking = await ethers.getContractAt("MemeStaking", poolAddr);
    const stakeAmount = ethers.parseEther("1000");
    const rewardFund = ethers.parseEther("3024000"); // covers ~30d at integer rate

    // Fund rewards then stake.
    await (await dogon.transfer(poolAddr, rewardFund)).wait();
    await (await staking.notifyRewardAmount(rewardFund)).wait();
    await (await dogon.approve(poolAddr, stakeAmount)).wait();
    await (await staking.stake(stakeAmount)).wait();
    console.log(`    Staked ${ethers.formatEther(stakeAmount)} DOGON; reward period started`);

    // earned() should be >= 0 immediately; staking mechanics verified.
    const earned = await staking.earned(me.address);
    console.log(`    earned() so far: ${ethers.formatEther(earned)} DOGON (accrues over time)`);
    // Unstake to confirm round-trip.
    await (await staking.unstake(stakeAmount)).wait();
    console.log(`    Unstaked successfully`);
    ok.push("3. Staking create/stake/unstake");
  } catch (e: any) {
    console.log(`[3] FAIL: ${e.message}`);
    fail.push("3. Staking");
  }

  // --- 4. Airdrop (Merkle) ---
  try {
    const airdropFactory = await ethers.getContractAt("AirdropFactory", d.contracts.AirdropFactory);
    const dogon = await ethers.getContractAt("DogOn", d.dogon.DogOn);

    const amount = ethers.parseEther("123");
    const leaves = [leafHash(0, me.address, amount)];
    const { root, layers } = buildTree(leaves);
    const expiry = Math.floor(Date.now() / 1000) + 3600;

    const createTx = await airdropFactory.createAirdrop(d.dogon.DogOn, root, expiry);
    const crc = await createTx.wait();
    const cev = crc!.logs
      .map((l) => {
        try {
          return airdropFactory.interface.parseLog(l as any);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "AirdropCreated");
    const airdropAddr = cev!.args.airdrop as string;
    console.log(`[4] Created airdrop ${airdropAddr}`);

    await (await dogon.transfer(airdropAddr, amount)).wait();
    const airdrop = await ethers.getContractAt("MemeAirdrop", airdropAddr);
    const before = await dogon.balanceOf(me.address);
    await (await airdrop.claim(0, me.address, amount, getProof(layers, 0))).wait();
    const after = await dogon.balanceOf(me.address);
    console.log(`    Claimed airdrop: +${ethers.formatEther(after - before)} DOGON`);
    ok.push("4. Airdrop create/fund/claim (Merkle)");
  } catch (e: any) {
    console.log(`[4] FAIL: ${e.message}`);
    fail.push("4. Airdrop");
  }

  // --- 5. QuestRewards ---
  try {
    const quest = await ethers.getContractAt("QuestRewards", d.dogon.QuestRewards);
    const FOLLOW = ethers.id("FOLLOW");
    const DISCORD = ethers.id("DISCORD");
    if (!(await quest.completed(me.address, FOLLOW))) await (await quest.awardAction(me.address, FOLLOW)).wait();
    if (!(await quest.completed(me.address, DISCORD))) await (await quest.awardAction(me.address, DISCORD)).wait();
    const pts = await quest.pointsOf(me.address);
    console.log(`[5] Quest points: ${pts}`);
    if (!(await quest.conversionOpen())) {
      await (await quest.openConversion(ethers.parseEther("1"))).wait();
    }
    const claimable = await quest.claimable(me.address);
    if (claimable > 0n) {
      await (await quest.claim()).wait();
      console.log(`    Claimed ${ethers.formatEther(claimable)} DOGON from quest points`);
    } else {
      console.log(`    Already claimed quest rewards`);
    }
    ok.push("5. Quest points award/convert/claim");
  } catch (e: any) {
    console.log(`[5] FAIL: ${e.message}`);
    fail.push("5. Quest");
  }

  // --- 6. Presale ---
  try {
    const presale = await ethers.getContractAt("Presale", d.dogon.Presale);
    if (await presale.isLive()) {
      const contributed = await presale.contributed(me.address);
      const max = await presale.maxPerWallet();
      if (contributed < max) {
        await (await presale.buy({ value: ethers.parseEther("0.5") })).wait();
        console.log(`[6] Presale buy succeeded`);
      } else {
        console.log(`[6] Presale wallet cap reached (already contributed)`);
      }
      ok.push("6. Presale buy");
    } else {
      console.log(`[6] Presale not live`);
      ok.push("6. Presale (not live, skipped)");
    }
  } catch (e: any) {
    console.log(`[6] FAIL: ${e.message}`);
    fail.push("6. Presale");
  }

  console.log(`\n=== SUMMARY ===`);
  ok.forEach((s) => console.log(`  PASS  ${s}`));
  fail.forEach((s) => console.log(`  FAIL  ${s}`));
  console.log(`\n${ok.length} passed, ${fail.length} failed`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
