import { ethers, network } from "hardhat";

/**
 * Retries graduation on a curve stuck in Graduating state, with a high explicit
 * gas limit (the inner DEX pair deployment is gas-heavy and the 63/64 rule can
 * starve it when gas is auto-estimated for a normal buy).
 *
 * Usage: set CURVE below to the stuck curve address.
 */
const CURVE = process.env.CURVE ?? "";
const TOKEN = process.env.TOKEN ?? "";
const FACTORY = process.env.FACTORY ?? "";

async function main() {
  let curveAddr = CURVE;
  if (!curveAddr && TOKEN && FACTORY) {
    const factory = await ethers.getContractAt("TokenFactory", FACTORY);
    const rec = await factory.records(TOKEN);
    curveAddr = rec.curve;
    console.log(`Resolved curve ${curveAddr} from token ${TOKEN}`);
  }
  if (!curveAddr) throw new Error("Set CURVE, or TOKEN + FACTORY env vars");
  const curve = await ethers.getContractAt("BondingCurve", curveAddr);

  const status = await curve.status();
  console.log(`Curve ${curveAddr} status=${status} (1=Graduating, 2=Graduated)`);
  console.log(`Reserve: ${ethers.formatEther(await curve.reserve())} OPN`);

  if (status === 1n) {
    const tx = await curve.retryGraduation({ gasLimit: 6_000_000 });
    console.log(`retryGraduation tx: ${tx.hash}`);
    const rc = await tx.wait();
    // Decode any GraduationFailed event.
    for (const log of rc!.logs) {
      try {
        const parsed = curve.interface.parseLog(log as any);
        if (parsed?.name === "GraduationFailed") {
          console.log(`GraduationFailed reason: ${parsed.args.reason}`);
        }
        if (parsed?.name === "Graduated") {
          console.log(`Graduated! pool=${parsed.args.pool} lp=${parsed.args.lpAmount}`);
        }
      } catch {}
    }
    console.log(`New status=${await curve.status()}, pool=${await curve.pool()}`);
  } else {
    console.log("Not in Graduating state; nothing to retry.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
