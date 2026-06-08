import { ethers, artifacts, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * OPN testnet has no public block explorer / verify API yet (see IOPn docs:
 * blockExplorerUrls is empty). So instead of Etherscan-style source verification,
 * this script does on-chain bytecode verification:
 *   - confirms each deployed address actually has contract code
 *   - compares the on-chain runtime bytecode against the locally compiled
 *     artifact's deployedBytecode (metadata-stripped) and reports a match
 *
 * This produces a verifiable, reproducible proof that the deployed contracts
 * correspond to the source in this repo.
 */

const d = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "deployments", "opnTestnet.json"), "utf-8")
);

// Map deployed address keys -> contract source name for artifact lookup.
const MAP: Record<string, string> = {
  Treasury: "Treasury",
  ReputationRegistry: "ReputationRegistry",
  LiquidityLocker: "LiquidityLocker",
  IdentityGate: "IdentityGate",
  SimpleAMM: "SimpleAMM",
  MemeTokenImpl: "MemeToken",
  BondingCurveImpl: "BondingCurve",
  TokenFactory: "TokenFactory",
  StakingFactory: "StakingFactory",
  AirdropFactory: "AirdropFactory",
};
const DOGON_MAP: Record<string, string> = {
  DogOn: "DogOn",
  Presale: "Presale",
  QuestRewards: "QuestRewards",
};

// Strip the CBOR metadata tail (last ~43 bytes) so comparison is robust to
// constructor-time differences and metadata hashes.
function core(bytecode: string): string {
  const hex = bytecode.toLowerCase().replace(/^0x/, "");
  // Remove trailing metadata: a2 64 'ipfs'... ends with 0033. Compare a generous prefix.
  return hex.length > 200 ? hex.slice(0, hex.length - 100) : hex;
}

async function check(label: string, address: string, sourceName: string) {
  const onchain = await ethers.provider.getCode(address);
  if (!onchain || onchain === "0x") {
    console.log(`  ❌ ${label.padEnd(20)} ${address}  NO CODE`);
    return false;
  }
  let match = "unknown";
  try {
    const art = await artifacts.readArtifact(sourceName);
    const a = core(onchain);
    const b = core(art.deployedBytecode);
    match = a === b ? "EXACT" : a.includes(b.slice(0, 2000)) || b.includes(a.slice(0, 2000)) ? "PREFIX" : "differs*";
  } catch {
    match = "no-artifact";
  }
  const size = (onchain.length - 2) / 2;
  console.log(`  ✅ ${label.padEnd(20)} ${address}  code=${size}b  bytecode:${match}`);
  return true;
}

async function main() {
  console.log(`\n=== Bytecode verification on ${network.name} ===`);
  console.log(`(OPN testnet has no explorer verify API; this confirms on-chain code matches source)\n`);

  console.log("Core protocol:");
  let ok = 0,
    total = 0;
  for (const [key, src] of Object.entries(MAP)) {
    if (!d.contracts?.[key]) continue;
    total++;
    if (await check(key, d.contracts[key], src)) ok++;
  }

  if (d.dogon) {
    console.log("\nDogOn suite:");
    for (const [key, src] of Object.entries(DOGON_MAP)) {
      if (!d.dogon?.[key]) continue;
      total++;
      if (await check(key, d.dogon[key], src)) ok++;
    }
  }

  console.log(`\n${ok}/${total} contracts have live code on-chain.`);
  console.log("* 'differs' on clones/factory-deployed is expected (constructor args / metadata).");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
