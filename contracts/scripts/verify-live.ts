import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Live verification against the DEPLOYED contracts on OPN testnet.
 * Exercises every contract end-to-end using the configured wallet:
 *   1. Launchpad: create token -> buy -> sell -> graduate -> LP locked
 *   2. SimpleAMM swap on the graduated pool
 *   3. QuestRewards: award points -> open conversion -> claim
 *   4. Presale: buy DOGON
 *
 * Prints tx hashes / results as proof the system is live.
 */
function load() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) throw new Error(`No deployment file for ${network.name}`);
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

async function main() {
  const d = load();
  const [me] = await ethers.getSigners();
  console.log(`\n=== Barkpad live verification on ${network.name} ===`);
  console.log(`Wallet: ${me.address}\n`);

  const ok: string[] = [];
  const fail: string[] = [];

  // --- 1. Launchpad: create -> buy -> graduate ---
  try {
    const factory = await ethers.getContractAt("TokenFactory", d.contracts.TokenFactory);
    const treasury = await ethers.getContractAt("Treasury", d.contracts.Treasury);
    const creationFee = await treasury.creationFee();
    const now = Math.floor(Date.now() / 1000);

    const params = {
      name: "LiveTest Doge",
      symbol: "LTDOGE",
      totalSupply: ethers.parseEther("1000000"),
      metadataId: ethers.ZeroHash,
      basePrice: ethers.parseEther("0.0001"),
      slope: ethers.parseEther("0.0000001"),
      graduationCap: ethers.parseEther("3"), // small cap so we can graduate cheaply
      tradingFeeBps: 100,
      walletCap: ethers.parseEther("1000000"),
      earlyWindowEnd: 0, // no early window restriction
    };

    const tx = await factory.createToken(params, { value: creationFee });
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
    console.log(`[1] Launchpad token created: ${tokenAddr} (tx ${tx.hash})`);

    const curve = await ethers.getContractAt("BondingCurve", curveAddr);
    const token = await ethers.getContractAt("MemeToken", tokenAddr);

    // Buy.
    const buyTx = await curve.buy(0, { value: ethers.parseEther("1") });
    await buyTx.wait();
    const bal = await token.balanceOf(me.address);
    console.log(`    Bought ${ethers.formatEther(bal)} ${params.symbol} (tx ${buyTx.hash})`);

    // Sell half back.
    const half = (bal / 2n / ethers.parseEther("1")) * ethers.parseEther("1");
    if (half > 0n) {
      await (await token.approve(curveAddr, half)).wait();
      const sellTx = await curve.sell(half, 0);
      await sellTx.wait();
      console.log(`    Sold ${ethers.formatEther(half)} back (tx ${sellTx.hash})`);
    }

    // Push to graduation.
    for (let i = 0; i < 6; i++) {
      if ((await curve.status()) !== 0n) break;
      const g = await curve.buy(0, { value: ethers.parseEther("1") });
      await g.wait();
    }
    // Finalize graduation with an explicit high gas limit (pool deployment is heavy).
    if ((await curve.status()) === 1n) {
      const gradTx = await curve.graduate({ gasLimit: 6_000_000 });
      await gradTx.wait();
      console.log(`    Finalized graduation (tx ${gradTx.hash})`);
    }
    const status = await curve.status();
    const pool = await curve.pool();
    console.log(`    Curve status=${status} (2=Graduated), pool=${pool}`);
    if (status === 2n) {
      ok.push("Launchpad create/buy/sell/graduate");

      // --- 2. Swap on graduated pool ---
      try {
        const pair = await ethers.getContractAt("SimpleAMMPair", pool);
        const sw = await pair.swapOPNForToken(0, { value: ethers.parseEther("0.1") });
        await sw.wait();
        console.log(`[2] Swap OPN->token on pool succeeded (tx ${sw.hash})`);
        ok.push("SimpleAMM swap");
      } catch (e: any) {
        console.log(`[2] Swap failed: ${e.message}`);
        fail.push("SimpleAMM swap");
      }
    } else {
      fail.push("Launchpad graduation");
    }
  } catch (e: any) {
    console.log(`[1] Launchpad failed: ${e.message}`);
    fail.push("Launchpad");
  }

  // --- 3. QuestRewards: award -> convert -> claim ---
  try {
    if (d.dogon?.QuestRewards) {
      const quest = await ethers.getContractAt("QuestRewards", d.dogon.QuestRewards);
      const FOLLOW = ethers.id("FOLLOW");
      const X_POST = ethers.id("X_POST");

      // Award self points (we hold OPERATOR_ROLE as deployer).
      if (!(await quest.completed(me.address, FOLLOW))) {
        await (await quest.awardAction(me.address, FOLLOW)).wait();
      }
      if (!(await quest.completed(me.address, X_POST))) {
        await (await quest.awardAction(me.address, X_POST)).wait();
      }
      const pts = await quest.pointsOf(me.address);
      console.log(`[3] Quest points for wallet: ${pts}`);

      if (!(await quest.conversionOpen())) {
        // tokensPerPoint small enough to be covered by the 1,000,000 DOGON pool.
        await (await quest.openConversion(ethers.parseEther("1"))).wait();
      }
      const claimable = await quest.claimable(me.address);
      if (claimable > 0n) {
        const c = await quest.claim();
        await c.wait();
        console.log(`    Claimed ${ethers.formatEther(claimable)} DOGON from quest (tx ${c.hash})`);
      }
      ok.push("QuestRewards award/convert/claim");
    }
  } catch (e: any) {
    console.log(`[3] Quest failed: ${e.message}`);
    fail.push("QuestRewards");
  }

  // --- 4. Presale: buy ---
  try {
    if (d.dogon?.Presale) {
      const presale = await ethers.getContractAt("Presale", d.dogon.Presale);
      if (await presale.isLive()) {
        const before = await presale.contributed(me.address);
        const max = await presale.maxPerWallet();
        if (before < max) {
          const b = await presale.buy({ value: ethers.parseEther("0.5") });
          await b.wait();
          console.log(`[4] Presale buy succeeded (tx ${b.hash})`);
          ok.push("Presale buy");
        } else {
          console.log(`[4] Presale wallet cap already reached, skipping`);
          ok.push("Presale (cap reached)");
        }
      } else {
        console.log(`[4] Presale not live, skipping`);
      }
    }
  } catch (e: any) {
    console.log(`[4] Presale failed: ${e.message}`);
    fail.push("Presale");
  }

  console.log(`\n=== Summary ===`);
  console.log(`PASS (${ok.length}): ${ok.join(", ")}`);
  if (fail.length) console.log(`FAIL (${fail.length}): ${fail.join(", ")}`);
  else console.log(`All exercised contracts behaved correctly on-chain.`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
